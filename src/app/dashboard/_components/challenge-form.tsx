'use client';

import { useForm } from '@tanstack/react-form';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { api } from '../../../../convex/_generated/api';

const THINGS_TO_IMPROVE_OPTIONS = [
  'Posture',
  'Emotions',
  'Fillers',
  'Eye Contact',
  'Voice Clarity',
  'Body Language',
  'Confidence',
  'Storytelling',
  'Energy Level',
  'Authenticity',
] as const;

const formSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  requiredNumberOfSubmissions: z
    .number()
    .min(1, 'Must have at least 1 submission')
    .max(50, 'Maximum 50 submissions allowed'),
  desiredImprovements: z
    .array(z.string())
    .min(1, 'Select at least one thing to improve'),
  specifyPrompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(500, 'Prompt must be at most 500 characters'),
});

export function ChallengeForm() {
  const createChallenge = useMutation(api.challengeMutations.createChallenge);

  const form = useForm({
    defaultValues: {
      title: '',
      requiredNumberOfSubmissions: 30,
      desiredImprovements: [] as string[],
      specifyPrompt: '',
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await createChallenge({
          title: value.title,
          requiredNumberOfSubmissions: value.requiredNumberOfSubmissions,
          desiredImprovements: value.desiredImprovements,
          specifyPrompt: value.specifyPrompt,
        });

        toast.success('Challenge created successfully!');
        form.reset();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create challenge';
        toast.error('Failed to create challenge', {
          description: errorMessage,
        });
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Create Challenge</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set up a challenge to track your video performance improvements
        </p>
      </div>
      <form
        id="challenge-form"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field
            name="title"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                    placeholder="e.g. 'Improve my posture'"
                  />
                  <FieldDescription>
                    A short title for your challenge
                  </FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="requiredNumberOfSubmissions"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Number of Submissions
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    min="1"
                    max="50"
                    value={field.state.value.toString()}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value)) {
                        field.handleChange(value);
                      }
                    }}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                  />
                  <FieldDescription>
                    How many videos you need to submit to complete this
                    challenge
                  </FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="desiredImprovements"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel>Things to Improve</FieldLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {THINGS_TO_IMPROVE_OPTIONS.map((option) => {
                      const isChecked = field.state.value.includes(option);
                      return (
                        <div key={option} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`thingsToImprove-${option}`}
                            checked={isChecked}
                            onChange={(e) => {
                              const current = field.state.value;
                              if (e.target.checked) {
                                field.handleChange([...current, option]);
                              } else {
                                field.handleChange(
                                  current.filter((item) => item !== option)
                                );
                              }
                            }}
                            onBlur={field.handleBlur}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label
                            htmlFor={`thingsToImprove-${option}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {option}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <FieldDescription>
                    Select the areas you want to focus on improving
                  </FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="specifyPrompt"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Your Goal</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    rows={4}
                    placeholder="Describe what you want to achieve with this challenge..."
                    aria-invalid={isInvalid}
                  />
                  <FieldDescription>
                    Provide additional context about your goals and what you
                    want to achieve
                  </FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        </FieldGroup>
      </form>
      <div className="flex justify-end pt-4">
        <Button type="submit" form="challenge-form">
          Create Challenge
        </Button>
      </div>
    </div>
  );
}
