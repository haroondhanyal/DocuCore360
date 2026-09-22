"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type SessionUser } from "@/lib/api";
import { message } from "@/lib/utils";
import { usePreferences } from "@/stores/preferences";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
export function Settings() {
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const client = useQueryClient();
  const router = useRouter();
  const { data, error: sessionError } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  async function action(url: string, method: string, payload?: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ message?: string }>(url, {
        method,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      setNotice(result.message ?? "Saved.");
      await client.invalidateQueries({ queryKey: ["session"] });
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>A workspace that feels like you.</h1>
          <p>Manage your account and preferences.</p>
        </div>
      </div>
      {notice && (
        <p className="success mb-5" role="status">
          {notice}
        </p>
      )}
      {(error || sessionError) && (
        <p className="error mb-5" role="alert">
          {error || sessionError?.message}
        </p>
      )}
      <div className="max-w-2xl space-y-5">
        <section className="panel">
          <h2 className="text-lg mb-5">Appearance</h2>
          <label className="field">
            Color theme
            <select
              value={theme}
              onChange={(e) => {
                const value = e.target.value as typeof theme;
                setTheme(value);
                if (data?.user) void action("/api/account", "PATCH", { theme: value });
              }}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <p className="muted text-xs mt-3">
            Your appearance preference is remembered on this browser.
          </p>
        </section>
        {data?.user ? (
          <>
            <section className="panel">
              <h2 className="text-lg mb-3">Your profile</h2>
              <p className="muted mb-4">Update your photo, name, email, contact number and bio.</p>
              <Button asChild>
                <Link href="/profile">Edit your profile</Link>
              </Button>
            </section>
            <section className="panel">
              <h2 className="text-lg mb-5">Change password</h2>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void action("/api/account", "PATCH", {
                    currentPassword: form.get("current"),
                    newPassword: form.get("new"),
                  });
                }}
              >
                <label className="field">
                  Current password
                  <input type="password" name="current" autoComplete="current-password" required />
                </label>
                <label className="field">
                  New password
                  <input
                    type="password"
                    name="new"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  Update password
                </Button>
              </form>
            </section>
            <section className="panel flex gap-3 flex-wrap">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  if (await action("/api/auth/logout", "POST")) {
                    client.removeQueries({ queryKey: ["files"] });
                    router.push("/");
                  }
                }}
              >
                Sign out
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete account
              </Button>
            </section>
          </>
        ) : (
          <section className="panel">
            <p className="muted text-sm mb-4">
              Sign in to manage your profile and account security.
            </p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </section>
        )}
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Permanently delete account">
        <p className="muted text-xs leading-6 mb-5">
          Your saved files, sessions and account will be deleted. Enter your current password to
          confirm.
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await action("/api/account", "DELETE", { password })) {
              setDeleteOpen(false);
              client.clear();
              router.push("/");
            }
          }}
        >
          <label className="field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <Button variant="destructive" type="submit" disabled={busy}>
            Delete my account and files
          </Button>
          {error && <p className="error">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}
