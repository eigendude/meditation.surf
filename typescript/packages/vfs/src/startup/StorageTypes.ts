/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  CacheKey,
  CachePolicy,
  CacheTier,
  VfsCacheLayer,
  VfsCacheLookupStep,
} from "../cache/CacheTypes";
import type { ByteRange } from "../ranges/RangeTypes";
import type { ReadableFileDescriptor } from "../sources/ReadableFileTypes";

/**
 * @brief Stable startup artifact families owned by VFS
 */
export type StartupArtifactKind =
  | "manifest"
  | "init-segment"
  | "startup-window"
  | "hot-range";

/**
 * @brief Shared startup use-cases that consult VFS-owned byte storage
 */
export type StartupUseCase =
  | "preview-warm"
  | "thumbnail-extract"
  | "committed-playback-startup"
  | "generic";

/**
 * @brief Stable descriptor for one stored startup-byte artifact
 */
export type StartupWindowDescriptor = {
  cacheKey: CacheKey;
  identityKey: string;
  source: ReadableFileDescriptor;
  purpose: "init-segment" | "startup-window" | "hot-range";
  requestUrl: string;
  range: ByteRange;
  variantKey: string | null;
};

/**
 * @brief Runtime request used to resolve one startup-byte artifact
 */
export type StartupWindowRequest = {
  source: ReadableFileDescriptor;
  purpose: StartupWindowDescriptor["purpose"];
  requestUrl: string | null;
  range: ByteRange;
  variantKey: string | null;
  cachePolicy: CachePolicy;
  expectedContentType: string | null;
  useCase: StartupUseCase;
  allowServiceWorkerLookup: boolean;
  fallbackReason: string | null;
};

/**
 * @brief Stored cache entry returned for one startup-byte artifact
 */
export type StartupWindowCacheEntry = {
  descriptor: StartupWindowDescriptor;
  tier: CacheTier;
  bytes: Uint8Array;
  contentType: string | null;
  storedAt: number;
  byteLength: number;
};

/**
 * @brief Stored manifest entry managed by VFS storage primitives
 */
export type ManifestCacheEntry = {
  key: CacheKey;
  identityKey: string;
  source: ReadableFileDescriptor;
  requestUrl: string;
  tier: CacheTier;
  manifestText: string;
  contentType: string | null;
  storedAt: number;
  byteLength: number;
};

/**
 * @brief Manifest lookup request emitted toward VFS-owned storage
 */
export type ManifestRequest = {
  source: ReadableFileDescriptor;
  requestUrl: string | null;
  cachePolicy: CachePolicy;
  expectedContentType: string | null;
  useCase: StartupUseCase;
  allowServiceWorkerLookup: boolean;
  fallbackReason: string | null;
};

/**
 * @brief Resolved manifest lookup result with explicit lookup-order visibility
 */
export type ManifestResult = {
  entry: ManifestCacheEntry | null;
  lookupSteps: VfsCacheLookupStep[];
  resolvedLayer: VfsCacheLayer;
  fallbackReason: string | null;
  statusCode: number | null;
};

/**
 * @brief Resolved startup-byte result with explicit lookup-order visibility
 */
export type StartupWindowResult = {
  entry: StartupWindowCacheEntry | null;
  lookupSteps: VfsCacheLookupStep[];
  resolvedLayer: VfsCacheLayer;
  fallbackReason: string | null;
  statusCode: number | null;
};

/**
 * @brief High-value startup warm request used by preview and committed playback
 */
export type StartupWarmRequest = {
  source: ReadableFileDescriptor;
  variantKey: string | null;
  useCase: StartupUseCase;
  cachePolicy: CachePolicy;
  allowServiceWorkerLookup: boolean;
  startupWindowByteLength: number;
  hotRangeByteLength: number;
};

/**
 * @brief High-value startup warm result surfaced back to media runtimes
 */
export type StartupWarmResult = {
  manifest: ManifestResult | null;
  initSegment: StartupWindowResult | null;
  startupWindow: StartupWindowResult | null;
  hotRange: StartupWindowResult | null;
  notes: string[];
};

/**
 * @brief Legacy manifest storage entry kept for compatibility
 */
export type ManifestStorageEntry = {
  key: CacheKey;
  source: ReadableFileDescriptor;
  tier: CacheTier;
  manifestText: string;
  contentType: string | null;
  storedAt: number;
};

/**
 * @brief Legacy range storage entry kept for compatibility
 */
export type RangeStorageEntry = {
  key: CacheKey;
  source: ReadableFileDescriptor;
  purpose: "init-segment" | "startup-window" | "hot-range";
  tier: CacheTier;
  range: ByteRange;
  bytes: Uint8Array;
  contentType: string | null;
  storedAt: number;
};
