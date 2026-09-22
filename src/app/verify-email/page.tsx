import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Verify Email", robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AuthForm mode="verify-email" />
    </Suspense>
  );
}
