// 端末内の保存(IndexedDB)。サーバーには何も送らない。
// ストア: entries(記録)、categories(カテゴリ)、meta(初期化済みフラグなどの設定値)

const DB_NAME = 'haubook';
const DB_VERSION = 1;
let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('保存が中断されました'));
  });
}

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function getAll(store) {
  const db = await open();
  return promisify(db.transaction(store).objectStore(store).getAll());
}

export async function putItems(store, items) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const s = tx.objectStore(store);
  for (const item of items) s.put(item);
  return done(tx);
}

export async function deleteItem(store, id) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  return done(tx);
}

export async function getMeta(key) {
  const db = await open();
  const row = await promisify(db.transaction('meta').objectStore('meta').get(key));
  return row ? row.value : undefined;
}

export function setMeta(key, value) {
  return putItems('meta', [{ key, value }]);
}

// 記録とカテゴリをすべて置き換える(バックアップの読み込み用)。1 つのトランザクションで行う。
export async function replaceAll({ entries, categories }) {
  const db = await open();
  const tx = db.transaction(['entries', 'categories'], 'readwrite');
  const entryStore = tx.objectStore('entries');
  const categoryStore = tx.objectStore('categories');
  entryStore.clear();
  categoryStore.clear();
  for (const c of categories) categoryStore.put(c);
  for (const e of entries) entryStore.put(e);
  return done(tx);
}
