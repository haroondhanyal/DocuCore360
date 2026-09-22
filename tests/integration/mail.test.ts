import { test, expect, vi } from "vitest";
import { createServer, type Socket } from "node:net";
import { deliverAccountMail } from "@/server/services/mail";
test("SMTP adapter delivers only to a local test receiver and reports acceptance", async () => {
  let received = "";
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost test SMTP\r\n");
    let buffer = "",
      data = false;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const pos = buffer.indexOf("\r\n");
        const line = buffer.slice(0, pos);
        buffer = buffer.slice(pos + 2);
        if (data) {
          if (line === ".") {
            data = false;
            socket.write("250 accepted\r\n");
          } else received += line + "\n";
        } else if (/^EHLO|HELO/.test(line)) socket.write("250-localhost\r\n250 SIZE 100000\r\n");
        else if (line === "DATA") {
          data = true;
          socket.write("354 send data\r\n");
        } else if (line === "QUIT") {
          socket.end("221 bye\r\n");
        } else socket.write("250 ok\r\n");
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  vi.stubEnv("SMTP_HOST", "127.0.0.1");
  vi.stubEnv("SMTP_PORT", String(address.port));
  vi.stubEnv("SMTP_FROM", "DocuCore <noreply@example.test>");
  vi.stubEnv("SMTP_USER", "");
  vi.stubEnv("SMTP_SECURE", "false");
  vi.stubEnv("SMTP_ALLOW_INSECURE", "true");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  try {
    expect(
      await deliverAccountMail({
        to: "recipient@example.test",
        purpose: "verify",
        url: "http://localhost:3000/verify-email?token=synthetic-test-token",
      }),
    ).toBe(true);
    expect(received).toContain("Verify your DocuCore 360 email");
    expect(received).toContain("recipient@example.test");
  } finally {
    vi.unstubAllEnvs();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
