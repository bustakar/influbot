import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

/**
 * Update video state. Internal mutation called from webhook handler.
 */
export const updateVideoState = internalMutation({
  args: {
    cloudflareUid: v.string(),
    state: v.union(
      v.literal('upload_url_generated'),
      v.literal('video_uploaded'),
      v.literal('video_processed'),
      v.literal('video_sent_to_ai'),
      v.literal('video_analysed')
    ),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query('videos')
      .withIndex('by_cloudflareUid', (q) =>
        q.eq('cloudflareUid', args.cloudflareUid)
      )
      .first();

    if (!video) {
      console.warn(
        `Video with cloudflareUid ${args.cloudflareUid} not found for state update`
      );
      return null;
    }

    await ctx.db.patch(video._id, {
      state: args.state,
      errorMessage: args.errorMessage,
    });

    return null;
  },
});
