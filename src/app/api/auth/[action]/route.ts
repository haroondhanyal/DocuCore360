import { sharedRateLimit } from "@/server/services/shared-rate-limit";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { apiError, HttpError, sameOrigin, jsonBody } from "@/server/http";
import {
  createSession,
  currentUser,
  logout,
  publicUser,
  requireUser,
} from "@/server/services/auth";
import { hashPassword, verifyPassword, tokenHash } from "@/lib/security/password";
import { deliverAccountMail, mailConfigured } from "@/server/services/mail";
const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase().trim());
const password = z.string().min(10, "Use at least 10 characters for your password.").max(128);
type Context = { params: Promise<{ action: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    if ((await context.params).action !== "session") throw new HttpError(404, "Not found.");
    return NextResponse.json(
      { user: await currentUser() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { action } = await context.params;
    // Global endpoint budget prevents untrusted proxy headers from bypassing limits.
    await sharedRateLimit(`auth:${action}`, 60);
    if (action === "logout") {
      await logout();
      return NextResponse.json({ ok: true });
    }
    const body = await jsonBody(request);
    if (action === "register" || action === "login") {
      const input = z
        .object({
          email,
          password,
          name: z.string().trim().min(2).max(80).optional(),
          remember: z.boolean().optional(),
        })
        .parse(body);
      await sharedRateLimit(`account:${input.email}`, 10);
      let user = await db.user.findUnique({ where: { email: input.email } });
      if (action === "register") {
        if (user) throw new HttpError(409, "An account with this email already exists.");
        if (!input.name) throw new HttpError(400, "Your name is required.");
        user = await db.user.create({
          data: {
            email: input.email,
            name: input.name,
            username: `${
              input.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
                .slice(0, 24) || "user"
            }_${randomBytes(6).toString("hex")}`,
            passwordHash: await hashPassword(input.password),
            preference: { create: {} },
            subscription: { create: {} },
          },
        });
      } else {
        const hash = user?.passwordHash ?? (await hashPassword("dummy-password-for-timing"));
        if (!(await verifyPassword(input.password, hash)) || !user)
          throw new HttpError(401, "Email or password is incorrect.");
      }
      await createSession(user.id, Boolean(input.remember));
      await db.auditLog.create({
        data: { userId: user.id, action: action === "register" ? "ACCOUNT_CREATE" : "LOGIN" },
      });
      return NextResponse.json({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    }
    if (action === "forgot-password" || action === "send-verification") {
      let delivered = false;
      const target =
        action === "send-verification"
          ? await requireUser()
          : await db.user.findUnique({
              where: { email: z.object({ email }).parse(body).email },
              select: publicUser,
            });
      if (target) {
        const raw = randomBytes(32).toString("hex");
        const purpose = action === "forgot-password" ? "RESET_PASSWORD" : "VERIFY_EMAIL";
        await db.authToken.deleteMany({ where: { userId: target.id, purpose } });
        await db.authToken.create({
          data: {
            userId: target.id,
            tokenHash: tokenHash(raw),
            purpose,
            expiresAt: new Date(Date.now() + 30 * 60_000),
          },
        });
        const url = `${process.env.APP_URL ?? "http://localhost:3000"}/${purpose === "RESET_PASSWORD" ? "reset-password" : "verify-email"}?token=${raw}`;
        delivered = await deliverAccountMail({
          to: target.email,
          purpose: purpose === "RESET_PASSWORD" ? "reset" : "verify",
          url,
        });
        if (!delivered) await db.authToken.deleteMany({ where: { tokenHash: tokenHash(raw) } });
      }
      if (!mailConfigured())
        return NextResponse.json({
          message: "Email delivery is not configured. Contact the application administrator.",
        });
      if (action === "send-verification" && !delivered)
        throw new HttpError(
          503,
          "Verification email could not be delivered. Please try again later.",
        );
      return NextResponse.json({
        message:
          action === "send-verification"
            ? "Verification email sent. Check your inbox."
            : "Reset request received. If the address is registered, check your inbox for a reset link.",
      });
    }
    if (action === "reset-password" || action === "verify-email") {
      const input = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: password.optional() })
        .parse(body);
      if (action === "reset-password" && !input.password)
        throw new HttpError(400, "A new password is required.");
      const purpose = action === "reset-password" ? "RESET_PASSWORD" : "VERIFY_EMAIL";
      const updatedHash = input.password ? await hashPassword(input.password) : undefined;
      await db.$transaction(async (tx) => {
        const token = await tx.authToken.findUnique({
          where: { tokenHash: tokenHash(input.token) },
        });
        if (!token || token.purpose !== purpose || token.expiresAt <= new Date())
          throw new HttpError(400, "This link is invalid or expired.");
        const consumed = await tx.authToken.deleteMany({ where: { id: token.id } });
        if (!consumed.count) throw new HttpError(400, "This link has already been used.");
        await tx.user.update({
          where: { id: token.userId },
          data:
            purpose === "RESET_PASSWORD"
              ? { passwordHash: updatedHash }
              : { emailVerifiedAt: new Date() },
        });
        if (purpose === "RESET_PASSWORD")
          await tx.accountSession.deleteMany({ where: { userId: token.userId } });
      });
      return NextResponse.json({
        message:
          purpose === "RESET_PASSWORD"
            ? "Password updated. You can now sign in."
            : "Email verified.",
      });
    }
    throw new HttpError(404, "Not found.");
  } catch (error) {
    return apiError(error);
  }
}
