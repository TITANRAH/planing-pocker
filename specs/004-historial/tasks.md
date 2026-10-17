# Tareas 004 — Historial de tareas estimadas

- **Plan:** ./plan.md
- **Fecha:** 2026-10-17
- **Estado:** Aprobado (2026-10-17)

## Fase 1 — Preparación
- [ ] **T001** shadcn/ui: añadir `accordion`
  - **RF:** —
  - **Archivos:** `src/components/ui/accordion.tsx`
  - **Prueba primero:** no aplica; se verifica con lint y typecheck (sin sobrescribir componentes existentes)
  - **Hecho cuando:** el componente compila

## Fase 2 — Dominio
- [ ] **T002** Esquemas Zod del historial
  - **RF:** RF-01, RF-04, RF-05
  - **Archivos:** `src/lib/schemas/history.ts`, `tests/unit/schemas/history.test.ts`
  - **Prueba primero:** `historyItemSchema` acepta una tarea con estimación numérica y rondas con
    foto; rechaza estimación "?" o nula y cartas fuera de la baraja
  - **Hecho cuando:** las pruebas pasan
- [ ] **T003** Resumen, fechas, CSV y nombre del archivo
  - **RF:** RF-01, RF-02, RF-05
  - **Archivos:** `src/lib/domain/history.ts`, `tests/unit/domain/history.test.ts`
  - **Prueba primero:** `historySummary` (3 tareas: 5, 3 y 8 → 3 tareas · 16 puntos; vacío → 0 · 0);
    `formatHistoryTime` → "14:32"; `formatHistoryDate` → "2026-10-17 14:32" (hora local);
    `buildHistoryCsv` empieza con BOM, cabecera exacta, `;` como separador, filas en el orden
    recibido, `Rondas` = nº de rondas, y un título `Login; "fase 1"` sale como
    `"Login; ""fase 1"""`; `historyFileName("Sprint 12 — Diseño", fecha)` →
    `planning-poker-sprint-12-diseno-2026-10-17.csv`
  - **Hecho cuando:** las pruebas pasan

## Fase 3 — Servidor
- [ ] **T004** `getHistory`
  - **RF:** RF-01, RF-03, RF-04, RF-08, RF-10
  - **Archivos:** `src/server/room-service.ts`, `src/server/rooms.ts`, `tests/integration/server/history.test.ts`
  - **Prueba primero:** solo tareas con estimación, ordenadas por la última estimación (cambiar
    una antigua la sube); cambio → último valor; volver a votar → la tarea sale; tarea
    reemplazada sin estimar no sale; dos rondas reveladas en orden con su foto; una ronda
    abierta de una tarea ya estimada **no** aparece ni deja ver sus votos; otra sala no se
    mezcla; sin sesión → `NOT_A_PARTICIPANT`; sala inexistente → `ROOM_NOT_FOUND`
  - **Hecho cuando:** las pruebas pasan

## Fase 4 — Tiempo real
- [ ] **T005** Hook `useRoomHistory`
  - **RF:** RF-07, RF-09
  - **Archivos:** `src/lib/realtime/use-room-history.ts`
  - **Prueba primero:** se cubre con los e2e de la fase 5
  - **Hecho cuando:** pide el historial al suscribirse y con cada `estimate`, sin solapar
    llamadas, y compila sin `any`

## Fase 5 — UI
- [ ] **T006** `HistoryPanel`: lista, resumen y estado vacío
  - **RF:** RF-01, RF-02, RF-06, RF-09
  - **Archivos:** `src/components/history-panel.tsx`, `src/components/room-view.tsx`, `tests/e2e/history.spec.ts`
  - **Prueba primero:** sin tareas estimadas: "Todavía no hay tareas estimadas" y "Exportar CSV"
    desactivado; tras estimar "Login" (5) y "Logout" (3): "Logout · 3" primero, "Login · 5"
    después y "2 tareas · 8 puntos"; quien entra tarde ve las dos
  - **Hecho cuando:** el e2e pasa
- [ ] **T007** Detalle de rondas en acordeón
  - **RF:** RF-04
  - **Archivos:** `src/components/history-panel.tsx`, `tests/e2e/history.spec.ts`
  - **Prueba primero:** una tarea votada dos veces muestra "Ronda 1" y "Ronda 2" con las cartas,
    el promedio y "¡Consenso!" donde corresponde
  - **Hecho cuando:** el e2e pasa
- [ ] **T008** Exportar CSV
  - **RF:** RF-05
  - **Archivos:** `src/components/history-panel.tsx`, `tests/e2e/history.spec.ts`
  - **Prueba primero:** "Exportar CSV" descarga `planning-poker-<sala>-<fecha>.csv` con BOM,
    cabecera y una fila por tarea en el orden de la pantalla
  - **Hecho cuando:** el e2e pasa
- [ ] **T009** Historial en vivo y al volver a votar
  - **RF:** RF-03, RF-07
  - **Archivos:** `tests/e2e/history.spec.ts`
  - **Prueba primero:** cuando el moderador fija una estimación, otro navegador la ve en su
    historial en ≤ 2 s; al volver a votar esa tarea, sale del historial de los demás
  - **Hecho cuando:** el e2e pasa

## Fase 6 — E2E
- [ ] **T010** Suite completa estable
  - **RF:** todos
  - **Prueba primero:** no aplica; `pnpm test:e2e --repeat-each=3` en verde
  - **Hecho cuando:** pasa 3 veces seguidas sin pruebas inestables

## Cobertura
| RF | Tareas |
|---|---|
| RF-01 | T002, T003, T004, T006 |
| RF-02 | T003, T006 |
| RF-03 | T004, T009 |
| RF-04 | T002, T004, T007 |
| RF-05 | T002, T003, T008 |
| RF-06 | T006 |
| RF-07 | T005, T009 |
| RF-08 | T004 |
| RF-09 | T005, T006 |
| RF-10 | T004 |
