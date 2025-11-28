'use client';

import { SignUpButton } from '@clerk/nextjs';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    description: 'Perfect for trying out the platform',
    features: [
      '1 active challenge',
      '2 days of video practice',
      'Basic AI feedback',
      'Daily video uploads',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    pricePeriod: '/month',
    priceNote: '$19/month billed annually',
    description: 'For serious creators and professionals',
    features: [
      'Unlimited challenges',
      'Unlimited video practice',
      'Advanced AI analysis',
      'Detailed improvement tracking',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
];

function FeatureItem({ feature }: { feature: string }) {
  return (
    <div className="flex items-start gap-3">
      <Check className="size-5 text-primary shrink-0 mt-0.5" />
      <span className="text-muted-foreground">{feature}</span>
    </div>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6">
          Simple, Transparent Pricing
        </h2>
        <p className="text-xl text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
          Start your journey to confidence today. No hidden fees, cancel
          anytime.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative ${plan.popular ? 'border-primary border-2 shadow-lg md:scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.pricePeriod && (
                    <span className="text-muted-foreground">
                      {plan.pricePeriod}
                    </span>
                  )}
                  {plan.priceNote && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {plan.priceNote}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.features.map((feature, featureIndex) => (
                  <FeatureItem key={featureIndex} feature={feature} />
                ))}
              </CardContent>
              <CardFooter>
                <SignUpButton mode="modal">
                  <Button
                    className="w-full"
                    size="lg"
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </SignUpButton>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
