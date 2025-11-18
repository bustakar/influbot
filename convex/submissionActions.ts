import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

/**
 * Generate a topic idea for a submission using Gemini Flash 2.0 via OpenRouter.
 * This creates a topic suggestion based on the challenge's desired improvements and prompt.
 */
export const generateTopicForSubmission = internalAction({
  args: {
    submissionId: v.id('videos'),
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
            model: 'openai/gpt-5-nano',
            messages: [
              {
                role: 'user',
                content: topicPrompt,
              },
            ],
            max_tokens: 200,
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
        'Topic generation failed';

      // Update video record with the generated topic
      await ctx.runMutation(
        internal.submissionMutations.updateSubmissionTopic,
        {
          submissionId: args.submissionId,
          topic: topic.trim(),
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
      return {
        topic: 'Topic generation failed. Please create your own topic.',
      };
    }
  },
});
