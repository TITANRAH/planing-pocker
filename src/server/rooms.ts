"use server";

import { requestDeps } from "@/server/request-deps";
import * as service from "@/server/room-service";

// Server Actions de la sala: conectan la lógica de room-service con las cookies de la petición.
// Toda la validación (Zod) y los permisos viven en room-service.

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

export async function newTask(input: unknown) {
  return service.newTask(input, await requestDeps());
}

export async function editTask(input: unknown) {
  return service.editTask(input, await requestDeps());
}

export async function castVote(input: unknown) {
  return service.castVote(input, await requestDeps());
}

export async function clearVote(input: unknown) {
  return service.clearVote(input, await requestDeps());
}
