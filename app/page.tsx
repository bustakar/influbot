"use client";

import { Button } from "@/components/ui/button";
import {
  Authenticated,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { StickyHeader } from "@/components/layout/sticky-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateChallengeForm } from "@/components/challenge/create-challenge-form";
import { ChallengeProgress } from "@/components/challenge/challenge-progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <StickyHeader className="px-4 py-2">
        <div className="flex justify-between items-center">
          <Link href="/" className="font-bold text-lg">
            30-Day Video Challenge
          </Link>
          <SignInAndSignUpButtons />
        </div>
      </StickyHeader>
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-extrabold my-8 text-center">
          30-Day Speaking Challenge
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Upload a video each day for 30 days and get AI-powered feedback on
          your speaking and stance.
        </p>
        <Authenticated>
          <SignedInContent />
        </Authenticated>
        <Unauthenticated>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Sign in to start your 30-day challenge
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 justify-center">
              <SignInButton mode="modal">
                <Button variant="ghost">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>Sign up</Button>
              </SignUpButton>
            </CardContent>
          </Card>
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInAndSignUpButtons() {
  return (
    <div className="flex gap-4">
      <Authenticated>
        <UserButton afterSignOutUrl="/" />
      </Authenticated>
      <Unauthenticated>
        <SignInButton mode="modal">
          <Button variant="ghost">Sign in</Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button>Sign up</Button>
        </SignUpButton>
      </Unauthenticated>
    </div>
  );
}

function SignedInContent() {
  const challenge = useQuery(api.challenges.getActiveChallenge);
  const submissions = useQuery(
    api.challenges.getChallengeSubmissions,
    challenge ? { challengeId: challenge._id } : "skip"
  );

  if (challenge === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (challenge === null) {
    return (
      <div className="flex justify-center">
        <CreateChallengeForm />
      </div>
    );
  }

  const submissionsCount = submissions?.length ?? 0;

  return (
    <div className="space-y-6">
      <ChallengeProgress
        challengeId={challenge._id}
        submissionsCount={submissionsCount}
        totalDays={30}
      />
      <Card>
        <CardHeader>
          <CardTitle>Your Challenge</CardTitle>
          <CardDescription>Started on {new Date(challenge.startDate).toLocaleDateString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="font-medium">Your Focus Areas:</p>
            <p className="text-sm text-muted-foreground">{challenge.customPrompt}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
