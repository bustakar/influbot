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
 * Update submission with AI analysis result and set state to video_analysed.
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

    await ctx.db.patch(args.submissionId, {
      state: 'video_analysed',
      analysisResult: args.analysis,
    });

    return null;
  },
});
