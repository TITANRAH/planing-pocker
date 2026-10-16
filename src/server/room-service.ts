import { Prisma } from "@/generated/prisma/client";
import { generateRoomId } from "@/lib/domain/room-id";
import {
  canJoin,
  isActive,
  isNicknameAvailable,
  normalizeNickname,
  type ParticipantState,
} from "@/lib/domain/room";
import {
  createRoomInput,
  joinRoomInput,
  markDisconnectedInput,
  type Role,
  roomIdSchema,
} from "@/lib/schemas/room";
import { db } from "@/server/db";
import { broadcastToRoom } from "@/server/realtime-broadcast";
import { type CookieJar, readSessionToken, writeSessionToken } from "@/server/session";
import { generateToken, hashToken } from "@/server/token";

// Lógica de las acciones de sala. Recibe las cookies y la hora como dependencias para poder
// probarla sin una petición HTTP; src/server/rooms.ts la expone como Server Actions.

export type ActionError =
  "VALIDATION" | "ROOM_NOT_FOUND" | "ROOM_FULL" | "NICKNAME_TAKEN" | "NOT_A_PARTICIPANT";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export type Deps = { jar: CookieJar; now: Date };

const fail = (error: ActionError): { ok: false; error: ActionError } => ({ ok: false, error });

export async function createRoom(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<{ roomId: string; participantId: string }>> {
  const parsed = createRoomInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomName, nickname } = parsed.data;

  const roomId = generateRoomId();
  const token = generateToken();
  const room = await db.room.create({
    data: {
      id: roomId,
      name: roomName,
      participants: {
        create: {
          nickname,
          nicknameKey: normalizeNickname(nickname),
          role: "MODERATOR",
          tokenHash: hashToken(token),
          lastSeenAt: now,
        },
      },
    },
    include: { participants: { select: { id: true } } },
  });

  writeSessionToken(jar, roomId, token);
  const [moderator] = room.participants;
  if (!moderator) throw new Error("La sala se creó sin moderador");
  return { ok: true, data: { roomId, participantId: moderator.id } };
}

type Tx = Prisma.TransactionClient;

// Bloquea la fila de la sala hasta el final de la transacción: las entradas a una misma sala se
// procesan de una en una, así el cupo y los apodos no se pueden saltar con peticiones simultáneas.
async function lockRoom(tx: Tx, roomId: string) {
  await tx.$executeRaw`SELECT 1 FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
  return tx.room.findUnique({
    where: { id: roomId },
    include: { participants: { orderBy: { createdAt: "asc" } } },
  });
}

// Retira el apodo a los participantes expirados que lo conservaban, para que otro pueda usarlo
async function releaseExpiredNickname(
  tx: Tx,
  participants: readonly ParticipantState[],
  nicknameKey: string,
  now: Date,
  exceptId?: string,
): Promise<void> {
  const expiredIds = participants
    .filter((p) => p.id !== exceptId && p.nicknameKey === nicknameKey && !isActive(p, now))
    .map((p) => p.id);
  if (expiredIds.length > 0) {
    await tx.participant.updateMany({
      where: { id: { in: expiredIds } },
      data: { nicknameKey: null },
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function joinRoom(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<{ participantId: string }>> {
  const parsed = joinRoomInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, nickname } = parsed.data;
  const nicknameKey = normalizeNickname(nickname);
  const token = generateToken();

  try {
    const result = await db.$transaction(
      async (tx): Promise<ActionResult<{ participantId: string }>> => {
        const room = await lockRoom(tx, roomId);
        if (!room) return fail("ROOM_NOT_FOUND");
        if (!canJoin(room.participants, now)) return fail("ROOM_FULL");
        if (!isNicknameAvailable(room.participants, nickname, now)) return fail("NICKNAME_TAKEN");

        await releaseExpiredNickname(tx, room.participants, nicknameKey, now);
        const participant = await tx.participant.create({
          data: {
            roomId,
            nickname,
            nicknameKey,
            role: "PLAYER",
            tokenHash: hashToken(token),
            lastSeenAt: now,
          },
        });
        return { ok: true, data: { participantId: participant.id } };
      },
    );

    if (result.ok) writeSessionToken(jar, roomId, token);
    return result;
  } catch (error) {
    // Último recurso: la restricción única de la BD detecta un apodo duplicado
    if (isUniqueViolation(error)) return fail("NICKNAME_TAKEN");
    throw error;
  }
}

export type SessionView = { participantId: string; nickname: string; role: Role };

type LockedRoom = NonNullable<Awaited<ReturnType<typeof lockRoom>>>;
type RoomParticipant = LockedRoom["participants"][number];

function findSelf(room: LockedRoom, jar: CookieJar): RoomParticipant | undefined {
  const token = readSessionToken(jar, room.id);
  if (!token) return undefined;
  const tokenHash = hashToken(token);
  return room.participants.find((p) => p.tokenHash === tokenHash);
}

// Vuelve a meter en la sala a un participante con el apodo indicado. Conserva su fila,
// y con ella su rol (RF-09, RF-11).
async function reactivate(
  tx: Tx,
  room: LockedRoom,
  me: RoomParticipant,
  nickname: string,
  now: Date,
): Promise<ActionResult<SessionView>> {
  const others = room.participants.filter((p) => p.id !== me.id);
  if (!isActive(me, now) && !canJoin(others, now)) return fail("ROOM_FULL");
  if (!isNicknameAvailable(room.participants, nickname, now, me.id)) return fail("NICKNAME_TAKEN");

  const nicknameKey = normalizeNickname(nickname);
  await releaseExpiredNickname(tx, room.participants, nicknameKey, now, me.id);
  const updated = await tx.participant.update({
    where: { id: me.id },
    data: { nickname, nicknameKey, lastSeenAt: now, disconnectedAt: null },
  });
  return {
    ok: true,
    data: { participantId: updated.id, nickname: updated.nickname, role: updated.role },
  };
}

async function withSelf<T>(
  roomId: string,
  jar: CookieJar,
  action: (tx: Tx, room: LockedRoom, me: RoomParticipant) => Promise<ActionResult<T>>,
  // Si quien llama no es participante, qué responder (por defecto, NOT_A_PARTICIPANT)
  onStranger: (room: LockedRoom) => ActionError = () => "NOT_A_PARTICIPANT",
): Promise<ActionResult<T>> {
  try {
    return await db.$transaction(async (tx) => {
      const room = await lockRoom(tx, roomId);
      if (!room) return fail("ROOM_NOT_FOUND");
      const me = findSelf(room, jar);
      if (!me) return fail(onStranger(room));
      return action(tx, room, me);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("NICKNAME_TAKEN");
    throw error;
  }
}

export async function resumeSession(
  roomIdInput: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<SessionView>> {
  const parsed = roomIdSchema.safeParse(roomIdInput);
  if (!parsed.success) return fail("VALIDATION");
  return withSelf(
    parsed.data,
    jar,
    (tx, room, me) => reactivate(tx, room, me, me.nickname, now),
    // Quien llega sin sesión a una sala llena lo sabe antes de elegir apodo (RF-06)
    (room) => (canJoin(room.participants, now) ? "NOT_A_PARTICIPANT" : "ROOM_FULL"),
  );
}

export async function renameAndResume(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<SessionView>> {
  const parsed = joinRoomInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, nickname } = parsed.data;
  return withSelf(roomId, jar, (tx, room, me) => reactivate(tx, room, me, nickname, now));
}

// Las acciones de una sesión en curso exigen que quien llama siga activo; si expiró, debe volver
// con resumeSession, que comprueba apodo y cupo.
async function withActiveSelf<T>(
  roomId: string,
  jar: CookieJar,
  now: Date,
  action: (tx: Tx, room: LockedRoom, me: RoomParticipant) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  return withSelf(roomId, jar, (tx, room, me) =>
    isActive(me, now) ? action(tx, room, me) : Promise.resolve(fail("NOT_A_PARTICIPANT")),
  );
}

export async function heartbeat(
  roomIdInput: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<null>> {
  const parsed = roomIdSchema.safeParse(roomIdInput);
  if (!parsed.success) return fail("VALIDATION");
  return withActiveSelf(parsed.data, jar, now, async (tx, _room, me) => {
    await tx.participant.update({
      where: { id: me.id },
      data: { lastSeenAt: now, disconnectedAt: null },
    });
    return { ok: true, data: null };
  });
}

export async function markDisconnected(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<null>> {
  const parsed = markDisconnectedInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, participantId } = parsed.data;
  return withActiveSelf(roomId, jar, now, async (tx) => {
    // Solo dentro de la misma sala, y sin pisar una marca existente (gana el primero)
    await tx.participant.updateMany({
      where: { id: participantId, roomId, disconnectedAt: null },
      data: { disconnectedAt: now },
    });
    return { ok: true, data: null };
  });
}

export type ParticipantView = {
  id: string;
  nickname: string;
  role: Role;
  disconnectedAt: Date | null;
};

export type RoomState = {
  room: { id: string; name: string };
  me: string;
  participants: ParticipantView[];
};

export async function getRoomState(
  roomIdInput: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<RoomState>> {
  const parsed = roomIdSchema.safeParse(roomIdInput);
  if (!parsed.success) return fail("VALIDATION");
  return withActiveSelf(parsed.data, jar, now, async (_tx, room, me) => ({
    ok: true,
    data: {
      room: { id: room.id, name: room.name },
      me: me.id,
      // Nunca se exponen tokens ni hashes
      participants: room.participants
        .filter((p) => isActive(p, now))
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          role: p.role,
          disconnectedAt: p.disconnectedAt,
        })),
    },
  }));
}

// Quien cierra la pestaña avisa con un beacon (RF-10): se avisa al canal por broadcast, porque su
// WebSocket ya no puede enviarlo, y se marca su desconexión. No bloquea la sala (no toca cupo ni
// apodos): una sola lectura para verificar la cookie y después ambas cosas en paralelo, para que
// los demás lo vean en ≤ 2 s.
export async function sayBye(
  roomIdInput: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<null>> {
  const parsed = roomIdSchema.safeParse(roomIdInput);
  if (!parsed.success) return fail("VALIDATION");
  const roomId = parsed.data;
  const token = readSessionToken(jar, roomId);
  if (!token) return fail("NOT_A_PARTICIPANT");

  const me = await db.participant.findFirst({ where: { roomId, tokenHash: hashToken(token) } });
  if (!me || !isActive(me, now)) return fail("NOT_A_PARTICIPANT");

  await Promise.all([
    broadcastToRoom(roomId, "bye", { participantId: me.id }),
    db.participant.updateMany({
      where: { id: me.id, disconnectedAt: null },
      data: { disconnectedAt: now },
    }),
  ]);
  return { ok: true, data: null };
}
