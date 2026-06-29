import { randomBytes } from "crypto";

/**
 * Generates a collision-resistant unique ID safe for use in URLs.
 * Only uses lowercase alphanumeric characters — no dots, dashes, or underscores.
 * Format: c + timestamp(base36) + random(hex) — 25 chars total.
 */
export function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(10).toString("hex");
  return `c${timestamp}${random}`.slice(0, 25);
}
