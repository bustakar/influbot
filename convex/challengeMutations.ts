import { v } from 'convex/values';

import { mutation } from './_generated/server';

export const createChallenge = mutation({
  args: {
    title: v.string(),
    requiredNumberOfSubmissions: v.number(),
    desiredImprovements: v.array(v.string()),
    specifyPrompt: v.string(),
  },
  returns: v.id('challenges'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    return await ctx.db.insert('challenges', {
      userId,
      title: args.title,
      requiredNumberOfSubmissions: args.requiredNumberOfSubmissions,
      desiredImprovements: args.desiredImprovements,
      specifyPrompt: args.specifyPrompt,
    });
  },
});
