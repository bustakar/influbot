'use client';

import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Convex + Next.js + Clerk
        <UserButton />
      </header>
      <main className="p-8 flex flex-col gap-8">
        <div className="flex flex-col gap-8 w-96 mx-auto">
          <p>Log in to see the numbers</p>
          <SignInButton mode="modal">
            <button className="bg-foreground text-background px-4 py-2 rounded-md">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="bg-foreground text-background px-4 py-2 rounded-md">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </main>
    </>
  );
}
