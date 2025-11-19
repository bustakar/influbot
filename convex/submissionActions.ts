'use node';

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { action, internalAction } from './_generated/server';

/**
 * Generate a topic idea for a submission using Gemini Flash 2.0 via OpenRouter.
 * This creates a topic suggestion based on the challenge's desired improvements and prompt.
 */
export const generateTopicForSubmission = internalAction({
  args: {
    submissionId: v.id('submissions'),
    challengeId: v.id('challenges'),
    previousTopics: v.array(v.string()),
    desiredImprovements: v.array(v.string()),
    specifyPrompt: v.string(),
  },
  returns: v.object({
    topic: v.string(),
  }),
  handler: async (ctx, args) => {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      throw new Error(
        'OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.'
      );
    }

    try {
      // Create a prompt for topic generation based on challenge details
      const previousTopicsList = args.previousTopics.join(', ');
      const improvementsList = args.desiredImprovements.join(', ');
      const topicPrompt = `Generate a specific, engaging topic idea for a video submission. 
  
  Context:
  - Previous topics: ${previousTopicsList}
  - The user wants to improve: ${improvementsList}
  - Their specific goal: ${args.specifyPrompt}
  
  Generate a single, clear topic idea that would help them practice and improve in these areas. The topic should be:
  1. Specific and actionable
  2. Relevant to their improvement goals
  3. Engaging and motivating
  4. Suitable for a short video (2-5 minutes)
  
  Respond with ONLY the topic idea, nothing else. Keep it concise (1-2 sentences maximum).`;

      const openRouterResponse = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              process.env.OPENROUTER_HTTP_REFERER || 'https://influbot.com',
            'X-Title': 'Influbot Topic Generation',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            messages: [
              {
                role: 'user',
                content: topicPrompt,
              },
            ],
            // max_tokens: 200,
          }),
        }
      );

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();

        // Check if response is HTML (Cloudflare error page)
        let cleanError: string;
        if (
          errorText.trim().startsWith('<!DOCTYPE') ||
          errorText.trim().startsWith('<html')
        ) {
          // It's an HTML error page, provide a cleaner message
          cleanError = `OpenRouter API temporarily unavailable (${openRouterResponse.status}). Please try again later.`;
        } else {
          // Try to parse as JSON for structured errors
          try {
            const errorJson = JSON.parse(errorText);
            cleanError =
              errorJson.error?.message ||
              errorJson.message ||
              errorText.substring(0, 200);
          } catch {
            // Not JSON, use first 200 chars
            cleanError = errorText.substring(0, 200);
          }
        }

        throw new Error(
          `OpenRouter API failed: ${openRouterResponse.status} - ${cleanError}`
        );
      }

      const openRouterData = await openRouterResponse.json();

      const topic =
        openRouterData.choices?.[0]?.message?.content ||
        openRouterData.choices?.[0]?.text ||
        null;

      if (!topic || topic.trim() === '') {
        throw new Error('No topic returned from API');
      }

      // Update submission with the generated topic (clear any previous errors)
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionTopic,
        {
          submissionId: args.submissionId,
          topic: topic.trim(),
          topicGenerationError: undefined, // Clear error on success
        }
      );

      return {
        topic: topic.trim(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown topic generation error';
      console.error('Failed to generate topic:', errorMessage);

      // Update submission with error (but don't set topic)
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionTopic,
        {
          submissionId: args.submissionId,
          topic: 'Topic generation failed. Please create your own topic.',
          topicGenerationError: errorMessage,
        }
      );

      return {
        topic: 'Topic generation failed. Please create your own topic.',
      };
    }
  },
});

/**
 * Retry topic generation for a submission.
 * This action can be called from the UI to retry topic generation.
 */
export const retryTopicGeneration = action({
  args: {
    submissionId: v.id('submissions'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get submission to verify ownership and get challengeId
    const submission = await ctx.runQuery(api.submissions.getById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    // Get challenge details
    const challenge = await ctx.runQuery(api.challenges.getById, {
      challengeId: submission.challengeId,
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    // Get previous topics from other submissions in this challenge
    // We'll fetch the challenge which includes submission slots with topics
    const previousTopics: string[] = [];
    if (challenge.submissionSlots) {
      for (const slot of challenge.submissionSlots) {
        if (
          slot.submission &&
          slot.submission.topic &&
          slot.submission._id !== args.submissionId &&
          !slot.submission.topicGenerationError
        ) {
          previousTopics.push(slot.submission.topic);
        }
      }
    }

    // Trigger topic generation
    await ctx.scheduler.runAfter(
      0,
      internal.submissionActions.generateTopicForSubmission,
      {
        submissionId: args.submissionId,
        challengeId: submission.challengeId,
        previousTopics,
        desiredImprovements: challenge.desiredImprovements,
        specifyPrompt: challenge.specifyPrompt,
      }
    );

    return null;
  },
});

export const generateSubmissionTusConfig: ReturnType<typeof action> = action({
  args: {
    submissionId: v.id('submissions'),
    fileSize: v.number(),
    fileName: v.string(),
    fileType: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
    videoUid: v.string(),
  }),
  handler: async (ctx, args) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID environment variable.'
      );
    }

    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!apiToken) {
      throw new Error(
        'Cloudflare API token not configured. Please set CLOUDFLARE_API_TOKEN environment variable.'
      );
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const submission = await ctx.runQuery(api.submissions.getById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    const uploadMetadata = Buffer.from(
      `name=${args.fileName},filetype=${args.fileType}`
    ).toString('base64');

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': args.fileSize.toString(),
          'Upload-Metadata': uploadMetadata,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cloudflare API error: ${response.status} ${text}`);
    }

    const uploadUrl = response.headers.get('Location');
    const streamMediaId = response.headers.get('stream-media-id');

    if (!uploadUrl || !streamMediaId) {
      throw new Error(
        'Missing Location or stream-media-id header from Cloudflare'
      );
    }

    await ctx.runMutation(
      api.submissionMutations.updateSubmissionCloudflareUid,
      {
        submissionId: args.submissionId,
        cloudflareUid: streamMediaId,
      }
    );

    return {
      uploadUrl: uploadUrl,
      videoUid: streamMediaId,
    };
  },
});

/**
 * Check Cloudflare Stream video status for a submission by polling the API.
 * This is called periodically (every 30 seconds) until video is ready or max retries reached.
 */
export const checkSubmissionVideoStatus = internalAction({
  args: {
    submissionId: v.id('submissions'),
    retryCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const MAX_RETRY_COUNT = 20; // Increased to allow for page reloads and longer processing
    const POLLING_INTERVAL_SECONDS = 30;

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    const submission = await ctx.runQuery(
      internal.submissions.getByIdInternal,
      {
        submissionId: args.submissionId,
      }
    );

    if (!submission) {
      console.warn(`Submission with id ${args.submissionId} not found`);
      return null;
    }

    if (!submission.cloudflareUid) {
      console.warn(`Submission ${args.submissionId} has no cloudflareUid`);
      return null;
    }

    if (args.retryCount >= MAX_RETRY_COUNT) {
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionState,
        {
          submissionId: args.submissionId,
          state: 'processing_timeout',
          errorMessage: `Video processing timed out after ${MAX_RETRY_COUNT} attempts (${MAX_RETRY_COUNT * POLLING_INTERVAL_SECONDS} seconds). Cloudflare may be experiencing issues. Please check status manually.`,
          pollingRetryCount: args.retryCount,
        }
      );
      return null;
    }

    try {
      const videoResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${submission.cloudflareUid}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );

      if (videoResponse.status === 404) {
        console.error(
          `Video ${submission.cloudflareUid} not found in Cloudflare (404). State: ${submission.state}.`
        );

        if (submission.state === 'video_uploaded') {
          if (args.retryCount < 3) {
            console.log(
              "Video 404'd but treating as temporary for first few retries"
            );
            const nextRetryCount = args.retryCount + 1;
            await ctx.scheduler.runAfter(
              POLLING_INTERVAL_SECONDS,
              internal.submissionActions.checkSubmissionVideoStatus,
              {
                submissionId: args.submissionId,
                retryCount: nextRetryCount,
              }
            );
            await ctx.runMutation(
              internal.submissionMutations.updateSubmissionState,
              {
                submissionId: args.submissionId,
                state: submission.state,
                pollingRetryCount: nextRetryCount,
              }
            );
            return null;
          }

          await ctx.runMutation(
            internal.submissionMutations.updateSubmissionState,
            {
              submissionId: args.submissionId,
              state: 'video_uploaded', // Keep current state, set error
              errorMessage:
                'Video not found in Cloudflare. The upload may have failed or the video was deleted.',
              pollingRetryCount: args.retryCount,
            }
          );
          return null;
        } else {
          console.warn(
            `Video ${submission.cloudflareUid} not found but state is ${submission.state}. Stopping polling.`
          );
          await ctx.runMutation(
            internal.submissionMutations.updateSubmissionState,
            {
              submissionId: args.submissionId,
              state: 'video_uploaded', // Keep current state, set error
              errorMessage:
                'Video not found in Cloudflare. Please try uploading again.',
              pollingRetryCount: args.retryCount,
            }
          );
          return null;
        }
      }

      if (!videoResponse.ok) {
        const errorText = await videoResponse.text();
        console.error(
          `Failed to get video status: ${videoResponse.status} ${errorText}`
        );
        // For other errors, schedule next check and continue polling
        const nextRetryCount = args.retryCount + 1;
        if (nextRetryCount < MAX_RETRY_COUNT) {
          await ctx.scheduler.runAfter(
            POLLING_INTERVAL_SECONDS,
            internal.submissionActions.checkSubmissionVideoStatus,
            {
              submissionId: args.submissionId,
              retryCount: nextRetryCount,
            }
          );
        }

        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: submission.state,
            pollingRetryCount: nextRetryCount,
          }
        );
        return null;
      }

      const videoData = await videoResponse.json();

      if (!videoData.success) {
        const nextRetryCount = args.retryCount + 1;
        if (nextRetryCount < MAX_RETRY_COUNT) {
          await ctx.scheduler.runAfter(
            POLLING_INTERVAL_SECONDS,
            internal.submissionActions.checkSubmissionVideoStatus,
            {
              submissionId: args.submissionId,
              retryCount: nextRetryCount,
            }
          );
        }

        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: submission.state,
            pollingRetryCount: nextRetryCount,
          }
        );
        return null;
      }

      const video = videoData.result;
      const status = video.status?.state;

      if (status === 'ready') {
        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: 'video_processed',
            pollingRetryCount: args.retryCount,
          }
        );

        await ctx.scheduler.runAfter(
          0,
          internal.submissionActions.getCompressedSubmissionVideoDownloadUrl,
          {
            submissionId: args.submissionId,
            cloudflareUid: submission.cloudflareUid,
          }
        );
      } else if (status === 'error') {
        const errorCode = video.status?.errReasonCode || 'ERR_UNKNOWN';
        const errorText = video.status?.errReasonText || 'Unknown error';
        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: 'video_uploaded', // Keep current state, set error
            errorMessage: `${errorCode}: ${errorText}`,
            pollingRetryCount: args.retryCount,
          }
        );
      } else {
        const nextRetryCount = args.retryCount + 1;
        if (nextRetryCount < MAX_RETRY_COUNT) {
          await ctx.scheduler.runAfter(
            POLLING_INTERVAL_SECONDS,
            internal.submissionActions.checkSubmissionVideoStatus,
            {
              submissionId: args.submissionId,
              retryCount: nextRetryCount,
            }
          );
        }

        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: submission.state,
            pollingRetryCount: nextRetryCount,
          }
        );
      }
    } catch (error) {
      console.error('Error checking video status:', error);
      const nextRetryCount = args.retryCount + 1;
      if (nextRetryCount < MAX_RETRY_COUNT) {
        await ctx.scheduler.runAfter(
          POLLING_INTERVAL_SECONDS,
          internal.submissionActions.checkSubmissionVideoStatus,
          {
            submissionId: args.submissionId,
            retryCount: nextRetryCount,
          }
        );
      }
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionState,
        {
          submissionId: args.submissionId,
          state: submission.state,
          pollingRetryCount: nextRetryCount,
        }
      );
    }

    return null;
  },
});

/**
 * Download and compress video from Cloudflare Stream for a submission using FFmpeg API.
 * Returns the download URL for the compressed video.
 */
export const getCompressedSubmissionVideoDownloadUrl = internalAction({
  args: {
    submissionId: v.id('submissions'),
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

    try {
      // Request default MP4 download from Cloudflare Stream
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

      // Poll until download is ready
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
          if (
            checkData.success &&
            checkData.result.default?.status === 'ready'
          ) {
            downloadReady = true;
          }
        }

        attempts++;
      }

      if (!downloadReady) {
        throw new Error('Cloudflare download did not become ready in time');
      }

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
                    'copy',
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
      const downsizedVideoUrl =
        ffmpegProcessData[0]?.download_url ||
        ffmpegProcessData.download_url ||
        ffmpegProcessData.result?.[0]?.download_url;

      if (!downsizedVideoUrl) {
        throw new Error('FFmpeg API did not return download URL');
      }

      // Update submission record with downsized URL and set state to video_compressed
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionWithDownsizedUrl,
        {
          submissionId: args.submissionId,
          downsizedDownloadUrl: downsizedVideoUrl,
        }
      );

      // Update state to video_compressed before triggering AI
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionState,
        {
          submissionId: args.submissionId,
          state: 'video_compressed',
        }
      );

      // Trigger AI analysis with the compressed video
      await ctx.scheduler.runAfter(
        0,
        internal.submissionActions.analyzeSubmissionVideoWithGemini,
        {
          submissionId: args.submissionId,
          compressedVideoUrl: downsizedVideoUrl,
        }
      );

      return {
        downsizedVideoUrl,
      };
    } catch (error) {
      // Keep current state, set error message
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown compression error';
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionState,
        {
          submissionId: args.submissionId,
          state: 'video_processed', // Keep current state, set error
          errorMessage,
        }
      );
      throw error;
    }
  },
});

/**
 * Analyze submission video using Gemini API directly via Google Files API.
 * Uploads compressed video to Google Files API and sends file URI to Gemini.
 */
export const analyzeSubmissionVideoWithGemini = internalAction({
  args: {
    submissionId: v.id('submissions'),
    compressedVideoUrl: v.string(),
  },
  returns: v.object({
    analysis: v.string(),
  }),
  handler: async (ctx, args) => {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new Error(
        'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.'
      );
    }

    try {
      // Update state to video_sent_to_ai
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionState,
        {
          submissionId: args.submissionId,
          state: 'video_sent_to_ai',
        }
      );

      // Download the compressed video
      const videoResponse = await fetch(args.compressedVideoUrl);

      if (!videoResponse.ok) {
        throw new Error(
          `Failed to download compressed video: ${videoResponse.status}`
        );
      }

      const videoBlob = await videoResponse.blob();
      const videoBuffer = await videoBlob.arrayBuffer();
      const videoBytes = Buffer.from(videoBuffer);
      const videoSize = videoBytes.length;
      const mimeType = 'video/mp4';

      // Step 1: Initiate resumable upload to Google Files API
      const uploadInitResponse = await fetch(
        'https://generativelanguage.googleapis.com/upload/v1beta/files',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': geminiApiKey,
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': videoSize.toString(),
            'X-Goog-Upload-Header-Content-Type': mimeType,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: {
              display_name: `submission_${args.submissionId}_compressed.mp4`,
            },
          }),
        }
      );

      if (!uploadInitResponse.ok) {
        const errorText = await uploadInitResponse.text();
        throw new Error(
          `Failed to initiate file upload: ${uploadInitResponse.status} ${errorText}`
        );
      }

      const uploadUrl = uploadInitResponse.headers.get('x-goog-upload-url');
      if (!uploadUrl) {
        throw new Error('No upload URL returned from Google Files API');
      }

      // Step 2: Upload the video file
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': videoSize.toString(),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: videoBytes,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(
          `Failed to upload video file: ${uploadResponse.status} ${errorText}`
        );
      }

      const fileInfo = await uploadResponse.json();
      const fileUri = fileInfo.file?.uri;

      if (!fileUri) {
        throw new Error('No file URI returned from Google Files API');
      }

      // Extract file ID from URI (could be "files/abc123" or just "abc123" or full URL)
      let fileId: string;
      if (fileUri.includes('/')) {
        fileId = fileUri.split('/').pop() || fileUri;
      } else {
        fileId = fileUri;
      }

      // Step 3: Poll for file processing status
      let fileReady = false;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)

      while (!fileReady && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

        const fileStatusResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/files/${fileId}`,
          {
            method: 'GET',
            headers: {
              'x-goog-api-key': geminiApiKey,
            },
          }
        );

        if (fileStatusResponse.ok) {
          const fileStatus = await fileStatusResponse.json();
          const state = fileStatus.state || fileStatus.file?.state;
          if (state === 'ACTIVE') {
            fileReady = true;
          } else if (state === 'FAILED') {
            throw new Error(
              `File processing failed: ${fileStatus.error?.message || fileStatus.file?.error?.message || 'Unknown error'}`
            );
          }
        }

        attempts++;
      }

      if (!fileReady) {
        throw new Error('File did not become ready in time');
      }

      // Step 4: Send file URI to Gemini API for analysis
      const geminiResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': geminiApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    file_data: {
                      mime_type: mimeType,
                      file_uri: fileUri,
                    },
                  },
                  {
                    text: 'Analyze this video and provide a detailed analysis including: main content, key moments, visual elements, and any notable features. Be comprehensive and detailed.',
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        let cleanError: string;

        // Check if response is HTML (Cloudflare error page)
        if (
          errorText.trim().startsWith('<!DOCTYPE') ||
          errorText.trim().startsWith('<html')
        ) {
          cleanError = `Gemini API temporarily unavailable (${geminiResponse.status}). Please try again later.`;
        } else {
          // Try to parse as JSON for structured errors
          try {
            const errorJson = JSON.parse(errorText);
            cleanError =
              errorJson.error?.message ||
              errorJson.message ||
              errorText.substring(0, 200);
          } catch {
            // Not JSON, use first 200 chars
            cleanError = errorText.substring(0, 200);
          }
        }

        throw new Error(
          `Gemini API failed: ${geminiResponse.status} - ${cleanError}`
        );
      }

      const geminiData = await geminiResponse.json();

      // Extract text from response - Gemini API returns candidates[0].content.parts[]
      // where each part can have text property
      let analysis = 'Analysis not available';
      if (geminiData.candidates?.[0]?.content?.parts) {
        const textParts = geminiData.candidates[0].content.parts
          .filter((part: any) => part.text)
          .map((part: any) => part.text);
        if (textParts.length > 0) {
          analysis = textParts.join('\n\n');
        }
      }

      // Update submission record with analysis and set state to video_analysed
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionWithAnalysis,
        {
          submissionId: args.submissionId,
          analysis,
        }
      );

      return {
        analysis,
      };
    } catch (error) {
      // Keep current state, set error message
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown analysis error';
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionState,
        {
          submissionId: args.submissionId,
          state: 'video_sent_to_ai', // Keep current state, set error
          errorMessage,
        }
      );
      throw error;
    }
  },
});
