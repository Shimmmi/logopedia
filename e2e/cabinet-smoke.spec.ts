import { test, expect } from "@playwright/test";

test("logo on landing returns home", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByRole("link", { name: "LogoPed — на главную" }).first().click();
  await expect(page).toHaveURL(/\/$|logoped\.site\/?$/);
});

test("auth pages have logo and password toggle", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "LogoPed — на главную" })).toBeVisible();
  await page.getByRole("textbox", { name: "Пароль" }).fill("secret12");
  await page.getByRole("button", { name: "Показать пароль" }).click();
  await expect(page.getByRole("textbox", { name: "Пароль" })).toHaveAttribute("type", "text");
});
