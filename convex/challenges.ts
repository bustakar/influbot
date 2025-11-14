import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';

/**
 * Get the user's active challenge.
 */
export const getActiveChallenge = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('challenges'),
      _creationTime: v.number(),
      userId: v.string(),
      startDate: v.number(),
      customPrompt: v.string(),
      status: v.union(v.literal('active'), v.literal('completed')),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const challenge = await ctx.db
      .query('challenges')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .first();

    return challenge ?? null;
  },
});

/**
 * Get all submissions for a challenge.
 */
export const getChallengeSubmissions = query({
  args: {
    challengeId: v.id('challenges'),
  },
  returns: v.array(
    v.object({
      _id: v.id('videoSubmissions'),
      _creationTime: v.number(),
      challengeId: v.id('challenges'),
      dayNumber: v.number(),
      cloudflareStreamId: v.string(),
      analysisResults: v.union(
        v.null(),
        v.object({
          scores: v.object({
            voiceClarity: v.number(),
            posture: v.number(),
            eyeContact: v.number(),
            fluency: v.number(),
            confidence: v.number(),
          }),
          feedback: v.string(),
        })
      ),
      submittedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query('videoSubmissions')
      .withIndex('by_challenge', (q) => q.eq('challengeId', args.challengeId))
      .order('asc')
      .collect();

    return submissions;
  },
});

/**
 * Get a specific submission by challenge and day number.
 */
export const getSubmission = query({
  args: {
    challengeId: v.id('challenges'),
    dayNumber: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('videoSubmissions'),
      _creationTime: v.number(),
      challengeId: v.id('challenges'),
      dayNumber: v.number(),
      cloudflareStreamId: v.string(),
      analysisResults: v.union(
        v.null(),
        v.object({
          scores: v.object({
            voiceClarity: v.number(),
            posture: v.number(),
            eyeContact: v.number(),
            fluency: v.number(),
            confidence: v.number(),
          }),
          feedback: v.string(),
        })
      ),
      submittedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query('videoSubmissions')
      .withIndex('by_challenge_and_day', (q) =>
        q.eq('challengeId', args.challengeId).eq('dayNumber', args.dayNumber)
      )
      .unique();

    return submission ?? null;
  },
});

/**
 * Create a new 30-day challenge with custom prompt.
 */
export const createChallenge = mutation({
  args: {
    customPrompt: v.string(),
  },
  returns: v.id('challenges'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Check if user already has an active challenge
    const existingChallenge = await ctx.db
      .query('challenges')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .first();

    if (existingChallenge) {
      throw new Error('User already has an active challenge');
    }

    const challengeId = await ctx.db.insert('challenges', {
      userId: identity.subject,
      startDate: Date.now(),
      customPrompt: args.customPrompt,
      status: 'active',
    });

    return challengeId;
  },
});

/**
 * Create a video submission record after upload.
 */
export const createVideoSubmission = mutation({
  args: {
    challengeId: v.id('challenges'),
    dayNumber: v.number(),
    cloudflareStreamId: v.string(),
  },
  returns: v.id('videoSubmissions'),
  handler: async (ctx, args) => {
    console.log('[createVideoSubmission] Starting:', {
      challengeId: args.challengeId,
      dayNumber: args.dayNumber,
      cloudflareStreamId: args.cloudflareStreamId,
    });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error('[createVideoSubmission] Not authenticated');
      throw new Error('Not authenticated');
    }

    console.log(
      '[createVideoSubmission] User authenticated:',
      identity.subject
    );

    // Verify challenge belongs to user
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      console.error(
        '[createVideoSubmission] Challenge not found:',
        args.challengeId
      );
      throw new Error('Challenge not found');
    }
    console.log('[createVideoSubmission] Challenge found:', {
      challengeId: challenge._id,
      userId: challenge.userId,
      status: challenge.status,
    });

    if (challenge.userId !== identity.subject) {
      console.error(
        '[createVideoSubmission] Challenge does not belong to user:',
        {
          challengeUserId: challenge.userId,
          currentUserId: identity.subject,
        }
      );
      throw new Error('Challenge does not belong to user');
    }

    // Check if submission for this day already exists
    const existingSubmission = await ctx.db
      .query('videoSubmissions')
      .withIndex('by_challenge_and_day', (q) =>
        q.eq('challengeId', args.challengeId).eq('dayNumber', args.dayNumber)
      )
      .unique();

    if (existingSubmission) {
      console.error(
        '[createVideoSubmission] Submission already exists:',
        existingSubmission._id
      );
      throw new Error('Submission for this day already exists');
    }

    // Validate day number
    if (args.dayNumber < 1 || args.dayNumber > 30) {
      console.error(
        '[createVideoSubmission] Invalid day number:',
        args.dayNumber
      );
      throw new Error('Day number must be between 1 and 30');
    }

    const submissionData = {
      challengeId: args.challengeId,
      dayNumber: args.dayNumber,
      cloudflareStreamId: args.cloudflareStreamId,
      analysisResults: null,
      submittedAt: Date.now(),
    };

    console.log(
      '[createVideoSubmission] Inserting submission:',
      submissionData
    );

    const submissionId = await ctx.db.insert(
      'videoSubmissions',
      submissionData
    );

    console.log(
      '[createVideoSubmission] Submission created successfully:',
      submissionId
    );

    return submissionId;
  },
});

/**
 * Update submission with analysis results.
 */
export const updateSubmissionAnalysis = internalMutation({
  args: {
    submissionId: v.id('videoSubmissions'),
    analysisResults: v.object({
      scores: v.object({
        voiceClarity: v.number(),
        posture: v.number(),
        eyeContact: v.number(),
        fluency: v.number(),
        confidence: v.number(),
      }),
      feedback: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log('[updateSubmissionAnalysis] Updating submission:', {
      submissionId: args.submissionId,
      scores: args.analysisResults.scores,
      feedbackLength: args.analysisResults.feedback.length,
    });

    await ctx.db.patch(args.submissionId, {
      analysisResults: args.analysisResults,
    });

    console.log('[updateSubmissionAnalysis] Submission updated successfully');

    return null;
  },
});
