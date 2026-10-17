import { readFile } from "node:fs/promises";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { testRoomName } from "../helpers/test-data";
import { createRoomViaUi, participantItem } from "./helpers";

async function joinViaUi(browser: Browser, url: string, nickname: string) {
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByLabel("Tu apodo").fill(nickname);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(participantItem(page, nickname)).toBeVisible();
  return page;
}

const card = (page: Page, value: string) =>
  page.getByRole("button", { name: `Carta ${value}`, exact: true });
const history = (page: Page) => page.getByRole("region", { name: "Historial" });
const historyItem = (page: Page, prefix: string) =>
  history(page).getByRole("button", { name: new RegExp(`^${prefix}`) });

// Ana (moderadora) carga la tarea, ambos votan, revela y fija la estimación
async function estimateViaUi(
  ana: Page,
  beto: Page,
  title: string,
  cards: [string, string],
  estimate: string,
) {
  const newTask = ana.getByRole("button", { name: "Nueva tarea" });
  if (await newTask.isVisible()) await newTask.click();
  await ana.getByLabel("Título de la tarea").fill(title);
  await ana.getByRole("button", { name: "Empezar votación" }).click();
  await expect(beto.getByRole("heading", { name: title })).toBeVisible();
  await card(ana, cards[0]).click();
  await card(beto, cards[1]).click();
  await expect(ana.getByRole("status", { name: "Votos" })).toHaveText("2 de 2 votaron");
  await ana.getByRole("button", { name: "Revelar cartas" }).click();
  await ana.getByRole("button", { name: new RegExp(`^Estimar ${estimate}( |$)`) }).click();
  await expect(ana.getByText(`Estimación final: ${estimate}`)).toBeVisible();
}

async function room(browser: Browser, label: string) {
  const ana = await browser.newPage();
  const url = await createRoomViaUi(ana, testRoomName(label), "Ana");
  const beto = await joinViaUi(browser, url, "Beto");
  return { ana, beto, url };
}

test.describe("historial", () => {
  test("RF-06: sin tareas estimadas se avisa y no se puede exportar", async ({ browser }) => {
    const { beto } = await room(browser, "e2e-hist-vacio");
    await expect(history(beto).getByText("Todavía no hay tareas estimadas")).toBeVisible();
    await expect(history(beto).getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
  });

  test("RF-01/RF-02/RF-09: lista ordenada, resumen y quien llega tarde la ve completa", async ({
    browser,
  }) => {
    const { ana, beto, url } = await room(browser, "e2e-hist-lista");
    await estimateViaUi(ana, beto, "Login", ["5", "5"], "5");
    await estimateViaUi(ana, beto, "Logout", ["3", "2"], "3");

    for (const page of [ana, beto, await joinViaUi(browser, url, "Dani")]) {
      await expect(history(page).getByText("2 tareas · 8 puntos")).toBeVisible();
      const titles = await history(page)
        .getByRole("button", { name: / · \d+ · \d\d:\d\d$/ })
        .allTextContents();
      expect(titles.map((t) => t.split(" · ").slice(0, 2).join(" · "))).toEqual([
        "Logout · 3",
        "Login · 5",
      ]);
    }
  });

  test("RF-04: el detalle muestra cada ronda revelada con sus cartas, promedio y consenso", async ({
    browser,
  }) => {
    const { ana, beto } = await room(browser, "e2e-hist-detalle");
    await ana.getByLabel("Título de la tarea").fill("Login");
    await ana.getByRole("button", { name: "Empezar votación" }).click();
    await expect(beto.getByRole("heading", { name: "Login" })).toBeVisible();
    await card(ana, "5").click();
    await card(beto, "8").click();
    await expect(ana.getByRole("status", { name: "Votos" })).toHaveText("2 de 2 votaron");
    await ana.getByRole("button", { name: "Revelar cartas" }).click();
    await ana.getByRole("button", { name: "Volver a votar" }).click();
    await card(ana, "8").click();
    await card(beto, "8").click();
    await expect(ana.getByRole("status", { name: "Votos" })).toHaveText("2 de 2 votaron");
    await ana.getByRole("button", { name: "Revelar cartas" }).click();
    await ana.getByRole("button", { name: /^Estimar 8/ }).click();

    await historyItem(beto, "Login · 8").click();
    const detail = history(beto);
    await expect(detail.getByText("Ronda 1")).toBeVisible();
    await expect(detail.getByText("Ana 5 · Beto 8")).toBeVisible();
    await expect(detail.getByText("Promedio: 6,5")).toBeVisible();
    await expect(detail.getByText("Ronda 2")).toBeVisible();
    await expect(detail.getByText("Ana 8 · Beto 8")).toBeVisible();
    await expect(detail.getByText("¡Consenso!")).toBeVisible();
  });

  test("RF-05: exporta un CSV con BOM, cabecera y las tareas en el orden de la pantalla", async ({
    browser,
  }) => {
    const { ana, beto } = await room(browser, "e2e-hist-csv");
    await estimateViaUi(ana, beto, "Login", ["5", "5"], "5");
    await estimateViaUi(ana, beto, "Logout", ["3", "3"], "3");
    // El CSV refleja lo que Beto ve en pantalla: se espera a que su historial tenga las dos
    await expect(history(beto).getByText("2 tareas · 8 puntos")).toBeVisible();

    const [download] = await Promise.all([
      beto.waitForEvent("download"),
      history(beto).getByRole("button", { name: "Exportar CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^planning-poker-test-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const content = await readFile(await download.path(), "utf8");
    expect(content.startsWith("\uFEFF")).toBe(true);
    const lines = content.slice(1).split("\r\n");
    expect(lines[0]).toBe("Tarea;Detalle;Estimación;Fecha;Rondas");
    expect(lines.slice(1).map((l) => l.split(";").slice(0, 3).join(";"))).toEqual([
      "Logout;;3",
      "Login;;5",
    ]);
  });

  test("RF-07/RF-03: la estimación aparece en el historial de los demás en 2 s o menos y sale al volver a votar", async ({
    browser,
  }) => {
    const { ana, beto } = await room(browser, "e2e-hist-vivo");
    await ana.getByLabel("Título de la tarea").fill("Login");
    await ana.getByRole("button", { name: "Empezar votación" }).click();
    await expect(beto.getByRole("heading", { name: "Login" })).toBeVisible();
    await card(ana, "5").click();
    await card(beto, "5").click();
    await expect(ana.getByRole("status", { name: "Votos" })).toHaveText("2 de 2 votaron");
    await ana.getByRole("button", { name: "Revelar cartas" }).click();

    await ana.getByRole("button", { name: /^Estimar 5/ }).click();
    await expect(historyItem(beto, "Login · 5")).toBeVisible({ timeout: 2_000 });

    await ana.getByRole("button", { name: "Volver a votar" }).click();
    await ana.getByRole("alertdialog").getByRole("button", { name: "Sí, volver a votar" }).click();
    await expect(historyItem(beto, "Login · 5")).toHaveCount(0, { timeout: 2_000 });
  });

  test("RF-09: la ruta del historial exige sesión y devuelve la lista de la sala", async ({
    browser,
  }) => {
    const { ana, beto, url } = await room(browser, "e2e-hist-ruta");
    await estimateViaUi(ana, beto, "Login", ["5", "5"], "5");
    const roomId = new URL(url).pathname.split("/").pop();
    const path = `/api/rooms/${roomId}/history`;

    const ok = await beto.request.get(path);
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject([{ title: "Login", estimate: "5" }]);

    const stranger = await browser.newContext();
    expect((await stranger.request.get(new URL(path, url).href)).status()).toBe(403);
    expect(
      (await stranger.request.get(new URL("/api/rooms/NoExiste_123/history", url).href)).status(),
    ).toBe(404);
    await stranger.close();
  });

  test("RF-11: el moderador borra una tarea del historial con confirmación y todos lo ven en 2 s o menos", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const { ana, beto, url } = await room(browser, "e2e-hist-borrar");
    await estimateViaUi(ana, beto, "Login", ["5", "5"], "5");
    await estimateViaUi(ana, beto, "Logout", ["3", "3"], "3");
    await expect(historyItem(beto, "Logout · 3")).toBeVisible();
    const deleteButton = (page: Page, title: string) =>
      history(page).getByRole("button", { name: `Borrar ${title}`, exact: true });

    // La tarea actual (Logout) no se borra desde el historial; el jugador no ve botones
    await expect(deleteButton(ana, "Login")).toBeVisible();
    await expect(deleteButton(ana, "Logout")).toHaveCount(0);
    await expect(history(beto).getByRole("button", { name: /^Borrar / })).toHaveCount(0);

    // Con otra tarea en curso, Logout ya se puede borrar
    await ana.getByRole("button", { name: "Nueva tarea" }).click();
    await ana.getByLabel("Título de la tarea").fill("Signup");
    await ana.getByRole("button", { name: "Empezar votación" }).click();
    await expect(beto.getByRole("heading", { name: "Signup" })).toBeVisible();
    await expect(deleteButton(ana, "Logout")).toBeVisible();

    // Cancelar conserva la tarea
    await deleteButton(ana, "Login").click();
    const dialog = ana.getByRole("alertdialog");
    await expect(dialog.getByText("¿Borrar 'Login' del historial?")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(historyItem(ana, "Login · 5")).toBeVisible();

    // Confirmar la borra para todos
    await deleteButton(ana, "Login").click();
    await ana.getByRole("alertdialog").getByRole("button", { name: "Sí, borrar" }).click();
    await expect(historyItem(beto, "Login · 5")).toHaveCount(0, { timeout: 2_000 });
    await expect(history(beto).getByText("1 tarea · 3 puntos")).toBeVisible({ timeout: 2_000 });
    await expect(historyItem(ana, "Login · 5")).toHaveCount(0);

    // Quien entra después no la ve
    const dani = await joinViaUi(browser, url, "Dani");
    await expect(historyItem(dani, "Logout · 3")).toBeVisible();
    await expect(historyItem(dani, "Login · 5")).toHaveCount(0);
  });
});
