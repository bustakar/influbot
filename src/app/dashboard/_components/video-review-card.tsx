'use client';

import { useAction } from 'convex/react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { api } from '../../../../convex/_generated/api';
import { VideoState } from '../../../../convex/schema';

type Video = {
  _id: string;
  cloudflareUid?: string;
  state: VideoState;
  errorMessage?: string;
  aiAnalysis?: string;
  _creationTime: number;
};

function getStateLabel(state: VideoState): string {
  switch (state) {
    case 'initial':
      return 'Ready to Upload';
    case 'upload_url_generated':
      return 'Upload URL Generated';
    case 'video_uploaded':
      return 'Video Uploaded';
    case 'video_processed':
      return 'Processing Video';
    case 'video_sent_to_ai':
      return 'Analyzing Video';
    case 'video_analysed':
      return 'Analysis Complete';
    case 'failed_upload':
      return 'Upload Failed';
    case 'failed_compression':
      return 'Compression Failed';
    case 'failed_analysis':
      return 'Analysis Failed';
    case 'processing_timeout':
      return 'Processing Timeout';
    default:
      return state;
  }
}

function getStateBadgeColor(state: VideoState): string {
  switch (state) {
    case 'video_analysed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'failed_upload':
    case 'failed_compression':
    case 'failed_analysis':
    case 'processing_timeout':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'video_sent_to_ai':
    case 'video_processed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

interface VideoReviewCardProps {
  video: Video;
}

export function VideoReviewCard({ video }: VideoReviewCardProps) {
  const retryUpload = useAction(api.videos.retryUpload);
  const retryCompression = useAction(api.videos.retryCompression);
  const retryAnalysis = useAction(api.videos.retryAnalysis);
  const checkStatusManually = useAction(api.videos.checkVideoStatusManually);

  const handleRetryCompression = async () => {
    if (!video.cloudflareUid) {
      toast.error('No video UID available');
      return;
    }
    try {
      await retryCompression({ cloudflareUid: video.cloudflareUid });
      toast.success('Retrying compression...');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to retry compression';
      toast.error('Retry failed', {
        description: errorMessage,
      });
    }
  };

  const handleRetryUpload = async () => {
    if (!video.cloudflareUid) {
      toast.error('No video UID available');
      return;
    }
    try {
      await retryUpload({ cloudflareUid: video.cloudflareUid });
      toast.success(
        'New upload URL generated. Please upload your video again using the upload form above.'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to retry upload';
      toast.error('Retry failed', {
        description: errorMessage,
      });
    }
  };

  const handleRetryAnalysis = async () => {
    if (!video.cloudflareUid) {
      toast.error('No video UID available');
      return;
    }
    try {
      await retryAnalysis({ cloudflareUid: video.cloudflareUid });
      toast.success('Retrying analysis...');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to retry analysis';
      toast.error('Retry failed', {
        description: errorMessage,
      });
    }
  };

  const handleCheckStatus = async () => {
    if (!video.cloudflareUid) {
      toast.error('No video UID available');
      return;
    }
    try {
      await checkStatusManually({ cloudflareUid: video.cloudflareUid });
      toast.success('Checking video status...');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to check status';
      toast.error('Check failed', {
        description: errorMessage,
      });
    }
  };

  // Cloudflare Stream embed URL
  // Format: https://iframe.videodelivery.net/{videoId}
  const videoEmbedUrl = video.cloudflareUid
    ? `https://iframe.videodelivery.net/${video.cloudflareUid}`
    : undefined;

  // Only show video embed once it's uploaded (not just URL generated or failed upload)
  const canShowVideo = [
    'video_uploaded',
    'video_processed',
    'video_sent_to_ai',
    'video_analysed',
    'failed_compression',
    'failed_analysis',
    'processing_timeout',
  ].includes(video.state);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Performance Review</CardTitle>
            <CardDescription>
              Uploaded {new Date(video._creationTime).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStateBadgeColor(video.state)}`}
            >
              {getStateLabel(video.state)}
            </span>
            {video.state === 'failed_upload' && (
              <Button size="sm" variant="outline" onClick={handleRetryUpload}>
                Retry Upload
              </Button>
            )}
            {video.state === 'failed_compression' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetryCompression}
              >
                Retry Compression
              </Button>
            )}
            {video.state === 'failed_analysis' && (
              <Button size="sm" variant="outline" onClick={handleRetryAnalysis}>
                Retry Analysis
              </Button>
            )}
            {video.state === 'processing_timeout' && (
              <Button size="sm" variant="outline" onClick={handleCheckStatus}>
                Check Status
              </Button>
            )}
          </div>
        </div>
        {video.errorMessage && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
            <strong>Error:</strong> {video.errorMessage}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Player Section */}
        {canShowVideo && videoEmbedUrl ? (
          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              src={videoEmbedUrl}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title={`Video ${video.cloudflareUid || 'unknown'}`}
            />
          </div>
        ) : video.state === 'failed_upload' ? (
          <div className="w-full aspect-video bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center">
            <div className="text-center p-4">
              <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
                Upload Failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                The video upload did not complete successfully. Please use the
                retry button above to generate a new upload URL, then upload
                your video again.
              </p>
            </div>
          </div>
        ) : video.state === 'processing_timeout' ? (
          <div className="w-full aspect-video bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-center">
            <div className="text-center p-4">
              <p className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                Processing Timeout
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Video processing timed out after 30 minutes. Cloudflare may be
                experiencing issues. Use the "Check Status" button above to
                manually check if processing has completed.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Video is being processed...</p>
          </div>
        )}

        {/* Analysis Section - Most Important */}
        {video.aiAnalysis ? (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">AI Analysis</h3>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {video.aiAnalysis}
                </p>
              </div>
            </div>
          </>
        ) : video.state === 'video_sent_to_ai' ||
          video.state === 'video_processed' ? (
          <>
            <Separator />
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Analysis is being generated. This may take a few moments...
              </p>
            </div>
          </>
        ) : video.state === 'failed_analysis' ? (
          <>
            <Separator />
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                Analysis failed. Please try again using the retry button above.
              </p>
            </div>
          </>
        ) : video.state === 'processing_timeout' ? (
          <>
            <Separator />
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Video processing timed out. The video may still be processing on
                Cloudflare's side. Use the "Check Status" button to verify if
                processing has completed.
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
