import "dotenv/config";
import { db } from "../src/server/db";
import { hashPassword } from "../src/lib/security/password";
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log(
      "Seed ready. No admin created: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to opt in.",
    );
    return;
  }
  if (password.length < 14)
    throw new Error("Admin seed password must contain at least 14 characters.");
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Administrator",
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      preference: { create: {} },
      subscription: { create: {} },
    },
  });
  console.log("Administrator seed completed.");
}
main()
  .catch(() => {
    console.error("Seed failed. Check environment configuration.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
