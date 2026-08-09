"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./useSession";

export function useAAL() {
  const { session } = useSession();
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [nextLevel, setNextLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (data) {
        setCurrentLevel(data.currentLevel);
        setNextLevel(data.nextLevel);
      }
      setLoading(false);
    });
  }, [session]);

  return {
    loading,
    needsChallenge: !loading && nextLevel === "aal2" && currentLevel !== nextLevel,
  };
}
