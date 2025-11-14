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

      // Step 2: Upload video directly to Cloudflare using Fetch API
      // Fetch API handles large files and encoding better than XMLHttpRequest
      console.log(
        '[VideoUpload] Step 2: Starting file upload to Cloudflare...'
      );
      console.log('[VideoUpload] File details:', {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      const actualStreamId = await (async (): Promise<string> => {
        try {
          console.log('[VideoUpload] Sending file using Fetch API...');
          console.log(
            '[VideoUpload] Upload URL:',
            uploadUrl.substring(0, 100) + '...'
          );

          // Create FormData and append the video file
          // Cloudflare Stream expects multipart/form-data with file in 'file' field
          const formData = new FormData();
          formData.append('file', file);

          console.log('[VideoUpload] Created FormData with file');

          const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            // Don't set Content-Type - browser will set it with proper boundary
          });

          // Update progress to 100% when request completes
          setUploadProgress(100);

          console.log('[VideoUpload] Upload completed, response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries()),
          });

          const responseText = await response.text();
          console.log(
            '[VideoUpload] Response body:',
            responseText.substring(0, 500)
          );

          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              console.log('[VideoUpload] Parsed response:', data);

              // Cloudflare returns { result: { uid: "...", ... } } on success
              if (data.result && data.result.uid) {
                console.log(
                  '[VideoUpload] Upload successful, got stream ID:',
                  data.result.uid
                );
                return data.result.uid;
              } else {
                console.error(
                  '[VideoUpload] Response missing result.uid:',
                  data
                );
                throw new Error(
                  `Upload failed: ${responseText || 'Unknown error'}`
                );
              }
            } catch (e) {
              console.error(
                '[VideoUpload] Failed to parse response as JSON:',
                e
              );
              if (responseText.trim() === '') {
                console.log(
                  '[VideoUpload] Empty response, using uploadId:',
                  uploadId
                );
                return uploadId;
              } else {
                throw new Error(
                  `Upload failed: Invalid response - ${responseText}`
                );
              }
            }
          } else {
            // Handle error response
            console.error('[VideoUpload] Upload failed:', {
              status: response.status,
              statusText: response.statusText,
              responseText: responseText,
            });

            let errorMessage = `Upload failed with status ${response.status}`;

            // Try to parse as JSON first
            try {
              const errorResponse = JSON.parse(responseText);
              console.error(
                '[VideoUpload] Error response (JSON):',
                errorResponse
              );
              if (errorResponse.errors && errorResponse.errors.length > 0) {
                errorMessage = errorResponse.errors[0].message || errorMessage;
              } else if (errorResponse.message) {
                errorMessage = errorResponse.message;
              }
            } catch (e) {
              // If not JSON, use the plain text response
              console.error(
                '[VideoUpload] Error response is plain text:',
                responseText
              );
              errorMessage = responseText.trim() || errorMessage;
            }

            throw new Error(errorMessage);
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Upload was cancelled');
          }
          throw error;
        }
      })();

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
