import { z } from "zod";

// Emite un mensaje broadcast a un canal de Supabase Realtime desde el servidor, con su API REST.
// Se usa para avisos que el navegador no puede enviar por WebSocket al cerrarse (plan v1.3).

const envSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

export async function broadcastToRoom(
  roomId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const env = envSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  const response = await fetch(`${env.url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.publishableKey },
    body: JSON.stringify({
      messages: [{ topic: `room:${roomId}`, event, payload, private: false }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Realtime rechazó el broadcast (${response.status}): ${await response.text()}`);
  }
}
