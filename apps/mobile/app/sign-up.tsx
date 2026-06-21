import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { validateEmail, validatePassword, normalizeNigerianPhone } from "@vaultmind/validation";
import { apiRegister } from "../lib/api";
import { S, C } from "../lib/theme";

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [backup, setBackup] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    const errs: string[] = [];
    const em = validateEmail(email); if (!em.ok) errs.push(...em.errors);
    const pw = validatePassword(password); if (!pw.ok) errs.push(...pw.errors);
    const ph = normalizeNigerianPhone(phone); if (!ph.ok) errs.push(...ph.errors);
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await apiRegister({ email, password, phone, consents: { core_processing: true, cloud_backup: backup } });
      setDone(true);
    } catch (e) { setErrors([(e as Error).message]); } finally { setBusy(false); }
  }

  if (done) return (
    <SafeAreaView style={[S.screen, { justifyContent: "center" }]}>
      <View style={S.pad}>
        <Text style={S.h2}>Check your email</Text>
        <Text style={S.muted}>We sent a verification link to {email}. Verify it, then sign in.</Text>
        <Pressable style={[S.btn, { marginTop: 16 }]} onPress={() => router.replace("/sign-in")}><Text style={S.btnText}>Go to sign in</Text></Pressable>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={S.screen}>
      <ScrollView contentContainerStyle={S.pad}>
        <Text style={[S.h1, { marginBottom: 16 }]}>Create your vault</Text>
        <View style={S.field}><Text style={S.label}>Email</Text>
          <TextInput style={S.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" /></View>
        <View style={S.field}><Text style={S.label}>Phone (Nigerian)</Text>
          <TextInput style={S.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="0803 123 4567" /></View>
        <View style={S.field}><Text style={S.label}>Password</Text>
          <TextInput style={S.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 10 characters" /></View>
        <View style={[S.row, S.between, { marginBottom: 14 }]}>
          <Text style={{ flex: 1, color: C.ink2 }}>Enable encrypted cloud backup (free up to 5 GB)</Text>
          <Switch value={backup} onValueChange={setBackup} trackColor={{ true: C.brand }} />
        </View>
        {errors.map((e, i) => <Text key={i} style={S.error}>{e}</Text>)}
        <Pressable style={[S.btn, { marginTop: 8 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>Create account</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace("/sign-in")} style={{ marginTop: 16 }}>
          <Text style={[S.muted, { textAlign: "center" }]}>Already have an account? Sign in</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
