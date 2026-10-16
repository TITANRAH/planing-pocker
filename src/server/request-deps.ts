import { cookies } from "next/headers";
import type { Deps } from "@/server/room-service";
import type { CookieJar } from "@/server/session";

// Dependencias de room-service para una petición real: las cookies de Next y la hora actual
export async function requestDeps(): Promise<Deps> {
  const store = await cookies();
  const jar: CookieJar = {
    get: (name) => store.get(name)?.value,
    set: (name, value, options) => {
      store.set(name, value, options);
    },
  };
  return { jar, now: new Date() };
}
