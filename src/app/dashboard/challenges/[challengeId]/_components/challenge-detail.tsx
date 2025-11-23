'use client';

import { useQuery } from 'convex/react';
import { CheckCircle2, Circle, Folder, Lock } from 'lucide-react';
import Link from 'next/link';

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

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { VideoState } from '../../../../../../convex/schema';

const ChallengeSkeleton = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
      {/* Header skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Separator />
      {/* Submission cards skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
};

const EmptyChallenge = () => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Folder />
        </EmptyMedia>
        <EmptyTitle>No Challenges Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any challenges yet. Get started by creating
          your first challenge.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

type SubmissionCardProps = {
  position: number;
  totalRequired: number;
  submission: {
    _id: Id<'submissions'>;
    state: VideoState;
    topic?: string;
    _creationTime: number;
  } | null;
  isLocked: boolean;
};

const SubmissionCard = ({
  position,
  totalRequired,
  submission,
  isLocked,
}: SubmissionCardProps) => {
  const isCompleted = submission?.state === 'video_analysed';

  return (
    <Card
      className={`my-4 transition-all ${
        isLocked
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:shadow-md cursor-pointer'
      }`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLocked ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : submission ? (
              <Circle className="h-5 w-5 text-blue-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle className="text-lg">
              Submission {position + 1} of {totalRequired}
            </CardTitle>
          </div>
          {isLocked ? (
            <span className="px-2 py-1 text-xs font-semibold rounded-md bg-muted text-muted-foreground">
              Locked
            </span>
          ) : (
            submission && (
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-md ${
                  isCompleted
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}
              >
                {isCompleted ? 'Completed' : 'In Progress'}
              </span>
            )
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLocked ? (
          <p className="text-sm text-muted-foreground">
            Complete previous submissions to unlock this one
          </p>
        ) : submission ? (
          <div className="space-y-3">
            {submission.topic && <p className="text-sm">{submission.topic}</p>}
            <p className="text-sm text-muted-foreground">
              Submitted {new Date(submission._creationTime).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No submission yet</p>
        )}
      </CardContent>
    </Card>
  );
};

type ChallengeDetailCardProps = {
  title: string;
  requiredNumberOfSubmissions: number;
  desiredImprovements: string[];
  specifyPrompt: string;
  submissionsCount: number;
  creationTime: number;
};

const ChallengeDetailCard = ({
  title,
  requiredNumberOfSubmissions,
  desiredImprovements,
  specifyPrompt,
  submissionsCount,
  creationTime,
  isTrial,
}: ChallengeDetailCardProps) => {
  const progressPercentage = Math.round(
    (submissionsCount / requiredNumberOfSubmissions) * 100
  );

  return (
    <div className="space-y-4">
      {/* Title and creation date */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold">{title}</h1>
          {isTrial && (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
              Trial Challenge
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Created {new Date(creationTime).toLocaleString()}
        </p>
      </div>

      {/* Desired improvements */}
      <div className="flex flex-wrap gap-2">
        {desiredImprovements.map((improvement) => (
          <span
            key={improvement}
            className="px-2 py-1 text-xs font-semibold rounded-md bg-secondary text-secondary-foreground"
          >
            {improvement}
          </span>
        ))}
      </div>

      {/* Goal card */}
      <Card>
        <CardHeader>
          <CardTitle>Goal</CardTitle>
          <CardDescription className="whitespace-pre-wrap">
            {specifyPrompt}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Progress card */}
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>
            {submissionsCount} of {requiredNumberOfSubmissions} submissions
            completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${progressPercentage}%`,
                }}
              />
            </div>
            <span className="text-sm font-medium">{progressPercentage}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function ChallengeDetail({ id }: { id: Id<'challenges'> }) {
  const challenge = useQuery(api.challenges.getById, { challengeId: id });

  if (challenge === undefined) {
    return <ChallengeSkeleton />;
  }

  if (challenge == null) {
    return <EmptyChallenge />;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
      <ChallengeDetailCard
        title={challenge.title}
        requiredNumberOfSubmissions={challenge.requiredNumberOfSubmissions}
        desiredImprovements={challenge.desiredImprovements}
        specifyPrompt={challenge.specifyPrompt}
        submissionsCount={challenge.completedCount}
        creationTime={challenge._creationTime}
        isTrial={challenge.isTrial}
      />

      <Separator />

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Submissions</h2>
        {challenge.submissionSlots.map((slot) => {
          const card = (
            <SubmissionCard
              position={slot.position}
              totalRequired={challenge.requiredNumberOfSubmissions}
              submission={slot.submission}
              isLocked={slot.isLocked}
            />
          );

          if (slot.isLocked) {
            return <div key={slot.position}>{card}</div>;
          }

          if (slot.submission?._id) {
            return (
              <Link
                href={`/dashboard/challenges/${id}/submissions/${slot.submission._id}`}
                key={slot.position}
              >
                {card}
              </Link>
            );
          }
        })}
      </div>
    </div>
  );
}
