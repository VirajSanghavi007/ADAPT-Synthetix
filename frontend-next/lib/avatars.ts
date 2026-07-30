// 10 built-in avatar choices (no external image fetch — plain gradient + initial glyphs).
export const AVATARS: { id: number; gradient: string; glyph: string }[] = [
  { id: 1, gradient: "from-cyan-500 to-emerald-500", glyph: "M" },
  { id: 2, gradient: "from-violet-500 to-fuchsia-500", glyph: "A" },
  { id: 3, gradient: "from-amber-500 to-orange-500", glyph: "S" },
  { id: 4, gradient: "from-sky-500 to-blue-600", glyph: "R" },
  { id: 5, gradient: "from-rose-500 to-pink-600", glyph: "T" },
  { id: 6, gradient: "from-lime-500 to-green-600", glyph: "T" },
  { id: 7, gradient: "from-indigo-500 to-violet-600", glyph: "S" },
  { id: 8, gradient: "from-teal-500 to-cyan-600", glyph: "V" },
  { id: 9, gradient: "from-red-500 to-rose-600", glyph: "N" },
  { id: 10, gradient: "from-slate-500 to-slate-700", glyph: "H" },
];

export function getAvatar(id: number | null | undefined) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
