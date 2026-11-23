import { redirect } from 'next/navigation';

/** The overview page was removed; old links land on the trip itself. */
export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/trips/${id}`);
}
