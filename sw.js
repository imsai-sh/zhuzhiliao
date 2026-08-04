/* 竹知了 Service Worker —— 让安卓 Chrome 满足 PWA 安装条件，顺带离线可玩。
   策略：导航请求网络优先（部署后必拿新版，断网回退缓存）；
   静态资源 stale-while-revalidate（先出缓存秒开，后台自动更新，无需手动版本号）；
   /api/* 一律直连不缓存。 */
const CACHE = 'zzl-v1';
const CORE = [
  './', './manifest.webmanifest', './apple-touch-icon.png',
  './icon-192.png', './icon-512.png', './title.jpg', './moon.png', './2D.png', './2D_1.png',
  './Audio/1.mp3',
  './Audio/37815454648-1-192.mp3',
  './Audio/37815454648-1-192_1.mp3',
  './Audio/37815454648-1-192_2.mp3',
  './Audio/40016871707-1-192.mp3',
  './Audio/40016871707-1-192_1.mp3',
  './Audio/40016871707-1-192_2.mp3',
  './Audio/40016871707-1-192_3.mp3',
  './Audio/40016871707-1-192_4.mp3',
  './Audio/ba4faa37240e4a2486cbe54b666d76a1.mp3',
  './Audio/ba4faa37240e4a2486cbe54b666d76a1_1.mp3',
  './Audio/ba4faa37240e4a2486cbe54b666d76a1_2.mp3',
  './Audio/ba4faa37240e4a2486cbe54b666d76a1_3.mp3',
  './Audio/ba4faa37240e4a2486cbe54b666d76a1_4.mp3',
  './Audio/ba4faa37240e4a2486cbe54b666d76a1_5.mp3',
  './Audio/ba4faa37240e4a2486cbe54b666d76a1_6.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;   // 计数走实时接口，永不缓存

  if (e.request.mode === 'navigate') {
    // 页面本体：网络优先，离线回退缓存
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put('./', cp));
        return r;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // 静态资源：先出缓存，后台刷新
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => {
        if (r.ok) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
