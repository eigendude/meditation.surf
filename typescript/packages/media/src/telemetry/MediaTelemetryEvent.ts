/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CustomDecodeTelemetryEvent } from "./CustomDecodeTelemetryEvent";
import type { PreviewTelemetryEvent } from "./PreviewTelemetryEvent";
import type { RendererTelemetryEvent } from "./RendererTelemetryEvent";
import type { StartupTelemetryEvent } from "./StartupTelemetryEvent";
import type { ThumbnailTelemetryEvent } from "./ThumbnailTelemetryEvent";

/**
 * @brief Shared union for every structured local media telemetry event
 */
export type MediaTelemetryEvent =
  | PreviewTelemetryEvent
  | ThumbnailTelemetryEvent
  | RendererTelemetryEvent
  | CustomDecodeTelemetryEvent
  | StartupTelemetryEvent;
