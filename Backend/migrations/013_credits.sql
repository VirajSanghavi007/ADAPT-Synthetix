-- Usage credits, separate from the hourly rate limits in 010/tiers.py. Rate limits
-- throttle burst abuse (requests/hour); credits are the actual usage allowance that
-- resets on a cadence, tracking/UI only — no real payment processing (see
-- Backend/api_keys.py and the Subscription page for the existing "no real gateway"
-- pattern this follows).
--
-- free: fixed pool, renews every 5 hours.
-- pro/max: fixed pool, renews weekly (max gets a larger pool).
-- enterprise: no pool — pay-per-use, metered from asr_logs/tts_logs directly
--   (see Backend/credits.py get_enterprise_usage). credits_total/remaining stay 0.
alter table public.profiles
  add column if not exists credits_remaining integer not null default 50,
  add column if not exists credits_total integer not null default 50,
  add column if not exists credits_cycle_started_at timestamptz not null default now();

-- authenticated users can't touch their own credits — only the backend (service-role
-- adjacent connection, same trust boundary as tier) deducts/resets them.
