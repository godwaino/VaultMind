import { StyleSheet } from "react-native";

export const C = {
  ink: "#0e0b1f", ink2: "#2a2540", muted: "#6b6486", line: "#e7e3f1",
  bg: "#ffffff", bg2: "#f7f5fc", brand: "#5b3df5", accent: "#10b9a6",
  warn: "#f59e0b", danger: "#ef4444",
  green: "#0a8f7e", greenBg: "#e6f9f4", amber: "#b4730a", amberBg: "#fff4e0",
  redBg: "#fdeaea", grey: "#555", greyBg: "#eee",
};

export const bandColour: Record<string, { fg: string; bg: string }> = {
  green: { fg: C.green, bg: C.greenBg },
  amber: { fg: C.amber, bg: C.amberBg },
  red: { fg: C.danger, bg: C.redBg },
  grey: { fg: C.grey, bg: C.greyBg },
};

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 18 },
  h1: { fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700", color: C.ink, marginBottom: 10 },
  h3: { fontSize: 16, fontWeight: "700", color: C.ink },
  muted: { color: C.muted },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: { justifyContent: "space-between" },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, fontSize: 15, color: C.ink, backgroundColor: "#fff" },
  label: { fontSize: 13, fontWeight: "600", color: C.ink2, marginBottom: 6 },
  field: { marginBottom: 14 },
  btn: { backgroundColor: C.brand, paddingVertical: 13, paddingHorizontal: 18, borderRadius: 999, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.line },
  btnGhostText: { color: C.ink, fontWeight: "600" },
  btnDanger: { backgroundColor: C.redBg },
  btnDangerText: { color: C.danger, fontWeight: "700" },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, alignSelf: "flex-start" },
  pillText: { fontSize: 12, fontWeight: "700" },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: "#fff" },
  docIco: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  docIcoText: { color: "#fff", fontWeight: "700" },
  error: { color: C.danger, fontSize: 13, marginTop: 6 },
  notice: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12 },
  noticeWarn: { backgroundColor: "#fff8ec", borderColor: "#f3d9a6" },
  empty: { textAlign: "center", color: C.muted, paddingVertical: 40 },
});
