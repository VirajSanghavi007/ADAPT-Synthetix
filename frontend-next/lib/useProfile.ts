"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

type Profile = {
  username: string | null;
  display_name: string | null;
  avatar_id: number | null;
  avatar_url: string | null;
  tier: string;
  is_enterprise: boolean;
};

export function useProfile() {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  return { profile, loading };
}
