import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { VaultDocument } from "@vaultmind/vault-core";
import { getDoc, decryptToTemp, deleteDoc } from "../../lib/vault";
import { S, C } from "../../lib/theme";

export default function DocumentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<VaultDocument | null>(null);
  const [uri, setUri] = useState("");

  useEffect(() => { if (id) getDoc(id).then(setDoc); }, [id]);

  async function open() { if (id) setUri(await decryptToTemp(id)); }
  function remove() {
    if (!id) return;
    Alert.alert("Delete document", "This permanently destroys the encrypted copy.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteDoc(id); router.back(); } },
    ]);
  }

  if (!doc) return <View style={[S.screen, { justifyContent: "center" }]}><Text style={S.empty}>Loading…</Text></View>;
  const isImage = doc.mimeType.startsWith("image/");

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Stack.Screen options={{ title: doc.title, headerShown: true }} />
      <View style={S.card}>
        <Row label="Category" value={doc.category} />
        <Row label="Type" value={doc.mimeType} />
        <Row label="Size" value={`${(doc.sizeBytes / 1024).toFixed(0)} KB`} />
        {doc.metadata.expiryDate ? <Row label="Expiry" value={doc.metadata.expiryDate} /> : null}
        <Row label="Added" value={doc.createdAt.slice(0, 10)} />
      </View>

      <View style={[S.row, { marginBottom: 12 }]}>
        <Pressable style={[S.btn, { flex: 1 }]} onPress={open}><Text style={S.btnText}>Decrypt & view</Text></Pressable>
        <Pressable style={[S.btn, S.btnDanger, { flex: 1 }]} onPress={remove}><Text style={S.btnDangerText}>Delete</Text></Pressable>
      </View>

      {uri ? (isImage
        ? <Image source={{ uri }} style={{ width: "100%", height: 420, borderRadius: 10, resizeMode: "contain", backgroundColor: C.bg2 }} />
        : <View style={S.notice}><Text>Decrypted to a temporary file. Open it in your PDF viewer:</Text><Text style={{ color: C.brand, marginTop: 6 }}>{uri}</Text></View>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={[S.row, S.between, { marginVertical: 4 }]}>
      <Text style={S.muted}>{label}</Text>
      <Text style={{ fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
