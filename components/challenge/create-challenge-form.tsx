"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const formSchema = z.object({
  customPrompt: z
    .string()
    .min(10, "Please provide at least 10 characters describing your focus areas")
    .max(500, "Prompt must be less than 500 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateChallengeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const createChallenge = useMutation(api.challenges.createChallenge);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customPrompt: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const challengeId = await createChallenge({
        customPrompt: values.customPrompt,
      });
      router.push(`/challenge/${challengeId}`);
    } catch (error) {
      console.error("Error creating challenge:", error);
      alert(
        error instanceof Error ? error.message : "Failed to create challenge"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Start Your 30-Day Challenge</CardTitle>
        <CardDescription>
          Upload a video each day for 30 days and get AI-powered feedback on
          your speaking and stance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="customPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What would you like to improve?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., I want to improve my stance, speak more fluently, maintain better eye contact with the camera..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe your specific focus areas. The AI will use this to
                    provide targeted feedback on your videos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Starting Challenge..." : "Start Challenge"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

