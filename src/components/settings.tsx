"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SessionUser } from "@/lib/api";
import { usePreferences } from "@/stores/preferences";
import { accents, accentLabels, type Accent, type Appearance } from "@/config/appearance";
import { Button } from "@/components/ui/button";
export function Settings() {
  const preferences = usePreferences();
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    setStatus("");
    const { theme, accent, contrast, colorfulHeader } = preferences;
    try {
      if (session.data?.user) {
        await api("/api/account", {
          method: "PATCH",
          body: JSON.stringify({ theme, accent, contrast, colorfulHeader }),
        });
        await client.invalidateQueries({ queryKey: ["session"] });
      }
      setStatus(
        session.data?.user
          ? "Appearance saved to your account and this browser."
          : "Appearance saved on this browser.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>Workspace settings</h1>
          <p>Choose how your workspace looks and find your records.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="panel form-stack">
          <h2 className="text-lg">Appearance</h2>
          <label className="field">
            Workspace colour theme
            <select
              value={preferences.accent}
              onChange={(e) => preferences.setAppearance({ accent: e.target.value as Accent })}
            >
              {accents.map((accent) => (
                <option key={accent} value={accent}>
                  {accentLabels[accent]}
                </option>
              ))}
            </select>
          </label>
          <p className="muted text-xs">
            Choose a full workspace palette, then choose its light or dark display mode below.
          </p>
          <label className="field">
            Display mode
            <select
              aria-label="Display mode"
              value={preferences.theme}
              onChange={(e) =>
                preferences.setAppearance({ theme: e.target.value as Appearance["theme"] })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <fieldset className="appearance-colors">
            <legend>Colour theme previews</legend>
            <div className="color-options">
              {accents.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  data-color={accent}
                  aria-label={`${accentLabels[accent]} accent`}
                  aria-pressed={preferences.accent === accent}
                  onClick={() => preferences.setAppearance({ accent })}
                >
                  <span className="color-dot" aria-hidden="true" />
                  {accentLabels[accent]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="check-label">
            <input
              type="checkbox"
              checked={preferences.contrast}
              onChange={(e) => preferences.setAppearance({ contrast: e.target.checked })}
            />
            High contrast
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={preferences.colorfulHeader}
              onChange={(e) => preferences.setAppearance({ colorfulHeader: e.target.checked })}
            />
            Colorful header and buttons
          </label>
          <div className="appearance-preview">
            <strong>Live preview</strong>
            <p>
              Your colour theme applies to the background, sidebar, panels, navigation and buttons.
            </p>
            <Button type="button" disabled={busy} onClick={() => void save()}>
              Save appearance
            </Button>
          </div>
          <p className="muted text-xs">
            Changes preview immediately and are remembered on this browser. Save to sync them to
            your signed-in account.
          </p>
          {status && (
            <p role="status" className="success">
              {status}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </section>
        <div className="form-stack">
          <section className="panel form-stack">
            <h2 className="text-lg">Your records</h2>
            <p className="muted">
              Browse your saved files, versions, processing history and account drafts.
            </p>
            <Button asChild>
              <Link href="/records">View all records</Link>
            </Button>
          </section>
          <section className="panel form-stack">
            <h2 className="text-lg">Personal workspace</h2>
            <p className="muted">
              Edit your photo and contact details, or manage your password in account settings.
            </p>
            <Button asChild variant="secondary">
              <Link href="/profile">Edit your profile</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/profile/settings">Password & account security</Link>
            </Button>
          </section>
        </div>
      </div>
    </>
  );
}
