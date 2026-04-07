/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
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
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const lightningSettingsEntry =
  require.resolve("@lightningjs/sdk/src/Settings/index.js");
const metrologicalSdkEntry = require.resolve("@metrological/sdk/index.js");

// Vite configuration for the LightningJS-based application. The configuration
// is intentionally simple and primarily enables the Blits plugin along with the
// cross-origin headers required for certain browser APIs.

export default defineConfig({
  // Base path for all assets in production. Change this to "/myApp/" if the
  // site is deployed under a subdirectory.
  base: "/",

  // Use the Blits Vite plugins needed by this app. The default plugin bundle
  // also includes MSDF font generation, which this project does not use.
  plugins: [
    injectDevConfig(),
    blitsFileConverter(),
    reactivityGuard(),
    preCompiler(),
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
      "@lightningjs/sdk/src/Settings": lightningSettingsEntry,
      "@metrological/sdk": metrologicalSdkEntry,
    },
  },

  optimizeDeps: {
    include: ["@lightningjs/sdk/src/Settings", "@metrological/sdk"],
  },
});
