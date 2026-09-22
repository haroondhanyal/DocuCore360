import { test, expect } from "@playwright/test";

// Explicit opt-in: this test expects a local Mailpit inbox, never a real provider.
test.skip(process.env.LOCAL_MAIL_TEST !== "1", "Requires the configured local Mailpit setup");
test("verification and password reset deliver usable single-use links to the local inbox", async ({
  page,
  request,
}) => {
  const origin = { origin: "http://localhost:3000" };
  const email = `mail-flow-${crypto.randomUUID()}@example.test`;
  let password = "local-mail-original-password";
  const ids: string[] = [];
  async function received(subject: string) {
    let id = "";
    await expect
      .poll(async () => {
        const data = await (await request.get("http://localhost:8025/api/v1/messages")).json();
        const mail = data.messages.find(
          (m: { ID: string; Subject: string; To: { Address: string }[] }) =>
            m.Subject === subject && m.To.some((t) => t.Address === email),
        );
        id = mail?.ID ?? "";
        return Boolean(id);
      })
      .toBe(true);
    ids.push(id);
    const mail = await (await request.get(`http://localhost:8025/api/v1/message/${id}`)).json();
    const link = mail.Text.match(
      /http:\/\/localhost:3000\/(?:reset-password|verify-email)\?token=[a-f0-9]{64}/,
    )?.[0];
    expect(Boolean(link)).toBe(true);
    return new URL(link);
  }
  const created = await page.request.post("/api/auth/register", {
    headers: origin,
    data: { email, password, name: "Local mail fixture" },
  });
  expect(created.status()).toBe(200);
  try {
    const verifyRequest = await page.request.post("/api/auth/send-verification", {
      headers: origin,
      data: {},
    });
    expect((await verifyRequest.json()).message).toBe("Verification email sent. Check your inbox.");
    const verify = await received("Verify your DocuCore 360 email");
    await page.goto(verify.href);
    await page.getByRole("button", { name: "Verify email", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Email verified.");
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(Boolean(session.user.emailVerifiedAt)).toBe(true);
    expect(
      (
        await page.request.post("/api/auth/verify-email", {
          headers: origin,
          data: { token: verify.searchParams.get("token") },
        })
      ).status(),
    ).toBe(400);

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Request reset link" }).click();
    await expect(page.getByRole("status")).toContainText("Reset request received.");
    const reset = await received("Reset your DocuCore 360 password");
    const unknown = await page.request.post("/api/auth/forgot-password", {
      headers: origin,
      data: { email: `missing-${crypto.randomUUID()}@example.test` },
    });
    expect((await unknown.json()).message).toBe(await page.getByRole("status").textContent());
    await page.goto(reset.href);
    await page.getByLabel("New password", { exact: true }).fill("local-mail-updated-password");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("status")).toContainText("Password updated.");
    const oldPassword = password;
    password = "local-mail-updated-password";
    expect((await (await page.request.get("/api/auth/session")).json()).user).toBeNull();
    expect(
      (
        await page.request.post("/api/auth/login", {
          headers: origin,
          data: { email, password: oldPassword },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post("/api/auth/login", { headers: origin, data: { email, password } })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.post("/api/auth/reset-password", {
          headers: origin,
          data: { token: reset.searchParams.get("token"), password },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await page.request.post("/api/auth/login", { headers: origin, data: { email, password } });
    await page.request.delete("/api/account", { headers: origin, data: { password } });
    if (ids.length)
      await request.delete("http://localhost:8025/api/v1/messages", { data: { IDs: ids } });
  }
});
