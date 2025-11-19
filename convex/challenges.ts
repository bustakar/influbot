import { v } from 'convex/values';

import { query } from './_generated/server';
import { videoStateValidator } from './schema';

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('challenges'),
      userId: v.string(),
      title: v.string(),
      requiredNumberOfSubmissions: v.number(),
      desiredImprovements: v.array(v.string()),
      specifyPrompt: v.string(),
      generateTopic: v.boolean(),
      _creationTime: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    return await ctx.db
      .query('challenges')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});

export const getById = query({
  args: {
    challengeId: v.id('challenges'),
  },
  returns: v.union(
    v.object({
      _id: v.id('challenges'),
      userId: v.string(),
      title: v.string(),
      requiredNumberOfSubmissions: v.number(),
      desiredImprovements: v.array(v.string()),
      specifyPrompt: v.string(),
      generateTopic: v.boolean(),
      submissionSlots: v.array(
        v.object({
          position: v.number(),
          submission: v.union(
            v.object({
              _id: v.id('submissions'),
              state: videoStateValidator,
              topic: v.optional(v.string()),
              topicGenerationError: v.optional(v.string()),
              cloudflareUid: v.optional(v.string()),
              aiAnalysis: v.optional(v.string()),
              _creationTime: v.number(),
            }),
            v.null()
          ),
          isLocked: v.boolean(),
        })
      ),
      completedCount: v.number(),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      return null;
    }

    if (challenge.userId !== identity.subject) {
      return null;
    }

    const submissions = await ctx.db
      .query('submissions')
      .withIndex('by_challengeId', (q) => q.eq('challengeId', args.challengeId))
      .order('asc')
      .collect();

    const completedCount = submissions.filter(
      (sub) => sub.state === 'video_analysed'
    ).length;

    const nextUnlockedIndex = completedCount;

    const submissionSlots = Array.from(
      { length: challenge.requiredNumberOfSubmissions },
      (_, index) => {
        const submission =
          index < submissions.length ? submissions[index] : null;

        // A submission is unlocked if:
        // 1. It's completed (index < completedCount)
        // 2. It's the next upcoming one (index === completedCount)
        const isUnlocked = index <= nextUnlockedIndex;

        return {
          position: index,
          submission: submission
            ? {
                _id: submission._id,
                state: submission.state,
                topic: submission.topic,
                topicGenerationError: submission.topicGenerationError,
                cloudflareUid: submission.cloudflareUid,
                analysisResult: submission.analysisResult,
                _creationTime: submission._creationTime,
              }
            : null,
          isLocked: !isUnlocked,
        };
      }
    );

    return {
      ...challenge,
      submissionSlots,
      completedCount,
    };
  },
});
