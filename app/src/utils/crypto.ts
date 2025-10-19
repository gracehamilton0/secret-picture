const AES_IV_LENGTH = 12;

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

async function importAesKey(keyHex: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const keyBytes = hexToBytes(keyHex);
  if (keyBytes.length !== 32) {
    throw new Error('AES key must be 32 bytes (256 bits)');
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, usages);
}

export async function encryptContent(plain: ArrayBuffer, keyHex: string): Promise<Uint8Array> {
  const key = await importAesKey(keyHex, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const encryptedBytes = new Uint8Array(encrypted);
  const payload = new Uint8Array(iv.length + encryptedBytes.length);
  payload.set(iv, 0);
  payload.set(encryptedBytes, iv.length);
  return payload;
}

export async function decryptContent(payload: Uint8Array, keyHex: string): Promise<Uint8Array> {
  if (payload.length <= AES_IV_LENGTH) {
    throw new Error('Encrypted payload too short');
  }
  const iv = payload.slice(0, AES_IV_LENGTH);
  const ciphertext = payload.slice(AES_IV_LENGTH);
  const key = await importAesKey(keyHex, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(decrypted);
}

export function detectMimeType(data: Uint8Array): string {
  if (data.length >= 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'image/png';
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 4 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38
  ) {
    return 'image/gif';
  }
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}
