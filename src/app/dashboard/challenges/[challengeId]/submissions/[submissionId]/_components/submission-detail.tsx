'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
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
import { useAction, useQuery } from 'convex/react';
import { CheckCircle2, Circle, Folder } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '../../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../../convex/_generated/dataModel';
import { VideoState } from '../../../../../../../../convex/schema';
import { VideoSection } from './video-section';

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
        return errorMessage ? 'Upload Failed' : 'Video Uploaded';
      case 'video_processed':
        return errorMessage ? 'Compression Failed' : 'Processing Video';
      case 'video_compressed':
        return 'Video Compressed';
      case 'video_sent_to_ai':
        return errorMessage ? 'Analysis Failed' : 'Analyzing Video';
      case 'video_analysed':
        return 'Analysis Complete';
      case 'processing_timeout':
        return 'Processing Timeout';
      default:
        return state;
    }
  };

  const getStateBadgeColor = (
    state: VideoState,
    errorMessage?: string
  ): string => {
    if (errorMessage || state === 'processing_timeout') {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
    switch (state) {
      case 'video_analysed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'video_sent_to_ai':
      case 'video_processed':
      case 'video_compressed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {state === 'video_analysed' ? (
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      ) : errorMessage || state === 'processing_timeout' ? (
        <Circle className="h-5 w-5 text-red-600" />
      ) : (
        <Circle className="h-5 w-5 text-blue-600" />
      )}
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStateBadgeColor(state, errorMessage)}`}
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

  if (
    state === 'video_processed' ||
    state === 'video_compressed' ||
    state === 'video_sent_to_ai'
  ) {
    return (
      <>
        <Separator />
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {state === 'video_processed' &&
              'Video is being compressed. This may take a few moments...'}
            {state === 'video_compressed' &&
              'Video is being sent to AI for analysis. This may take a few moments...'}
            {state === 'video_sent_to_ai' &&
              'AI analysis is being generated. This may take a few moments...'}
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

      <VideoSection
        cloudflareUid={submission.cloudflareUid}
        state={submission.state}
        submissionId={submission._id}
        errorMessage={submission.errorMessage}
      />

      <AnalysisResult
        analysisResult={submission.analysisResult}
        state={submission.state}
      />
    </div>
  );
}
