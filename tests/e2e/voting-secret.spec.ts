import { expect, test } from "@playwright/test";
import { testRoomName } from "../helpers/test-data";
import { createRoomViaUi, participantItem } from "./helpers";

test("RF-05: ningún mensaje que recibe el navegador de Beto contiene la carta de Ana", async ({
  browser,
}) => {
  const ana = await browser.newPage();
  const url = await createRoomViaUi(ana, testRoomName("e2e-secreto"), "Ana");
  await ana.getByLabel("Título de la tarea").fill("Login con Google");
  await ana.getByRole("button", { name: "Empezar votación" }).click();

  // Todo lo que recibe Beto: frames de WebSocket (Realtime) y respuestas de datos del servidor
  // (Server Actions y JSON). Los recursos estáticos (JS, CSS, fuentes) no llevan datos de la sala.
  const beto = await browser.newPage();
  const received: string[] = [];
  beto.on("websocket", (ws) =>
    ws.on("framereceived", (frame) => received.push(String(frame.payload))),
  );
  beto.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/x-component|json|text\/html/.test(type))
      received.push(await response.text().catch(() => ""));
  });

  await beto.goto(url);
  await beto.getByLabel("Tu apodo").fill("Beto");
  await beto.getByRole("button", { name: "Entrar" }).click();
  await expect(beto.getByRole("heading", { name: "Login con Google" })).toBeVisible();

  await ana.getByRole("button", { name: "Carta 13", exact: true }).click();
  await expect(participantItem(beto, "Ana").getByText("Votó")).toBeVisible();
  // Recargar fuerza a Beto a pedir el estado completo de la sala al servidor
  await beto.reload();
  await expect(participantItem(beto, "Ana").getByText("Votó")).toBeVisible();

  const all = received.join("\n");
  // Control: la captura funciona y Beto sí supo que Ana votó
  expect(all).toMatch(/"voted":true/);
  // Ni un campo de carta ni el valor "13" como dato
  expect(all).not.toContain('"card"');
  expect(all).not.toMatch(/"myVote":"13"/);
  expect(all).not.toMatch(/"13"/);
});

test("RF-05 (002) / RF-01 (003): la carta de Ana no llega a Beto antes de revelar y sí después", async ({
  browser,
}) => {
  const ana = await browser.newPage();
  const url = await createRoomViaUi(ana, testRoomName("e2e-secreto-revelar"), "Ana");
  await ana.getByLabel("Título de la tarea").fill("Login con Google");
  await ana.getByRole("button", { name: "Empezar votación" }).click();

  const beto = await browser.newPage();
  const received: string[] = [];
  beto.on("websocket", (ws) =>
    ws.on("framereceived", (frame) => received.push(String(frame.payload))),
  );
  beto.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/x-component|json|text\/html/.test(type))
      received.push(await response.text().catch(() => ""));
  });
  await beto.goto(url);
  await beto.getByLabel("Tu apodo").fill("Beto");
  await beto.getByRole("button", { name: "Entrar" }).click();
  await expect(beto.getByRole("heading", { name: "Login con Google" })).toBeVisible();

  await ana.getByRole("button", { name: "Carta 13", exact: true }).click();
  await expect(participantItem(beto, "Ana").getByText("Votó")).toBeVisible();
  // Antes de revelar: ninguna carta de Ana
  const beforeReveal = received.join("\n");
  expect(beforeReveal).not.toMatch(/"card":"13"/);
  expect(beforeReveal).not.toMatch(/"13"/);

  await ana.getByRole("button", { name: "Revelar cartas" }).click();
  await expect(
    beto
      .getByRole("list", { name: "Cartas reveladas" })
      .getByRole("listitem")
      .filter({ hasText: "Ana" }),
  ).toContainText("13");
  // Control: después de revelar, la carta sí llega (la captura funciona)
  expect(received.join("\n")).toMatch(/"card":"13"/);
});
