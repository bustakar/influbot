'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { Paywall } from '@/components/paywall';
import { useSubscription } from '@/hooks/use-subscription';

import { ChallengeForm } from './challenge-form';

export function CreateChallengeDialog() {
  const { hasActiveSubscription, isLoading, refetch } = useSubscription();
  const [open, setOpen] = useState(false);

  const handleSubscriptionComplete = () => {
    // Refetch subscription status after successful payment
    refetch();
    // Dialog will be closed by onUpgrade callback
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Challenge</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : hasActiveSubscription ? (
          <>
            <DialogTitle>Create New Challenge</DialogTitle>
            <DialogDescription>
              Set up a new speaking challenge to track your progress.
            </DialogDescription>
            <div className="overflow-y-auto flex-1 min-h-0">
              <ChallengeForm onSuccess={() => setOpen(false)} />
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Upgrade Required</DialogTitle>
            <DialogDescription>
              You need an active subscription to create custom challenges.
            </DialogDescription>
            <div className="overflow-y-auto flex-1 min-h-0">
              <Paywall
                onUpgrade={() => setOpen(false)}
                onSubscriptionComplete={handleSubscriptionComplete}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
