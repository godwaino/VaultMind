import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert, Switch } from "react-native";
import { useRouter } from "expo-router";
import { createBackupKeyset } from "@vaultmind/crypto";
import { useSession } from "../../lib/session";
import { apiDeleteAccount } from "../../lib/api";
import { S, C } from "../../lib/theme";

const CONSENTS = [
  { key: "cloud_backup", label: "Encrypted cloud backup" },
  { key: "tier2_ai", label: "Cloud contract analysis" },
  { key: "cloud_ocr_fallback", label: "Cloud text-recognition fallback" },
  { key: "analytics", label: "Anonymous usage analytics" },
];

export default function Settings() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [pw, setPw] = useState("");
  const [phrase, setPhrase] = useState("");

  async function generatePhrase() {
    if (pw.length < 10) { Alert.alert("Enter your account password (10+ chars)."); return; }
    const { recoveryPhrase } = await createBackupKeyset(pw);
    setPhrase(recoveryPhrase);
  }

  function deleteAccount() {
    if (!user) return;
    Alert.alert("Delete account", "Server data is purged within 72 hours. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const res = await apiDeleteAccount(user.id);
            Alert.alert("Scheduled", `Rows purged by ${res.deadlines.rowsBy.slice(0, 10)}, backups by ${res.deadlines.blobsBy.slice(0, 10)}.`);
            await signOut(); router.replace("/");
          } catch (e) { Alert.alert("Error", (e as Error).message); }
        },
      },
    ]);
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={S.card}>
        <Text style={S.h3}>Consent centre</Text>
        <Text style={[S.muted, { marginBottom: 8 }]}>Control what can leave your device.</Text>
        {CONSENTS.map((c) => (
          <View key={c.key} style={[S.row, S.between, { marginVertical: 6 }]}>
            <Text style={{ flex: 1, color: C.ink2 }}>{c.label}</Text>
            <Switch value={consents[c.key] ?? false} onValueChange={(v) => setConsents({ ...consents, [c.key]: v })} trackColor={{ true: C.brand }} />
          </View>
        ))}
      </View>

      <View style={S.card}>
        <Text style={S.h3}>Backup recovery phrase</Text>
        <Text style={[S.muted, { marginBottom: 8 }]}>If you forget your password, these 24 words restore your encrypted backup. Write them down.</Text>
        <TextInput style={S.input} secureTextEntry value={pw} onChangeText={setPw} placeholder="Your account password" />
        <Pressable style={[S.btn, { marginTop: 8 }]} onPress={generatePhrase}><Text style={S.btnText}>Generate</Text></Pressable>
        {phrase ? <View style={[S.notice, S.noticeWarn, { marginTop: 10 }]}><Text style={{ fontFamily: "monospace" as const, lineHeight: 22 }}>{phrase}</Text></View> : null}
      </View>

      <View style={S.card}>
        <Text style={S.h3}>Your data</Text>
        <Pressable style={[S.btn, S.btnDanger, { marginTop: 10 }]} onPress={deleteAccount}><Text style={S.btnDangerText}>Delete my account</Text></Pressable>
      </View>

      <Pressable style={[S.btn, S.btnGhost]} onPress={() => signOut().then(() => router.replace("/"))}>
        <Text style={S.btnGhostText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
