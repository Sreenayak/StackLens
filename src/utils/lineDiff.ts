export interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  text: string;
  oldLine?: number;
  newLine?: number;
}

/**
 * Computes a clean line-level diff using Longest Common Subsequence (LCS)
 * for side-by-side or unified code fix inspection.
 */
export function computeLineDiff(originalText: string, updatedText: string): DiffLine[] {
  const a = originalText.split('\n');
  const b = updatedText.split('\n');
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNum = 1;
  let newNum = 1;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push({ type: 'equal', text: a[i], oldLine: oldNum++, newLine: newNum++ });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'removed', text: a[i], oldLine: oldNum++ });
      i++;
    } else {
      lines.push({ type: 'added', text: b[j], newLine: newNum++ });
      j++;
    }
  }

  while (i < m) {
    lines.push({ type: 'removed', text: a[i], oldLine: oldNum++ });
    i++;
  }
  while (j < n) {
    lines.push({ type: 'added', text: b[j], newLine: newNum++ });
    j++;
  }

  return lines;
}
