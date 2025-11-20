'use client';

import { Sparkles,Target, Video } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const steps = [
  {
    title: 'Create Your Challenge',
    description:
      'Set your goals and customize your challenge. Choose what you want to improve: confidence, posture, storytelling, or all of the above.',
    icon: Target,
  },
  {
    title: 'Upload Daily Videos',
    description:
      'Record and upload a video each day. Practice makes perfect, and consistency is key to building lasting confidence.',
    icon: Video,
  },
  {
    title: 'Get AI-Powered Reviews',
    description:
      'Receive instant, detailed feedback on your performance. Our AI analyzes your posture, energy, voice clarity, and more to help you improve.',
    icon: Sparkles,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={index} className="text-center">
                <CardHeader>
                  <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="size-8 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-2">
                    {index + 1}
                  </div>
                  <CardTitle className="text-2xl">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {step.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}


