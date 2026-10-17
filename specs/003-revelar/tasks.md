# Tareas 003 — Revelar, consensuar y repetir

- **Plan:** ./plan.md
- **Fecha:** 2026-10-16
- **Estado:** Aprobado (2026-10-16)

## Fase 1 — Preparación
- [x] **T001** Prisma: estado `REVEALED`, `revealedAt`, modelo `RevealEntry`, estimación en `Task` + migración `reveal`
  - **RF:** — (base de RF-01…RF-13)
  - **Archivos:** `prisma/schema.prisma`, `prisma/migrations/*`, `tests/integration/reveal-db.test.ts`
  - **Prueba primero:** guarda una ronda `REVEALED` con su foto (una entrada con carta y otra sin
    carta); una entrada por participante y ronda (`@@unique`); la estimación de la tarea guarda
    carta, quién y cuándo; borrar la sala lo borra todo en cascada
  - **Hecho cuando:** la migración se aplica en Supabase dev y la prueba pasa

## Fase 2 — Dominio
- [x] **T002** [P] `summarizeRound` y `formatAverage`
  - **RF:** RF-04, RF-05, RF-06, RF-07
  - **Archivos:** `src/lib/domain/reveal.ts`, `tests/unit/domain/reveal.test.ts`
  - **Prueba primero:** 3, 5, 8 y "?" → promedio 5,33 ("5,3"), mín. 3, máx. 8; 5 y 5 → "5,0"; solo
    "?"/"☕" → sin promedio, sin mín./máx. ni sugerencia; consenso con 8 y 8; sin consenso con 8 y
    "?"; sin consenso con un solo voto; sugerencia 5,3 → "5"; 6,5 → "8" (empate → la mayor);
    los "No votó" no cuentan
  - **Hecho cuando:** las pruebas pasan
- [x] **T003** [P] Esquemas Zod de revelado
  - **RF:** RF-07, RF-12
  - **Archivos:** `src/lib/schemas/reveal.ts`, `tests/unit/schemas/reveal.test.ts`
  - **Prueba primero:** `estimateSchema` acepta solo cartas numéricas (rechaza "?", "☕", "4");
    `revoteInput.confirm` es falso por defecto; `revealEventSchema` acepta cartas y `null`, y
    rechaza cartas fuera de la baraja; `estimateEventSchema` acepta `null`
  - **Hecho cuando:** las pruebas pasan
- [x] **T004** Reducer de votación ampliado: fase, foto y estimación
  - **RF:** RF-02, RF-03, RF-07, RF-08, RF-10
  - **Archivos:** `src/lib/realtime/voting.ts`, `tests/unit/realtime/voting.test.ts`
  - **Prueba primero:** el estado completo de una ronda revelada inicializa la fase `revealed`,
    la foto y la estimación; el evento `reveal` de la ronda actual pasa a `revealed` con la foto y
    vacía `myVote`; uno de otra ronda se ignora; `estimate` fija o borra la estimación; `task` con
    ronda nueva vuelve a `open` y borra foto y estimación; las pruebas de la 002 siguen en verde
  - **Hecho cuando:** las pruebas pasan

## Fase 3 — Servidor
- [x] **T005** `castVote`/`clearVote` bajo `FOR SHARE` de la ronda
  - **RF:** RF-02, RF-12
  - **Archivos:** `src/server/room-service.ts`, `tests/integration/server/voting.test.ts`
  - **Prueba primero:** las pruebas de voto de la 002 siguen en verde; votar en una ronda
    `REVEALED` → `ROUND_CLOSED`
  - **Hecho cuando:** las pruebas pasan y votar sigue por debajo de 2 s (medido)
- [x] **T006** `revealRound` con foto fija
  - **RF:** RF-01, RF-03, RF-11, RF-12, RF-13
  - **Archivos:** `src/server/room-service.ts`, `src/server/rooms.ts`, `tests/integration/server/reveal.test.ts`
  - **Prueba primero:** revela y guarda la foto de los activos (con y sin carta); sin votos →
    `NO_VOTES`; un jugador → `NOT_MODERATOR`; moderador expirado → `NOT_A_PARTICIPANT`; ronda ya
    revelada → `ROUND_CLOSED`; **voto y revelado simultáneos**: el voto sale en la foto o recibe
    `ROUND_CLOSED`, nunca "ok" sin salir en la foto
  - **Hecho cuando:** las pruebas pasan (la de concurrencia, 5 veces seguidas)
- [x] **T007** `setEstimate`
  - **RF:** RF-07, RF-12, RF-13
  - **Archivos:** igual que T006
  - **Prueba primero:** fija "8" con quién y cuándo; permite cambiarla; "?" → `VALIDATION`; ronda
    abierta → `ROUND_NOT_REVEALED`; un jugador → `NOT_MODERATOR`
  - **Hecho cuando:** las pruebas pasan
- [x] **T008** `revote`
  - **RF:** RF-08, RF-12, RF-13
  - **Archivos:** igual que T006
  - **Prueba primero:** abre una ronda `OPEN` con la misma tarea y deja la revelada como estaba;
    con estimación y `confirm=false` → `ESTIMATE_PRESENT`; con `confirm=true` borra la estimación;
    ronda abierta → `ROUND_NOT_REVEALED`; un jugador → `NOT_MODERATOR`
  - **Hecho cuando:** las pruebas pasan
- [x] **T009** `getRoomState` con ronda revelada y nueva tarea tras revelar
  - **RF:** RF-03, RF-09, RF-10, RF-11
  - **Archivos:** igual que T006
  - **Prueba primero:** con la ronda revelada devuelve `round.status`, la foto y la estimación;
    quien entra después no está en la foto; un participante retirado sigue en la foto; con la
    ronda abierta no hay foto ni cartas ajenas; `newTask` tras revelar no devuelve
    `VOTES_PRESENT` y la ronda revelada sigue `REVEALED` con su foto
  - **Hecho cuando:** las pruebas pasan
- [x] **T010** Broadcast `reveal` y `estimate` (y `task` al volver a votar)
  - **RF:** RF-01, RF-07, RF-08
  - **Archivos:** `src/server/room-service.ts`, `src/lib/realtime/outgoing.ts`, `tests/integration/server/reveal.test.ts`
  - **Prueba primero:** un oyente del canal recibe `reveal` con la foto, `estimate` al fijar y,
    al volver a votar, `task` con la ronda nueva y `estimate` en `null`; todos validados al salir
  - **Hecho cuando:** las pruebas pasan

## Fase 4 — Tiempo real
- [x] **T011** Escuchar `reveal` y `estimate` en el bus y en `useRoomVoting`
  - **RF:** RF-01, RF-07, RF-08
  - **Archivos:** `src/lib/realtime/use-room-channel.ts`, `src/lib/realtime/use-room-voting.ts`
  - **Prueba primero:** se cubre con el reducer de T004 y los e2e de la fase 5; las e2e de la 001 y la 002 siguen en verde
  - **Hecho cuando:** compila sin `any` y las e2e existentes pasan

## Fase 5 — UI
- [x] **T012** Revelar: botón, cartas reveladas, resumen y baraja cerrada
  - **RF:** RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-10
  - **Archivos:** `src/components/reveal-button.tsx`, `src/components/revealed-round.tsx`,
    `src/components/round-summary.tsx`, `src/components/room-view.tsx`, `tests/e2e/reveal.spec.ts`
  - **Prueba primero:** sin votos "Revelar cartas" está desactivado; con 3 navegadores (5, 8 y
    "No votó"), al revelar todos ven las cartas en ≤ 2 s, el promedio "6,5", mín. 5 y máx. 8;
    las cartas quedan desactivadas; con 8 y 8 se ve "¡Consenso!"; quien entra después ve la
    foto sin aparecer en ella
  - **Hecho cuando:** el e2e pasa
- [x] **T013** Estimación final
  - **RF:** RF-07
  - **Archivos:** `src/components/estimate-picker.tsx`, `src/components/room-view.tsx`, `tests/e2e/reveal.spec.ts`
  - **Prueba primero:** la carta sugerida aparece marcada; el moderador fija "8" y los demás ven
    "Estimación final: 8" en ≤ 2 s; los jugadores no ven el selector
  - **Hecho cuando:** el e2e pasa
- [x] **T014** Volver a votar y nueva tarea tras revelar
  - **RF:** RF-08, RF-09
  - **Archivos:** `src/components/room-view.tsx`, `src/components/task-panel.tsx`, `tests/e2e/reveal.spec.ts`
  - **Prueba primero:** "Volver a votar" sin estimación no pregunta y deja "0 de M" con la misma
    tarea; con estimación pide confirmar ("Se borrará la estimación final: 8"); "Nueva tarea"
    tras revelar no pide confirmación
  - **Hecho cuando:** el e2e pasa
- [x] **T015** Sala sin moderador en la ronda revelada
  - **RF:** RF-13
  - **Archivos:** `tests/e2e/reveal.spec.ts`
  - **Prueba primero:** con el moderador retirado (reloj simulado) no hay "Revelar cartas", ni
    selector de estimación, ni "Volver a votar"
  - **Hecho cuando:** el e2e pasa

## Fase 6 — E2E
- [ ] **T016** Secreto antes de revelar y suite completa estable
  - **RF:** todos (y RF-05 de la 002)
  - **Archivos:** `tests/e2e/voting-secret.spec.ts`
  - **Prueba primero:** ampliar el e2e del secreto: la carta de Ana **no** llega a Beto antes de
    revelar y **sí** llega después (control); `pnpm test:e2e --repeat-each=3` en verde
  - **Hecho cuando:** pasa 3 veces seguidas sin pruebas inestables

## Cobertura
| RF | Tareas |
|---|---|
| RF-01 | T006, T010, T011, T012 |
| RF-02 | T004, T005, T012 |
| RF-03 | T004, T006, T009, T012 |
| RF-04 | T002, T012 |
| RF-05 | T002, T012 |
| RF-06 | T002, T012 |
| RF-07 | T002, T003, T004, T007, T010, T011, T013 |
| RF-08 | T004, T008, T010, T011, T014 |
| RF-09 | T009, T014 |
| RF-10 | T004, T009, T012 |
| RF-11 | T006, T009 |
| RF-12 | T003, T005, T006, T007, T008 |
| RF-13 | T006, T007, T008, T015 |
