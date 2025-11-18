import { Id } from '../../../../../convex/_generated/dataModel';
import ChallengeDetail from './_components/challenge-detail';

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChallengeDetail id={id as Id<'challenges'>} />;
}
