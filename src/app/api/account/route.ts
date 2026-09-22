import { sharedRateLimit } from "@/server/services/shared-rate-limit";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser, logout } from "@/server/services/auth";
import { apiError, HttpError, sameOrigin, jsonBody } from "@/server/http";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { storage } from "@/server/storage/local";
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    await sharedRateLimit(`profile:${user.id}`, 20);
    const input = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase().trim())
          .optional(),
        phone: z
          .string()
          .trim()
          .max(32)
          .refine((v) => !v || /^[+0-9(). -]{7,32}$/.test(v), "Enter a valid contact number.")
          .optional(),
        bio: z.string().trim().max(500).optional(),
        location: z.string().trim().max(100).optional(),
        jobTitle: z.string().trim().max(80).optional(),
        name: z.string().trim().min(2).max(80).optional(),
        currentPassword: z.string().max(128).optional(),
        newPassword: z.string().min(10).max(128).optional(),
        theme: z.enum(["light", "dark", "system"]).optional(),
      })
      .parse(await jsonBody(request));
    const emailChanged = Boolean(input.email && input.email !== user.email);
    if (input.newPassword || emailChanged) {
      const account = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      if (
        !input.currentPassword ||
        !(await verifyPassword(input.currentPassword, account.passwordHash))
      )
        throw new HttpError(400, "Current password is incorrect.");
    }
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(emailChanged ? { email: input.email, emailVerifiedAt: null } : {}),
          ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
          ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
          ...(input.location !== undefined ? { location: input.location || null } : {}),
          ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
          ...(input.newPassword ? { passwordHash: await hashPassword(input.newPassword) } : {}),
        },
      });
      if (input.theme)
        await tx.userPreference.upsert({
          where: { userId: user.id },
          create: { userId: user.id, theme: input.theme },
          update: { theme: input.theme },
        });
      if (input.newPassword || emailChanged) {
        await tx.accountSession.deleteMany({ where: { userId: user.id } });
        await tx.authToken.deleteMany({ where: { userId: user.id } });
      }
      await tx.auditLog.create({ data: { userId: user.id, action: "ACCOUNT_CHANGE" } });
    });
    return NextResponse.json({
      ok: true,
      requiresLogin: Boolean(input.newPassword || emailChanged),
      message: emailChanged
        ? "Email changed. Sign in with your new address and verify it from your profile."
        : input.newPassword
          ? "Password changed. Please sign in again."
          : "Profile and preferences saved.",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return apiError(new HttpError(409, "That email address is already in use."));
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const input = z.object({ password: z.string().max(128) }).parse(await jsonBody(request));
    const account = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(input.password, account.passwordHash)))
      throw new HttpError(400, "Password is incorrect.");
    if (account.avatarPath) await storage.remove(account.avatarPath);
    const drafts = await db.editorDraft.findMany({ where: { userId: user.id } });
    for (const draft of drafts) await storage.remove(draft.storagePath);
    const files = await db.fileAsset.findMany({ where: { userId: user.id } });
    const versions = await db.fileVersion.findMany({ where: { file: { userId: user.id } } });
    for (const version of versions) await storage.remove(version.storagePath);
    for (const file of files) await storage.remove(file.storagePath);
    await db.processingJob.deleteMany({ where: { userId: user.id } });
    await logout();
    await db.user.delete({ where: { id: user.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
