import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  videos: defineTable({
    userId: v.string(),
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
    downsizedVideoUrl: v.optional(v.string()),
    aiAnalysis: v.optional(v.string()),
    pollingStartTime: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_cloudflareUid', ['cloudflareUid']),
});
