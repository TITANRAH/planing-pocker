import { Prisma } from "@/generated/prisma/client";
import { generateRoomId } from "@/lib/domain/room-id";
import {
  byePayload,
  estimateEventPayload,
  revealEventPayload,
  taskEventPayload,
  voteEventPayload,
} from "@/lib/realtime/outgoing";
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
import {
  estimateSchema,
  type NumericCard,
  type RevealEntryView,
  revealInput,
  revoteInput,
  setEstimateInput,
} from "@/lib/schemas/reveal";
import {
  type Card,
  cardSchema,
  castVoteInput,
  clearVoteInput,
  editTaskInput,
  newTaskInput,
  type TaskView,
} from "@/lib/schemas/voting";
import { db } from "@/server/db";
import { broadcastToRoom } from "@/server/realtime-broadcast";
import { type CookieJar, readSessionToken, writeSessionToken } from "@/server/session";
import { generateToken, hashToken } from "@/server/token";

// Lógica de las acciones de sala. Recibe las cookies y la hora como dependencias para poder
// probarla sin una petición HTTP; src/server/rooms.ts la expone como Server Actions.

export type ActionError =
  | "VALIDATION"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "NICKNAME_TAKEN"
  | "NOT_A_PARTICIPANT"
  | "NOT_MODERATOR"
  | "VOTES_PRESENT"
  | "ROUND_CLOSED"
  | "NO_VOTES"
  | "ROUND_NOT_REVEALED"
  | "ESTIMATE_PRESENT";

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

type Reactivated = { view: SessionView; clearedRoundId: string | null };

// "La ronda abierta" es siempre la más reciente (plan 002 v1.1, §3)
const LATEST_FIRST = [{ openedAt: "desc" as const }, { id: "desc" as const }];

function findOpenRound(tx: Tx, roomId: string) {
  return tx.round.findFirst({
    where: { roomId, status: "OPEN" },
    orderBy: LATEST_FIRST,
    include: { task: true, votes: { select: { participantId: true, card: true } } },
  });
}

async function resumeWith(
  roomId: string,
  jar: CookieJar,
  action: (tx: Tx, room: LockedRoom, me: RoomParticipant) => Promise<ActionResult<Reactivated>>,
  onStranger?: (room: LockedRoom) => ActionError,
): Promise<ActionResult<SessionView>> {
  const result = await withSelf(roomId, jar, action, onStranger);
  if (!result.ok) return result;
  const { view, clearedRoundId } = result.data;
  if (clearedRoundId) {
    await broadcastToRoom(
      roomId,
      "vote",
      voteEventPayload({
        roundId: clearedRoundId,
        participantId: view.participantId,
        voted: false,
      }),
    );
  }
  return { ok: true, data: view };
}

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
): Promise<ActionResult<Reactivated>> {
  const wasActive = isActive(me, now);
  const others = room.participants.filter((p) => p.id !== me.id);
  if (!isActive(me, now) && !canJoin(others, now)) return fail("ROOM_FULL");
  if (!isNicknameAvailable(room.participants, nickname, now, me.id)) return fail("NICKNAME_TAKEN");

  const nicknameKey = normalizeNickname(nickname);
  await releaseExpiredNickname(tx, room.participants, nicknameKey, now, me.id);
  const updated = await tx.participant.update({
    where: { id: me.id },
    data: { nickname, nicknameKey, lastSeenAt: now, disconnectedAt: null },
  });
  // Quien vuelve tras ser retirado de la sala pierde su voto de la ronda abierta (RF-11 de la 002)
  let clearedRoundId: string | null = null;
  if (!wasActive) {
    const round = await findOpenRound(tx, room.id);
    if (round) {
      const { count } = await tx.vote.deleteMany({
        where: { roundId: round.id, participantId: me.id },
      });
      if (count > 0) clearedRoundId = round.id;
    }
  }
  return {
    ok: true,
    data: {
      view: { participantId: updated.id, nickname: updated.nickname, role: updated.role },
      clearedRoundId,
    },
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
  return resumeWith(
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
  return resumeWith(roomId, jar, (tx, room, me) => reactivate(tx, room, me, nickname, now));
}

// Busca a quien llama por su cookie, sin bloquear la sala. Para las acciones frecuentes (latido,
// estado, votos): Next ejecuta las Server Actions de cada navegador en cola, así que deben ser
// rápidas para no retrasar a las demás (RF-02/RF-06 de la spec 002 piden ≤ 2 s).
async function findActiveSelf(client: Tx | typeof db, roomId: string, jar: CookieJar, now: Date) {
  const token = readSessionToken(jar, roomId);
  if (!token) return fail("NOT_A_PARTICIPANT");
  const me = await client.participant.findFirst({ where: { roomId, tokenHash: hashToken(token) } });
  if (!me || !isActive(me, now)) return fail("NOT_A_PARTICIPANT");
  return { ok: true as const, data: me };
}

export async function heartbeat(
  roomIdInput: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<null>> {
  const parsed = roomIdSchema.safeParse(roomIdInput);
  if (!parsed.success) return fail("VALIDATION");
  const me = await findActiveSelf(db, parsed.data, jar, now);
  if (!me.ok) return me;
  await db.participant.update({
    where: { id: me.data.id },
    data: { lastSeenAt: now, disconnectedAt: null },
  });
  return { ok: true, data: null };
}

export async function markDisconnected(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<null>> {
  const parsed = markDisconnectedInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, participantId } = parsed.data;
  const me = await findActiveSelf(db, roomId, jar, now);
  if (!me.ok) return me;
  // Solo dentro de la misma sala, y sin pisar una marca existente (gana el primero)
  await db.participant.updateMany({
    where: { id: participantId, roomId, disconnectedAt: null },
    data: { disconnectedAt: now },
  });
  return { ok: true, data: null };
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
  // Votación (spec 002). Con la ronda abierta nunca incluye las cartas de los demás (Art. VI)
  task: TaskView | null;
  round: { id: string; status: "OPEN" | "REVEALED" } | null;
  voted: string[];
  myVote: Card | null;
  // Revelado (spec 003): foto fija de la ronda revelada y estimación final de la tarea
  entries: RevealEntryView[];
  estimate: NumericCard | null;
};

export async function getRoomState(
  roomIdInput: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<RoomState>> {
  const parsed = roomIdSchema.safeParse(roomIdInput);
  if (!parsed.success) return fail("VALIDATION");
  const roomId = parsed.data;
  // Solo lectura: sin bloqueo y con las dos consultas en paralelo
  const [room, round] = await Promise.all([
    db.room.findUnique({
      where: { id: roomId },
      include: { participants: { orderBy: { createdAt: "asc" } } },
    }),
    db.round.findFirst({
      where: { roomId, status: { in: ["OPEN", "REVEALED"] } },
      orderBy: LATEST_FIRST,
      include: {
        task: true,
        votes: { select: { participantId: true, card: true } },
        entries: {
          orderBy: { participant: { createdAt: "asc" } },
          select: { participantId: true, nickname: true, card: true },
        },
      },
    }),
  ]);
  if (!room) return fail("ROOM_NOT_FOUND");
  const token = readSessionToken(jar, roomId);
  const tokenHash = token ? hashToken(token) : null;
  const me = room.participants.find((p) => p.tokenHash === tokenHash);
  if (!me || !isActive(me, now)) return fail("NOT_A_PARTICIPANT");

  const active = room.participants.filter((p) => isActive(p, now));
  const activeIds = new Set(active.map((p) => p.id));
  // Las cartas solo salen del servidor desde una ronda revelada (Art. VI); con la ronda abierta,
  // solo quién votó y la carta propia
  const open = round?.status === "OPEN" ? round : null;
  const revealed = round?.status === "REVEALED" ? round : null;
  const myCard = open?.votes.find((v) => v.participantId === me.id)?.card;
  return {
    ok: true,
    data: {
      room: { id: room.id, name: room.name },
      me: me.id,
      // Nunca se exponen tokens ni hashes
      participants: active.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        disconnectedAt: p.disconnectedAt,
      })),
      task: round ? taskView(round.task) : null,
      round: round
        ? { id: round.id, status: round.status === "REVEALED" ? "REVEALED" : "OPEN" }
        : null,
      voted: open ? open.votes.map((v) => v.participantId).filter((id) => activeIds.has(id)) : [],
      // Solo la carta propia; las demás no salen del servidor
      myVote: myCard ? cardSchema.parse(myCard) : null,
      entries: revealed
        ? revealed.entries.map((e) => ({
            ...e,
            card: e.card === null ? null : cardSchema.parse(e.card),
          }))
        : [],
      estimate: round ? estimateSchema.nullable().parse(round.task.estimate) : null,
    },
  };
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
    broadcastToRoom(roomId, "bye", byePayload(me.id)),
    db.participant.updateMany({
      where: { id: me.id, disconnectedAt: null },
      data: { disconnectedAt: now },
    }),
  ]);
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------------------------
// Votación (spec 002). El servidor es la autoridad: comprueba el rol y la ronda en cada acción
// (Art. VI.3) y nunca devuelve las cartas de los demás (Art. VI.1-2).

export type TaskResult = { roundId: string; task: TaskView };

const taskView = (task: { id: string; title: string; detail: string | null }): TaskView => ({
  id: task.id,
  title: task.title,
  detail: task.detail,
});

// Contexto de las acciones de votación que no necesitan bloquear la sala (no tocan el cupo ni la
// regla de una ronda abierta): quién llama y la ronda abierta, leídos en paralelo. Cada consulta
// es un viaje a la BD, y RF-02/RF-06/RF-13 piden ≤ 2 s.
async function votingContext(roomId: string, jar: CookieJar, now: Date) {
  const [me, open] = await Promise.all([
    findActiveSelf(db, roomId, jar, now),
    db.round.findFirst({
      where: { roomId, status: "OPEN" },
      orderBy: LATEST_FIRST,
      select: { id: true, taskId: true },
    }),
  ]);
  if (!me.ok) return me;
  return { ok: true as const, data: { me: me.data, open } };
}

// RF-01 y RF-08: carga una tarea nueva y abre su ronda; las rondas abiertas anteriores se cierran
// y sus votos se descartan (con confirmación previa si había votos). Sin bloquear la sala: la
// regla de una sola ronda abierta se mantiene con "gana la más reciente" (plan 002 v1.1, §3).
export async function newTask(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<TaskResult>> {
  const parsed = newTaskInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, title, detail, discardVotes } = parsed.data;
  const [self, open] = await Promise.all([
    findActiveSelf(db, roomId, jar, now),
    db.round.findFirst({
      where: { roomId, status: "OPEN" },
      orderBy: LATEST_FIRST,
      select: { id: true, _count: { select: { votes: true } } },
    }),
  ]);
  if (!self.ok) return self;
  if (self.data.role !== "MODERATOR") return fail("NOT_MODERATOR");
  const votes = open?._count.votes ?? 0;
  if (votes > 0 && !discardVotes) return fail("VOTES_PRESENT");

  // Dos escrituras simples: una escritura anidada abre una transacción implícita (más viajes)
  const task = await db.task.create({ data: { roomId, title, detail } });
  const round = await db.round.create({
    data: { roomId, taskId: task.id, openedAt: now },
    select: { id: true },
  });

  // Cierre atómico de las rondas abiertas anteriores a la nueva (por fecha y, si empatan, por id)
  await Promise.all([
    db.round.updateMany({
      where: {
        roomId,
        status: "OPEN",
        OR: [{ openedAt: { lt: now } }, { openedAt: now, id: { lt: round.id } }],
      },
      data: { status: "CLOSED", closedAt: now },
    }),
    open && votes > 0 ? db.vote.deleteMany({ where: { roundId: open.id } }) : null,
  ]);
  return announceTask(roomId, { ok: true, data: { roundId: round.id, task: taskView(task) } });
}

// RF-13: corrige el título o el detalle de la tarea actual sin tocar la ronda ni los votos
export async function editTask(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<TaskResult>> {
  const parsed = editTaskInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, taskId, title, detail } = parsed.data;
  const ctx = await votingContext(roomId, jar, now);
  if (!ctx.ok) return ctx;
  const { me, open } = ctx.data;
  if (me.role !== "MODERATOR") return fail("NOT_MODERATOR");
  if (!open || open.taskId !== taskId) return fail("ROUND_CLOSED");
  const task = await db.task.update({ where: { id: taskId }, data: { title, detail } });
  return announceTask(roomId, { ok: true, data: { roundId: open.id, task: taskView(task) } });
}

// RF-03, RF-04, RF-09, RF-12: vota o cambia la carta en la ronda abierta
export async function castVote(input: unknown, { jar, now }: Deps): Promise<ActionResult<null>> {
  const parsed = castVoteInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, roundId, card } = parsed.data;
  const ctx = await votingContext(roomId, jar, now);
  if (!ctx.ok) return ctx;
  const { me, open } = ctx.data;
  if (!open || open.id !== roundId) return fail("ROUND_CLOSED");

  // Bajo bloqueo compartido de la ronda (plan 003): si el moderador revela a la vez, el voto o
  // llega antes y sale en la foto, o espera al revelado y se rechaza (RF-12 de la 003)
  const where = { roundId, participantId: me.id };
  let written: { isFirstVote: boolean } | null;
  try {
    written = await db.$transaction(async (tx) => {
      if (!(await isRoundOpen(tx, roundId))) return null;
      const existing = await tx.vote.findUnique({ where: { roundId_participantId: where } });
      await tx.vote.upsert({
        where: { roundId_participantId: where },
        create: { ...where, card },
        update: { card },
      });
      return { isFirstVote: !existing };
    });
  } catch (error) {
    // Otra petición del mismo participante creó el voto a la vez: ya está registrado
    if (!isUniqueViolation(error)) throw error;
    written = { isFirstVote: false };
  }
  if (!written) return fail("ROUND_CLOSED");
  // Cambiar de carta no cambia "ya votó": solo se avisa del primer voto
  if (written.isFirstVote) await announceVote(roomId, roundId, me.id, true);
  return { ok: true, data: null };
}

// Comprueba que la ronda sigue abierta y la bloquea en modo compartido hasta el final de la
// transacción: revelar (FOR UPDATE) espera a que terminen los votos en curso
async function isRoundOpen(tx: Tx, roundId: string): Promise<boolean> {
  const [row] = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status"::text AS status FROM "Round" WHERE "id" = ${roundId} FOR SHARE`;
  return row?.status === "OPEN";
}

// RF-04: quita el voto propio de la ronda abierta
export async function clearVote(input: unknown, { jar, now }: Deps): Promise<ActionResult<null>> {
  const parsed = clearVoteInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, roundId } = parsed.data;
  const ctx = await votingContext(roomId, jar, now);
  if (!ctx.ok) return ctx;
  const { me, open } = ctx.data;
  if (!open || open.id !== roundId) return fail("ROUND_CLOSED");
  const count = await db.$transaction(async (tx) => {
    if (!(await isRoundOpen(tx, roundId))) return null;
    const deleted = await tx.vote.deleteMany({ where: { roundId, participantId: me.id } });
    return deleted.count;
  });
  if (count === null) return fail("ROUND_CLOSED");
  if (count > 0) await announceVote(roomId, roundId, me.id, false);
  return { ok: true, data: null };
}

// Avisos por broadcast tras confirmar la transacción (plan 002, §4)
async function announceTask(
  roomId: string,
  result: ActionResult<TaskResult>,
): Promise<ActionResult<TaskResult>> {
  if (result.ok) await broadcastToRoom(roomId, "task", taskEventPayload(result.data));
  return result;
}

async function announceVote(
  roomId: string,
  roundId: string,
  participantId: string,
  voted: boolean,
) {
  await broadcastToRoom(roomId, "vote", voteEventPayload({ roundId, participantId, voted }));
}

// ---------------------------------------------------------------------------------------------
// Revelado (spec 003). Solo el moderador revela, fija la estimación y vuelve a votar (Art. VI.3).

export type RevealResult = { roundId: string; entries: RevealEntryView[] };

// Ronda actual de la sala: la más reciente que no fue reemplazada (abierta o revelada)
function currentRound(roomId: string) {
  return db.round.findFirst({
    where: { roomId, status: { in: ["OPEN", "REVEALED"] } },
    orderBy: LATEST_FIRST,
    include: { task: true },
  });
}

// RF-01, RF-03, RF-12: revela la ronda abierta y guarda la foto fija de quienes están en la sala
export async function revealRound(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<RevealResult>> {
  const parsed = revealInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, roundId } = parsed.data;
  const self = await findActiveSelf(db, roomId, jar, now);
  if (!self.ok) return self;
  if (self.data.role !== "MODERATOR") return fail("NOT_MODERATOR");

  const result = await db.$transaction(async (tx): Promise<ActionResult<RevealResult>> => {
    // Bloqueo exclusivo: espera a los votos en curso y bloquea los nuevos hasta terminar
    const [row] = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text AS status FROM "Round"
      WHERE "id" = ${roundId} AND "roomId" = ${roomId} FOR UPDATE`;
    if (row?.status !== "OPEN") return fail("ROUND_CLOSED");
    const participants = await tx.participant.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
    });
    const votes = await tx.vote.findMany({ where: { roundId } });
    const cardOf = new Map(votes.map((v) => [v.participantId, cardSchema.parse(v.card)]));
    // Foto fija: quienes están en la sala al revelar, hayan votado o no (RF-03)
    const entries = participants
      .filter((p) => isActive(p, now))
      .map((p) => ({ participantId: p.id, nickname: p.nickname, card: cardOf.get(p.id) ?? null }));
    if (!entries.some((e) => e.card !== null)) return fail("NO_VOTES");
    await tx.round.update({
      where: { id: roundId },
      data: { status: "REVEALED", revealedAt: now },
    });
    await tx.revealEntry.createMany({ data: entries.map((e) => ({ roundId, ...e })) });
    return { ok: true, data: { roundId, entries } };
  });
  if (result.ok) await broadcastToRoom(roomId, "reveal", revealEventPayload(result.data));
  return result;
}

// RF-07: fija (o cambia) la estimación final de la tarea de la ronda revelada
export async function setEstimate(input: unknown, { jar, now }: Deps): Promise<ActionResult<null>> {
  const parsed = setEstimateInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, roundId, card } = parsed.data;
  const [self, round] = await Promise.all([
    findActiveSelf(db, roomId, jar, now),
    currentRound(roomId),
  ]);
  if (!self.ok) return self;
  if (self.data.role !== "MODERATOR") return fail("NOT_MODERATOR");
  if (!round || round.id !== roundId) return fail("ROUND_CLOSED");
  if (round.status !== "REVEALED") return fail("ROUND_NOT_REVEALED");

  await db.task.update({
    where: { id: round.taskId },
    data: { estimate: card, estimatedAt: now, estimatedById: self.data.id },
  });
  await broadcastToRoom(
    roomId,
    "estimate",
    estimateEventPayload({ taskId: round.taskId, roundId, estimate: card }),
  );
  return { ok: true, data: null };
}

// RF-08: abre una ronda nueva con la misma tarea; borra la estimación (con confirmación si estaba fijada)
export async function revote(
  input: unknown,
  { jar, now }: Deps,
): Promise<ActionResult<TaskResult>> {
  const parsed = revoteInput.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const { roomId, roundId, confirm } = parsed.data;
  const [self, round] = await Promise.all([
    findActiveSelf(db, roomId, jar, now),
    currentRound(roomId),
  ]);
  if (!self.ok) return self;
  if (self.data.role !== "MODERATOR") return fail("NOT_MODERATOR");
  if (!round || round.id !== roundId) return fail("ROUND_CLOSED");
  if (round.status !== "REVEALED") return fail("ROUND_NOT_REVEALED");
  if (round.task.estimate !== null && !confirm) return fail("ESTIMATE_PRESENT");

  const [next, task] = await Promise.all([
    db.round.create({
      data: { roomId, taskId: round.taskId, openedAt: now },
      select: { id: true },
    }),
    db.task.update({
      where: { id: round.taskId },
      data: { estimate: null, estimatedAt: null, estimatedById: null },
    }),
  ]);
  const result: TaskResult = { roundId: next.id, task: taskView(task) };
  await broadcastToRoom(roomId, "task", taskEventPayload(result));
  await broadcastToRoom(
    roomId,
    "estimate",
    estimateEventPayload({ taskId: task.id, roundId: next.id, estimate: null }),
  );
  return { ok: true, data: result };
}
