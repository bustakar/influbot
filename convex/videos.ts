'use node';

import { v } from 'convex/values';

import { action } from './_generated/server';

/**
 * Generate a Cloudflare Stream direct upload URL for video uploads.
 * Returns the upload URL and video UID.
 */
export const generateCloudflareUploadUrl = action({
  args: {},
  returns: v.object({
    uploadURL: v.string(),
    uid: v.string(),
  }),
  handler: async () => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600, // 1 hour max
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to generate upload URL: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Cloudflare API returned unsuccessful response');
    }

    return {
      uploadURL: data.result.uploadURL,
      uid: data.result.uid,
    };
  },
});
