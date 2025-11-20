'use client';

import { SignUpButton } from '@clerk/nextjs';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="py-20 px-4 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10">
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Ready to Transform Your On-Camera Presence?
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          Join thousands who have already started their journey to confidence
        </p>
        <div className="flex flex-col items-center gap-4">
          <SignUpButton mode="modal">
            <Button size="lg" className="text-lg px-8 py-6">
              Start Your Free Challenge
              <ArrowRight className="ml-2 size-5" />
            </Button>
          </SignUpButton>
          <p className="text-sm text-muted-foreground">
            No credit card required • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}


