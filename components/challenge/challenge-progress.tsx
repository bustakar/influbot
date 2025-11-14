"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

interface ChallengeProgressProps {
  challengeId: Id<"challenges">;
  submissionsCount: number;
  totalDays: number;
}

export function ChallengeProgress({
  challengeId,
  submissionsCount,
  totalDays,
}: ChallengeProgressProps) {
  const progressPercentage = (submissionsCount / totalDays) * 100;
  const daysRemaining = totalDays - submissionsCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Challenge Progress</CardTitle>
        <CardDescription>
          {submissionsCount} of {totalDays} days completed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressPercentage} className="h-3" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{daysRemaining} days remaining</span>
          <span>{Math.round(progressPercentage)}% complete</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: totalDays }, (_, i) => {
            const dayNumber = i + 1;
            const isCompleted = dayNumber <= submissionsCount;
            return (
              <Link
                key={dayNumber}
                href={`/challenge/${challengeId}/day/${dayNumber}`}
              >
                <Button
                  variant={isCompleted ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                >
                  {dayNumber}
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

