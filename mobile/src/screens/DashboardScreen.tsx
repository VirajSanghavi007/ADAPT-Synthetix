import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import type { Session } from "@supabase/supabase-js";
import { API_URL, supabase } from "../lib/supabase";

export default function DashboardScreen({ session }: { session: Session }) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [busy, setBusy] = useState(false);

  async function startRecording() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      setStatus("Microphone permission denied.");
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(recording);
    setStatus("Recording...");
  }

  async function stopRecording() {
    if (!recording) return;
    setStatus("Transcribing...");
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (!uri) return;

    const form = new FormData();
    // @ts-expect-error React Native's FormData accepts this file-shape, DOM lib types don't know it
    form.append("file", { uri, name: "recording.m4a", type: "audio/m4a" });

    try {
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTranscript(data.text || "(no speech detected)");
      setStatus("Done.");
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    }
  }

  async function speak() {
    if (!ttsText.trim()) return;
    setBusy(true);
    setStatus("Generating audio...");
    try {
      const res = await fetch(`${API_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text: ttsText.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const buffer = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: `data:audio/mpeg;base64,${base64}` });
      await sound.playAsync();
      setStatus("Playing.");
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mercury</Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.email}>{session.user.email}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Speech → Text</Text>
        <TouchableOpacity
          style={[styles.button, recording && styles.buttonRecording]}
          onPress={recording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>{recording ? "Stop recording" : "Start recording"}</Text>
        </TouchableOpacity>
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.transcript}>{transcript || "Your transcript will appear here."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Text → Speech</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Type something to hear it spoken..."
          placeholderTextColor="#64748b"
          value={ttsText}
          onChangeText={setTtsText}
        />
        <TouchableOpacity style={styles.button} onPress={speak} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Speak</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#ecfeff", flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", color: "#164e63" },
  signOut: { color: "#64748b", textDecorationLine: "underline" },
  email: { color: "#64748b", marginBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#a5f3fc" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#164e63", marginBottom: 12 },
  button: { backgroundColor: "#059669", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonRecording: { backgroundColor: "#dc2626" },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  status: { color: "#64748b", marginTop: 8, minHeight: 18 },
  transcript: { marginTop: 8, padding: 12, backgroundColor: "#f8fafc", borderRadius: 8, color: "#164e63" },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#a5f3fc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: "#164e63",
    textAlignVertical: "top",
  },
});
