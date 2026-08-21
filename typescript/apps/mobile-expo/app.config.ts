/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import sharedSiteMetadataJson from "../../packages/assets/src/SiteMetadata.json";

/**
 * @brief Expo application config sourced from shared site metadata
 */
const appConfig: {
  readonly expo: {
    readonly name: string;
    readonly slug: string;
    readonly version: string;
    readonly description: string;
    readonly orientation: "default";
    readonly ios: {
      readonly bundleIdentifier: string;
    };
  };
} = {
  expo: {
    name: sharedSiteMetadataJson.title,
    slug: "meditation-surf",
    version: "1.0.0",
    description: sharedSiteMetadataJson.description,
    orientation: "default",
    ios: {
      bundleIdentifier: "com.anonymous.meditation-surf",
    },
  },
};

export default appConfig;
