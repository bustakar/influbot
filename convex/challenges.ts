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
      submissions: v.array(
        v.object({
          _id: v.id('videos'),
          state: videoStateValidator,
          aiAnalysis: v.optional(v.string()),
          _creationTime: v.number(),
        })
      ),
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
      .query('videos')
      .withIndex('by_challengeId', (q) => q.eq('challengeId', args.challengeId))
      .collect();

    return {
      ...challenge,
      submissions,
    };
  },
});
