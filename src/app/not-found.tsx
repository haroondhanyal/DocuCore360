import Link from "next/link";
export default function NotFound() {
  return (
    <div className="panel empty-state py-16">
      <h1 className="text-2xl">This page took a different path.</h1>
      <p>The page or tool you requested could not be found.</p>
      <Link className="text-[var(--primary)] mt-3" href="/tools">
        Explore document tools →
      </Link>
    </div>
  );
}
