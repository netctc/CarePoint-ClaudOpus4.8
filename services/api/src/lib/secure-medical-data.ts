import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from './env';

type EncryptedPayload = {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  value: string;
};

function getKey() {
  return createHash('sha256').update(env.medicalProfileEncryptionKey).digest();
}

export function encryptMedicalJson(input: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(input), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    value: encrypted.toString('base64'),
  };
  return JSON.stringify(payload);
}

export function decryptMedicalJson<T>(cipherText: unknown, fallback: T): T {
  if (typeof cipherText !== 'string' || !cipherText.trim()) return fallback;
  try {
    const payload = JSON.parse(cipherText) as EncryptedPayload;
    if (payload.alg !== 'aes-256-gcm') return fallback;
    const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.value, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return fallback;
  }
}
