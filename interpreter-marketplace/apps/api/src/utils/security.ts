import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hashed = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) return false;

  const computed = scryptSync(password, salt, 64);
  const original = Buffer.from(originalHash, 'hex');
  if (computed.length !== original.length) return false;
  return timingSafeEqual(computed, original);
}

export function makeToken() {
  return randomBytes(24).toString('hex');
}
