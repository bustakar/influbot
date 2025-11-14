"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AnalysisResultsProps {
  scores: {
    voiceClarity: number;
    posture: number;
    eyeContact: number;
    fluency: number;
    confidence: number;
  };
  feedback: string;
}

export function AnalysisResults({ scores, feedback }: AnalysisResultsProps) {
  const scoreItems = [
    { label: "Voice Clarity", value: scores.voiceClarity },
    { label: "Posture", value: scores.posture },
    { label: "Eye Contact", value: scores.eyeContact },
    { label: "Fluency", value: scores.fluency },
    { label: "Confidence", value: scores.confidence },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analysis Scores</CardTitle>
          <CardDescription>
            Your performance metrics for this video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreItems.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{item.label}</span>
                <span className="font-medium">{item.value}/100</span>
              </div>
              <Progress value={item.value} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Feedback</CardTitle>
          <CardDescription>
            AI-generated feedback based on your focus areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {feedback}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

