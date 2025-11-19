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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';

import { api } from '../../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../../convex/_generated/dataModel';
import { VideoState } from '../../../../../../../../convex/schema';

const VideoProcessingTimeout = ({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Video</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full aspect-video bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
              Processing Timeout
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
              Video processing timed out after 30 minutes. Cloudflare may be
              experiencing issues.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
              className="bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border-yellow-300 dark:bg-yellow-900/40 dark:hover:bg-yellow-900/60 dark:text-yellow-100 dark:border-yellow-700"
            >
              {isRetrying ? 'Retrying...' : 'Check Status Again'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const VideoUploadFailed = ({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Video</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full aspect-video bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
              Upload Failed
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              The video upload did not complete successfully. Please try
              uploading again.
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="bg-red-100 hover:bg-red-200 text-red-900 border-red-300 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-100 dark:border-red-700"
              >
                {isRetrying ? 'Retrying...' : 'Check Status Again'}
              </Button>
              {/* We could also just show the upload form here, but checking status first is safer if it was a false positive */}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const VideoCompressionFailed = ({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing Failed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full aspect-video bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
              Compression Failed
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              We failed to process your video.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
              className="bg-red-100 hover:bg-red-200 text-red-900 border-red-300 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-100 dark:border-red-700"
            >
              {isRetrying ? 'Retrying...' : 'Retry Processing'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const VideoAnalysisFailed = ({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Failed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full aspect-video bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
              AI Analysis Failed
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              We processed your video but failed to generate the AI analysis.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
              className="bg-red-100 hover:bg-red-200 text-red-900 border-red-300 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-100 dark:border-red-700"
            >
              {isRetrying ? 'Retrying...' : 'Retry Analysis'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const VideoProcessing = ({
  onRetry,
  isRetrying,
  showRetry,
}: {
  onRetry?: () => void;
  isRetrying?: boolean;
  showRetry?: boolean;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Video</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center space-y-2 p-4">
            <p className="text-muted-foreground font-medium">
              Video is being processed...
            </p>
            <p className="text-sm text-muted-foreground">
              This usually takes a few minutes. The video will appear here once
              processing is complete.
            </p>
            {showRetry && onRetry && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? 'Retrying...' : 'Retry Step'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const VideoEmbed = ({ cloudflareUid }: { cloudflareUid: string }) => {
  const videoEmbedUrl = `https://iframe.videodelivery.net/${cloudflareUid}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Video</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            id={`stream-player-${cloudflareUid}`}
            src={videoEmbedUrl}
            className="w-full h-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            title={`Video ${cloudflareUid}`}
            style={{ border: 'none' }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

const formSchema = z.object({
  video: z
    .instanceof(File, { message: 'Please select a video file.' })
    .nullable()
    .refine((file) => file && file.size > 0, 'File cannot be empty.')
    .refine(
      (file) => file && file.size <= MAX_FILE_SIZE,
      `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
    )
    .refine(
      (file) => file && file.type.startsWith('video/'),
      'File must be a video.'
    ),
});

type VideoSectionProps = {
  cloudflareUid?: string;
  state: VideoState;
  submissionId: Id<'submissions'>;
  errorMessage?: string;
};

export const VideoSection = ({
  cloudflareUid,
  state,
  submissionId,
  errorMessage,
}: VideoSectionProps) => {
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const markSubmissionUploaded = useMutation(
    api.submissionMutations.markSubmissionUploaded
  );
  const generateSubmissionTusConfig = useAction(
    api.submissionActions.generateSubmissionTusConfig
  );
  //   const deleteVideo = useAction(api.videos.deleteVideo);

  // Assuming this exists after my backend change, using 'any' to bypass type check until codegen runs
  // In a real scenario, we would run codegen first.
  const retrySubmissionStep = useAction(
    (api as any).submissionRetries?.retrySubmissionStep
  );

  const handleRetry = async () => {
    if (!retrySubmissionStep) {
      toast.error('Retry functionality not available yet');
      return;
    }

    setIsRetrying(true);
    try {
      await retrySubmissionStep({ submissionId });
      toast.success('Retrying step...');
    } catch (error) {
      toast.error('Failed to retry step', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const onSubmit = async ({ value }: { value: z.infer<typeof formSchema> }) => {
    if (!value.video || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const tusConfig = await generateSubmissionTusConfig({
        submissionId,
        fileSize: value.video.size,
        fileName: value.video.name,
        fileType: value.video.type,
      });
      await uploadFileWithTus(value.video, tusConfig.uploadUrl, (progress) => {
        setUploadProgress(progress);
      });

      await markSubmissionUploaded({
        submissionId,
      });

      toast.success('Video uploaded successfully!');
      form.reset();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';

      toast.error('Upload failed', {
        description: errorMessage,
      });

      if (cloudflareUid) {
        try {
          //   await deleteVideo({ cloudflareUid });
        } catch (deleteError) {
          console.error('Failed to cleanup failed upload:', deleteError);
        }
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const form = useForm({
    defaultValues: {
      video: null as File | null,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: onSubmit,
  });

  // Only show video embed when analysis is complete
  if (state === 'video_analysed' && cloudflareUid) {
    return <VideoEmbed cloudflareUid={cloudflareUid} />;
  }

  // Show error states based on errorMessage and current state (check BEFORE other state checks)
  if (errorMessage) {
    if (state === 'video_uploaded' || state === 'processing_timeout') {
      return (
        <VideoUploadFailed onRetry={handleRetry} isRetrying={isRetrying} />
      );
    }
    if (state === 'video_processed') {
      return (
        <VideoCompressionFailed onRetry={handleRetry} isRetrying={isRetrying} />
      );
    }
    if (state === 'video_sent_to_ai') {
      return (
        <VideoAnalysisFailed onRetry={handleRetry} isRetrying={isRetrying} />
      );
    }
  }

  if (state === 'processing_timeout') {
    return (
      <VideoProcessingTimeout onRetry={handleRetry} isRetrying={isRetrying} />
    );
  }

  if (state === 'video_uploaded') {
    // Video uploaded, waiting for Cloudflare to process
    return (
      <VideoProcessing
        onRetry={handleRetry}
        isRetrying={isRetrying}
        showRetry={true}
      />
    );
  }

  if (
    state === 'video_processed' ||
    state === 'video_compressed' ||
    state === 'video_sent_to_ai'
  ) {
    // Video is processed/compressed, show embed with retry button
    if (cloudflareUid) {
      return (
        <>
          <VideoEmbed cloudflareUid={cloudflareUid} />
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {state === 'video_processed' &&
                      'Video is being compressed...'}
                    {state === 'video_compressed' &&
                      'Video is being sent to AI...'}
                    {state === 'video_sent_to_ai' &&
                      'AI analysis is being generated...'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a few moments.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? 'Retrying...' : 'Retry Step'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      );
    }
    // Fallback if no cloudflareUid
    return (
      <VideoProcessing
        onRetry={handleRetry}
        isRetrying={isRetrying}
        showRetry={true}
      />
    );
  }

  // Show upload dropzone for initial states
  if (['initial', 'upload_url_generated'].includes(state)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload Video</CardTitle>
          <CardDescription>
            Upload your video submission. Maximum file size: 500MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="submission-video-upload-form"
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
                      <div
                        className="w-full aspect-video border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center gap-4 p-8 hover:border-muted-foreground/50 transition-colors cursor-pointer"
                        onClick={() => {
                          document
                            .getElementById(
                              `video-upload-input-${submissionId}`
                            )
                            ?.click();
                        }}
                      >
                        <div className="text-center space-y-2">
                          <p className="text-lg font-semibold">
                            Drop your video here
                          </p>
                          <p className="text-sm text-muted-foreground">
                            or click to browse files
                          </p>
                        </div>
                        <input
                          id={`video-upload-input-${submissionId}`}
                          name={field.name}
                          type="file"
                          accept="video/*"
                          disabled={isUploading}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              field.handleChange(file);
                            }
                          }}
                          onBlur={field.handleBlur}
                          aria-invalid={isInvalid}
                        />
                        {field.state.value && (
                          <div className="text-center space-y-4 w-full">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">
                                {field.state.value.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {fileSizeMB} MB
                              </p>
                            </div>
                            <div className="flex gap-2 justify-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  form.reset();
                                  setUploadProgress(0);
                                }}
                              >
                                Change File
                              </Button>
                              <Button
                                type="submit"
                                form="submission-video-upload-form"
                                size="sm"
                                disabled={
                                  isUploading || !form.state.values.video
                                }
                              >
                                {isUploading ? 'Uploading...' : 'Upload Video'}
                              </Button>
                            </div>
                          </div>
                        )}
                        {!field.state.value && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              document
                                .getElementById(
                                  `video-upload-input-${submissionId}`
                                )
                                ?.click();
                            }}
                          >
                            Select Video File
                          </Button>
                        )}
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </div>
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
      </Card>
    );
  }

  return <VideoProcessing />;
};

function uploadFileWithTus(
  file: File,
  uploadUrl: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const chunkSize = 50 * 1024 * 1024; // 50MB

    const upload = new tus.Upload(file, {
      uploadUrl: uploadUrl,
      chunkSize: chunkSize,
      retryDelays: [0, 3000, 5000, 10000, 20000],
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
