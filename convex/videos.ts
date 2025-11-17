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

/**
 * Set up Cloudflare Stream webhook subscription.
 * Call this once to configure where Cloudflare should send webhook notifications.
 * Returns the webhook secret that should be stored securely for signature verification.
 *
 * @param webhookUrl - The full URL where webhooks should be sent (e.g., https://your-deployment.convex.site/webhooks/cloudflare-stream)
 */
export const setupCloudflareWebhook = action({
  args: {
    webhookUrl: v.string(),
  },
  returns: v.object({
    notificationUrl: v.string(),
    secret: v.string(),
    modified: v.string(),
  }),
  handler: async (ctx, args) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      );
    }

    // Validate URL format
    if (
      !args.webhookUrl.startsWith('http://') &&
      !args.webhookUrl.startsWith('https://')
    ) {
      throw new Error(
        'Webhook URL must include protocol (http:// or https://)'
      );
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/webhook`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationUrl: args.webhookUrl,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to set up webhook: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Cloudflare API returned unsuccessful response');
    }

    return {
      notificationUrl: data.result.notificationUrl,
      secret: data.result.secret,
      modified: data.result.modified,
    };
  },
});
