'use client';

import { SignUpButton } from '@clerk/nextjs';
import { ArrowRight, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function HeroSection() {
  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto max-w-5xl text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Make Your Dreams Come True
        </h1>
        <h2 className="text-2xl md:text-4xl font-semibold mb-6 text-foreground">
          Unlock Your Confidence in Front of the Camera
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Transform from camera-shy to camera-ready. Daily video challenges with
          AI-powered feedback help you master your on-camera presence, one day at
          a time.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <SignUpButton mode="modal">
            <Button size="lg" className="text-lg px-8 py-6">
              Start Your Journey
              <ArrowRight className="ml-2 size-5" />
            </Button>
          </SignUpButton>
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6"
            onClick={scrollToHowItWorks}
          >
            <Play className="mr-2 size-5" />
            See How It Works
          </Button>
        </div>
      </div>
    </section>
  );
}


