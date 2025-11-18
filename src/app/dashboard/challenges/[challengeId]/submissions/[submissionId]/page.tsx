import { Id } from '../../../../../../../convex/_generated/dataModel';
import SubmissionDetail from './_components/submission-detail';

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ challengeId: string; submissionId: string }>;
}) {
  const { submissionId } = await params;

  return <SubmissionDetail id={submissionId as Id<'submissions'>} />;
}
