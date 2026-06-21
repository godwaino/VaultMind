/**
 * App entry. Crypto polyfills MUST load before anything calls @vaultmind/crypto:
 *  - react-native-get-random-values → crypto.getRandomValues
 *  - react-native-quick-crypto      → WebCrypto subtle (AES-GCM) used by our envelope
 * Then hand off to expo-router.
 */
import "react-native-get-random-values";
import { install as installQuickCrypto } from "react-native-quick-crypto";

installQuickCrypto();

import "expo-router/entry";
