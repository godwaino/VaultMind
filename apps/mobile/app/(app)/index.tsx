import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { VaultDocument } from "@vaultmind/vault-core";
import { listDocs } from "../../lib/vault";
import { listTracked, urgencyFor, todayIso, type TrackedDocument } from "../../lib/expiry";
import { S, C } from "../../lib/theme";

export default function Dashboard() {
  const router = useRouter();
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [tracked, setTracked] = useState<TrackedDocument[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const d = await listDocs(); const t = await listTracked();
      if (active) { setDocs(d); setTracked(t); }
    })();
    return () => { active = false; };
  }, []));

  const today = todayIso(() => new Date());
  const urgent = tracked.filter((t) => !t.replaced && ["urgent", "expired"].includes(urgencyFor(t.effectiveExpiry, today).band)).length;

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={[S.row, { gap: 12, marginBottom: 14 }]}>
        <View style={[S.card, { flex: 1 }]}><Text style={S.muted}>Documents</Text><Text style={{ fontSize: 26, fontWeight: "800" }}>{docs.length}</Text></View>
        <View style={[S.card, { flex: 1 }]}><Text style={S.muted}>Tracked</Text><Text style={{ fontSize: 26, fontWeight: "800" }}>{tracked.length}</Text></View>
        <View style={[S.card, { flex: 1 }]}><Text style={S.muted}>Urgent</Text><Text style={{ fontSize: 26, fontWeight: "800", color: C.danger }}>{urgent}</Text></View>
      </View>

      <View style={[S.row, S.between, { marginBottom: 10 }]}>
        <Text style={S.h2}>Recent documents</Text>
        <Pressable onPress={() => router.push("/(app)/documents")}><Text style={{ color: C.brand, fontWeight: "700" }}>View all</Text></Pressable>
      </View>

      {docs.length === 0 ? (
        <Text style={S.empty}>No documents yet — add your first one.</Text>
      ) : docs.slice(0, 8).map((d) => (
        <Pressable key={d.id} style={S.docRow} onPress={() => router.push(`/document/${d.id}`)}>
          <View style={S.docIco}><Text style={S.docIcoText}>{d.category.slice(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600" }} numberOfLines={1}>{d.title}</Text>
            <Text style={S.muted}>{d.category}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
