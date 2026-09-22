"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel empty-state py-16">
      <h1 className="text-xl">We couldn’t load this workspace.</h1>
      <p>Check that the application and database are running, then try again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
