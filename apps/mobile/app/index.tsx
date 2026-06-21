import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../lib/session";
import { S, C } from "../lib/theme";

export default function Index() {
  const { loading, session } = useSession();
  const router = useRouter();

  if (loading) return <View style={[S.screen, { justifyContent: "center" }]}><ActivityIndicator color={C.brand} /></View>;
  if (session) return <Redirect href="/(app)" />;

  return (
    <SafeAreaView style={S.screen}>
      <View style={[S.pad, { flex: 1, justifyContent: "center" }]}>
        <View style={[S.pill, { backgroundColor: "#efeaff", marginBottom: 16 }]}>
          <Text style={[S.pillText, { color: C.brand }]}>Local-first · encrypted on your device</Text>
        </View>
        <Text style={[S.h1, { fontSize: 34, marginBottom: 12 }]}>Your documents, working for you. Privately.</Text>
        <Text style={[S.muted, { fontSize: 16, marginBottom: 28 }]}>
          Organise documents, never miss a renewal, and understand contracts — all encrypted on your phone.
        </Text>
        <Pressable style={S.btn} onPress={() => router.push("/sign-up")}><Text style={S.btnText}>Create your vault</Text></Pressable>
        <Pressable style={[S.btn, S.btnGhost, { marginTop: 12 }]} onPress={() => router.push("/sign-in")}>
          <Text style={S.btnGhostText}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
