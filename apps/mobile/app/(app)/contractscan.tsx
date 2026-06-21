import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Switch } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { VERDICT_LABEL, SEVERITY_LABEL, CONTRACTSCAN_DISCLAIMER, type ContractAnalysis } from "@vaultmind/contractscan-core";
import { apiAnalyzeContract } from "../../lib/api";
import { S, C } from "../../lib/theme";

const SEV: Record<string, { bg: string; fg: string }> = {
  note: { bg: C.greyBg, fg: C.grey }, caution: { bg: C.amberBg, fg: C.amber }, serious: { bg: C.redBg, fg: C.danger },
};

export default function ContractScan() {
  const [file, setFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [party, setParty] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ContractAnalysis | null>(null);

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0]!;
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/pdf" });
    setError("");
  }

  async function analyze() {
    setError(""); setResult(null);
    if (!file) { setError("Choose a contract."); return; }
    if (!consent) { setError("You must consent to cloud analysis."); return; }
    setBusy(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await apiAnalyzeContract({ tier2ConsentGranted: consent, mimeType: file.mimeType, base64, signingParty: party || "the user" });
      setResult(res.analysis);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={S.card}>
        <Text style={[S.muted, { marginBottom: 10 }]}>Get a plain-English breakdown. Your document is sent to our cloud AI only when you consent.</Text>
        <Pressable style={[S.btn, S.btnGhost, { marginBottom: 10 }]} onPress={pick}>
          <Text style={S.btnGhostText}>{file ? file.name : "Choose contract (PDF/image)"}</Text>
        </Pressable>
        <View style={S.field}><Text style={S.label}>Which party are you? (optional)</Text>
          <TextInput style={S.input} value={party} onChangeText={setParty} placeholder="e.g. the Tenant" /></View>
        <View style={[S.row, S.between, { marginBottom: 10 }]}>
          <Text style={{ flex: 1, color: C.ink2 }}>I consent to sending this document to the cloud AI provider.</Text>
          <Switch value={consent} onValueChange={setConsent} trackColor={{ true: C.brand }} />
        </View>
        {error ? <Text style={S.error}>{error}</Text> : null}
        <Pressable style={S.btn} onPress={analyze} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>Analyse contract</Text>}
        </Pressable>
      </View>

      {result && (
        <View>
          <View style={S.card}>
            <View style={[S.row, S.between]}>
              <Text style={S.h3}>{result.document_summary.contract_type}</Text>
              <View style={[S.pill, { backgroundColor: "#efeaff" }]}><Text style={[S.pillText, { color: C.brand }]}>{VERDICT_LABEL[result.verdict]}</Text></View>
            </View>
            <Text style={{ marginTop: 8 }}>{result.document_summary.plain_english_summary}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.h3}>Your obligations</Text>
            {result.your_obligations.map((o, i) => <Text key={i} style={{ marginTop: 4 }}>• {o}</Text>)}
            <Text style={[S.h3, { marginTop: 12 }]}>The other party</Text>
            {result.other_party_obligations.map((o, i) => <Text key={i} style={{ marginTop: 4 }}>• {o}</Text>)}
          </View>
          {result.red_flags.length > 0 && (
            <View style={S.card}>
              <Text style={S.h3}>Red flags</Text>
              {result.red_flags.map((f, i) => (
                <View key={i} style={[S.notice, { marginTop: 8 }]}>
                  <View style={[S.pill, { backgroundColor: SEV[f.severity]!.bg }]}><Text style={[S.pillText, { color: SEV[f.severity]!.fg }]}>{SEVERITY_LABEL[f.severity]}</Text></View>
                  <Text style={{ fontStyle: "italic", marginTop: 6 }}>“{f.original_clause_text}”</Text>
                  <Text style={{ marginTop: 4 }}>{f.plain_english_explanation}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={[S.notice, S.noticeWarn]}><Text style={{ fontSize: 12 }}>{CONTRACTSCAN_DISCLAIMER}</Text></View>
        </View>
      )}
    </ScrollView>
  );
}
