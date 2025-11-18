'use client';

import { useAction, useQuery } from 'convex/react';
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

function getStateLabel(state: string): string {
  switch (state) {
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
    case 'failed_compression':
      return 'Compression Failed';
    case 'failed_analysis':
      return 'Analysis Failed';
    default:
      return state;
  }
}

function getStateColor(state: string): string {
  switch (state) {
    case 'video_analysed':
      return 'text-green-600 dark:text-green-400';
    case 'failed_compression':
    case 'failed_analysis':
      return 'text-red-600 dark:text-red-400';
    case 'video_sent_to_ai':
    case 'video_processed':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function VideoList() {
  const videos = useQuery(api.videoQueries.getVideosByUser);
  const retryCompression = useAction(api.videos.retryCompression);
  const retryAnalysis = useAction(api.videos.retryAnalysis);

  const handleRetryCompression = async (cloudflareUid: string) => {
    try {
      await retryCompression({ cloudflareUid });
      toast.success('Retrying compression...');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to retry compression';
      toast.error('Retry failed', {
        description: errorMessage,
      });
    }
  };

  const handleRetryAnalysis = async (cloudflareUid: string) => {
    try {
      await retryAnalysis({ cloudflareUid });
      toast.success('Retrying analysis...');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to retry analysis';
      toast.error('Retry failed', {
        description: errorMessage,
      });
    }
  };

  if (videos === undefined) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (videos.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Videos</CardTitle>
          <CardDescription>No videos uploaded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Videos</CardTitle>
        <CardDescription>
          {videos.length} video{videos.length !== 1 ? 's' : ''} uploaded
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {videos.map((video) => (
          <div key={video._id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium">Video {video.cloudflareUid}</p>
                <p className={`text-xs ${getStateColor(video.state)}`}>
                  {getStateLabel(video.state)}
                </p>
                {video.errorMessage && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Error: {video.errorMessage}
                  </p>
                )}
                {video.aiAnalysis && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {video.aiAnalysis}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {video.state === 'failed_compression' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetryCompression(video.cloudflareUid)}
                  >
                    Retry Compression
                  </Button>
                )}
                {video.state === 'failed_analysis' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetryAnalysis(video.cloudflareUid)}
                  >
                    Retry Analysis
                  </Button>
                )}
              </div>
            </div>
            {video !== videos[videos.length - 1] && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

