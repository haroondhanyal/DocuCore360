import type { SessionUser } from "@/lib/api";
export function ProfileAvatar({ user, large = false }: { user: SessionUser; large?: boolean }) {
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`profile-avatar${large ? " profile-avatar-large" : ""}`}>
      {user.avatarUpdatedAt ? (
        // Authenticated photo requests must use the browser's cookies, not an image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/account/avatar?user=${encodeURIComponent(user.id)}&v=${encodeURIComponent(user.avatarUpdatedAt)}`}
          alt={`${user.name}'s profile photo`}
          width={large ? 96 : 36}
          height={large ? 96 : 36}
        />
      ) : (
        <span aria-label={`${user.name}'s initials`}>{initials || "U"}</span>
      )}
    </span>
  );
}
