/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CacheEntry, CacheKey } from "./cache/CacheTypes";
import type { VfsPath } from "./VfsPath";

/**
 * @brief Inspectable handle returned for one stable VFS cache key
 */
export interface VfsHandle {
  readonly cacheKey: CacheKey;
  readonly path: VfsPath;

  /**
   * @brief Resolve the latest cache entry associated with this handle
   *
   * @returns Matching cache entry, or `null` when absent
   */
  getEntry(): Promise<CacheEntry | null>;
}
