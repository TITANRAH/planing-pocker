import { devices, expect, type Locator, test } from "@playwright/test";
import { testRoomName } from "../helpers/test-data";
import { createRoomViaUi } from "./helpers";

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("El elemento no tiene caja visible");
  return b;
}

test.describe("móvil", () => {
  test("RF-02: con un nombre largo, el título y el botón Copiar link caben en la tarjeta", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // 14 caracteres de prefijo + 36 = 50, el máximo, sin espacios para partir
    const roomName = testRoomName("salaconnombremuylargosinespacios1234");
    expect(roomName.length).toBe(50);
    const url = await createRoomViaUi(page, roomName, "Ana");

    await expect(page.getByRole("heading", { name: roomName })).toBeVisible();
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Sin viewport");
    const card = await box(page.locator('[data-slot="card"]').first());
    const title = await box(page.getByRole("heading", { name: roomName }));
    const copy = page.getByRole("button", { name: "Copiar link" });
    const button = await box(copy);

    for (const inner of [title, button]) {
      expect(inner.x).toBeGreaterThanOrEqual(card.x);
      expect(inner.x + inner.width).toBeLessThanOrEqual(card.x + card.width);
      expect(inner.x + inner.width).toBeLessThanOrEqual(viewport.width);
    }
    await expect(copy).toContainText("Copiar link");
    await copy.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  });
});
