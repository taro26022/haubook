// 金額の入力と表示。金額は 1 円単位の正の整数で持つ。

export const MAX_AMOUNT = 999_999_999;

// 入力文字列を金額に変換する。不正な場合は null。
// 全角数字、カンマ、「¥」「円」、空白は許す。
export function parseAmount(input) {
  const s = String(input ?? '').normalize('NFKC').replace(/[,\s¥\\円]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return n;
}

// 例: 1234 → "¥1,234"、-500 → "−¥500"
export function formatYen(n) {
  const sign = n < 0 ? '−' : '';
  return `${sign}¥${Math.abs(n).toLocaleString('ja-JP')}`;
}
