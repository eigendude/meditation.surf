/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

import prettier from "prettier";

/**
 * Shared repository root resolved from this script's location.
 */
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * Load the shared site metadata JSON so the manifest stays aligned with the
 * browser metadata injected by Vite.
 *
 * @returns {Promise<Record<string, unknown>>} Parsed shared site metadata
 */
async function loadSharedSiteMetadata() {
  const siteMetadataPath = path.join(
    repositoryRoot,
    "packages",
    "assets",
    "src",
    "SiteMetadata.json",
  );
  const siteMetadataText = await readFile(siteMetadataPath, "utf8");

  return JSON.parse(siteMetadataText);
}

/**
 * Build the public web app manifest payload from the shared metadata source.
 *
 * @param {Record<string, unknown>} siteMetadata Shared metadata values
 *
 * @returns {Record<string, unknown>} Manifest JSON payload
 */
function createWebManifest(siteMetadata) {
  const canonicalUrl = new URL(String(siteMetadata.canonicalUrl));
  const manifestId = canonicalUrl.pathname || "/";
  const iconPath = String(siteMetadata.imagePath);

  return {
    id: manifestId,
    name: String(siteMetadata.title),
    short_name: String(siteMetadata.applicationName),
    description: String(siteMetadata.description),
    start_url: String(siteMetadata.startUrl),
    scope: String(siteMetadata.scope),
    display: String(siteMetadata.display),
    display_override: Array.isArray(siteMetadata.displayOverride)
      ? siteMetadata.displayOverride
      : [],
    orientation: String(siteMetadata.orientation),
    lang: String(siteMetadata.lang),
    dir: String(siteMetadata.dir),
    categories: Array.isArray(siteMetadata.categories)
      ? siteMetadata.categories
      : [],
    background_color: String(siteMetadata.backgroundColor),
    theme_color: String(siteMetadata.themeColor),
    icons: [
      {
        src: iconPath,
        type: "image/png",
        sizes: "1500x1500",
        purpose: "any",
      },
    ],
  };
}

/**
 * Persist the generated manifest into the shared public directory used by the
 * browser-facing builds.
 */
async function syncWebManifest() {
  const siteMetadata = await loadSharedSiteMetadata();
  const webManifest = createWebManifest(siteMetadata);
  const manifestDirectoryPath = path.join(repositoryRoot, "public");
  const manifestPath = path.join(manifestDirectoryPath, "manifest.json");
  const unformattedManifestText = `${JSON.stringify(webManifest, null, 2)}\n`;
  const manifestText = await prettier.format(unformattedManifestText, {
    parser: "json",
  });

  await mkdir(manifestDirectoryPath, { recursive: true });
  await writeFile(manifestPath, manifestText, "utf8");
}

await syncWebManifest();
