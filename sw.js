var CACHE_VERSION = "prism-pour-cache-v2.4.0";
var APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./levels.js",
  "./app.js",
  "./manifest.json",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/audio/README.txt"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_VERSION) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (
    event.request.mode === "navigate" ||
    requestUrl.pathname.endsWith("/manifest.json") ||
    requestUrl.pathname.endsWith("/sw.js")
  ) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function networkFirst(request) {
  return fetch(request).then(function (response) {
    var copy = response.clone();
    caches.open(CACHE_VERSION).then(function (cache) {
      cache.put(request, copy);
    });
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || caches.match("./index.html");
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) {
      return cached;
    }

    return fetch(request).then(function (response) {
      if (!response || response.status !== 200) {
        return response;
      }

      var copy = response.clone();
      caches.open(CACHE_VERSION).then(function (cache) {
        cache.put(request, copy);
      });
      return response;
    }).catch(function () {
      return caches.match("./index.html");
    });
  });
}
