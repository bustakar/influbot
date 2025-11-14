"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Get video URL from Cloudflare Stream after upload.
 */
async function getCloudflareVideoUrl(
  ctx: any,
  streamId: string
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Cloudflare API error: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as {
    result: {
      playback: {
        hls: string;
      };
    };
  };

  return data.result.playback.hls;
}

/**
 * Process video upload: get video URL and trigger analysis.
 */
export const processVideoUpload = action({
  args: {
    submissionId: v.id("videoSubmissions"),
    cloudflareStreamId: v.string(),
    customPrompt: v.string(),
    dayNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Wait a bit for Cloudflare to process the video
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Poll until video is ready
    let videoUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!videoUrl && attempts < maxAttempts) {
      try {
        videoUrl = await getCloudflareVideoUrl(ctx, args.cloudflareStreamId);
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error("Video processing timeout");
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!videoUrl) {
      throw new Error("Failed to get video URL");
    }

    // Analyze video
    const analysisResults = await ctx.runAction(
      internal.analysis.analyzeVideo,
      {
        videoUrl,
        customPrompt: args.customPrompt,
        dayNumber: args.dayNumber,
      }
    );

    // Update submission with analysis results
    await ctx.runMutation(internal.challenges.updateSubmissionAnalysis, {
      submissionId: args.submissionId,
      analysisResults,
    });

    return null;
  },
});

