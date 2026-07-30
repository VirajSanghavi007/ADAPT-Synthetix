"use client";

// Google Identity Services token client — requests a short-lived OAuth access token
// client-side, scoped per action, never persisted. Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID
// (a public web OAuth client ID, safe to expose — not a secret).

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: () => void };
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

let scriptLoaded: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (scriptLoaded) return scriptLoaded;
  scriptLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return scriptLoaded;
}

export async function requestDriveAccessToken(scope: string): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google Drive integration is not configured (missing client ID)");
  }
  await loadGsiScript();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "no access token returned"));
          return;
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

export async function uploadToDrive(
  filename: string,
  content: Blob,
  mimeType: string
): Promise<{ id: string; name: string }> {
  const token = await requestDriveAccessToken("https://www.googleapis.com/auth/drive.file");

  const metadata = { name: filename, mimeType };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", content);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${await res.text()}`);
  return res.json();
}

export type DriveAudioFile = { id: string; name: string; mimeType: string };

export async function listDriveAudioFiles(): Promise<{ files: DriveAudioFile[]; accessToken: string }> {
  const accessToken = await requestDriveAccessToken("https://www.googleapis.com/auth/drive.readonly");
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent("mimeType contains 'audio/' and trashed = false") +
      "&fields=files(id,name,mimeType)&pageSize=50",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive list failed: ${await res.text()}`);
  const data = await res.json();
  return { files: data.files || [], accessToken };
}
