'use client';

import { useMutation, useQuery } from 'convex/react';
import { Folder } from 'lucide-react';
import { useEffect } from 'react';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { api } from '../../../convex/_generated/api';
import { CreateChallengeDialog } from './_components/create-challenge-dialog';

export default function DashboardPage() {
  const challenges = useQuery(api.challenges.list);
  const hasTrialChallenge = useQuery(api.challenges.hasTrialChallenge);
  const createTrialChallenge = useMutation(
    api.challengeMutations.createTrialChallenge
  );

  // Auto-create trial challenge if user doesn't have one
  useEffect(() => {
    if (hasTrialChallenge === false) {
      createTrialChallenge().catch((error) => {
        console.error('Failed to create trial challenge:', error);
      });
    }
  }, [hasTrialChallenge, createTrialChallenge]);

  if (challenges === undefined || challenges.length === 0) {
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
        <EmptyContent>
          <div className="flex gap-2">
            <CreateChallengeDialog />
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Folder />
        </EmptyMedia>
        <EmptyTitle>No Challenge Selected</EmptyTitle>
        <EmptyDescription>
          Select a challenge to view its detail.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
