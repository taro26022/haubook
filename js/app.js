// 画面の表示と操作
import * as db from './db.js';
import { today, weekStart, addDays, formatWeekRange, formatDayLabel, relativeWeekLabel, isValidDateString } from './date.js';
import { formatYen, parseAmount } from './format.js';
import { summarizeWeek, UNKNOWN_CATEGORY_NAME } from './summary.js';
import { buildBackup, parseBackup, backupFileName } from './backup.js';
import { DEFAULT_CATEGORIES } from './defaults.js';

const APP_VERSION = '1.0.0';
const CATEGORY_NAME_MAX = 20;

const state = {
  entries: [],
  categories: [],
  weekStart: weekStart(today()),
  view: 'week',
  settingsType: 'expense',
  editingId: null,
  lastExportedAt: null,
};

const $ = (selector) => document.querySelector(selector);

// DOM 要素を作る小さな関数。文字列は textContent として入るので、HTML として解釈されない。
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function categoriesOf(type) {
  return state.categories.filter((c) => c.type === type).sort((a, b) => a.order - b.order);
}

function categoryName(id) {
  return state.categories.find((c) => c.id === id)?.name ?? UNKNOWN_CATEGORY_NAME;
}

let toastTimer = null;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
}

// ---------- 週の収支 ----------

function renderWeek() {
  const s = summarizeWeek(state.entries, state.weekStart, state.categories);
  const { range, year } = formatWeekRange(state.weekStart);
  const relative = relativeWeekLabel(state.weekStart, today());
  $('#week-range').textContent = range;
  $('#week-sub').textContent = relative ? `${year} · ${relative}` : year;
  $('#this-week').hidden = state.weekStart === weekStart(today());

  $('#sum-income').textContent = formatYen(s.income);
  $('#sum-expense').textContent = formatYen(s.expense);
  const balance = $('#sum-balance');
  balance.textContent = s.balance > 0 ? `+${formatYen(s.balance)}` : formatYen(s.balance);
  balance.classList.toggle('positive', s.balance > 0);
  balance.classList.toggle('negative', s.balance < 0);

  $('#breakdown').replaceChildren(...s.expenseByCategory.map((row) => {
    const percent = Math.round(row.ratio * 100);
    return el('li', {},
      el('div', { class: 'breakdown-row' },
        el('span', { class: 'breakdown-name' }, row.name),
        el('span', { class: 'breakdown-amount' }, formatYen(row.total), el('small', {}, `${percent}%`))),
      el('div', { class: 'bar', 'aria-hidden': 'true' },
        el('span', { style: `width:${Math.max(row.ratio * 100, 1)}%` })));
  }));
  $('#breakdown-empty').hidden = s.expenseByCategory.length > 0;

  $('#entry-list').replaceChildren(...s.days.map((day) => el('div', { class: 'day' },
    el('div', { class: 'day-header' },
      el('span', {}, formatDayLabel(day.date)),
      el('span', { class: 'day-total' }, day.expense > 0 ? `支出 ${formatYen(day.expense)}` : '')),
    el('ul', { class: 'entries' }, day.entries.map((entry) => el('li', {},
      el('button', { type: 'button', class: 'entry', onclick: () => openEntryForm(entry) },
        el('span', { class: 'entry-main' },
          el('span', { class: 'entry-category' }, categoryName(entry.categoryId)),
          entry.memo ? el('span', { class: 'entry-memo' }, entry.memo) : null),
        el('span', { class: `entry-amount ${entry.type}` },
          entry.type === 'income' ? `+${formatYen(entry.amount)}` : formatYen(entry.amount)))))))));
  $('#list-empty').hidden = s.count > 0;
}

function moveWeek(days) {
  state.weekStart = addDays(state.weekStart, days);
  renderWeek();
}

// ---------- 記録の入力・編集 ----------

function selectedType() {
  return $('#entry-form').elements.type.value;
}

function renderCategoryChips(type, selectedId) {
  const list = categoriesOf(type);
  const chosen = list.some((c) => c.id === selectedId) ? selectedId : list[0]?.id;
  $('#entry-categories').replaceChildren(...list.map((c) => el('label', { class: 'chip' },
    el('input', { type: 'radio', name: 'category', value: c.id, checked: c.id === chosen }),
    el('span', {}, c.name))));
}

function showFormError(message) {
  const node = $('#entry-error');
  node.textContent = message;
  node.hidden = !message;
}

function openEntryForm(entry = null) {
  const form = $('#entry-form');
  state.editingId = entry ? entry.id : null;
  const type = entry ? entry.type : 'expense';
  form.elements.type.value = type;
  form.elements.amount.value = entry ? String(entry.amount) : '';
  form.elements.date.value = entry ? entry.date : today();
  form.elements.memo.value = entry ? entry.memo : '';
  renderCategoryChips(type, entry?.categoryId);
  $('#entry-title').textContent = entry ? '記録を編集' : '記録を追加';
  $('#entry-delete').hidden = !entry;
  document.body.dataset.entryType = type;
  showFormError('');
  $('#entry-dialog').showModal();
  if (!entry) form.elements.amount.focus();
}

function closeEntryForm() {
  $('#entry-dialog').close();
  state.editingId = null;
}

async function saveEntry(event) {
  event.preventDefault();
  const form = $('#entry-form');
  const amount = parseAmount(form.elements.amount.value);
  if (amount === null) return showFormError('金額を 1 円以上の整数で入力してください。');
  const date = form.elements.date.value;
  if (!isValidDateString(date)) return showFormError('日付を入力してください。');
  const categoryId = form.elements.category?.value;
  if (!categoryId) return showFormError('カテゴリを選んでください。');

  const existing = state.entries.find((e) => e.id === state.editingId);
  const now = new Date().toISOString();
  const entry = {
    id: existing ? existing.id : newId(),
    date,
    amount,
    type: selectedType(),
    categoryId,
    memo: form.elements.memo.value.trim(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  try {
    await db.putItems('entries', [entry]);
  } catch (error) {
    return showFormError(`保存できませんでした: ${error.message}`);
  }
  state.entries = existing
    ? state.entries.map((e) => (e.id === entry.id ? entry : e))
    : [...state.entries, entry];
  state.weekStart = weekStart(date);
  closeEntryForm();
  render();
  toast(existing ? '変更しました' : '保存しました');
}

async function deleteEntry() {
  const id = state.editingId;
  if (!id || !confirm('この記録を削除しますか?')) return;
  try {
    await db.deleteItem('entries', id);
  } catch (error) {
    return showFormError(`削除できませんでした: ${error.message}`);
  }
  state.entries = state.entries.filter((e) => e.id !== id);
  closeEntryForm();
  render();
  toast('削除しました');
}

// ---------- 設定: カテゴリ ----------

function renderCategories() {
  const list = categoriesOf(state.settingsType);
  $('#category-list').replaceChildren(...list.map((c, i) => {
    const used = state.entries.filter((e) => e.categoryId === c.id).length;
    return el('li', { class: 'category-item' },
      el('span', { class: 'category-name' }, c.name, el('small', {}, `${used} 件`)),
      el('span', { class: 'category-actions' },
        el('button', { type: 'button', class: 'icon-btn small', 'aria-label': `${c.name}を上へ`, disabled: i === 0, onclick: () => moveCategory(c, -1) }, '↑'),
        el('button', { type: 'button', class: 'icon-btn small', 'aria-label': `${c.name}を下へ`, disabled: i === list.length - 1, onclick: () => moveCategory(c, 1) }, '↓'),
        el('button', { type: 'button', class: 'text-btn', onclick: () => renameCategory(c) }, '名前変更'),
        el('button', { type: 'button', class: 'text-btn danger', onclick: () => removeCategory(c, used) }, '削除')));
  }));
}

function validateCategoryName(name, type, exceptId = null) {
  if (!name) return 'カテゴリ名を入力してください。';
  if (name.length > CATEGORY_NAME_MAX) return `カテゴリ名は ${CATEGORY_NAME_MAX} 文字以内にしてください。`;
  if (categoriesOf(type).some((c) => c.name === name && c.id !== exceptId)) return `「${name}」はすでにあります。`;
  return null;
}

async function saveCategories(changed) {
  await db.putItems('categories', changed);
  const byId = new Map(changed.map((c) => [c.id, c]));
  state.categories = [
    ...state.categories.map((c) => byId.get(c.id) ?? c),
    ...changed.filter((c) => !state.categories.some((x) => x.id === c.id)),
  ];
  render();
}

async function addCategory(event) {
  event.preventDefault();
  const input = $('#category-name');
  const name = input.value.trim();
  const type = state.settingsType;
  const error = validateCategoryName(name, type);
  if (error) return alert(error);
  const order = Math.max(-1, ...categoriesOf(type).map((c) => c.order)) + 1;
  await saveCategories([{ id: newId(), type, name, order }]);
  input.value = '';
  toast(`「${name}」を追加しました`);
}

async function renameCategory(category) {
  const input = prompt('新しいカテゴリ名', category.name);
  if (input === null) return;
  const name = input.trim();
  if (name === category.name) return;
  const error = validateCategoryName(name, category.type, category.id);
  if (error) return alert(error);
  await saveCategories([{ ...category, name }]);
  toast('名前を変更しました');
}

async function moveCategory(category, direction) {
  const list = categoriesOf(category.type);
  const index = list.findIndex((c) => c.id === category.id);
  const other = list[index + direction];
  if (!other) return;
  // 並び順を振り直してから入れ替える(order が重複していても正しく動くように)
  const reordered = list.map((c, i) => ({ ...c, order: i }));
  [reordered[index].order, reordered[index + direction].order] = [index + direction, index];
  await saveCategories(reordered);
}

async function removeCategory(category, used) {
  if (used > 0) {
    return alert(`「${category.name}」は ${used} 件の記録で使われているため削除できません。\n名前の変更はできます。`);
  }
  if (categoriesOf(category.type).length <= 1) {
    return alert('カテゴリは 1 つ以上必要です。');
  }
  if (!confirm(`カテゴリ「${category.name}」を削除しますか?`)) return;
  await db.deleteItem('categories', category.id);
  state.categories = state.categories.filter((c) => c.id !== category.id);
  render();
  toast('削除しました');
}

// ---------- 設定: バックアップ ----------

function renderBackupInfo() {
  $('#last-export').textContent = state.lastExportedAt
    ? `最後に書き出した日時: ${new Date(state.lastExportedAt).toLocaleString('ja-JP')}`
    : 'まだ書き出していません。';
  $('#entry-count').textContent = String(state.entries.length);
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = el('a', { href: url, download: file.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function exportBackup() {
  const now = new Date();
  const json = JSON.stringify(buildBackup(state.entries, state.categories, now), null, 2);
  const file = new File([json], backupFileName(today()), { type: 'application/json' });
  // iPhone では共有シートを使う(「"ファイル"に保存」で iCloud Drive などに保存できる)。
  // パソコンや、共有に対応していない環境では通常のダウンロードにする。
  const useShare = matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] });
  if (useShare) {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error.name === 'AbortError') return; // 利用者が共有をキャンセルした
      downloadFile(file);
    }
  } else {
    downloadFile(file);
  }
  state.lastExportedAt = now.toISOString();
  await db.setMeta('lastExportedAt', state.lastExportedAt);
  renderBackupInfo();
  toast('書き出しました');
}

async function importBackup(event) {
  const input = event.target;
  const file = input.files?.[0];
  input.value = ''; // 同じファイルをもう一度選べるようにする
  if (!file) return;
  let data;
  try {
    data = parseBackup(await file.text());
  } catch (error) {
    return alert(`読み込めませんでした。\n${error.message}`);
  }
  const ok = confirm(
    'バックアップを読み込むと、今のデータはすべて置き換わります。\n\n'
    + `今のデータ: 記録 ${state.entries.length} 件、カテゴリ ${state.categories.length} 件\n`
    + `読み込むデータ: 記録 ${data.entries.length} 件、カテゴリ ${data.categories.length} 件\n\n`
    + '続けますか?');
  if (!ok) return;
  try {
    await db.replaceAll(data);
  } catch (error) {
    return alert(`読み込みの保存に失敗しました。データは変更されていません。\n${error.message}`);
  }
  state.entries = data.entries;
  state.categories = data.categories;
  render();
  toast('読み込みました');
}

// ---------- 全体 ----------

function showView(view) {
  state.view = view;
  $('#view-week').hidden = view !== 'week';
  $('#view-settings').hidden = view !== 'settings';
  $('#add-btn').hidden = view !== 'week';
  for (const tab of document.querySelectorAll('.tab')) {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
  }
  window.scrollTo(0, 0);
}

function render() {
  renderWeek();
  renderCategories();
  renderBackupInfo();
}

function bindEvents() {
  $('#prev-week').addEventListener('click', () => moveWeek(-7));
  $('#next-week').addEventListener('click', () => moveWeek(7));
  $('#this-week').addEventListener('click', () => {
    state.weekStart = weekStart(today());
    renderWeek();
  });
  $('#add-btn').addEventListener('click', () => openEntryForm());
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  }

  const form = $('#entry-form');
  form.addEventListener('submit', saveEntry);
  $('#entry-cancel').addEventListener('click', closeEntryForm);
  $('#entry-delete').addEventListener('click', deleteEntry);
  for (const radio of form.elements.type) {
    radio.addEventListener('change', () => {
      document.body.dataset.entryType = selectedType();
      renderCategoryChips(selectedType());
    });
  }

  for (const radio of document.querySelectorAll('input[name="cat-type"]')) {
    radio.addEventListener('change', () => {
      state.settingsType = radio.value;
      renderCategories();
    });
  }
  $('#category-add').addEventListener('submit', addCategory);
  $('#export-btn').addEventListener('click', exportBackup);
  $('#import-input').addEventListener('change', importBackup);

  // 日付が変わった後にアプリへ戻ってきたとき、「今週」の表示を更新する
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderWeek();
  });
}

async function loadData() {
  if (!(await db.getMeta('initialized'))) {
    await db.putItems('categories', DEFAULT_CATEGORIES);
    await db.setMeta('initialized', true);
  }
  state.entries = await db.getAll('entries');
  state.categories = await db.getAll('categories');
  state.lastExportedAt = (await db.getMeta('lastExportedAt')) ?? null;
}

async function showStorageStatus() {
  const node = $('#persist-status');
  if (!navigator.storage?.persist) {
    node.textContent = 'この環境では確認できません';
    return;
  }
  const persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
  node.textContent = persisted ? '許可されています' : '許可されていません(ブラウザがデータを消す可能性があります)';
}

async function init() {
  $('#app-version').textContent = APP_VERSION;
  try {
    await loadData();
  } catch (error) {
    document.body.replaceChildren(el('p', { class: 'fatal' },
      'データを読み込めませんでした。プライベートブラウズでは使えない場合があります。', el('br'), error.message));
    return;
  }
  bindEvents();
  render();
  showView('week');
  showStorageStatus();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
