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

async function loadTask(page: Page, title: string, detail?: string) {
  await page.getByLabel("Título de la tarea").fill(title);
  if (detail) await page.getByLabel("Detalle (opcional)").fill(detail);
  await page.getByRole("button", { name: "Empezar votación" }).click();
}

const card = (page: Page, value: string) =>
  page.getByRole("button", { name: `Carta ${value}`, exact: true });
const counter = (page: Page) => page.getByRole("status", { name: "Votos" });
const taskTitle = (page: Page, title: string) => page.getByRole("heading", { name: title });

test.describe("votación", () => {
  test("RF-01/RF-02: el moderador carga una tarea y los demás la ven en 2 s o menos", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-tarea"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");

    await loadTask(ana, "Login con Google", "PP-12");
    await expect(taskTitle(ana, "Login con Google")).toBeVisible();
    await expect(taskTitle(beto, "Login con Google")).toBeVisible({ timeout: 2_000 });
    await expect(beto.getByText("PP-12")).toBeVisible();
  });

  test("RF-01: valida el título de la tarea", async ({ page }) => {
    await createRoomViaUi(page, testRoomName("e2e-tarea-valida"), "Ana");
    await loadTask(page, "ab");
    await expect(page.getByText("El título debe tener entre 3 y 100 caracteres")).toBeVisible();
  });

  test("RF-09/RF-12: sin tarea no se vota y los jugadores no tienen controles de tarea", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-sin-tarea"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");

    await expect(beto.getByText("Esperando a que el moderador cargue una tarea")).toBeVisible();
    await expect(card(beto, "5")).toBeDisabled();
    await expect(beto.getByRole("button", { name: "Empezar votación" })).toHaveCount(0);
    await expect(beto.getByLabel("Título de la tarea")).toHaveCount(0);
  });

  test("RF-03/RF-04/RF-07: elegir, cambiar, quitar y recordar la carta al recargar", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-cartas"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");
    await loadTask(ana, "Login con Google");
    await expect(taskTitle(beto, "Login con Google")).toBeVisible();

    await card(beto, "5").click();
    await expect(card(beto, "5")).toHaveAttribute("aria-pressed", "true");
    await card(beto, "8").click();
    await expect(card(beto, "8")).toHaveAttribute("aria-pressed", "true");
    await expect(card(beto, "5")).toHaveAttribute("aria-pressed", "false");
    await card(beto, "8").click();
    await expect(card(beto, "8")).toHaveAttribute("aria-pressed", "false");

    await card(beto, "13").click();
    await expect(card(beto, "13")).toHaveAttribute("aria-pressed", "true");
    await beto.reload();
    await expect(card(beto, "13")).toHaveAttribute("aria-pressed", "true");
  });

  test("RF-06/RF-10: todos ven quién votó y el contador en 2 s o menos; '?' cuenta", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-contador"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");
    const carla = await joinViaUi(browser, url, "Carla");
    await loadTask(ana, "Login con Google");
    await expect(taskTitle(carla, "Login con Google")).toBeVisible();
    await expect(counter(ana)).toHaveText("0 de 3 votaron");

    await card(beto, "5").click();
    await card(carla, "?").click();
    for (const page of [ana, beto, carla]) {
      await expect(counter(page)).toHaveText("2 de 3 votaron", { timeout: 2_000 });
      await expect(participantItem(page, "Beto").getByText("Votó")).toBeVisible();
      await expect(participantItem(page, "Carla").getByText("Votó")).toBeVisible();
      await expect(participantItem(page, "Ana").getByText("Votó")).toHaveCount(0);
    }

    const dani = await joinViaUi(browser, url, "Dani");
    await expect(taskTitle(dani, "Login con Google")).toBeVisible();
    await expect(counter(dani)).toHaveText("2 de 4 votaron");
    await card(dani, "3").click();
    await expect(counter(ana)).toHaveText("3 de 4 votaron", { timeout: 2_000 });
  });

  test("RF-13: editar la tarea conserva los votos y los demás ven el cambio en 2 s o menos", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-editar"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");
    await loadTask(ana, "Lgoin con Google");
    await expect(taskTitle(beto, "Lgoin con Google")).toBeVisible();
    await card(beto, "5").click();
    await expect(counter(ana)).toHaveText("1 de 2 votaron");

    await ana.getByRole("button", { name: "Editar tarea" }).click();
    await ana.getByLabel("Título de la tarea").fill("Login con Google");
    await ana.getByRole("button", { name: "Guardar" }).click();

    await expect(taskTitle(beto, "Login con Google")).toBeVisible({ timeout: 2_000 });
    await expect(counter(beto)).toHaveText("1 de 2 votaron");
    await expect(card(beto, "5")).toHaveAttribute("aria-pressed", "true");
  });

  test("RF-08: una nueva tarea con votos pide confirmación y deja la ronda vacía", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-nueva"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto");
    await loadTask(ana, "Login con Google");
    await expect(taskTitle(beto, "Login con Google")).toBeVisible();
    await card(beto, "5").click();
    await expect(counter(ana)).toHaveText("1 de 2 votaron");

    await ana.getByRole("button", { name: "Nueva tarea" }).click();
    await loadTask(ana, "Logout");
    const dialog = ana.getByRole("alertdialog");
    await expect(dialog).toContainText("Se perderán los votos de esta ronda");
    await dialog.getByRole("button", { name: "Sí, nueva tarea" }).click();

    await expect(taskTitle(beto, "Logout")).toBeVisible({ timeout: 2_000 });
    await expect(counter(beto)).toHaveText("0 de 2 votaron");
    await expect(card(beto, "5")).toHaveAttribute("aria-pressed", "false");
  });

  test("RF-14: sin moderador se puede votar la tarea actual pero no tocarla", async ({
    browser,
  }) => {
    const ana = await browser.newPage();
    const url = await createRoomViaUi(ana, testRoomName("e2e-sin-moderador"), "Ana");
    const beto = await joinViaUi(browser, url, "Beto", (page) => page.clock.install());
    await loadTask(ana, "Login con Google");
    await expect(taskTitle(beto, "Login con Google")).toBeVisible();

    await ana.goto("about:blank");
    await ana.close();
    await expect(
      participantItem(beto, "Ana").getByText("Desconectado", { exact: true }),
    ).toBeAttached({
      timeout: 2_000,
    });
    await beto.clock.runFor("02:01");
    await expect(beto.getByText("Esta sala no tiene moderador")).toBeVisible();
    await expect(beto.getByRole("button", { name: "Editar tarea" })).toHaveCount(0);
    await card(beto, "8").click();
    await expect(card(beto, "8")).toHaveAttribute("aria-pressed", "true");
  });
});
