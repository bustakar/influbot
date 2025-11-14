"use client";

import { useState, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface VideoUploadProps {
  challengeId: Id<"challenges">;
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
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setError("Video file must be less than 500MB");
      return;
    }

    setError(null);
    void uploadVideo(file);
  }

  async function uploadVideo(file: File) {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get Cloudflare upload URL
      const { uploadUrl, uploadId } = await getUploadUrl({});

      // Step 2: Upload video directly to Cloudflare
      const xhr = new XMLHttpRequest();

      const actualStreamId = await new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", () => {
          // Cloudflare Stream direct upload returns 200 on success
          // The response contains the actual video ID
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              // Cloudflare returns { result: { uid: "...", ... } } on success
              if (response.result && response.result.uid) {
                // Use the uid from the upload response, not the pre-upload uid
                resolve(response.result.uid);
              } else {
                reject(
                  new Error(
                    `Upload failed: ${xhr.responseText || "Unknown error"}`
                  )
                );
              }
            } catch (e) {
              // If response is not JSON, check if it's empty (some endpoints do this)
              if (xhr.responseText.trim() === "") {
                // Empty response might mean success, use the uploadId we got earlier
                resolve(uploadId);
              } else {
                reject(
                  new Error(
                    `Upload failed: Invalid response - ${xhr.responseText}`
                  )
                );
              }
            }
          } else {
            let errorMessage = `Upload failed with status ${xhr.status}`;
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              if (errorResponse.errors && errorResponse.errors.length > 0) {
                errorMessage = errorResponse.errors[0].message || errorMessage;
              } else if (errorResponse.message) {
                errorMessage = errorResponse.message;
              }
            } catch (e) {
              // Use default error message
            }
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload was cancelled"));
        });

        xhr.open("POST", uploadUrl);
        // Cloudflare Stream direct upload expects the raw file as the body
        // Don't set Content-Type - let the browser handle it
        xhr.send(file);
      });

      // Step 3: Create submission record using the actual stream ID from upload
      const submissionId = await createSubmission({
        challengeId,
        dayNumber,
        cloudflareStreamId: actualStreamId,
      });

      // Step 4: Process video upload and trigger analysis (runs in background)
      await processUpload({
        submissionId,
        cloudflareStreamId: actualStreamId,
        customPrompt,
        dayNumber,
      });

      setUploadProgress(100);
      onUploadComplete?.();
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to upload video"
      );
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
          {isUploading ? "Uploading..." : "Select Video File"}
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

