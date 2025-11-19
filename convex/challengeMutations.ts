import { v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation } from './_generated/server';

export const createChallenge = mutation({
  args: {
    title: v.string(),
    requiredNumberOfSubmissions: v.number(),
    desiredImprovements: v.array(v.string()),
    specifyPrompt: v.string(),
    generateTopic: v.boolean(),
  },
  returns: v.id('challenges'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    const challengeId = await ctx.db.insert('challenges', {
      userId,
      title: args.title,
      requiredNumberOfSubmissions: args.requiredNumberOfSubmissions,
      desiredImprovements: args.desiredImprovements,
      specifyPrompt: args.specifyPrompt,
      generateTopic: args.generateTopic,
    });

    const firstSubmissionId = await ctx.db.insert('submissions', {
      userId,
      challengeId,
      state: 'initial',
    });

    if (args.generateTopic) {
      await ctx.scheduler.runAfter(
        0,
        internal.submissionActions.generateTopicForSubmission,
        {
          submissionId: firstSubmissionId,
          challengeId,
          previousTopics: [],
          previousAnalyses: [],
          desiredImprovements: args.desiredImprovements,
          specifyPrompt: args.specifyPrompt,
          currentDay: 0,
          totalDays: args.requiredNumberOfSubmissions,
        }
      );
    }

    return challengeId;
  },
});
