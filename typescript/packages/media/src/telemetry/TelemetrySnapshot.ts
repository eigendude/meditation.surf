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

/**
 * @brief Immutable local media telemetry snapshot exposed for debugging
 */
export type TelemetrySnapshot = {
  counters: TelemetryCounters;
  rollingWindow: TelemetryRollingWindow;
  lastUpdatedAtMs: number | null;
  historyLimit: number;
  windowDurationMs: number;
  recentEvents: MediaTelemetryEvent[];
};
