/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import blitsVitePlugins from "@lightningjs/blits/vite";
import { defineConfig } from "vite";

// Vite configuration for the LightningJS-based application. The configuration
// is intentionally simple and primarily enables the Blits plugin along with the
// cross-origin headers required for certain browser APIs.

export default defineConfig({
  // Base path for all assets in production. Change this to "/myApp/" if the
  // site is deployed under a subdirectory.
  base: "/",

  // Use the Blits plugin to add LightningJS support during build and dev
  plugins: [...blitsVitePlugins],

  server: {
    headers: {
      // Required to enable SharedArrayBuffer and other security-sensitive
      // browser features. Both headers are needed for proper isolation.
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
