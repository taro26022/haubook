// 週の集計
import { addDays } from './date.js';

export const UNKNOWN_CATEGORY_NAME = '(不明なカテゴリ)';

// 新しい日付が先。同じ日なら後から登録したものが先。
export function compareEntries(a, b) {
  return b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '');
}

export function summarizeWeek(entries, start, categories) {
  const end = addDays(start, 6);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const list = entries.filter((e) => e.date >= start && e.date <= end).sort(compareEntries);

  let income = 0;
  let expense = 0;
  const expenseTotals = new Map();
  const days = [];

  for (const e of list) {
    if (e.type === 'income') {
      income += e.amount;
    } else {
      expense += e.amount;
      expenseTotals.set(e.categoryId, (expenseTotals.get(e.categoryId) || 0) + e.amount);
    }
    let day = days[days.length - 1];
    if (!day || day.date !== e.date) {
      day = { date: e.date, entries: [], income: 0, expense: 0 };
      days.push(day);
    }
    day.entries.push(e);
    day[e.type === 'income' ? 'income' : 'expense'] += e.amount;
  }

  const expenseByCategory = [...expenseTotals]
    .map(([categoryId, total]) => {
      const category = categoryById.get(categoryId);
      return {
        categoryId,
        name: category ? category.name : UNKNOWN_CATEGORY_NAME,
        order: category ? category.order : Infinity,
        total,
        ratio: expense > 0 ? total / expense : 0,
      };
    })
    .sort((a, b) => b.total - a.total || a.order - b.order);

  return { start, end, income, expense, balance: income - expense, expenseByCategory, days, count: list.length };
}
