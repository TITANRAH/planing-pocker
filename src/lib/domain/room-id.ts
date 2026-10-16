const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const LENGTH = 12;

// Identificador de sala no deducible (RF-03): 12 caracteres aleatorios = 72 bits.
// Usa Web Crypto, disponible en el servidor y en el navegador. Como 256 es múltiplo de 64,
// `byte & 63` reparte los caracteres de forma uniforme.
export function generateRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte & 63]).join("");
}
