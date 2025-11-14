import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    challenges: defineTable({
      userId: v.string(),
      startDate: v.number(),
      customPrompt: v.string(),
      status: v.union(v.literal("active"), v.literal("completed")),
    }).index("by_user", ["userId"]),

    videoSubmissions: defineTable({
      challengeId: v.id("challenges"),
      dayNumber: v.number(),
      cloudflareStreamId: v.string(),
      analysisResults: v.union(
        v.null(),
        v.object({
          scores: v.object({
            voiceClarity: v.number(),
            posture: v.number(),
            eyeContact: v.number(),
            fluency: v.number(),
            confidence: v.number(),
          }),
          feedback: v.string(),
        })
      ),
      submittedAt: v.number(),
    })
      .index("by_challenge", ["challengeId"])
      .index("by_challenge_and_day", ["challengeId", "dayNumber"]),
  },
  { schemaValidation: true }
);
