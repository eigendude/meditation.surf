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
  PersistenceMetadata,
  VfsCacheLayer,
  VfsCacheLookupStep,
} from "../cache/CacheTypes";
import type { ReadableFileDescriptor } from "../sources/ReadableFileTypes";

/**
 * @brief Stable identity wrapper for one VFS-managed derived artifact
 */
export type DerivedArtifactKey = {
  cacheKey: CacheKey;
  identityKey: string;
  artifactKind: string;
  variantKey: string | null;
  sourceId: string;
};

/**
 * @brief Stable descriptor for one VFS-managed derived artifact
 */
export type DerivedArtifactDescriptor = {
  artifactKey: DerivedArtifactKey;
  source: ReadableFileDescriptor;
  artifactKind: string;
  variantKey: string | null;
};

/**
 * @brief Write request used to persist one derived artifact
 */
export type DerivedArtifactWrite = {
  descriptor: DerivedArtifactDescriptor;
  cachePolicy: CachePolicy;
  contentType: string;
  metadata: PersistenceMetadata;
  payload: Blob | string;
  payloadKind: "blob" | "text";
};

/**
 * @brief Resolved derived artifact entry ready for debug or rendering use
 */
export type DerivedArtifactEntry = {
  descriptor: DerivedArtifactDescriptor;
  tier: CacheTier;
  contentType: string;
  byteLength: number | null;
  createdAt: number;
  updatedAt: number;
  metadata: PersistenceMetadata;
  viewUrl: string | null;
};

/**
 * @brief Inspectable artifact lookup result returned by the VFS controller
 */
export type DerivedArtifactResult = {
  entry: DerivedArtifactEntry | null;
  lookupSteps: VfsCacheLookupStep[];
  resolvedLayer: VfsCacheLayer;
  fallbackReason: string | null;
};
