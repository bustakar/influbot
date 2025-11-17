import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

/**
 * Verify Cloudflare Stream webhook signature.
 * Returns true if signature is valid, false otherwise.
 */
async function verifyWebhookSignature(
  signatureHeader: string | null,
  requestBody: string,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }

  try {
    // Parse signature header: "time=1230811200,sig1=60493ec9388b44585a29543bcf0de62e377d4da393246a8b1c901d0e3e672404"
    const parts = signatureHeader.split(',');
    let time: string | null = null;
    let sig1: string | null = null;

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 'time') {
        time = value;
      } else if (key === 'sig1') {
        sig1 = value;
      }
    }

    if (!time || !sig1) {
      return false;
    }

    // Check if timestamp is too old (e.g., more than 5 minutes)
    const requestTime = parseInt(time, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - requestTime;
    if (timeDiff > 300 || timeDiff < -60) {
      // Allow 5 minutes forward/backward, reject if too old or too far in future
      return false;
    }

    // Create signature source string: time + "." + request body
    const signatureSource = `${time}.${requestBody}`;

    // Compute HMAC-SHA256 using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(signatureSource);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison
    if (expectedSignature.length !== sig1.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ sig1.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

http.route({
  path: '/webhooks/cloudflare-stream',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    try {
      // Get raw body for signature verification
      const rawBody = await req.text();
      const body = JSON.parse(rawBody);

      // Verify webhook signature if secret is configured
      const webhookSecret = process.env.CLOUDFLARE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signatureHeader = req.headers.get('Webhook-Signature');
        const isValid = await verifyWebhookSignature(
          signatureHeader,
          rawBody,
          webhookSecret
        );

        if (!isValid) {
          console.warn('Invalid webhook signature');
          return new Response('Invalid signature', { status: 401 });
        }
      }

      // Cloudflare Stream webhook payload structure:
      // { uid: string, status: { state: string, ... }, ... }
      const uid = body.uid;
      const status = body.status?.state;

      if (!uid) {
        return new Response('Missing uid in webhook payload', { status: 400 });
      }

      // Cloudflare sends "ready" status when video is processed and ready to download
      if (status === 'ready') {
        await ctx.runMutation(internal.videoMutations.updateVideoState, {
          cloudflareUid: uid,
          state: 'video_processed',
        });
      } else if (status === 'error') {
        // Handle error state
        const errorCode = body.status?.errReasonCode || 'ERR_UNKNOWN';
        const errorText = body.status?.errReasonText || 'Unknown error';
        await ctx.runMutation(internal.videoMutations.updateVideoState, {
          cloudflareUid: uid,
          state: 'video_processed', // Or create an error state if needed
          errorMessage: `${errorCode}: ${errorText}`,
        });
      }

      return new Response('Webhook received', { status: 200 });
    } catch (error) {
      console.error('Error processing Cloudflare webhook:', error);
      return new Response('Error processing webhook', { status: 500 });
    }
  }),
});

export default http;
