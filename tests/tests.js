// 計算・検証の処理のテスト。ブラウザで tests/index.html を開くと実行される。
import { weekStart, addDays, isValidDateString, formatWeekRange, formatDayLabel, relativeWeekLabel } from '../js/date.js';
import { parseAmount, formatYen } from '../js/format.js';
import { summarizeWeek } from '../js/summary.js';
import { buildBackup, parseBackup } from '../js/backup.js';
import { DEFAULT_CATEGORIES } from '../js/defaults.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error.message });
  }
}
function eq(actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`期待値 ${e} / 実際 ${a}`);
}
function throws(fn, includes) {
  try {
    fn();
  } catch (error) {
    if (includes && !error.message.includes(includes)) throw new Error(`メッセージが違う: ${error.message}`);
    return;
  }
  throw new Error('エラーが発生しなかった');
}

// ---------- 日付 ----------
test('週の始まりは月曜日(日曜日 → 前の月曜日)', () => eq(weekStart('2026-10-11'), '2026-10-05'));
test('週の始まり(月曜日はそのまま)', () => eq(weekStart('2026-10-05'), '2026-10-05'));
test('週の始まり(火曜日)', () => eq(weekStart('2026-10-06'), '2026-10-05'));
test('週の始まり(年をまたぐ)', () => eq(weekStart('2027-01-01'), '2026-12-28'));
test('日付の加算(月をまたぐ)', () => eq(addDays('2026-10-30', 3), '2026-11-02'));
test('日付の加算(うるう年)', () => eq(addDays('2028-02-28', 1), '2028-02-29'));
test('日付の検証', () => {
  eq(isValidDateString('2026-02-28'), true);
  eq(isValidDateString('2026-02-30'), false);
  eq(isValidDateString('2026-2-3'), false);
  eq(isValidDateString('abc'), false);
  eq(isValidDateString(undefined), false);
});
test('週の表示', () => eq(formatWeekRange('2026-10-05'), { range: '10/5(月) 〜 10/11(日)', year: '2026年' }));
test('週の表示(年をまたぐ)', () => eq(formatWeekRange('2026-12-28'), { range: '12/28(月) 〜 1/3(日)', year: '2026年〜2027年' }));
test('日の表示', () => eq(formatDayLabel('2026-10-11'), '10月11日(日)'));
test('今週・先週の表示', () => {
  eq(relativeWeekLabel('2026-10-05', '2026-10-11'), '今週');
  eq(relativeWeekLabel('2026-09-28', '2026-10-11'), '先週');
  eq(relativeWeekLabel('2026-10-12', '2026-10-11'), '来週');
  eq(relativeWeekLabel('2026-09-21', '2026-10-11'), '');
});

// ---------- 金額 ----------
test('金額の入力', () => {
  eq(parseAmount('1200'), 1200);
  eq(parseAmount('1,200'), 1200);
  eq(parseAmount('１２００'), 1200);
  eq(parseAmount('¥1,200'), 1200);
  eq(parseAmount(' 980 '), 980);
});
test('不正な金額は null', () => {
  eq(parseAmount('0'), null);
  eq(parseAmount('-5'), null);
  eq(parseAmount('1.5'), null);
  eq(parseAmount(''), null);
  eq(parseAmount('abc'), null);
  eq(parseAmount('1000000000'), null);
});
test('金額の表示', () => {
  eq(formatYen(1234), '¥1,234');
  eq(formatYen(0), '¥0');
  eq(formatYen(-500), '−¥500');
});

// ---------- 週の集計 ----------
const cats = DEFAULT_CATEGORIES;
const food = cats.find((c) => c.name === '食費').id;
const daily = cats.find((c) => c.name === '日用品').id;
const salary = cats.find((c) => c.name === '給与').id;
const entry = (id, date, amount, type, categoryId, createdAt = '2026-10-01T00:00:00.000Z') =>
  ({ id, date, amount, type, categoryId, memo: '', createdAt, updatedAt: createdAt });
const sample = [
  entry('a', '2026-10-04', 999, 'expense', food), // 前の週の日曜日(含まない)
  entry('b', '2026-10-05', 1000, 'expense', food), // 月曜日(含む)
  entry('c', '2026-10-07', 300, 'expense', daily),
  entry('d', '2026-10-11', 500, 'expense', food, '2026-10-11T01:00:00.000Z'), // 日曜日(含む)
  entry('e', '2026-10-11', 50000, 'income', salary, '2026-10-11T02:00:00.000Z'),
  entry('f', '2026-10-12', 777, 'expense', food), // 次の週の月曜日(含まない)
];
test('週の合計', () => {
  const s = summarizeWeek(sample, '2026-10-05', cats);
  eq([s.income, s.expense, s.balance, s.count], [50000, 1800, 48200, 4]);
});
test('カテゴリ別の支出(金額の大きい順)', () => {
  const s = summarizeWeek(sample, '2026-10-05', cats);
  eq(s.expenseByCategory.map((r) => [r.name, r.total]), [['食費', 1500], ['日用品', 300]]);
  eq(Math.round(s.expenseByCategory[0].ratio * 1000), 833);
});
test('日ごとのまとまり(新しい日が先、同じ日は後の登録が先)', () => {
  const s = summarizeWeek(sample, '2026-10-05', cats);
  eq(s.days.map((d) => d.date), ['2026-10-11', '2026-10-07', '2026-10-05']);
  eq(s.days[0].entries.map((e) => e.id), ['e', 'd']);
  eq([s.days[0].income, s.days[0].expense], [50000, 500]);
});
test('記録のない週', () => {
  const s = summarizeWeek(sample, '2026-09-21', cats);
  eq([s.income, s.expense, s.balance, s.count, s.days.length, s.expenseByCategory.length], [0, 0, 0, 0, 0, 0]);
});
test('消えたカテゴリの記録も集計に含める', () => {
  const s = summarizeWeek([entry('x', '2026-10-06', 100, 'expense', 'missing')], '2026-10-05', cats);
  eq(s.expenseByCategory.map((r) => [r.name, r.total]), [['(不明なカテゴリ)', 100]]);
});

// ---------- バックアップ ----------
test('書き出したものを読み込める', () => {
  const entries = sample.map((e) => ({ ...e, memo: 'テスト' }));
  const json = JSON.stringify(buildBackup(entries, cats, new Date('2026-10-11T00:00:00Z')));
  const parsed = parseBackup(json);
  eq(parsed.categories.length, cats.length);
  eq(parsed.entries.length, entries.length);
  eq(parsed.entries.find((e) => e.id === 'e'), entries.find((e) => e.id === 'e'));
});
const valid = () => buildBackup([entry('a', '2026-10-05', 100, 'expense', food)], cats);
const broken = (change) => {
  const data = valid();
  change(data);
  return JSON.stringify(data);
};
test('JSON でないファイルは読み込まない', () => throws(() => parseBackup('{oops'), 'JSON'));
test('別の形式のファイルは読み込まない', () => throws(() => parseBackup('{"hello":1}'), 'バックアップファイルではありません'));
test('金額が不正なら読み込まない', () => throws(() => parseBackup(broken((d) => { d.entries[0].amount = 1.5; })), '金額'));
test('日付が不正なら読み込まない', () => throws(() => parseBackup(broken((d) => { d.entries[0].date = '2026-13-01'; })), '日付'));
test('カテゴリが見つからなければ読み込まない', () => throws(() => parseBackup(broken((d) => { d.entries[0].categoryId = 'zzz'; })), 'カテゴリ'));
test('種類とカテゴリが合わなければ読み込まない', () => throws(() => parseBackup(broken((d) => { d.entries[0].type = 'income'; })), '一致しません'));
test('id が重複していれば読み込まない', () => throws(() => parseBackup(broken((d) => { d.entries.push({ ...d.entries[0] }); })), '重複'));
test('知らない項目は取り込まない', () => {
  const parsed = parseBackup(broken((d) => { d.entries[0].extra = '<script>'; }));
  eq('extra' in parsed.entries[0], false);
});

// ---------- 結果の表示 ----------
const failed = results.filter((r) => !r.ok);
document.querySelector('#summary').textContent = failed.length === 0
  ? `すべて成功(${results.length} 件)`
  : `失敗 ${failed.length} 件 / 全 ${results.length} 件`;
document.querySelector('#summary').className = failed.length === 0 ? 'pass' : 'fail';
document.querySelector('#results').replaceChildren(...results.map((r) => {
  const li = document.createElement('li');
  li.className = r.ok ? 'pass' : 'fail';
  li.textContent = r.ok ? `成功: ${r.name}` : `失敗: ${r.name} — ${r.message}`;
  return li;
}));
