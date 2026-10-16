# Tareas 001 — Crear sala y unirse

- **Plan:** ./plan.md
- **Fecha:** 2026-10-16
- **Estado:** Aprobado (2026-10-16) · cambio v1.1 aprobado (2026-10-16)

## Fase 1 — Preparación
- [x] **T001** Montar Next.js (App Router) + TypeScript strict + Tailwind + ESLint + Prettier
  - **RF:** — (infraestructura)
  - **Archivos:** `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `src/app/*`
  - **Prueba primero:** no aplica; se verifica con `pnpm lint` y `pnpm typecheck`
  - **Hecho cuando:** `pnpm dev` arranca, y lint y typecheck pasan, con `strict: true` y `no-explicit-any` como error
- [x] **T002** Configurar Vitest
  - **RF:** —
  - **Archivos:** `vitest.config.ts`, `tests/unit/smoke.test.ts`
  - **Prueba primero:** `smoke.test.ts` falla antes de configurar el runner
  - **Hecho cuando:** `pnpm test` ejecuta y pasa
- [x] **T003** Configurar Playwright
  - **RF:** —
  - **Archivos:** `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
  - **Prueba primero:** `smoke.spec.ts` comprueba que `/` responde
  - **Hecho cuando:** `pnpm test:e2e` levanta la app y pasa
- [x] **T004** Inicializar shadcn/ui y añadir card, input, button, form, label, badge, skeleton y sonner
  - **RF:** —
  - **Archivos:** `components.json`, `src/components/ui/*`, `src/lib/utils.ts`
  - **Prueba primero:** no aplica; se verifica con typecheck y lint
  - **Hecho cuando:** los componentes compilan y `<Toaster />` está en el layout
- [ ] ~~**T005** Supabase local + variables de entorno + comando en agents.md~~
  - **Reemplazada por T021** en el cambio v1.1 (Supabase en la nube). No se implementa.
- [x] **T006** Prisma: esquema `Room`/`Participant`, migración `init_rooms` y cliente único
  - **RF:** — (base de RF-01…RF-11)
  - **Archivos:** `prisma/schema.prisma`, `prisma/migrations/*`, `src/server/db.ts`, `tests/integration/db.test.ts`
  - **Prueba primero:** `db.test.ts` crea y lee una `Room` en la BD local (falla sin el esquema)
  - **Hecho cuando:** la migración se aplica y la prueba pasa

## Fase 2 — Dominio
- [ ] **T007** [P] Esquemas Zod de sala, apodo, roomId y presence
  - **RF:** RF-01, RF-04
  - **Archivos:** `src/lib/schemas/room.ts`, `tests/unit/schemas/room.test.ts`
  - **Prueba primero:** límites 3–50 y 2–20, recorte de espacios, roomId inválido y payload inválido
  - **Hecho cuando:** todas las pruebas pasan
- [ ] **T008** [P] `generateRoomId`
  - **RF:** RF-03
  - **Archivos:** `src/lib/domain/room-id.ts`, `tests/unit/domain/room-id.test.ts`
  - **Prueba primero:** 12 caracteres base64url, 1.000 IDs sin repetirse, mismo nombre → IDs distintos
  - **Hecho cuando:** las pruebas pasan
- [ ] **T009** [P] Reglas de dominio: `normalizeNickname`, `isActive`, `countActive`, `canJoin`, `isNicknameAvailable`
  - **RF:** RF-05, RF-06, RF-10
  - **Archivos:** `src/lib/domain/room.ts`, `tests/unit/domain/room.test.ts`
  - **Prueba primero:** "  JUAN " = "juan"; activo a 1:59 e inactivo a 2:01 de `disconnectedAt`; respaldo de 2:30 de `lastSeenAt`; cupo de 15 contando a los desconectados recientes
  - **Hecho cuando:** las pruebas pasan, todas con `now` inyectado
- [ ] **T010** [P] Generar y hashear tokens de participante
  - **RF:** RF-09
  - **Archivos:** `src/server/token.ts`, `tests/unit/server/token.test.ts`
  - **Prueba primero:** 32 bytes base64url; el hash es determinista y distinto del token; un formato inválido se rechaza
  - **Hecho cuando:** las pruebas pasan

## Fase 3 — Servidor
- [ ] **T011** `createRoom`
  - **RF:** RF-01
  - **Archivos:** `src/server/rooms.ts`, `src/server/session.ts` (cookie), `tests/integration/server/rooms.test.ts`
  - **Prueba primero:** crea sala + moderador, pone la cookie y rechaza entradas inválidas con `VALIDATION`
  - **Hecho cuando:** las pruebas pasan
- [ ] **T012** `joinRoom`
  - **RF:** RF-04, RF-05, RF-06, RF-07
  - **Archivos:** `src/server/rooms.ts`, `tests/integration/server/rooms.test.ts`
  - **Prueba primero:** entra como jugador; `NICKNAME_TAKEN` (también sin distinguir mayúsculas y con apodo reservado); `ROOM_FULL` a 15; plaza libre tras expirar; `ROOM_NOT_FOUND`
  - **Hecho cuando:** las pruebas pasan, incluida una prueba de dos `joinRoom` simultáneos con el mismo apodo
- [ ] **T013** `resumeSession` y `renameAndResume`
  - **RF:** RF-09, RF-11
  - **Archivos:** `src/server/rooms.ts`, `tests/integration/server/rooms.test.ts`
  - **Prueba primero:** reanuda una sesión activa; si expiró, vuelve con el mismo apodo y rol; con el apodo ocupado → `NICKNAME_TAKEN` y renombrar conserva el rol; sala llena → `ROOM_FULL`; el moderador conserva su rol
  - **Hecho cuando:** las pruebas pasan
- [ ] **T014** `heartbeat`, `markDisconnected` y `getRoomState`
  - **RF:** RF-08, RF-10, RF-11
  - **Archivos:** `src/server/rooms.ts`, `tests/integration/server/rooms.test.ts`
  - **Prueba primero:** el heartbeat limpia `disconnectedAt`; `markDisconnected` solo lo puede llamar un participante de la sala y no pisa una marca existente; `getRoomState` no expone tokens ni hashes y omite a los expirados
  - **Hecho cuando:** las pruebas pasan

## Fase 4 — Tiempo real
- [ ] **T015** Cliente Supabase y hook `useRoomPresence` (track, sync/join/leave, heartbeat de 15 s, Realtime ≤ 25 s)
  - **RF:** RF-08, RF-10
  - **Archivos:** `src/lib/supabase/client.ts`, `src/lib/realtime/presence.ts` (reducer puro), `src/lib/realtime/use-room-presence.ts`, `tests/unit/realtime/presence.test.ts`
  - **Prueba primero:** el reducer aplica join/leave, ignora payloads inválidos y pone la retirada a `disconnectedAt + 2 min`
  - **Hecho cuando:** las pruebas del reducer pasan y el hook compila sin `any`

## Fase 5 — UI
- [ ] **T016** Página de inicio con `CreateRoomForm`
  - **RF:** RF-01
  - **Archivos:** `src/app/page.tsx`, `src/components/create-room-form.tsx`, `tests/e2e/create-room.spec.ts`
  - **Prueba primero:** e2e de crear sala → redirige a `/r/<id>` y aparece como moderador; errores de validación en los campos
  - **Hecho cuando:** el e2e pasa
- [ ] **T017** Página de sala: no existe, sala llena y `JoinRoomForm`
  - **RF:** RF-04, RF-06, RF-07
  - **Archivos:** `src/app/r/[roomId]/page.tsx`, `src/components/join-room-form.tsx`, `src/components/room-not-found.tsx`, `src/components/room-full.tsx`, `tests/e2e/join-room.spec.ts`
  - **Prueba primero:** link inexistente → "Esta sala no existe" con botón; entrar con apodo; aviso de apodo en uso
  - **Hecho cuando:** el e2e pasa
- [ ] **T018** `RoomView` con cabecera y `CopyLinkButton`
  - **RF:** RF-02
  - **Archivos:** `src/components/room-view.tsx`, `src/components/copy-link-button.tsx`, `tests/e2e/create-room.spec.ts`
  - **Prueba primero:** e2e que copia el link → el portapapeles contiene la URL y aparece el toast
  - **Hecho cuando:** el e2e pasa
- [ ] **T019** `ParticipantList` conectada a la presence
  - **RF:** RF-08, RF-10, RF-11
  - **Archivos:** `src/components/participant-list.tsx`, `src/components/room-view.tsx`
  - **Prueba primero:** se cubre con el e2e de T020 (se escribe primero en esa tarea)
  - **Hecho cuando:** muestra apodo, estado y badge de moderador, y retira a los expirados

## Fase 6 — E2E
- [ ] **T020** E2E multijugador de presence
  - **RF:** RF-08, RF-09, RF-10, RF-11
  - **Archivos:** `tests/e2e/presence.spec.ts`
  - **Prueba primero:** 2 navegadores: aparece en ≤ 2 s; cerrar la pestaña → desconectado en ≤ 2 s; `setOffline` → desconectado en ≤ 30 s; retirada a los 2 min (reloj simulado); recarga → mismo apodo; el moderador recarga y conserva el rol
  - **Hecho cuando:** pasa de forma estable 3 veces seguidas
  - **Nota:** T019 y T020 se hacen juntas: primero se escribe el e2e de T020 en rojo y después se implementa T019.

## Cobertura
| RF | Tareas |
|---|---|
| RF-01 | T007, T011, T016 |
| RF-02 | T018 |
| RF-03 | T008 |
| RF-04 | T007, T012, T017 |
| RF-05 | T009, T012 |
| RF-06 | T009, T012, T017 |
| RF-07 | T012, T017 |
| RF-08 | T014, T015, T019, T020 |
| RF-09 | T010, T013, T020 |
| RF-10 | T009, T014, T015, T019, T020 |
| RF-11 | T013, T014, T019, T020 |

## Cambio v1.1 — Supabase en la nube y Node 22

**Orden de ejecución con el cambio:**
T022 → T001 → T002 → T003 → T004 → T021 → T006 → T023 → T007 … (el resto sin cambios)

- [x] **T021** Conectar el proyecto de Supabase en la nube (`planning-poker-dev`)
  - **RF:** — (infraestructura; reemplaza a T005)
  - **Archivos:** `.env.example`, `.gitignore`, `agents.md` (sección de configuración del entorno)
  - **Prueba primero:** no aplica; la conexión se verifica en T006 al aplicar la migración en la nube
  - **Hecho cuando:** `.env.example` lista `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`
    y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `.env.local` está ignorado por git; el usuario creó el
    proyecto y rellenó `.env.local`; `agents.md` explica cómo configurarlo
  - **Requiere acción del usuario:** crear la cuenta y el proyecto en supabase.com y copiar las claves

- [x] **T022** Fijar Node 22 en el proyecto
  - **RF:** — (infraestructura)
  - **Archivos:** `.nvmrc`, `package.json` (`engines.node: ">=22.13"`)
  - **Prueba primero:** no aplica; se verifica con `nvm use` y `pnpm install` sin avisos
  - **Hecho cuando:** `nvm use` selecciona Node 22 dentro del proyecto

- [x] **T023** Limpieza de datos de prueba en la BD compartida
  - **RF:** — (soporte de las pruebas de RF-01…RF-11)
  - **Archivos:** `tests/helpers/test-data.ts`, `vitest.config.ts` (globalTeardown),
    `playwright.config.ts` (globalTeardown), `tests/integration/test-data.test.ts`
  - **Prueba primero:** crea una sala `test-<runId>-…`, ejecuta la limpieza y comprueba que la sala
    y sus participantes ya no existen, y que una sala sin el prefijo de esa ejecución **no** se borra
  - **Hecho cuando:** cada ejecución de pruebas usa un `runId` propio y borra solo sus datos al terminar
