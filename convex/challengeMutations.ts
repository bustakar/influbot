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
      isTrial: false,
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

export const createTrialChallenge = mutation({
  args: {},
  returns: v.id('challenges'),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Check if user already has a trial challenge
    const existingTrialChallenge = await ctx.db
      .query('challenges')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('isTrial'), true))
      .first();

    if (existingTrialChallenge) {
      return existingTrialChallenge._id;
    }

    // Create trial challenge: 7 days, with common improvements
    const challengeId = await ctx.db.insert('challenges', {
      userId,
      title: 'Trial Challenge',
      requiredNumberOfSubmissions: 7,
      desiredImprovements: [
        'Posture',
        'Confidence',
        'Voice Clarity',
        'Eye Contact',
        'Authenticity',
      ],
      specifyPrompt:
        'This is your trial challenge. Practice speaking on camera for 7 days to improve your presentation skills.',
      generateTopic: true,
      isTrial: true,
    });

    const firstSubmissionId = await ctx.db.insert('submissions', {
      userId,
      challengeId,
      state: 'initial',
    });

    // Generate topic for first submission
    await ctx.scheduler.runAfter(
      0,
      internal.submissionActions.generateTopicForSubmission,
      {
        submissionId: firstSubmissionId,
        challengeId,
        previousTopics: [],
        previousAnalyses: [],
        desiredImprovements: [
          'Posture',
          'Confidence',
          'Voice Clarity',
          'Eye Contact',
          'Authenticity',
        ],
        specifyPrompt:
          'This is your trial challenge. Practice speaking on camera for 7 days to improve your presentation skills.',
        currentDay: 0,
        totalDays: 7,
      }
    );

    return challengeId;
  },
});
