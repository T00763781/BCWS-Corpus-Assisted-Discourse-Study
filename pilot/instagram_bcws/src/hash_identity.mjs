import { createHmac } from 'node:crypto';

const PREFIX = 'ig_usr_';

export function canonicalizeHandle(handle) {
  return String(handle || '').trim().toLowerCase();
}

export function toPseudonym(handle, secret) {
  const canonical = canonicalizeHandle(handle);
  if (!canonical) {
    return null;
  }
  if (!secret) {
    throw new Error('IDENTITY_HMAC_SECRET is required for pseudonymization.');
  }

  const digest = createHmac('sha256', secret).update(canonical).digest('hex');
  return `${PREFIX}${digest.slice(0, 20)}`;
}