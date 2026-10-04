/*
 * 旅遊規劃的離線小幫手（Service Worker）
 * - 入口頁：有網路時一律拿最新版，沒網路時用存著的那一份
 * - 字體、圖示：用過一次就存起來
 * - 行程照片：離線備份頁用到的照片存起來，下次直接從手機裡拿
 * - offline.html：入口頁存下的行程備份
 */
const SHELL = 'tp-shell-v2', IMG = 'tp-img', SNAP = 'tp-snap';
const IMG_MAX = 400;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['./', 'config.js', 'fonts/swei.css', 'favicon.ico', 'icons/apple-touch-icon.png', 'icons/favicon.svg'])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tp-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const OFFLINE_EMPTY = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#E7E8E2;color:#1B2A2E;font:16px/1.7 -apple-system,sans-serif;text-align:center">' +
  '<div>目前沒有網路<br><span style="color:#777;font-size:14px">連上網路打開一次行程後，就會自動存一份離線備份</span></div>';

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (url.pathname.endsWith('/offline.html')) {
      url.searchParams.delete('warm');
      e.respondWith(caches.open(SNAP).then(c => c.match(url.href).then(r => r ||
        c.match(new URL('offline.html?latest=1', location.href).href)).then(r => r ||
        new Response(OFFLINE_EMPTY, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
      return;
    }
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./', copy)); }
        return res;
      }).catch(() => caches.open(SHELL).then(c => c.match('./'))));
      return;
    }
    if (url.pathname.endsWith('/config.js')) {
      e.respondWith(fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('config.js', copy)); }
        return res;
      }).catch(() => caches.open(SHELL).then(c => c.match('config.js'))));
      return;
    }
    if (/\/(fonts|icons)\/|favicon\.ico$/.test(url.pathname)) {
      e.respondWith(caches.open(SHELL).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) c.put(req, res.clone());
        return res;
      }))));
    }
    return;
  }

  /* 照片：Google 圖片主機、雲端硬碟縮圖 */
  if (url.hostname === 'lh3.googleusercontent.com' || (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail')) {
    e.respondWith(caches.open(IMG).then(c => c.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        c.put(req, res.clone()).then(() => c.keys()).then(keys => { if (keys.length > IMG_MAX) keys.slice(0, keys.length - IMG_MAX).forEach(k => c.delete(k)); });
      }
      return res;
    }))));
  }
});
