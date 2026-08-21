/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Structured thumbnail-domain telemetry event
 */
export type ThumbnailTelemetryEvent = {
  domain: "thumbnail";
  kind: "extraction-success" | "extraction-failure" | "cache-reused";
  occurredAtMs: number;
  sourceId: string | null;
  strategy: string | null;
  latencyMs: number | null;
  reason: string | null;
};
