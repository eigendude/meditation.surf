/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AppMediaCapabilities } from "../capabilities/AppMediaCapabilities";
import type { MediaIntent } from "../intent/MediaIntent";
import type { MediaPlan } from "../planning/MediaPlan";
import type { MediaSessionSnapshot } from "../sessions/MediaSessionSnapshot";
import type { TelemetrySnapshot } from "../telemetry/TelemetrySnapshot";
import type { AdaptiveBudgetDecision } from "../tuning/AdaptiveBudgetDecision";
import type { RuntimeGuardrailState } from "../tuning/RuntimeGuardrailState";

/**
 * @brief Immutable shared snapshot published by the media kernel controller
 */
export type MediaKernelState = {
  activeItemId: string | null;
  adaptiveBudgetDecision: AdaptiveBudgetDecision;
  appCapabilities: AppMediaCapabilities[];
  currentIntent: MediaIntent | null;
  focusedItemId: string | null;
  plan: MediaPlan;
  runtimeGuardrailState: RuntimeGuardrailState;
  selectedItemId: string | null;
  sessions: MediaSessionSnapshot[];
  telemetry: TelemetrySnapshot;
};
