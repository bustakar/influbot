'use client';

import { useAction, useQuery } from 'convex/react';
import { CheckCircle2, Circle, Folder } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import { api } from '../../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../../convex/_generated/dataModel';
import { VideoState } from '../../../../../../../../convex/schema';

const SubmissionSkeleton = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
};

const EmptySubmission = () => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Folder />
        </EmptyMedia>
        <EmptyTitle>Submission Not Found</EmptyTitle>
        <EmptyDescription>
          This submission could not be found or you don&apos;t have access to
          it.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

type TopicCardProps = {
  topic?: string;
  topicGenerationError?: string;
  submissionId: Id<'submissions'>;
};

const TopicCard = ({
  topic,
  topicGenerationError,
  submissionId,
}: TopicCardProps) => {
  const retryTopicGeneration = useAction(
    api.submissionActions.retryTopicGeneration
  );
  const isTopicGenerationFailed = !!topicGenerationError;

  const handleRetryTopic = async () => {
    try {
      await retryTopicGeneration({ submissionId });
      toast.success('Retrying topic generation...');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to retry topic generation';
      toast.error('Retry failed', {
        description: errorMessage,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Your Topic</CardTitle>
          {isTopicGenerationFailed && (
            <Button size="sm" variant="outline" onClick={handleRetryTopic}>
              Retry Generation
            </Button>
          )}
        </div>
        <CardDescription
          className={`text-base ${isTopicGenerationFailed ? 'text-red-600 dark:text-red-400' : ''}`}
        >
          {topic}
        </CardDescription>
        {isTopicGenerationFailed && topicGenerationError && (
          <CardDescription className="text-sm text-red-600 dark:text-red-400 mt-2">
            Error: {topicGenerationError}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
};

type StatusBadgeProps = {
  state: VideoState;
  errorMessage?: string;
};

const StatusBadge = ({ state, errorMessage }: StatusBadgeProps) => {
  const getStateLabel = (state: VideoState): string => {
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
  };

  const getStateBadgeColor = (state: VideoState): string => {
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
  };

  return (
    <div className="flex items-center gap-2">
      {state === 'video_analysed' ? (
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      ) : ['failed_upload', 'failed_compression', 'failed_analysis'].includes(
          state
        ) ? (
        <Circle className="h-5 w-5 text-red-600" />
      ) : (
        <Circle className="h-5 w-5 text-blue-600" />
      )}
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStateBadgeColor(state)}`}
      >
        {getStateLabel(state)}
      </span>
      {errorMessage && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
    </div>
  );
};

type VideoSectionProps = {
  cloudflareUploadUrl?: string;
  state: VideoState;
};

const VideoSection = ({ cloudflareUploadUrl, state }: VideoSectionProps) => {
  // Extract Cloudflare UID from upload URL if available
  // Format: https://upload.videodelivery.net/{uid}
  const cloudflareUid = cloudflareUploadUrl?.split('/').pop();

  const canShowVideo = [
    'video_uploaded',
    'video_processed',
    'video_sent_to_ai',
    'video_analysed',
    'failed_compression',
    'failed_analysis',
    'processing_timeout',
  ].includes(state);

  // Show video embed if uploaded
  if (canShowVideo && cloudflareUid) {
    const videoEmbedUrl = `https://iframe.videodelivery.net/${cloudflareUid}`;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Video</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              src={videoEmbedUrl}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title={`Video ${cloudflareUid}`}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error states
  if (state === 'failed_upload') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload Video</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full aspect-video bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center">
            <div className="text-center p-4">
              <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
                Upload Failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                The video upload did not complete successfully. Please try
                uploading again.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === 'processing_timeout') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Video</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full aspect-video bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-center">
            <div className="text-center p-4">
              <p className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                Processing Timeout
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Video processing timed out after 30 minutes. Cloudflare may be
                experiencing issues.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show upload dropzone for initial states
  if (['initial', 'upload_url_generated'].includes(state)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload Video</CardTitle>
          <CardDescription>
            Upload your video submission. Maximum file size: 500MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full aspect-video border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center gap-4 p-8 hover:border-muted-foreground/50 transition-colors">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Drop your video here</p>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
            </div>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              id="video-upload-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // TODO: Implement upload logic
                  toast.info('Upload functionality coming soon');
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                document.getElementById('video-upload-input')?.click();
              }}
            >
              Select Video File
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show processing state
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Video</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">Video is being processed...</p>
        </div>
      </CardContent>
    </Card>
  );
};

type AnalysisResultProps = {
  analysisResult?: string;
  state: VideoState;
};

const AnalysisResult = ({ analysisResult, state }: AnalysisResultProps) => {
  if (analysisResult) {
    return (
      <>
        <Separator />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">AI Analysis</h3>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {analysisResult}
            </p>
          </div>
        </div>
      </>
    );
  }

  if (state === 'video_sent_to_ai' || state === 'video_processed') {
    return (
      <>
        <Separator />
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Analysis is being generated. This may take a few moments...
          </p>
        </div>
      </>
    );
  }

  if (state === 'failed_analysis') {
    return (
      <>
        <Separator />
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            Analysis failed. Please try again.
          </p>
        </div>
      </>
    );
  }

  if (state === 'processing_timeout') {
    return (
      <>
        <Separator />
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Video processing timed out. The video may still be processing on
            Cloudflare&apos;s side.
          </p>
        </div>
      </>
    );
  }

  return null;
};

export default function SubmissionDetail({ id }: { id: Id<'submissions'> }) {
  const submission = useQuery(api.submissions.getById, { submissionId: id });

  if (submission === undefined) {
    return <SubmissionSkeleton />;
  }

  if (submission === null) {
    return <EmptySubmission />;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Submission</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Created {new Date(submission._creationTime).toLocaleString()}
        </p>
      </div>

      {/* Status Badge */}
      <StatusBadge
        state={submission.state}
        errorMessage={submission.errorMessage}
      />

      {/* Topic Card */}
      <TopicCard
        topic={submission.topic}
        topicGenerationError={submission.topicGenerationError}
        submissionId={submission._id}
      />

      {/* Video Section - Shows dropzone or embed based on state */}
      <VideoSection
        cloudflareUploadUrl={submission.cloudflareUploadUrl}
        state={submission.state}
      />

      {/* Analysis Result */}
      <AnalysisResult
        analysisResult={submission.analysisResult}
        state={submission.state}
      />
    </div>
  );
}
