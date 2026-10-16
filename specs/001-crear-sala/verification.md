# Verificación 001 — Crear sala y unirse

- **Fecha:** 2026-10-16
- **Spec verificada:** versión 1.0 (plan v1.3)
- **Tareas:** todas hechas (T005 reemplazada por T021 en el cambio v1.1)
- **Resultado:** ✅ Aprobada

## 1. Comandos
| Comando | Resultado | Detalle |
|---|---|---|
| `pnpm lint` | ✅ | ESLint sin errores ni avisos (`--max-warnings=0`) |
| `pnpm typecheck` | ✅ | `next typegen` + `tsc --noEmit` sin errores |
| `pnpm test` | ✅ | 10 archivos, 88 pruebas (unit + integración contra Supabase dev) |
| `pnpm test:e2e` | ✅ | 18 pruebas contra el build de producción, estables: 54/54 con `--repeat-each=3` |

Tras las pruebas no quedan datos de prueba en la BD (0 salas `test-`).

## 2. Matriz RF → prueba
| RF | Prueba(s) | Resultado |
|---|---|---|
| RF-01 Crear sala | unit `schemas/room.test.ts` (5) · integración `server/rooms.test.ts` (3) · e2e `create-room.spec.ts` (2) | ✅ |
| RF-02 Link para compartir | e2e `create-room.spec.ts` (1: link visible, portapapeles, toast) · e2e `mobile.spec.ts` (1: cabe en móvil con nombre de 50 caracteres) | ✅ |
| RF-03 Link no deducible | unit `domain/room-id.test.ts` (3) · `schemas/room.test.ts` (1) | ✅ |
| RF-04 Unirse con apodo | unit (4) · integración (2) · e2e `join-room.spec.ts` (2) | ✅ |
| RF-05 Apodo único | unit `domain/room.test.ts` (4) · integración (4, incluida la concurrencia) · e2e (1) | ✅ |
| RF-06 Límite de 15 | unit (4) · integración (4) · e2e `join-room.spec.ts` (1) | ✅ |
| RF-07 Sala inexistente | unit (1) · integración (3) · e2e (2) | ✅ |
| RF-08 Lista en vivo | unit `realtime/presence.test.ts` + `outgoing.test.ts` (7) · integración (1) · e2e `presence.spec.ts` (1: aparece en ≤ 2 s) | ✅ |
| RF-09 Recordar identidad | unit (4) · integración (6) · e2e (1: recarga) | ✅ |
| RF-10 Desconexión | unit (18) · integración (7) · e2e (3: cierre ≤ 2 s, red caída ≤ 30 s, retirada a 2 min) | ✅ |
| RF-11 Permanencia de sala y moderador | integración (4) · e2e (3: el moderador recarga, la sala sigue sin él, el moderador sin cookie entra como jugador) | ✅ los 4 criterios |

No hay pruebas que citen RF inexistentes.

## 3. Chequeo de constitución
| Artículo | Cumple | Evidencia |
|---|---|---|
| I. Primacía de la spec | ✅ | Todo el código responde a RF-01…RF-11. La ruta `POST /api/rooms/[roomId]/bye` y el heartbeat son mecanismos de RF-10 aprobados en el plan (v1.2/v1.3). |
| II. Tipado estricto | ✅ | `"strict": true` en `tsconfig.json`. Ningún `any`, `@ts-ignore`, `@ts-expect-error` ni `@ts-nocheck` en `src/` y `tests/` (búsqueda con grep, excluido el cliente generado de Prisma). ESLint los marca como error. Único cast: `globalThis as unknown as { prisma?: PrismaClient }` en `src/server/db.ts`. |
| III. UI y formularios | ✅ | Solo shadcn/ui + Tailwind (sin otras librerías de UI; único CSS: `globals.css`). Los 2 formularios usan React Hook Form + `zodResolver`. Textos en español. Móvil: `mobile.spec.ts` comprueba con viewport de iPhone 13 que el título largo y "Copiar link" caben en la tarjeta y que el botón funciona (corregido en T029). Fuente Geist aplicada (T032). |
| IV. Validación y persistencia | ✅ | Las 8 funciones de `room-service.ts` validan su entrada con Zod. La ruta del beacon valida `roomId` vía `sayBye`. Mensajes Realtime: los **recibidos** se validan en el reducer; los **enviados** (`track`/`hello`, `bye`) se construyen con `helloPayload`/`byePayload`, que validan con Zod (T030). La cookie se valida con `tokenSchema`; las variables de entorno, con Zod. BD: solo `schema.prisma` + migración `init_rooms`. Sin `service_role`; en el cliente solo la publishable key. |
| V. TDD | ✅ | Los 11 RF y todos sus criterios de aceptación tienen pruebas en verde que los citan por ID. Las tareas de código se hicieron con la prueba primero; las de infraestructura (T001–T004, T021, T022) y la de cobertura T031 se verificaron con comandos o pruebas sin fase roja, como estaba previsto en `tasks.md`. |
| VI. Integridad del voto | ✅ | Sin votos en esta feature. El moderador se identifica en el servidor por el hash de su token, nunca por datos del cliente. Por Realtime solo viajan id, apodo y rol. |

## 4. Problemas y acciones propuestas
Sin problemas pendientes. Los 4 detectados en la verificación anterior quedaron resueltos:

| # | Problema | Resolución |
|---|---|---|
| 1 | En móvil, el título largo y "Copiar link" se salían de la tarjeta | T029 (prueba de regresión `mobile.spec.ts` + `min-w-0`, `wrap-anywhere` y `shrink-0`) |
| 2 | Los mensajes Realtime enviados no se validaban con Zod | T030 (`src/lib/realtime/outgoing.ts`) |
| 3 | 2 criterios de RF-11 sin prueba | T031 (2 pruebas de integración + 2 e2e; no destaparon bugs) |
| 4 | La app no usaba la fuente Geist | T032 (`--font-sans` → `--font-geist-sans`, con prueba e2e) |

## 5. Observaciones para las siguientes features
- **Feature 002 (votación):** los canales de Realtime son públicos (protegidos solo por un `roomId` no deducible). Según el Art. VI, los valores de los votos **no** deben viajar por Realtime antes de revelarse; hay que diseñarlo así en su plan.
- La presence de Supabase se replica entre servidores por lotes (~2 s). Cualquier aviso que deba llegar en ≤ 2 s debe ir por broadcast, como `hello`/`bye`.
- El e2e corre contra el build de producción; `E2E_DEV=1 pnpm test:e2e` usa `next dev` pero no garantiza los tiempos de RF-08/RF-10.
