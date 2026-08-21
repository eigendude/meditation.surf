/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/* global Response, URL, caches, self */

const CACHE_NAME = "meditation-surf-vfs-startup-v1";
const SYNTHETIC_PREFIX = "/__meditation_surf_vfs__/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (!requestUrl.pathname.startsWith(SYNTHETIC_PREFIX)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      return (
        cachedResponse ??
        new Response("", {
          status: 404,
          statusText: "Not Found",
        })
      );
    }),
  );
});
