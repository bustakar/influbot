'use client';

import { SignInButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <>
      <main className="container max-w-4xl mx-auto px-4 py-8">
        Landing Page
        <SignInButton />
      </main>
    </>
  );
}
