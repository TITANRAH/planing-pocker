import { describe, expect, it } from "vitest";
import { byePayload, helloPayload } from "@/lib/realtime/outgoing";

describe("mensajes Realtime enviados", () => {
  it("RF-08: helloPayload devuelve el payload validado", () => {
    expect(helloPayload({ participantId: "p1", nickname: "Ana", role: "PLAYER" })).toEqual({
      participantId: "p1",
      nickname: "Ana",
      role: "PLAYER",
    });
  });

  it("RF-08: helloPayload rechaza datos inválidos antes de enviarlos", () => {
    expect(() => helloPayload({ participantId: "p1", nickname: "A", role: "PLAYER" })).toThrow();
    expect(() => helloPayload({ participantId: "p1", nickname: "Ana", role: "ADMIN" })).toThrow();
    expect(() => helloPayload({ participantId: "", nickname: "Ana", role: "PLAYER" })).toThrow();
  });

  it("RF-10: byePayload devuelve el payload validado y rechaza un id vacío", () => {
    expect(byePayload("p1")).toEqual({ participantId: "p1" });
    expect(() => byePayload("")).toThrow();
  });
});
