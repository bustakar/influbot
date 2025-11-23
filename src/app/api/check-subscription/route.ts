import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { has, userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { hasActiveSubscription: false },
        { status: 401 }
      );
    }

    // Check if user has the 'influbot_access' plan using Clerk's has() helper
    // This checks for subscription-based access control
    // The plan key matches what's configured in Clerk Billing
    const hasActiveSubscription = has({ plan: 'influbot_access' });

    return NextResponse.json({ hasActiveSubscription });
  } catch (error) {
    console.error('Error checking subscription:', error);
    // If billing is not set up or user doesn't have subscription, return false
    return NextResponse.json({ hasActiveSubscription: false });
  }
}
