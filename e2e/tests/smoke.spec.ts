import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("loads app, sign-in page, sign in as supervisor, dashboard renders", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Amazon Connect Insights/i })).toBeVisible();
    await expect(page.getByText(/Sign in to access/)).toBeVisible();

    await page.getByRole("tab", { name: /Supervisor/i }).click();
    await page.getByRole("button", { name: /Ada/ }).first().click();

    await expect(page).toHaveURL(/\/supervisor/);
    await expect(page.getByText(/Overview/i)).toBeVisible();
  });
});
