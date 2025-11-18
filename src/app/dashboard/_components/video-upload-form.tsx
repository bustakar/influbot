'use client';

import { useForm } from '@tanstack/react-form';
import { useAction, useMutation } from 'convex/react';
import * as React from 'react';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';

import { api } from '../../../../convex/_generated/api';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

const formSchema = z.object({
  video: z
    .instanceof(File, { message: 'Please select a video file.' })
    .refine((file) => file.size > 0, 'File cannot be empty.')
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
    )
    .refine((file) => file.type.startsWith('video/'), 'File must be a video.'),
});

export function VideoUploadForm() {
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const generateTusConfig = useAction(api.videos.generateCloudflareTusConfig);
  const getApiToken = useAction(api.videos.getCloudflareApiToken);
  const markVideoUploaded = useMutation(api.videoMutations.markVideoUploaded);
  const deleteVideo = useAction(api.videos.deleteVideo);

  const form = useForm({
    defaultValues: {
      video: null as File | null,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (!value.video) {
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      let uid: string | null = null;
      try {
        // Get tus config and API token
        const [tusConfig, apiToken] = await Promise.all([
          generateTusConfig(),
          getApiToken(),
        ]);
        uid = tusConfig.videoUid;

        // Upload file using tus protocol (resumable uploads for large files)
        await uploadFileWithTus(
          value.video,
          tusConfig.tusEndpoint,
          apiToken,
          (progress) => {
            setUploadProgress(progress);
          }
        );

        // Mark video as uploaded in database
        if (!uid) {
          throw new Error('Video UID not available');
        }
        await markVideoUploaded({ cloudflareUid: uid });

        toast.success('Video uploaded successfully!', {
          description: `Video UID: ${uid}`,
        });

        // Reset form
        form.reset();
        setUploadProgress(0);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';

        // Clean up: delete video from Cloudflare and Convex if upload failed
        if (uid) {
          try {
            await deleteVideo({ cloudflareUid: uid });
          } catch (deleteError) {
            console.error('Failed to cleanup failed upload:', deleteError);
          }
        }

        toast.error('Upload failed', {
          description: errorMessage,
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Video</CardTitle>
        <CardDescription>
          Upload a video file for AI analysis. Maximum file size: 500MB
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="video-upload-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="video"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                const fileSizeMB = field.state.value
                  ? (field.state.value.size / (1024 * 1024)).toFixed(2)
                  : '0';

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Video File</FieldLabel>
                    <input
                      id={field.name}
                      name={field.name}
                      type="file"
                      accept="video/*"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          field.handleChange(file);
                        }
                      }}
                      onBlur={field.handleBlur}
                      className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-invalid={isInvalid}
                    />
                    {field.state.value && (
                      <FieldDescription>
                        Selected: {field.state.value.name} ({fileSizeMB} MB)
                      </FieldDescription>
                    )}
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />
          </FieldGroup>

          {isUploading && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Field orientation="horizontal">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset();
              setUploadProgress(0);
            }}
            disabled={isUploading}
          >
            Reset
          </Button>
          <Button type="submit" form="video-upload-form" disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload Video'}
          </Button>
        </Field>
      </CardFooter>
    </Card>
  );
}

/**
 * Upload file to Cloudflare Stream using tus protocol (resumable uploads).
 * Recommended for files over 200MB. Handles large files with chunked uploads.
 */
function uploadFileWithTus(
  file: File,
  tusEndpoint: string,
  apiToken: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Determine chunk size based on file size
    // Minimum: 5MB, Recommended: 50MB for reliable connections
    // Must be divisible by 256 KiB (262144 bytes)
    const fileSize = file.size;
    const minChunkSize = 5 * 1024 * 1024; // 5MB
    const recommendedChunkSize = 50 * 1024 * 1024; // 50MB
    const maxChunkSize = 200 * 1024 * 1024; // 200MB
    const chunkSizeDivisor = 256 * 1024; // 256 KiB

    // Use recommended chunk size, but ensure it's divisible by 256 KiB
    let chunkSize = Math.min(recommendedChunkSize, fileSize);
    chunkSize = Math.max(chunkSize, minChunkSize);
    // Round to nearest multiple of 256 KiB
    chunkSize = Math.floor(chunkSize / chunkSizeDivisor) * chunkSizeDivisor;
    chunkSize = Math.min(chunkSize, maxChunkSize);

    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      chunkSize: chunkSize,
      retryDelays: [0, 3000, 5000, 10000, 20000], // Retry delays in milliseconds
      metadata: {
        name: file.name,
        filetype: file.type,
      },
      uploadSize: file.size,
      onError: (error) => {
        reject(
          new Error(
            `Upload failed: ${error.message || 'Unknown error occurred'}`
          )
        );
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const progress = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress(progress);
      },
      onSuccess: () => {
        resolve();
      },
    });

    upload.start();
  });
}
