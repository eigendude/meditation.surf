/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  DEFAULT_CACHE_POLICY,
  type DerivedArtifactDescriptor,
  type DerivedArtifactEntry,
  type DerivedArtifactResult,
  VfsController,
} from "@meditation-surf/vfs";

import type { AudioPolicyDecision } from "../audio/AudioPolicyDecision";
import type { CustomDecodeSnapshot } from "../custom-decode/CustomDecodeSnapshot";
import { MediaInventoryCloner } from "../inventory/MediaInventoryCloner";
import { RendererRouter } from "../rendering/RendererRouter";
import { MediaTelemetryController } from "../telemetry/MediaTelemetryController";
import type { MediaThumbnailCacheEntry } from "./MediaThumbnailCacheEntry";
import type { MediaThumbnailDescriptor } from "./MediaThumbnailDescriptor";
import type { MediaThumbnailExtractionAttempt } from "./MediaThumbnailExtractionAttempt";
import type {
  MediaThumbnailPriority,
  MediaThumbnailQuality,
} from "./MediaThumbnailExtractionPolicy";
import type { MediaThumbnailExtractionResult } from "./MediaThumbnailExtractionResult";
import type { MediaThumbnailQualityIntent } from "./MediaThumbnailQualityIntent";
import type { MediaThumbnailRequest } from "./MediaThumbnailRequest";
import type { MediaThumbnailResult } from "./MediaThumbnailResult";
import type { MediaThumbnailRuntimeAdapter } from "./MediaThumbnailRuntimeAdapter";
import type { MediaThumbnailRuntimeCapabilities } from "./MediaThumbnailRuntimeCapabilities";
import type { MediaThumbnailSelectionDecision } from "./MediaThumbnailSelectionDecision";
import type { MediaThumbnailSnapshot } from "./MediaThumbnailSnapshot";
import type { MediaThumbnailState } from "./MediaThumbnailState";

/**
 * @brief Listener signature used by the shared thumbnail controller
 */
export type MediaThumbnailSnapshotListener = (
  snapshot: MediaThumbnailSnapshot,
) => void;

/**
 * @brief Shared thumbnail orchestration controller
 *
 * The controller stays runtime-agnostic. It owns request deduplication,
 * conservative in-memory caching, pending work prioritization, and immutable
 * debug snapshots while leaving actual media extraction to app-shell adapters.
 */
export class MediaThumbnailController {
  private readonly cacheEntriesBySourceId: Map<
    string,
    MediaThumbnailCacheEntry
  >;
  private readonly listeners: Set<MediaThumbnailSnapshotListener>;
  private readonly pendingSourceIds: Set<string>;
  private readonly telemetryController: MediaTelemetryController;
  private readonly vfsController: VfsController;

  private isProcessingQueue: boolean;
  private runtimeAdapter: MediaThumbnailRuntimeAdapter | null;

  /**
   * @brief Create the shared thumbnail controller
   *
   * @param runtimeAdapter - Optional app-shell runtime adapter
   * @param vfsController - Optional VFS controller that owns artifact storage
   * @param telemetryController - Shared local telemetry collector
   */
  public constructor(
    runtimeAdapter: MediaThumbnailRuntimeAdapter | null = null,
    vfsController: VfsController = new VfsController(),
    telemetryController: MediaTelemetryController = new MediaTelemetryController(),
  ) {
    this.cacheEntriesBySourceId = new Map<string, MediaThumbnailCacheEntry>();
    this.listeners = new Set<MediaThumbnailSnapshotListener>();
    this.pendingSourceIds = new Set<string>();
    this.telemetryController = telemetryController;
    this.vfsController = vfsController;
    this.isProcessingQueue = false;
    this.runtimeAdapter = runtimeAdapter;
  }

  /**
   * @brief Return the runtime adapter currently registered for extraction work
   *
   * @returns Runtime adapter, or `null` when none is registered
   */
  public getRuntimeAdapter(): MediaThumbnailRuntimeAdapter | null {
    return this.runtimeAdapter;
  }

  /**
   * @brief Return the current runtime thumbnail capabilities
   *
   * @returns Runtime capability snapshot, or `null` when no adapter is present
   */
  public getRuntimeCapabilities(): MediaThumbnailRuntimeCapabilities | null {
    return this.runtimeAdapter?.getCapabilities() ?? null;
  }

  /**
   * @brief Return the shared VFS controller that owns thumbnail artifact storage
   *
   * @returns Shared VFS controller
   */
  public getVfsController(): VfsController {
    return this.vfsController;
  }

  /**
   * @brief Replace the runtime adapter used for thumbnail extraction
   *
   * @param runtimeAdapter - Runtime adapter implemented by the current app shell
   */
  public setRuntimeAdapter(
    runtimeAdapter: MediaThumbnailRuntimeAdapter | null,
  ): void {
    if (this.runtimeAdapter === runtimeAdapter) {
      return;
    }

    this.runtimeAdapter = runtimeAdapter;
    this.syncUnsupportedEntries();
    this.queueProcessing();
  }

  /**
   * @brief Return the current immutable thumbnail snapshot
   *
   * @returns Shared thumbnail cache and request snapshot
   */
  public getState(): MediaThumbnailSnapshot {
    const sortedEntries: MediaThumbnailCacheEntry[] = [
      ...this.cacheEntriesBySourceId.values(),
    ]
      .sort(
        (
          leftEntry: MediaThumbnailCacheEntry,
          rightEntry: MediaThumbnailCacheEntry,
        ): number =>
          leftEntry.descriptor.sourceId.localeCompare(
            rightEntry.descriptor.sourceId,
          ),
      )
      .map(
        (cacheEntry: MediaThumbnailCacheEntry): MediaThumbnailCacheEntry =>
          this.cloneCacheEntry(cacheEntry),
      );

    return {
      entries: sortedEntries,
      requestedSourceIds: sortedEntries
        .filter(
          (cacheEntry: MediaThumbnailCacheEntry): boolean =>
            cacheEntry.isRelevant,
        )
        .map(
          (cacheEntry: MediaThumbnailCacheEntry): string =>
            cacheEntry.descriptor.sourceId,
        ),
      cachedSourceIds: sortedEntries
        .filter(
          (cacheEntry: MediaThumbnailCacheEntry): boolean =>
            cacheEntry.result !== null,
        )
        .map(
          (cacheEntry: MediaThumbnailCacheEntry): string =>
            cacheEntry.descriptor.sourceId,
        ),
      readySourceIds: sortedEntries
        .filter(
          (cacheEntry: MediaThumbnailCacheEntry): boolean =>
            cacheEntry.state === "ready",
        )
        .map(
          (cacheEntry: MediaThumbnailCacheEntry): string =>
            cacheEntry.descriptor.sourceId,
        ),
      failedSourceIds: sortedEntries
        .filter(
          (cacheEntry: MediaThumbnailCacheEntry): boolean =>
            cacheEntry.state === "failed",
        )
        .map(
          (cacheEntry: MediaThumbnailCacheEntry): string =>
            cacheEntry.descriptor.sourceId,
        ),
      unsupportedSourceIds: sortedEntries
        .filter(
          (cacheEntry: MediaThumbnailCacheEntry): boolean =>
            cacheEntry.state === "unsupported",
        )
        .map(
          (cacheEntry: MediaThumbnailCacheEntry): string =>
            cacheEntry.descriptor.sourceId,
        ),
    };
  }

  /**
   * @brief Resolve the current cache entry associated with one item identifier
   *
   * @param itemId - Stable media item identifier
   *
   * @returns Matching cache entry, or `null` when none exists
   */
  public getEntryForItemId(itemId: string): MediaThumbnailCacheEntry | null {
    for (const cacheEntry of this.cacheEntriesBySourceId.values()) {
      if (cacheEntry.descriptor.itemIds.includes(itemId)) {
        return this.cloneCacheEntry(cacheEntry);
      }
    }

    return null;
  }

  /**
   * @brief Resolve the current cache entry associated with one source identifier
   *
   * @param sourceId - Stable media source identifier
   *
   * @returns Matching cache entry, or `null` when none exists
   */
  public getEntryForSourceId(
    sourceId: string,
  ): MediaThumbnailCacheEntry | null {
    const cacheEntry: MediaThumbnailCacheEntry | undefined =
      this.cacheEntriesBySourceId.get(sourceId);

    return cacheEntry === undefined ? null : this.cloneCacheEntry(cacheEntry);
  }

  /**
   * @brief Replace the current relevant thumbnail request set
   *
   * @param requests - Bounded request set derived from current browse context
   */
  public setRequests(requests: readonly MediaThumbnailRequest[]): void {
    const nextRelevantSourceIds: Set<string> = new Set<string>();

    for (const request of requests) {
      const normalizedRequest: MediaThumbnailRequest =
        this.cloneRequest(request);
      const sourceId: string = normalizedRequest.sourceId;
      const nowMs: number = Date.now();
      const existingEntry: MediaThumbnailCacheEntry | undefined =
        this.cacheEntriesBySourceId.get(sourceId);
      const nextDescriptor: MediaThumbnailDescriptor = this.cloneDescriptor(
        normalizedRequest.descriptor,
      );
      const shouldRefineExistingEntry: boolean =
        existingEntry?.state === "ready" &&
        existingEntry.request !== null &&
        this.shouldRefineReadyEntry(existingEntry.request, normalizedRequest);
      const nextState: MediaThumbnailState =
        existingEntry?.state === "ready" && !shouldRefineExistingEntry
          ? "ready"
          : "requested";

      nextRelevantSourceIds.add(sourceId);
      this.cacheEntriesBySourceId.set(sourceId, {
        descriptor: nextDescriptor,
        state: nextState,
        request: normalizedRequest,
        result: existingEntry?.result ?? null,
        failureReason:
          nextState === "ready" ? null : (existingEntry?.failureReason ?? null),
        isRelevant: true,
        lastRequestedAt: nowMs,
        lastUpdatedAt: nowMs,
      });

      if (existingEntry?.state !== "ready" || shouldRefineExistingEntry) {
        this.pendingSourceIds.add(sourceId);
      }
    }

    for (const [
      sourceId,
      cacheEntry,
    ] of this.cacheEntriesBySourceId.entries()) {
      if (nextRelevantSourceIds.has(sourceId)) {
        continue;
      }

      this.cacheEntriesBySourceId.set(sourceId, {
        ...this.cloneCacheEntry(cacheEntry),
        isRelevant: false,
      });
    }

    this.syncUnsupportedEntries();
    this.notifyListeners();
    this.queueProcessing();
  }

  /**
   * @brief Invalidate one cached thumbnail source
   *
   * @param sourceId - Stable media source identifier to discard
   *
   * @returns Optional async cleanup promise
   */
  public async invalidateSource(sourceId: string): Promise<void> {
    const cacheEntry: MediaThumbnailCacheEntry | undefined =
      this.cacheEntriesBySourceId.get(sourceId);

    if (cacheEntry === undefined) {
      return;
    }

    this.pendingSourceIds.delete(sourceId);
    this.cacheEntriesBySourceId.delete(sourceId);
    await this.releaseCachedResult(cacheEntry.result);
    this.notifyListeners();
  }

  /**
   * @brief Invalidate every cached thumbnail entry
   *
   * @returns Optional async cleanup promise
   */
  public async invalidateAll(): Promise<void> {
    const cacheEntries: MediaThumbnailCacheEntry[] = [
      ...this.cacheEntriesBySourceId.values(),
    ];

    this.pendingSourceIds.clear();
    this.cacheEntriesBySourceId.clear();

    for (const cacheEntry of cacheEntries) {
      await this.releaseCachedResult(cacheEntry.result);
    }

    this.notifyListeners();
  }

  /**
   * @brief Subscribe to thumbnail snapshot changes
   *
   * @param listener - Callback notified whenever the thumbnail snapshot changes
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: MediaThumbnailSnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @brief Release cached thumbnails and clear subscriptions
   */
  public destroy(): void {
    void this.invalidateAll();
    this.vfsController.destroy();
    this.listeners.clear();
  }

  /**
   * @brief Schedule queue processing without running overlapping extractions
   */
  private queueProcessing(): void {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    void this.processQueue().finally((): void => {
      this.isProcessingQueue = false;

      if (this.hasPendingWork()) {
        this.queueProcessing();
      }
    });
  }

  /**
   * @brief Execute pending extractions in deterministic priority order
   */
  private async processQueue(): Promise<void> {
    while (true) {
      const restoredCount: number =
        await this.restorePendingCachedThumbnailResults();

      if (restoredCount > 0) {
        continue;
      }

      const nextSourceId: string | null = this.selectNextPendingSourceId();

      if (nextSourceId === null) {
        return;
      }

      const cacheEntry: MediaThumbnailCacheEntry | undefined =
        this.cacheEntriesBySourceId.get(nextSourceId);

      if (cacheEntry === undefined || cacheEntry.request === null) {
        this.pendingSourceIds.delete(nextSourceId);
        continue;
      }

      if (cacheEntry.state === "ready") {
        this.pendingSourceIds.delete(nextSourceId);
        continue;
      }

      const restoredThumbnailResult: MediaThumbnailResult | null =
        cacheEntry.request === null
          ? null
          : await this.tryRestoreCachedThumbnailResult(cacheEntry.request);

      if (restoredThumbnailResult !== null) {
        this.telemetryController.recordEvent({
          domain: "thumbnail",
          kind: "cache-reused",
          occurredAtMs: Date.now(),
          sourceId: cacheEntry.request.sourceId,
          strategy: cacheEntry.request.extractionPolicy.strategy,
          latencyMs: 0,
          reason: "VFS restored an existing cached thumbnail artifact.",
        });
        this.applyCompletedThumbnailResult(
          nextSourceId,
          cacheEntry.request,
          restoredThumbnailResult,
        );
        continue;
      }

      if (!this.isRequestSupported(cacheEntry.request)) {
        this.pendingSourceIds.delete(nextSourceId);
        this.updateCacheEntryState(
          nextSourceId,
          "unsupported",
          this.createUnsupportedReason(cacheEntry.request),
          cacheEntry.result,
        );
        continue;
      }

      this.updateCacheEntryState(
        nextSourceId,
        "loading",
        null,
        cacheEntry.result,
      );
      this.updateCacheEntryState(
        nextSourceId,
        "extracting",
        null,
        cacheEntry.result,
      );

      try {
        const extractionStartedAtMs: number = Date.now();
        const runtimeAdapter: MediaThumbnailRuntimeAdapter =
          this.requireRuntimeAdapter();
        const thumbnailExtractionResult: MediaThumbnailExtractionResult =
          await runtimeAdapter.extractThumbnail(cacheEntry.request);
        const thumbnailResult: MediaThumbnailResult =
          await this.persistThumbnailResult(
            cacheEntry.request,
            thumbnailExtractionResult,
          );
        this.recordThumbnailTelemetry(thumbnailResult, extractionStartedAtMs);

        this.applyCompletedThumbnailResult(
          nextSourceId,
          cacheEntry.request,
          thumbnailResult,
        );
      } catch (error: unknown) {
        const failureReason: string =
          error instanceof Error && error.message.length > 0
            ? error.message
            : `Thumbnail extraction failed for ${nextSourceId}.`;
        this.telemetryController.recordEvent({
          domain: "thumbnail",
          kind: "extraction-failure",
          occurredAtMs: Date.now(),
          sourceId: cacheEntry.request.sourceId,
          strategy: cacheEntry.request.extractionPolicy.strategy,
          latencyMs: null,
          reason: failureReason,
        });

        this.pendingSourceIds.delete(nextSourceId);
        this.updateCacheEntryState(
          nextSourceId,
          "failed",
          failureReason,
          cacheEntry.result,
        );
      }
    }
  }

  /**
   * @brief Apply one completed thumbnail result while respecting newer queued requests
   *
   * @param sourceId - Stable source identifier whose work just completed
   * @param completedRequest - Request that produced the supplied result
   * @param thumbnailResult - Completed thumbnail result to surface immediately
   */
  private applyCompletedThumbnailResult(
    sourceId: string,
    completedRequest: MediaThumbnailRequest,
    thumbnailResult: MediaThumbnailResult,
  ): void {
    const latestCacheEntry: MediaThumbnailCacheEntry | undefined =
      this.cacheEntriesBySourceId.get(sourceId);
    const latestRequest: MediaThumbnailRequest | null =
      latestCacheEntry?.request ?? null;
    const shouldContinueRefining: boolean =
      latestRequest !== null &&
      this.shouldRefineReadyEntry(completedRequest, latestRequest);

    if (shouldContinueRefining) {
      this.pendingSourceIds.add(sourceId);
      this.updateCacheEntryState(sourceId, "requested", null, thumbnailResult);
      return;
    }

    this.pendingSourceIds.delete(sourceId);
    this.updateCacheEntryState(sourceId, "ready", null, thumbnailResult);
  }

  /**
   * @brief Mark requested entries unsupported when the runtime cannot extract them
   */
  private syncUnsupportedEntries(): void {
    for (const [
      sourceId,
      cacheEntry,
    ] of this.cacheEntriesBySourceId.entries()) {
      if (cacheEntry.request === null) {
        continue;
      }

      if (cacheEntry.state === "ready") {
        continue;
      }

      if (this.isRequestSupported(cacheEntry.request)) {
        if (cacheEntry.state === "unsupported") {
          this.updateCacheEntryState(
            sourceId,
            "requested",
            null,
            cacheEntry.result,
          );
          this.pendingSourceIds.add(sourceId);
        }

        continue;
      }

      this.pendingSourceIds.delete(sourceId);
      this.updateCacheEntryState(
        sourceId,
        "unsupported",
        this.createUnsupportedReason(cacheEntry.request),
        cacheEntry.result,
      );
    }
  }

  /**
   * @brief Determine whether any source still needs processing
   *
   * @returns `true` when the queue still contains pending sources
   */
  private hasPendingWork(): boolean {
    return this.selectNextPendingSourceId() !== null;
  }

  /**
   * @brief Pick the next queued source using stable priority ordering
   *
   * @returns Highest-priority queued source identifier, or `null`
   */
  private selectNextPendingSourceId(): string | null {
    const pendingEntries: MediaThumbnailCacheEntry[] = [
      ...this.pendingSourceIds.values(),
    ]
      .map(
        (sourceId: string): MediaThumbnailCacheEntry | null =>
          this.cacheEntriesBySourceId.get(sourceId) ?? null,
      )
      .filter(
        (
          cacheEntry: MediaThumbnailCacheEntry | null,
        ): cacheEntry is MediaThumbnailCacheEntry =>
          cacheEntry !== null &&
          cacheEntry.request !== null &&
          cacheEntry.state !== "ready" &&
          cacheEntry.state !== "unsupported",
      )
      .sort(
        (
          leftEntry: MediaThumbnailCacheEntry,
          rightEntry: MediaThumbnailCacheEntry,
        ): number => this.comparePendingEntries(leftEntry, rightEntry),
      );

    return pendingEntries[0]?.descriptor.sourceId ?? null;
  }

  /**
   * @brief Compare two queued entries for deterministic extraction ordering
   *
   * @param leftEntry - First pending entry being compared
   * @param rightEntry - Second pending entry being compared
   *
   * @returns Sort order that favors higher priority and older requests
   */
  private comparePendingEntries(
    leftEntry: MediaThumbnailCacheEntry,
    rightEntry: MediaThumbnailCacheEntry,
  ): number {
    const leftPriorityRank: number = this.getPriorityRank(
      leftEntry.request?.priorityHint ?? "none",
    );
    const rightPriorityRank: number = this.getPriorityRank(
      rightEntry.request?.priorityHint ?? "none",
    );

    if (leftPriorityRank !== rightPriorityRank) {
      return rightPriorityRank - leftPriorityRank;
    }

    const leftQualityRank: number = this.getQualityRank(
      leftEntry.request?.qualityHint ?? "low",
    );
    const rightQualityRank: number = this.getQualityRank(
      rightEntry.request?.qualityHint ?? "low",
    );

    if (leftQualityRank !== rightQualityRank) {
      return rightQualityRank - leftQualityRank;
    }

    const leftRequestedAt: number = leftEntry.lastRequestedAt ?? 0;
    const rightRequestedAt: number = rightEntry.lastRequestedAt ?? 0;

    if (leftRequestedAt !== rightRequestedAt) {
      return leftRequestedAt - rightRequestedAt;
    }

    return leftEntry.descriptor.sourceId.localeCompare(
      rightEntry.descriptor.sourceId,
    );
  }

  /**
   * @brief Convert one priority label into a stable numeric rank
   *
   * @param priorityHint - Priority label being ranked
   *
   * @returns Numeric sort rank
   */
  private getPriorityRank(priorityHint: MediaThumbnailPriority): number {
    switch (priorityHint) {
      case "high":
        return 4;
      case "medium":
        return 3;
      case "low":
        return 2;
      case "none":
        return 1;
    }
  }

  /**
   * @brief Convert one quality label into a stable numeric rank
   *
   * @param qualityHint - Quality label being ranked
   *
   * @returns Numeric sort rank
   */
  private getQualityRank(qualityHint: MediaThumbnailQuality): number {
    switch (qualityHint) {
      case "premium-attempt":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
    }
  }

  /**
   * @brief Convert one thumbnail quality intent into a stable numeric rank
   *
   * @param qualityIntent - Shared thumbnail quality intent being ranked
   *
   * @returns Numeric quality-intent rank
   */
  private getQualityIntentRank(
    qualityIntent: MediaThumbnailQualityIntent,
  ): number {
    switch (qualityIntent) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
    }
  }

  /**
   * @brief Convert one extraction strategy into a stable refinement rank
   *
   * @param strategy - Extraction strategy being ranked
   *
   * @returns Numeric strategy rank
   */
  private getStrategyRank(
    strategy: MediaThumbnailRequest["extractionPolicy"]["strategy"],
  ): number {
    switch (strategy) {
      case "representative-search-on-rejection":
        return 3;
      case "time-hint":
        return 2;
      case "first-frame-fast-path":
        return 1;
    }
  }

  /**
   * @brief Determine whether a ready entry should be refined for a newer request
   *
   * @param existingRequest - Previously satisfied request still cached in memory
   * @param nextRequest - New request derived from the latest browse context
   *
   * @returns `true` when the newer request justifies conservative refinement
   */
  private shouldRefineReadyEntry(
    existingRequest: MediaThumbnailRequest,
    nextRequest: MediaThumbnailRequest,
  ): boolean {
    const existingStrategyRank: number = this.getStrategyRank(
      existingRequest.extractionPolicy.strategy,
    );
    const nextStrategyRank: number = this.getStrategyRank(
      nextRequest.extractionPolicy.strategy,
    );

    if (nextStrategyRank > existingStrategyRank) {
      return true;
    }

    const existingQualityIntentRank: number = this.getQualityIntentRank(
      existingRequest.extractionPolicy.qualityIntent,
    );
    const nextQualityIntentRank: number = this.getQualityIntentRank(
      nextRequest.extractionPolicy.qualityIntent,
    );

    if (nextQualityIntentRank > existingQualityIntentRank) {
      return true;
    }

    const existingQualityRank: number = this.getQualityRank(
      existingRequest.qualityHint,
    );
    const nextQualityRank: number = this.getQualityRank(
      nextRequest.qualityHint,
    );

    if (nextQualityRank > existingQualityRank) {
      return true;
    }

    const existingTargetArea: number = this.getTargetArea(existingRequest);
    const nextTargetArea: number = this.getTargetArea(nextRequest);

    if (nextTargetArea > existingTargetArea) {
      return true;
    }

    if (
      existingRequest.extractionPolicy.strategy === "time-hint" &&
      nextRequest.extractionPolicy.strategy === "time-hint" &&
      nextRequest.timeHintMs !== existingRequest.timeHintMs
    ) {
      return true;
    }

    return false;
  }

  /**
   * @brief Resolve one normalized target area for conservative refinement checks
   *
   * @param request - Request whose target dimensions are being compared
   *
   * @returns Best-effort requested thumbnail area
   */
  private getTargetArea(request: MediaThumbnailRequest): number {
    const resolvedWidth: number = Math.max(
      1,
      request.targetWidth ?? request.extractionPolicy.targetWidth ?? 1,
    );
    const resolvedHeight: number = Math.max(
      1,
      request.targetHeight ?? request.extractionPolicy.targetHeight ?? 1,
    );

    return resolvedWidth * resolvedHeight;
  }

  /**
   * @brief Check whether the current runtime can satisfy one request
   *
   * @param request - Shared request being evaluated
   *
   * @returns `true` when extraction should be attempted
   */
  private isRequestSupported(request: MediaThumbnailRequest): boolean {
    const runtimeCapabilities: MediaThumbnailRuntimeCapabilities | null =
      this.runtimeAdapter?.getCapabilities() ?? null;

    if (runtimeCapabilities === null) {
      return false;
    }

    switch (request.extractionPolicy.strategy) {
      case "first-frame-fast-path":
      case "time-hint":
        return runtimeCapabilities.canExtractFirstFrame;
      case "representative-search-on-rejection":
        return runtimeCapabilities.canExtractNonBlackFrame;
    }
  }

  /**
   * @brief Describe why one request could not be serviced by the current runtime
   *
   * @param request - Shared request that was rejected
   *
   * @returns Human-readable unsupported reason
   */
  private createUnsupportedReason(request: MediaThumbnailRequest): string {
    const runtimeAdapter: MediaThumbnailRuntimeAdapter | null =
      this.runtimeAdapter;

    if (runtimeAdapter === null) {
      return "No thumbnail runtime adapter is registered.";
    }

    if (
      request.extractionPolicy.strategy === "representative-search-on-rejection"
    ) {
      return `${runtimeAdapter.runtimeId} cannot extract representative-search thumbnails in this phase.`;
    }

    return `${runtimeAdapter.runtimeId} cannot extract thumbnails for this request in this phase.`;
  }

  /**
   * @brief Require that a runtime adapter exists before extraction begins
   *
   * @returns Registered runtime adapter
   */
  private requireRuntimeAdapter(): MediaThumbnailRuntimeAdapter {
    if (this.runtimeAdapter === null) {
      throw new Error("No thumbnail runtime adapter is registered.");
    }

    return this.runtimeAdapter;
  }

  /**
   * @brief Update one cache entry and immediately publish a new snapshot
   *
   * @param sourceId - Stable source identifier being updated
   * @param state - Next shared thumbnail lifecycle state
   * @param failureReason - Optional failure or unsupported detail
   * @param result - Optional extracted result to cache
   */
  private updateCacheEntryState(
    sourceId: string,
    state: MediaThumbnailState,
    failureReason: string | null,
    result: MediaThumbnailResult | null,
  ): void {
    const cacheEntry: MediaThumbnailCacheEntry | undefined =
      this.cacheEntriesBySourceId.get(sourceId);

    if (cacheEntry === undefined) {
      return;
    }

    this.cacheEntriesBySourceId.set(sourceId, {
      descriptor: this.cloneDescriptor(cacheEntry.descriptor),
      state,
      request:
        cacheEntry.request === null
          ? null
          : this.cloneRequest(cacheEntry.request),
      result: result === null ? null : this.cloneResult(result),
      failureReason,
      isRelevant: cacheEntry.isRelevant,
      lastRequestedAt: cacheEntry.lastRequestedAt,
      lastUpdatedAt: Date.now(),
    });
    this.notifyListeners();
  }

  /**
   * @brief Notify every listener with the latest immutable thumbnail snapshot
   */
  private notifyListeners(): void {
    const thumbnailSnapshot: MediaThumbnailSnapshot = this.getState();

    for (const listener of this.listeners) {
      listener(thumbnailSnapshot);
    }
  }

  /**
   * @brief Release a cached runtime thumbnail when it is invalidated
   *
   * @param result - Cached result being discarded
   *
   * @returns Optional async cleanup promise
   */
  private async releaseCachedResult(
    result: MediaThumbnailResult | null,
  ): Promise<void> {
    if (result === null) {
      return;
    }

    const artifactKey: MediaThumbnailResult["artifactKey"] = result.artifactKey;

    if (artifactKey.cacheKey.length === 0) {
      return;
    }

    /**
     * Releasing an in-memory thumbnail entry must not delete the persisted VFS
     * still. Keeping the stored bytes alive makes browse revisits and app
     * restarts much stickier without changing the image content itself.
     */
    this.vfsController.releaseDerivedArtifact(artifactKey);
  }

  /**
   * @brief Clone one cache entry for immutable external consumption
   *
   * @param cacheEntry - Cache entry being cloned
   *
   * @returns Cloned cache entry
   */
  private cloneCacheEntry(
    cacheEntry: MediaThumbnailCacheEntry,
  ): MediaThumbnailCacheEntry {
    return {
      descriptor: this.cloneDescriptor(cacheEntry.descriptor),
      state: cacheEntry.state,
      request:
        cacheEntry.request === null
          ? null
          : this.cloneRequest(cacheEntry.request),
      result:
        cacheEntry.result === null ? null : this.cloneResult(cacheEntry.result),
      failureReason: cacheEntry.failureReason,
      isRelevant: cacheEntry.isRelevant,
      lastRequestedAt: cacheEntry.lastRequestedAt,
      lastUpdatedAt: cacheEntry.lastUpdatedAt,
    };
  }

  /**
   * @brief Clone one request descriptor
   *
   * @param descriptor - Descriptor being cloned
   *
   * @returns Cloned descriptor
   */
  private cloneDescriptor(
    descriptor: MediaThumbnailDescriptor,
  ): MediaThumbnailDescriptor {
    return {
      itemIds: [...descriptor.itemIds],
      sourceId: descriptor.sourceId,
      sourceDescriptor: {
        sourceId: descriptor.sourceDescriptor.sourceId,
        kind: descriptor.sourceDescriptor.kind,
        originType: descriptor.sourceDescriptor.originType,
        url: descriptor.sourceDescriptor.url,
        mimeType: descriptor.sourceDescriptor.mimeType,
        posterUrl: descriptor.sourceDescriptor.posterUrl,
      },
    };
  }

  /**
   * @brief Clone one thumbnail request
   *
   * @param request - Request being cloned
   *
   * @returns Cloned request
   */
  private cloneRequest(request: MediaThumbnailRequest): MediaThumbnailRequest {
    return {
      descriptor: this.cloneDescriptor(request.descriptor),
      sourceDescriptor: {
        sourceId: request.sourceDescriptor.sourceId,
        kind: request.sourceDescriptor.kind,
        originType: request.sourceDescriptor.originType,
        url: request.sourceDescriptor.url,
        mimeType: request.sourceDescriptor.mimeType,
        posterUrl: request.sourceDescriptor.posterUrl,
      },
      sourceId: request.sourceId,
      priorityHint: request.priorityHint,
      qualityHint: request.qualityHint,
      targetWidth: request.targetWidth,
      targetHeight: request.targetHeight,
      timeHintMs: request.timeHintMs,
      variantSelection: {
        role: request.variantSelection.role,
        desiredQualityTier: request.variantSelection.desiredQualityTier,
        preferStartupLatency: request.variantSelection.preferStartupLatency,
        preferImageQuality: request.variantSelection.preferImageQuality,
        preferPremiumPlayback: request.variantSelection.preferPremiumPlayback,
        maxWidth: request.variantSelection.maxWidth,
        maxHeight: request.variantSelection.maxHeight,
        maxBandwidth: request.variantSelection.maxBandwidth,
        inventorySelectionReason:
          request.variantSelection.inventorySelectionReason,
        inventorySnapshot:
          request.variantSelection.inventorySnapshot === null
            ? null
            : MediaInventoryCloner.cloneSnapshot(
                request.variantSelection.inventorySnapshot,
              ),
        premiumCandidateAvailable:
          request.variantSelection.premiumCandidateAvailable,
        selectedVariant: MediaInventoryCloner.cloneVariantInfo(
          request.variantSelection.selectedVariant,
        ),
        matchedAvailableVariant:
          request.variantSelection.matchedAvailableVariant,
        matchedDesiredVariantIntent:
          request.variantSelection.matchedDesiredVariantIntent,
        reasons: [...request.variantSelection.reasons],
        notes: [...request.variantSelection.notes],
      },
      extractionPolicy: {
        strategy: request.extractionPolicy.strategy,
        fallbackBehavior: request.extractionPolicy.fallbackBehavior,
        firstFrameFastPath: request.extractionPolicy.firstFrameFastPath,
        representativeSearchOnRejection:
          request.extractionPolicy.representativeSearchOnRejection,
        qualityIntent: request.extractionPolicy.qualityIntent,
        timeoutMs: request.extractionPolicy.timeoutMs,
        targetWidth: request.extractionPolicy.targetWidth,
        targetHeight: request.extractionPolicy.targetHeight,
        targetTimeSeconds: request.extractionPolicy.targetTimeSeconds,
        searchWindowStartSeconds:
          request.extractionPolicy.searchWindowStartSeconds,
        searchWindowEndSeconds: request.extractionPolicy.searchWindowEndSeconds,
        candidateWindowMs: request.extractionPolicy.candidateWindowMs,
        candidateFrameStepMs: request.extractionPolicy.candidateFrameStepMs,
        maxCandidateFrames: request.extractionPolicy.maxCandidateFrames,
        maxAttemptCount: request.extractionPolicy.maxAttemptCount,
        blackFrameThreshold: request.extractionPolicy.blackFrameThreshold,
        nearBlackFrameThreshold:
          request.extractionPolicy.nearBlackFrameThreshold,
        fadeInFrameThreshold: request.extractionPolicy.fadeInFrameThreshold,
      },
      audioPolicyDecision: this.cloneAudioPolicyDecision(
        request.audioPolicyDecision,
      ),
      customDecodeCapability: {
        lane: request.customDecodeCapability.lane,
        allowedByRole: request.customDecodeCapability.allowedByRole,
        supportLevel: request.customDecodeCapability.supportLevel,
        webCodecsSupportLevel:
          request.customDecodeCapability.webCodecsSupportLevel,
        reasons: [...request.customDecodeCapability.reasons],
        notes: [...request.customDecodeCapability.notes],
      },
      customDecodeDecision: {
        lane: request.customDecodeDecision.lane,
        shouldAttempt: request.customDecodeDecision.shouldAttempt,
        preferred: request.customDecodeDecision.preferred,
        fallbackRequired: request.customDecodeDecision.fallbackRequired,
        fallbackReason: request.customDecodeDecision.fallbackReason,
        reasons: [...request.customDecodeDecision.reasons],
        notes: [...request.customDecodeDecision.notes],
      },
      rendererCapability: RendererRouter.cloneCapability(
        request.rendererCapability,
      )!,
      rendererDecision: RendererRouter.cloneDecision(request.rendererDecision)!,
    };
  }

  /**
   * @brief Clone one cached thumbnail result
   *
   * @param result - Result being cloned
   *
   * @returns Cloned result
   */
  private cloneResult(result: MediaThumbnailResult): MediaThumbnailResult {
    return {
      sourceId: result.sourceId,
      artifactKey: {
        cacheKey: result.artifactKey.cacheKey,
        identityKey: result.artifactKey.identityKey,
        artifactKind: result.artifactKey.artifactKind,
        variantKey: result.artifactKey.variantKey,
        sourceId: result.artifactKey.sourceId,
      },
      imageUrl: result.imageUrl,
      width: result.width,
      height: result.height,
      frameTimeMs: result.frameTimeMs,
      extractedAt: result.extractedAt,
      wasApproximate: result.wasApproximate,
      debug: {
        resolvedLayer: result.debug.resolvedLayer,
        lookupSteps: result.debug.lookupSteps.map(
          (lookupStep): (typeof result.debug.lookupSteps)[number] => ({
            ...lookupStep,
          }),
        ),
        reusedFromVfs: result.debug.reusedFromVfs,
        fallbackReason: result.debug.fallbackReason,
        audioPolicyDecision: this.cloneAudioPolicyDecision(
          result.debug.audioPolicyDecision,
        ),
        extractionAttempt: this.cloneExtractionAttempt(
          result.debug.extractionAttempt,
        ),
        selectionDecision: this.cloneSelectionDecision(
          result.debug.selectionDecision,
        ),
        customDecode: this.cloneCustomDecodeSnapshot(result.debug.customDecode),
        renderer: RendererRouter.cloneSnapshot(result.debug.renderer),
      },
    };
  }

  /**
   * @brief Attempt to restore one previously extracted thumbnail from VFS
   *
   * @param request - Shared thumbnail request being resolved
   *
   * @returns Cached thumbnail result, or `null` when VFS had no reusable still
   */
  private async tryRestoreCachedThumbnailResult(
    request: MediaThumbnailRequest,
  ): Promise<MediaThumbnailResult | null> {
    const restoredArtifactResult: DerivedArtifactResult | null =
      await this.resolveReusableThumbnailArtifact(request);
    const storedArtifact: DerivedArtifactEntry | null =
      restoredArtifactResult?.entry ?? null;
    const viewUrl: string | null = storedArtifact?.viewUrl ?? null;

    if (
      restoredArtifactResult === null ||
      storedArtifact === null ||
      viewUrl === null
    ) {
      return null;
    }

    const restoredExtractionAttempt: MediaThumbnailExtractionAttempt =
      this.readExtractionAttemptFromMetadata(storedArtifact, request);
    const restoredSelectionDecision: MediaThumbnailSelectionDecision =
      this.readSelectionDecisionFromMetadata(storedArtifact, request);

    return {
      sourceId: request.sourceId,
      artifactKey: storedArtifact.descriptor.artifactKey,
      imageUrl: viewUrl,
      width: Number(storedArtifact.metadata.width ?? 0),
      height: Number(storedArtifact.metadata.height ?? 0),
      frameTimeMs:
        storedArtifact.metadata.frameTimeMs === null
          ? null
          : Number(storedArtifact.metadata.frameTimeMs ?? 0),
      extractedAt: Number(
        storedArtifact.metadata.extractedAt ?? storedArtifact.updatedAt,
      ),
      wasApproximate: storedArtifact.metadata.wasApproximate === true,
      debug: {
        resolvedLayer: restoredArtifactResult.resolvedLayer,
        lookupSteps: restoredArtifactResult.lookupSteps.map(
          (
            lookupStep,
          ): (typeof restoredArtifactResult.lookupSteps)[number] => ({
            ...lookupStep,
          }),
        ),
        reusedFromVfs: true,
        fallbackReason: restoredArtifactResult.fallbackReason,
        audioPolicyDecision: this.cloneAudioPolicyDecision(
          request.audioPolicyDecision,
        ),
        extractionAttempt: restoredExtractionAttempt,
        selectionDecision: {
          ...this.cloneSelectionDecision(restoredSelectionDecision),
          cachedArtifactReused: true,
          resolvedReason: "cached-artifact-reused",
        },
        customDecode: this.cloneCustomDecodeSnapshot(
          restoredExtractionAttempt.customDecode,
        ),
        renderer: RendererRouter.createSnapshot({
          capability: request.rendererCapability,
          decision: request.rendererDecision,
          sessionId: `thumbnail:${request.sourceId}`,
          sessionRole: "thumbnail",
          variantRole: "thumbnail-extract",
          target: "thumbnail-surface",
          selectedBackend: null,
          activeBackend: null,
          usedLegacyPath: true,
          bypassedRendererRouter: false,
          fallbackReason:
            "VFS restored the existing thumbnail image, so this request stayed on the legacy image presentation path.",
          failureReason: null,
          frameHandle: {
            representation: "image-url",
            origin: "thumbnail-result",
            width: Number(storedArtifact.metadata.width ?? 0),
            height: Number(storedArtifact.metadata.height ?? 0),
            frameTimeMs:
              storedArtifact.metadata.frameTimeMs === null
                ? null
                : Number(storedArtifact.metadata.frameTimeMs ?? 0),
          },
          notes: [
            "Cached thumbnail restore bypassed live renderer routing and reused the legacy still-image path.",
          ],
        }),
      },
    };
  }

  /**
   * @brief Persist one extracted thumbnail payload through VFS-owned storage
   *
   * @param request - Shared thumbnail request associated with the payload
   * @param extractionResult - Raw runtime extraction payload
   *
   * @returns Renderable thumbnail result backed by VFS storage identity
   */
  private async persistThumbnailResult(
    request: MediaThumbnailRequest,
    extractionResult: MediaThumbnailExtractionResult,
  ): Promise<MediaThumbnailResult> {
    const artifactDescriptor: DerivedArtifactDescriptor =
      this.createArtifactDescriptorForRequest(request);
    const storedArtifact: DerivedArtifactEntry =
      await this.vfsController.storeDerivedArtifact({
        descriptor: artifactDescriptor,
        cachePolicy: {
          ...DEFAULT_CACHE_POLICY,
        },
        contentType: extractionResult.imageContentType,
        metadata: {
          extractedAt: extractionResult.extractedAt,
          extractionAttemptJson: JSON.stringify(
            extractionResult.extractionAttempt,
          ),
          frameTimeMs: extractionResult.frameTimeMs,
          height: extractionResult.height,
          qualityIntent: request.extractionPolicy.qualityIntent,
          selectionDecisionJson: JSON.stringify(
            extractionResult.selectionDecision,
          ),
          selectionReason: extractionResult.selectionDecision.selectionReason,
          strategyUsed: extractionResult.selectionDecision.strategyUsed,
          sourceId: extractionResult.sourceId,
          targetHeight:
            request.targetHeight ?? request.extractionPolicy.targetHeight,
          targetWidth:
            request.targetWidth ?? request.extractionPolicy.targetWidth,
          fallbackUsed: extractionResult.selectionDecision.fallbackUsed,
          wasApproximate: extractionResult.wasApproximate,
          width: extractionResult.width,
        },
        payload: extractionResult.imagePayload,
        payloadKind: "blob",
      });
    const viewUrl: string | null = storedArtifact.viewUrl;

    if (viewUrl === null) {
      throw new Error(
        `VFS could not create a renderable thumbnail URL for ${request.sourceId}.`,
      );
    }

    return {
      sourceId: extractionResult.sourceId,
      artifactKey: storedArtifact.descriptor.artifactKey,
      imageUrl: viewUrl,
      width: extractionResult.width,
      height: extractionResult.height,
      frameTimeMs: extractionResult.frameTimeMs,
      extractedAt: extractionResult.extractedAt,
      wasApproximate: extractionResult.wasApproximate,
      debug: {
        resolvedLayer: "memory-hot",
        lookupSteps: [],
        reusedFromVfs: false,
        fallbackReason: null,
        audioPolicyDecision: this.cloneAudioPolicyDecision(
          request.audioPolicyDecision,
        ),
        extractionAttempt: this.cloneExtractionAttempt(
          extractionResult.extractionAttempt,
        ),
        selectionDecision: this.cloneSelectionDecision(
          extractionResult.selectionDecision,
        ),
        customDecode: this.cloneCustomDecodeSnapshot(
          extractionResult.customDecode,
        ),
        renderer: RendererRouter.cloneSnapshot(extractionResult.renderer),
      },
    };
  }

  /**
   * @brief Clone one shared extraction-attempt summary
   *
   * @param extractionAttempt - Extraction attempt being cloned
   *
   * @returns Cloned extraction attempt
   */
  private cloneExtractionAttempt(
    extractionAttempt: MediaThumbnailExtractionAttempt,
  ): MediaThumbnailExtractionAttempt {
    return {
      requestedStrategy: extractionAttempt.requestedStrategy,
      strategyUsed: extractionAttempt.strategyUsed,
      fallbackBehavior:
        extractionAttempt.fallbackBehavior ??
        "representative-search-then-first-decodable",
      qualityIntent: extractionAttempt.qualityIntent,
      timeoutMs: extractionAttempt.timeoutMs,
      firstFrameFastPath: extractionAttempt.firstFrameFastPath ?? true,
      representativeSearchOnRejection:
        extractionAttempt.representativeSearchOnRejection ?? true,
      targetTimeSeconds: extractionAttempt.targetTimeSeconds,
      searchWindowStartSeconds: extractionAttempt.searchWindowStartSeconds,
      searchWindowEndSeconds: extractionAttempt.searchWindowEndSeconds,
      candidateWindowMs: extractionAttempt.candidateWindowMs,
      candidateFrameStepMs: extractionAttempt.candidateFrameStepMs,
      maxCandidateFrames: extractionAttempt.maxCandidateFrames,
      maxAttemptCount: extractionAttempt.maxAttemptCount,
      attemptedFrameCount: extractionAttempt.attemptedFrameCount,
      completedFrameCount: extractionAttempt.completedFrameCount,
      timedOut: extractionAttempt.timedOut,
      unsupported: extractionAttempt.unsupported,
      customDecode: this.cloneCustomDecodeSnapshot(
        extractionAttempt.customDecode,
      ),
      startedAt: extractionAttempt.startedAt,
      finishedAt: extractionAttempt.finishedAt,
    };
  }

  /**
   * @brief Emit structured thumbnail, renderer, and custom-decode telemetry
   *
   * @param thumbnailResult - Completed result to inspect
   * @param extractionStartedAtMs - Extraction start timestamp
   */
  private recordThumbnailTelemetry(
    thumbnailResult: MediaThumbnailResult,
    extractionStartedAtMs: number,
  ): void {
    const extractionAttempt: MediaThumbnailExtractionAttempt =
      thumbnailResult.debug.extractionAttempt;
    const customDecode = thumbnailResult.debug.customDecode;
    const renderer = thumbnailResult.debug.renderer;
    const occurredAtMs: number = Date.now();

    this.telemetryController.recordEvent({
      domain: "thumbnail",
      kind: "extraction-success",
      occurredAtMs,
      sourceId: thumbnailResult.sourceId,
      strategy: extractionAttempt.strategyUsed,
      latencyMs: occurredAtMs - extractionStartedAtMs,
      reason: thumbnailResult.debug.selectionDecision.resolvedReason,
    });

    if (customDecode !== null) {
      this.telemetryController.recordEvent({
        domain: "custom-decode",
        kind: customDecode.usedCustomDecode
          ? "used"
          : customDecode.failureReason !== null
            ? "failed"
            : "fallback",
        occurredAtMs,
        lane: customDecode.lane,
        sourceId: thumbnailResult.sourceId,
        reason:
          customDecode.failureReason ?? customDecode.fallbackReason ?? null,
      });
    }

    if (renderer !== null) {
      this.telemetryController.recordEvent({
        domain: "renderer",
        kind:
          renderer.failureReason !== null
            ? "route-failure"
            : renderer.usedLegacyPath
              ? "route-fallback"
              : "route-success",
        occurredAtMs,
        backend: renderer.usedLegacyPath ? "legacy" : renderer.activeBackend,
        target: "thumbnail",
        reason: renderer.failureReason ?? renderer.fallbackReason ?? null,
      });
    }
  }

  /**
   * @brief Clone one shared frame-selection decision
   *
   * @param selectionDecision - Selection decision being cloned
   *
   * @returns Cloned selection decision
   */
  private cloneSelectionDecision(
    selectionDecision: MediaThumbnailSelectionDecision,
  ): MediaThumbnailSelectionDecision {
    return {
      requestedStrategy: selectionDecision.requestedStrategy,
      strategyUsed: selectionDecision.strategyUsed,
      fallbackBehavior:
        selectionDecision.fallbackBehavior ??
        "representative-search-then-first-decodable",
      qualityIntent: selectionDecision.qualityIntent,
      selectionReason: selectionDecision.selectionReason,
      resolvedReason: selectionDecision.resolvedReason,
      firstFrameAccepted: selectionDecision.firstFrameAccepted ?? false,
      firstFrameRejected: selectionDecision.firstFrameRejected ?? false,
      firstFrameRejectionReason:
        selectionDecision.firstFrameRejectionReason ?? null,
      representativeSearchUsed:
        selectionDecision.representativeSearchUsed ?? false,
      representativeTargetTimeMs: selectionDecision.representativeTargetTimeMs,
      representativeWindowStartMs:
        selectionDecision.representativeWindowStartMs,
      representativeWindowEndMs: selectionDecision.representativeWindowEndMs,
      selectedFrameTimeMs: selectionDecision.selectedFrameTimeMs,
      selectedCandidateIndex: selectionDecision.selectedCandidateIndex,
      attemptedFrameCount: selectionDecision.attemptedFrameCount,
      rejectedFrameCount: selectionDecision.rejectedFrameCount,
      fallbackUsed: selectionDecision.fallbackUsed,
      cachedArtifactReused: selectionDecision.cachedArtifactReused,
      rejectionReasons: [...selectionDecision.rejectionReasons],
      candidateFrames: selectionDecision.candidateFrames.map(
        (
          candidateFrame: (typeof selectionDecision.candidateFrames)[number],
        ): (typeof selectionDecision.candidateFrames)[number] => ({
          attemptIndex: candidateFrame.attemptIndex,
          stage: candidateFrame.stage ?? "first-frame",
          requestedFrameTimeMs: candidateFrame.requestedFrameTimeMs ?? 0,
          frameTimeMs: candidateFrame.frameTimeMs,
          averageLuma: candidateFrame.averageLuma,
          darkestSampleLuma: candidateFrame.darkestSampleLuma,
          brightestSampleLuma: candidateFrame.brightestSampleLuma,
          darkPixelRatio: candidateFrame.darkPixelRatio,
          isDecodable: candidateFrame.isDecodable,
          rejectionReason: candidateFrame.rejectionReason,
        }),
      ),
    };
  }

  /**
   * @brief Restore one extraction-attempt summary from persisted artifact metadata
   *
   * @param storedArtifact - Stored artifact being surfaced from VFS
   * @param request - Current request associated with the artifact
   *
   * @returns Restored extraction-attempt summary
   */
  private readExtractionAttemptFromMetadata(
    storedArtifact: DerivedArtifactEntry,
    request: MediaThumbnailRequest,
  ): MediaThumbnailExtractionAttempt {
    const serializedExtractionAttempt: string | null =
      typeof storedArtifact.metadata.extractionAttemptJson === "string"
        ? storedArtifact.metadata.extractionAttemptJson
        : null;

    if (serializedExtractionAttempt === null) {
      return this.createLegacyExtractionAttempt(storedArtifact, request);
    }

    try {
      const parsedExtractionAttempt: unknown = JSON.parse(
        serializedExtractionAttempt,
      );

      return this.cloneExtractionAttempt(
        parsedExtractionAttempt as MediaThumbnailExtractionAttempt,
      );
    } catch {
      return this.createLegacyExtractionAttempt(storedArtifact, request);
    }
  }

  /**
   * @brief Restore one selection decision from persisted artifact metadata
   *
   * @param storedArtifact - Stored artifact being surfaced from VFS
   * @param request - Current request associated with the artifact
   *
   * @returns Restored frame-selection decision
   */
  private readSelectionDecisionFromMetadata(
    storedArtifact: DerivedArtifactEntry,
    request: MediaThumbnailRequest,
  ): MediaThumbnailSelectionDecision {
    const serializedSelectionDecision: string | null =
      typeof storedArtifact.metadata.selectionDecisionJson === "string"
        ? storedArtifact.metadata.selectionDecisionJson
        : null;

    if (serializedSelectionDecision === null) {
      return this.createLegacySelectionDecision(storedArtifact, request);
    }

    try {
      const parsedSelectionDecision: unknown = JSON.parse(
        serializedSelectionDecision,
      );

      return this.cloneSelectionDecision(
        parsedSelectionDecision as MediaThumbnailSelectionDecision,
      );
    } catch {
      return this.createLegacySelectionDecision(storedArtifact, request);
    }
  }

  /**
   * @brief Create a conservative legacy extraction-attempt summary when metadata is absent
   *
   * @param storedArtifact - Stored artifact being surfaced from VFS
   * @param request - Current request associated with the artifact
   *
   * @returns Conservative extraction-attempt summary
   */
  private createLegacyExtractionAttempt(
    storedArtifact: DerivedArtifactEntry,
    request: MediaThumbnailRequest,
  ): MediaThumbnailExtractionAttempt {
    return {
      requestedStrategy: request.extractionPolicy.strategy,
      strategyUsed: request.extractionPolicy.strategy,
      fallbackBehavior: request.extractionPolicy.fallbackBehavior,
      qualityIntent: request.extractionPolicy.qualityIntent,
      timeoutMs: request.extractionPolicy.timeoutMs,
      firstFrameFastPath: request.extractionPolicy.firstFrameFastPath,
      representativeSearchOnRejection:
        request.extractionPolicy.representativeSearchOnRejection,
      targetTimeSeconds: request.extractionPolicy.targetTimeSeconds,
      searchWindowStartSeconds:
        request.extractionPolicy.searchWindowStartSeconds,
      searchWindowEndSeconds: request.extractionPolicy.searchWindowEndSeconds,
      candidateWindowMs: request.extractionPolicy.candidateWindowMs,
      candidateFrameStepMs: request.extractionPolicy.candidateFrameStepMs,
      maxCandidateFrames: request.extractionPolicy.maxCandidateFrames,
      maxAttemptCount: request.extractionPolicy.maxAttemptCount,
      attemptedFrameCount: 1,
      completedFrameCount: 1,
      timedOut: false,
      unsupported: false,
      customDecode: null,
      startedAt: Number(
        storedArtifact.metadata.extractedAt ?? storedArtifact.createdAt,
      ),
      finishedAt: Number(
        storedArtifact.metadata.extractedAt ?? storedArtifact.updatedAt,
      ),
    };
  }

  /**
   * @brief Create a conservative legacy selection decision when metadata is absent
   *
   * @param storedArtifact - Stored artifact being surfaced from VFS
   * @param request - Current request associated with the artifact
   *
   * @returns Conservative selection decision
   */
  private createLegacySelectionDecision(
    storedArtifact: DerivedArtifactEntry,
    request: MediaThumbnailRequest,
  ): MediaThumbnailSelectionDecision {
    const restoredFrameTimeMs: number | null =
      storedArtifact.metadata.frameTimeMs === null
        ? null
        : Number(storedArtifact.metadata.frameTimeMs ?? 0);

    return {
      requestedStrategy: request.extractionPolicy.strategy,
      strategyUsed: request.extractionPolicy.strategy,
      fallbackBehavior: request.extractionPolicy.fallbackBehavior,
      qualityIntent: request.extractionPolicy.qualityIntent,
      selectionReason: "first-frame-accepted",
      resolvedReason: "first-frame-accepted",
      firstFrameAccepted: true,
      firstFrameRejected: false,
      firstFrameRejectionReason: null,
      representativeSearchUsed: false,
      representativeTargetTimeMs:
        request.extractionPolicy.targetTimeSeconds === null
          ? null
          : Math.round(request.extractionPolicy.targetTimeSeconds * 1000),
      representativeWindowStartMs:
        request.extractionPolicy.searchWindowStartSeconds === null
          ? null
          : Math.round(
              request.extractionPolicy.searchWindowStartSeconds * 1000,
            ),
      representativeWindowEndMs:
        request.extractionPolicy.searchWindowEndSeconds === null
          ? null
          : Math.round(request.extractionPolicy.searchWindowEndSeconds * 1000),
      selectedFrameTimeMs: restoredFrameTimeMs,
      selectedCandidateIndex: 0,
      attemptedFrameCount: 1,
      rejectedFrameCount: 0,
      fallbackUsed: storedArtifact.metadata.wasApproximate === true,
      cachedArtifactReused: false,
      rejectionReasons: [],
      candidateFrames: [
        {
          attemptIndex: 0,
          stage: "first-frame",
          requestedFrameTimeMs: 0,
          frameTimeMs: restoredFrameTimeMs,
          averageLuma: null,
          darkestSampleLuma: null,
          brightestSampleLuma: null,
          darkPixelRatio: null,
          isDecodable: true,
          rejectionReason: null,
        },
      ],
    };
  }

  /**
   * @brief Clone one custom decode snapshot used by thumbnail debug state
   *
   * @param customDecode - Custom decode snapshot being cloned
   *
   * @returns Cloned custom decode snapshot, or `null` when absent
   */
  private cloneCustomDecodeSnapshot(
    customDecode: CustomDecodeSnapshot | null,
  ): CustomDecodeSnapshot | null {
    if (customDecode === null) {
      return null;
    }

    return {
      lane: customDecode.lane,
      state: customDecode.state,
      usedCustomDecode: customDecode.usedCustomDecode,
      usedFallback: customDecode.usedFallback,
      fallbackReason: customDecode.fallbackReason,
      failureReason: customDecode.failureReason,
      selectedFrame:
        customDecode.selectedFrame === null
          ? null
          : {
              representation: customDecode.selectedFrame.representation,
              width: customDecode.selectedFrame.width,
              height: customDecode.selectedFrame.height,
              frameTimeMs: customDecode.selectedFrame.frameTimeMs,
            },
      renderer: RendererRouter.cloneSnapshot(customDecode.renderer),
      capability:
        customDecode.capability === null
          ? null
          : {
              lane: customDecode.capability.lane,
              allowedByRole: customDecode.capability.allowedByRole,
              supportLevel: customDecode.capability.supportLevel,
              webCodecsSupportLevel:
                customDecode.capability.webCodecsSupportLevel,
              reasons: [...customDecode.capability.reasons],
              notes: [...customDecode.capability.notes],
            },
      decision:
        customDecode.decision === null
          ? null
          : {
              lane: customDecode.decision.lane,
              shouldAttempt: customDecode.decision.shouldAttempt,
              preferred: customDecode.decision.preferred,
              fallbackRequired: customDecode.decision.fallbackRequired,
              fallbackReason: customDecode.decision.fallbackReason,
              reasons: [...customDecode.decision.reasons],
              notes: [...customDecode.decision.notes],
            },
      notes: [...customDecode.notes],
    };
  }

  /**
   * @brief Clone one shared audio-policy decision for thumbnail debug state
   *
   * @param audioPolicyDecision - Audio-policy decision to clone
   *
   * @returns Cloned audio-policy decision
   */
  private cloneAudioPolicyDecision(
    audioPolicyDecision: AudioPolicyDecision,
  ): AudioPolicyDecision {
    return {
      audioMode: audioPolicyDecision.audioMode,
      fallbackMode: audioPolicyDecision.fallbackMode,
      requestedPremiumAttempt: audioPolicyDecision.requestedPremiumAttempt,
      usedFallback: audioPolicyDecision.usedFallback,
      trackPolicy: {
        preferPremiumAudio: audioPolicyDecision.trackPolicy.preferPremiumAudio,
        preferDefaultTrack: audioPolicyDecision.trackPolicy.preferDefaultTrack,
        preferredLanguage: audioPolicyDecision.trackPolicy.preferredLanguage,
        preferredChannelLayout:
          audioPolicyDecision.trackPolicy.preferredChannelLayout,
        allowFallbackStereo:
          audioPolicyDecision.trackPolicy.allowFallbackStereo,
      },
      inventorySelectionReason: audioPolicyDecision.inventorySelectionReason,
      inventorySnapshot:
        audioPolicyDecision.inventorySnapshot === null
          ? null
          : MediaInventoryCloner.cloneSnapshot(
              audioPolicyDecision.inventorySnapshot,
            ),
      premiumCandidateAvailable: audioPolicyDecision.premiumCandidateAvailable,
      selectedAudioTrack: MediaInventoryCloner.cloneAudioTrackInfo(
        audioPolicyDecision.selectedAudioTrack,
      ),
      selectedTrackStrategy: audioPolicyDecision.selectedTrackStrategy,
      capabilityProfile:
        audioPolicyDecision.capabilityProfile === null
          ? null
          : {
              canPlayCommittedAudio:
                audioPolicyDecision.capabilityProfile.canPlayCommittedAudio,
              canAttemptPremiumAudio:
                audioPolicyDecision.capabilityProfile.canAttemptPremiumAudio,
              canFallbackStereo:
                audioPolicyDecision.capabilityProfile.canFallbackStereo,
              canKeepPreviewMuted:
                audioPolicyDecision.capabilityProfile.canKeepPreviewMuted,
              canKeepExtractionSilent:
                audioPolicyDecision.capabilityProfile.canKeepExtractionSilent,
            },
      committedPlaybackLane: audioPolicyDecision.committedPlaybackLane,
      reasons: [...audioPolicyDecision.reasons],
      reasonDetails: [...audioPolicyDecision.reasonDetails],
    };
  }

  /**
   * @brief Build the stable VFS artifact descriptor associated with one request
   *
   * @param request - Shared thumbnail request
   *
   * @returns Stable artifact descriptor
   */
  private createArtifactDescriptorForRequest(
    request: MediaThumbnailRequest,
  ): DerivedArtifactDescriptor {
    const artifactVariantKey: string = [
      request.qualityHint,
      request.extractionPolicy.qualityIntent,
      `${request.targetWidth ?? request.extractionPolicy.targetWidth ?? "auto"}x${request.targetHeight ?? request.extractionPolicy.targetHeight ?? "auto"}`,
      request.extractionPolicy.strategy,
      `${request.timeHintMs ?? "start"}`,
    ].join(":");

    return this.vfsController.createDerivedArtifactDescriptor(
      request.sourceDescriptor,
      "thumbnail-still",
      artifactVariantKey,
    );
  }

  /**
   * @brief Attempt to restore every pending entry from VFS before extraction
   *
   * Restoring the whole pending set first lets hero, focused, and first-row
   * browse items become ready from local storage before any expensive decode
   * work starts.
   *
   * @returns Number of pending requests satisfied from cached artifacts
   */
  private async restorePendingCachedThumbnailResults(): Promise<number> {
    const pendingSourceIds: string[] = this.getOrderedPendingSourceIds();
    let restoredCount: number = 0;

    for (const pendingSourceId of pendingSourceIds) {
      const cacheEntry: MediaThumbnailCacheEntry | undefined =
        this.cacheEntriesBySourceId.get(pendingSourceId);

      if (
        cacheEntry === undefined ||
        cacheEntry.request === null ||
        cacheEntry.state === "ready"
      ) {
        this.pendingSourceIds.delete(pendingSourceId);
        continue;
      }

      const restoredThumbnailResult: MediaThumbnailResult | null =
        await this.tryRestoreCachedThumbnailResult(cacheEntry.request);

      if (restoredThumbnailResult === null) {
        continue;
      }

      restoredCount += 1;
      this.telemetryController.recordEvent({
        domain: "thumbnail",
        kind: "cache-reused",
        occurredAtMs: Date.now(),
        sourceId: cacheEntry.request.sourceId,
        strategy: cacheEntry.request.extractionPolicy.strategy,
        latencyMs: 0,
        reason:
          "VFS restored an existing cached thumbnail artifact before extraction started.",
      });
      this.applyCompletedThumbnailResult(
        pendingSourceId,
        cacheEntry.request,
        restoredThumbnailResult,
      );
    }

    return restoredCount;
  }

  /**
   * @brief Return pending source identifiers in the shared extraction order
   *
   * @returns Deterministically ordered pending source identifiers
   */
  private getOrderedPendingSourceIds(): string[] {
    return [...this.pendingSourceIds.values()]
      .map(
        (sourceId: string): MediaThumbnailCacheEntry | null =>
          this.cacheEntriesBySourceId.get(sourceId) ?? null,
      )
      .filter(
        (
          cacheEntry: MediaThumbnailCacheEntry | null,
        ): cacheEntry is MediaThumbnailCacheEntry =>
          cacheEntry !== null &&
          cacheEntry.request !== null &&
          cacheEntry.state !== "ready" &&
          cacheEntry.state !== "unsupported",
      )
      .sort(
        (
          leftEntry: MediaThumbnailCacheEntry,
          rightEntry: MediaThumbnailCacheEntry,
        ): number => this.comparePendingEntries(leftEntry, rightEntry),
      )
      .map(
        (cacheEntry: MediaThumbnailCacheEntry): string =>
          cacheEntry.descriptor.sourceId,
      );
  }

  /**
   * @brief Resolve one reusable artifact using exact and same-source fallback keys
   *
   * The exact request key remains the preferred path. A broader same-source
   * scan is only used for startup-safe first-frame requests so we can reuse a
   * larger cached still across sessions without changing the chosen frame.
   *
   * @param request - Shared thumbnail request being restored
   *
   * @returns Matching VFS artifact result, or `null` when none is reusable
   */
  private async resolveReusableThumbnailArtifact(
    request: MediaThumbnailRequest,
  ): Promise<DerivedArtifactResult | null> {
    const artifactDescriptor: DerivedArtifactDescriptor =
      this.createArtifactDescriptorForRequest(request);
    const exactArtifactResult: DerivedArtifactResult =
      await this.vfsController.resolveDerivedArtifact(
        artifactDescriptor.artifactKey,
        "VFS had no previously extracted still for this thumbnail request.",
      );

    if (exactArtifactResult.entry !== null) {
      return exactArtifactResult;
    }

    if (!this.shouldAttemptSourceLevelRestoreFallback(request)) {
      return null;
    }

    const sourceArtifactPrefix: string = [
      "derived-artifact",
      request.sourceId,
      "thumbnail-still",
      "",
    ].join("|");
    const sourceArtifacts: DerivedArtifactEntry[] =
      await this.vfsController.listDerivedArtifactsByCacheKeyPrefix(
        sourceArtifactPrefix,
      );
    const reusableArtifact: DerivedArtifactEntry | null =
      this.selectReusableSourceArtifact(request, sourceArtifacts);

    if (reusableArtifact === null) {
      return null;
    }

    return {
      entry: reusableArtifact,
      lookupSteps: [
        ...exactArtifactResult.lookupSteps.map(
          (
            lookupStep: (typeof exactArtifactResult.lookupSteps)[number],
          ): (typeof exactArtifactResult.lookupSteps)[number] => ({
            ...lookupStep,
          }),
        ),
        {
          key: reusableArtifact.descriptor.artifactKey.cacheKey,
          layer:
            reusableArtifact.tier === "persistent"
              ? "disk-persistent"
              : "memory-hot",
          outcome: "hit",
          requestUrl: request.sourceDescriptor.url,
          detail:
            "VFS reused a previously stored same-source thumbnail artifact whose still was already suitable for this request.",
          recordedAt: Date.now(),
        },
      ],
      resolvedLayer:
        reusableArtifact.tier === "persistent"
          ? "disk-persistent"
          : "memory-hot",
      fallbackReason:
        "VFS reused a same-source cached thumbnail artifact after the exact request key missed.",
    };
  }

  /**
   * @brief Decide whether a request can safely reuse same-source still variants
   *
   * @param request - Shared thumbnail request being evaluated
   *
   * @returns `true` when broader same-source reuse is still image-correct
   */
  private shouldAttemptSourceLevelRestoreFallback(
    request: MediaThumbnailRequest,
  ): boolean {
    return (
      request.extractionPolicy.strategy === "first-frame-fast-path" &&
      (request.timeHintMs ?? 0) === 0
    );
  }

  /**
   * @brief Pick the best reusable same-source artifact for one request
   *
   * @param request - Shared thumbnail request being restored
   * @param sourceArtifacts - Same-source thumbnail artifacts already in VFS
   *
   * @returns Best matching artifact, or `null` when none are safe to reuse
   */
  private selectReusableSourceArtifact(
    request: MediaThumbnailRequest,
    sourceArtifacts: readonly DerivedArtifactEntry[],
  ): DerivedArtifactEntry | null {
    const requestedWidth: number = Math.max(
      1,
      request.targetWidth ?? request.extractionPolicy.targetWidth ?? 1,
    );
    const requestedHeight: number = Math.max(
      1,
      request.targetHeight ?? request.extractionPolicy.targetHeight ?? 1,
    );
    const reusableArtifacts: DerivedArtifactEntry[] = sourceArtifacts
      .filter((artifactEntry: DerivedArtifactEntry): boolean =>
        this.isReusableSourceArtifact(
          artifactEntry,
          request,
          requestedWidth,
          requestedHeight,
        ),
      )
      .sort(
        (
          leftArtifact: DerivedArtifactEntry,
          rightArtifact: DerivedArtifactEntry,
        ): number =>
          this.compareReusableSourceArtifacts(leftArtifact, rightArtifact),
      );

    return reusableArtifacts[0] ?? null;
  }

  /**
   * @brief Check whether one same-source artifact is safe for reuse
   *
   * @param artifactEntry - Cached artifact being evaluated
   * @param request - Shared thumbnail request being restored
   * @param requestedWidth - Minimum acceptable output width
   * @param requestedHeight - Minimum acceptable output height
   *
   * @returns `true` when the artifact can satisfy the request without re-extracting
   */
  private isReusableSourceArtifact(
    artifactEntry: DerivedArtifactEntry,
    request: MediaThumbnailRequest,
    requestedWidth: number,
    requestedHeight: number,
  ): boolean {
    const artifactWidth: number = Number(artifactEntry.metadata.width ?? 0);
    const artifactHeight: number = Number(artifactEntry.metadata.height ?? 0);
    const strategyUsed: string = `${artifactEntry.metadata.strategyUsed ?? ""}`;
    const artifactFrameTimeMs: number | null =
      artifactEntry.metadata.frameTimeMs === null
        ? null
        : Number(artifactEntry.metadata.frameTimeMs ?? 0);

    if (artifactEntry.descriptor.artifactKind !== "thumbnail-still") {
      return false;
    }

    if (artifactEntry.descriptor.artifactKey.sourceId !== request.sourceId) {
      return false;
    }

    if (strategyUsed !== request.extractionPolicy.strategy) {
      return false;
    }

    if (
      (request.timeHintMs ?? 0) !== 0 ||
      (artifactFrameTimeMs !== null && artifactFrameTimeMs !== 0)
    ) {
      return false;
    }

    if (artifactWidth < requestedWidth) {
      return false;
    }

    if (artifactHeight < requestedHeight) {
      return false;
    }

    return artifactEntry.viewUrl !== null;
  }

  /**
   * @brief Compare reusable same-source artifacts so the strongest one wins
   *
   * @param leftArtifact - First candidate artifact
   * @param rightArtifact - Second candidate artifact
   *
   * @returns Sort order that prefers larger, newer, durable artifacts
   */
  private compareReusableSourceArtifacts(
    leftArtifact: DerivedArtifactEntry,
    rightArtifact: DerivedArtifactEntry,
  ): number {
    const leftArea: number =
      Number(leftArtifact.metadata.width ?? 0) *
      Math.max(1, Number(leftArtifact.metadata.height ?? 1));
    const rightArea: number =
      Number(rightArtifact.metadata.width ?? 0) *
      Math.max(1, Number(rightArtifact.metadata.height ?? 1));

    if (leftArea !== rightArea) {
      return rightArea - leftArea;
    }

    if (leftArtifact.updatedAt !== rightArtifact.updatedAt) {
      return rightArtifact.updatedAt - leftArtifact.updatedAt;
    }

    if (leftArtifact.tier !== rightArtifact.tier) {
      return leftArtifact.tier === "persistent" ? -1 : 1;
    }

    return leftArtifact.descriptor.artifactKey.cacheKey.localeCompare(
      rightArtifact.descriptor.artifactKey.cacheKey,
    );
  }
}
