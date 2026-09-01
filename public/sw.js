/* خدمة العامل — تشغيل نظام طلبات التأمين كتطبيق قابل للتثبيت
 * على أندرويد (Chrome) و iOS (Safari - إضافة للشاشة الرئيسية).
 * استراتيجية آمنة: الشبكة أولاً للصفحات، والذاكرة المؤقتة للملفات
 * الثابتة ذات التجزئة، وتمرير طلبات Convex كما هي.
 */
const CACHE_NAME = "insurance-app-v1";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // لا نعترض طلبات Convex/الواجهات الخارجية إطلاقاً
  if (url.origin !== self.location.origin) return;

  // التنقل بين الصفحات: الشبكة أولاً مع سقوط آمن للنسخة المخزنة
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // الملفات الثابتة (JS/CSS الممزوجة بالتجزئة والأيقونات): ذاكرة أولاً
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
