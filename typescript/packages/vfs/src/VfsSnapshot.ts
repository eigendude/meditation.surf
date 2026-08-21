/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  CacheKey,
  VfsCacheLayer,
  VfsCacheOutcome,
} from "./cache/CacheTypes";
import type { VfsServiceWorkerSnapshot } from "./service-worker/VfsServiceWorkerCoordinator";
import type {
  StartupArtifactKind,
  StartupUseCase,
} from "./startup/StorageTypes";
import type { VfsNode } from "./VfsNode";

/**
 * @brief One inspectable VFS cache event surfaced in shared debug snapshots
 */
export type VfsSnapshotDebugEvent = {
  artifactKind: StartupArtifactKind | "derived-artifact";
  sourceId: string | null;
  cacheKey: CacheKey;
  layer: VfsCacheLayer;
  outcome: VfsCacheOutcome;
  requestUrl: string | null;
  useCase: StartupUseCase;
  detail: string | null;
  recordedAt: number;
};

/**
 * @brief Immutable VFS debug snapshot exposed for media and app inspection
 */
export type VfsDebugSnapshot = {
  events: VfsSnapshotDebugEvent[];
  memoryHotKeys: CacheKey[];
  serviceWorker: VfsServiceWorkerSnapshot;
  generatedAt: number;
};

/**
 * @brief Immutable VFS snapshot exposed for debug and inspection
 */
export type VfsSnapshot = {
  nodes: VfsNode[];
  debug: VfsDebugSnapshot;
  generatedAt: number;
};
