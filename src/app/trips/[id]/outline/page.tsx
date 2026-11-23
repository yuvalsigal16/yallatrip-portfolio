import { redirect } from 'next/navigation';

/** The outline page was removed; old links land on the trip itself. */
export default async function OutlinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/trips/${id}`);
}
