/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief React Native asset handle for the shared brand icon
 *
 * The binary file remains in the repository's shared `public/` directory while
 * this package provides the single import location used by React Native
 * consumers. A URI-style image source keeps the asset rooted in `public/`
 * instead of requiring a second bundled copy inside a package.
 */
export const BRAND_ICON_SOURCE: { uri: string } = {
  uri: "/images/icon-1500x1500.png",
};
