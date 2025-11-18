import { v } from 'convex/values';

import { query } from './_generated/server';
import { videoStateValidator } from './schema';

/**
 * Get all videos for the current user.
 */
export const getVideosByUser = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('videos'),
      userId: v.string(),
      cloudflareUid: v.optional(v.string()),
      state: videoStateValidator,
      errorMessage: v.optional(v.string()),
      downsizedVideoUrl: v.optional(v.string()),
      aiAnalysis: v.optional(v.string()),
      pollingStartTime: v.optional(v.number()),
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
      .query('videos')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});

/**
 * Get a video by Cloudflare UID.
 */
export const getVideoByCloudflareUid = query({
  args: {
    cloudflareUid: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id('videos'),
      userId: v.string(),
      cloudflareUid: v.optional(v.string()),
      state: videoStateValidator,
      errorMessage: v.optional(v.string()),
      downsizedVideoUrl: v.optional(v.string()),
      aiAnalysis: v.optional(v.string()),
      pollingStartTime: v.optional(v.number()),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('videos')
      .withIndex('by_cloudflareUid', (q) =>
        q.eq('cloudflareUid', args.cloudflareUid)
      )
      .first();
  },
});
