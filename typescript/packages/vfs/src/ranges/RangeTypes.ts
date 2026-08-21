/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CacheKey, CachePolicy, CacheTier } from "../cache/CacheTypes";
import type { ReadableFileDescriptor } from "../sources/ReadableFileTypes";

/**
 * @brief Inclusive-start byte range used by storage and fetch helpers
 */
export type ByteRange = {
  startOffset: number;
  endOffsetExclusive: number | null;
};

/**
 * @brief Generic range-read request emitted toward VFS storage or origins
 */
export type RangeReadRequest = {
  source: ReadableFileDescriptor;
  purpose: "generic-read" | "hot-range" | "init-segment" | "startup-window";
  range: ByteRange;
  cachePolicy: CachePolicy;
  expectedContentType: string | null;
};

/**
 * @brief Result reported from a generic storage-backed or origin-backed range read
 */
export type RangeReadResult = {
  key: CacheKey;
  source: ReadableFileDescriptor;
  purpose: RangeReadRequest["purpose"];
  range: ByteRange;
  tier: CacheTier;
  bytes: Uint8Array;
  contentType: string | null;
  fetchedAt: number;
  statusCode: number | null;
};
