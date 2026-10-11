// バックアップ(JSON ファイル)の作成と読み込み時の検証
import { isValidDateString } from './date.js';
import { MAX_AMOUNT } from './format.js';

export const BACKUP_FORMAT = 'haubook-backup';
export const BACKUP_VERSION = 1;
const TYPES = ['expense', 'income'];

export function backupFileName(dateString) {
  return `haubook-backup-${dateString}.json`;
}

export function buildBackup(entries, categories, now = new Date()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    categories: [...categories].sort((a, b) => a.type.localeCompare(b.type) || a.order - b.order),
    entries: [...entries].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '')),
  };
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function validateCategory(c, i) {
  const where = `カテゴリの ${i + 1} 件目`;
  if (!c || typeof c !== 'object') throw new Error(`${where}の形式が正しくありません。`);
  if (!isNonEmptyString(c.id)) throw new Error(`${where}に id がありません。`);
  if (!TYPES.includes(c.type)) throw new Error(`${where}の種類(収入/支出)が正しくありません。`);
  if (!isNonEmptyString(c.name)) throw new Error(`${where}に名前がありません。`);
  if (!Number.isFinite(c.order)) throw new Error(`${where}の並び順が正しくありません。`);
  return { id: c.id, type: c.type, name: c.name.trim(), order: c.order };
}

function validateEntry(e, i, categoryById) {
  const where = `記録の ${i + 1} 件目`;
  if (!e || typeof e !== 'object') throw new Error(`${where}の形式が正しくありません。`);
  if (!isNonEmptyString(e.id)) throw new Error(`${where}に id がありません。`);
  if (!isValidDateString(e.date)) throw new Error(`${where}の日付が正しくありません。`);
  if (!Number.isSafeInteger(e.amount) || e.amount <= 0 || e.amount > MAX_AMOUNT) {
    throw new Error(`${where}の金額が正しくありません。`);
  }
  if (!TYPES.includes(e.type)) throw new Error(`${where}の種類(収入/支出)が正しくありません。`);
  const category = categoryById.get(e.categoryId);
  if (!category) throw new Error(`${where}のカテゴリが、バックアップ内のカテゴリに見つかりません。`);
  if (category.type !== e.type) throw new Error(`${where}の種類とカテゴリの種類が一致しません。`);
  if (e.memo != null && typeof e.memo !== 'string') throw new Error(`${where}のメモが正しくありません。`);
  return {
    id: e.id,
    date: e.date,
    amount: e.amount,
    type: e.type,
    categoryId: e.categoryId,
    memo: e.memo ?? '',
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : '',
    updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : '',
  };
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`${label}の id が重複しています(${item.id})。`);
    seen.add(item.id);
  }
}

// 文字列を検証して { categories, entries } を返す。問題があれば日本語のメッセージで Error を投げる。
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON として読み取れませんでした。ファイルが壊れていないか確認してください。');
  }
  if (!data || typeof data !== 'object' || data.format !== BACKUP_FORMAT) {
    throw new Error('この家計簿アプリのバックアップファイルではありません。');
  }
  if (data.version !== BACKUP_VERSION) {
    throw new Error(`対応していないバージョンのバックアップです(version: ${data.version})。`);
  }
  if (!Array.isArray(data.categories) || !Array.isArray(data.entries)) {
    throw new Error('バックアップにカテゴリまたは記録の一覧がありません。');
  }
  const categories = data.categories.map(validateCategory);
  assertUniqueIds(categories, 'カテゴリ');
  for (const type of TYPES) {
    if (!categories.some((c) => c.type === type)) {
      throw new Error(`${type === 'income' ? '収入' : '支出'}のカテゴリが 1 つもありません。`);
    }
  }
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const entries = data.entries.map((e, i) => validateEntry(e, i, categoryById));
  assertUniqueIds(entries, '記録');
  return { categories, entries };
}
