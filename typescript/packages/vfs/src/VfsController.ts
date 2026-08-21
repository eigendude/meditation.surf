/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { DerivedArtifactStore } from "./artifacts/DerivedArtifactStore";
import type {
  DerivedArtifactDescriptor,
  DerivedArtifactEntry,
  DerivedArtifactKey,
  DerivedArtifactResult,
  DerivedArtifactWrite,
} from "./artifacts/DerivedArtifactTypes";
import {
  type CacheEntry,
  type CacheKey,
  type CachePolicy,
  DEFAULT_CACHE_POLICY,
  type VfsCacheLayer,
  type VfsCacheLookupStep,
} from "./cache/CacheTypes";
import { HttpOriginAdapter } from "./http/HttpOriginAdapter";
import { IndexedDbPersistenceAdapter } from "./persistence/IndexedDbPersistenceAdapter";
import type {
  PersistenceAdapter,
  PersistenceRecord,
  PersistenceWriteRequest,
} from "./persistence/PersistenceTypes";
import type { ByteRange, RangeReadResult } from "./ranges/RangeTypes";
import { VfsServiceWorkerCoordinator } from "./service-worker/VfsServiceWorkerCoordinator";
import type { ReadableFileDescriptor } from "./sources/ReadableFileTypes";
import { ReadableFileDescriptorFactory } from "./sources/ReadableFileTypes";
import { StartupManifestParser } from "./startup/StartupManifestParser";
import type {
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
import type { VfsHandle } from "./VfsHandle";
import type { VfsNode } from "./VfsNode";
import { VfsPath } from "./VfsPath";
import type {
  VfsDebugSnapshot,
  VfsSnapshot,
  VfsSnapshotDebugEvent,
} from "./VfsSnapshot";

class ControllerVfsHandle implements VfsHandle {
  public readonly cacheKey: CacheKey;
  public readonly path: VfsPath;

  private readonly persistenceAdapter: PersistenceAdapter;

  /**
   * @brief Build one concrete VFS handle
   *
   * @param cacheKey - Stable cache key represented by the handle
   * @param persistenceAdapter - Persistence adapter used for lookup
   */
  public constructor(
    cacheKey: CacheKey,
    persistenceAdapter: PersistenceAdapter,
  ) {
    this.cacheKey = cacheKey;
    this.path = VfsPath.fromCacheKey(cacheKey);
    this.persistenceAdapter = persistenceAdapter;
  }

  /**
   * @inheritdoc
   */
  public async getEntry(): Promise<CacheEntry | null> {
    const record: PersistenceRecord | null = await this.persistenceAdapter.get(
      this.cacheKey,
    );

    if (record === null) {
      return null;
    }

    return {
      key: record.key,
      tier: record.tier,
      contentType: record.contentType,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAccessedAt: record.lastAccessedAt,
      byteLength: record.byteLength,
      metadata: {
        ...record.metadata,
      },
    };
  }
}

/**
 * @brief Generic controller that owns storage identity and persistence flows
 */
export class VfsController {
  private static readonly DEFAULT_HOT_RANGE_BYTE_LENGTH: number = 262144;
  private static readonly DEFAULT_INIT_SEGMENT_BYTE_LENGTH: number = 65536;
  private static readonly DEFAULT_STARTUP_WINDOW_BYTE_LENGTH: number = 131072;
  private static readonly MAX_DEBUG_EVENTS: number = 500;

  public readonly artifacts: DerivedArtifactStore;
  public readonly httpOrigins: HttpOriginAdapter;
  public readonly persistenceAdapter: PersistenceAdapter;
  public readonly serviceWorker: VfsServiceWorkerCoordinator;

  private readonly debugEvents: VfsSnapshotDebugEvent[];
  private readonly memoryRecordsByKey: Map<CacheKey, PersistenceRecord>;

  /**
   * @brief Build the VFS controller
   *
   * @param persistenceAdapter - Optional persistence adapter override
   * @param httpOrigins - Optional HTTP origin adapter override
   * @param serviceWorker - Optional service-worker coordinator override
   */
  public constructor(
    persistenceAdapter: PersistenceAdapter = new IndexedDbPersistenceAdapter(),
    httpOrigins: HttpOriginAdapter = new HttpOriginAdapter(),
    serviceWorker: VfsServiceWorkerCoordinator = new VfsServiceWorkerCoordinator(),
  ) {
    this.persistenceAdapter = persistenceAdapter;
    this.httpOrigins = httpOrigins;
    this.serviceWorker = serviceWorker;
    this.artifacts = new DerivedArtifactStore(this.persistenceAdapter);
    this.debugEvents = [];
    this.memoryRecordsByKey = new Map<CacheKey, PersistenceRecord>();
  }

  /**
   * @brief Create one readable-source descriptor from raw playback metadata
   *
   * @param sourceId - Stable logical source identifier
   * @param playbackSource - Raw playback metadata
   *
   * @returns Storage-facing source descriptor
   */
  public createReadableSourceDescriptor(
    sourceId: string,
    playbackSource: {
      url: string;
      mimeType: string | null;
      posterUrl: string | null;
    },
  ): ReadableFileDescriptor {
    return ReadableFileDescriptorFactory.create(sourceId, playbackSource);
  }

  /**
   * @brief Build a stable cache key for one manifest payload
   *
   * @param source - Source descriptor associated with the manifest
   * @param requestUrl - Optional concrete manifest URL
   *
   * @returns Stable manifest cache key
   */
  public createManifestCacheKey(
    source: ReadableFileDescriptor,
    requestUrl: string | null = null,
  ): CacheKey {
    return this.composeCacheKey(
      "manifest",
      source.sourceId,
      requestUrl ?? source.url,
    );
  }

  /**
   * @brief Build a stable cache key for one init segment payload
   *
   * @param source - Source descriptor associated with the bytes
   * @param variantKey - Optional variant hint
   * @param requestUrl - Optional concrete request URL
   * @param range - Optional explicit range identity
   *
   * @returns Stable init-segment cache key
   */
  public createInitSegmentCacheKey(
    source: ReadableFileDescriptor,
    variantKey: string | null = null,
    requestUrl: string | null = null,
    range: ByteRange | null = null,
  ): CacheKey {
    return this.composeCacheKey(
      "init-segment",
      source.sourceId,
      variantKey ?? "default",
      requestUrl ?? source.url,
      range === null ? "default" : this.serializeRange(range),
    );
  }

  /**
   * @brief Build a stable cache key for one startup-window byte range
   *
   * @param source - Source descriptor associated with the bytes
   * @param range - Startup range being cached
   * @param variantKey - Optional variant hint
   * @param requestUrl - Optional concrete request URL
   *
   * @returns Stable startup-window cache key
   */
  public createStartupWindowCacheKey(
    source: ReadableFileDescriptor,
    range: ByteRange,
    variantKey: string | null = null,
    requestUrl: string | null = null,
  ): CacheKey {
    return this.composeCacheKey(
      "startup-window",
      source.sourceId,
      variantKey ?? "default",
      requestUrl ?? source.url,
      this.serializeRange(range),
    );
  }

  /**
   * @brief Build a stable cache key for one hot-range entry
   *
   * @param source - Source descriptor associated with the bytes
   * @param range - Hot byte range being cached
   * @param requestUrl - Optional concrete request URL
   *
   * @returns Stable hot-range cache key
   */
  public createHotRangeCacheKey(
    source: ReadableFileDescriptor,
    range: ByteRange,
    requestUrl: string | null = null,
  ): CacheKey {
    return this.composeCacheKey(
      "hot-range",
      source.sourceId,
      requestUrl ?? source.url,
      this.serializeRange(range),
    );
  }

  /**
   * @brief Build a stable cache key for one derived artifact payload
   *
   * @param source - Source descriptor that owns the artifact
   * @param artifactKind - Generic artifact family label
   * @param variantKey - Optional artifact variant hint
   *
   * @returns Stable derived-artifact cache key
   */
  public createDerivedArtifactCacheKey(
    source: ReadableFileDescriptor,
    artifactKind: string,
    variantKey: string | null = null,
  ): CacheKey {
    return this.composeCacheKey(
      "derived-artifact",
      source.sourceId,
      artifactKind,
      variantKey ?? "default",
    );
  }

  /**
   * @brief Create one generic derived-artifact descriptor
   *
   * @param source - Source that owns the artifact
   * @param artifactKind - Generic artifact family label
   * @param variantKey - Optional artifact variant hint
   *
   * @returns Derived artifact descriptor
   */
  public createDerivedArtifactDescriptor(
    source: ReadableFileDescriptor,
    artifactKind: string,
    variantKey: string | null = null,
  ): DerivedArtifactDescriptor {
    const cacheKey: CacheKey = this.createDerivedArtifactCacheKey(
      source,
      artifactKind,
      variantKey,
    );

    return {
      artifactKey: {
        cacheKey,
        identityKey: this.composeCacheKey(
          source.sourceId,
          artifactKind,
          variantKey ?? "default",
        ),
        artifactKind,
        variantKey,
        sourceId: source.sourceId,
      },
      source,
      artifactKind,
      variantKey,
    };
  }

  /**
   * @brief Persist one derived artifact and return the resolved stored entry
   *
   * @param write - Artifact payload being written
   *
   * @returns Stored artifact entry
   */
  public async storeDerivedArtifact(
    write: DerivedArtifactWrite,
  ): Promise<DerivedArtifactEntry> {
    return await this.artifacts.putArtifact(write);
  }

  /**
   * @brief Resolve one stored derived artifact by cache key
   *
   * @param artifactKey - Stable artifact key being resolved
   *
   * @returns Stored artifact entry, or `null` when absent
   */
  public async getDerivedArtifact(
    artifactKey: CacheKey | DerivedArtifactKey,
  ): Promise<DerivedArtifactEntry | null> {
    const derivedArtifactResult: DerivedArtifactResult =
      await this.resolveDerivedArtifact(artifactKey);

    return derivedArtifactResult.entry;
  }

  /**
   * @brief Resolve one stored derived artifact with explicit lookup visibility
   *
   * @param artifactKey - Stable artifact key being resolved
   * @param fallbackReason - Optional fallback note supplied by the caller
   *
   * @returns Stored artifact result with lookup steps
   */
  public async resolveDerivedArtifact(
    artifactKey: CacheKey | DerivedArtifactKey,
    fallbackReason: string | null = null,
  ): Promise<DerivedArtifactResult> {
    const derivedArtifactResult: DerivedArtifactResult =
      await this.artifacts.resolveArtifact(artifactKey, fallbackReason);

    this.recordLookupSteps(
      "derived-artifact",
      typeof artifactKey === "string" ? null : artifactKey.sourceId,
      derivedArtifactResult.lookupSteps,
      "generic",
    );

    return derivedArtifactResult;
  }

  /**
   * @brief List derived artifacts whose cache keys share one stable prefix
   *
   * @param cacheKeyPrefix - Stable cache-key prefix used to filter artifacts
   *
   * @returns Matching derived artifact entries
   */
  public async listDerivedArtifactsByCacheKeyPrefix(
    cacheKeyPrefix: string,
  ): Promise<DerivedArtifactEntry[]> {
    return await this.artifacts.listArtifactsByCacheKeyPrefix(cacheKeyPrefix);
  }

  /**
   * @brief Release a leased artifact URL without deleting stored bytes
   *
   * @param artifactKey - Stable artifact key whose render URL should be released
   */
  public releaseDerivedArtifact(
    artifactKey: CacheKey | DerivedArtifactKey,
  ): void {
    this.artifacts.releaseArtifact(artifactKey);
  }

  /**
   * @brief Delete one stored artifact and release any render URL lease
   *
   * @param artifactKey - Stable artifact key being deleted
   */
  public async deleteDerivedArtifact(
    artifactKey: CacheKey | DerivedArtifactKey,
  ): Promise<void> {
    await this.artifacts.deleteArtifact(artifactKey);
  }

  /**
   * @brief Persist one manifest payload in VFS-owned storage
   *
   * @param source - Source descriptor associated with the manifest
   * @param manifestText - Manifest text payload
   * @param contentType - Optional manifest MIME type
   * @param requestUrl - Optional concrete manifest URL
   * @param cachePolicy - Optional cache policy
   *
   * @returns Stored manifest entry
   */
  public async storeManifest(
    source: ReadableFileDescriptor,
    manifestText: string,
    contentType: string | null,
    requestUrl: string | null = null,
    cachePolicy: CachePolicy = this.getDefaultCachePolicy(),
  ): Promise<ManifestStorageEntry> {
    const manifestCacheEntry: ManifestCacheEntry =
      await this.storeManifestEntry(
        source,
        manifestText,
        contentType,
        requestUrl,
        cachePolicy,
      );

    return {
      key: manifestCacheEntry.key,
      source: manifestCacheEntry.source,
      tier: manifestCacheEntry.tier,
      manifestText: manifestCacheEntry.manifestText,
      contentType: manifestCacheEntry.contentType,
      storedAt: manifestCacheEntry.storedAt,
    };
  }

  /**
   * @brief Read one previously stored manifest entry
   *
   * @param source - Source descriptor associated with the manifest
   * @param requestUrl - Optional concrete manifest URL
   *
   * @returns Stored manifest entry, or `null` when absent
   */
  public async getManifest(
    source: ReadableFileDescriptor,
    requestUrl: string | null = null,
  ): Promise<ManifestStorageEntry | null> {
    const manifestResult: ManifestResult = await this.resolveManifest({
      source,
      requestUrl,
      cachePolicy: {
        ...this.getDefaultCachePolicy(),
        allowOriginFetch: false,
      },
      expectedContentType: source.mimeType,
      useCase: "generic",
      allowServiceWorkerLookup: true,
      fallbackReason: null,
    });

    if (manifestResult.entry === null) {
      return null;
    }

    return {
      key: manifestResult.entry.key,
      source: manifestResult.entry.source,
      tier: manifestResult.entry.tier,
      manifestText: manifestResult.entry.manifestText,
      contentType: manifestResult.entry.contentType,
      storedAt: manifestResult.entry.storedAt,
    };
  }

  /**
   * @brief Resolve one manifest using the ordered VFS lookup flow
   *
   * @param request - Manifest request being resolved
   *
   * @returns Manifest lookup result with inspectable lookup steps
   */
  public async resolveManifest(
    request: ManifestRequest,
  ): Promise<ManifestResult> {
    const requestUrl: string = request.requestUrl ?? request.source.url;
    const cacheKey: CacheKey = this.createManifestCacheKey(
      request.source,
      requestUrl,
    );
    const lookupSteps: VfsCacheLookupStep[] = [];
    const memoryRecord: PersistenceRecord | null =
      this.getMemoryRecord(cacheKey);

    if (memoryRecord !== null && typeof memoryRecord.body === "string") {
      lookupSteps.push(
        this.createLookupStep(
          cacheKey,
          "memory-hot",
          "hit",
          requestUrl,
          "Manifest lookup reused the VFS memory-hot cache.",
        ),
      );

      const manifestCacheEntry: ManifestCacheEntry =
        this.createManifestCacheEntry(request.source, requestUrl, memoryRecord);

      this.recordLookupSteps(
        "manifest",
        request.source.sourceId,
        lookupSteps,
        request.useCase,
      );

      return {
        entry: manifestCacheEntry,
        lookupSteps,
        resolvedLayer: "memory-hot",
        fallbackReason: request.fallbackReason,
        statusCode: null,
      };
    }

    lookupSteps.push(
      this.createLookupStep(
        cacheKey,
        "memory-hot",
        "miss",
        requestUrl,
        "Manifest lookup missed the VFS memory-hot cache.",
      ),
    );

    const persistentRecord: PersistenceRecord | null =
      await this.persistenceAdapter.get(cacheKey);

    if (
      persistentRecord !== null &&
      typeof persistentRecord.body === "string"
    ) {
      this.rememberMemoryRecord(persistentRecord);
      lookupSteps.push(
        this.createLookupStep(
          cacheKey,
          "disk-persistent",
          "hit",
          requestUrl,
          "Manifest lookup reused persistent VFS storage.",
        ),
      );

      const manifestCacheEntry: ManifestCacheEntry =
        this.createManifestCacheEntry(
          request.source,
          requestUrl,
          persistentRecord,
        );

      this.recordLookupSteps(
        "manifest",
        request.source.sourceId,
        lookupSteps,
        request.useCase,
      );

      return {
        entry: manifestCacheEntry,
        lookupSteps,
        resolvedLayer: "disk-persistent",
        fallbackReason: request.fallbackReason,
        statusCode: null,
      };
    }

    lookupSteps.push(
      this.createLookupStep(
        cacheKey,
        "disk-persistent",
        "miss",
        requestUrl,
        "Manifest lookup missed persistent VFS storage.",
      ),
    );

    if (request.allowServiceWorkerLookup) {
      const serviceWorkerRecord: PersistenceRecord | null =
        await this.serviceWorker.getRecord(cacheKey, requestUrl);

      if (
        serviceWorkerRecord !== null &&
        typeof serviceWorkerRecord.body === "string"
      ) {
        this.rememberMemoryRecord(serviceWorkerRecord);
        lookupSteps.push(
          this.createLookupStep(
            cacheKey,
            "service-worker",
            "hit",
            requestUrl,
            "Manifest lookup reused service-worker CacheStorage.",
          ),
        );

        const manifestCacheEntry: ManifestCacheEntry =
          this.createManifestCacheEntry(
            request.source,
            requestUrl,
            serviceWorkerRecord,
          );

        this.recordLookupSteps(
          "manifest",
          request.source.sourceId,
          lookupSteps,
          request.useCase,
        );

        return {
          entry: manifestCacheEntry,
          lookupSteps,
          resolvedLayer: "service-worker",
          fallbackReason: request.fallbackReason,
          statusCode: null,
        };
      }

      lookupSteps.push(
        this.createLookupStep(
          cacheKey,
          "service-worker",
          "miss",
          requestUrl,
          "Manifest lookup missed service-worker CacheStorage.",
        ),
      );
    } else {
      lookupSteps.push(
        this.createLookupStep(
          cacheKey,
          "service-worker",
          "bypass",
          requestUrl,
          "Manifest lookup skipped the service-worker layer for this request.",
        ),
      );
    }

    if (!request.cachePolicy.allowOriginFetch) {
      lookupSteps.push(
        this.createLookupStep(
          cacheKey,
          "network-origin",
          "bypass",
          requestUrl,
          "Manifest lookup was not allowed to fall back to origin fetches.",
        ),
      );

      this.recordLookupSteps(
        "manifest",
        request.source.sourceId,
        lookupSteps,
        request.useCase,
      );

      return {
        entry: null,
        lookupSteps,
        resolvedLayer: "none",
        fallbackReason:
          request.fallbackReason ??
          "VFS could not satisfy the manifest lookup without a network fallback.",
        statusCode: null,
      };
    }

    const manifestReadResult: Awaited<
      ReturnType<HttpOriginAdapter["readText"]>
    > = await this.httpOrigins.readText(requestUrl);
    lookupSteps.push(
      this.createLookupStep(
        cacheKey,
        "network-origin",
        "hit",
        requestUrl,
        "Manifest lookup fell back to the network origin.",
      ),
    );

    const storedManifestEntry: ManifestCacheEntry =
      await this.storeManifestEntry(
        request.source,
        manifestReadResult.text,
        manifestReadResult.contentType ?? request.expectedContentType,
        requestUrl,
        request.cachePolicy,
        request.allowServiceWorkerLookup,
      );

    lookupSteps.push(
      this.createLookupStep(
        cacheKey,
        "network-origin",
        "write-through",
        requestUrl,
        "Manifest bytes were written through into VFS storage after the origin fetch.",
      ),
    );
    this.recordLookupSteps(
      "manifest",
      request.source.sourceId,
      lookupSteps,
      request.useCase,
    );

    return {
      entry: storedManifestEntry,
      lookupSteps,
      resolvedLayer: "network-origin",
      fallbackReason: request.fallbackReason,
      statusCode: manifestReadResult.statusCode,
    };
  }

  /**
   * @brief Persist one init segment, startup window, or hot-range payload
   *
   * @param source - Source descriptor associated with the bytes
   * @param purpose - Explicit range-storage purpose
   * @param range - Stored byte range
   * @param bytes - Byte payload being cached
   * @param contentType - Optional MIME type associated with the bytes
   * @param variantKey - Optional variant hint for init or startup caches
   * @param requestUrl - Optional concrete request URL
   * @param cachePolicy - Optional cache policy
   *
   * @returns Stored range entry
   */
  public async storeRangeEntry(
    source: ReadableFileDescriptor,
    purpose: RangeStorageEntry["purpose"],
    range: ByteRange,
    bytes: Uint8Array,
    contentType: string | null,
    variantKey: string | null = null,
    requestUrl: string | null = null,
    cachePolicy: CachePolicy = this.getDefaultCachePolicy(),
  ): Promise<RangeStorageEntry> {
    const startupWindowCacheEntry: StartupWindowCacheEntry =
      await this.storeStartupWindowEntry(
        source,
        purpose,
        range,
        bytes,
        contentType,
        variantKey,
        requestUrl,
        cachePolicy,
      );

    return {
      key: startupWindowCacheEntry.descriptor.cacheKey,
      source: startupWindowCacheEntry.descriptor.source,
      purpose: startupWindowCacheEntry.descriptor.purpose,
      tier: startupWindowCacheEntry.tier,
      range: startupWindowCacheEntry.descriptor.range,
      bytes: startupWindowCacheEntry.bytes,
      contentType: startupWindowCacheEntry.contentType,
      storedAt: startupWindowCacheEntry.storedAt,
    };
  }

  /**
   * @brief Read one stored init segment, startup window, or hot-range entry
   *
   * @param source - Source descriptor associated with the bytes
   * @param purpose - Explicit range-storage purpose
   * @param range - Byte range being resolved
   * @param variantKey - Optional variant hint for init or startup caches
   * @param requestUrl - Optional concrete request URL
   *
   * @returns Stored range entry, or `null` when absent
   */
  public async getRangeEntry(
    source: ReadableFileDescriptor,
    purpose: RangeStorageEntry["purpose"],
    range: ByteRange,
    variantKey: string | null = null,
    requestUrl: string | null = null,
  ): Promise<RangeStorageEntry | null> {
    const startupWindowResult: StartupWindowResult =
      await this.resolveStartupWindow({
        source,
        purpose,
        requestUrl,
        range,
        variantKey,
        cachePolicy: {
          ...this.getDefaultCachePolicy(),
          allowOriginFetch: false,
        },
        expectedContentType: source.mimeType,
        useCase: "generic",
        allowServiceWorkerLookup: true,
        fallbackReason: null,
      });

    if (startupWindowResult.entry === null) {
      return null;
    }

    return {
      key: startupWindowResult.entry.descriptor.cacheKey,
      source: startupWindowResult.entry.descriptor.source,
      purpose: startupWindowResult.entry.descriptor.purpose,
      tier: startupWindowResult.entry.tier,
      range: startupWindowResult.entry.descriptor.range,
      bytes: startupWindowResult.entry.bytes,
      contentType: startupWindowResult.entry.contentType,
      storedAt: startupWindowResult.entry.storedAt,
    };
  }

  /**
   * @brief Resolve one startup byte window using the ordered VFS lookup flow
   *
   * @param request - Startup-window request being resolved
   *
   * @returns Startup-window result with inspectable lookup steps
   */
  public async resolveStartupWindow(
    request: StartupWindowRequest,
  ): Promise<StartupWindowResult> {
    const descriptor: StartupWindowDescriptor =
      this.createStartupWindowDescriptor(request);
    const lookupSteps: VfsCacheLookupStep[] = [];
    const memoryRecord: PersistenceRecord | null = this.getMemoryRecord(
      descriptor.cacheKey,
    );

    if (memoryRecord !== null) {
      const cachedStartupWindowEntry: StartupWindowCacheEntry | null =
        await this.createStartupWindowCacheEntry(descriptor, memoryRecord);

      if (cachedStartupWindowEntry !== null) {
        lookupSteps.push(
          this.createLookupStep(
            descriptor.cacheKey,
            "memory-hot",
            "hit",
            descriptor.requestUrl,
            `${descriptor.purpose} lookup reused the VFS memory-hot cache.`,
          ),
        );
        this.recordLookupSteps(
          descriptor.purpose,
          request.source.sourceId,
          lookupSteps,
          request.useCase,
        );

        return {
          entry: cachedStartupWindowEntry,
          lookupSteps,
          resolvedLayer: "memory-hot",
          fallbackReason: request.fallbackReason,
          statusCode: null,
        };
      }
    }

    lookupSteps.push(
      this.createLookupStep(
        descriptor.cacheKey,
        "memory-hot",
        "miss",
        descriptor.requestUrl,
        `${descriptor.purpose} lookup missed the VFS memory-hot cache.`,
      ),
    );

    const reusedHotRangeEntry: StartupWindowCacheEntry | null =
      await this.tryReuseHotRange(request, descriptor, lookupSteps);

    if (reusedHotRangeEntry !== null) {
      this.recordLookupSteps(
        descriptor.purpose,
        request.source.sourceId,
        lookupSteps,
        request.useCase,
      );

      return {
        entry: reusedHotRangeEntry,
        lookupSteps,
        resolvedLayer:
          lookupSteps[lookupSteps.length - 1]?.layer ?? "memory-hot",
        fallbackReason: request.fallbackReason,
        statusCode: null,
      };
    }

    const persistentRecord: PersistenceRecord | null =
      await this.persistenceAdapter.get(descriptor.cacheKey);

    if (persistentRecord !== null) {
      this.rememberMemoryRecord(persistentRecord);
      const persistentStartupWindowEntry: StartupWindowCacheEntry | null =
        await this.createStartupWindowCacheEntry(descriptor, persistentRecord);

      if (persistentStartupWindowEntry !== null) {
        lookupSteps.push(
          this.createLookupStep(
            descriptor.cacheKey,
            "disk-persistent",
            "hit",
            descriptor.requestUrl,
            `${descriptor.purpose} lookup reused persistent VFS storage.`,
          ),
        );
        this.recordLookupSteps(
          descriptor.purpose,
          request.source.sourceId,
          lookupSteps,
          request.useCase,
        );

        return {
          entry: persistentStartupWindowEntry,
          lookupSteps,
          resolvedLayer: "disk-persistent",
          fallbackReason: request.fallbackReason,
          statusCode: null,
        };
      }
    }

    lookupSteps.push(
      this.createLookupStep(
        descriptor.cacheKey,
        "disk-persistent",
        "miss",
        descriptor.requestUrl,
        `${descriptor.purpose} lookup missed persistent VFS storage.`,
      ),
    );

    if (request.allowServiceWorkerLookup) {
      const serviceWorkerRecord: PersistenceRecord | null =
        await this.serviceWorker.getRecord(
          descriptor.cacheKey,
          descriptor.requestUrl,
        );

      if (serviceWorkerRecord !== null) {
        this.rememberMemoryRecord(serviceWorkerRecord);
        const serviceWorkerEntry: StartupWindowCacheEntry | null =
          await this.createStartupWindowCacheEntry(
            descriptor,
            serviceWorkerRecord,
          );

        if (serviceWorkerEntry !== null) {
          lookupSteps.push(
            this.createLookupStep(
              descriptor.cacheKey,
              "service-worker",
              "hit",
              descriptor.requestUrl,
              `${descriptor.purpose} lookup reused service-worker CacheStorage.`,
            ),
          );
          this.recordLookupSteps(
            descriptor.purpose,
            request.source.sourceId,
            lookupSteps,
            request.useCase,
          );

          return {
            entry: serviceWorkerEntry,
            lookupSteps,
            resolvedLayer: "service-worker",
            fallbackReason: request.fallbackReason,
            statusCode: null,
          };
        }
      }

      lookupSteps.push(
        this.createLookupStep(
          descriptor.cacheKey,
          "service-worker",
          "miss",
          descriptor.requestUrl,
          `${descriptor.purpose} lookup missed service-worker CacheStorage.`,
        ),
      );
    } else {
      lookupSteps.push(
        this.createLookupStep(
          descriptor.cacheKey,
          "service-worker",
          "bypass",
          descriptor.requestUrl,
          `${descriptor.purpose} lookup skipped the service-worker layer for this request.`,
        ),
      );
    }

    if (!request.cachePolicy.allowOriginFetch) {
      lookupSteps.push(
        this.createLookupStep(
          descriptor.cacheKey,
          "network-origin",
          "bypass",
          descriptor.requestUrl,
          `${descriptor.purpose} lookup was not allowed to fall back to the network.`,
        ),
      );
      this.recordLookupSteps(
        descriptor.purpose,
        request.source.sourceId,
        lookupSteps,
        request.useCase,
      );

      return {
        entry: null,
        lookupSteps,
        resolvedLayer: "none",
        fallbackReason:
          request.fallbackReason ??
          "VFS could not satisfy the startup-byte request without an origin fallback.",
        statusCode: null,
      };
    }

    const originReadResult: RangeReadResult = await this.httpOrigins.readRange({
      source: {
        ...request.source,
        url: descriptor.requestUrl,
      },
      purpose: request.purpose,
      range: request.range,
      cachePolicy: request.cachePolicy,
      expectedContentType: request.expectedContentType,
    });
    lookupSteps.push(
      this.createLookupStep(
        descriptor.cacheKey,
        "network-origin",
        "hit",
        descriptor.requestUrl,
        `${descriptor.purpose} lookup fell back to the network origin.`,
      ),
    );

    const storedOriginEntry: StartupWindowCacheEntry =
      await this.storeStartupWindowEntry(
        request.source,
        request.purpose,
        request.range,
        originReadResult.bytes,
        originReadResult.contentType ?? request.expectedContentType,
        request.variantKey,
        descriptor.requestUrl,
        request.cachePolicy,
        request.allowServiceWorkerLookup,
      );

    lookupSteps.push(
      this.createLookupStep(
        descriptor.cacheKey,
        "network-origin",
        "write-through",
        descriptor.requestUrl,
        `${descriptor.purpose} bytes were written through into VFS storage after the origin fetch.`,
      ),
    );
    this.recordLookupSteps(
      descriptor.purpose,
      request.source.sourceId,
      lookupSteps,
      request.useCase,
    );

    return {
      entry: storedOriginEntry,
      lookupSteps,
      resolvedLayer: "network-origin",
      fallbackReason: request.fallbackReason,
      statusCode: originReadResult.statusCode,
    };
  }

  /**
   * @brief Warm the highest-value startup artifacts for one source
   *
   * @param request - Startup warm request emitted by preview or playback code
   *
   * @returns Warm result that exposes what VFS could reuse or fetch
   */
  public async warmStartupArtifacts(
    request: StartupWarmRequest,
  ): Promise<StartupWarmResult> {
    if (request.source.kind === "torrent") {
      return {
        manifest: null,
        initSegment: null,
        startupWindow: null,
        hotRange: null,
        notes: [
          "Torrent startup warming remains intentionally stubbed in this phase.",
        ],
      };
    }

    if (request.source.originType !== "http") {
      return {
        manifest: null,
        initSegment: null,
        startupWindow: null,
        hotRange: null,
        notes: [
          "VFS startup warming currently focuses on HTTP-backed sources.",
        ],
      };
    }

    if (request.source.kind === "hls") {
      return await this.warmHlsStartupArtifacts(request);
    }

    return await this.warmProgressiveStartupArtifacts(request);
  }

  /**
   * @brief Build one inspectable VFS handle for a stable cache key
   *
   * @param cacheKey - Stable cache key being exposed
   *
   * @returns Inspectable handle
   */
  public getHandle(cacheKey: CacheKey): VfsHandle {
    return new ControllerVfsHandle(cacheKey, this.persistenceAdapter);
  }

  /**
   * @brief Return the current inspectable VFS snapshot
   *
   * @returns Snapshot of persisted VFS nodes together with debug state
   */
  public async getSnapshot(): Promise<VfsSnapshot> {
    const records: PersistenceRecord[] = await this.persistenceAdapter.list();
    const nodes: VfsNode[] = records.map(
      (record: PersistenceRecord): VfsNode => ({
        key: record.key,
        nodeType: this.resolveNodeType(record.key),
        tier: record.tier,
        path: VfsPath.fromCacheKey(record.key),
        byteLength: record.byteLength,
        updatedAt: record.updatedAt,
      }),
    );

    return {
      nodes,
      debug: this.getDebugSnapshot(),
      generatedAt: Date.now(),
    };
  }

  /**
   * @brief Return the current inspectable VFS debug snapshot
   *
   * @returns Lookup and service-worker debug state
   */
  public getDebugSnapshot(): VfsDebugSnapshot {
    return {
      events: this.debugEvents.map(
        (debugEvent: VfsSnapshotDebugEvent): VfsSnapshotDebugEvent => ({
          ...debugEvent,
        }),
      ),
      memoryHotKeys: [...this.memoryRecordsByKey.keys()].sort(),
      serviceWorker: this.serviceWorker.getSnapshot(),
      generatedAt: Date.now(),
    };
  }

  /**
   * @brief Release every leased artifact URL owned by the controller
   */
  public destroy(): void {
    this.artifacts.releaseAllArtifacts();
    this.memoryRecordsByKey.clear();
  }

  /**
   * @brief Expose the shared default cache policy without duplicating literals
   *
   * @returns Conservative default cache policy
   */
  public getDefaultCachePolicy(): CachePolicy {
    return {
      ...DEFAULT_CACHE_POLICY,
    };
  }

  /**
   * @brief Warm HLS manifests and startup bytes for preview and playback startup
   *
   * @param request - Startup warm request being serviced
   *
   * @returns Warm result for the HLS source
   */
  private async warmHlsStartupArtifacts(
    request: StartupWarmRequest,
  ): Promise<StartupWarmResult> {
    const notes: string[] = [];
    const primaryManifestResult: ManifestResult = await this.resolveManifest({
      source: request.source,
      requestUrl: request.source.url,
      cachePolicy: request.cachePolicy,
      expectedContentType: request.source.mimeType,
      useCase: request.useCase,
      allowServiceWorkerLookup: request.allowServiceWorkerLookup,
      fallbackReason: null,
    });
    const primaryManifestText: string | null =
      primaryManifestResult.entry?.manifestText ?? null;

    if (primaryManifestText === null) {
      notes.push("VFS could not resolve the root HLS manifest.");

      return {
        manifest: primaryManifestResult,
        initSegment: null,
        startupWindow: null,
        hotRange: null,
        notes,
      };
    }

    const mediaManifestUrl: string =
      StartupManifestParser.resolveMediaPlaylistUrl(
        request.source.url,
        primaryManifestText,
      );
    let resolvedManifestResult: ManifestResult = primaryManifestResult;
    let resolvedManifestText: string = primaryManifestText;

    if (mediaManifestUrl !== request.source.url) {
      notes.push(
        "VFS resolved and cached the first concrete HLS media playlist.",
      );
      resolvedManifestResult = await this.resolveManifest({
        source: request.source,
        requestUrl: mediaManifestUrl,
        cachePolicy: request.cachePolicy,
        expectedContentType: request.source.mimeType,
        useCase: request.useCase,
        allowServiceWorkerLookup: request.allowServiceWorkerLookup,
        fallbackReason: null,
      });
      resolvedManifestText =
        resolvedManifestResult.entry?.manifestText ?? primaryManifestText;
    }

    const initSegmentReference =
      StartupManifestParser.resolveInitSegmentReference(
        mediaManifestUrl,
        resolvedManifestText,
      );
    const firstSegmentUrl: string | null =
      StartupManifestParser.resolveFirstSegmentUrl(
        mediaManifestUrl,
        resolvedManifestText,
      );
    let hotRangeResult: StartupWindowResult | null = null;
    let startupWindowResult: StartupWindowResult | null = null;
    let initSegmentResult: StartupWindowResult | null = null;

    if (initSegmentReference !== null) {
      initSegmentResult = await this.resolveStartupWindow({
        source: request.source,
        purpose: "init-segment",
        requestUrl: initSegmentReference.url,
        range: initSegmentReference.range ?? {
          startOffset: 0,
          endOffsetExclusive: VfsController.DEFAULT_INIT_SEGMENT_BYTE_LENGTH,
        },
        variantKey: request.variantKey,
        cachePolicy: request.cachePolicy,
        expectedContentType: null,
        useCase: request.useCase,
        allowServiceWorkerLookup: request.allowServiceWorkerLookup,
        fallbackReason: null,
      });
      notes.push("VFS cached the first explicit HLS init segment reference.");
    } else {
      notes.push(
        "The HLS playlist exposed no explicit init segment in this phase.",
      );
    }

    if (firstSegmentUrl !== null) {
      hotRangeResult = await this.resolveStartupWindow({
        source: request.source,
        purpose: "hot-range",
        requestUrl: firstSegmentUrl,
        range: {
          startOffset: 0,
          endOffsetExclusive: request.hotRangeByteLength,
        },
        variantKey: null,
        cachePolicy: request.cachePolicy,
        expectedContentType: null,
        useCase: request.useCase,
        allowServiceWorkerLookup: request.allowServiceWorkerLookup,
        fallbackReason: null,
      });
      startupWindowResult = await this.resolveStartupWindow({
        source: request.source,
        purpose: "startup-window",
        requestUrl: firstSegmentUrl,
        range: {
          startOffset: 0,
          endOffsetExclusive: request.startupWindowByteLength,
        },
        variantKey: request.variantKey,
        cachePolicy: request.cachePolicy,
        expectedContentType: null,
        useCase: request.useCase,
        allowServiceWorkerLookup: request.allowServiceWorkerLookup,
        fallbackReason: null,
      });
      notes.push("VFS warmed the first HLS segment startup bytes.");
    } else {
      notes.push(
        "The HLS playlist exposed no first segment URL in this phase.",
      );
    }

    return {
      manifest: resolvedManifestResult,
      initSegment: initSegmentResult,
      startupWindow: startupWindowResult,
      hotRange: hotRangeResult,
      notes,
    };
  }

  /**
   * @brief Warm progressive startup bytes for preview and playback startup
   *
   * @param request - Startup warm request being serviced
   *
   * @returns Warm result for the progressive source
   */
  private async warmProgressiveStartupArtifacts(
    request: StartupWarmRequest,
  ): Promise<StartupWarmResult> {
    const notes: string[] = [
      "VFS treated this source as a progressive byte stream for startup warming.",
    ];
    const hotRangeResult: StartupWindowResult = await this.resolveStartupWindow(
      {
        source: request.source,
        purpose: "hot-range",
        requestUrl: request.source.url,
        range: {
          startOffset: 0,
          endOffsetExclusive: request.hotRangeByteLength,
        },
        variantKey: null,
        cachePolicy: request.cachePolicy,
        expectedContentType: request.source.mimeType,
        useCase: request.useCase,
        allowServiceWorkerLookup: request.allowServiceWorkerLookup,
        fallbackReason: null,
      },
    );
    const initSegmentResult: StartupWindowResult =
      await this.resolveStartupWindow({
        source: request.source,
        purpose: "init-segment",
        requestUrl: request.source.url,
        range: {
          startOffset: 0,
          endOffsetExclusive: Math.min(
            request.startupWindowByteLength,
            VfsController.DEFAULT_INIT_SEGMENT_BYTE_LENGTH,
          ),
        },
        variantKey: request.variantKey,
        cachePolicy: request.cachePolicy,
        expectedContentType: request.source.mimeType,
        useCase: request.useCase,
        allowServiceWorkerLookup: request.allowServiceWorkerLookup,
        fallbackReason: null,
      });
    const startupWindowResult: StartupWindowResult =
      await this.resolveStartupWindow({
        source: request.source,
        purpose: "startup-window",
        requestUrl: request.source.url,
        range: {
          startOffset: 0,
          endOffsetExclusive: request.startupWindowByteLength,
        },
        variantKey: request.variantKey,
        cachePolicy: request.cachePolicy,
        expectedContentType: request.source.mimeType,
        useCase: request.useCase,
        allowServiceWorkerLookup: request.allowServiceWorkerLookup,
        fallbackReason: null,
      });

    return {
      manifest: null,
      initSegment: initSegmentResult,
      startupWindow: startupWindowResult,
      hotRange: hotRangeResult,
      notes,
    };
  }

  /**
   * @brief Persist one manifest payload through the VFS write-through flow
   *
   * @param source - Source descriptor that owns the manifest
   * @param manifestText - Manifest text payload
   * @param contentType - Optional content type
   * @param requestUrl - Optional concrete manifest URL
   * @param cachePolicy - Cache policy that controls write-through behavior
   * @param writeToServiceWorker - Optional service-worker write-through hint
   *
   * @returns Stored manifest entry
   */
  private async storeManifestEntry(
    source: ReadableFileDescriptor,
    manifestText: string,
    contentType: string | null,
    requestUrl: string | null,
    cachePolicy: CachePolicy,
    writeToServiceWorker: boolean = true,
  ): Promise<ManifestCacheEntry> {
    const resolvedRequestUrl: string = requestUrl ?? source.url;
    const nowMs: number = Date.now();
    const cacheKey: CacheKey = this.createManifestCacheKey(
      source,
      resolvedRequestUrl,
    );
    const persistenceRecord: PersistenceWriteRequest = {
      key: cacheKey,
      tier: cachePolicy.allowPersistent ? "persistent" : "memory",
      contentType,
      metadata: {
        entryKind: "manifest",
        identityKey: this.composeCacheKey(
          "manifest",
          source.sourceId,
          resolvedRequestUrl,
        ),
        requestUrl: resolvedRequestUrl,
        sourceId: source.sourceId,
        sourceUrl: source.url,
      },
      body: manifestText,
      bodyKind: "text",
      createdAt: nowMs,
      updatedAt: nowMs,
      lastAccessedAt: nowMs,
      byteLength: new Blob([manifestText]).size,
    };
    const storedRecord: PersistenceRecord = await this.storeRecord(
      persistenceRecord,
      cachePolicy,
      writeToServiceWorker,
      resolvedRequestUrl,
    );

    return this.createManifestCacheEntry(
      source,
      resolvedRequestUrl,
      storedRecord,
    );
  }

  /**
   * @brief Persist one startup-byte payload through the VFS write-through flow
   *
   * @param source - Source descriptor that owns the bytes
   * @param purpose - Stored startup-byte purpose
   * @param range - Stored byte range
   * @param bytes - Byte payload being written
   * @param contentType - Optional content type
   * @param variantKey - Optional variant identity
   * @param requestUrl - Optional concrete request URL
   * @param cachePolicy - Cache policy that controls write-through behavior
   * @param writeToServiceWorker - Optional service-worker write-through hint
   *
   * @returns Stored startup-byte cache entry
   */
  private async storeStartupWindowEntry(
    source: ReadableFileDescriptor,
    purpose: StartupWindowDescriptor["purpose"],
    range: ByteRange,
    bytes: Uint8Array,
    contentType: string | null,
    variantKey: string | null,
    requestUrl: string | null,
    cachePolicy: CachePolicy,
    writeToServiceWorker: boolean = true,
  ): Promise<StartupWindowCacheEntry> {
    const descriptor: StartupWindowDescriptor =
      this.createStartupWindowDescriptor({
        source,
        purpose,
        requestUrl,
        range,
        variantKey,
        cachePolicy,
        expectedContentType: contentType,
        useCase: "generic",
        allowServiceWorkerLookup: true,
        fallbackReason: null,
      });
    const nowMs: number = Date.now();
    const recordBytes: Uint8Array = new Uint8Array(bytes);
    const blobBuffer: ArrayBuffer = recordBytes.buffer.slice(
      recordBytes.byteOffset,
      recordBytes.byteOffset + recordBytes.byteLength,
    ) as ArrayBuffer;
    const persistenceRecord: PersistenceWriteRequest = {
      key: descriptor.cacheKey,
      tier: cachePolicy.allowPersistent ? "persistent" : "memory",
      contentType,
      metadata: {
        endOffsetExclusive: descriptor.range.endOffsetExclusive,
        entryKind: descriptor.purpose,
        identityKey: descriptor.identityKey,
        range: this.serializeRange(descriptor.range),
        requestUrl: descriptor.requestUrl,
        sourceId: source.sourceId,
        startOffset: descriptor.range.startOffset,
        variantKey,
      },
      body: new Blob([blobBuffer], {
        type: contentType ?? "application/octet-stream",
      }),
      bodyKind: "blob",
      createdAt: nowMs,
      updatedAt: nowMs,
      lastAccessedAt: nowMs,
      byteLength: recordBytes.byteLength,
    };
    const storedRecord: PersistenceRecord = await this.storeRecord(
      persistenceRecord,
      cachePolicy,
      writeToServiceWorker,
      descriptor.requestUrl,
    );

    return {
      descriptor,
      tier: storedRecord.tier,
      bytes: recordBytes,
      contentType: storedRecord.contentType,
      storedAt: storedRecord.updatedAt,
      byteLength: recordBytes.byteLength,
    };
  }

  /**
   * @brief Persist one record through the memory, disk, and service-worker flow
   *
   * @param record - Record being written
   * @param cachePolicy - Cache policy that controls write-through behavior
   * @param writeToServiceWorker - Whether CacheStorage should receive the write
   * @param requestUrl - Debug URL associated with the write
   *
   * @returns Stored record surfaced back to callers
   */
  private async storeRecord(
    record: PersistenceWriteRequest,
    cachePolicy: CachePolicy,
    writeToServiceWorker: boolean,
    requestUrl: string,
  ): Promise<PersistenceRecord> {
    let storedRecord: PersistenceRecord = {
      ...record,
      metadata: {
        ...record.metadata,
      },
    };

    if (cachePolicy.allowPersistent) {
      storedRecord = await this.persistenceAdapter.put(record);
    }

    if (cachePolicy.allowMemory) {
      this.rememberMemoryRecord(storedRecord);
    }

    if (writeToServiceWorker && cachePolicy.writeThrough) {
      await this.serviceWorker.putRecord(record, requestUrl);
    }

    return storedRecord;
  }

  /**
   * @brief Build one stored manifest entry from a persistence record
   *
   * @param source - Source descriptor associated with the manifest
   * @param requestUrl - Concrete manifest URL
   * @param record - Persisted record being surfaced
   *
   * @returns Manifest cache entry
   */
  private createManifestCacheEntry(
    source: ReadableFileDescriptor,
    requestUrl: string,
    record: PersistenceRecord,
  ): ManifestCacheEntry {
    return {
      key: record.key,
      identityKey: `${record.metadata.identityKey ?? record.key}`,
      source,
      requestUrl,
      tier: record.tier,
      manifestText: `${record.body}`,
      contentType: record.contentType,
      storedAt: record.updatedAt,
      byteLength: record.byteLength ?? new Blob([`${record.body}`]).size,
    };
  }

  /**
   * @brief Build one startup descriptor from a startup-window request
   *
   * @param request - Request being normalized
   *
   * @returns Stable startup descriptor
   */
  private createStartupWindowDescriptor(
    request: StartupWindowRequest,
  ): StartupWindowDescriptor {
    const requestUrl: string = request.requestUrl ?? request.source.url;
    const cacheKey: CacheKey = this.createRangeStorageKey(
      request.source,
      request.purpose,
      request.range,
      request.variantKey,
      requestUrl,
    );

    return {
      cacheKey,
      identityKey: this.composeCacheKey(
        request.purpose,
        request.source.sourceId,
        request.variantKey ?? "default",
        requestUrl,
        this.serializeRange(request.range),
      ),
      source: request.source,
      purpose: request.purpose,
      requestUrl,
      range: {
        startOffset: request.range.startOffset,
        endOffsetExclusive: request.range.endOffsetExclusive,
      },
      variantKey: request.variantKey,
    };
  }

  /**
   * @brief Rebuild one startup-byte cache entry from a persistence record
   *
   * @param descriptor - Stable descriptor associated with the bytes
   * @param record - Persisted record being surfaced
   *
   * @returns Startup-byte cache entry, or `null` when the record cannot decode
   */
  private async createStartupWindowCacheEntry(
    descriptor: StartupWindowDescriptor,
    record: PersistenceRecord,
  ): Promise<StartupWindowCacheEntry | null> {
    if (!(record.body instanceof Blob)) {
      return null;
    }

    const byteBuffer: ArrayBuffer = await record.body.arrayBuffer();
    const bytes: Uint8Array = new Uint8Array(byteBuffer);

    return {
      descriptor,
      tier: record.tier,
      bytes,
      contentType: record.contentType,
      storedAt: record.updatedAt,
      byteLength: bytes.byteLength,
    };
  }

  /**
   * @brief Attempt to satisfy one startup window from a cached hot-range record
   *
   * @param request - Startup request being serviced
   * @param descriptor - Stable descriptor for the requested startup window
   * @param lookupSteps - Lookup steps being assembled for debug output
   *
   * @returns Reused startup window entry, or `null` when no hot-range matched
   */
  private async tryReuseHotRange(
    request: StartupWindowRequest,
    descriptor: StartupWindowDescriptor,
    lookupSteps: VfsCacheLookupStep[],
  ): Promise<StartupWindowCacheEntry | null> {
    if (request.purpose === "hot-range") {
      return null;
    }

    const requestUrl: string = descriptor.requestUrl;
    const matchingMemoryHotRange: PersistenceRecord | null =
      await this.findContainingHotRangeRecord(
        request.source,
        requestUrl,
        request.range,
        "memory-hot",
      );

    if (matchingMemoryHotRange !== null) {
      const slicedEntry: StartupWindowCacheEntry | null =
        await this.sliceStartupWindowFromRecord(
          descriptor,
          matchingMemoryHotRange,
          "memory",
        );

      if (slicedEntry !== null) {
        lookupSteps.push(
          this.createLookupStep(
            descriptor.cacheKey,
            "memory-hot",
            "hit",
            requestUrl,
            `${descriptor.purpose} lookup reused a larger hot-range entry from the VFS memory-hot cache.`,
          ),
        );

        return slicedEntry;
      }
    }

    const matchingPersistentHotRange: PersistenceRecord | null =
      await this.findContainingHotRangeRecord(
        request.source,
        requestUrl,
        request.range,
        "disk-persistent",
      );

    if (matchingPersistentHotRange !== null) {
      const slicedEntry: StartupWindowCacheEntry | null =
        await this.sliceStartupWindowFromRecord(
          descriptor,
          matchingPersistentHotRange,
          "persistent",
        );

      if (slicedEntry !== null) {
        lookupSteps.push(
          this.createLookupStep(
            descriptor.cacheKey,
            "disk-persistent",
            "hit",
            requestUrl,
            `${descriptor.purpose} lookup reused a larger hot-range entry from persistent VFS storage.`,
          ),
        );
        await this.storeStartupWindowEntry(
          descriptor.source,
          descriptor.purpose,
          descriptor.range,
          slicedEntry.bytes,
          slicedEntry.contentType,
          descriptor.variantKey,
          descriptor.requestUrl,
          this.getDefaultCachePolicy(),
          false,
        );

        return slicedEntry;
      }
    }

    return null;
  }

  /**
   * @brief Find one cached hot-range record that fully contains the requested range
   *
   * @param source - Source descriptor associated with the bytes
   * @param requestUrl - Concrete request URL being serviced
   * @param requestedRange - Requested byte range
   * @param layer - Cache layer being searched
   *
   * @returns Matching record, or `null` when none contained the range
   */
  private async findContainingHotRangeRecord(
    source: ReadableFileDescriptor,
    requestUrl: string,
    requestedRange: ByteRange,
    layer: "memory-hot" | "disk-persistent",
  ): Promise<PersistenceRecord | null> {
    const candidateRecords: PersistenceRecord[] =
      layer === "memory-hot"
        ? [...this.memoryRecordsByKey.values()].filter(
            (record: PersistenceRecord): boolean =>
              `${record.metadata.entryKind ?? ""}` === "hot-range" &&
              `${record.metadata.sourceId ?? ""}` === source.sourceId &&
              `${record.metadata.requestUrl ?? ""}` === requestUrl,
          )
        : await this.persistenceAdapter.list(
            this.composeCacheKey("hot-range", source.sourceId, requestUrl),
          );

    for (const candidateRecord of candidateRecords) {
      const startOffset: number = Number(
        candidateRecord.metadata.startOffset ?? 0,
      );
      const endOffsetExclusive: number | null =
        candidateRecord.metadata.endOffsetExclusive === null
          ? null
          : candidateRecord.metadata.endOffsetExclusive === undefined
            ? null
            : Number(candidateRecord.metadata.endOffsetExclusive);
      const doesContainRange: boolean =
        startOffset <= requestedRange.startOffset &&
        (endOffsetExclusive === null ||
          (requestedRange.endOffsetExclusive !== null &&
            endOffsetExclusive >= requestedRange.endOffsetExclusive));

      if (doesContainRange) {
        return candidateRecord;
      }
    }

    return null;
  }

  /**
   * @brief Slice one requested startup window from a larger cached hot-range
   *
   * @param descriptor - Requested startup descriptor
   * @param record - Cached hot-range record that contains the bytes
   * @param tier - Cache tier to report on the sliced entry
   *
   * @returns Sliced startup window entry, or `null` when slicing failed
   */
  private async sliceStartupWindowFromRecord(
    descriptor: StartupWindowDescriptor,
    record: PersistenceRecord,
    tier: StartupWindowCacheEntry["tier"],
  ): Promise<StartupWindowCacheEntry | null> {
    if (!(record.body instanceof Blob)) {
      return null;
    }

    const recordStartOffset: number = Number(record.metadata.startOffset ?? 0);
    const byteBuffer: ArrayBuffer = await record.body.arrayBuffer();
    const recordBytes: Uint8Array = new Uint8Array(byteBuffer);
    const sliceStartOffset: number =
      descriptor.range.startOffset - recordStartOffset;
    const sliceEndOffsetExclusive: number =
      descriptor.range.endOffsetExclusive === null
        ? recordBytes.byteLength
        : descriptor.range.endOffsetExclusive - recordStartOffset;

    if (
      sliceStartOffset < 0 ||
      sliceEndOffsetExclusive > recordBytes.byteLength ||
      sliceStartOffset >= sliceEndOffsetExclusive
    ) {
      return null;
    }

    return {
      descriptor,
      tier,
      bytes: recordBytes.slice(sliceStartOffset, sliceEndOffsetExclusive),
      contentType: record.contentType,
      storedAt: record.updatedAt,
      byteLength: sliceEndOffsetExclusive - sliceStartOffset,
    };
  }

  /**
   * @brief Return one memory-hot record by cache key
   *
   * @param cacheKey - Stable cache key being resolved
   *
   * @returns Matching record, or `null` when absent
   */
  private getMemoryRecord(cacheKey: CacheKey): PersistenceRecord | null {
    const existingRecord: PersistenceRecord | undefined =
      this.memoryRecordsByKey.get(cacheKey);

    if (existingRecord === undefined) {
      return null;
    }

    const touchedRecord: PersistenceRecord = {
      ...existingRecord,
      metadata: {
        ...existingRecord.metadata,
      },
      lastAccessedAt: Date.now(),
    };

    this.memoryRecordsByKey.set(cacheKey, touchedRecord);

    return touchedRecord;
  }

  /**
   * @brief Remember one record in the VFS memory-hot cache
   *
   * @param record - Record being remembered
   */
  private rememberMemoryRecord(record: PersistenceRecord): void {
    this.memoryRecordsByKey.set(record.key, {
      ...record,
      metadata: {
        ...record.metadata,
      },
    });
  }

  /**
   * @brief Record a batch of lookup steps into the shared debug snapshot
   *
   * @param artifactKind - Artifact kind associated with the lookup
   * @param sourceId - Optional source identifier associated with the lookup
   * @param lookupSteps - Lookup steps that were observed
   * @param useCase - Startup use-case associated with the lookup
   */
  private recordLookupSteps(
    artifactKind: StartupArtifactKind | "derived-artifact",
    sourceId: string | null,
    lookupSteps: VfsCacheLookupStep[],
    useCase: StartupUseCase,
  ): void {
    for (const lookupStep of lookupSteps) {
      this.debugEvents.push({
        artifactKind,
        sourceId,
        cacheKey: lookupStep.key,
        layer: lookupStep.layer,
        outcome: lookupStep.outcome,
        requestUrl: lookupStep.requestUrl,
        useCase,
        detail: lookupStep.detail,
        recordedAt: lookupStep.recordedAt,
      });
    }

    if (this.debugEvents.length > VfsController.MAX_DEBUG_EVENTS) {
      this.debugEvents.splice(
        0,
        this.debugEvents.length - VfsController.MAX_DEBUG_EVENTS,
      );
    }
  }

  /**
   * @brief Compose one stable human-readable cache key
   *
   * @param parts - Ordered cache-key components
   *
   * @returns Stable cache key
   */
  private composeCacheKey(...parts: Array<string | number>): CacheKey {
    const serializedParts: string[] = parts.map(
      (part: string | number): string =>
        `${part}`.replaceAll("|", "_").replaceAll(":", "_"),
    );

    return serializedParts.join("|");
  }

  /**
   * @brief Serialize one byte range into a compact cache-key fragment
   *
   * @param range - Byte range being serialized
   *
   * @returns Compact range string
   */
  private serializeRange(range: ByteRange): string {
    return `${range.startOffset}-${range.endOffsetExclusive ?? "end"}`;
  }

  /**
   * @brief Build the stable cache key used for one stored range entry
   *
   * @param source - Source descriptor associated with the bytes
   * @param purpose - Explicit range-storage purpose
   * @param range - Byte range being cached
   * @param variantKey - Optional variant hint
   * @param requestUrl - Concrete request URL
   *
   * @returns Stable range-storage cache key
   */
  private createRangeStorageKey(
    source: ReadableFileDescriptor,
    purpose: RangeStorageEntry["purpose"],
    range: ByteRange,
    variantKey: string | null,
    requestUrl: string,
  ): CacheKey {
    switch (purpose) {
      case "init-segment":
        return this.composeCacheKey(
          "init-segment",
          source.sourceId,
          variantKey ?? "default",
          requestUrl,
          this.serializeRange(range),
        );
      case "startup-window":
        return this.composeCacheKey(
          "startup-window",
          source.sourceId,
          variantKey ?? "default",
          requestUrl,
          this.serializeRange(range),
        );
      case "hot-range":
        return this.composeCacheKey(
          "hot-range",
          source.sourceId,
          requestUrl,
          this.serializeRange(range),
        );
    }
  }

  /**
   * @brief Create one inspectable lookup step
   *
   * @param key - Stable cache key associated with the lookup
   * @param layer - Cache layer that was consulted
   * @param outcome - Outcome observed at the layer
   * @param requestUrl - Concrete request URL associated with the lookup
   * @param detail - Human-readable detail for debug output
   *
   * @returns Immutable lookup step
   */
  private createLookupStep(
    key: CacheKey,
    layer: VfsCacheLayer,
    outcome: VfsCacheLookupStep["outcome"],
    requestUrl: string | null,
    detail: string | null,
  ): VfsCacheLookupStep {
    return {
      key,
      layer,
      outcome,
      requestUrl,
      detail,
      recordedAt: Date.now(),
    };
  }

  /**
   * @brief Infer the debug node type from one stable cache key
   *
   * @param cacheKey - Stable cache key being inspected
   *
   * @returns Snapshot node type
   */
  private resolveNodeType(cacheKey: CacheKey): VfsNode["nodeType"] {
    if (cacheKey.startsWith("derived-artifact|")) {
      return "artifact";
    }

    if (cacheKey.startsWith("manifest|")) {
      return "manifest";
    }

    if (
      cacheKey.startsWith("init-segment|") ||
      cacheKey.startsWith("startup-window|") ||
      cacheKey.startsWith("hot-range|")
    ) {
      return "range";
    }

    return "unknown";
  }
}
