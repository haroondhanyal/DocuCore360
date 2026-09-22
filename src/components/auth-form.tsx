"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { message } from "@/lib/utils";
import { Button } from "@/components/ui/button";
type Mode = "login" | "register" | "forgot-password" | "reset-password" | "verify-email";
const titles: Record<Mode, string> = {
  login: "Welcome back.",
  register: "Make room for better work.",
  "forgot-password": "Forgot your password?",
  "reset-password": "A fresh start.",
  "verify-email": "Verify your email.",
};
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ message?: string }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          ...(form.get("email") ? { email: form.get("email") } : {}),
          ...(form.get("password") ? { password: form.get("password") } : {}),
          ...(form.get("name") ? { name: form.get("name") } : {}),
          remember: form.get("remember") === "on",
          token: params.get("token") ?? "",
        }),
      });
      if (mode === "login" || mode === "register") {
        await client.invalidateQueries({ queryKey: ["session"] });
        router.push("/dashboard");
        router.refresh();
      } else setNotice(data.message ?? "Done.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-card">
      <span className="eyebrow mb-5">
        <ShieldCheck size={14} />
        YOUR PRIVATE WORKSPACE
      </span>
      <h1>{titles[mode]}</h1>
      <p>
        {mode === "register"
          ? "Create an account to save your documents. Core PDF tools are always available without signing in."
          : mode === "login"
            ? "Sign in to your personal document workspace."
            : "Account emails require SMTP to be configured by the workspace administrator."}
      </p>
      <form onSubmit={submit} className="form-stack">
        {mode === "register" && (
          <label className="field">
            Your name
            <input name="name" autoComplete="name" required minLength={2} maxLength={80} />
          </label>
        )}
        {["login", "register", "forgot-password"].includes(mode) && (
          <label className="field">
            Email address
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
        )}
        {["login", "register", "reset-password"].includes(mode) && (
          <label className="field">
            {mode === "reset-password" ? "New password" : "Password"}
            <input
              name="password"
              aria-label={mode === "reset-password" ? "New password" : "Password"}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={10}
              maxLength={128}
              required
            />
            {mode !== "login" && <small>At least 10 characters.</small>}
          </label>
        )}
        {mode === "login" && (
          <div className="flex justify-between gap-3">
            <label className="check-label">
              <input name="remember" type="checkbox" />
              Remember me
            </label>
            <Link className="text-xs" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {busy ? <LoaderCircle className="spin" size={16} /> : null}
          {mode === "register"
            ? "Create account"
            : mode === "login"
              ? "Sign in"
              : mode === "forgot-password"
                ? "Request reset link"
                : mode === "verify-email"
                  ? "Verify email"
                  : "Update password"}
          <ArrowRight size={15} />
        </Button>
      </form>
      <p className="mt-6 !mb-0 text-center">
        {mode === "login" ? (
          <>
            New here? <Link href="/register">Create an account</Link>
          </>
        ) : (
          <Link href="/login">Back to sign in</Link>
        )}
      </p>
    </section>
  );
}
