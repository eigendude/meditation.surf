/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable storage identity used across every VFS-backed cache surface
 */
export type CacheKey = string;

/**
 * @brief Ordered cache layers consulted by VFS reads
 */
export type VfsCacheLayer =
  | "memory-hot"
  | "disk-persistent"
  | "service-worker"
  | "network-origin"
  | "none";

/**
 * @brief Outcome recorded for one cache-layer lookup
 */
export type VfsCacheOutcome = "hit" | "miss" | "write-through" | "bypass";

/**
 * @brief Storage tier used by one cached entry
 */
export type CacheTier = "memory" | "persistent" | "origin" | "unsupported";

/**
 * @brief Conservative cache policy shared by generic VFS storage operations
 */
export type CachePolicy = {
  allowMemory: boolean;
  allowPersistent: boolean;
  allowOriginFetch: boolean;
  writeThrough: boolean;
  maxAgeMs: number | null;
};

/**
 * @brief Metadata values allowed inside persisted cache records
 */
export type PersistenceMetadataValue = boolean | number | string | null;

/**
 * @brief Serializable metadata map stored with VFS cache records
 */
export type PersistenceMetadata = Record<string, PersistenceMetadataValue>;

/**
 * @brief Cached entry description surfaced for debug and snapshot consumers
 */
export type CacheEntry = {
  key: CacheKey;
  tier: CacheTier;
  contentType: string | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  byteLength: number | null;
  metadata: PersistenceMetadata;
};

/**
 * @brief Inspectable lookup step recorded for one VFS-backed read or write flow
 */
export type VfsCacheLookupStep = {
  key: CacheKey;
  layer: VfsCacheLayer;
  outcome: VfsCacheOutcome;
  requestUrl: string | null;
  detail: string | null;
  recordedAt: number;
};

/**
 * @brief Default cache policy used for conservative generic VFS persistence
 */
export const DEFAULT_CACHE_POLICY: CachePolicy = {
  allowMemory: true,
  allowPersistent: true,
  allowOriginFetch: true,
  writeThrough: true,
  maxAgeMs: null,
};
