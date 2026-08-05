// Minimal word-level Levenshtein WER — good enough for a rough "does this look
// garbled" signal, not meant to match jiwer's precision (no normalization beyond
// lowercase + strip punctuation).
export function wordErrorRate(reference: string, hypothesis: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:"']/g, "")
      .split(/\s+/)
      .filter(Boolean);
  const ref = norm(reference);
  const hyp = norm(hypothesis);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;

  const dp: number[][] = Array.from({ length: ref.length + 1 }, () => new Array(hyp.length + 1).fill(0));
  for (let i = 0; i <= ref.length; i++) dp[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) dp[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[ref.length][hyp.length] / ref.length;
}
