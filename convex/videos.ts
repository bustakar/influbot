'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { action } from './_generated/server';

/**
 * Get video URL from Cloudflare Stream after upload.
 */
async function getCloudflareVideoUrl(
  ctx: any,
  streamId: string
): Promise<string> {
  console.log(
    '[getCloudflareVideoUrl] Fetching video info for stream ID:',
    streamId
  );

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error('[getCloudflareVideoUrl] Missing environment variables');
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set'
    );
  }

  const requestUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamId}`;
  console.log('[getCloudflareVideoUrl] Making request to:', requestUrl);

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  console.log('[getCloudflareVideoUrl] Response status:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[getCloudflareVideoUrl] Error response:', errorText);
    throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
  }

  const responseText = await response.text();
  console.log(
    '[getCloudflareVideoUrl] Response body:',
    responseText.substring(0, 500)
  );

  const data = JSON.parse(responseText) as {
    result: {
      playback: {
        hls: string;
      };
      status?: {
        state?: string;
      };
    };
  };

  console.log(
    '[getCloudflareVideoUrl] Video status:',
    data.result.status?.state
  );
  console.log('[getCloudflareVideoUrl] HLS URL:', data.result.playback.hls);

  return data.result.playback.hls;
}

/**
 * Process video upload: get video URL and trigger analysis.
 */
export const processVideoUpload = action({
  args: {
    submissionId: v.id('videoSubmissions'),
    cloudflareStreamId: v.string(),
    customPrompt: v.string(),
    dayNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log('[processVideoUpload] Starting video processing:', {
      submissionId: args.submissionId,
      cloudflareStreamId: args.cloudflareStreamId,
      dayNumber: args.dayNumber,
    });

    // Wait a bit for Cloudflare to process the video
    console.log(
      '[processVideoUpload] Waiting 3 seconds for Cloudflare to process...'
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Poll until video is ready
    let videoUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    console.log('[processVideoUpload] Starting to poll for video URL...');

    while (!videoUrl && attempts < maxAttempts) {
      attempts++;
      console.log(
        `[processVideoUpload] Attempt ${attempts}/${maxAttempts} to get video URL...`
      );
      try {
        videoUrl = await getCloudflareVideoUrl(ctx, args.cloudflareStreamId);
        console.log(
          '[processVideoUpload] Successfully got video URL:',
          videoUrl
        );
        break;
      } catch (error) {
        console.log(
          `[processVideoUpload] Attempt ${attempts} failed:`,
          error instanceof Error ? error.message : String(error)
        );
        if (attempts >= maxAttempts) {
          console.error('[processVideoUpload] Max attempts reached, giving up');
          throw new Error('Video processing timeout');
        }
        console.log('[processVideoUpload] Waiting 2 seconds before retry...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!videoUrl) {
      console.error(
        '[processVideoUpload] Failed to get video URL after all attempts'
      );
      throw new Error('Failed to get video URL');
    }

    // Analyze video
    console.log('[processVideoUpload] Starting video analysis...');
    const analysisResults = await ctx.runAction(
      internal.analysis.analyzeVideo,
      {
        videoUrl,
        customPrompt: args.customPrompt,
        dayNumber: args.dayNumber,
      }
    );

    console.log('[processVideoUpload] Analysis completed:', {
      scores: analysisResults.scores,
      feedbackLength: analysisResults.feedback.length,
    });

    // Update submission with analysis results
    console.log(
      '[processVideoUpload] Updating submission with analysis results...'
    );
    await ctx.runMutation(internal.challenges.updateSubmissionAnalysis, {
      submissionId: args.submissionId,
      analysisResults,
    });

    console.log('[processVideoUpload] Video processing completed successfully');

    return null;
  },
});
