'use node';

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { action, internalAction } from './_generated/server';

/**
 * Generate Cloudflare Stream tus upload configuration using Direct Creator Upload.
 * This returns the video ID upfront and provides the tus endpoint for resumable uploads.
 * Recommended for files over 200MB.
 */
export const generateCloudflareTusConfig = action({
  args: {},
  returns: v.object({
    tusEndpoint: v.string(),
    videoUid: v.string(),
    videoId: v.id('videos'),
  }),
  handler: async (ctx) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }
    const userId = identity.subject;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    // Use Direct Creator Upload to get video ID upfront
    // This API returns both the video ID and tus endpoint
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600, // 1 hour max
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to generate upload URL: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Cloudflare API returned unsuccessful response');
    }

    const uid = data.result.uid;
    // The tus endpoint is the same as the direct upload endpoint
    // But we'll use the tus protocol endpoint instead
    const tusEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;

    // Create video record in database
    const videoId: Id<'videos'> = await ctx.runMutation(
      api.videoMutations.createVideo,
      {
        cloudflareUid: uid,
        userId,
      }
    );

    return {
      tusEndpoint,
      videoUid: uid,
      videoId,
    };
  },
});

/**
 * Get Cloudflare API token for tus uploads.
 * Note: This token should be scoped to only allow Stream uploads for security.
 */
export const getCloudflareApiToken = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!apiToken) {
      throw new Error(
        'Cloudflare API token not configured. Please set CLOUDFLARE_API_TOKEN environment variable.'
      );
    }

    // Return the API token (should be scoped to Stream uploads only)
    return apiToken;
  },
});

/**
 * Check Cloudflare Stream video status by polling the API.
 * This is called periodically (every 10 seconds) until video is ready or errors.
 */
export const checkVideoStatus = internalAction({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    // Get video record to check polling start time
    const videoRecord = await ctx.runQuery(
      api.videoQueries.getVideoByCloudflareUid,
      {
        cloudflareUid: args.cloudflareUid,
      }
    );

    // Check for timeout (30 minutes = 1800 seconds)
    const POLLING_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    if (videoRecord?.pollingStartTime) {
      const elapsed = now - videoRecord.pollingStartTime;
      if (elapsed > POLLING_TIMEOUT_MS) {
        // Timeout reached - stop polling and mark as timeout
        await ctx.runMutation(internal.videoMutations.updateVideoState, {
          cloudflareUid: args.cloudflareUid,
          state: 'processing_timeout',
          errorMessage:
            'Video processing timed out after 30 minutes. Cloudflare may be experiencing issues. Please check status manually.',
        });
        return null;
      }
    }

    // Get video status from Cloudflare Stream API
    const videoResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${args.cloudflareUid}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      console.error(
        `Failed to get video status: ${videoResponse.status} ${errorText}`
      );
      // Schedule another check in case it's a temporary error
      await ctx.scheduler.runAfter(10, internal.videos.checkVideoStatus, {
        cloudflareUid: args.cloudflareUid,
      });
      return null;
    }

    const videoData = await videoResponse.json();

    if (!videoData.success) {
      console.error('Cloudflare API returned unsuccessful response');
      // Schedule another check
      await ctx.scheduler.runAfter(10, internal.videos.checkVideoStatus, {
        cloudflareUid: args.cloudflareUid,
      });
      return null;
    }

    const video = videoData.result;
    const status = video.status?.state;

    // Check if video is ready
    if (status === 'ready') {
      // Update state to video_processed
      await ctx.runMutation(internal.videoMutations.updateVideoState, {
        cloudflareUid: args.cloudflareUid,
        state: 'video_processed',
      });

      // Trigger download of 480p video
      await ctx.scheduler.runAfter(0, internal.videos.downloadVideo480p, {
        cloudflareUid: args.cloudflareUid,
      });
    } else if (status === 'error') {
      // Handle error state
      const errorCode = video.status?.errReasonCode || 'ERR_UNKNOWN';
      const errorText = video.status?.errReasonText || 'Unknown error';
      await ctx.runMutation(internal.videoMutations.updateVideoState, {
        cloudflareUid: args.cloudflareUid,
        state: 'video_processed',
        errorMessage: `${errorCode}: ${errorText}`,
      });
    } else {
      // Video is still processing, schedule another check in 10 seconds
      await ctx.scheduler.runAfter(10, internal.videos.checkVideoStatus, {
        cloudflareUid: args.cloudflareUid,
      });
    }

    return null;
  },
});

/**
 * Download and downsize video from Cloudflare Stream using FFmpeg API.
 * Steps:
 * 1. Request default MP4 download from Cloudflare Stream
 * 2. Poll until download is ready
 * 3. Use FFmpeg API to downsize to 480p
 * 4. Return downsized video URL
 */
export const downloadVideo480p = internalAction({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.object({
    downsizedVideoUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const ffmpegApiKey = process.env.FFMPEG_API_KEY;

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    if (!ffmpegApiKey) {
      throw new Error(
        'FFmpeg API key not configured. Please set FFMPEG_API_KEY environment variable.'
      );
    }

    // Step 1: Request default MP4 download from Cloudflare Stream
    const requestDownloadResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${args.cloudflareUid}/downloads`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!requestDownloadResponse.ok) {
      const errorText = await requestDownloadResponse.text();
      throw new Error(
        `Failed to request download: ${requestDownloadResponse.status} ${errorText}`
      );
    }

    const requestDownloadData = await requestDownloadResponse.json();

    if (!requestDownloadData.success) {
      throw new Error('Cloudflare API returned unsuccessful response');
    }

    const downloadInfo = requestDownloadData.result.default;
    const downloadUrl = downloadInfo.url;

    // Step 2: Poll until download is ready
    let downloadReady = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)

    while (!downloadReady && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const checkDownloadResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${args.cloudflareUid}/downloads`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );

      if (checkDownloadResponse.ok) {
        const checkData = await checkDownloadResponse.json();
        if (checkData.success && checkData.result.default?.status === 'ready') {
          downloadReady = true;
        }
      }

      attempts++;
    }

    if (!downloadReady) {
      throw new Error('Cloudflare download did not become ready in time');
    }

    // Step 3: Use FFmpeg API to downsize video to 480p
    // First, we need to upload the video to FFmpeg API
    // Since FFmpeg API requires file upload, we'll download from Cloudflare first
    // then upload to FFmpeg API

    try {
      // Download video from Cloudflare
      const videoDownloadResponse = await fetch(downloadUrl);

      if (!videoDownloadResponse.ok) {
        throw new Error(
          `Failed to download video from Cloudflare: ${videoDownloadResponse.status}`
        );
      }

      const videoBlob = await videoDownloadResponse.blob();

      // Upload video to FFmpeg API
      const ffmpegFileResponse = await fetch(
        'https://api.ffmpeg-api.com/file',
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${ffmpegApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_name: `${args.cloudflareUid}_original.mp4`,
          }),
        }
      );

      if (!ffmpegFileResponse.ok) {
        const errorText = await ffmpegFileResponse.text();
        throw new Error(
          `FFmpeg API file creation failed: ${ffmpegFileResponse.status} ${errorText}`
        );
      }

      const ffmpegFileData = await ffmpegFileResponse.json();
      const { file, upload } = ffmpegFileData;

      // Upload the video file
      const uploadResponse = await fetch(upload.url, {
        method: 'PUT',
        body: videoBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Failed to upload video to FFmpeg API: ${uploadResponse.status}`
        );
      }

      // Process video to downsize to 480p
      const ffmpegProcessResponse = await fetch(
        'https://api.ffmpeg-api.com/ffmpeg/process',
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${ffmpegApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task: {
              inputs: [{ file_path: file.file_path }],
              outputs: [
                {
                  file: `${args.cloudflareUid}_480p.mp4`,
                  // FFmpeg options to resize to 480p height, maintain aspect ratio
                  // -vf scale=-2:480: scale to 480p height, auto width
                  // -c:v libx264: use H.264 codec
                  // -crf 23: good quality/size balance
                  // -preset medium: encoding speed/quality balance
                  options: [
                    '-vf',
                    'scale=-2:480',
                    '-c:v',
                    'libx264',
                    '-crf',
                    '23',
                    '-preset',
                    'medium',
                    '-c:a',
                    'copy', // Copy audio without re-encoding
                  ],
                },
              ],
            },
          }),
        }
      );

      if (!ffmpegProcessResponse.ok) {
        const errorText = await ffmpegProcessResponse.text();
        throw new Error(
          `FFmpeg API processing failed: ${ffmpegProcessResponse.status} ${errorText}`
        );
      }

      const ffmpegProcessData = await ffmpegProcessResponse.json();

      // Get the downsized video download URL
      // FFmpeg API returns an array of results
      const downsizedVideoUrl =
        ffmpegProcessData[0]?.download_url ||
        ffmpegProcessData.download_url ||
        ffmpegProcessData.result?.[0]?.download_url;

      if (!downsizedVideoUrl) {
        throw new Error('FFmpeg API did not return download URL');
      }

      // Update video record with downsized URL
      await ctx.runMutation(
        internal.videoMutations.updateVideoWithDownsizedUrl,
        {
          cloudflareUid: args.cloudflareUid,
          downsizedVideoUrl,
        }
      );

      // Trigger AI analysis with the downsized video
      await ctx.scheduler.runAfter(0, internal.videos.analyzeVideoWithGemini, {
        cloudflareUid: args.cloudflareUid,
        videoUrl: downsizedVideoUrl,
      });

      return {
        downsizedVideoUrl,
      };
    } catch (error) {
      // Update video state to failed_compression
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown compression error';
      await ctx.runMutation(internal.videoMutations.updateVideoState, {
        cloudflareUid: args.cloudflareUid,
        state: 'failed_compression',
        errorMessage,
      });
      throw error;
    }
  },
});

/**
 * Analyze video using Gemini Flash 2.0 via OpenRouter API.
 * Downloads the downsized video and sends it to Gemini for analysis.
 */
export const analyzeVideoWithGemini = internalAction({
  args: {
    cloudflareUid: v.string(),
    videoUrl: v.string(),
  },
  returns: v.object({
    analysis: v.string(),
  }),
  handler: async (ctx, args) => {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      throw new Error(
        'OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.'
      );
    }

    try {
      // Update state to video_sent_to_ai
      await ctx.runMutation(internal.videoMutations.updateVideoState, {
        cloudflareUid: args.cloudflareUid,
        state: 'video_sent_to_ai',
      });

      // Download the downsized video
      const videoResponse = await fetch(args.videoUrl);

      if (!videoResponse.ok) {
        throw new Error(
          `Failed to download downsized video: ${videoResponse.status}`
        );
      }

      const videoBlob = await videoResponse.blob();
      const videoBuffer = await videoBlob.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');
      const videoDataUrl = `data:video/mp4;base64,${videoBase64}`;

      // Send video to Gemini Flash 2.0 via OpenRouter
      // Using base64 data URL since FFmpeg API URLs may not be publicly accessible
      // According to OpenRouter docs: https://openrouter.ai/docs/features/multimodal/videos
      const openRouterResponse = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              process.env.OPENROUTER_HTTP_REFERER || 'https://influbot.com',
            'X-Title': 'Influbot Video Analysis',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Analyze this video and provide a detailed analysis including: main content, key moments, visual elements, and any notable features. Be comprehensive and detailed.',
                  },
                  {
                    type: 'video_url',
                    video_url: {
                      url: videoDataUrl,
                    },
                  },
                ],
              },
            ],
            max_tokens: 4000,
          }),
        }
      );

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        throw new Error(
          `OpenRouter API failed: ${openRouterResponse.status} ${errorText}`
        );
      }

      const openRouterData = await openRouterResponse.json();

      const analysis =
        openRouterData.choices?.[0]?.message?.content ||
        openRouterData.choices?.[0]?.text ||
        'Analysis not available';

      // Update video record with analysis and set state to video_analysed
      await ctx.runMutation(internal.videoMutations.updateVideoWithAnalysis, {
        cloudflareUid: args.cloudflareUid,
        analysis,
      });

      return {
        analysis,
      };
    } catch (error) {
      // Update video state to failed_analysis
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown analysis error';
      await ctx.runMutation(internal.videoMutations.updateVideoState, {
        cloudflareUid: args.cloudflareUid,
        state: 'failed_analysis',
        errorMessage,
      });
      throw error;
    }
  },
});

/**
 * Retry compression for a video that failed compression.
 * This action can be called from the UI to retry the compression step.
 */
export const retryCompression = action({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Verify video exists and belongs to user
    const video = await ctx.runQuery(api.videoQueries.getVideoByCloudflareUid, {
      cloudflareUid: args.cloudflareUid,
    });

    if (!video) {
      throw new Error('Video not found');
    }

    if (video.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    if (video.state !== 'failed_compression') {
      throw new Error('Video is not in failed_compression state');
    }

    // Reset state to video_processed and clear error message
    await ctx.runMutation(internal.videoMutations.updateVideoState, {
      cloudflareUid: args.cloudflareUid,
      state: 'video_processed',
    });

    // Trigger compression again
    await ctx.scheduler.runAfter(0, internal.videos.downloadVideo480p, {
      cloudflareUid: args.cloudflareUid,
    });

    return null;
  },
});

/**
 * Retry analysis for a video that failed analysis.
 * This action can be called from the UI to retry the analysis step.
 */
export const retryAnalysis = action({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Verify video exists and belongs to user
    const video = await ctx.runQuery(api.videoQueries.getVideoByCloudflareUid, {
      cloudflareUid: args.cloudflareUid,
    });

    if (!video) {
      throw new Error('Video not found');
    }

    if (video.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    if (video.state !== 'failed_analysis') {
      throw new Error('Video is not in failed_analysis state');
    }

    if (!video.downsizedVideoUrl) {
      throw new Error('Downsized video URL not found');
    }

    // Trigger analysis again
    await ctx.scheduler.runAfter(0, internal.videos.analyzeVideoWithGemini, {
      cloudflareUid: args.cloudflareUid,
      videoUrl: video.downsizedVideoUrl,
    });

    return null;
  },
});

/**
 * Manually check video processing status.
 * Can be called from UI to retry checking status after timeout or to check current status.
 */
export const checkVideoStatusManually = action({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Verify video exists and belongs to user
    const video = await ctx.runQuery(api.videoQueries.getVideoByCloudflareUid, {
      cloudflareUid: args.cloudflareUid,
    });

    if (!video) {
      throw new Error('Video not found');
    }

    if (video.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    // Reset polling start time and state if it was timed out
    if (video.state === 'processing_timeout') {
      await ctx.runMutation(internal.videoMutations.updateVideoState, {
        cloudflareUid: args.cloudflareUid,
        state: 'video_uploaded',
      });
      // Update polling start time via a query to get the video, then update
      const videoRecord = await ctx.runQuery(
        api.videoQueries.getVideoByCloudflareUid,
        {
          cloudflareUid: args.cloudflareUid,
        }
      );
      if (videoRecord) {
        await ctx.runMutation(api.videoMutations.updatePollingStartTime, {
          cloudflareUid: args.cloudflareUid,
        });
      }
    }

    // Trigger status check immediately
    await ctx.scheduler.runAfter(0, internal.videos.checkVideoStatus, {
      cloudflareUid: args.cloudflareUid,
    });

    return null;
  },
});

/**
 * Delete a video from Cloudflare Stream and Convex database.
 * Used to clean up failed uploads.
 */
export const deleteVideo = action({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Verify video exists and belongs to user
    const video = await ctx.runQuery(api.videoQueries.getVideoByCloudflareUid, {
      cloudflareUid: args.cloudflareUid,
    });

    if (!video) {
      // Video doesn't exist in Convex, but try to delete from Cloudflare anyway
      console.warn(`Video ${args.cloudflareUid} not found in Convex`);
    } else {
      if (video.userId !== identity.subject) {
        throw new Error('Unauthorized');
      }

      // Delete from Convex database
      await ctx.runMutation(api.videoMutations.deleteVideo, {
        videoId: video._id,
      });
    }

    // Delete from Cloudflare Stream (ignore errors if video doesn't exist)
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (accountId && apiToken) {
      try {
        const deleteResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${args.cloudflareUid}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${apiToken}`,
            },
          }
        );

        if (!deleteResponse.ok) {
          // Log but don't throw - video might not exist in Cloudflare
          const errorText = await deleteResponse.text();
          console.warn(
            `Failed to delete video from Cloudflare: ${deleteResponse.status} ${errorText}`
          );
        }
      } catch (error) {
        // Log but don't throw - this is cleanup
        console.warn('Error deleting video from Cloudflare:', error);
      }
    }

    return null;
  },
});

/**
 * Retry upload for a video that failed upload.
 * Generates a new upload URL and resets the state.
 * Note: User will need to upload the file again using the new URL.
 */
export const retryUpload = action({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.object({
    uploadURL: v.string(),
    uid: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Verify video exists and belongs to user
    const video = await ctx.runQuery(api.videoQueries.getVideoByCloudflareUid, {
      cloudflareUid: args.cloudflareUid,
    });

    if (!video) {
      throw new Error('Video not found');
    }

    if (video.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    if (video.state !== 'failed_upload') {
      throw new Error('Video is not in failed_upload state');
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    // Generate a new upload URL
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600, // 1 hour max
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to generate upload URL: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Cloudflare API returned unsuccessful response');
    }

    const newUid = data.result.uid;

    // Update video record with new UID and reset state
    await ctx.runMutation(internal.videoMutations.updateVideoState, {
      cloudflareUid: args.cloudflareUid,
      state: 'upload_url_generated',
    });

    // Update cloudflareUid to the new one
    // We need to do this via a mutation
    await ctx.runMutation(api.videoMutations.updateCloudflareUid, {
      oldCloudflareUid: args.cloudflareUid,
      newCloudflareUid: newUid,
    });

    return {
      uploadURL: data.result.uploadURL,
      uid: newUid,
    };
  },
});
