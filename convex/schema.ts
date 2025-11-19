import { defineSchema, defineTable } from 'convex/server';
import { Infer, v } from 'convex/values';

import { Id } from './_generated/dataModel';

export const videoStateValidator = v.union(
  v.literal('initial'),
  v.literal('upload_url_generated'),
  v.literal('video_uploaded'),
  v.literal('video_processed'),
  v.literal('video_compressed'),
  v.literal('video_sent_to_ai'),
  v.literal('video_analysed'),
  v.literal('processing_timeout')
);

export type VideoState = Infer<typeof videoStateValidator>;

export const submissionValidator = v.object({
  userId: v.string(),
  challengeId: v.id('challenges'),
  state: videoStateValidator,
  errorMessage: v.optional(v.string()),
  topic: v.optional(v.string()),
  topicGenerationError: v.optional(v.string()),
  cloudflareUid: v.optional(v.string()),
  cloudflareUploadUrl: v.optional(v.string()),
  downsizedDownloadUrl: v.optional(v.string()),
  googleFileId: v.optional(v.string()),
  analysisResult: v.optional(
    v.object({
      raw: v.optional(v.string()), // Raw JSON string for backward compatibility
      scores: v.optional(
        v.object({
          posture: v.optional(v.number()),
          emotions: v.optional(v.number()),
          fillers: v.optional(v.number()),
          eye_contact: v.optional(v.number()),
          voice_clarity: v.optional(v.number()),
          body_language: v.optional(v.number()),
          confidence: v.optional(v.number()),
          storytelling: v.optional(v.number()),
          energy_level: v.optional(v.number()),
          authenticity: v.optional(v.number()),
          overall: v.optional(v.number()),
        })
      ),
      summary: v.optional(v.string()),
      cardDescription: v.optional(v.string()),
      keyMoments: v.optional(v.array(v.string())),
      improvementTips: v.optional(v.array(v.string())),
    })
  ),
  pollingStartTime: v.optional(v.number()),
  pollingRetryCount: v.optional(v.number()),
});

export const challengeValidator = v.object({
  userId: v.string(),
  title: v.string(),
  requiredNumberOfSubmissions: v.number(),
  desiredImprovements: v.array(v.string()),
  specifyPrompt: v.string(),
  generateTopic: v.boolean(),
});

export default defineSchema({
  videos: defineTable({
    userId: v.string(),
    challengeId: v.optional(v.id('challenges')),
    cloudflareUid: v.optional(v.string()),
    state: videoStateValidator,
    errorMessage: v.optional(v.string()),
    downsizedVideoUrl: v.optional(v.string()),
    aiAnalysis: v.optional(v.string()),
    topic: v.optional(v.string()),
    pollingStartTime: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_cloudflareUid', ['cloudflareUid'])
    .index('by_challengeId', ['challengeId']),
  submissions: defineTable(submissionValidator)
    .index('by_userId', ['userId'])
    .index('by_challengeId', ['challengeId'])
    .index('by_state', ['state']),
  challenges: defineTable(challengeValidator).index('by_userId', ['userId']),
});

export type Submission = Infer<typeof submissionValidator> & {
  _id: Id<'submissions'>;
};

export type Challenge = Infer<typeof challengeValidator> & {
  _id: Id<'challenges'>;
};
