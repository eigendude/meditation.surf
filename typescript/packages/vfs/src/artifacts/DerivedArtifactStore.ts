/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CacheKey, VfsCacheLookupStep } from "../cache/CacheTypes";
import type {
  PersistenceAdapter,
  PersistenceRecord,
} from "../persistence/PersistenceTypes";
import type {
  DerivedArtifactDescriptor,
  DerivedArtifactEntry,
  DerivedArtifactKey,
  DerivedArtifactResult,
  DerivedArtifactWrite,
} from "./DerivedArtifactTypes";

/**
 * @brief Generic derived-artifact store used for thumbnails and future blobs
 */
export class DerivedArtifactStore {
  private readonly persistenceAdapter: PersistenceAdapter;
  private readonly artifactEntriesByCacheKey: Map<
    CacheKey,
    DerivedArtifactEntry
  >;
  private readonly leasedObjectUrlsByKey: Map<CacheKey, string>;

  /**
   * @brief Build the derived-artifact store
   *
   * @param persistenceAdapter - Persistence adapter used for record storage
   */
  public constructor(persistenceAdapter: PersistenceAdapter) {
    this.persistenceAdapter = persistenceAdapter;
    this.artifactEntriesByCacheKey = new Map<CacheKey, DerivedArtifactEntry>();
    this.leasedObjectUrlsByKey = new Map<CacheKey, string>();
  }

  /**
   * @brief Resolve one stored artifact entry by stable cache key
   *
   * @param artifactKey - Stable artifact key being read
   *
   * @returns Stored artifact entry, or `null` when absent
   */
  public async getArtifact(
    artifactKey: CacheKey | DerivedArtifactKey,
  ): Promise<DerivedArtifactEntry | null> {
    const artifactResult: DerivedArtifactResult =
      await this.resolveArtifact(artifactKey);

    return artifactResult.entry;
  }

  /**
   * @brief List stored artifacts whose cache keys share one stable prefix
   *
   * The returned entries preserve the store's normal object-URL leasing
   * behavior so callers can immediately render any restored artifact.
   *
   * @param cacheKeyPrefix - Stable cache-key prefix used to filter artifacts
   *
   * @returns Matching artifact entries ordered by persistence enumeration
   */
  public async listArtifactsByCacheKeyPrefix(
    cacheKeyPrefix: string,
  ): Promise<DerivedArtifactEntry[]> {
    const artifactEntriesByCacheKey: Map<CacheKey, DerivedArtifactEntry> =
      new Map<CacheKey, DerivedArtifactEntry>();

    for (const [
      cacheKey,
      artifactEntry,
    ] of this.artifactEntriesByCacheKey.entries()) {
      if (!cacheKey.startsWith(cacheKeyPrefix)) {
        continue;
      }

      artifactEntriesByCacheKey.set(
        cacheKey,
        this.cloneArtifactEntry(artifactEntry),
      );
    }

    const storedRecords: PersistenceRecord[] =
      await this.persistenceAdapter.list(cacheKeyPrefix);

    for (const storedRecord of storedRecords) {
      if (artifactEntriesByCacheKey.has(storedRecord.key)) {
        continue;
      }

      const artifactEntry: DerivedArtifactEntry =
        this.createArtifactEntry(storedRecord);

      this.artifactEntriesByCacheKey.set(storedRecord.key, artifactEntry);
      artifactEntriesByCacheKey.set(
        storedRecord.key,
        this.cloneArtifactEntry(artifactEntry),
      );
    }

    return [...artifactEntriesByCacheKey.values()];
  }

  /**
   * @brief Resolve one stored artifact entry with explicit lookup-order details
   *
   * @param artifactKey - Stable artifact key being read
   * @param fallbackReason - Optional reason captured when lookup was attempted
   *
   * @returns Stored artifact entry together with lookup steps
   */
  public async resolveArtifact(
    artifactKey: CacheKey | DerivedArtifactKey,
    fallbackReason: string | null = null,
  ): Promise<DerivedArtifactResult> {
    const cacheKey: CacheKey = this.resolveCacheKey(artifactKey);
    const memoryArtifactEntry: DerivedArtifactEntry | undefined =
      this.artifactEntriesByCacheKey.get(cacheKey);

    if (memoryArtifactEntry !== undefined) {
      return {
        entry: this.cloneArtifactEntry(memoryArtifactEntry),
        lookupSteps: [
          this.createLookupStep(
            cacheKey,
            "memory-hot",
            "hit",
            null,
            "Derived artifact was already resident in the VFS memory-hot layer.",
          ),
        ],
        resolvedLayer: "memory-hot",
        fallbackReason,
      };
    }

    const storedRecord: PersistenceRecord | null =
      await this.persistenceAdapter.get(cacheKey);

    if (storedRecord === null) {
      return {
        entry: null,
        lookupSteps: [
          this.createLookupStep(
            cacheKey,
            "memory-hot",
            "miss",
            null,
            "Derived artifact was absent from the VFS memory-hot layer.",
          ),
          this.createLookupStep(
            cacheKey,
            "disk-persistent",
            "miss",
            null,
            "Derived artifact was absent from persistent VFS storage.",
          ),
        ],
        resolvedLayer: "none",
        fallbackReason,
      };
    }

    const artifactEntry: DerivedArtifactEntry =
      this.createArtifactEntry(storedRecord);

    this.artifactEntriesByCacheKey.set(cacheKey, artifactEntry);

    return {
      entry: this.cloneArtifactEntry(artifactEntry),
      lookupSteps: [
        this.createLookupStep(
          cacheKey,
          "memory-hot",
          "miss",
          null,
          "Derived artifact was absent from the VFS memory-hot layer.",
        ),
        this.createLookupStep(
          cacheKey,
          "disk-persistent",
          "hit",
          null,
          "Derived artifact was loaded from persistent VFS storage.",
        ),
      ],
      resolvedLayer: "disk-persistent",
      fallbackReason,
    };
  }

  /**
   * @brief Persist one artifact payload and return the resolved stored entry
   *
   * @param write - Artifact payload being stored
   *
   * @returns Stored artifact entry
   */
  public async putArtifact(
    write: DerivedArtifactWrite,
  ): Promise<DerivedArtifactEntry> {
    const nowMs: number = Date.now();
    const cacheKey: CacheKey = write.descriptor.artifactKey.cacheKey;
    const byteLength: number | null = this.estimateByteLength(
      write.payload,
      write.payloadKind,
    );

    this.releaseArtifact(cacheKey);

    const storedRecord: PersistenceRecord = await this.persistenceAdapter.put({
      key: cacheKey,
      tier: write.cachePolicy.allowPersistent ? "persistent" : "memory",
      contentType: write.contentType,
      metadata: {
        artifactKind: write.descriptor.artifactKind,
        sourceId: write.descriptor.source.sourceId,
        sourceKind: write.descriptor.source.kind,
        sourceUrl: write.descriptor.source.url,
        identityKey: write.descriptor.artifactKey.identityKey,
        variantKey: write.descriptor.variantKey,
        ...write.metadata,
      },
      body: write.payload,
      bodyKind: write.payloadKind,
      createdAt: nowMs,
      updatedAt: nowMs,
      lastAccessedAt: nowMs,
      byteLength,
    });
    const artifactEntry: DerivedArtifactEntry = this.createArtifactEntry(
      storedRecord,
      write.descriptor,
    );

    this.artifactEntriesByCacheKey.set(cacheKey, artifactEntry);

    return this.cloneArtifactEntry(artifactEntry);
  }

  /**
   * @brief Delete one stored artifact and release any leased render URL
   *
   * @param artifactKey - Stable artifact key being deleted
   */
  public async deleteArtifact(
    artifactKey: CacheKey | DerivedArtifactKey,
  ): Promise<void> {
    const cacheKey: CacheKey = this.resolveCacheKey(artifactKey);

    this.releaseArtifact(cacheKey);
    this.artifactEntriesByCacheKey.delete(cacheKey);
    await this.persistenceAdapter.delete(cacheKey);
  }

  /**
   * @brief Release any leased object URL without deleting the stored bytes
   *
   * @param artifactKey - Stable artifact key whose URL lease should end
   */
  public releaseArtifact(artifactKey: CacheKey | DerivedArtifactKey): void {
    const cacheKey: CacheKey = this.resolveCacheKey(artifactKey);
    const leasedObjectUrl: string | undefined =
      this.leasedObjectUrlsByKey.get(cacheKey);

    if (leasedObjectUrl === undefined) {
      return;
    }

    URL.revokeObjectURL(leasedObjectUrl);
    this.leasedObjectUrlsByKey.delete(cacheKey);
  }

  /**
   * @brief Release every leased object URL owned by the artifact store
   */
  public releaseAllArtifacts(): void {
    for (const cacheKey of this.leasedObjectUrlsByKey.keys()) {
      this.releaseArtifact(cacheKey);
    }

    this.artifactEntriesByCacheKey.clear();
  }

  /**
   * @brief Create a renderable artifact entry from one stored persistence record
   *
   * @param record - Persisted record being surfaced
   * @param descriptorOverride - Optional descriptor known by the caller
   *
   * @returns Renderable artifact entry
   */
  private createArtifactEntry(
    record: PersistenceRecord,
    descriptorOverride?: DerivedArtifactDescriptor,
  ): DerivedArtifactEntry {
    const descriptor: DerivedArtifactDescriptor =
      descriptorOverride ?? this.createDescriptorFromRecord(record);
    const viewUrl: string | null = this.createViewUrl(record);

    return {
      descriptor: this.cloneDescriptor(descriptor),
      tier: record.tier,
      contentType: record.contentType ?? "application/octet-stream",
      byteLength: record.byteLength,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      metadata: {
        ...record.metadata,
      },
      viewUrl,
    };
  }

  /**
   * @brief Build one artifact descriptor from stored persistence metadata
   *
   * @param record - Persisted record being surfaced
   *
   * @returns Descriptor rebuilt from stored metadata
   */
  private createDescriptorFromRecord(
    record: PersistenceRecord,
  ): DerivedArtifactDescriptor {
    const artifactKind: string = `${record.metadata.artifactKind ?? "artifact"}`;
    const sourceId: string = `${record.metadata.sourceId ?? "unknown-source"}`;
    const variantKeyValue: string | null =
      record.metadata.variantKey === null
        ? null
        : `${record.metadata.variantKey ?? ""}`;
    const identityKey: string = `${record.metadata.identityKey ?? record.key}`;

    return {
      artifactKey: {
        cacheKey: record.key,
        identityKey,
        artifactKind,
        variantKey: variantKeyValue,
        sourceId,
      },
      source: {
        sourceId,
        kind: (record.metadata.sourceKind ?? "unknown") as
          | "hls"
          | "mp4"
          | "torrent"
          | "unknown",
        originType: "unknown",
        url: `${record.metadata.sourceUrl ?? ""}`,
        mimeType: null,
        posterUrl: null,
      },
      artifactKind,
      variantKey: variantKeyValue,
    };
  }

  /**
   * @brief Create or reuse a render URL for one stored artifact record
   *
   * @param record - Persisted record being surfaced
   *
   * @returns Render URL, or `null` when the environment cannot create one
   */
  private createViewUrl(record: PersistenceRecord): string | null {
    if (
      typeof URL === "undefined" ||
      typeof URL.createObjectURL !== "function"
    ) {
      return null;
    }

    const existingObjectUrl: string | undefined =
      this.leasedObjectUrlsByKey.get(record.key);

    if (existingObjectUrl !== undefined) {
      return existingObjectUrl;
    }

    const artifactBlob: Blob = this.toBlob(record.body, record.contentType);
    const objectUrl: string = URL.createObjectURL(artifactBlob);

    this.leasedObjectUrlsByKey.set(record.key, objectUrl);

    return objectUrl;
  }

  /**
   * @brief Convert a persistence body into a blob suitable for object URLs
   *
   * @param body - Stored body value
   * @param contentType - Optional MIME type
   *
   * @returns Blob that wraps the stored body
   */
  private toBlob(body: Blob | string, contentType: string | null): Blob {
    if (body instanceof Blob) {
      return body;
    }

    return new Blob([body], {
      type: contentType ?? "application/octet-stream",
    });
  }

  /**
   * @brief Estimate the persisted byte length for one artifact payload
   *
   * @param payload - Payload being stored
   * @param payloadKind - Declared payload kind
   *
   * @returns Best-effort byte length
   */
  private estimateByteLength(
    payload: Blob | string,
    payloadKind: DerivedArtifactWrite["payloadKind"],
  ): number | null {
    if (payloadKind === "blob" && payload instanceof Blob) {
      return payload.size;
    }

    if (typeof payload === "string") {
      return new Blob([payload]).size;
    }

    return null;
  }

  /**
   * @brief Normalize one artifact key input into its raw cache key
   *
   * @param artifactKey - Cache key or structured artifact key
   *
   * @returns Raw cache key
   */
  private resolveCacheKey(
    artifactKey: CacheKey | DerivedArtifactKey,
  ): CacheKey {
    return typeof artifactKey === "string" ? artifactKey : artifactKey.cacheKey;
  }

  /**
   * @brief Create one inspectable lookup step for artifact reads
   *
   * @param key - Stable cache key associated with the step
   * @param layer - Cache layer that was consulted
   * @param outcome - Outcome observed at the layer
   * @param requestUrl - Optional request URL associated with the lookup
   * @param detail - Human-readable debug note
   *
   * @returns Immutable lookup step
   */
  private createLookupStep(
    key: CacheKey,
    layer: VfsCacheLookupStep["layer"],
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
   * @brief Clone one derived-artifact descriptor for immutable callers
   *
   * @param descriptor - Descriptor being cloned
   *
   * @returns Cloned descriptor
   */
  private cloneDescriptor(
    descriptor: DerivedArtifactDescriptor,
  ): DerivedArtifactDescriptor {
    return {
      artifactKey: {
        cacheKey: descriptor.artifactKey.cacheKey,
        identityKey: descriptor.artifactKey.identityKey,
        artifactKind: descriptor.artifactKey.artifactKind,
        variantKey: descriptor.artifactKey.variantKey,
        sourceId: descriptor.artifactKey.sourceId,
      },
      source: {
        sourceId: descriptor.source.sourceId,
        kind: descriptor.source.kind,
        originType: descriptor.source.originType,
        url: descriptor.source.url,
        mimeType: descriptor.source.mimeType,
        posterUrl: descriptor.source.posterUrl,
      },
      artifactKind: descriptor.artifactKind,
      variantKey: descriptor.variantKey,
    };
  }

  /**
   * @brief Clone one derived-artifact entry for immutable callers
   *
   * @param artifactEntry - Artifact entry being cloned
   *
   * @returns Cloned artifact entry
   */
  private cloneArtifactEntry(
    artifactEntry: DerivedArtifactEntry,
  ): DerivedArtifactEntry {
    return {
      descriptor: this.cloneDescriptor(artifactEntry.descriptor),
      tier: artifactEntry.tier,
      contentType: artifactEntry.contentType,
      byteLength: artifactEntry.byteLength,
      createdAt: artifactEntry.createdAt,
      updatedAt: artifactEntry.updatedAt,
      metadata: {
        ...artifactEntry.metadata,
      },
      viewUrl: artifactEntry.viewUrl,
    };
  }
}
