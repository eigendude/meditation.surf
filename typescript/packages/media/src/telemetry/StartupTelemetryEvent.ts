/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Structured startup-acceleration telemetry event
 */
export type StartupTelemetryEvent = {
  domain: "startup";
  kind: "artifact-usage";
  occurredAtMs: number;
  phase: "preview-warm" | "committed-playback-startup";
  sourceId: string | null;
  path:
    | "memory-hot"
    | "disk-persistent"
    | "service-worker"
    | "network-origin"
    | "none";
  artifact: "manifest" | "init-segment" | "startup-window" | "hot-range";
  hit: boolean;
  reason: string | null;
};
