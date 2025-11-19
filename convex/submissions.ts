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
      googleFileId: v.optional(v.string()),
      analysisResult: v.optional(
        v.object({
          raw: v.optional(v.string()),
          scores: v.optional(
            v.object({
              posture: v.optional(v.number()),
              emotions: v.optional(v.number()),
              fillers: v.optional(v.number()),
              eye_contact: v.optional(v.number()),
              voice_clarity: v.optional(v.number()),
              body_language: v.optional(v.number()),
              confidence: v.optional(v.number()),
              storytelling: v.optional(v.number()),
              energy_level: v.optional(v.number()),
              authenticity: v.optional(v.number()),
              overall: v.optional(v.number()),
            })
          ),
          summary: v.optional(v.string()),
          cardDescription: v.optional(v.string()),
          keyMoments: v.optional(v.array(v.string())),
          improvementTips: v.optional(v.array(v.string())),
        })
      ),
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
      analysisResult: v.optional(
        v.object({
          raw: v.optional(v.string()),
          scores: v.optional(
            v.object({
              posture: v.optional(v.number()),
              emotions: v.optional(v.number()),
              fillers: v.optional(v.number()),
              eye_contact: v.optional(v.number()),
              voice_clarity: v.optional(v.number()),
              body_language: v.optional(v.number()),
              confidence: v.optional(v.number()),
              storytelling: v.optional(v.number()),
              energy_level: v.optional(v.number()),
              authenticity: v.optional(v.number()),
              overall: v.optional(v.number()),
            })
          ),
          summary: v.optional(v.string()),
          cardDescription: v.optional(v.string()),
          keyMoments: v.optional(v.array(v.string())),
          improvementTips: v.optional(v.array(v.string())),
        })
      ),
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
