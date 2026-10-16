import { expect, test } from "@playwright/test";

test("la página de inicio responde", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Planning Poker" })).toBeVisible();
});
