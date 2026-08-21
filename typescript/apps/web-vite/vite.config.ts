/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { fileURLToPath, URL } from "node:url";

import { defineConfig, type PluginOption } from "vite";

import { createSharedSiteMetadataHtmlTags } from "../../packages/assets/src/SiteMetadata";

/**
 * @brief Inject shared site metadata into the web app HTML shell
 *
 * Vite owns the final HTML output, so we keep `index.html` minimal and let this
 * hook attach the canonical, Open Graph, and Twitter tags from the shared
 * source of truth in `@meditation-surf/assets`.
 */
function createSharedMetadataPlugin(): PluginOption {
  return {
    name: "shared-site-metadata",
    transformIndexHtml() {
      return createSharedSiteMetadataHtmlTags();
    },
  };
}

export default defineConfig({
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  plugins: [createSharedMetadataPlugin()],
});
