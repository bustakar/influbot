import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';

/**
 * Create a new video record when upload URL is generated.
 */
export const createVideo = mutation({
  args: {
    cloudflareUid: v.string(),
    userId: v.string(),
  },
  returns: v.id('videos'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('videos', {
      userId: args.userId,
      cloudflareUid: args.cloudflareUid,
      state: 'upload_url_generated',
    });
  },
});

/**
 * Update video state to uploaded when upload completes.
 * Also starts polling Cloudflare Stream API to check when video is ready.
 */
export const markVideoUploaded = mutation({
  args: {
    cloudflareUid: v.string(),
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
      throw new Error(
        `Video with cloudflareUid ${args.cloudflareUid} not found`
      );
    }

    await ctx.db.patch(video._id, {
      state: 'video_uploaded',
      pollingStartTime: Date.now(), // Track when polling started
    });

    // Start polling Cloudflare Stream API to check video status
    // First check after 10 seconds
    await ctx.scheduler.runAfter(10, internal.videos.checkVideoStatus, {
      cloudflareUid: args.cloudflareUid,
    });

    return null;
  },
});

/**
 * Update video state. Internal mutation called from polling action.
 */
export const updateVideoState = internalMutation({
  args: {
    cloudflareUid: v.string(),
    state: v.union(
      v.literal('upload_url_generated'),
      v.literal('video_uploaded'),
      v.literal('video_processed'),
      v.literal('video_sent_to_ai'),
      v.literal('video_analysed'),
      v.literal('failed_upload'),
      v.literal('failed_compression'),
      v.literal('failed_analysis'),
      v.literal('processing_timeout')
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
      ...(args.errorMessage !== undefined && {
        errorMessage: args.errorMessage,
      }),
      ...(args.errorMessage === undefined && { errorMessage: undefined }),
    });

    return null;
  },
});

/**
 * Update video with downsized video URL.
 */
export const updateVideoWithDownsizedUrl = internalMutation({
  args: {
    cloudflareUid: v.string(),
    downsizedVideoUrl: v.string(),
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
      console.warn(`Video with cloudflareUid ${args.cloudflareUid} not found`);
      return null;
    }

    await ctx.db.patch(video._id, {
      downsizedVideoUrl: args.downsizedVideoUrl,
    });

    return null;
  },
});

/**
 * Mark video upload as failed.
 */
export const markVideoUploadFailed = mutation({
  args: {
    cloudflareUid: v.string(),
    errorMessage: v.string(),
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
      throw new Error(
        `Video with cloudflareUid ${args.cloudflareUid} not found`
      );
    }

    await ctx.db.patch(video._id, {
      state: 'failed_upload',
      errorMessage: args.errorMessage,
    });

    return null;
  },
});

/**
 * Update polling start time (used when manually retrying status check).
 */
export const updatePollingStartTime = mutation({
  args: {
    cloudflareUid: v.string(),
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
      throw new Error(
        `Video with cloudflareUid ${args.cloudflareUid} not found`
      );
    }

    await ctx.db.patch(video._id, {
      pollingStartTime: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a video record from the database.
 */
export const deleteVideo = mutation({
  args: {
    videoId: v.id('videos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.videoId);
    return null;
  },
});

/**
 * Update Cloudflare UID for a video (used when retrying upload).
 */
export const updateCloudflareUid = mutation({
  args: {
    oldCloudflareUid: v.string(),
    newCloudflareUid: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query('videos')
      .withIndex('by_cloudflareUid', (q) =>
        q.eq('cloudflareUid', args.oldCloudflareUid)
      )
      .first();

    if (!video) {
      throw new Error(
        `Video with cloudflareUid ${args.oldCloudflareUid} not found`
      );
    }

    await ctx.db.patch(video._id, {
      cloudflareUid: args.newCloudflareUid,
    });

    return null;
  },
});

/**
 * Update video with AI analysis result and set state to video_analysed.
 */
export const updateVideoWithAnalysis = internalMutation({
  args: {
    cloudflareUid: v.string(),
    analysis: v.string(),
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
      console.warn(`Video with cloudflareUid ${args.cloudflareUid} not found`);
      return null;
    }

    await ctx.db.patch(video._id, {
      state: 'video_analysed',
      aiAnalysis: args.analysis,
    });

    return null;
  },
});
