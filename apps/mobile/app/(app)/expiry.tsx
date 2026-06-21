import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { EXPIRY_DOC_TYPES, DOC_TYPE_LABEL } from "@vaultmind/expiry-core";
import type { VaultDocument } from "@vaultmind/vault-core";
import { listDocs } from "../../lib/vault";
import {
  listTracked, trackOnDevice, untrackOnDevice, urgencyFor, travelReadiness, todayIso,
  ensureNotificationPermission, type ExpiryDocType, type TrackedDocument,
} from "../../lib/expiry";
import { S, C, bandColour } from "../../lib/theme";

export default function ExpiryGuard() {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [tracked, setTracked] = useState<TrackedDocument[]>([]);
  const [docId, setDocId] = useState("");
  const [docType, setDocType] = useState<ExpiryDocType>("international_passport");
  const [printed, setPrinted] = useState("");
  const [err, setErr] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [trip, setTrip] = useState<ReturnType<typeof travelReadiness> | null>(null);

  const refresh = useCallback(() => { listDocs().then(setDocs); listTracked().then(setTracked); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { ensureNotificationPermission(); }, []);

  async function add() {
    setErr("");
    const doc = docs.find((d) => d.id === docId);
    if (!doc) { setErr("Pick a document."); return; }
    if (!printed) { setErr("Enter the printed expiry date."); return; }
    const res = await trackOnDevice({ docId, title: doc.title, docType, printedExpiry: printed });
    if (!res.ok) { setErr(res.reason.replace(/_/g, " ")); return; }
    setDocId(""); setPrinted(""); refresh();
  }

  const today = todayIso(() => new Date());
  const untracked = docs.filter((d) => !tracked.some((t) => t.docId === d.id));

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={S.card}>
        <Text style={S.h3}>Travel-readiness</Text>
        <Text style={[S.muted, { marginBottom: 10 }]}>Check travel documents against a trip date (passports use the 6-month rule).</Text>
        <View style={S.row}>
          <TextInput style={[S.input, { flex: 1 }]} value={tripDate} onChangeText={setTripDate} placeholder="2026-09-01" />
          <Pressable style={S.btn} onPress={() => setTrip(travelReadiness(tracked, tripDate))}><Text style={S.btnText}>Check</Text></Pressable>
        </View>
        {trip && (
          <View style={[S.notice, !trip.ready && S.noticeWarn, { marginTop: 10 }]}>
            {trip.issues.length === 0 ? <Text>All travel documents look good.</Text>
              : trip.issues.map((i, n) => <Text key={n} style={{ marginBottom: 4 }}>{i.severity === "blocker" ? "⛔ " : "⚠️ "}{i.message}</Text>)}
          </View>
        )}
      </View>

      <View style={S.card}>
        <Text style={S.h3}>Track a document</Text>
        <Text style={S.label}>Document</Text>
        <View style={[S.row, { flexWrap: "wrap", marginBottom: 10 }]}>
          {untracked.length === 0 ? <Text style={S.muted}>No untracked documents.</Text> : untracked.map((d) => (
            <Pressable key={d.id} onPress={() => setDocId(d.id)} style={[S.pill, { backgroundColor: docId === d.id ? C.brand : C.bg2, marginRight: 6, marginBottom: 6 }]}>
              <Text style={[S.pillText, { color: docId === d.id ? "#fff" : C.ink2 }]} numberOfLines={1}>{d.title}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={S.label}>Type</Text>
        <View style={[S.row, { flexWrap: "wrap", marginBottom: 10 }]}>
          {EXPIRY_DOC_TYPES.map((t) => (
            <Pressable key={t} onPress={() => setDocType(t)} style={[S.pill, { backgroundColor: docType === t ? C.brand : C.bg2, marginRight: 6, marginBottom: 6 }]}>
              <Text style={[S.pillText, { color: docType === t ? "#fff" : C.ink2 }]}>{DOC_TYPE_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={S.label}>Printed expiry (YYYY-MM-DD)</Text>
        <TextInput style={S.input} value={printed} onChangeText={setPrinted} placeholder="2027-01-31" />
        {err ? <Text style={S.error}>{err}</Text> : null}
        <Pressable style={[S.btn, { marginTop: 10 }]} onPress={add}><Text style={S.btnText}>Track</Text></Pressable>
      </View>

      <Text style={S.h2}>Tracked</Text>
      {tracked.length === 0 ? <Text style={S.empty}>Nothing tracked yet.</Text> : tracked.map((t) => {
        const u = urgencyFor(t.effectiveExpiry, today);
        const col = bandColour[u.colour]!;
        return (
          <View key={t.docId} style={S.docRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>{t.title}</Text>
              <Text style={S.muted}>{DOC_TYPE_LABEL[t.docType]} · {u.daysLeft < 0 ? "expired" : `${u.daysLeft} days left`}</Text>
            </View>
            <View style={[S.pill, { backgroundColor: col.bg }]}><Text style={[S.pillText, { color: col.fg }]}>{t.replaced ? "Replaced" : u.band}</Text></View>
            <Pressable onPress={() => untrackOnDevice(t.docId).then(refresh)}><Text style={{ color: C.muted, marginLeft: 8 }}>✕</Text></Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
