import { test, expect } from "@playwright/test";

test("public pages render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Картотека, расписание/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "LogoPed — на главную" }).first()).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Создать кабинет" })).toBeVisible();
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Тарифы" })).toBeVisible();
});
