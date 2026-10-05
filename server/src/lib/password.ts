import { createHash } from "crypto";

const SALT = createHash("sha256").update("familychat_salt_2024").digest("hex").slice(0, 16);

export function hashPassword(password: string): string {
  return createHash("sha256").update(`${SALT}${password}`).digest("hex");
}

export function checkPassword(password: string, storedHash: string): boolean {
  if (storedHash === hashPassword(password)) return true;
  // обратная совместимость со старым форматом без соли (legacy-сид/аккаунты с poehali.dev)
  const plainHash = createHash("sha256").update(password).digest("hex");
  return storedHash.endsWith(plainHash);
}
