// 初回起動時に登録するカテゴリ。後から設定画面で追加・変更できる。

const EXPENSE = ['食費', '日用品', '交通', '交際', '趣味', '住居', '光熱', '通信', 'その他'];
const INCOME = ['給与', '仕送り', 'その他'];

export const DEFAULT_CATEGORIES = [
  ...EXPENSE.map((name, i) => ({ id: `default-expense-${i + 1}`, type: 'expense', name, order: i })),
  ...INCOME.map((name, i) => ({ id: `default-income-${i + 1}`, type: 'income', name, order: i })),
];
