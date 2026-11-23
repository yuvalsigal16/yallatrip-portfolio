// Shown while a trips page loads on the server.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12" aria-busy="true" aria-label="טוען">
      <div className="h-14 w-2/3 animate-pulse rounded-xl bg-sand-2" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-3xl bg-sand-2" />)}
      </div>
    </div>
  );
}
