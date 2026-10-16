import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Cliente de Supabase para el navegador: solo se usa para Realtime (presence).
// Los datos van por Prisma en el servidor; aquí solo viajan la URL y la clave pública.

const envSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  // Referencias literales para que Next las incluya en el bundle del cliente
  const env = envSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  client = createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
