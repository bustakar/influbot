"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoUpload } from "@/components/challenge/video-upload";
import { AnalysisResults } from "@/components/challenge/analysis-results";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DayPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as Id<"challenges">;
  const dayNumber = parseInt(params.dayNumber as string, 10);

  const challenge = useQuery(api.challenges.getActiveChallenge);
  const submission = useQuery(api.challenges.getSubmission, {
    challengeId,
    dayNumber,
  });

  if (challenge === undefined || submission === undefined) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full mt-4" />
      </div>
    );
  }

  if (!challenge || challenge._id !== challengeId) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Challenge Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This challenge does not exist or does not belong to you.</p>
            <Button asChild className="mt-4">
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (dayNumber < 1 || dayNumber > 30) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Day Number</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Day number must be between 1 and 30.</p>
            <Button asChild className="mt-4">
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasSubmission = submission !== null;
  const hasAnalysis = submission?.analysisResults !== null;

  function handleUploadComplete() {
    router.refresh();
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/">← Back to Dashboard</Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Day {dayNumber} of 30</CardTitle>
          <CardDescription>
            {hasSubmission
              ? "Video submitted and analyzed"
              : "Upload your video for today"}
          </CardDescription>
        </CardHeader>
      </Card>

      {!hasSubmission ? (
        <VideoUpload
          challengeId={challengeId}
          dayNumber={dayNumber}
          customPrompt={challenge.customPrompt}
          onUploadComplete={handleUploadComplete}
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Video Submitted</CardTitle>
              <CardDescription>
                Submitted on {new Date(submission.submittedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasAnalysis && submission.analysisResults ? (
                <AnalysisResults
                  scores={submission.analysisResults.scores}
                  feedback={submission.analysisResults.feedback}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Analysis in progress... Please check back soon.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

