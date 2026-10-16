import { describe, expect, it } from "vitest";
import {
  hasVoted,
  initialVotingState,
  voteCount,
  votingReducer,
  type VotingState,
} from "@/lib/realtime/voting";

const task = { id: "t1", title: "Login", detail: null };

function start(): VotingState {
  return initialVotingState({ task, round: { id: "r1" }, voted: ["a"], myVote: "5" });
}

describe("votingReducer", () => {
  it("RF-10: el estado completo inicializa tarea, ronda, quién votó y mi voto", () => {
    const state = start();
    expect(state).toMatchObject({ task, roundId: "r1", myVote: "5" });
    expect(hasVoted(state, "a")).toBe(true);
    expect(hasVoted(state, "b")).toBe(false);
  });

  it("RF-09: sin ronda no hay tarea ni votos", () => {
    const state = initialVotingState({ task: null, round: null, voted: [], myVote: null });
    expect(state).toMatchObject({ task: null, roundId: null, myVote: null });
  });

  it("RF-08: una tarea con ronda nueva vacía quién votó y mi voto", () => {
    const state = votingReducer(start(), {
      type: "task",
      payload: { roundId: "r2", task: { id: "t2", title: "Logout", detail: "PP-13" } },
    });
    expect(state).toMatchObject({
      roundId: "r2",
      task: { id: "t2", title: "Logout" },
      myVote: null,
    });
    expect(hasVoted(state, "a")).toBe(false);
  });

  it("RF-13: editar la tarea de la misma ronda solo cambia el texto", () => {
    const state = votingReducer(start(), {
      type: "task",
      payload: { roundId: "r1", task: { id: "t1", title: "Login con Google", detail: null } },
    });
    expect(state).toMatchObject({
      roundId: "r1",
      task: { title: "Login con Google" },
      myVote: "5",
    });
    expect(hasVoted(state, "a")).toBe(true);
  });

  it("RF-06: un evento de voto marca o desmarca a quien votó", () => {
    let state = votingReducer(start(), {
      type: "vote",
      payload: { roundId: "r1", participantId: "b", voted: true },
    });
    expect(hasVoted(state, "b")).toBe(true);
    state = votingReducer(state, {
      type: "vote",
      payload: { roundId: "r1", participantId: "a", voted: false },
    });
    expect(hasVoted(state, "a")).toBe(false);
  });

  it("RF-06: un voto de otra ronda se ignora", () => {
    const state = start();
    expect(
      votingReducer(state, {
        type: "vote",
        payload: { roundId: "vieja", participantId: "b", voted: true },
      }),
    ).toBe(state);
  });

  it("RF-04: mi voto cambia o se quita en la ronda actual", () => {
    let state = votingReducer(start(), { type: "myVote", roundId: "r1", card: "8" });
    expect(state.myVote).toBe("8");
    state = votingReducer(state, { type: "myVote", roundId: "r1", card: null });
    expect(state.myVote).toBeNull();
    expect(votingReducer(state, { type: "myVote", roundId: "vieja", card: "3" })).toBe(state);
  });

  it("RF-06/RF-11: el contador solo cuenta a quien está en la lista de participantes", () => {
    let state = votingReducer(start(), {
      type: "vote",
      payload: { roundId: "r1", participantId: "x", voted: true },
    });
    state = votingReducer(state, {
      type: "vote",
      payload: { roundId: "r1", participantId: "b", voted: true },
    });
    // "x" ya no está en la sala: no cuenta
    expect(voteCount(state, ["a", "b", "c"])).toEqual({ voted: 2, total: 3 });
  });

  it("RF-05: ignora eventos inválidos, incluidos los que traen una carta", () => {
    const state = start();
    expect(
      votingReducer(state, { type: "vote", payload: { roundId: "r1", participantId: "b" } }),
    ).toBe(state);
    expect(
      votingReducer(state, {
        type: "vote",
        payload: { roundId: "r1", participantId: "b", voted: true, card: "13" },
      }),
    ).toBe(state);
    expect(votingReducer(state, { type: "task", payload: { roundId: "r2" } })).toBe(state);
  });
});
