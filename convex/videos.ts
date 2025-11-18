'use node';

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { action, internalAction } from './_generated/server';

/**
 * Generate a Cloudflare Stream direct upload URL for video uploads.
 * Returns the upload URL and video UID.
 */
export const generateCloudflareUploadUrl = action({
  args: {},
  returns: v.object({
    uploadURL: v.string(),
    uid: v.string(),
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

    // Create video record in database
    const videoId: Id<'videos'> = await ctx.runMutation(
      api.videoMutations.createVideo,
      {
        cloudflareUid: uid,
        userId,
      }
    );

    return {
      uploadURL: data.result.uploadURL,
      uid,
      videoId,
    };
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

    // Download video from Cloudflare
    const videoDownloadResponse = await fetch(downloadUrl);

    if (!videoDownloadResponse.ok) {
      throw new Error(
        `Failed to download video from Cloudflare: ${videoDownloadResponse.status}`
      );
    }

    const videoBlob = await videoDownloadResponse.blob();

    // Upload video to FFmpeg API
    const ffmpegFileResponse = await fetch('https://api.ffmpeg-api.com/file', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${ffmpegApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: `${args.cloudflareUid}_original.mp4`,
      }),
    });

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
    await ctx.runMutation(internal.videoMutations.updateVideoWithDownsizedUrl, {
      cloudflareUid: args.cloudflareUid,
      downsizedVideoUrl,
    });

    return {
      downsizedVideoUrl,
    };
  },
});
