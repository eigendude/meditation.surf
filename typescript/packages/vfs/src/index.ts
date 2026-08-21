/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

export { DerivedArtifactStore } from "./artifacts/DerivedArtifactStore";
export type {
  DerivedArtifactDescriptor,
  DerivedArtifactEntry,
  DerivedArtifactKey,
  DerivedArtifactResult,
  DerivedArtifactWrite,
} from "./artifacts/DerivedArtifactTypes";
export type {
  CacheEntry,
  CacheKey,
  CachePolicy,
  CacheTier,
  PersistenceMetadata,
  PersistenceMetadataValue,
  VfsCacheLayer,
  VfsCacheLookupStep,
  VfsCacheOutcome,
} from "./cache/CacheTypes";
export { DEFAULT_CACHE_POLICY } from "./cache/CacheTypes";
export { HttpOriginAdapter } from "./http/HttpOriginAdapter";
export { IndexedDbPersistenceAdapter } from "./persistence/IndexedDbPersistenceAdapter";
export { MemoryPersistenceAdapter } from "./persistence/MemoryPersistenceAdapter";
export type {
  PersistenceAdapter,
  PersistenceBody,
  PersistenceRecord,
  PersistenceWriteRequest,
} from "./persistence/PersistenceTypes";
export type {
  ByteRange,
  RangeReadRequest,
  RangeReadResult,
} from "./ranges/RangeTypes";
export {
  ReadableFileDescriptorFactory,
  type OriginType,
  type ReadableFileDescriptor,
  type ReadableFileKind,
  type ReadableFilePlaybackSource,
} from "./sources/ReadableFileTypes";
export { VfsServiceWorkerCoordinator } from "./service-worker/VfsServiceWorkerCoordinator";
export type {
  VfsServiceWorkerEvent,
  VfsServiceWorkerSnapshot,
} from "./service-worker/VfsServiceWorkerCoordinator";
export type {
  ManifestCacheEntry,
  ManifestRequest,
  ManifestResult,
  ManifestStorageEntry,
  RangeStorageEntry,
  StartupArtifactKind,
  StartupUseCase,
  StartupWarmRequest,
  StartupWarmResult,
  StartupWindowCacheEntry,
  StartupWindowDescriptor,
  StartupWindowRequest,
  StartupWindowResult,
} from "./startup/StorageTypes";
export { StartupManifestParser } from "./startup/StartupManifestParser";
export type {
  TorrentOriginAdapter,
  TorrentPieceStore,
  TorrentSourceDescriptor,
} from "./torrent/TorrentTypes";
export { UnsupportedTorrentOriginAdapter } from "./torrent/TorrentTypes";
export { VfsController } from "./VfsController";
export type { VfsHandle } from "./VfsHandle";
export type { VfsNode } from "./VfsNode";
export { VfsPath } from "./VfsPath";
export type {
  VfsDebugSnapshot,
  VfsSnapshot,
  VfsSnapshotDebugEvent,
} from "./VfsSnapshot";
