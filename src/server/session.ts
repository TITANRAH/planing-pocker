import { tokenSchema } from "@/server/token";

// Acceso mínimo a las cookies; en producción lo implementa `cookies()` de Next
// (ver src/server/rooms.ts) y en las pruebas un sustituto en memoria.
export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

export interface CookieJar {
  get(name: string): string | undefined;
  set(name: string, value: string, options: CookieOptions): void;
}

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function sessionCookieName(roomId: string): string {
  return `pp_${roomId}`;
}

export function readSessionToken(jar: CookieJar, roomId: string): string | null {
  const parsed = tokenSchema.safeParse(jar.get(sessionCookieName(roomId)));
  return parsed.success ? parsed.data : null;
}

export function writeSessionToken(jar: CookieJar, roomId: string, token: string): void {
  jar.set(sessionCookieName(roomId), token, {
    httpOnly: true,
    // En local (http) los navegadores pueden rechazar cookies `secure`
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
