import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { DOCUMENT_CATEGORIES, type VaultDocument, type DocumentCategory } from "@vaultmind/vault-core";
import { listDocs, ingest, deleteDoc, type PickedFile } from "../../lib/vault";
import { searchDocs } from "../../lib/search";
import { S, C } from "../../lib/theme";

export default function Documents() {
  const router = useRouter();
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Identity");
  const [expiry, setExpiry] = useState("");
  const [err, setErr] = useState<string[]>([]);

  const refresh = useCallback(() => { listDocs().then(setDocs); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0]!;
    setPicked({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/octet-stream" });
    setTitle(a.name);
    setErr([]);
  }

  async function save() {
    if (!picked) return;
    const res = await ingest({ file: picked, category, ...(title ? { title } : {}), ...(expiry ? { expiryDate: expiry } : {}) });
    if (res.ok) { setPicked(null); setTitle(""); setExpiry(""); refresh(); }
    else if ("errors" in res) setErr(res.errors);
    else setErr(["This document is already in your vault."]);
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete document", "This permanently destroys the encrypted copy.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteDoc(id); refresh(); } },
    ]);
  }

  const shown = q ? searchDocs(docs, q) : docs;

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      {!picked ? (
        <Pressable style={[S.btn, { marginBottom: 14 }]} onPress={pick}><Text style={S.btnText}>+ Add document</Text></Pressable>
      ) : (
        <View style={S.card}>
          <Text style={S.h3}>{picked.name}</Text>
          <View style={S.field}><Text style={S.label}>Title</Text>
            <TextInput style={S.input} value={title} onChangeText={setTitle} /></View>
          <Text style={S.label}>Category</Text>
          <View style={[S.row, { flexWrap: "wrap", marginBottom: 12 }]}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)}
                style={[S.pill, { backgroundColor: category === c ? C.brand : C.bg2, marginRight: 6, marginBottom: 6 }]}>
                <Text style={[S.pillText, { color: category === c ? "#fff" : C.ink2 }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <View style={S.field}><Text style={S.label}>Expiry date (YYYY-MM-DD, optional)</Text>
            <TextInput style={S.input} value={expiry} onChangeText={setExpiry} placeholder="2027-01-31" /></View>
          {err.map((e, i) => <Text key={i} style={S.error}>{e}</Text>)}
          <View style={[S.row, { marginTop: 8 }]}>
            <Pressable style={[S.btn, { flex: 1 }]} onPress={save}><Text style={S.btnText}>Encrypt & save</Text></Pressable>
            <Pressable style={[S.btn, S.btnGhost, { flex: 1 }]} onPress={() => setPicked(null)}><Text style={S.btnGhostText}>Cancel</Text></Pressable>
          </View>
        </View>
      )}

      <TextInput style={[S.input, { marginBottom: 14 }]} value={q} onChangeText={setQ} placeholder="Search your documents" />

      {shown.length === 0 ? <Text style={S.empty}>{q ? "No matches." : "No documents yet."}</Text> : shown.map((d) => (
        <View key={d.id} style={S.docRow}>
          <View style={S.docIco}><Text style={S.docIcoText}>{d.category.slice(0, 2).toUpperCase()}</Text></View>
          <Pressable style={{ flex: 1 }} onPress={() => router.push(`/document/${d.id}`)}>
            <Text style={{ fontWeight: "600" }} numberOfLines={1}>{d.title}</Text>
            <Text style={S.muted}>{d.category}{d.metadata.expiryDate ? ` · expires ${d.metadata.expiryDate}` : ""}</Text>
          </Pressable>
          <Pressable onPress={() => confirmDelete(d.id)}><Text style={{ color: C.danger, fontWeight: "700" }}>Delete</Text></Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
