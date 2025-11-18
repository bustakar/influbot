'use node';

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { action, internalAction } from './_generated/server';

/**
 * Generate a topic idea for a submission using Gemini Flash 2.0 via OpenRouter.
 * This creates a topic suggestion based on the challenge's desired improvements and prompt.
 */
export const generateTopicForSubmission = internalAction({
  args: {
    submissionId: v.id('submissions'),
    challengeId: v.id('challenges'),
    previousTopics: v.array(v.string()),
    desiredImprovements: v.array(v.string()),
    specifyPrompt: v.string(),
  },
  returns: v.object({
    topic: v.string(),
  }),
  handler: async (ctx, args) => {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      throw new Error(
        'OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.'
      );
    }

    try {
      // Create a prompt for topic generation based on challenge details
      const previousTopicsList = args.previousTopics.join(', ');
      const improvementsList = args.desiredImprovements.join(', ');
      const topicPrompt = `Generate a specific, engaging topic idea for a video submission. 
  
  Context:
  - Previous topics: ${previousTopicsList}
  - The user wants to improve: ${improvementsList}
  - Their specific goal: ${args.specifyPrompt}
  
  Generate a single, clear topic idea that would help them practice and improve in these areas. The topic should be:
  1. Specific and actionable
  2. Relevant to their improvement goals
  3. Engaging and motivating
  4. Suitable for a short video (2-5 minutes)
  
  Respond with ONLY the topic idea, nothing else. Keep it concise (1-2 sentences maximum).`;

      const openRouterResponse = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              process.env.OPENROUTER_HTTP_REFERER || 'https://influbot.com',
            'X-Title': 'Influbot Topic Generation',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            messages: [
              {
                role: 'user',
                content: topicPrompt,
              },
            ],
            // max_tokens: 200,
          }),
        }
      );

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        throw new Error(
          `OpenRouter API failed: ${openRouterResponse.status} ${errorText}`
        );
      }

      const openRouterData = await openRouterResponse.json();

      const topic =
        openRouterData.choices?.[0]?.message?.content ||
        openRouterData.choices?.[0]?.text ||
        null;

      if (!topic || topic.trim() === '') {
        throw new Error('No topic returned from API');
      }

      // Update submission with the generated topic (clear any previous errors)
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionTopic,
        {
          submissionId: args.submissionId,
          topic: topic.trim(),
          topicGenerationError: undefined, // Clear error on success
        }
      );

      return {
        topic: topic.trim(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown topic generation error';
      console.error('Failed to generate topic:', errorMessage);

      // Update submission with error (but don't set topic)
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionTopic,
        {
          submissionId: args.submissionId,
          topic: 'Topic generation failed. Please create your own topic.',
          topicGenerationError: errorMessage,
        }
      );

      return {
        topic: 'Topic generation failed. Please create your own topic.',
      };
    }
  },
});

/**
 * Retry topic generation for a submission.
 * This action can be called from the UI to retry topic generation.
 */
export const retryTopicGeneration = action({
  args: {
    submissionId: v.id('submissions'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get user ID from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get submission to verify ownership and get challengeId
    const submission = await ctx.runQuery(api.submissions.getById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    // Get challenge details
    const challenge = await ctx.runQuery(api.challenges.getById, {
      challengeId: submission.challengeId,
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    // Get previous topics from other submissions in this challenge
    // We'll fetch the challenge which includes submission slots with topics
    const previousTopics: string[] = [];
    if (challenge.submissionSlots) {
      for (const slot of challenge.submissionSlots) {
        if (
          slot.submission &&
          slot.submission.topic &&
          slot.submission._id !== args.submissionId &&
          !slot.submission.topicGenerationError
        ) {
          previousTopics.push(slot.submission.topic);
        }
      }
    }

    // Trigger topic generation
    await ctx.scheduler.runAfter(
      0,
      internal.submissionActions.generateTopicForSubmission,
      {
        submissionId: args.submissionId,
        challengeId: submission.challengeId,
        previousTopics,
        desiredImprovements: challenge.desiredImprovements,
        specifyPrompt: challenge.specifyPrompt,
      }
    );

    return null;
  },
});
