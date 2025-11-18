import { Id } from '../../../../../convex/_generated/dataModel';
import ChallengeDetail from './_components/challenge-detail';

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  return <ChallengeDetail id={challengeId as Id<'challenges'>} />;
}
