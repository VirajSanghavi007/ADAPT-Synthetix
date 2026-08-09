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
