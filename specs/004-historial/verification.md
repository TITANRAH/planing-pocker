# Verificación 004 — Historial de tareas estimadas

- **Fecha:** 2026-10-17 (reverificación tras el cambio v1.2)
- **Spec verificada:** versión 1.2 (plan v1.3)
- **Tareas:** las 16 hechas (T001–T016)
- **Resultado:** ✅ Aprobada

## 1. Comandos
| Comando | Resultado | Detalle |
|---|---|---|
| `pnpm lint` | ✅ | ESLint sin errores ni avisos (`--max-warnings=0`) |
| `pnpm typecheck` | ✅ | `next typegen` + `tsc --noEmit` sin errores |
| `pnpm test` | ✅ | 21 archivos, 200 pruebas (unit + integración contra Supabase dev) |
| `pnpm test:e2e` | ✅ | 44 pruebas (001 a 004) contra el build de producción, 2 workers. T016: 132/132 con `--repeat-each=3` (10,3 min); antes, T010: 129/129 |

## 2. Matriz RF → prueba
Contada en los archivos de la 004: `unit/schemas/history.test.ts`, `unit/domain/history.test.ts`,
`integration/server/history.test.ts` y `e2e/history.spec.ts`.

| RF | Prueba(s) | Resultado |
|---|---|---|
| RF-01 Lista ordenada con hora | unit (2: esquema, "14:32") · integración (1: solo estimadas, de la más reciente a la más antigua; el cambio de hora al reestimar la tarea actual, en la prueba RF-03 "cambiar la estimación") · e2e (1: "Logout · 3" antes que "Login · 5") | ✅ |
| RF-02 Resumen | unit (1: "3 tareas · 16 puntos", vacío) · e2e (1: "2 tareas · 8 puntos") | ✅ |
| RF-03 Solo estimación vigente | integración (2: cambio → último valor y hora; reemplazada sin estimar no sale, al volver a votar sale) · e2e (1: sale del historial de los demás al volver a votar) | ✅ |
| RF-04 Detalle de rondas | unit (2: esquema de la foto, cartas de la baraja) · integración (1: rondas reveladas en orden con su foto) · e2e (1: "Ronda 1"/"Ronda 2", cartas, promedio y "¡Consenso!") | ✅ |
| RF-05 Exportar CSV | unit (5: estimación numérica, fecha, BOM/cabecera/`;`/orden, comillas, nombre del archivo) · e2e (1: descarga con BOM, cabecera y filas en el orden de la pantalla) | ✅ |
| RF-06 Historial vacío | e2e (1: aviso y "Exportar CSV" desactivado) | ✅ |
| RF-07 En vivo (≤ 2 s) | e2e (1: aparece en el otro navegador en ≤ 2 s) | ✅ |
| RF-08 Secreto de la ronda abierta | integración (1: nada de la ronda abierta en curso) | ✅ |
| RF-09 Quien llega tarde | unit (1: ida y vuelta por JSON) · integración (1: sin sesión / sala inexistente) · e2e (2: quien entra tarde ve la lista; la ruta da 200, 403 y 404) | ✅ |
| RF-10 Solo la propia sala | integración (1: dos salas) | ✅ |
| RF-11 Borrar del historial | unit (2: entrada del borrado; evento solo con `taskId`) · integración (5: borra tarea, rondas y foto sin tocar otra; jugador → `NOT_MODERATOR`; tarea actual → `TASK_IS_CURRENT`; otra sala o sin estimación → `TASK_NOT_FOUND`; broadcast `historyDeleted`) · e2e (1: sin botón en la tarea actual ni para el jugador; cancelar conserva; confirmar → el otro navegador ve "1 tarea · 3 puntos" en ≤ 2 s; quien entra después no la ve) | ✅ |

No hay pruebas de la 004 que citen RF inexistentes.

## 3. Chequeo de constitución
| Artículo | Cumple | Evidencia |
|---|---|---|
| I. Primacía de la spec | ✅ | Implementa RF-01…RF-11. No hay edición, vaciado total ni recuperación del historial, otros formatos, integración con Jira/Linear ni estadísticas. |
| II. Tipado estricto | ✅ | Ningún `any` ni `@ts-*` en los archivos de la 004 (grep). `HistoryItem` derivado de Zod. |
| III. UI y formularios | ✅ | Solo shadcn/ui (`accordion`, `button`, `badge`, `alert-dialog`) + Tailwind; sin formularios (exportar y borrar son botones). Móvil (390 px): la fila con título largo se recorta con "…", la papelera queda alineada, sin scroll horizontal; el diálogo de confirmación cabe en pantalla. |
| IV. Validación y persistencia | ✅ | `GET /api/rooms/[roomId]/history` valida `roomId` con `roomIdSchema` y exige sesión activa (403/404/400 con el mapa compartido `http-status.ts`). El navegador valida la respuesta con `z.array(historyItemSchema)`; los datos de la BD se validan con `historyItemSchema` (cartas con `cardSchema`/`estimateSchema`). `deleteHistoryItem` valida su entrada con `deleteHistoryItemInput`; `historyDeleted` se valida al enviar (`historyDeletedEventPayload`) y al recibir (`useRoomHistory`). Sin cambios de esquema ni migraciones (borrado en cascada ya existente). |
| V. TDD | ✅ | Los 11 RF con pruebas en verde que los citan, escritas antes del código salvo T001 (componente) y T005/T014 (hooks, cubiertos por e2e), como prevé `tasks.md`. |
| VI. Integridad del voto | ✅ | `getHistory` solo lee rondas `status: "REVEALED"` y su foto `RevealEntry`, nunca `Vote`; integración RF-08: con una ronda abierta, sus votos no aparecen. VI.3: `deleteHistoryItem` exige `role = MODERATOR` (`NOT_MODERATOR`, integración); `historyDeleted` solo lleva `taskId` (esquema estricto). |

## 4. Problemas y acciones propuestas
Sin problemas que incumplan la spec o la constitución.

## 5. Observaciones
- **Cambio v1.2 (RF-11):** dos archivos fuera de la lista de T012/T014 tuvieron que tocarse para
  compilar y registrar el evento: `room-client.tsx` (el `switch` exhaustivo de `ActionError`
  incluye los 2 errores nuevos) y `use-room-channel.ts` (`historyDeleted` en la lista de eventos
  del bus). El payload saliente está en `outgoing.ts`, junto a los demás, en lugar de en
  `realtime-broadcast.ts` como decía T013.
- **Plazo de una prueba de integración:** "otra sala o sin estimación" hace 2 salas y 4
  estimaciones contra la BD de `ca-central-1` y superaba los 20 s por defecto; tiene 60 s.
- **Regresión de RF-06 (002) detectada en T010 y resuelta en el plan v1.2:** pedir el historial
  con una Server Action al entrar retrasaba ≈ 500 ms el primer voto (1835 ms frente a 1320 ms),
  porque Next pone en cola las Server Actions de cada navegador; en la suite completa superaba
  los 2 s. Con el `GET` (T011) la suite pasa 3 veces seguidas.
- **Ejecución inválida descartada:** una primera ejecución de T010 tras T011 dio 50 fallos en
  3,7 h porque el portátil se suspendió con la tapa cerrada (`pmset`: "Clamshell Sleep" de 09:29
  a 11:30). Se repitió con `caffeinate` y el equipo despierto: 129/129.
- **Restos de datos de prueba:** tras la verificación, 0 salas `test-` en la BD de dev.
- Sigue pendiente la propuesta de citar `NNN/RF-NN` en las pruebas (los ID de RF se repiten entre
  specs), que requiere una enmienda.
