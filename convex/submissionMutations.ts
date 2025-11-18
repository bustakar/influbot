import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

export const updateSubmissionTopic = internalMutation({
  args: {
    submissionId: v.id('videos'),
    topic: v.string(),
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
    });

    return null;
  },
});
