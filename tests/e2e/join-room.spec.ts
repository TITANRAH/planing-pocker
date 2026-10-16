import { expect, test } from "@playwright/test";
import { db } from "@/server/db";
import { testRoomName } from "../helpers/test-data";
import { createRoomViaUi, participantItem } from "./helpers";

const roomIdFrom = (url: string) => url.split("/r/")[1] ?? "";

test.describe("unirse a una sala", () => {
  test("RF-07: un link de una sala inexistente muestra el aviso y permite crear una nueva", async ({
    page,
  }) => {
    await page.goto("/r/NoExiste_123");
    await expect(page.getByText("Esta sala no existe")).toBeVisible();
    await page.getByRole("link", { name: "Crear una sala nueva" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("RF-07: un link con formato inválido también muestra que la sala no existe", async ({
    page,
  }) => {
    await page.goto("/r/abc");
    await expect(page.getByText("Esta sala no existe")).toBeVisible();
  });

  test("RF-04/RF-05: un jugador entra con su apodo y otro no puede repetirlo", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-unirse"), "Ana");

    const beto = await browser.newPage();
    await beto.goto(url);
    await beto.getByLabel("Tu apodo").fill("Beto");
    await beto.getByRole("button", { name: "Entrar" }).click();
    await expect(participantItem(beto, "Beto")).toBeVisible();
    await expect(participantItem(beto, "Ana")).toBeVisible();

    const otro = await browser.newPage();
    await otro.goto(url);
    await otro.getByLabel("Tu apodo").fill("  beto ");
    await otro.getByRole("button", { name: "Entrar" }).click();
    await expect(otro.getByText("Ese apodo ya está en uso")).toBeVisible();
    await expect(otro.getByLabel("Tu apodo")).toBeVisible();
  });

  test("RF-04: el formulario para entrar valida el apodo", async ({ browser }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-unirse-valida"), "Ana");

    const otro = await browser.newPage();
    await otro.goto(url);
    await otro.getByLabel("Tu apodo").fill("B");
    await otro.getByRole("button", { name: "Entrar" }).click();
    await expect(otro.getByText("El apodo debe tener entre 2 y 20 caracteres")).toBeVisible();
  });

  test("RF-06: con 15 participantes, quien llega ve que la sala está llena", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-llena"), "Ana");
    const roomId = roomIdFrom(url);
    await db.participant.createMany({
      data: Array.from({ length: 14 }, (_, i) => ({
        roomId,
        nickname: `Jugador ${i + 2}`,
        nicknameKey: `jugador ${i + 2}`,
        role: "PLAYER" as const,
        tokenHash: `e2e-hash-${roomId}-${i}`,
        lastSeenAt: new Date(),
      })),
    });

    const otro = await browser.newPage();
    await otro.goto(url);
    await expect(otro.getByText("La sala está llena (15/15)")).toBeVisible();
    await expect(otro.getByLabel("Tu apodo")).toHaveCount(0);
  });
});
