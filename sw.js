// オフラインでも開けるようにするための Service Worker。
// 方針: ネットワーク優先。つながるときは常に最新のファイルを使い、取得したファイルをキャッシュに保存する。
// つながらないとき(または 3 秒以内に応答がないとき)はキャッシュから返す。
// そのため、アプリを更新したときに CACHE_NAME を変える必要はない。

const CACHE_NAME = 'haubook-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/backup.js',
  './js/date.js',
  './js/db.js',
  './js/defaults.js',
  './js/format.js',
  './js/summary.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromCache(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode === 'navigate') return caches.match('./index.html');
  return undefined;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  // cache: 'no-cache' で、ブラウザの HTTP キャッシュに古い版が残っていても必ずサーバーに確認する
  const network = fetch(request.url, { cache: 'no-cache' }).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  network.catch(() => {}); // 時間切れでキャッシュを返した後の失敗を、未処理のエラーにしない
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    // 時間切れ: キャッシュがあればそれを返し、なければネットワークを待つ
    return (await fromCache(request)) || (await network);
  } catch {
    const cached = await fromCache(request);
    if (cached) return cached;
    throw new Error('offline and not cached');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
