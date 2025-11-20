'use node';

import { v } from 'convex/values';
import { GoogleAuth } from 'google-auth-library';

import { api, internal } from './_generated/api';
import { action, internalAction } from './_generated/server';

/**
 * Generate a topic idea for a submission using Gemini API.
 * This creates a topic suggestion based on the challenge's desired improvements, previous topics, and analysis results.
 * Topics are progressively more difficult as the challenge progresses.
 */
export const generateTopicForSubmission = internalAction({
  args: {
    submissionId: v.id('submissions'),
    challengeId: v.id('challenges'),
    previousTopics: v.array(v.string()),
    previousAnalyses: v.array(v.string()),
    desiredImprovements: v.array(v.string()),
    specifyPrompt: v.string(),
    currentDay: v.number(),
    totalDays: v.number(),
  },
  returns: v.object({
    topic: v.string(),
  }),
  handler: async (ctx, args) => {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new Error(
        'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.'
      );
    }

    try {
      // Calculate progress and difficulty level
      const progress = args.currentDay / args.totalDays;
      let difficultyLevel = 'Beginner';
      let complexity =
        'Simple, focus on getting comfortable in front of the camera.';
      let constraints =
        'No specific constraints - just be yourself and speak naturally.';

      if (progress > 0.3) {
        difficultyLevel = 'Intermediate';
        complexity =
          'Add one specific physical or vocal constraint (e.g., stand still, speak louder, maintain eye contact).';
        constraints =
          'Focus on one improvement area at a time. Add a specific technique to practice.';
      }
      if (progress > 0.7) {
        difficultyLevel = 'Advanced';
        complexity =
          'Complex topics requiring combining multiple skills or rapid emotional shifts.';
        constraints =
          'Combine multiple improvement areas. Challenge yourself with more complex scenarios.';
      }

      // Build context from previous topics and analyses
      let previousContext = '';
      if (args.previousTopics.length > 0) {
        previousContext += `\n\nPrevious Topics (${args.previousTopics.length}):\n`;
        args.previousTopics.forEach((topic, idx) => {
          previousContext += `${idx + 1}. ${topic}\n`;
        });
      }

      if (args.previousAnalyses.length > 0) {
        previousContext += `\n\nPrevious Analysis Results (${args.previousAnalyses.length}):\n`;
        args.previousAnalyses.forEach((analysis, idx) => {
          // Extract key feedback from analysis (first 200 chars)
          const summary = analysis.substring(0, 200);
          previousContext += `${idx + 1}. ${summary}...\n`;
        });
      }

      const improvementsList = args.desiredImprovements.join(', ');

      const topicPrompt = `You are an expert Public Speaking Coach and Curriculum Designer. Your goal is to generate the NEXT topic for a user's ${args.totalDays}-day video challenge.

USER PROFILE:
- Goal: ${args.specifyPrompt}
- Wants to improve: ${improvementsList}
- Current Day: ${args.currentDay} of ${args.totalDays} (${difficultyLevel} stage)
- Progress: ${Math.round(progress * 100)}%${previousContext}

CURRICULUM DESIGN PRINCIPLES:
1. Progressive Difficulty: Start easy, gradually increase complexity
2. Skill Building: Each topic should build on previous learnings
3. Feedback Integration: If previous analyses showed weaknesses, create topics to practice those specific areas
4. Engagement: Topics should be interesting and motivating

DIFFICULTY GUIDELINES:
- ${difficultyLevel} Stage: ${complexity}
- Constraints: ${constraints}

TOPIC GENERATION RULES:
1. Design a topic appropriate for Day ${args.currentDay} (${difficultyLevel} level)
2. Focus on areas: ${improvementsList}
3. If previous analyses identified specific weaknesses, create a topic that directly addresses those
4. Make it specific, actionable, and suitable for a 2-5 minute video
5. Keep it engaging and motivating
6. Avoid repeating previous topics

OUTPUT FORMAT:
Respond with ONLY the topic text. It should be:
- A clear title/instruction (1-2 sentences maximum)
- Under 300 characters
- Actionable and specific
- No explanations, just the topic itself`;

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
                parts: [{ text: topicPrompt }],
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

      const topic =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

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

    // Get previous topics and analyses from other submissions in this challenge
    const previousTopics: string[] = [];
    const previousAnalyses: string[] = [];
    let currentDay = 0;

    if (challenge.submissionSlots) {
      for (const slot of challenge.submissionSlots) {
        if (slot.submission && slot.submission._id !== args.submissionId) {
          if (slot.submission.topic && !slot.submission.topicGenerationError) {
            previousTopics.push(slot.submission.topic);
          }
          if (
            slot.submission.analysisResult &&
            slot.submission.state === 'video_analysed'
          ) {
            const result = slot.submission.analysisResult;
            // Extract raw or summary for topic generation context
            if (result.raw) {
              previousAnalyses.push(result.raw);
            } else if (result.summary) {
              previousAnalyses.push(result.summary);
            } else {
              // Fallback to JSON string if neither exists
              previousAnalyses.push(JSON.stringify(result));
            }
          }
          // Count completed submissions to determine current day
          if (slot.submission.state === 'video_analysed') {
            currentDay++;
          }
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
        previousAnalyses,
        desiredImprovements: challenge.desiredImprovements,
        specifyPrompt: challenge.specifyPrompt,
        currentDay,
        totalDays: challenge.requiredNumberOfSubmissions,
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
 * Compress video from Cloudflare Stream and upload to Gemini Files API
 * using Cloud Run service. Returns the Gemini file URI.
 */
export const getCompressedSubmissionVideoDownloadUrl = internalAction({
  args: {
    submissionId: v.id('submissions'),
    cloudflareUid: v.string(),
  },
  returns: v.object({
    geminiFileUri: v.string(),
  }),
  handler: async (ctx, args) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const runUrl = process.env.RUN_URL;
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const apiKey = process.env.VIDEO_API_KEY; // Optional

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    if (!runUrl || !credsJson) {
      throw new Error(
        'Cloud Run service not configured. Please set RUN_URL and GOOGLE_APPLICATION_CREDENTIALS_JSON environment variables.'
      );
    }

    try {
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

      // Step 3: Call Cloud Run service to compress and upload to Gemini Files API
      // For Cloud Run, we need to use target audience (the service URL) without scopes
      const auth = new GoogleAuth({
        credentials: JSON.parse(credsJson),
      });

      const client = await auth.getIdTokenClient(runUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const compressResponse = await client.request({
        url: `${runUrl}/compress-to-gemini`,
        method: 'POST',
        headers,
        data: {
          downloadUrl,
          width: 480,
          crf: 24,
          preset: 'medium',
          fps: 10,
          audioBitrate: '96k',
          displayName: `submission_${args.submissionId}_480p.mp4`,
        },
        timeout: 1000 * 60 * 55,
      });

      const compressData = compressResponse.data as {
        id: string;
        uri: string;
        displayName?: string;
        mimeType?: string;
        sizeBytes?: number;
        elapsedMs?: number;
      };

      if (!compressData.id || !compressData.uri) {
        throw new Error(
          'Cloud Run service did not return valid file ID or URI'
        );
      }

      // Extract file ID from URI (could be "files/abc123" or just "abc123")
      let fileId: string;
      if (compressData.id.includes('/')) {
        fileId = compressData.id.split('/').pop() || compressData.id;
      } else {
        fileId = compressData.id;
      }

      // Step 4: Update submission record with Gemini file info
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionWithGeminiFile,
        {
          submissionId: args.submissionId,
          geminiFileUri: compressData.uri,
          geminiFileId: fileId,
        }
      );

      // Step 5: Update state to video_compressed
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionState,
        {
          submissionId: args.submissionId,
          state: 'video_compressed',
        }
      );

      // Step 6: Get challenge info and trigger AI analysis
      const submission = await ctx.runQuery(
        internal.submissions.getByIdInternal,
        {
          submissionId: args.submissionId,
        }
      );

      if (!submission) {
        throw new Error('Submission not found');
      }

      const challenge = await ctx.runQuery(
        internal.challenges.getByIdInternal,
        {
          challengeId: submission.challengeId,
        }
      );

      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // Trigger AI analysis with the Gemini file URI
      await ctx.scheduler.runAfter(
        0,
        internal.submissionActions.analyzeSubmissionVideoWithGemini,
        {
          submissionId: args.submissionId,
          geminiFileUri: compressData.uri,
          desiredImprovements: challenge.desiredImprovements,
        }
      );

      return {
        geminiFileUri: compressData.uri,
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
 * Analyze submission video using Gemini API.
 * Uses the Gemini file URI that was already uploaded by Cloud Run service.
 */
export const analyzeSubmissionVideoWithGemini = internalAction({
  args: {
    submissionId: v.id('submissions'),
    geminiFileUri: v.string(), // Changed from compressedVideoUrl
    desiredImprovements: v.array(v.string()),
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

      // Extract file ID from URI for polling
      let fileId: string;
      if (args.geminiFileUri.includes('/files/')) {
        fileId = args.geminiFileUri.split('/files/')[1].split('/')[0];
      } else if (args.geminiFileUri.includes('files/')) {
        fileId = args.geminiFileUri.split('files/')[1].split('/')[0];
      } else {
        throw new Error(
          `Invalid Gemini file URI format: ${args.geminiFileUri}`
        );
      }

      // Poll for file processing status (Cloud Run should have uploaded it, but verify it's ACTIVE)
      let fileReady = false;
      let attempts = 0;
      const maxAttempts = 30; // 2.5 minutes max (30 * 5 seconds)

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

      // Send file URI to Gemini API for analysis
      const analysisPrompt = `You are an expert Public Speaking Coach analyzing a video performance.

USER'S GOALS: The user wants to improve: ${args.desiredImprovements.join(', ')}

Analyze this video and provide a structured assessment. Focus on evaluating the user's performance in front of the camera, specifically looking at their public speaking skills.

EVALUATION AREAS:
- Posture: Body positioning, stance, physical presence
- Emotions: Emotional expression, facial expressions, emotional range
- Fillers: Use of filler words (um, uh, like, etc.)
- Eye Contact: Directness, consistency, engagement with camera
- Voice Clarity: Articulation, pronunciation, speech clarity
- Body Language: Gestures, movements, physical expressiveness
- Confidence: Overall confidence level, self-assurance
- Storytelling: Narrative structure, engagement, flow
- Energy Level: Enthusiasm, dynamism, energy
- Authenticity: Genuineness, naturalness, being yourself

Provide your response as a JSON object with the following exact structure:
{
  "scores": {
    "posture": <number 1-10>,
    "emotions": <number 1-10>,
    "fillers": <number 1-10>,
    "eye_contact": <number 1-10>,
    "voice_clarity": <number 1-10>,
    "body_language": <number 1-10>,
    "confidence": <number 1-10>,
    "storytelling": <number 1-10>,
    "energy_level": <number 1-10>,
    "authenticity": <number 1-10>,
    "overall": <number 1-10>
  },
  "summary": "<3 lines max: Overall performance summary>",
  "card_description": "<1 short sentence, max 10 words, for list view>",
  "key_moments": ["<moment 1>", "<moment 2>", "<moment 3>"],
  "improvement_tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

IMPORTANT: Return ONLY valid JSON. Do not wrap in markdown code blocks. Do not include any text before or after the JSON.`;

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
                      mime_type: 'video/mp4',
                      file_uri: args.geminiFileUri,
                    },
                  },
                  {
                    text: analysisPrompt,
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
            },
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

      // Extract JSON response - Gemini API returns candidates[0].content.parts[]
      // With response_mime_type: "application/json", it should return JSON directly
      let analysis = 'Analysis not available';
      let analysisJson: Record<string, unknown> | null = null;

      if (geminiData.candidates?.[0]?.content?.parts) {
        const textParts = geminiData.candidates[0].content.parts
          .filter((part: { text?: string }) => part.text)
          .map((part: { text?: string }) => part.text!);
        if (textParts.length > 0) {
          const responseText = textParts.join('\n\n');
          try {
            // Try to parse as JSON
            analysisJson = JSON.parse(responseText);
            // Store the JSON stringified version
            analysis = JSON.stringify(analysisJson, null, 2);
          } catch {
            // If not JSON, store as text
            analysis = responseText;
          }
        }
      }

      // Update submission record with analysis and set state to video_analysed
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionWithAnalysis,
        {
          submissionId: args.submissionId,
          analysis: analysis,
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
