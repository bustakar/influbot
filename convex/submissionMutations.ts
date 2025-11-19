import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';
import { videoStateValidator } from './schema';

export const updateSubmissionTopic = internalMutation({
  args: {
    submissionId: v.id('submissions'),
    topic: v.string(),
    topicGenerationError: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      console.warn(`Submission with id ${args.submissionId} not found`);
      return null;
    }

    await ctx.db.patch(args.submissionId, {
      topic: args.topic,
      ...(args.topicGenerationError !== undefined && {
        topicGenerationError: args.topicGenerationError,
      }),
      // Clear error if topic generation succeeded
      ...(args.topicGenerationError === undefined && {
        topicGenerationError: undefined,
      }),
    });

    return null;
  },
});

/**
 * Update submission with Cloudflare UID when upload URL is generated.
 */
export const updateSubmissionCloudflareUid = mutation({
  args: {
    submissionId: v.id('submissions'),
    cloudflareUid: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error(`Submission with id ${args.submissionId} not found`);
    }

    await ctx.db.patch(args.submissionId, {
      cloudflareUid: args.cloudflareUid,
      state: 'upload_url_generated',
    });

    return null;
  },
});

export const markSubmissionUploaded = mutation({
  args: {
    submissionId: v.id('submissions'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error(`Submission with id ${args.submissionId} not found`);
    }

    await ctx.db.patch(args.submissionId, {
      state: 'video_uploaded',
      pollingStartTime: Date.now(),
      pollingRetryCount: 0,
    });

    await ctx.scheduler.runAfter(
      30,
      internal.submissionActions.checkSubmissionVideoStatus,
      {
        submissionId: args.submissionId,
        retryCount: 0,
      }
    );

    return null;
  },
});

/**
 * Update submission state. Internal mutation called from polling action.
 */
export const updateSubmissionState = internalMutation({
  args: {
    submissionId: v.id('submissions'),
    state: videoStateValidator,
    errorMessage: v.optional(v.string()),
    pollingRetryCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      console.warn(
        `Submission with id ${args.submissionId} not found for state update`
      );
      return null;
    }

    await ctx.db.patch(args.submissionId, {
      state: args.state,
      ...(args.errorMessage !== undefined && {
        errorMessage: args.errorMessage,
      }),
      ...(args.errorMessage === undefined && { errorMessage: undefined }),
      ...(args.pollingRetryCount !== undefined && {
        pollingRetryCount: args.pollingRetryCount,
      }),
    });

    return null;
  },
});

/**
 * Update submission with downsized video URL.
 */
export const updateSubmissionWithDownsizedUrl = internalMutation({
  args: {
    submissionId: v.id('submissions'),
    downsizedDownloadUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      console.warn(`Submission with id ${args.submissionId} not found`);
      return null;
    }

    await ctx.db.patch(args.submissionId, {
      downsizedDownloadUrl: args.downsizedDownloadUrl,
    });

    return null;
  },
});

/**
 * Update submission with Google Files API file ID.
 */
export const updateSubmissionGoogleFileId = internalMutation({
  args: {
    submissionId: v.id('submissions'),
    googleFileId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      console.warn(`Submission with id ${args.submissionId} not found`);
      return null;
    }

    await ctx.db.patch(args.submissionId, {
      googleFileId: args.googleFileId,
    });

    return null;
  },
});

/**
 * Update submission with AI analysis result and set state to video_analysed.
 * Also creates the next submission if needed.
 */
export const updateSubmissionWithAnalysis = internalMutation({
  args: {
    submissionId: v.id('submissions'),
    analysis: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      console.warn(`Submission with id ${args.submissionId} not found`);
      return null;
    }

    // Try to parse the analysis as JSON to extract structured data
    let analysisResult: {
      raw: string;
      scores?: {
        posture?: number;
        emotions?: number;
        fillers?: number;
        eye_contact?: number;
        voice_clarity?: number;
        body_language?: number;
        confidence?: number;
        storytelling?: number;
        energy_level?: number;
        authenticity?: number;
        overall?: number;
      };
      summary?: string;
      cardDescription?: string;
      keyMoments?: string[];
      improvementTips?: string[];
    } = {
      raw: args.analysis,
    };

    try {
      const parsed = JSON.parse(args.analysis);
      if (parsed.scores) {
        analysisResult.scores = {
          posture: parsed.scores.posture,
          emotions: parsed.scores.emotions,
          fillers: parsed.scores.fillers,
          eye_contact: parsed.scores.eye_contact,
          voice_clarity: parsed.scores.voice_clarity,
          body_language: parsed.scores.body_language,
          confidence: parsed.scores.confidence,
          storytelling: parsed.scores.storytelling,
          energy_level: parsed.scores.energy_level,
          authenticity: parsed.scores.authenticity,
          overall: parsed.scores.overall,
        };
      }
      if (parsed.summary) {
        analysisResult.summary = parsed.summary;
      }
      if (parsed.card_description) {
        analysisResult.cardDescription = parsed.card_description;
      }
      if (Array.isArray(parsed.key_moments)) {
        analysisResult.keyMoments = parsed.key_moments;
      }
      if (Array.isArray(parsed.improvement_tips)) {
        analysisResult.improvementTips = parsed.improvement_tips;
      }
    } catch {
      // If parsing fails, just store as raw string (backward compatibility)
    }

    await ctx.db.patch(args.submissionId, {
      state: 'video_analysed',
      analysisResult,
    });

    // Check if we need to create the next submission
    const challenge = await ctx.db.get(submission.challengeId);
    if (!challenge) {
      console.warn(`Challenge with id ${submission.challengeId} not found`);
      return null;
    }

    // Count existing submissions for this challenge
    const existingSubmissions = await ctx.db
      .query('submissions')
      .withIndex('by_challengeId', (q) =>
        q.eq('challengeId', submission.challengeId)
      )
      .collect();

    // If we haven't reached the required number, create a new submission
    if (existingSubmissions.length < challenge.requiredNumberOfSubmissions) {
      const newSubmissionId = await ctx.db.insert('submissions', {
        userId: submission.userId,
        challengeId: submission.challengeId,
        state: 'initial',
      });

      // If topic generation is enabled, trigger it for the new submission
      if (challenge.generateTopic) {
        // Get previous topics and analyses from existing submissions (including the one that just completed)
        const previousTopics = existingSubmissions
          .filter(
            (sub) =>
              sub.topic &&
              !sub.topicGenerationError &&
              sub._id !== newSubmissionId // Exclude the new submission we just created
          )
          .map((sub) => sub.topic!)
          .filter((topic): topic is string => topic !== undefined);

        const previousAnalyses = existingSubmissions
          .filter(
            (sub) =>
              sub.analysisResult &&
              sub.state === 'video_analysed' &&
              sub._id !== newSubmissionId // Exclude the new submission we just created
          )
          .map((sub) => {
            const result = sub.analysisResult!;
            // Extract raw or summary for topic generation context
            if (result.raw) {
              return result.raw;
            }
            if (result.summary) {
              return result.summary;
            }
            // Fallback to JSON string if neither exists
            return JSON.stringify(result);
          })
          .filter(
            (analysis): analysis is string =>
              analysis !== undefined && analysis !== null
          );

        const currentDay = existingSubmissions.length; // Day 0-indexed, so length is the next day

        await ctx.scheduler.runAfter(
          0,
          internal.submissionActions.generateTopicForSubmission,
          {
            submissionId: newSubmissionId,
            challengeId: submission.challengeId,
            previousTopics,
            previousAnalyses,
            desiredImprovements: challenge.desiredImprovements,
            specifyPrompt: challenge.specifyPrompt,
            currentDay,
            totalDays: challenge.requiredNumberOfSubmissions,
          }
        );
      }
    }

    return null;
  },
});
