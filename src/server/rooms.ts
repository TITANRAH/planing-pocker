"use server";

import { cookies } from "next/headers";
import * as service from "@/server/room-service";
import type { CookieJar } from "@/server/session";

// Server Actions de la sala: conectan la lógica de room-service con las cookies de la petición.
// Toda la validación (Zod) y los permisos viven en room-service.

async function requestDeps(): Promise<service.Deps> {
  const store = await cookies();
  const jar: CookieJar = {
    get: (name) => store.get(name)?.value,
    set: (name, value, options) => {
      store.set(name, value, options);
    },
  };
  return { jar, now: new Date() };
}

export async function createRoom(input: unknown) {
  return service.createRoom(input, await requestDeps());
}

export async function joinRoom(input: unknown) {
  return service.joinRoom(input, await requestDeps());
}

export async function resumeSession(roomId: unknown) {
  return service.resumeSession(roomId, await requestDeps());
}

export async function renameAndResume(input: unknown) {
  return service.renameAndResume(input, await requestDeps());
}

export async function heartbeat(roomId: unknown) {
  return service.heartbeat(roomId, await requestDeps());
}

export async function markDisconnected(input: unknown) {
  return service.markDisconnected(input, await requestDeps());
}

export async function getRoomState(roomId: unknown) {
  return service.getRoomState(roomId, await requestDeps());
}
