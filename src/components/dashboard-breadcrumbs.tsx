'use client';

import { useQuery } from 'convex/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export function DashboardBreadcrumbs() {
  const pathname = usePathname();

  // Extract challengeId and submissionId from pathname
  const challengeMatch = pathname.match(/\/dashboard\/challenges\/([^/]+)/);
  const submissionMatch = pathname.match(
    /\/dashboard\/challenges\/([^/]+)\/submissions\/([^/]+)/
  );

  const challengeId = challengeMatch?.[1] as Id<'challenges'> | undefined;
  const submissionId = submissionMatch?.[2] as Id<'submissions'> | undefined;

  const challenge = useQuery(
    api.challenges.getById,
    challengeId ? { challengeId } : 'skip'
  );

  // Find submission position from challenge's submissionSlots
  const submissionPosition =
    challenge && submissionId
      ? challenge.submissionSlots.findIndex(
          (slot) => slot.submission?._id === submissionId
        )
      : -1;

  // Don't show breadcrumbs on the main dashboard page
  if (!challengeId) {
    return null;
  }

  // Show loading state
  if (challenge === undefined) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Challenge not found
  if (challenge === null) {
    return null;
  }

  // If we have a submissionId in the URL, we're on a submission page
  // Make challenge clickable even if position isn't found yet (still loading)
  const isOnSubmissionPage = !!submissionId;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isOnSubmissionPage ? (
            <BreadcrumbLink asChild>
              <Link href={`/dashboard/challenges/${challengeId}`}>
                {challenge.title}
              </Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{challenge.title}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {isOnSubmissionPage && submissionPosition >= 0 && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                Day {submissionPosition + 1} of{' '}
                {challenge.requiredNumberOfSubmissions}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

