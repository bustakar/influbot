export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ challengeId: string; submissionId: string }>;
}) {
  const { challengeId, submissionId } = await params;
  return <div>SubmissionPage</div>;
}
