/**
 * CSPRNG. Uses the platform WebCrypto RNG, which is available in Node 22 and,
 * in React Native, via `react-native-get-random-values` (imported once at app
 * startup) or expo-crypto. We never fall back to Math.random.
 */

function getWebCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error(
      "Secure RNG unavailable. In React Native, import 'react-native-get-random-values' at app entry."
    );
  }
  return c;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  getWebCrypto().getRandomValues(out);
  return out;
}
