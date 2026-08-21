/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  CacheEntry,
  CacheKey,
  CacheTier,
  PersistenceMetadata,
} from "../cache/CacheTypes";

/**
 * @brief Serializable body types supported by the generic persistence layer
 */
export type PersistenceBody = Blob | string;

/**
 * @brief Stable stored record managed by one persistence adapter
 */
export type PersistenceRecord = CacheEntry & {
  body: PersistenceBody;
  bodyKind: "blob" | "text";
};

/**
 * @brief Input payload used when writing one persistence record
 */
export type PersistenceWriteRequest = {
  key: CacheKey;
  tier: CacheTier;
  contentType: string | null;
  metadata: PersistenceMetadata;
  body: PersistenceBody;
  bodyKind: "blob" | "text";
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  byteLength: number | null;
};

/**
 * @brief Generic persistence adapter used by the VFS controller
 */
export interface PersistenceAdapter {
  /**
   * @brief Read one record by stable cache key
   *
   * @param key - Stable cache key being resolved
   *
   * @returns Matching record, or `null` when absent
   */
  get(key: CacheKey): Promise<PersistenceRecord | null>;

  /**
   * @brief Persist or replace one record
   *
   * @param record - Stored record being written
   */
  put(record: PersistenceWriteRequest): Promise<PersistenceRecord>;

  /**
   * @brief Delete one record by cache key
   *
   * @param key - Stable cache key being removed
   */
  delete(key: CacheKey): Promise<void>;

  /**
   * @brief List records that share an optional key prefix
   *
   * @param keyPrefix - Optional prefix filter
   *
   * @returns Matching records
   */
  list(keyPrefix?: string): Promise<PersistenceRecord[]>;

  /**
   * @brief Clear persisted records that share an optional key prefix
   *
   * @param keyPrefix - Optional prefix filter
   */
  clear(keyPrefix?: string): Promise<void>;
}
