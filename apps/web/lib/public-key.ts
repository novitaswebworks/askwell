import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// "pk_" + 24 random letters and digits. It only identifies a project.
export function generatePublicKey(): string {
  let key = "pk_";
  for (let i = 0; i < 24; i++) key += ALPHABET[randomInt(ALPHABET.length)];
  return key;
}
