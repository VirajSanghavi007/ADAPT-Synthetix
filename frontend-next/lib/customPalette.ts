export const CUSTOM_PALETTE_KEY = "adapt-synthetix-custom-palette";

export type CustomPaletteColors = {
  bg: string;
  fg: string;
  card: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
};

export const CUSTOM_PALETTE_FIELDS: { key: keyof CustomPaletteColors; label: string }[] = [
  { key: "bg", label: "Background" },
  { key: "fg", label: "Text" },
  { key: "card", label: "Card surface" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "border", label: "Border" },
];

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex);
}

function relativeLuminance(hex: string): number {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(full.slice(1, 3), 16) / 255;
  const g = parseInt(full.slice(3, 5), 16) / 255;
  const b = parseInt(full.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastingTextColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.4 ? "#0a0a0a" : "#ffffff";
}

export function buildCssVars(colors: CustomPaletteColors): Record<string, string> {
  return {
    bg: colors.bg,
    fg: colors.fg,
    card: colors.card,
    primary: colors.primary,
    "on-primary": contrastingTextColor(colors.primary),
    secondary: colors.secondary,
    accent: colors.accent,
    "on-accent": contrastingTextColor(colors.accent),
    border: colors.border,
    ring: colors.primary,
  };
}

export const DEFAULT_CUSTOM_COLORS: CustomPaletteColors = {
  bg: "#ffffff",
  fg: "#1e293b",
  card: "#f1f5f9",
  primary: "#0891b2",
  secondary: "#22d3ee",
  accent: "#059669",
  border: "#cbd5e1",
};
