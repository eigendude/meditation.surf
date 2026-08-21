/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  blitsFileConverter,
  injectDevConfig,
  preCompiler,
  reactivityGuard,
} from "@lightningjs/blits/vite";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { createSharedSiteMetadataHtmlTags } from "../../packages/assets/src/SiteMetadata";

const require = createRequire(import.meta.url);
const lightningSettingsEntry =
  require.resolve("@lightningjs/sdk/src/Settings/index.js");
const metrologicalSdkEntry = require.resolve("@metrological/sdk/index.js");
const shakaCompiledEntry =
  require.resolve("shaka-player/dist/shaka-player.compiled.js");
const coreEntry = fileURLToPath(
  new URL("../../packages/core/src/index.ts", import.meta.url),
);
const playerCoreEntry = fileURLToPath(
  new URL("../../packages/player-core/src/index.ts", import.meta.url),
);
const playerEntry = fileURLToPath(
  new URL("../../packages/player/src/index.ts", import.meta.url),
);

/**
 * @brief Inject the shared site metadata into the generated HTML shell
 *
 * Keeping this as a Vite transform lets the app HTML stay focused on
 * structural tags while shared SEO and social metadata comes from a single
 * source of truth.
 */
function sharedMetadataPlugin() {
  return {
    name: "shared-site-metadata",
    transformIndexHtml() {
      return createSharedSiteMetadataHtmlTags();
    },
  };
}

// Vite configuration for the LightningJS-based application. The configuration
// is intentionally simple and primarily enables the Blits plugin along with the
// cross-origin headers required for certain browser APIs.

export default defineConfig({
  // Base path for all assets in production. Change this to "/myApp/" if the
  // site is deployed under a subdirectory.
  base: "/",

  // Serve runtime-public files from the repository's shared website root.
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),

  // Use the Blits Vite plugins needed by this app. The default plugin bundle
  // also includes MSDF font generation, which this project does not use.
  plugins: [
    injectDevConfig(),
    blitsFileConverter(),
    reactivityGuard(),
    preCompiler(),
    sharedMetadataPlugin(),
  ],

  server: {
    headers: {
      // Required to enable SharedArrayBuffer and other security-sensitive
      // browser features. Both headers are needed for proper isolation.
      "Cross-Origin-Opener-Policy": "same-origin",
      // Use `credentialless` so the demo video can be fetched without CORS
      // or Cross-Origin-Resource-Policy headers.
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },

  // Ensure internal Lightning modules can be bundled by the dev server
  resolve: {
    alias: {
      "@meditation-surf/core": coreEntry,
      "@meditation-surf/player": playerEntry,
      "@meditation-surf/player-core": playerCoreEntry,
      "@lightningjs/sdk/src/Settings": lightningSettingsEntry,
      "@metrological/sdk": metrologicalSdkEntry,
      "shaka-player/dist/shaka-player.compiled.js": shakaCompiledEntry,
    },
  },

  optimizeDeps: {
    include: ["@lightningjs/sdk/src/Settings", "@metrological/sdk"],
  },
});
