/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Monotonic local counters derived from structured telemetry events
 */
export type TelemetryCounters = {
  totalEvents: number;
  previewWarmRequested: number;
  previewWarmCompleted: number;
  previewWarmReused: number;
  previewActivationSuccess: number;
  previewActivationFailure: number;
  previewReuseHit: number;
  previewReuseMiss: number;
  previewEvictions: number;
  thumbnailExtractionSuccess: number;
  thumbnailExtractionFailure: number;
  thumbnailCacheReused: number;
  rendererRouteSuccess: number;
  rendererRouteFallback: number;
  rendererRouteFailure: number;
  customDecodeUsed: number;
  customDecodeFallback: number;
  customDecodeFailed: number;
  startupArtifactHits: number;
  startupArtifactMisses: number;
  startupMemoryHotUsage: number;
  startupDiskUsage: number;
  startupServiceWorkerUsage: number;
  startupNetworkUsage: number;
};
