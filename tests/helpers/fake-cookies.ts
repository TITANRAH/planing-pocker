import type { CookieJar, CookieOptions } from "@/server/session";

// Sustituto en memoria de las cookies de Next para las pruebas: cada instancia es un navegador
export class FakeCookieJar implements CookieJar {
  readonly store = new Map<string, { value: string; options: CookieOptions }>();

  get(name: string): string | undefined {
    return this.store.get(name)?.value;
  }

  set(name: string, value: string, options: CookieOptions): void {
    this.store.set(name, { value, options });
  }
}
