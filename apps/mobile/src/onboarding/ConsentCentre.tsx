/**
 * Consent Centre — onboarding screen 3 (REQ-ONB-002/003, ARCHITECTURE §8).
 *
 * STRUCTURAL STUB (Phase 0): illustrates how the UI binds to @vaultmind/consent.
 * It is intentionally not compiled in the Phase-0 typecheck (no React Native types
 * installed in this environment). On a dev machine with Expo it renders real toggles.
 *
 * The important, already-tested part is the wiring: every toggle calls
 * registry.grant/revoke, which appends an auditable ConsentEvent. Egress features
 * downstream cannot run without a token minted from this same registry.
 */

import React, { useMemo, useState } from "react";
import { View, Text, Switch, ScrollView } from "react-native";
import { ConsentRegistry, type ConsentKey } from "@vaultmind/consent";

const APP_VERSION = "0.1.0";

const TOGGLES: { key: ConsentKey; title: string; body: string; locked?: boolean }[] = [
  {
    key: "core_processing",
    title: "Use VaultMind (required)",
    body: "Store and read your documents on this device. Nothing leaves your phone for this.",
    locked: true,
  },
  {
    key: "cloud_backup",
    title: "Encrypted cloud backup",
    body: "Keep an encrypted, unreadable copy so a lost phone doesn't lose your documents. Free up to 5 GB.",
  },
  {
    key: "cloud_ocr_fallback",
    title: "Cloud text recognition fallback",
    body: "If on-device reading is unsure, send that page to Google to read the text, then discard it.",
  },
  {
    key: "tier2_ai",
    title: "Cloud contract analysis",
    body: "Send a contract you choose to our AI provider for a deeper plain-English breakdown.",
  },
  {
    key: "analytics",
    title: "Anonymous usage analytics",
    body: "Share which features you use (never document content) to help us improve.",
  },
];

export function ConsentCentre({ onContinue }: { onContinue: (registry: ConsentRegistry) => void }) {
  const registry = useMemo(
    () => new ConsentRegistry({ appVersion: APP_VERSION, initial: { core_processing: true } }),
    []
  );
  const [state, setState] = useState<Record<string, boolean>>({ core_processing: true });

  function toggle(key: ConsentKey, value: boolean) {
    if (value) registry.grant(key);
    else registry.revoke(key);
    setState({ ...state, [key]: value });
    // registry.getEvents() is later synced to the consent_events table.
  }

  return (
    <ScrollView>
      <Text>Your privacy choices</Text>
      <Text>You can change any of these later in Settings → Consent Centre.</Text>
      {TOGGLES.map((t) => (
        <View key={t.key}>
          <Text>{t.title}</Text>
          <Text>{t.body}</Text>
          <Switch
            value={state[t.key] ?? false}
            disabled={t.locked === true}
            onValueChange={(v) => toggle(t.key, v)}
          />
        </View>
      ))}
      <Text onPress={() => onContinue(registry)}>Continue</Text>
    </ScrollView>
  );
}
