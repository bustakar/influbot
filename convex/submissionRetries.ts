'use node';

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { action } from './_generated/server';

/**
 * Manually check submission video status.
 * This triggers an immediate status check, resetting the retry count to allow continued polling.
 */
export const checkSubmissionStatus = action({
  args: {
    submissionId: v.id('submissions'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const submission = await ctx.runQuery(api.submissions.getById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    if (!submission.cloudflareUid) {
      throw new Error('No Cloudflare UID available');
    }

    // Only allow checking status for states that are waiting for Cloudflare processing
    if (
      submission.state !== 'video_uploaded' &&
      submission.state !== 'processing_timeout'
    ) {
      throw new Error(
        `Cannot check status from state: ${submission.state}. Status check is only available when video is uploaded or processing timed out.`
      );
    }

    // Reset retry count to 0 to allow continued polling
    await ctx.runMutation(
      internal.submissionMutations.updateSubmissionState,
      {
        submissionId: args.submissionId,
        state: submission.state === 'processing_timeout' ? 'video_uploaded' : submission.state,
        pollingRetryCount: 0,
        errorMessage: undefined,
      }
    );

    // Trigger immediate status check
    await ctx.scheduler.runAfter(
      0,
      internal.submissionActions.checkSubmissionVideoStatus,
      {
        submissionId: args.submissionId,
        retryCount: 0,
      }
    );

    return null;
  },
});

export const retrySubmissionStep = action({
  args: {
    submissionId: v.id('submissions'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const submission = await ctx.runQuery(api.submissions.getById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.userId !== identity.subject) {
      throw new Error('Unauthorized');
    }

    // Determine which step to retry based on current state
    // We can retry from any processing state or timeout state
    switch (submission.state) {
      case 'upload_url_generated':
        // If stuck here, we can't really retry - user needs to upload again
        throw new Error('Cannot retry: Please upload the video again');

      case 'video_uploaded':
      case 'processing_timeout':
        // Reset retry count and start polling again
        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: 'video_uploaded',
            pollingRetryCount: 0,
            errorMessage: undefined,
          }
        );

        if (!submission.cloudflareUid) {
          throw new Error('Cannot retry: No Cloudflare UID available');
        }

        await ctx.scheduler.runAfter(
          0,
          internal.submissionActions.checkSubmissionVideoStatus,
          {
            submissionId: args.submissionId,
            retryCount: 0,
          }
        );
        break;

      case 'video_processed':
        // Retry compression
        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: 'video_processed',
            errorMessage: undefined,
          }
        );

        if (!submission.cloudflareUid) {
          throw new Error('Cannot retry: No Cloudflare UID available');
        }

        await ctx.scheduler.runAfter(
          0,
          internal.submissionActions.getCompressedSubmissionVideoDownloadUrl,
          {
            submissionId: args.submissionId,
            cloudflareUid: submission.cloudflareUid,
          }
        );
        break;

      case 'video_compressed':
      case 'video_sent_to_ai':
        // Retry AI analysis
        await ctx.runMutation(
          internal.submissionMutations.updateSubmissionState,
          {
            submissionId: args.submissionId,
            state: 'video_compressed', // Reset to compressed state
            errorMessage: undefined,
          }
        );

        if (!submission.downsizedDownloadUrl) {
          throw new Error('Cannot retry: No Gemini file URI available');
        }

        // Get challenge to fetch desired improvements
        const challenge = await ctx.runQuery(
          internal.challenges.getByIdInternal,
          {
            challengeId: submission.challengeId,
          }
        );

        if (!challenge) {
          throw new Error('Challenge not found');
        }

        await ctx.scheduler.runAfter(
          0,
          internal.submissionActions.analyzeSubmissionVideoWithGemini,
          {
            submissionId: args.submissionId,
            geminiFileUri: submission.downsizedDownloadUrl, // This now contains the Gemini file URI
            desiredImprovements: challenge.desiredImprovements,
          }
        );
        break;

      case 'initial':
      case 'video_analysed':
        throw new Error(`Cannot retry from state: ${submission.state}`);

      default:
        throw new Error(`Cannot retry from state: ${submission.state}`);
    }

    return null;
  },
});
