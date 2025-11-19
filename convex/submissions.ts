import { v } from 'convex/values';

import { internalQuery, query } from './_generated/server';
import { videoStateValidator } from './schema';

export const getById = query({
  args: {
    submissionId: v.id('submissions'),
  },
  returns: v.union(
    v.object({
      _id: v.id('submissions'),
      userId: v.string(),
      challengeId: v.id('challenges'),
      state: videoStateValidator,
      errorMessage: v.optional(v.string()),
      topic: v.optional(v.string()),
      topicGenerationError: v.optional(v.string()),
      cloudflareUid: v.optional(v.string()),
      cloudflareUploadUrl: v.optional(v.string()),
      downsizedDownloadUrl: v.optional(v.string()),
      analysisResult: v.optional(v.string()),
      pollingStartTime: v.optional(v.number()),
      pollingRetryCount: v.optional(v.number()),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      return null;
    }

    // Verify ownership
    if (submission.userId !== identity.subject) {
      return null;
    }

    return submission;
  },
});

/**
 * Get a submission by ID (internal, no auth check).
 * Used by internal actions that need to access submissions.
 */
export const getByIdInternal = internalQuery({
  args: {
    submissionId: v.id('submissions'),
  },
  returns: v.union(
    v.object({
      _id: v.id('submissions'),
      userId: v.string(),
      challengeId: v.id('challenges'),
      state: videoStateValidator,
      errorMessage: v.optional(v.string()),
      topic: v.optional(v.string()),
      topicGenerationError: v.optional(v.string()),
      cloudflareUid: v.optional(v.string()),
      cloudflareUploadUrl: v.optional(v.string()),
      downsizedDownloadUrl: v.optional(v.string()),
      googleFileId: v.optional(v.string()),
      analysisResult: v.optional(v.string()),
      pollingStartTime: v.optional(v.number()),
      pollingRetryCount: v.optional(v.number()),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    return submission;
  },
});
