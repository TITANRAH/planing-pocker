import { type Browser, expect, type Page, test } from "@playwright/test";
import { testRoomName } from "../helpers/test-data";
import { createRoomViaUi, participantItem, participantList } from "./helpers";

async function joinViaUi(browser: Browser, url: string, nickname: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByLabel("Tu apodo").fill(nickname);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(participantItem(page, nickname)).toBeVisible();
  return page;
}

// `page.close()` de Playwright no dispara `pagehide` (medido), a diferencia de cerrar una pestaña
// en un navegador real. Para simular el cierre, primero se sale de la página y después se cierra.
async function closeTab(page: Page): Promise<void> {
  await page.goto("about:blank");
  await page.close();
}

const status = (page: Page, nickname: string, text: "Conectado" | "Desconectado") =>
  participantItem(page, nickname).getByText(text, { exact: true });

test.describe("presencia en vivo", () => {
  test("RF-08: quien entra aparece en la lista de los demás en 2 s o menos", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-presencia-entra"), "Ana");
    await expect(status(ana, "Ana", "Conectado")).toBeAttached();

    await joinViaUi(browser, url, "Beto");
    await expect(participantItem(ana, "Beto")).toBeVisible({ timeout: 2_000 });
    await expect(status(ana, "Beto", "Conectado")).toBeAttached();
  });

  test("RF-10: al cerrar la pestaña se lo ve desconectado en 2 s o menos", async ({ browser }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-presencia-cierra"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");
    await expect(status(ana, "Beto", "Conectado")).toBeAttached();

    await closeTab(beto);
    await expect(status(ana, "Beto", "Desconectado")).toBeAttached({ timeout: 2_000 });
  });

  test("RF-10: si pierde la conexión se lo ve desconectado en 30 s o menos", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-presencia-red"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");
    await expect(status(ana, "Beto", "Conectado")).toBeAttached();

    await beto.context().setOffline(true);
    await expect(status(ana, "Beto", "Desconectado")).toBeAttached({ timeout: 30_000 });
  });

  test("RF-10: quien lleva 2 minutos desconectado desaparece de la lista", async ({ browser }) => {
    const ana = await browser.newPage();
    await ana.clock.install();
    const url = await createRoomViaUi(ana, testRoomName("e2e-presencia-retira"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");
    await expect(status(ana, "Beto", "Conectado")).toBeAttached();

    await closeTab(beto);
    await expect(status(ana, "Beto", "Desconectado")).toBeAttached({ timeout: 2_000 });
    await ana.clock.runFor("01:50");
    await expect(participantItem(ana, "Beto")).toBeVisible();
    await ana.clock.runFor("00:11");
    await expect(participantItem(ana, "Beto")).toHaveCount(0);
  });

  test("RF-09/RF-11: al recargar, jugador y moderador vuelven con su apodo y su rol", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-presencia-recarga"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");

    await beto.reload();
    await expect(participantItem(beto, "Beto")).toBeVisible();
    await expect(beto.getByLabel("Tu apodo")).toHaveCount(0);

    await ana.reload();
    await expect(participantItem(ana, "Ana").getByText("Moderador")).toBeVisible();
    await expect(
      participantList(ana).getByRole("listitem").filter({ hasText: "Beto" }),
    ).toHaveCount(1);
  });
});
