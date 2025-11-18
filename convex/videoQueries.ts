import { v } from 'convex/values';

import { query } from './_generated/server';

/**
 * Get all videos for the current user.
 */
export const getVideosByUser = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('videos'),
      userId: v.string(),
      cloudflareUid: v.string(),
      state: v.union(
        v.literal('upload_url_generated'),
        v.literal('video_uploaded'),
        v.literal('video_processed'),
        v.literal('video_sent_to_ai'),
        v.literal('video_analysed'),
        v.literal('failed_compression'),
        v.literal('failed_analysis')
      ),
      errorMessage: v.optional(v.string()),
      downsizedVideoUrl: v.optional(v.string()),
      aiAnalysis: v.optional(v.string()),
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
      cloudflareUid: v.string(),
      state: v.union(
        v.literal('upload_url_generated'),
        v.literal('video_uploaded'),
        v.literal('video_processed'),
        v.literal('video_sent_to_ai'),
        v.literal('video_analysed'),
        v.literal('failed_compression'),
        v.literal('failed_analysis')
      ),
      errorMessage: v.optional(v.string()),
      downsizedVideoUrl: v.optional(v.string()),
      aiAnalysis: v.optional(v.string()),
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

