'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useAction, useMutation } from 'convex/react';
import { useRef, useState } from 'react';

interface VideoUploadProps {
  challengeId: Id<'challenges'>;
  dayNumber: number;
  customPrompt: string;
  onUploadComplete?: () => void;
}

export function VideoUpload({
  challengeId,
  dayNumber,
  customPrompt,
  onUploadComplete,
}: VideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = useAction(api.cloudflare.getCloudflareUploadUrl);
  const createSubmission = useMutation(api.challenges.createVideoSubmission);
  const processUpload = useAction(api.videos.processVideoUpload);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setError('Video file must be less than 500MB');
      return;
    }

    setError(null);
    void uploadVideo(file);
  }

  async function uploadVideo(file: File) {
    setIsUploading(true);
    setUploadProgress(0);

    console.log('[VideoUpload] Starting upload process', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    try {
      // Step 1: Get Cloudflare upload URL
      console.log(
        '[VideoUpload] Step 1: Requesting upload URL from Cloudflare...'
      );
      const { uploadUrl, uploadId } = await getUploadUrl({});
      console.log('[VideoUpload] Got upload URL:', {
        uploadUrl: uploadUrl.substring(0, 100) + '...',
        uploadId,
      });

      // Step 2: Upload video directly to Cloudflare
      console.log(
        '[VideoUpload] Step 2: Starting file upload to Cloudflare...'
      );
      const xhr = new XMLHttpRequest();

      const actualStreamId = await new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploadProgress(percentComplete);
            if (percentComplete % 25 === 0) {
              console.log(
                `[VideoUpload] Upload progress: ${Math.round(percentComplete)}%`
              );
            }
          }
        });

        xhr.addEventListener('load', () => {
          console.log('[VideoUpload] Upload completed, response received:', {
            status: xhr.status,
            statusText: xhr.statusText,
            responseHeaders: xhr.getAllResponseHeaders(),
            responseText: xhr.responseText.substring(0, 500),
            responseType: xhr.responseType,
          });

          // Cloudflare Stream direct upload returns 200 on success
          // The response contains the actual video ID
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log('[VideoUpload] Parsed response:', response);
              // Cloudflare returns { result: { uid: "...", ... } } on success
              if (response.result && response.result.uid) {
                console.log(
                  '[VideoUpload] Upload successful, got stream ID:',
                  response.result.uid
                );
                // Use the uid from the upload response, not the pre-upload uid
                resolve(response.result.uid);
              } else {
                console.error(
                  '[VideoUpload] Response missing result.uid:',
                  response
                );
                reject(
                  new Error(
                    `Upload failed: ${xhr.responseText || 'Unknown error'}`
                  )
                );
              }
            } catch (e) {
              console.error(
                '[VideoUpload] Failed to parse response as JSON:',
                e
              );
              // If response is not JSON, check if it's empty (some endpoints do this)
              if (xhr.responseText.trim() === '') {
                console.log(
                  '[VideoUpload] Empty response, using uploadId:',
                  uploadId
                );
                // Empty response might mean success, use the uploadId we got earlier
                resolve(uploadId);
              } else {
                console.error(
                  '[VideoUpload] Non-empty non-JSON response:',
                  xhr.responseText
                );
                reject(
                  new Error(
                    `Upload failed: Invalid response - ${xhr.responseText}`
                  )
                );
              }
            }
          } else {
            console.error('[VideoUpload] Upload failed with non-200 status:', {
              status: xhr.status,
              statusText: xhr.statusText,
              responseText: xhr.responseText,
              contentType: xhr.getResponseHeader('content-type'),
            });

            let errorMessage = `Upload failed with status ${xhr.status}`;

            // Try to parse as JSON first
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              console.error(
                '[VideoUpload] Error response (JSON):',
                errorResponse
              );
              if (errorResponse.errors && errorResponse.errors.length > 0) {
                errorMessage = errorResponse.errors[0].message || errorMessage;
                console.error(
                  '[VideoUpload] Error details:',
                  errorResponse.errors
                );
              } else if (errorResponse.message) {
                errorMessage = errorResponse.message;
              }
            } catch (e) {
              // If not JSON, use the plain text response (Cloudflare returns plain text errors)
              console.error(
                '[VideoUpload] Error response is plain text:',
                xhr.responseText
              );
              errorMessage = xhr.responseText.trim() || errorMessage;
            }

            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener('error', (event) => {
          console.error('[VideoUpload] Network error during upload:', event);
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          console.warn('[VideoUpload] Upload was aborted');
          reject(new Error('Upload was cancelled'));
        });

        xhr.addEventListener('loadstart', () => {
          console.log('[VideoUpload] Upload started');
        });

        xhr.addEventListener('loadend', () => {
          console.log('[VideoUpload] Upload loadend event fired');
        });

        console.log(
          '[VideoUpload] Opening POST request to:',
          uploadUrl.substring(0, 100) + '...'
        );
        xhr.open('POST', uploadUrl);

        console.log('[VideoUpload] File details:', {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        // Cloudflare Stream direct upload expects raw binary file data
        // Send the file directly as the request body (not FormData)
        // Important: Do NOT set Content-Type - Cloudflare detects it automatically
        console.log(
          '[VideoUpload] Sending file as raw binary (File object directly)...'
        );
        xhr.send(file);
      });

      console.log(
        '[VideoUpload] Step 3: Creating submission record with stream ID:',
        actualStreamId
      );
      // Step 3: Create submission record using the actual stream ID from upload
      const submissionId = await createSubmission({
        challengeId,
        dayNumber,
        cloudflareStreamId: actualStreamId,
      });
      console.log('[VideoUpload] Submission created:', submissionId);

      console.log(
        '[VideoUpload] Step 4: Triggering video processing and analysis...'
      );
      // Step 4: Process video upload and trigger analysis (runs in background)
      await processUpload({
        submissionId,
        cloudflareStreamId: actualStreamId,
        customPrompt,
        dayNumber,
      });
      console.log('[VideoUpload] Processing triggered successfully');

      setUploadProgress(100);
      console.log('[VideoUpload] Upload process completed successfully');
      onUploadComplete?.();
    } catch (err) {
      console.error('[VideoUpload] Upload error caught:', err);
      console.error('[VideoUpload] Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined,
      });
      setError(err instanceof Error ? err.message : 'Failed to upload video');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Day {dayNumber} Video</CardTitle>
        <CardDescription>
          Upload your video for day {dayNumber} of the challenge
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
        />
        <Button
          onClick={() => {
            fileInputRef.current?.click();
          }}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? 'Uploading...' : 'Select Video File'}
        </Button>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} />
            <p className="text-sm text-muted-foreground text-center">
              {Math.round(uploadProgress)}% uploaded
            </p>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
