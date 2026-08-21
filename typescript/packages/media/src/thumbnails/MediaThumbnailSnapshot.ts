/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaThumbnailCacheEntry } from "./MediaThumbnailCacheEntry";

/**
 * @brief Immutable shared thumbnail snapshot exposed for UI and debug consumers
 */
export type MediaThumbnailSnapshot = {
  entries: MediaThumbnailCacheEntry[];
  requestedSourceIds: string[];
  cachedSourceIds: string[];
  readySourceIds: string[];
  failedSourceIds: string[];
  unsupportedSourceIds: string[];
};
