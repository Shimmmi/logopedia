import { test, expect } from "@playwright/test";

test("a11y cookie applies classes before paint", async ({ page }) => {
  await page.context().addCookies([
    { name: "a11y", value: "lg,hc,rm", url: process.env.E2E_BASE_URL || "https://logoped.site" },
  ]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/a11y-lg/);
  await expect(page.locator("html")).toHaveClass(/contrast/);
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);
});
