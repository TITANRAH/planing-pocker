import { describe, expect, it } from "vitest";
import {
  canJoin,
  countActive,
  isActive,
  isNicknameAvailable,
  MAX_PARTICIPANTS,
  normalizeNickname,
  type ParticipantState,
} from "@/lib/domain/room";

const NOW = new Date("2026-10-16T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const SEC = 1000;
const MIN = 60 * SEC;

function participant(overrides: Partial<ParticipantState> = {}): ParticipantState {
  return {
    id: "p",
    nicknameKey: "ana",
    lastSeenAt: ago(5 * SEC),
    disconnectedAt: null,
    ...overrides,
  };
}

describe("normalizeNickname", () => {
  it("RF-05: ignora mayúsculas y espacios al inicio y al final", () => {
    expect(normalizeNickname("  JUAN ")).toBe("juan");
    expect(normalizeNickname("Juan")).toBe(normalizeNickname("juan"));
  });
});

describe("isActive", () => {
  it("RF-10: un participante conectado con latido reciente está activo", () => {
    expect(isActive(participant(), NOW)).toBe(true);
  });

  it("RF-10: sigue activo a 1:59 de su desconexión", () => {
    const p = participant({
      disconnectedAt: ago(1 * MIN + 59 * SEC),
      lastSeenAt: ago(1 * MIN + 59 * SEC),
    });
    expect(isActive(p, NOW)).toBe(true);
  });

  it("RF-10: deja de estar activo a 2:01 de su desconexión", () => {
    const p = participant({
      disconnectedAt: ago(2 * MIN + 1 * SEC),
      lastSeenAt: ago(2 * MIN + 1 * SEC),
    });
    expect(isActive(p, NOW)).toBe(false);
  });

  it("RF-10: respaldo: sin marca de desconexión, expira a las 2:30 sin latido", () => {
    expect(isActive(participant({ lastSeenAt: ago(2 * MIN + 29 * SEC) }), NOW)).toBe(true);
    expect(isActive(participant({ lastSeenAt: ago(2 * MIN + 31 * SEC) }), NOW)).toBe(false);
  });
});

describe("cupo", () => {
  const full = (overrides: Partial<ParticipantState> = {}) =>
    Array.from({ length: MAX_PARTICIPANTS }, (_, i) =>
      participant({ id: `p${i}`, nicknameKey: `p${i}`, ...(i === 0 ? overrides : {}) }),
    );

  it("RF-06: el máximo es 15 participantes", () => {
    expect(MAX_PARTICIPANTS).toBe(15);
  });

  it("RF-06: con 14 activos se puede entrar y con 15 no", () => {
    expect(canJoin(full().slice(0, 14), NOW)).toBe(true);
    expect(canJoin(full(), NOW)).toBe(false);
    expect(countActive(full(), NOW)).toBe(15);
  });

  it("RF-06: un desconectado hace menos de 2 minutos sigue ocupando su lugar", () => {
    expect(canJoin(full({ disconnectedAt: ago(1 * MIN) }), NOW)).toBe(false);
  });

  it("RF-06: un desconectado hace más de 2 minutos libera su lugar", () => {
    expect(canJoin(full({ disconnectedAt: ago(2 * MIN + 1 * SEC) }), NOW)).toBe(true);
  });
});

describe("isNicknameAvailable", () => {
  it("RF-05: un apodo en uso no está disponible, sin distinguir mayúsculas", () => {
    const ps = [participant({ nicknameKey: "juan" })];
    expect(isNicknameAvailable(ps, "Juan", NOW)).toBe(false);
    expect(isNicknameAvailable(ps, "  JUAN ", NOW)).toBe(false);
    expect(isNicknameAvailable(ps, "Pedro", NOW)).toBe(true);
  });

  it("RF-05: el apodo de un desconectado hace menos de 2 minutos sigue reservado", () => {
    const ps = [participant({ nicknameKey: "juan", disconnectedAt: ago(1 * MIN) })];
    expect(isNicknameAvailable(ps, "Juan", NOW)).toBe(false);
  });

  it("RF-05: el apodo de un participante expirado queda libre", () => {
    const ps = [
      participant({ nicknameKey: "juan", disconnectedAt: ago(3 * MIN), lastSeenAt: ago(3 * MIN) }),
    ];
    expect(isNicknameAvailable(ps, "Juan", NOW)).toBe(true);
  });

  it("RF-09: el propio participante no bloquea su apodo al volver", () => {
    const ps = [participant({ id: "yo", nicknameKey: "juan" })];
    expect(isNicknameAvailable(ps, "Juan", NOW, "yo")).toBe(true);
  });
});
