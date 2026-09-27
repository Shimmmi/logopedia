import { test, expect } from "@playwright/test";

test.use({ timezoneId: "Asia/Novosibirsk" });

test("schedule range request uses ISO dates and shows 07.09 in week 7–13", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "Нужны E2E_EMAIL и E2E_PASSWORD");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByRole("textbox", { name: "Пароль" }).fill(password!);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/dashboard|schedule|change-password/);

  const seen: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/schedule?")) seen.push(req.url());
  });
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Неделя" }).click();
  await expect.poll(() => seen.length).toBeGreaterThan(0);
  const url = new URL(seen[seen.length - 1]);
  const from = url.searchParams.get("from") || "";
  expect(from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(Number.isNaN(new Date(from).getTime())).toBeFalsy();

  const title = `E2E 7 сент ${Date.now()}`;
  const created = await page.request.post("/api/schedule", {
    data: {
      title,
      startAt: "2026-09-07T03:00:00.000Z",
      endAt: "2026-09-07T03:40:00.000Z",
      type: "DIAGNOSTICS",
      tz: "Asia/Novosibirsk",
    },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  const eventId = body.event?.id as string | undefined;

  try {
    const range = await page.request.get(
      "/api/schedule?from=2026-09-06T17:00:00.000Z&to=2026-09-13T17:00:00.000Z",
    );
    expect(range.ok()).toBeTruthy();
    const data = await range.json();
    const titles = (data.events || []).map((e: { title?: string }) => e.title);
    expect(titles).toContain(title);
  } finally {
    if (eventId) await page.request.delete(`/api/schedule/${eventId}`);
  }
});
