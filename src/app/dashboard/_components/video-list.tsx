'use client';

import { useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import { VideoReviewCard } from './video-review-card';

export function VideoList() {
  const videos = useQuery(api.videoQueries.getVideosByUser);

  if (videos === undefined) {
    return (
      <div className="w-full">
        <p className="text-sm text-muted-foreground">Loading videos...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return null; // Don't show anything if no videos
  }

  return (
    <div className="w-full space-y-6">
      {videos.map((video) => (
        <VideoReviewCard key={video._id} video={video} />
      ))}
    </div>
  );
}

