import { expect, test } from "@playwright/test";
import { testRoomName } from "../helpers/test-data";
import { createRoomViaUi, participantItem } from "./helpers";

test.describe("crear sala", () => {
  test("RF-01: quien crea la sala entra en ella y aparece como moderador", async ({ page }) => {
    const roomName = testRoomName("e2e-crear");
    await createRoomViaUi(page, roomName, "Ana");

    await expect(page.getByRole("heading", { name: roomName })).toBeVisible();
    const ana = participantItem(page, "Ana");
    await expect(ana).toBeVisible();
    await expect(ana.getByText("Moderador")).toBeVisible();
  });

  test("RF-01: muestra los errores de validación en los campos y no crea la sala", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Nombre de la sala").fill("ab");
    await page.getByLabel("Tu apodo").fill("A");
    await page.getByRole("button", { name: "Crear sala" }).click();

    await expect(page.getByText("El nombre debe tener entre 3 y 50 caracteres")).toBeVisible();
    await expect(page.getByText("El apodo debe tener entre 2 y 20 caracteres")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("RF-02: muestra el link de la sala y lo copia con un clic", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const url = await createRoomViaUi(page, testRoomName("e2e-copiar"), "Ana");

    await expect(page.getByText(url)).toBeVisible();
    await page.getByRole("button", { name: "Copiar link" }).click();
    await expect(page.getByText("Link copiado")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  });
});
