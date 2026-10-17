# Tareas 002 — Cargar tarea y votar

- **Plan:** ./plan.md
- **Fecha:** 2026-10-16
- **Estado:** Aprobado (2026-10-16) · cambio v1.1 aprobado (2026-10-16)

## Fase 1 — Preparación
- [x] **T001** Prisma: modelos Task, Round y Vote + migración `voting`
  - **RF:** — (base de RF-01…RF-14)
  - **Archivos:** `prisma/schema.prisma`, `prisma/migrations/*`, `tests/integration/voting-db.test.ts`
  - **Prueba primero:** crea tarea → ronda → voto; un segundo voto del mismo participante en la
    misma ronda falla por `@@unique`; borrar la sala borra todo en cascada
  - **Hecho cuando:** la migración se aplica en Supabase dev y la prueba pasa
- [x] **T002** shadcn/ui: añadir `textarea` y `alert-dialog`
  - **RF:** —
  - **Archivos:** `src/components/ui/*`
  - **Prueba primero:** no aplica; se verifica con lint y typecheck
  - **Hecho cuando:** los componentes compilan

## Fase 2 — Dominio
- [x] **T003** [P] Esquemas Zod de votación
  - **RF:** RF-01, RF-03, RF-05, RF-12, RF-13
  - **Archivos:** `src/lib/schemas/voting.ts`, `tests/unit/schemas/voting.test.ts`
  - **Prueba primero:** baraja exacta (rechaza "4", "", "100"); título 3–100 y detalle ≤ 300 con
    recorte; detalle vacío → null; `voteEventSchema` **rechaza un campo `card`** (estricto)
  - **Hecho cuando:** las pruebas pasan
- [x] **T004** [P] Reducer de votación (cliente)
  - **RF:** RF-06, RF-08, RF-11, RF-13
  - **Archivos:** `src/lib/realtime/voting.ts`, `tests/unit/realtime/voting.test.ts`
  - **Prueba primero:** un estado completo inicializa tarea, ronda, `voted` y `myVote`; un evento
    `task` con ronda nueva vacía `voted` y `myVote`, y con la misma ronda solo cambia el texto; un
    evento `vote` de otra ronda se ignora; el contador solo cuenta a quien está en la lista;
    eventos inválidos se ignoran
  - **Hecho cuando:** las pruebas pasan

## Fase 3 — Servidor
- [x] **T005** `newTask`
  - **RF:** RF-01, RF-08, RF-12, RF-14
  - **Archivos:** `src/server/room-service.ts`, `src/server/rooms.ts`, `tests/integration/server/voting.test.ts`
  - **Prueba primero:** el moderador crea tarea y ronda abierta; con votos y `discardVotes=false`
    → `VOTES_PRESENT`; con `true` cierra la ronda, borra sus votos y abre otra; un jugador →
    `NOT_MODERATOR`; un moderador expirado → `NOT_A_PARTICIPANT`; título inválido → `VALIDATION`
  - **Hecho cuando:** las pruebas pasan
- [x] **T006** `editTask`
  - **RF:** RF-12, RF-13
  - **Archivos:** igual que T005
  - **Prueba primero:** corrige título y detalle sin tocar ronda ni votos; un jugador →
    `NOT_MODERATOR`; `taskId` que no es el de la ronda abierta → `ROUND_CLOSED`
  - **Hecho cuando:** las pruebas pasan
- [x] **T007** `castVote` y `clearVote`
  - **RF:** RF-03, RF-04, RF-09, RF-12
  - **Archivos:** igual que T005
  - **Prueba primero:** vota, cambia la carta (sigue habiendo un solo voto) y lo quita; "4" →
    `VALIDATION`; sin ronda o con `roundId` viejo → `ROUND_CLOSED`; sin sesión → `NOT_A_PARTICIPANT`
  - **Hecho cuando:** las pruebas pasan
- [x] **T008** `getRoomState` ampliado y votos de quien expira
  - **RF:** RF-05, RF-07, RF-10, RF-11
  - **Archivos:** `src/server/room-service.ts`, `tests/integration/server/voting.test.ts`
  - **Prueba primero:** devuelve tarea, ronda, `voted` y `myVote` solo de quien llama; el estado
    de Beto **no contiene** la carta de Ana; `voted` omite a los expirados; al volver tras
    expirar (`resumeSession`), su voto de la ronda abierta se borra
  - **Hecho cuando:** las pruebas pasan
- [x] **T009** Broadcast `task` y `vote` desde el servidor
  - **RF:** RF-02, RF-05, RF-06
  - **Archivos:** `src/server/room-service.ts`, `src/lib/realtime/outgoing.ts`, `tests/integration/server/voting.test.ts`
  - **Prueba primero:** un oyente del canal recibe `task` al crear o editar y `vote` al votar o
    quitar; cambiar de carta **no** emite un nuevo `vote`; **ningún mensaje contiene la carta**;
    los payloads salen validados (Art. IV.1)
  - **Hecho cuando:** las pruebas pasan

## Fase 4 — Tiempo real
- [x] **T010** Reorganizar `useRoomPresence` en `useRoomChannel`
  - **RF:** RF-08, RF-10 de la spec 001 (no cambia su comportamiento)
  - **Archivos:** `src/lib/realtime/use-room-channel.ts`, `src/lib/realtime/use-room-presence.ts`, `src/components/room-view.tsx`
  - **Prueba primero:** las e2e de presence de la 001 son la red de seguridad: deben seguir en verde
  - **Hecho cuando:** las e2e de la 001 pasan sin cambios
- [x] **T011** Hook `useRoomVoting`
  - **RF:** RF-02, RF-06, RF-08, RF-13
  - **Archivos:** `src/lib/realtime/use-room-voting.ts`
  - **Prueba primero:** se cubre con el reducer de T004 y los e2e de la fase 5
  - **Hecho cuando:** escucha `task`/`vote`, valida con Zod, pide el estado al suscribirse y cada
    15 s, y compila sin `any`

## Fase 5 — UI
- [x] **T012** `TaskPanel`: cargar, editar y nueva tarea con confirmación
  - **RF:** RF-01, RF-02, RF-08, RF-09, RF-13
  - **Archivos:** `src/components/task-panel.tsx`, `src/components/room-view.tsx`, `tests/e2e/voting.spec.ts`
  - **Prueba primero:** el moderador carga una tarea y otro navegador la ve en ≤ 2 s; errores de
    validación; editar el título conserva los votos; nueva tarea con votos pide confirmación y
    deja "0 de M"; un jugador no ve los controles; sin tarea se muestra "Esperando…"
  - **Hecho cuando:** el e2e pasa
- [x] **T013** `CardDeck`
  - **RF:** RF-03, RF-04, RF-07, RF-09
  - **Archivos:** `src/components/card-deck.tsx`, `tests/e2e/voting.spec.ts`
  - **Prueba primero:** elegir "5" la marca (`aria-pressed`); elegir "8" la cambia; volver a
    tocar la quita; al recargar sigue marcada; sin tarea las cartas están desactivadas
  - **Hecho cuando:** el e2e pasa
- [x] **T014** "Votó" en la lista y `VoteCounter`
  - **RF:** RF-06, RF-10
  - **Archivos:** `src/components/participant-list.tsx`, `src/components/vote-counter.tsx`, `tests/e2e/voting.spec.ts`
  - **Prueba primero:** con 3 navegadores, cuando 2 votan (uno con "?") todos ven "2 de 3
    votaron" y "Votó" junto a ellos en ≤ 2 s; quien entra con la ronda empezada ve el contador
    correcto y puede votar
  - **Hecho cuando:** el e2e pasa
- [x] **T015** Sala sin moderador
  - **RF:** RF-14
  - **Archivos:** `src/components/task-panel.tsx`, `tests/e2e/voting.spec.ts`
  - **Prueba primero:** con el moderador retirado (reloj simulado), se muestra "Esta sala no
    tiene moderador", se puede votar la tarea actual y no hay controles de tarea
  - **Hecho cuando:** el e2e pasa

## Fase 6 — E2E
- [x] **T016** E2E del secreto del voto
  - **RF:** RF-05
  - **Archivos:** `tests/e2e/voting-secret.spec.ts`
  - **Prueba primero:** Ana vota "13"; se capturan todas las respuestas HTTP y los frames
    WebSocket que recibe el navegador de Beto, y ninguno contiene la carta de Ana
  - **Hecho cuando:** el e2e pasa
- [x] **T017** Suite completa estable
  - **RF:** todos
  - **Prueba primero:** no aplica; `pnpm test:e2e --repeat-each=3` en verde, con los tiempos de
    ≤ 2 s de RF-02, RF-06 y RF-13
  - **Hecho cuando:** pasa 3 veces seguidas sin pruebas inestables

## Cobertura
| RF | Tareas |
|---|---|
| RF-01 | T003, T005, T012, T018 |
| RF-02 | T009, T011, T012, T017, T018, T019 |
| RF-03 | T003, T007, T013 |
| RF-04 | T007, T013 |
| RF-05 | T003, T008, T009, T016 |
| RF-06 | T004, T009, T011, T014, T017, T019 |
| RF-07 | T008, T013 |
| RF-08 | T004, T005, T011, T012, T018 |
| RF-09 | T007, T012, T013 |
| RF-10 | T008, T014 |
| RF-11 | T004, T008 |
| RF-12 | T003, T005, T006, T007 |
| RF-13 | T003, T004, T006, T011, T012, T017, T019 |
| RF-14 | T005, T015 |

## Cambio v1.1 — Tiempos ≤ 2 s con la BD remota

**Orden:** … T015 → T018 → T019 → (marcar T012–T015) → T016 → T017

- [x] **T018** `newTask` sin bloqueo: "gana la ronda más reciente"
  - **RF:** RF-01, RF-02, RF-08
  - **Archivos:** `src/server/room-service.ts`, `tests/integration/server/voting.test.ts`
  - **Prueba primero:** dos `newTask` simultáneos del moderador dejan **exactamente una** ronda
    abierta (la más reciente) y `getRoomState` devuelve esa; las pruebas actuales de `newTask`
    siguen en verde
  - **Hecho cuando:** las pruebas pasan y `newTask` tarda menos que antes (medido)
- [x] **T019** E2E con 2 workers
  - **RF:** RF-02, RF-06, RF-13 (estabilidad de los tiempos)
  - **Archivos:** `playwright.config.ts`
  - **Prueba primero:** no aplica; se verifica con `pnpm test:e2e tests/e2e/voting.spec.ts --repeat-each=3`
  - **Hecho cuando:** la suite de votación pasa 3 veces seguidas

