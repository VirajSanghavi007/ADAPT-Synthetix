"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

type ModelOption = { id: string; label: string };
type ModelsResponse = { tier: string; asr: ModelOption[]; tts: ModelOption[] };

export function useModels() {
  const { session } = useSession();
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/models`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setModels)
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  return { models, loading };
}
