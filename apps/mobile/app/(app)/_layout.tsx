import { Tabs, Redirect } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { useSession } from "../../lib/session";
import { S, C } from "../../lib/theme";

export default function AppLayout() {
  const { loading, session, configured } = useSession();

  if (!configured) return (
    <View style={[S.screen, { justifyContent: "center" }, S.pad]}>
      <Text style={S.h3}>Not configured</Text>
      <Text style={S.muted}>Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY and EXPO_PUBLIC_API_BASE_URL.</Text>
    </View>
  );
  if (loading) return <View style={[S.screen, { justifyContent: "center" }]}><ActivityIndicator color={C.brand} /></View>;
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.brand, headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="documents" options={{ title: "Documents" }} />
      <Tabs.Screen name="expiry" options={{ title: "Expiry" }} />
      <Tabs.Screen name="contractscan" options={{ title: "Contracts" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
