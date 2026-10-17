# Plan 003 — Revelar, consensuar y repetir

- **Spec:** ./spec.md (versión 1.0)
- **Fecha:** 2026-10-16
- **Estado:** Aprobado (2026-10-16) · versión 1.0

## 1. Resumen técnico
Una ronda pasa de `OPEN` a `REVEALED` en una transacción que guarda una **foto fija** de la ronda:
una fila por participante activo, con su apodo y su carta, o vacía si no votó. Esa foto es la
única fuente de las cartas reveladas (RF-03, RF-11) y solo existe tras revelar, así que nada
cambia para las rondas abiertas (Art. VI). El resumen (promedio, mínimo, máximo, consenso y
sugerencia) es una **función pura** compartida entre cliente y servidor, sin guardarse en la BD.
La estimación final vive en la tarea. Los avisos llegan por broadcast emitido desde el servidor,
como en la 002: `reveal` lleva la foto, `estimate` la estimación y "volver a votar" reutiliza
`task` con una ronda nueva.

## 2. Chequeo de constitución
| Artículo | Cumple | Justificación |
|---|---|---|
| I. Primacía de la spec | ✅ | Solo RF-01…RF-13. Historial y exportación (004) fuera. |
| II. Tipado estricto | ✅ | Tipos desde Zod y Prisma; la carta revelada se valida con `cardSchema`. |
| III. UI y formularios | ✅ | shadcn/ui (`button`, `badge`, `alert-dialog`, `card`); la estimación se elige con botones de carta (sin formulario de texto). Mobile-first. |
| IV. Validación y persistencia | ✅ | Zod en las 3 acciones nuevas y en los broadcasts `reveal`/`estimate` (al enviar y al recibir). Migración `reveal`. |
| V. TDD | ✅ | Matriz §6. El resumen es puro: pruebas unitarias exhaustivas de promedio, consenso y sugerencia. |
| VI. Integridad del voto | ✅ | VI.1–2: las cartas de otros solo salen del servidor desde una ronda `REVEALED` (foto + broadcast `reveal`); las rondas `OPEN` siguen sin cartas ajenas (pruebas de la 002 intactas). VI.3: revelar, fijar y volver a votar exigen `role = MODERATOR` en el servidor. VI.4: estimación = carta numérica de la baraja. |

## 3. Modelo de datos (`prisma/schema.prisma`)

```prisma
enum RoundStatus {
  OPEN
  REVEALED // nuevo
  CLOSED
}

model Round {
  // … campos de la 002
  revealedAt DateTime?
  entries    RevealEntry[]
}

// Foto fija de la ronda al revelar: una fila por participante activo en ese momento
model RevealEntry {
  id            String      @id @default(cuid())
  roundId       String
  round         Round       @relation(fields: [roundId], references: [id], onDelete: Cascade)
  participantId String
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  nickname      String // apodo al revelar (puede cambiar después)
  card          String? // null = "No votó"; validado con cardSchema

  @@unique([roundId, participantId])
}

model Task {
  // … campos de la 002
  estimate      String? // carta numérica; validada con estimateSchema
  estimatedAt   DateTime?
  estimatedById String?
  estimatedBy   Participant? @relation("TaskEstimatedBy", fields: [estimatedById], references: [id], onDelete: SetNull)
}
```

Migración: `reveal`.

**"Ronda actual"** = la ronda más reciente de la sala con estado `OPEN` o `REVEALED` (la misma
regla de "la más reciente" de la 002 v1.1). `CLOSED` sigue significando "reemplazada por una
tarea nueva". `newTask` no cambia: solo cierra rondas `OPEN`, así que tras revelar no pide
confirmación (RF-09) y la ronda revelada se conserva.

**Voto frente a revelar** (decisión del usuario): `castVote`/`clearVote` escriben dentro de una
transacción que toma `SELECT … FOR SHARE` sobre la fila de la ronda y comprueba `status = OPEN`.
`revealRound` toma `FOR UPDATE` sobre la misma fila, cambia el estado y guarda la foto en la misma
transacción. Así un voto o llega antes (y sale en la foto) o se rechaza con `ROUND_CLOSED`.

## 4. Contratos

**Dominio puro** (`src/lib/domain/reveal.ts`)
- `summarizeRound(cards: (Card | null)[])` → `{ average: number | null, min, max, consensus:
  boolean, voteCount, suggestion: NumericCard | null }`
  - Promedio solo con cartas numéricas; sin numéricas → `null` (RF-04).
  - Consenso: ≥ 2 votos y todos la misma carta numérica (RF-06).
  - Sugerencia: la carta numérica más cercana al promedio, con empate → la mayor; sin promedio → `null` (RF-07).
- `formatAverage(n)` → "5,3" / "5,0" (coma decimal, 1 decimal).

**Esquemas Zod** (`src/lib/schemas/reveal.ts`)
- `NUMERIC_CARDS = ["0","1","2","3","5","8","13","21"]` · `estimateSchema = z.enum(NUMERIC_CARDS)`
- `revealInput` = { roomId, roundId } · `setEstimateInput` = { roomId, roundId, card: estimateSchema }
- `revoteInput` = { roomId, roundId, confirm: boolean = false }
- Broadcast: `revealEventSchema` = { roundId, entries: [{ participantId, nickname, card: Card | null }] } ·
  `estimateEventSchema` = { taskId, roundId, estimate: NumericCard | null }

**Server Actions.** Errores nuevos: `NO_VOTES`, `ROUND_NOT_REVEALED`, `ESTIMATE_PRESENT`.

| Acción | Efecto | Quién | Broadcast |
|---|---|---|---|
| `revealRound` | Ronda actual `OPEN` con ≥ 1 voto (si no → `NO_VOTES`/`ROUND_CLOSED`) → `REVEALED` + foto de los activos | Moderador activo | `reveal` |
| `setEstimate` | Ronda actual `REVEALED` (si no → `ROUND_NOT_REVEALED`); guarda carta, quién y cuándo en la tarea | Moderador activo | `estimate` |
| `revote` | Ronda actual `REVEALED`; si la tarea tiene estimación y `confirm = false` → `ESTIMATE_PRESENT`. Si no: borra la estimación y abre una ronda `OPEN` nueva con la misma tarea | Moderador activo | `task` (ronda nueva) + `estimate` (null) |
| `castVote` / `clearVote` (cambian) | Escritura bajo `FOR SHARE` de la ronda; ronda no `OPEN` → `ROUND_CLOSED` | Participante activo | sin cambios |
| `getRoomState` (amplía) | `round` pasa a ser `{ id, status }`; si está `REVEALED`: `entries` (foto) y `estimate`. `voted`/`myVote` solo con la ronda `OPEN` | Participante activo | — |

**Realtime:** eventos de broadcast `reveal` y `estimate` en el mismo canal y bus (`useRoomChannel`),
emitidos solo por el servidor. La foto revelada **sí** lleva cartas: es el momento en que el Art. VI
lo permite.

## 5. UI
| Componente | Contenido | Estados |
|---|---|---|
| `RevealButton` (moderador) | "Revelar cartas" | desactivado: "Nadie votó todavía" (RF-01) |
| `RevealedRound` | Lista "Ana: 5" / "Carla: No votó" (foto) | — |
| `RoundSummary` | Promedio "5,3" o "Sin promedio", mínimo, máximo, "¡Consenso!" o "Solo votó 1 persona" | — |
| `EstimatePicker` (moderador) | Cartas numéricas con la sugerida marcada; "Fijar estimación" | sin sugerencia (RF-07) |
| `EstimateBadge` | "Estimación final: 8" | sin estimación |
| "Volver a votar" (moderador) | `AlertDialog` si hay estimación: "Se borrará la estimación final: 8" | — |
| `CardDeck` | Desactivada con la ronda revelada (RF-02) | — |

Sin moderador (RF-13): no aparecen `RevealButton`, `EstimatePicker` ni "Volver a votar".

## 6. Matriz de trazabilidad
| RF | Diseño | Prueba |
|---|---|---|
| RF-01 | `revealRound`, broadcast `reveal`, `RevealButton` | integración `server/reveal.test.ts` · e2e `reveal.spec.ts` (≤ 2 s; botón desactivado sin votos) |
| RF-02 | Estado `REVEALED`; `CardDeck` desactivada; `castVote` → `ROUND_CLOSED` | integración · e2e |
| RF-03 | Foto `RevealEntry`, `RevealedRound` | integración (foto con "No votó"; quien entra después no aparece) · e2e |
| RF-04 | `summarizeRound`, `formatAverage` | unit `domain/reveal.test.ts` · e2e |
| RF-05 | `summarizeRound` | unit · e2e |
| RF-06 | `summarizeRound` (≥ 2 votos) | unit · e2e |
| RF-07 | `summarizeRound.suggestion`, `setEstimate`, broadcast `estimate`, `EstimatePicker` | unit (empate, sin promedio) · integración (rechaza "?") · e2e (≤ 2 s) |
| RF-08 | `revote`, `ESTIMATE_PRESENT`, `AlertDialog` | integración · e2e |
| RF-09 | `newTask` sin cambios (solo cierra `OPEN`) | integración (sin `VOTES_PRESENT` tras revelar; la ronda revelada se conserva) · e2e |
| RF-10 | `getRoomState` con `entries` y `estimate` | integración · e2e (entra tras revelar) |
| RF-11 | La foto no depende de que el participante siga activo | integración (retirado → sigue en la foto) |
| RF-12 | `NOT_MODERATOR`, `NO_VOTES`, `FOR SHARE`/`FOR UPDATE` | integración (incluye voto y revelado simultáneos) |
| RF-13 | Acciones de moderador rechazadas si expiró; UI sin controles | integración · e2e (reloj simulado) |

## 7. Riesgos y decisiones
| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Bloqueo de la fila de la ronda (`FOR SHARE` al votar, `FOR UPDATE` al revelar) | Comprobación posterior del voto | Decisión del usuario: garantiza RF-12 sin casos raros. **Coste:** votar ≈ 1,3 s en dev (antes ≈ 0,8 s); en producción, unos ms. |
| Foto fija en tabla `RevealEntry` | JSON en `Round`; calcular desde `Vote` | Relacional y tipado; conserva el apodo al revelar y no depende de quién siga en la sala (RF-03, RF-11). Sirve a la 004 (historial). |
| Resumen calculado (función pura) | Guardarlo en la BD | Se deduce de la foto; evita incoherencias y se prueba en unitarias. |
| Broadcast `reveal` con las cartas | Solo `{ roundId }` y que cada cliente pida el estado | Una consulta menos por cliente para cumplir ≤ 2 s. Las cartas ya son públicas tras revelar (Art. VI). El canal sigue siendo público, como en la 001/002: quien tenga el link puede verlas, igual que entrando a la sala. |
| Estimación en `Task` | En `Round` | La spec habla de "la estimación final de la tarea"; volver a votar la borra (RF-08). |

## 8. Historial de cambios
| Versión | Fecha | Tipo | Cambio |
|---|---|---|---|
| 1.0 | 2026-10-16 | Inicial | Versión inicial |
