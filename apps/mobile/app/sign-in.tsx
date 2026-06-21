import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { S } from "../lib/theme";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const sb = supabase();
    if (!sb) { setError("Sign-in isn't configured (missing Supabase keys)."); return; }
    setBusy(true); setError("");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.replace("/(app)");
  }

  return (
    <SafeAreaView style={[S.screen, { justifyContent: "center" }]}>
      <View style={S.pad}>
        <Text style={[S.h1, { marginBottom: 16 }]}>Welcome back</Text>
        <View style={S.field}><Text style={S.label}>Email</Text>
          <TextInput style={S.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} /></View>
        <View style={S.field}><Text style={S.label}>Password</Text>
          <TextInput style={S.input} secureTextEntry value={password} onChangeText={setPassword} /></View>
        {error ? <Text style={S.error}>{error}</Text> : null}
        <Pressable style={[S.btn, { marginTop: 8 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>Sign in</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace("/sign-up")} style={{ marginTop: 16 }}>
          <Text style={[S.muted, { textAlign: "center" }]}>New here? Create your vault</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
