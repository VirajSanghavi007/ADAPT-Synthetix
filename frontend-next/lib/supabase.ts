import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { experimental: { passkey: true } } }
);

export const API_URL = process.env.NEXT_PUBLIC_API_URL!;
