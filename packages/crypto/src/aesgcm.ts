/**
 * AES-256-GCM authenticated encryption (NFR-SEC: at-rest device + cloud).
 *
 * Envelope wire format (one Uint8Array, base64-encoded when persisted):
 *   byte 0      : version (0x01)
 *   bytes 1..12 : 12-byte IV (96-bit, GCM standard)
 *   bytes 13..  : ciphertext || 16-byte GCM auth tag (as produced by WebCrypto)
 *
 * Optional AAD (additional authenticated data) binds context — e.g. a file id or
 * a "purpose" label — into the auth tag without encrypting it. Decryption with the
 * wrong AAD fails the tag check, exactly like tampering.
 */

import { randomBytes } from "./random.js";

const VERSION = 0x01;
const IV_LEN = 12;

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error(
      "WebCrypto subtle unavailable. In React Native, provide a polyfill (e.g. react-native-quick-crypto)."
    );
  }
  return c.subtle;
}

/**
 * Coerce a Uint8Array to BufferSource. TS 5.7+ types Uint8Array as
 * Uint8Array<ArrayBufferLike>, whose buffer may be a SharedArrayBuffer; WebCrypto
 * wants an ArrayBuffer-backed view. Our arrays are always ArrayBuffer-backed, so
 * this cast is sound.
 */
function bs(u: Uint8Array): BufferSource {
  return u as unknown as BufferSource;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error(`AES-256 key must be 32 bytes, got ${raw.length}`);
  return getSubtle().importKey("raw", bs(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function aesGcmEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  const iv = randomBytes(IV_LEN);
  const cryptoKey = await importAesKey(key);
  const params: AesGcmParams = { name: "AES-GCM", iv: bs(iv) };
  if (aad) params.additionalData = bs(aad);
  const ctBuf = await getSubtle().encrypt(params, cryptoKey, bs(plaintext));
  const ct = new Uint8Array(ctBuf);

  const out = new Uint8Array(1 + IV_LEN + ct.length);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(ct, 1 + IV_LEN);
  return out;
}

export async function aesGcmDecrypt(
  key: Uint8Array,
  envelope: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  if (envelope.length < 1 + IV_LEN + 16) throw new Error("Envelope too short / corrupt");
  if (envelope[0] !== VERSION) throw new Error(`Unsupported envelope version ${envelope[0]}`);

  const iv = envelope.subarray(1, 1 + IV_LEN);
  const ct = envelope.subarray(1 + IV_LEN);
  const cryptoKey = await importAesKey(key);
  const params: AesGcmParams = { name: "AES-GCM", iv: bs(iv) };
  if (aad) params.additionalData = bs(aad);

  try {
    const ptBuf = await getSubtle().decrypt(params, cryptoKey, bs(ct));
    return new Uint8Array(ptBuf);
  } catch {
    // WebCrypto throws an opaque error on tag failure; normalise it.
    throw new Error("Decryption failed: data was tampered with, corrupted, or the key is wrong");
  }
}
