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
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[100px] rounded-full opacity-30 pointer-events-none" />

      <div className="container mx-auto max-w-5xl text-center relative z-10">
        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20 mb-8">
          New: AI-Powered Video Analysis
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
          <span className="block mt-2 bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
            Unlock Your Confidence
          </span>
          in Front of the Camera
        </h1>
        <h2 className="text-2xl md:text-3xl font-medium mb-8 text-muted-foreground max-w-3xl mx-auto">
          Transform from camera-shy to camera-ready
        </h2>
        <p className="text-lg text-muted-foreground/80 mb-12 max-w-2xl mx-auto leading-relaxed">
          Daily video challenges with instant AI-powered feedback help you
          master your on-camera presence, one day at a time.
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
