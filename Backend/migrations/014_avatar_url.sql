-- Custom profile picture, alongside the existing 10 preset avatars (avatar_id).
-- Stored as a data: URL directly on the row rather than object storage — no
-- Supabase Storage bucket is provisioned yet, and this keeps the feature
-- self-contained. Revisit if/when a real storage bucket gets set up.
alter table public.profiles
  add column if not exists avatar_url text;

grant update (avatar_url) on public.profiles to authenticated;
