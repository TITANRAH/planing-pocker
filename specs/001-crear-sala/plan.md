# Plan 001 — Crear sala y unirse

- **Spec:** ./spec.md (versión 1.0)
- **Fecha:** 2026-10-16
- **Estado:** Aprobado (2026-10-16) · versión 1.3

## 1. Resumen técnico
Al ser la primera feature, incluye montar el proyecto: Next.js (App Router) + TypeScript strict,
Tailwind + shadcn/ui, Prisma sobre el Postgres de Supabase, Vitest y Playwright, con un proyecto de
Supabase en la nube (plan Free) para desarrollo y pruebas, y otro para producción.
Node 22 LTS fijado con `.nvmrc`.
La sala y sus participantes se guardan en Postgres vía Prisma; cada participante se identifica
con un token secreto en una cookie httpOnly (en BD solo se guarda su hash).
La conexión en vivo usa Supabase Realtime **presence** en un canal por sala. Un "latido" cada
15 s y la marca de desconexión en BD permiten reservar apodo y cupo durante 2 minutos sin
servidores persistentes ni cron.

## 2. Chequeo de constitución
| Artículo | Cumple | Justificación |
|---|---|---|
| I. Primacía de la spec | ✅ | Solo se implementan RF-01…RF-11. El montaje del proyecto es preparación, no funcionalidad. |
| II. Tipado estricto | ✅ | `"strict": true`, ESLint con `no-explicit-any`, tipos derivados de Zod (`z.infer`) y de Prisma. |
| III. UI y formularios | ✅ | Solo shadcn/ui (card, input, button, form, label, badge, skeleton, sonner) + Tailwind. Los 2 formularios usan RHF + `zodResolver`. Diseño mobile-first. |
| IV. Validación y persistencia | ✅ | Zod en todas las Server Actions, en el `roomId` de la URL, en el formato del token de la cookie y en los payloads de presence recibidos. Modelo en `schema.prisma` con migración. La `service_role` key no se usa. |
| V. TDD | ✅ | Cada RF tiene prueba (matriz §6). Dominio puro con Vitest; Server Actions con Vitest contra la BD local; flujos multijugador con Playwright. |
| VI. Integridad del voto | ✅ | No hay votos en esta feature. Sienta la base: el servidor identifica al moderador por su token, nunca por datos enviados desde el cliente. |

## 3. Modelo de datos (`prisma/schema.prisma`)

```prisma
enum Role {
  MODERATOR
  PLAYER
}

model Room {
  id           String        @id            // 12 caracteres aleatorios base64url (RF-03)
  name         String
  createdAt    DateTime      @default(now())
  participants Participant[]
}

model Participant {
  id             String    @id @default(cuid())
  roomId         String
  room           Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  nickname       String                    // tal como lo escribió (para mostrar)
  nicknameKey    String?                   // normalizado (trim + minúsculas); null = apodo liberado
  role           Role
  tokenHash      String    @unique         // SHA-256 del token de la cookie
  lastSeenAt     DateTime  @default(now()) // último latido
  disconnectedAt DateTime?                 // cuándo se lo vio desconectado; null = conectado
  createdAt      DateTime  @default(now())

  @@unique([roomId, nicknameKey])
  @@index([roomId])
}
```

Migración inicial: `init_rooms`.

**Regla de "activo"** (función de dominio pura `isActive(p, now)`): un participante está activo si
`disconnectedAt` es null o tiene menos de 2 min, y además su `lastSeenAt` tiene menos de 2 min 30 s
(respaldo para cuando nadie observó la desconexión). Solo los activos cuentan para el cupo de 15
(RF-06) y reservan el apodo (RF-05). Al expirar, la fila **no se borra**: conserva token y rol,
así quien vuelve tras más de 2 minutos recupera su rol (RF-09, RF-11). Al expirar se libera
`nicknameKey` (pasa a null) en el momento en que otra persona necesita ese apodo.

## 4. Contratos

**Esquemas Zod** (`src/lib/schemas/room.ts`)
- `roomNameSchema`: string, trim, 3–50.
- `nicknameSchema`: string, trim, 2–20.
- `roomIdSchema`: 12 caracteres `[A-Za-z0-9_-]`.
- `createRoomInput` = { roomName, nickname } · `joinRoomInput` = { roomId, nickname }.
- `presencePayloadSchema` = { participantId, nickname, role }.

**Dominio puro** (`src/lib/domain/room.ts`): `normalizeNickname`, `isActive`, `countActive`,
`canJoin` (cupo) y `isNicknameAvailable`. Todas reciben `now` como parámetro para poder probar
los plazos sin esperar.

**Server Actions** (`src/server/rooms.ts`). Todas validan con Zod y devuelven
`{ ok: true, data } | { ok: false, error }`, con
`error ∈ VALIDATION | ROOM_NOT_FOUND | ROOM_FULL | NICKNAME_TAKEN | NOT_A_PARTICIPANT`.

| Acción | Entrada | Efecto | Quién puede llamarla |
|---|---|---|---|
| `createRoom` | `createRoomInput` | Crea la sala y su moderador en una transacción, pone la cookie y devuelve `roomId` | Cualquiera |
| `joinRoom` | `joinRoomInput` | En una transacción: comprueba cupo y apodo entre los activos, libera apodos expirados, crea el jugador y pone la cookie | Cualquiera con el link |
| `resumeSession` | `roomId` | Lee la cookie. Si la fila sigue activa, la reanuda. Si expiró, reintenta con el mismo apodo y rol, o devuelve `NICKNAME_TAKEN` / `ROOM_FULL` | El dueño de la cookie |
| `renameAndResume` | `roomId`, `nickname` | Cuando el apodo anterior quedó ocupado, cambia el apodo **de la misma fila** (conserva el rol) | El dueño de la cookie |
| `heartbeat` | `roomId` | `lastSeenAt = now` y `disconnectedAt = null` | El dueño de la cookie |
| `markDisconnected` | `roomId`, `participantId` | Si `disconnectedAt` es null, lo pone a `now` | Otro participante de la sala (cookie válida) |
| `getRoomState` | `roomId` | Nombre de la sala y participantes activos (sin tokens ni hashes) | Cualquier participante |
| `sayBye` (ruta `POST /api/rooms/[roomId]/bye`, vía `sendBeacon`) | `roomId` | Marca `disconnectedAt = now` de quien llama y emite `bye` por broadcast desde el servidor (API REST de Realtime con la publishable key) | El dueño de la cookie, si sigue activo |

**Cookie:** `pp_<roomId>` con 32 bytes aleatorios en base64url; `httpOnly`, `secure`,
`sameSite=lax`, duración 1 año (la spec no prevé caducidad).

**Realtime** (Supabase presence)
- Canal `room:<roomId>`, con el `participantId` como clave de presence.
- Al entrar: `track(presencePayload)`.
- `sync/join` → se marca como conectado. `leave` → el cliente que lo observa llama a
  `markDisconnected` (si varios lo llaman, gana el primero) y programa la retirada visual a
  `disconnectedAt + 2 min`.
- Todos los payloads recibidos se validan con `presencePayloadSchema`; los inválidos se ignoran.
- **Broadcast**, en el mismo canal, para los avisos que necesitan llegar en ≤ 2 s:
  - `hello` (payload = `presencePayloadSchema`): cada cliente lo envía al suscribirse y cada 15 s
    junto a su `track`. Quien lo recibe lo trata como un anuncio ("seen").
  - `bye` (payload = `byePayloadSchema` = { participantId }): en `pagehide` (al cerrar la pestaña
    o salir de la página) el cliente envía `navigator.sendBeacon` a `POST /api/rooms/<roomId>/bye`.
    El servidor valida `roomId` (Zod) y la cookie, marca la desconexión en la BD y emite el
    broadcast `bye`. Quien lo recibe lo marca desconectado al instante.
  - En `pageshow` con `persisted` (la página vuelve de la caché del navegador), el cliente se
    vuelve a anunciar (`hello` + `track` + heartbeat).
- La presence sigue siendo la fuente de verdad de quién está en el canal; el broadcast solo
  adelanta los avisos. Los payloads de broadcast también se validan con Zod.
- El cliente abre la conexión de Realtime al cargar la página de la sala, antes de entrar.
- Tiempos: entrada ≤ 2 s (`hello`); cierre de pestaña ≤ 2 s (`bye`, con `leave` de respaldo);
  red caída ≤ 30 s (25 s sin `hello` ni `track`).

**Entorno** (`.env.local`, fuera de git; nombres en `.env.example`)
- `DATABASE_URL`: cadena del pooler de Supabase (puerto 6543, modo transacción) para la app.
- `DIRECT_URL`: conexión directa (puerto 5432), solo para `prisma migrate`.
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key; reemplaza a la antigua anon key): para Realtime en el cliente.
- Las pruebas de integración y e2e crean salas con el prefijo `test-` en el nombre y las
  borran al terminar (`onDelete: Cascade` elimina también sus participantes).

## 5. UI
| Ruta | Contenido | Estados |
|---|---|---|
| `/` | `CreateRoomForm` (nombre de sala + apodo) | enviando, error de validación |
| `/r/[roomId]` | Sala no encontrada (RF-07) · `JoinRoomForm` (sin cookie o con apodo ocupado) · "Sala llena (15/15)" · `RoomView` | cargando (skeleton), no existe, llena, error |

`RoomView`: cabecera con el nombre de la sala y `CopyLinkButton` (toast "Link copiado", RF-02)
más `ParticipantList` (apodo, punto verde o gris según la conexión, badge "Moderador").
Todo en español y mobile-first.

## 6. Matriz de trazabilidad
| RF | Diseño | Prueba |
|---|---|---|
| RF-01 | `createRoom`, `CreateRoomForm` | unit `schemas/room.test.ts` · integración `server/rooms.test.ts` · e2e `create-room.spec.ts` |
| RF-02 | `CopyLinkButton` | e2e `create-room.spec.ts` (lee el portapapeles) |
| RF-03 | `generateRoomId` (crypto, 12 caracteres) | unit `domain/room-id.test.ts` |
| RF-04 | `joinRoom`, `JoinRoomForm` | integración `server/rooms.test.ts` · e2e `join-room.spec.ts` |
| RF-05 | `normalizeNickname`, `isNicknameAvailable`, `@@unique` | unit `domain/room.test.ts` · integración |
| RF-06 | `canJoin`, `countActive` | unit (con `now` simulado) · integración |
| RF-07 | `/r/[roomId]` sala no encontrada | e2e `join-room.spec.ts` |
| RF-08 | presence + `ParticipantList` | e2e `presence.spec.ts` (2 navegadores, aparece en ≤ 2 s) |
| RF-09 | cookie + `resumeSession`, `renameAndResume` | integración · e2e `presence.spec.ts` (recarga) |
| RF-10 | `bye` (beacon → `sayBye`), `leave` → `markDisconnected`, `isActive` | unit (plazos, `bye`) · integración (`sayBye` emite el broadcast) · e2e (cierre ≤ 2 s saliendo de la página, `setOffline` ≤ 30 s, retirada con reloj simulado) |
| RF-11 | Rol guardado en la fila y recuperado por token | integración · e2e (el moderador recarga) |

## 7. Riesgos y decisiones
| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Token propio en cookie httpOnly | Supabase Anonymous Auth | Decisión del usuario: más simple, sin mezclar sesiones con Prisma. |
| Supabase en la nube (plan Free): `dev` para desarrollo y pruebas, `prod` para producción | Supabase local con CLI + Docker | Decisión del usuario (cambio v1.1): sin Docker. **Riesgos:** dev y pruebas comparten la BD (se mitiga con datos `test-` y limpieza); el plan Free pausa el proyecto tras 7 días sin actividad (se reactiva desde el panel). |
| Canal Realtime público protegido por un `roomId` no deducible | Canales privados con RLS | Los canales privados exigen Supabase Auth. **Riesgo:** quien conozca el link puede escuchar la presence; aceptable porque solo viajan apodos. Hay que revisarlo en la feature 002: los votos **nunca** viajarán por Realtime (Art. VI). |
| Expiración "perezosa" calculada con `now` | Cron o servidor persistente | Vercel es serverless; así no hay procesos en segundo plano. |
| `markDisconnected` lo reportan los demás clientes | Solo heartbeat | Da la precisión de 2 min que pide la spec. El respaldo de 2 min 30 s del heartbeat cubre el caso en que no queda nadie en la sala. |
| ID de sala con `crypto` (sin dependencias) | nanoid / UUID | Unos 72 bits de aleatoriedad en 12 caracteres para la URL; cumple RF-03. |
| Prisma vía pooler de conexiones en producción | Conexión directa | Las funciones serverless agotan las conexiones directas; se usa `directUrl` para las migraciones. |
| Node 22 LTS con `.nvmrc` y `engines` | Node 20 | pnpm 11 exige Node ≥ 22.13. |
| Broadcast `hello`/`bye` además de la presence | Solo presence | Medido: la presence se replica entre servidores de Realtime por lotes (~2,2 s), por encima del límite de 2 s de RF-08/RF-10; el broadcast se reenvía al momento. `bye` en `pagehide` es "mejor esfuerzo": si el navegador no llega a enviarlo, actúa `leave` y, en último caso, los 25 s de silencio. |
| `bye` por `sendBeacon` a una ruta del servidor, que emite el broadcast | `bye` por WebSocket desde el cliente | Medido: el WebSocket se cierra con la página y el `bye` llegó 1 de 3 veces; `sendBeacon` está diseñado para entregarse al cerrar. **Riesgo:** sigue siendo "mejor esfuerzo"; si no llega, actúan `leave` (~2 s) y los 25 s de silencio. |

## 8. Historial de cambios
| Versión | Fecha | Tipo | Cambio |
|---|---|---|---|
| 1.0 | 2026-10-16 | Inicial | Versión inicial |
| 1.1 | 2026-10-16 | Mejora técnica | Supabase local → nube (plan Free); Node 22 con `.nvmrc`. Spec sin cambios. |
| 1.2 | 2026-10-16 | Mejora técnica | Broadcast `hello`/`bye` junto a la presence para cumplir ≤ 2 s (RF-08/RF-10); conexión de Realtime abierta por adelantado. Spec sin cambios. |
| 1.3 | 2026-10-16 | Mejora técnica | `bye` por `sendBeacon` a `POST /api/rooms/[roomId]/bye`, que marca la desconexión y emite el broadcast desde el servidor; nuevo anuncio en `pageshow`. Spec sin cambios. |
