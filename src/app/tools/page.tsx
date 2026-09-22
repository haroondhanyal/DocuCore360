import { Suspense } from "react";
import { ToolDirectory } from "@/components/tool-directory";
export const metadata = { title: "All document tools" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return (
    <Suspense fallback={<p>Loading tools…</p>}>
      <ToolDirectory key={category ?? "all"} />
    </Suspense>
  );
}
