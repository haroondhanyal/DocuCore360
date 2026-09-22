"use client";
import { PasswordInput } from "@/components/ui/password-input";
import { useState, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SessionUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { message } from "@/lib/utils";
export function Profile() {
  const photoInput = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const user = session.data?.user;
  async function save(url: string, method: string, body?: BodyInit) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, {
        method,
        body,
        headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save profile.");
      setNotice(result.message);
      setLoginRequired(Boolean(result.requiresLogin));
      if (result.requiresLogin) client.clear();
      else await client.invalidateQueries({ queryKey: ["session"] });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>Your profile</h1>
          <p>A personal touch for your document workspace.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/profile/settings">Account settings</Link>
        </Button>
      </div>
      {notice && (
        <p className="success mb-5" role="status">
          {notice}
        </p>
      )}
      {(error || session.error) && (
        <p className="error mb-5" role="alert">
          {error || session.error?.message}
        </p>
      )}
      {session.isPending ? (
        <p>Loading your profile…</p>
      ) : !user ? (
        <section className="panel">
          <p className="mb-4">
            {loginRequired
              ? "Sign in with your updated email address to continue."
              : "Sign in to manage your profile."}
          </p>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </section>
      ) : (
        <div className="profile-layout">
          <section className="panel profile-summary">
            <div className="profile-photo-control">
              <ProfileAvatar user={user} large />
              <div className="photo-actions">
                <button
                  type="button"
                  aria-label="Edit profile photo"
                  title="Edit profile photo"
                  disabled={busy}
                  onClick={() => photoInput.current?.click()}
                >
                  <Pencil size={16} />
                </button>
                {user.avatarUpdatedAt && (
                  <button
                    type="button"
                    aria-label="Delete profile photo"
                    title="Delete profile photo"
                    disabled={busy}
                    onClick={() => void save("/api/account/avatar", "DELETE")}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <h2>{user.name}</h2>
            <p className="muted profile-email">{user.email}</p>
            <span className="profile-badge">
              {user.emailVerifiedAt ? "Email verified" : "Email not verified"}
            </span>
            <label className="sr-only">
              Profile photo
              <input
                ref={photoInput}
                tabIndex={-1}
                aria-label="Upload profile photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setError("Profile photos must be under 2 MB.");
                    return;
                  }
                  void save("/api/account/avatar", "PUT", file);
                }}
              />
            </label>
            <p className="muted text-xs">
              JPG, PNG or WebP · up to 2 MB. Photos are cropped to a square.
            </p>
            {!user.emailVerifiedAt && (
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => void save("/api/auth/send-verification", "POST", "{}")}
              >
                Request verification email
              </Button>
            )}
            <p className="muted text-xs mt-5">
              Your profile and contact details are private to your account.
            </p>
          </section>
          <section className="panel">
            <h2 className="text-lg mb-5">Personal details</h2>
            <form
              key={`${user.id}:${user.email}`}
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void save("/api/account", "PATCH", JSON.stringify(Object.fromEntries(form)));
              }}
            >
              <fieldset disabled={busy} className="form-stack">
                <label className="field">
                  Full name
                  <input
                    name="name"
                    defaultValue={user.name}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <div className="profile-fields">
                  <label className="field">
                    Email address
                    <input
                      name="email"
                      type="email"
                      defaultValue={user.email}
                      autoComplete="email"
                      required
                      maxLength={254}
                    />
                  </label>
                  <label className="field">
                    Contact number
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={user.phone ?? ""}
                      autoComplete="tel"
                      maxLength={32}
                      placeholder="+92 300 1234567"
                    />
                  </label>
                  <label className="field">
                    Job title
                    <input
                      name="jobTitle"
                      defaultValue={user.jobTitle ?? ""}
                      autoComplete="organization-title"
                      maxLength={80}
                      placeholder="Designer, student, founder…"
                    />
                  </label>
                  <label className="field">
                    Location
                    <input
                      name="location"
                      defaultValue={user.location ?? ""}
                      maxLength={100}
                      placeholder="City, country"
                    />
                  </label>
                </div>
                <label className="field">
                  About you
                  <textarea
                    name="bio"
                    defaultValue={user.bio ?? ""}
                    rows={4}
                    maxLength={500}
                    placeholder="A little about yourself…"
                  />
                  <small>Up to 500 characters.</small>
                </label>
                <label className="field">
                  Current password (only to change email)
                  <PasswordInput
                    name="currentPassword"

                    autoComplete="current-password"
                    maxLength={128}
                  />
                  <small>
                    Changing your email signs out existing sessions and requires verification of the
                    new address.
                  </small>
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </Button>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
