'use client';

import { CTASection } from './_components/landing/cta-section';
import { Footer } from './_components/landing/footer';
import { HeroSection } from './_components/landing/hero-section';
import { HowItWorksSection } from './_components/landing/how-it-works-section';
import { Navigation } from './_components/landing/navigation';
import { PricingSection } from './_components/landing/pricing-section';
import { TestimonialsSection } from './_components/landing/testimonials-section';

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
