'use client';

import { ClerkLoaded, SignedIn } from '@clerk/nextjs';
import { CheckoutButton } from '@clerk/nextjs/experimental';
import { Lock } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface PaywallProps {
  onUpgrade?: () => void;
  onSubscriptionComplete?: () => void;
}

// Get plan ID from environment variable
const planId = process.env.NEXT_PUBLIC_CLERK_PRO_PLAN_ID;

export function Paywall({ onUpgrade, onSubscriptionComplete }: PaywallProps) {
  const [isStarting, setIsStarting] = useState(false);

  if (!planId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          Plan ID not configured. Please set NEXT_PUBLIC_CLERK_PRO_PLAN_ID
          environment variable.
        </p>
      </div>
    );
  }

  const handleClick = () => {
    // Close the dialog immediately so the checkout sheet can appear on top
    onUpgrade?.();
    setIsStarting(true);
  };

  const handleSubscriptionComplete = () => {
    setIsStarting(false);
    // Call both callbacks - one to close dialog, one to refresh subscription
    onUpgrade?.();
    onSubscriptionComplete?.();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">
            Upgrade to Create Challenges
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          You&apos;ve used your free trial challenge. Upgrade to Pro to create
          unlimited custom challenges.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Pro Plan Benefits:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Unlimited challenges</li>
          <li>Unlimited video practice</li>
          <li>Advanced AI analysis</li>
          <li>Detailed improvement tracking</li>
          <li>Priority support</li>
        </ul>
      </div>

      <ClerkLoaded>
        <SignedIn>
          <CheckoutButton
            planId={planId}
            planPeriod="month"
            onSubscriptionComplete={handleSubscriptionComplete}
            newSubscriptionRedirectUrl="/dashboard"
          >
            <Button
              className="w-full"
              size="lg"
              onClick={handleClick}
              disabled={isStarting}
            >
              {isStarting
                ? 'Opening checkout...'
                : 'Upgrade to Pro - $29/month'}
            </Button>
          </CheckoutButton>
        </SignedIn>
      </ClerkLoaded>
    </div>
  );
}
