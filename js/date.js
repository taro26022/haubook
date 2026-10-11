// 日付の扱い。日付は "YYYY-MM-DD" 形式の文字列で持ち、端末のローカル時刻で計算する。
// 週の始まりは月曜日。

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateString(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateString(parseDate(s)) === s;
}

export function today() {
  return toDateString(new Date());
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

// その日を含む週の月曜日
export function weekStart(s) {
  const d = parseDate(s);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return toDateString(d);
}

// 例: "10月6日(月)"
export function formatDayLabel(s) {
  const d = parseDate(s);
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}

// 例: { range: "10/5(月) 〜 10/11(日)", year: "2026年" }
export function formatWeekRange(start) {
  const a = parseDate(start);
  const b = parseDate(addDays(start, 6));
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
  const year = a.getFullYear() === b.getFullYear()
    ? `${a.getFullYear()}年`
    : `${a.getFullYear()}年〜${b.getFullYear()}年`;
  return { range: `${md(a)} 〜 ${md(b)}`, year };
}

// 今週・先週・来週なら、その言葉を返す。それ以外は空文字。
export function relativeWeekLabel(start, todayString) {
  const current = weekStart(todayString);
  if (start === current) return '今週';
  if (start === addDays(current, -7)) return '先週';
  if (start === addDays(current, 7)) return '来週';
  return '';
}
