import { expect, type Page } from "@playwright/test";

// Crea una sala desde la página de inicio y devuelve su URL
export async function createRoomViaUi(
  page: Page,
  roomName: string,
  nickname: string,
): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Nombre de la sala").fill(roomName);
  await page.getByLabel("Tu apodo").fill(nickname);
  await page.getByRole("button", { name: "Crear sala" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{12}$/);
  return page.url();
}

export function participantList(page: Page) {
  return page.getByRole("list", { name: "Participantes" });
}

export function participantItem(page: Page, nickname: string) {
  return participantList(page).getByRole("listitem").filter({ hasText: nickname });
}
