/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaTelemetryEvent } from "./MediaTelemetryEvent";
import type { TelemetryCounters } from "./TelemetryCounters";
import type { TelemetryRollingWindow } from "./TelemetryRollingWindow";
import type { TelemetrySnapshot } from "./TelemetrySnapshot";

/**
 * @brief Fully local in-memory media telemetry collector with bounded history
 */
export class MediaTelemetryController {
  private static readonly DEFAULT_HISTORY_LIMIT: number = 200;
  private static readonly DEFAULT_WINDOW_DURATION_MS: number = 60000;

  private readonly historyLimit: number;
  private readonly windowDurationMs: number;
  private readonly events: MediaTelemetryEvent[];

  private counters: TelemetryCounters;
  private lastUpdatedAtMs: number | null;

  /**
   * @brief Build the telemetry collector with conservative bounded memory
   *
   * @param historyLimit - Maximum recent events to retain
   * @param windowDurationMs - Rolling summary window duration
   */
  public constructor(
    historyLimit: number = MediaTelemetryController.DEFAULT_HISTORY_LIMIT,
    windowDurationMs: number = MediaTelemetryController.DEFAULT_WINDOW_DURATION_MS,
  ) {
    this.historyLimit = historyLimit;
    this.windowDurationMs = windowDurationMs;
    this.events = [];
    this.counters = MediaTelemetryController.createEmptyCounters();
    this.lastUpdatedAtMs = null;
  }

  /**
   * @brief Record one structured local telemetry event
   *
   * @param event - Immutable event payload to append
   */
  public recordEvent(event: MediaTelemetryEvent): void {
    this.events.push(MediaTelemetryController.cloneEvent(event));

    while (this.events.length > this.historyLimit) {
      this.events.shift();
    }

    this.lastUpdatedAtMs = event.occurredAtMs;
    this.counters = this.reduceCounters(this.counters, event);
  }

  /**
   * @brief Return the current immutable telemetry snapshot
   *
   * @returns Cloned counters, rolling summary, and bounded recent history
   */
  public getSnapshot(): TelemetrySnapshot {
    const rollingWindow: TelemetryRollingWindow = this.createRollingWindow(
      this.lastUpdatedAtMs ?? Date.now(),
    );

    return {
      counters: {
        ...this.counters,
      },
      rollingWindow,
      lastUpdatedAtMs: this.lastUpdatedAtMs,
      historyLimit: this.historyLimit,
      windowDurationMs: this.windowDurationMs,
      recentEvents: this.events.map(
        (event: MediaTelemetryEvent): MediaTelemetryEvent =>
          MediaTelemetryController.cloneEvent(event),
      ),
    };
  }

  /**
   * @brief Clear recent state for a fresh runtime session
   */
  public reset(): void {
    this.events.splice(0, this.events.length);
    this.counters = MediaTelemetryController.createEmptyCounters();
    this.lastUpdatedAtMs = null;
  }

  /**
   * @brief Create one empty immutable telemetry snapshot
   *
   * @returns Empty snapshot for startup and unsupported runtimes
   */
  public static createEmptySnapshot(): TelemetrySnapshot {
    const controller: MediaTelemetryController = new MediaTelemetryController();

    return controller.getSnapshot();
  }

  /**
   * @brief Create zeroed counters
   *
   * @returns Empty counters
   */
  private static createEmptyCounters(): TelemetryCounters {
    return {
      totalEvents: 0,
      previewWarmRequested: 0,
      previewWarmCompleted: 0,
      previewWarmReused: 0,
      previewActivationSuccess: 0,
      previewActivationFailure: 0,
      previewReuseHit: 0,
      previewReuseMiss: 0,
      previewEvictions: 0,
      thumbnailExtractionSuccess: 0,
      thumbnailExtractionFailure: 0,
      thumbnailCacheReused: 0,
      rendererRouteSuccess: 0,
      rendererRouteFallback: 0,
      rendererRouteFailure: 0,
      customDecodeUsed: 0,
      customDecodeFallback: 0,
      customDecodeFailed: 0,
      startupArtifactHits: 0,
      startupArtifactMisses: 0,
      startupMemoryHotUsage: 0,
      startupDiskUsage: 0,
      startupServiceWorkerUsage: 0,
      startupNetworkUsage: 0,
    };
  }

  /**
   * @brief Clone one event for immutable storage or output
   *
   * @param event - Event being cloned
   *
   * @returns Cloned telemetry event
   */
  private static cloneEvent(event: MediaTelemetryEvent): MediaTelemetryEvent {
    return {
      ...event,
    } as MediaTelemetryEvent;
  }

  /**
   * @brief Apply one event to the monotonic counters
   *
   * @param counters - Existing counters
   * @param event - Event being applied
   *
   * @returns Next counters
   */
  private reduceCounters(
    counters: TelemetryCounters,
    event: MediaTelemetryEvent,
  ): TelemetryCounters {
    const nextCounters: TelemetryCounters = {
      ...counters,
      totalEvents: counters.totalEvents + 1,
    };

    switch (event.domain) {
      case "preview":
        switch (event.kind) {
          case "warm-requested":
            nextCounters.previewWarmRequested += 1;
            break;
          case "warm-completed":
            nextCounters.previewWarmCompleted += 1;
            break;
          case "warm-reused":
            nextCounters.previewWarmReused += 1;
            break;
          case "activation-success":
            nextCounters.previewActivationSuccess += 1;
            break;
          case "activation-failure":
            nextCounters.previewActivationFailure += 1;
            break;
          case "reuse-hit":
            nextCounters.previewReuseHit += 1;
            break;
          case "reuse-miss":
            nextCounters.previewReuseMiss += 1;
            break;
          case "evicted":
            nextCounters.previewEvictions += 1;
            break;
        }
        break;
      case "thumbnail":
        switch (event.kind) {
          case "extraction-success":
            nextCounters.thumbnailExtractionSuccess += 1;
            break;
          case "extraction-failure":
            nextCounters.thumbnailExtractionFailure += 1;
            break;
          case "cache-reused":
            nextCounters.thumbnailCacheReused += 1;
            break;
        }
        break;
      case "renderer":
        switch (event.kind) {
          case "route-success":
            nextCounters.rendererRouteSuccess += 1;
            break;
          case "route-fallback":
            nextCounters.rendererRouteFallback += 1;
            break;
          case "route-failure":
            nextCounters.rendererRouteFailure += 1;
            break;
        }
        break;
      case "custom-decode":
        switch (event.kind) {
          case "used":
            nextCounters.customDecodeUsed += 1;
            break;
          case "fallback":
            nextCounters.customDecodeFallback += 1;
            break;
          case "failed":
            nextCounters.customDecodeFailed += 1;
            break;
        }
        break;
      case "startup":
        if (event.hit) {
          nextCounters.startupArtifactHits += 1;
        } else {
          nextCounters.startupArtifactMisses += 1;
        }

        switch (event.path) {
          case "memory-hot":
            nextCounters.startupMemoryHotUsage += 1;
            break;
          case "disk-persistent":
            nextCounters.startupDiskUsage += 1;
            break;
          case "service-worker":
            nextCounters.startupServiceWorkerUsage += 1;
            break;
          case "network-origin":
            nextCounters.startupNetworkUsage += 1;
            break;
          case "none":
            break;
        }
        break;
    }

    return nextCounters;
  }

  /**
   * @brief Create the bounded rolling summary currently used by guardrails
   *
   * @param referenceNowMs - Reference timestamp used for the current window
   *
   * @returns Rolling-window summary
   */
  private createRollingWindow(referenceNowMs: number): TelemetryRollingWindow {
    const windowStartAtMs: number = referenceNowMs - this.windowDurationMs;
    const recentEvents: MediaTelemetryEvent[] = this.events.filter(
      (event: MediaTelemetryEvent): boolean =>
        event.occurredAtMs >= windowStartAtMs,
    );
    let previewStartupLatencyTotalMs: number = 0;
    let previewStartupLatencySampleCount: number = 0;
    let thumbnailLatencyTotalMs: number = 0;
    let thumbnailLatencySampleCount: number = 0;
    const rollingWindow: TelemetryRollingWindow = {
      windowStartAtMs,
      windowEndAtMs: referenceNowMs,
      eventCount: recentEvents.length,
      preview: {
        warmRequested: 0,
        warmCompleted: 0,
        warmReused: 0,
        activationSuccess: 0,
        activationFailure: 0,
        reuseHit: 0,
        reuseMiss: 0,
        evictions: 0,
        startupLatencyAverageMs: null,
      },
      thumbnail: {
        extractionSuccess: 0,
        extractionFailure: 0,
        cacheReused: 0,
        extractionLatencyAverageMs: null,
      },
      renderer: {
        webgpuSuccess: 0,
        webgpuFailure: 0,
        webglSuccess: 0,
        webglFailure: 0,
        legacyFallbacks: 0,
        previewRouteSuccess: 0,
        previewRouteFailure: 0,
        thumbnailRouteSuccess: 0,
        thumbnailRouteFailure: 0,
      },
      customDecode: {
        success: 0,
        fallback: 0,
        failure: 0,
        previewSuccess: 0,
        previewFailure: 0,
        thumbnailSuccess: 0,
        thumbnailFailure: 0,
      },
      startup: {
        memoryHotHits: 0,
        diskHits: 0,
        serviceWorkerHits: 0,
        networkHits: 0,
        misses: 0,
      },
      recentEvents: recentEvents.map(
        (event: MediaTelemetryEvent): MediaTelemetryEvent =>
          MediaTelemetryController.cloneEvent(event),
      ),
    };

    for (const event of recentEvents) {
      switch (event.domain) {
        case "preview":
          switch (event.kind) {
            case "warm-requested":
              rollingWindow.preview.warmRequested += 1;
              break;
            case "warm-completed":
              rollingWindow.preview.warmCompleted += 1;
              if (event.latencyMs !== null) {
                previewStartupLatencyTotalMs += event.latencyMs;
                previewStartupLatencySampleCount += 1;
              }
              break;
            case "warm-reused":
              rollingWindow.preview.warmReused += 1;
              break;
            case "activation-success":
              rollingWindow.preview.activationSuccess += 1;
              break;
            case "activation-failure":
              rollingWindow.preview.activationFailure += 1;
              break;
            case "reuse-hit":
              rollingWindow.preview.reuseHit += 1;
              break;
            case "reuse-miss":
              rollingWindow.preview.reuseMiss += 1;
              break;
            case "evicted":
              rollingWindow.preview.evictions += 1;
              break;
          }
          break;
        case "thumbnail":
          switch (event.kind) {
            case "extraction-success":
              rollingWindow.thumbnail.extractionSuccess += 1;
              if (event.latencyMs !== null) {
                thumbnailLatencyTotalMs += event.latencyMs;
                thumbnailLatencySampleCount += 1;
              }
              break;
            case "extraction-failure":
              rollingWindow.thumbnail.extractionFailure += 1;
              break;
            case "cache-reused":
              rollingWindow.thumbnail.cacheReused += 1;
              break;
          }
          break;
        case "renderer":
          if (event.backend === "webgpu") {
            if (event.kind === "route-success") {
              rollingWindow.renderer.webgpuSuccess += 1;
            } else {
              rollingWindow.renderer.webgpuFailure += 1;
            }
          } else if (event.backend === "webgl") {
            if (event.kind === "route-success") {
              rollingWindow.renderer.webglSuccess += 1;
            } else {
              rollingWindow.renderer.webglFailure += 1;
            }
          } else if (event.backend === "legacy") {
            rollingWindow.renderer.legacyFallbacks += 1;
          }

          if (event.target === "preview") {
            if (event.kind === "route-success") {
              rollingWindow.renderer.previewRouteSuccess += 1;
            } else {
              rollingWindow.renderer.previewRouteFailure += 1;
            }
          } else if (event.target === "thumbnail") {
            if (event.kind === "route-success") {
              rollingWindow.renderer.thumbnailRouteSuccess += 1;
            } else {
              rollingWindow.renderer.thumbnailRouteFailure += 1;
            }
          }
          break;
        case "custom-decode":
          switch (event.kind) {
            case "used":
              rollingWindow.customDecode.success += 1;
              break;
            case "fallback":
              rollingWindow.customDecode.fallback += 1;
              break;
            case "failed":
              rollingWindow.customDecode.failure += 1;
              break;
          }

          if (event.lane?.startsWith("preview") === true) {
            if (event.kind === "used") {
              rollingWindow.customDecode.previewSuccess += 1;
            }

            if (event.kind === "failed") {
              rollingWindow.customDecode.previewFailure += 1;
            }
          } else if (event.lane === "thumbnail-extraction") {
            if (event.kind === "used") {
              rollingWindow.customDecode.thumbnailSuccess += 1;
            }

            if (event.kind === "failed") {
              rollingWindow.customDecode.thumbnailFailure += 1;
            }
          }
          break;
        case "startup":
          if (!event.hit || event.path === "none") {
            rollingWindow.startup.misses += 1;
            break;
          }

          switch (event.path) {
            case "memory-hot":
              rollingWindow.startup.memoryHotHits += 1;
              break;
            case "disk-persistent":
              rollingWindow.startup.diskHits += 1;
              break;
            case "service-worker":
              rollingWindow.startup.serviceWorkerHits += 1;
              break;
            case "network-origin":
              rollingWindow.startup.networkHits += 1;
              break;
          }
          break;
      }
    }

    rollingWindow.preview.startupLatencyAverageMs =
      previewStartupLatencySampleCount > 0
        ? Math.round(
            previewStartupLatencyTotalMs / previewStartupLatencySampleCount,
          )
        : null;
    rollingWindow.thumbnail.extractionLatencyAverageMs =
      thumbnailLatencySampleCount > 0
        ? Math.round(thumbnailLatencyTotalMs / thumbnailLatencySampleCount)
        : null;

    return rollingWindow;
  }
}
