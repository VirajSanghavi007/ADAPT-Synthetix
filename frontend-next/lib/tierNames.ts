// Display names for subscription tiers — internal tier keys (free/pro/max/enterprise)
// stay unchanged everywhere else (DB, API, Backend/tiers.py) since renaming those is a
// much bigger refactor for no functional gain; this is presentation-only.
export const TIER_DISPLAY_NAMES: Record<string, string> = {
  free: "Freyr",
  pro: "Horus",
  max: "Odin",
  enterprise: "Enterprise",
};

export function tierDisplayName(tier: string | null | undefined): string {
  if (!tier) return "";
  return TIER_DISPLAY_NAMES[tier] ?? tier;
}
