# Plan 002 — Cargar tarea y votar

- **Spec:** ./spec.md (versión 1.0)
- **Fecha:** 2026-10-16
- **Estado:** Aprobado (2026-10-16) · versión 1.1

## 1. Resumen técnico
Se añaden tres modelos (Task, Round, Vote) al esquema de Prisma. Toda acción de votación pasa por
Server Actions en `room-service.ts`, que validan con Zod y verifican en el servidor el rol y la
ronda. **El valor de un voto nunca sale del servidor salvo hacia quien lo emitió**: los demás
solo reciben "votó / no votó" (Art. VI). Los cambios llegan a los demás por **broadcast emitido
desde el servidor** (el mecanismo de `bye`, plan 001 v1.3), con payloads que no tienen campo de
carta. Cada cliente vuelve a pedir el estado completo al suscribirse y en cada latido (15 s),
como red de seguridad si se pierde un evento.

## 2. Chequeo de constitución
| Artículo | Cumple | Justificación |
|---|---|---|
| I. Primacía de la spec | ✅ | Solo RF-01…RF-14. Revelar, promedio y nueva ronda quedan fuera (003). |
| II. Tipado estricto | ✅ | Tipos desde Zod (`z.infer`) y Prisma; sin `any`. |
| III. UI y formularios | ✅ | shadcn/ui: se añaden `textarea` y `alert-dialog`. Los formularios de tarea usan RHF + `zodResolver`. Las cartas son `Button`s con `aria-pressed`. Mobile-first. |
| IV. Validación y persistencia | ✅ | Zod en las 4 acciones nuevas, en las cartas (`cardSchema`) y en los broadcasts `task` y `vote`, al enviar y al recibir. Modelo nuevo en `schema.prisma` con migración `voting`. |
| V. TDD | ✅ | Matriz §6: cada RF con prueba unitaria, de integración y/o e2e. |
| VI. Integridad del voto | ✅ | VI.1–2: `getRoomState` devuelve `myVote` solo para quien llama y `voted: string[]` para el resto; el broadcast `vote` = { roundId, participantId, voted }, **sin carta**; e2e que inspecciona todo lo que recibe el navegador de otro participante (RF-05). VI.3: `newTask`/`editTask` comprueban `role = MODERATOR` en el servidor. VI.4: `cardSchema` = la baraja exacta. |

## 3. Modelo de datos (`prisma/schema.prisma`)

```prisma
enum RoundStatus {
  OPEN
  CLOSED
}

model Task {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  title     String
  detail    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  rounds    Round[]

  @@index([roomId])
}

model Round {
  id       String      @id @default(cuid())
  roomId   String
  room     Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
  taskId   String
  task     Task        @relation(fields: [taskId], references: [id], onDelete: Cascade)
  status   RoundStatus @default(OPEN)
  openedAt DateTime    @default(now())
  closedAt DateTime?
  votes    Vote[]

  @@index([roomId, status])
}

model Vote {
  id            String      @id @default(cuid())
  roundId       String
  round         Round       @relation(fields: [roundId], references: [id], onDelete: Cascade)
  participantId String
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  card          String // validado con cardSchema ("?" y "☕" no son identificadores de enum válidos)
  updatedAt     DateTime    @updatedAt

  @@unique([roundId, participantId])
}
```

Se añaden las relaciones inversas en `Room` (`tasks`, `rounds`) y en `Participant` (`votes`).
Migración: `voting`.

**Reglas que asegura el código** (no se pueden expresar en Prisma):
- **Una sola ronda abierta: gana la más reciente.** `newTask` crea la tarea y su ronda en una
  consulta y después cierra, de forma atómica (`updateMany`), las demás rondas `OPEN` de la sala
  más antiguas que la nueva (por `openedAt` y, si empatan, por `id`). Si dos `newTask` coinciden,
  queda abierta solo la más reciente. Toda lectura de "la ronda abierta" toma la más reciente.
- "Nueva tarea" **borra los votos** de la ronda que cierra (RF-08); al volver alguien que había
  sido retirado (`reactivate` tras expirar), **se borran sus votos de la ronda abierta** (RF-11).
  El contador solo cuenta a participantes activos.

## 4. Contratos

**Esquemas Zod** (`src/lib/schemas/voting.ts`)
- `DECK = ["0","1","2","3","5","8","13","21","?","☕"]` · `cardSchema = z.enum(DECK)`
- `taskTitleSchema`: trim, 3–100 · `taskDetailSchema`: trim, ≤ 300, opcional (vacío → null)
- `newTaskInput` = { roomId, title, detail?, discardVotes: boolean }
- `editTaskInput` = { roomId, taskId, title, detail? }
- `castVoteInput` = { roomId, roundId, card } · `clearVoteInput` = { roomId, roundId }
- Broadcast: `taskEventSchema` = { roundId, task: { id, title, detail } } ·
  `voteEventSchema` = { roundId, participantId, voted: boolean }. **Sin campo de carta.**

**Server Actions** (`room-service.ts` + `rooms.ts`). Errores nuevos: `NOT_MODERATOR`,
`VOTES_PRESENT`, `ROUND_CLOSED`.

| Acción | Efecto | Quién | Broadcast |
|---|---|---|---|
| `newTask` | Si hay ronda abierta con votos y `discardVotes = false` → `VOTES_PRESENT`. Si no: crea Task + Round `OPEN` y cierra atómicamente las rondas abiertas anteriores, borrando sus votos. Sin bloquear la sala (≈ 3 viajes a la BD) | Moderador activo | `task` |
| `editTask` | Actualiza título/detalle de la tarea de la ronda abierta; votos intactos | Moderador activo | `task` |
| `castVote` | Valida la carta y que `roundId` sea la ronda abierta (si no → `ROUND_CLOSED`); crea o cambia el voto | Participante activo | `vote` (voted = true) solo si antes no había votado |
| `clearVote` | Borra el voto propio de la ronda abierta | Participante activo | `vote` (voted = false) |
| `getRoomState` (ampliada) | Añade `task`, `round` { id }, `voted: string[]` (ids activos que votaron) y `myVote: Card \| null`. **Nunca** las cartas de otros | Participante activo | — |

`reactivate` (001) además borra los votos del que vuelve tras expirar y emite `vote` (voted = false).

**Realtime**
- Mismo canal `room:<roomId>`. Eventos nuevos de broadcast `task` y `vote`, **solo emitidos
  por el servidor** (`broadcastToRoom`) tras confirmar la transacción.
- Para compartir el canal entre presence y votación, `useRoomPresence` se reorganiza en
  `useRoomChannel` (crea el canal y registra los handlers) más los estados de presence y de votación.
- Red de seguridad: cada cliente llama a `getRoomState` al suscribirse y en cada latido de 15 s.

## 5. UI
| Componente | Contenido | Estados |
|---|---|---|
| `TaskPanel` | Moderador: formulario "Nueva tarea" (título + detalle) y "Editar" sobre la actual; `AlertDialog` de confirmación si hay votos (RF-08). Resto: título y detalle | sin tarea ("Esperando a que el moderador cargue una tarea"), sin moderador (RF-14), con tarea |
| `CardDeck` | 10 cartas como `Button` con `aria-pressed`; tocar la carta elegida la quita (RF-04) | desactivada sin ronda abierta (RF-09), enviando |
| `ParticipantList` (ampliada) | Indicador "Votó" junto a quien votó (sin valor) | — |
| `VoteCounter` | "N de M votaron" (M = participantes de la lista) | — |

## 6. Matriz de trazabilidad
| RF | Diseño | Prueba |
|---|---|---|
| RF-01 | `newTask`, `TaskPanel` | unit `schemas/voting.test.ts` · integración `server/voting.test.ts` · e2e `voting.spec.ts` |
| RF-02 | broadcast `task` | e2e (otro navegador ve la tarea en ≤ 2 s) |
| RF-03 | `castVote`, `CardDeck` | unit (baraja) · integración · e2e |
| RF-04 | `castVote`/`clearVote` | integración · e2e (cambiar y quitar) |
| RF-05 | `getRoomState` sin cartas ajenas, `voteEventSchema` sin carta | integración (el estado de Beto no tiene la carta de Ana) · e2e (inspección de todas las respuestas y frames WebSocket de Beto) |
| RF-06 | broadcast `vote`, `VoteCounter`, `ParticipantList` | unit (reducer de votación) · e2e ("N de M" en ≤ 2 s; "?" cuenta) |
| RF-07 | `myVote` en `getRoomState` | integración · e2e (recarga) |
| RF-08 | `newTask` + `VOTES_PRESENT` + `AlertDialog` | integración (borra votos, cierra ronda) · e2e (confirmación) |
| RF-09 | `CardDeck` desactivada; `castVote` sin ronda → `ROUND_CLOSED` | integración · e2e |
| RF-10 | `getRoomState` con tarea, ronda y `voted` | integración · e2e (entra con 2 votos) |
| RF-11 | Contador solo con activos; `reactivate` borra votos | unit (plazos) · integración |
| RF-12 | `cardSchema`, `NOT_MODERATOR`, `NOT_A_PARTICIPANT`, `ROUND_CLOSED` | unit · integración |
| RF-13 | `editTask` | integración (votos intactos) · e2e (título corregido en ≤ 2 s) |
| RF-14 | Sin moderador activo en la lista → aviso; acciones de tarea rechazadas | integración · e2e (moderador retirado, con reloj simulado) |

## 7. Riesgos y decisiones
| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Broadcast `task`/`vote` emitido solo por el servidor | Emitido por el cliente por WebSocket | El servidor es la autoridad (Art. VI.3) y ningún cliente puede falsear "votó". **Riesgo:** acción + broadcast REST ≈ 1–1,6 s medido en la 001; queda cerca del límite de 2 s. Se mide en el e2e y, si no alcanza, se registra con `sdd-change`. |
| `card` como `String` validado con Zod | Enum de Prisma | "?" y "☕" no son identificadores válidos de un enum; la validación vive en `cardSchema` (Art. IV, VI.4). |
| Borrar los votos al reemplazar la tarea o al expirar | Guardarlos marcados como descartados | Es lo que pide la spec ("se descartan"); el historial de la 004 guardará solo estimaciones finales. |
| Volver a pedir el estado al suscribirse y cada 15 s | Confiar solo en los eventos | Un evento perdido (reconexión) se corrige en ≤ 15 s sin lógica de reenvío. |
| Reorganizar `useRoomPresence` en `useRoomChannel` | Abrir un segundo canal | Un solo WebSocket y canal por sala; misma suscripción para presence y votación. |
| Canal público (como en la 001) | Canales privados con RLS | Seguro para esta feature porque **ninguna carta viaja por Realtime**. Lo vuelve a revisar la 003 al revelar. |
| `newTask` sin bloqueo: "gana la ronda más reciente" | Transacción con `SELECT … FOR UPDATE` | Medido: en dev cada consulta cuesta ~146 ms (Supabase en `ca-central-1`) y la transacción con bloqueo (~9 viajes) + broadcast superaba los 2 s de RF-02 con las pruebas en paralelo. **Riesgo:** durante ~150 ms puede haber dos rondas abiertas si coinciden dos `newTask` (solo el moderador puede llamarlo); las lecturas toman la más reciente. |
| Acciones frecuentes sin bloqueo (`castVote`, `clearVote`, `editTask`, `heartbeat`, `markDisconnected`, `getRoomState`) y llamadas periódicas sin solaparse | Todas con `lockRoom` | Next ejecuta las Server Actions de cada navegador **en cola**: una acción lenta retrasa las siguientes. Ninguna de ellas toca el cupo ni la regla de una ronda abierta. Votar pasó de 1,8–2,8 s a ≈ 0,8 s. |
| Producción en `sa-east-1` (São Paulo) + Vercel `gru1` | Canadá | El equipo está en Sudamérica. Supabase no permitió elegir región para dev, así que dev queda en `ca-central-1`; **el proyecto de prod debe crearse en São Paulo**. |
| E2E con 2 workers | Paralelismo por defecto (5) | Las pruebas con límites de tiempo no deben medir la carga del equipo de pruebas. |

## 8. Historial de cambios
| Versión | Fecha | Tipo | Cambio |
|---|---|---|---|
| 1.0 | 2026-10-16 | Inicial | Versión inicial |
| 1.1 | 2026-10-16 | Mejora técnica | `newTask` sin bloqueo ("gana la ronda más reciente"); acciones frecuentes sin bloqueo y sin solaparse; región de prod `sa-east-1`; e2e con 2 workers. Spec sin cambios. |
