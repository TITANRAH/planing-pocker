# Plan 004 — Historial de tareas estimadas

- **Spec:** ./spec.md (versión 1.1)
- **Fecha:** 2026-10-17
- **Estado:** Aprobado (2026-10-17) · versión 1.2

## 1. Resumen técnico
El historial **no guarda datos nuevos**: un Route Handler de solo lectura,
`GET /api/rooms/[roomId]/history`, lo construye con las tareas de la sala que tienen estimación y sus rondas `REVEALED` con su foto. El
resumen, el CSV y el nombre del archivo son **funciones puras** (probadas en unitarias); el CSV se
genera y descarga en el navegador, sin endpoint. El historial se vuelve a pedir al suscribirse al
canal y con cada broadcast `estimate` (que ya emite la 003 al fijar, cambiar o borrar una
estimación), así que no hace falta ningún evento nuevo.

## 2. Chequeo de constitución
| Artículo | Cumple | Justificación |
|---|---|---|
| I. Primacía de la spec | ✅ | Solo RF-01…RF-10. Sin edición, otros formatos ni integración externa. |
| II. Tipado estricto | ✅ | `HistoryItem` derivado de Zod; cartas validadas con `cardSchema`/`estimateSchema` al leerlas de la BD. |
| III. UI y formularios | ✅ | shadcn/ui: se añade `accordion` para el detalle de cada tarea; `button`, `badge`. Sin formularios. Mobile-first. |
| IV. Validación y persistencia | ✅ | La ruta valida `roomId` con Zod y exige sesión activa (cookie); el navegador valida la respuesta con `historyItemSchema`. Sin cambios en el esquema ni migraciones. |
| V. TDD | ✅ | Matriz §6: unitarias para resumen, CSV y nombre; integración para `getHistory`; e2e para la UI, la descarga y los tiempos. |
| VI. Integridad del voto | ✅ | `getHistory` **solo** lee rondas `REVEALED` (foto `RevealEntry`), nunca `Vote` ni rondas `OPEN`; prueba de integración específica (RF-08). |

## 3. Modelo de datos
Sin cambios. Se reutilizan `Task.estimate`/`estimatedAt` (hora de la última estimación) y
`Round` (`status = REVEALED`, `revealedAt`) con `RevealEntry`. El índice `@@index([roomId])` de
`Task` cubre la consulta.

## 4. Contratos

**Esquemas Zod** (`src/lib/schemas/history.ts`)
- `historyRoundSchema` = { roundId, revealedAt: Date, entries: revealEntrySchema[] }
- `historyItemSchema` = { taskId, title, detail: string | null, estimate: estimateSchema,
  estimatedAt: Date, rounds: historyRoundSchema[] } (fechas con `z.coerce.date()`: en JSON
  llegan como texto ISO)

**Dominio puro** (`src/lib/domain/history.ts`)
- `historySummary(items)` → `{ count, points }` (RF-02)
- `formatHistoryTime(date)` → "14:32" · `formatHistoryDate(date)` → "2026-10-17 14:32"
  (hora local; RF-01, RF-05)
- `buildHistoryCsv(items)` → texto con BOM, cabecera `Tarea;Detalle;Estimación;Fecha;Rondas`,
  una fila por tarea en el orden recibido, comillas cuando un campo tiene `;`, `"` o salto de
  línea (las comillas internas se duplican) (RF-05)
- `historyFileName(roomName, date)` → `planning-poker-<sala>-<AAAA-MM-DD>.csv`, con la sala en
  minúsculas, sin tildes y con guiones (RF-05)

**Route Handler** `GET /api/rooms/[roomId]/history` (`route.ts` → `room-service.getHistory`)
- Quién: participante activo de la sala (si no → `NOT_A_PARTICIPANT`; sala inexistente → `ROOM_NOT_FOUND`).
- Respuesta: 200 con `HistoryItem[]` en JSON (`Cache-Control: no-store`); errores con el mapa
  compartido `src/server/http-status.ts` (400, 403, 404), el mismo que usa la ruta `bye`.
- Devuelve `HistoryItem[]`: tareas de **esa sala** con `estimate` no nulo, ordenadas por
  `estimatedAt` descendente; para cada una, sus rondas `REVEALED` por `revealedAt` ascendente con
  la foto (orden de participantes como en la 003). Una consulta con relaciones anidadas.

**Realtime:** sin eventos nuevos. `useRoomHistory` se registra en el bus (`useRoomChannel`) y
hace `fetch` de la ruta al suscribirse y con cada `estimate` recibido (RF-07, RF-09). Quien fija la
estimación también lo refresca tras la confirmación.

## 5. UI
| Componente | Contenido | Estados |
|---|---|---|
| `HistoryPanel` | Sección "Historial": resumen "N tareas · P puntos", botón "Exportar CSV" y lista | vacío: "Todavía no hay tareas estimadas" + exportar desactivado (RF-06); cargando: skeleton |
| `HistoryItem` (acordeón) | Cabecera "Logout · 3 · 14:32"; al abrir, "Ronda 1", "Ronda 2"…, cada una con cartas, promedio y "¡Consenso!" | — |

El botón descarga el CSV en el navegador (Blob + enlace de descarga) con el nombre de
`historyFileName`.

## 6. Matriz de trazabilidad
| RF | Diseño | Prueba |
|---|---|---|
| RF-01 | `getHistory` (orden por `estimatedAt`), `formatHistoryTime`, `HistoryPanel` | unit `domain/history.test.ts` · integración `server/history.test.ts` (orden; cambio de la tarea actual → nueva hora) · e2e `history.spec.ts` |
| RF-02 | `historySummary` | unit · e2e |
| RF-03 | `getHistory` (solo `estimate` no nulo) | integración (reemplazada sin estimar no sale; cambio → último valor; volver a votar → sale) · e2e |
| RF-04 | Rondas `REVEALED` + `summarizeRound` | integración (dos rondas en orden; ronda no revelada no cuenta) · e2e (acordeón) |
| RF-05 | `buildHistoryCsv`, `historyFileName`, descarga | unit (BOM, `;`, comillas, fecha, `Rondas`) · e2e (descarga y contenido) |
| RF-06 | `HistoryPanel` vacío | e2e |
| RF-07 | `useRoomHistory` (`fetch` del GET) + broadcast `estimate` | e2e (aparece en otro navegador en ≤ 2 s; votar no se retrasa: RF-06 de la 002 en la suite completa) |
| RF-08 | `getHistory` solo `REVEALED` | integración (tarea estimada con ronda abierta: sin cartas de esa ronda) |
| RF-09 | GET del historial al suscribirse | unit (ida y vuelta por JSON) · e2e (entra tarde; ruta: 403 sin sesión, 404 sala inexistente, 200 con la lista) |
| RF-10 | Filtro por `roomId` | integración (dos salas) |

## 7. Riesgos y decisiones
| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Sin datos nuevos ni migración | Tabla de historial | Todo lo necesario ya existe (003); evita duplicar y desincronizar. |
| `getHistory` separado de `getRoomState` | Incluirlo en `getRoomState` | `getRoomState` se pide cada 15 s; el historial puede crecer y solo cambia con `estimate`. |
| CSV generado en el navegador | Route Handler que devuelva el archivo | Los datos ya están en el cliente; la hora local de quien exporta (RF-05) es natural ahí. |
| Refrescar con el broadcast `estimate` | Evento nuevo `history` | `estimate` ya cubre fijar, cambiar y borrar (al volver a votar). **Riesgo:** si se pierde un evento, el historial se corrige al reconectar; se acepta porque el refresco de 15 s de la votación no incluye el historial. |
| Historial por `GET` (Route Handler) | Server Action (v1.0–v1.1); retrasar la carga | T010: las Server Actions de un navegador van en cola, y pedir el historial al entrar retrasaba ≈ 500 ms el primer voto (1835 ms frente a 1320 ms), con lo que RF-06 de la 002 superaba los 2 s en la suite completa. Un `fetch` no espera en esa cola. |
| `accordion` de shadcn para el detalle | `<details>` nativo | Mantiene el sistema visual de shadcn (Art. III) y accesibilidad con teclado. |

## 8. Historial de cambios
| Versión | Fecha | Tipo | Cambio |
|---|---|---|---|
| 1.0 | 2026-10-17 | Inicial | Versión inicial |
| 1.1 | 2026-10-17 | Ajuste por la spec 004 v1.1 | Matriz de RF-01: el cambio de estimación es solo el de la tarea actual. Sin cambios de diseño. |
| 1.2 | 2026-10-17 | Mejora técnica | El historial se pide con `GET /api/rooms/[roomId]/history` en vez de una Server Action, para no retrasar los votos. Spec sin cambios. |
