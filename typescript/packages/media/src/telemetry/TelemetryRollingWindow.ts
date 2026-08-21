/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaTelemetryEvent } from "./MediaTelemetryEvent";

/**
 * @brief Bounded recent-history summary used by adaptive tuning
 */
export type TelemetryRollingWindow = {
  windowStartAtMs: number | null;
  windowEndAtMs: number | null;
  eventCount: number;
  preview: {
    warmRequested: number;
    warmCompleted: number;
    warmReused: number;
    activationSuccess: number;
    activationFailure: number;
    reuseHit: number;
    reuseMiss: number;
    evictions: number;
    startupLatencyAverageMs: number | null;
  };
  thumbnail: {
    extractionSuccess: number;
    extractionFailure: number;
    cacheReused: number;
    extractionLatencyAverageMs: number | null;
  };
  renderer: {
    webgpuSuccess: number;
    webgpuFailure: number;
    webglSuccess: number;
    webglFailure: number;
    legacyFallbacks: number;
    previewRouteSuccess: number;
    previewRouteFailure: number;
    thumbnailRouteSuccess: number;
    thumbnailRouteFailure: number;
  };
  customDecode: {
    success: number;
    fallback: number;
    failure: number;
    previewSuccess: number;
    previewFailure: number;
    thumbnailSuccess: number;
    thumbnailFailure: number;
  };
  startup: {
    memoryHotHits: number;
    diskHits: number;
    serviceWorkerHits: number;
    networkHits: number;
    misses: number;
  };
  recentEvents: MediaTelemetryEvent[];
};
