import { v } from 'convex/values';

import { query } from './_generated/server';

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('challenges'),
      userId: v.string(),
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
