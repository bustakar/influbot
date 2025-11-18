import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

export const updateSubmissionTopic = internalMutation({
  args: {
    submissionId: v.id('submissions'),
    topic: v.string(),
    topicGenerationError: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      console.warn(`Submission with id ${args.submissionId} not found`);
      return null;
    }

    await ctx.db.patch(args.submissionId, {
      topic: args.topic,
      ...(args.topicGenerationError !== undefined && {
        topicGenerationError: args.topicGenerationError,
      }),
      // Clear error if topic generation succeeded
      ...(args.topicGenerationError === undefined && {
        topicGenerationError: undefined,
      }),
    });

    return null;
  },
});
