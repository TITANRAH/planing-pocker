# Verificación 002 — Cargar tarea y votar

- **Fecha:** 2026-10-16
- **Spec verificada:** versión 1.0 (plan v1.1)
- **Tareas:** las 20 hechas (T001–T020)
- **Resultado:** ✅ Aprobada

## 1. Comandos
| Comando | Resultado | Detalle |
|---|---|---|
| `pnpm lint` | ✅ | ESLint sin errores ni avisos (`--max-warnings=0`) |
| `pnpm typecheck` | ✅ | `next typegen` + `tsc --noEmit` sin errores |
| `pnpm test` | ✅ | 14 archivos, 135 pruebas (unit + integración contra Supabase dev) |
| `pnpm test:e2e` | ✅ | 28 pruebas (001 + 002) contra el build de producción, 2 workers: 84/84 con `--repeat-each=3` |

## 2. Matriz RF → prueba
Contadas solo en los archivos de pruebas de la 002 (`*/voting*`), porque los ID de RF se
repiten entre specs (ver §5).

| RF | Prueba(s) | Resultado |
|---|---|---|
| RF-01 Cargar la tarea | unit `schemas/voting.test.ts` (3) · integración `server/voting.test.ts` (2) · e2e `voting.spec.ts` (2) | ✅ |
| RF-02 Tarea en vivo (≤ 2 s) | unit `realtime/voting.test.ts` (1) · integración (1: broadcast `task`) · e2e (1: otro navegador en ≤ 2 s) | ✅ |
| RF-03 Votar con una carta | unit (1: baraja exacta) · integración (2: incluye "?" y "☕") · e2e (1) | ✅ |
| RF-04 Cambiar o quitar el voto | unit (1) · integración (1) · e2e (1) | ✅ |
| RF-05 Voto secreto | unit (2: `vote` estricto sin carta) · integración (2: estado y broadcast sin la carta) · e2e `voting-secret.spec.ts` (1: todo lo que recibe el navegador de Beto; validado con una mutación que filtraba la carta) | ✅ |
| RF-06 Quién votó y "N de M" (≤ 2 s) | unit (3) · integración (1) · e2e (1: 3 navegadores, "?" cuenta) | ✅ El criterio "un desconectado hace 1 min sigue en M" se cumple por composición: M es la lista de presence, que conserva a los desconectados 2 min (probado en la 001). |
| RF-07 Recordar mi voto | integración (1) · e2e (1: recarga) | ✅ |
| RF-08 Nueva tarea | unit (2) · integración (4: `VOTES_PRESENT`, confirmación, sin votos, concurrencia) · e2e (1: diálogo) | ✅ |
| RF-09 Sin tarea no se vota | unit (1) · integración (2) · e2e (1) | ✅ |
| RF-10 Entrar con la ronda empezada | unit (1) · integración (1) · e2e (1: "2 de 4" y vota) | ✅ |
| RF-11 Votos de quien se desconecta | unit (1) · integración (3: `voted` sin expirados, voto descartado al volver, broadcast) | ✅ |
| RF-12 Rechazo de acciones inválidas | unit (2) · integración (5) · e2e (1: sin controles para jugadores) | ✅ |
| RF-13 Editar la tarea (≤ 2 s) | unit (2) · integración (3) · e2e (1) | ✅ |
| RF-14 Sala sin moderador | integración (1: moderador retirado no carga tareas) · e2e (2: aviso + votar con tarea; aviso + cartas desactivadas sin tarea) | ✅ los 2 criterios |

No hay pruebas que citen RF inexistentes. Las 3 pruebas sin RF son de infraestructura del
modelo de datos (T001, `voting-db.test.ts`).

## 3. Chequeo de constitución
| Artículo | Cumple | Evidencia |
|---|---|---|
| I. Primacía de la spec | ✅ | El código implementa RF-01…RF-14. Revelar, promedio y nueva ronda con la misma tarea no existen (son de la 003). |
| II. Tipado estricto | ✅ | Ningún `any`, `@ts-ignore`, `@ts-expect-error` ni `@ts-nocheck` en los archivos de la 002 (grep). Únicos casts: `as const` en la lista de eventos y `listener as AnyListener` en el bus de `use-room-channel.ts`, interno y con tipos públicos estrictos. |
| III. UI y formularios | ✅ | Solo shadcn/ui (`textarea`, `alert-dialog`, `button`, `badge`, `separator`) + Tailwind. El formulario de tarea (`task-form.tsx`) usa React Hook Form + `zodResolver`. Móvil: comprobación con viewport de iPhone 13 (390 px), con título y link largos, las 10 cartas, el contador y los botones dentro de la tarjeta. |
| IV. Validación y persistencia | ✅ | `newTask`, `editTask`, `castVote`, `clearVote` y `getRoomState` validan su entrada con Zod (`safeParse`). Broadcasts `task`/`vote` validados al enviar (`taskEventPayload`/`voteEventPayload`) y al recibir (reducer). Carta validada con `cardSchema`. BD: modelos en `schema.prisma` + migración `voting`. Sin secretos en el cliente. |
| V. TDD | ✅ | Los 14 RF y todos sus criterios tienen pruebas en verde que los citan, escritas antes del código salvo las de infraestructura (T002), refactor (T010, cubierto por las e2e de la 001), verificación (T016, validada con mutación) y cobertura (T020). |
| VI. Integridad del voto | ✅ | VI.1–2: `getRoomState` solo devuelve `myVote` de quien llama y `voted` (ids); `voteEventSchema` es estricto y no admite `card`; e2e de RF-05 sin la carta en ningún frame ni respuesta. VI.3: `newTask`/`editTask` exigen `role = MODERATOR` en el servidor (`NOT_MODERATOR`). VI.4: `cardSchema` = baraja exacta (rechaza "4"). |

## 4. Problemas y acciones propuestas
Sin problemas pendientes. El aviso de la verificación anterior quedó resuelto:

| # | Problema | Resolución |
|---|---|---|
| 1 | RF-14: "sin moderador y sin tarea" no tenía prueba | T020: e2e con reloj simulado (aviso, sin controles, cartas desactivadas); pasó sin cambios en el código |

## 5. Observaciones
- **Los ID de RF se repiten entre specs** (RF-05 es "Apodo único" en la 001 y "Voto secreto" en
  la 002). Las pruebas citan solo `RF-NN`, así que buscar un ID mezcla features y la matriz
  tuvo que filtrarse por archivo. Propuesta para más adelante: citar `NNN/RF-NN` en los nombres
  de las pruebas (p. ej. `"002/RF-05: …"`). Afecta a la constitución (Art. V.1) y a las skills,
  así que iría por `sdd-change` (enmienda).
- **Tiempos ≤ 2 s medidos en desarrollo**, con la BD en `ca-central-1` (~146 ms por consulta).
  Votar ≈ 0,8 s; nueva tarea ≈ 0,8–1,0 s en el servidor. Producción (`sa-east-1` + Vercel `gru1`)
  aún no está desplegada ni medida.
