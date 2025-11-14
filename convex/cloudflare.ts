"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate a direct creator upload URL from Cloudflare Stream API.
 * This allows users to upload videos directly to Cloudflare Stream.
 */
export const getCloudflareUploadUrl = action({
  args: {},
  returns: v.object({
    uploadUrl: v.string(),
    uploadId: v.string(),
  }),
  handler: async (ctx) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"
      );
    }

    const response = await ctx.fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds: 600, // 10 minutes max
          allowedOrigins: ["*"], // Allow uploads from any origin
        }),
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
        uploadURL: string;
        uid: string;
      };
    };

    return {
      uploadUrl: data.result.uploadURL,
      uploadId: data.result.uid,
    };
  },
});

