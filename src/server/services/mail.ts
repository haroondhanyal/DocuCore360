import nodemailer from "nodemailer";
export interface AccountMail {
  to: string;
  purpose: "reset" | "verify";
  url: string;
}
export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}
export function accountMessage(mail: AccountMail) {
  const base = new URL(process.env.APP_URL ?? "http://localhost:3000");
  const link = new URL(mail.url);
  if (link.origin !== base.origin || !["/reset-password", "/verify-email"].includes(link.pathname))
    throw new Error("Invalid account link.");
  const reset = mail.purpose === "reset";
  return {
    from: process.env.SMTP_FROM,
    to: mail.to,
    subject: reset ? "Reset your DocuCore 360 password" : "Verify your DocuCore 360 email",
    text: `${reset ? "Reset your password" : "Verify your email"} using this single-use link:\n\n${link.href}\n\nIf you did not request this, ignore this message. Do not share this link.`,
  };
}
export async function deliverAccountMail(mail: AccountMail): Promise<boolean> {
  if (!mailConfigured()) return false;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && process.env.SMTP_ALLOW_INSECURE !== "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  try {
    const result = await transport.sendMail(accountMessage(mail));
    return result.accepted.some(
      (address) => String(address).toLowerCase() === mail.to.toLowerCase(),
    );
  } catch {
    return false;
  } finally {
    transport.close();
  }
}
