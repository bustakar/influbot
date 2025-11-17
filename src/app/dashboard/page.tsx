import { UserButton } from '@clerk/nextjs';

import { VideoUploadForm } from './_components/video-upload-form';

export default function DashboardPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Convex + Next.js + Clerk
        <UserButton />
      </header>
      <main className="p-8 flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-center">Dashboard</h1>
        <VideoUploadForm />
      </main>
    </>
  );
}
