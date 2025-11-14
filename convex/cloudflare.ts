'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';

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
        'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set'
      );
    }

    const requestBody = {
      maxDurationSeconds: 360, // 6 minutes max
      allowedOrigins: ['*'], // Allow uploads from any origin
    };

    const requestUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`;

    console.log('[Cloudflare] Making request:', {
      url: requestUrl,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken.substring(0, 10)}...`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Cloudflare] Response status:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cloudflare] Error response:', errorText);
      throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
    }

    const responseText = await response.text();
    console.log('[Cloudflare] Response body (raw):', responseText);

    const data = JSON.parse(responseText) as {
      result: {
        uploadURL: string;
        uid: string;
      };
    };

    console.log('[Cloudflare] Parsed response data:', {
      uploadURL: data.result.uploadURL.substring(0, 100) + '...',
      uid: data.result.uid,
    });

    return {
      uploadUrl: data.result.uploadURL,
      uploadId: data.result.uid,
    };
  },
});
