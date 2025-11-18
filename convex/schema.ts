import { defineSchema, defineTable } from 'convex/server';
import { Infer, v } from 'convex/values';

import { Id } from './_generated/dataModel';

export const videoStateValidator = v.union(
  v.literal('upload_url_generated'),
  v.literal('video_uploaded'),
  v.literal('video_processed'),
  v.literal('video_sent_to_ai'),
  v.literal('video_analysed'),
  v.literal('failed_upload'),
  v.literal('failed_compression'),
  v.literal('failed_analysis'),
  v.literal('processing_timeout')
);

export type VideoState = Infer<typeof videoStateValidator>;

export const challengeValidator = v.object({
  userId: v.string(),
  title: v.string(),
  requiredNumberOfSubmissions: v.number(),
  desiredImprovements: v.array(v.string()),
  specifyPrompt: v.string(),
});

export default defineSchema({
  videos: defineTable({
    userId: v.string(),
    challengeId: v.optional(v.id('challenges')),
    cloudflareUid: v.string(),
    state: videoStateValidator,
    errorMessage: v.optional(v.string()),
    downsizedVideoUrl: v.optional(v.string()),
    aiAnalysis: v.optional(v.string()),
    pollingStartTime: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_cloudflareUid', ['cloudflareUid'])
    .index('by_challengeId', ['challengeId']),
  challenges: defineTable(challengeValidator).index('by_userId', ['userId']),
});

export type Challenge = Infer<typeof challengeValidator> & {
  _id: Id<'challenges'>;
};
