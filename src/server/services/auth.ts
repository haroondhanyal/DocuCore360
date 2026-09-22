import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { HttpError } from "@/server/http";
import { tokenHash } from "@/lib/security/password";
export const publicUser = {
  id: true,
  name: true,
  username: true,
  sidebarLabel: true,
  email: true,
  role: true,
  phone: true,
  bio: true,
  location: true,
  jobTitle: true,
  avatarUpdatedAt: true,
  disabled: true,
  emailVerifiedAt: true,
  preference: {
    select: { theme: true, accent: true, buttonColor: true, contrast: true, colorfulHeader: true },
  },
} as const;
export async function currentUser() {
  const token = (await cookies()).get("docucore-session")?.value;
  if (!token) return null;
  const session = await db.accountSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { select: publicUser } },
  });
  return session && !session.user.disabled && session.expiresAt > new Date() ? session.user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to access your workspace.");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError(403, "Administrator access required.");
  return user;
}
export async function createSession(userId: string, remember: boolean) {
  const account = await db.user.findUnique({ where: { id: userId }, select: { disabled: true } });
  if (!account || account.disabled) throw new HttpError(403, "This account is disabled.");
  const token = randomBytes(32).toString("hex");
  const seconds = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  await db.accountSession.create({
    data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + seconds * 1000) },
  });
  (await cookies()).set("docucore-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: seconds } : {}),
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get("docucore-session")?.value;
  if (token) {
    const hash = tokenHash(token);
    const session = await db.accountSession.findUnique({ where: { tokenHash: hash } });
    await db.accountSession.deleteMany({ where: { tokenHash: hash } });
    if (session) await db.auditLog.create({ data: { userId: session.userId, action: "LOGOUT" } });
  }
  jar.delete("docucore-session");
}
