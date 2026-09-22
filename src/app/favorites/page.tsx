import { Suspense } from "react";
import { ToolDirectory } from "@/components/tool-directory";
export const metadata = { title: "Favorites", robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<p>Loading favorites…</p>}>
      <ToolDirectory favoritesOnly />
    </Suspense>
  );
}
