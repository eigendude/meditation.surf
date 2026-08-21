/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CacheKey, CacheTier } from "./cache/CacheTypes";
import type { VfsPath } from "./VfsPath";

/**
 * @brief Inspectable node surfaced by VFS snapshots and handles
 */
export type VfsNode = {
  key: CacheKey;
  nodeType: "artifact" | "manifest" | "range" | "unknown";
  tier: CacheTier;
  path: VfsPath;
  byteLength: number | null;
  updatedAt: number;
};
