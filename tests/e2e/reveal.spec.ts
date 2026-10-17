import { type Browser, expect, type Page, test } from "@playwright/test";
import { testRoomName } from "../helpers/test-data";
import { createRoomViaUi, participantItem } from "./helpers";

async function joinViaUi(
  browser: Browser,
  url: string,
  nickname: string,
  setup?: (page: Page) => Promise<void>,
) {
  const page = await browser.newPage();
  await setup?.(page);
  await page.goto(url);
  await page.getByLabel("Tu apodo").fill(nickname);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(participantItem(page, nickname)).toBeVisible();
  return page;
}

async function loadTask(page: Page, title: string) {
  await page.getByLabel("Título de la tarea").fill(title);
  await page.getByRole("button", { name: "Empezar votación" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

const card = (page: Page, value: string) =>
  page.getByRole("button", { name: `Carta ${value}`, exact: true });
const revealButton = (page: Page) => page.getByRole("button", { name: "Revelar cartas" });
const revealedItem = (page: Page, nickname: string) =>
  page
    .getByRole("list", { name: "Cartas reveladas" })
    .getByRole("listitem")
    .filter({ hasText: nickname });
const counter = (page: Page) => page.getByRole("status", { name: "Votos" });

// Sala con Ana (moderadora) y los jugadores indicados, con la tarea cargada
async function roomWithTask(browser: Browser, label: string, players: string[]) {
  const ana = await browser.newPage();
  const url = await createRoomViaUi(ana, testRoomName(label), "Ana");
  const others: Page[] = [];
  for (const nickname of players) others.push(await joinViaUi(browser, url, nickname));
  await loadTask(ana, "Login con Google");
  for (const page of others)
    await expect(page.getByRole("heading", { name: "Login con Google" })).toBeVisible();
  return { ana, url, others };
}

test.describe("revelar", () => {
  test("RF-01: sin votos, 'Revelar cartas' está desactivado", async ({ browser }) => {
    const { ana } = await roomWithTask(browser, "e2e-revelar-sin-votos", []);
    await expect(revealButton(ana)).toBeDisabled();
    await expect(ana.getByText("Nadie votó todavía")).toBeVisible();
  });

  test("RF-01 a RF-05: todos ven las cartas en 2 s o menos, con promedio, mínimo y máximo", async ({
    browser,
  }) => {
    const { ana, others } = await roomWithTask(browser, "e2e-revelar", ["Beto", "Carla"]);
    const [beto, carla] = others as [Page, Page];
    await card(ana, "5").click();
    await card(beto, "8").click();
    await expect(counter(ana)).toHaveText("2 de 3 votaron");

    await revealButton(ana).click();
    for (const page of [ana, beto, carla]) {
      await expect(revealedItem(page, "Beto")).toContainText("8", { timeout: 2_000 });
      await expect(revealedItem(page, "Ana")).toContainText("5");
      await expect(revealedItem(page, "Carla")).toContainText("No votó");
      await expect(page.getByText("Promedio: 6,5")).toBeVisible();
      await expect(page.getByText("Mínimo: 5")).toBeVisible();
      await expect(page.getByText("Máximo: 8")).toBeVisible();
      // RF-02: la ronda revelada queda cerrada; la baraja de votación no se muestra (plan v1.1)
      await expect(page.getByRole("group", { name: "Cartas" })).toHaveCount(0);
    }
  });

  test("RF-06: con dos votos iguales se indica consenso", async ({ browser }) => {
    const { ana, others } = await roomWithTask(browser, "e2e-consenso", ["Beto"]);
    const [beto] = others as [Page];
    await card(ana, "8").click();
    await card(beto, "8").click();
    await expect(counter(ana)).toHaveText("2 de 2 votaron");
    await revealButton(ana).click();
    await expect(beto.getByText("¡Consenso!")).toBeVisible({ timeout: 2_000 });
  });

  test("RF-10/RF-03: quien entra después de revelar ve la ronda sin aparecer en ella", async ({
    browser,
  }) => {
    const { ana, url, others } = await roomWithTask(browser, "e2e-entra-despues", ["Beto"]);
    const [beto] = others as [Page];
    await card(beto, "5").click();
    await expect(counter(ana)).toHaveText("1 de 2 votaron");
    await revealButton(ana).click();
    await expect(revealedItem(ana, "Beto")).toContainText("5");

    const dani = await joinViaUi(browser, url, "Dani");
    await expect(revealedItem(dani, "Beto")).toContainText("5");
    await expect(revealedItem(dani, "Dani")).toHaveCount(0);
    await expect(dani.getByText("Solo votó 1 persona")).toBeVisible();
  });

  test("RF-07: el moderador fija la estimación sugerida y los demás la ven en 2 s o menos", async ({
    browser,
  }) => {
    const { ana, others } = await roomWithTask(browser, "e2e-estimar", ["Beto"]);
    const [beto] = others as [Page];
    await card(ana, "3").click();
    await card(beto, "8").click();
    await expect(counter(ana)).toHaveText("2 de 2 votaron");
    await revealButton(ana).click();

    // Promedio 5,5: la más cercana es 5
    await expect(ana.getByRole("button", { name: "Estimar 5 (sugerida)" })).toBeVisible();
    await expect(beto.getByRole("button", { name: /^Estimar/ })).toHaveCount(0);
    await ana.getByRole("button", { name: "Estimar 8", exact: true }).click();
    await expect(beto.getByText("Estimación final: 8")).toBeVisible({ timeout: 2_000 });
  });

  test("RF-08: volver a votar deja la misma tarea a cero; con estimación pide confirmación", async ({
    browser,
  }) => {
    const { ana, others } = await roomWithTask(browser, "e2e-volver", ["Beto"]);
    const [beto] = others as [Page];
    await card(beto, "5").click();
    await expect(counter(ana)).toHaveText("1 de 2 votaron");
    await revealButton(ana).click();
    await expect(revealedItem(beto, "Beto")).toContainText("5");

    // Sin estimación: no pregunta
    await ana.getByRole("button", { name: "Volver a votar" }).click();
    await expect(counter(beto)).toHaveText("0 de 2 votaron", { timeout: 2_000 });
    await expect(beto.getByRole("heading", { name: "Login con Google" })).toBeVisible();
    await expect(card(beto, "5")).toBeEnabled();

    // Con estimación: pide confirmar
    await card(beto, "8").click();
    await expect(counter(ana)).toHaveText("1 de 2 votaron");
    await revealButton(ana).click();
    await ana.getByRole("button", { name: /^Estimar 8/ }).click();
    await expect(ana.getByText("Estimación final: 8")).toBeVisible();
    await ana.getByRole("button", { name: "Volver a votar" }).click();
    const dialog = ana.getByRole("alertdialog");
    await expect(dialog).toContainText("Se borrará la estimación final: 8");
    await dialog.getByRole("button", { name: "Sí, volver a votar" }).click();
    await expect(counter(beto)).toHaveText("0 de 2 votaron", { timeout: 2_000 });
    await expect(beto.getByText("Estimación final: 8")).toHaveCount(0);
  });

  test("RF-09: tras revelar, una nueva tarea no pide confirmación", async ({ browser }) => {
    const { ana, others } = await roomWithTask(browser, "e2e-nueva-tras-revelar", ["Beto"]);
    const [beto] = others as [Page];
    await card(beto, "5").click();
    await expect(counter(ana)).toHaveText("1 de 2 votaron");
    await revealButton(ana).click();
    await expect(revealedItem(ana, "Beto")).toContainText("5");

    await ana.getByRole("button", { name: "Nueva tarea" }).click();
    await ana.getByLabel("Título de la tarea").fill("Logout");
    await ana.getByRole("button", { name: "Empezar votación" }).click();
    await expect(ana.getByRole("alertdialog")).toHaveCount(0);
    await expect(beto.getByRole("heading", { name: "Logout" })).toBeVisible({ timeout: 2_000 });
    await expect(counter(beto)).toHaveText("0 de 2 votaron");
  });

  test("RF-13: sin moderador no hay opciones de revelar ni de volver a votar", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-revelar-sin-moderador"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto", (page) => page.clock.install());
    await loadTask(ana, "Login con Google");
    await card(beto, "5").click();
    await expect(counter(ana)).toHaveText("1 de 2 votaron");
    await revealButton(ana).click();
    await expect(revealedItem(beto, "Beto")).toContainText("5");

    await ana.goto("about:blank");
    await ana.close();
    await expect(
      participantItem(beto, "Ana").getByText("Desconectado", { exact: true }),
    ).toBeAttached({
      timeout: 2_000,
    });
    await beto.clock.runFor("02:01");
    await expect(beto.getByText("Esta sala no tiene moderador")).toBeVisible();
    await expect(revealButton(beto)).toHaveCount(0);
    await expect(beto.getByRole("button", { name: "Volver a votar" })).toHaveCount(0);
    await expect(beto.getByRole("button", { name: /^Estimar/ })).toHaveCount(0);
  });
});
