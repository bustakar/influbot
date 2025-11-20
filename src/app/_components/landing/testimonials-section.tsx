'use client';

import { Star } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Content Creator',
    quote:
      'I went from avoiding video calls to hosting my own YouTube channel. The daily practice and feedback transformed my confidence completely.',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    role: 'Sales Professional',
    quote:
      'The AI feedback is incredibly detailed. I improved my eye contact and eliminated filler words in just 30 days. Game changer for my presentations.',
    rating: 5,
  },
  {
    name: 'Emily Rodriguez',
    role: 'Entrepreneur',
    quote:
      'Starting my business required me to be on camera constantly. This platform gave me the practice and confidence I needed to succeed.',
    rating: 5,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: rating }).map((_, i) => (
        <Star key={i} className="size-5 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
          Join Thousands Building Confidence
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                      {testimonial.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
                <StarRating rating={testimonial.rating} />
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground italic">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

