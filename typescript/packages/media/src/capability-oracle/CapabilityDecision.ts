/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { CapabilityDecisionReason } from "./CapabilityDecisionReason";
import type { MediaRuntimeSupportLevel } from "./MediaRuntimeSupportLevel";

/**
 * @brief Pure capability decision used to drive lane and renderer preference
 */
export type CapabilityDecision = {
  supportLevel: MediaRuntimeSupportLevel;
  preferredLaneOrder: MediaPlaybackLane[];
  preferredFallbackLaneOrder: MediaPlaybackLane[];
  preferredRendererOrder: MediaRendererKind[];
  premiumPlaybackViable: boolean;
  workerOffloadViable: boolean;
  reasons: CapabilityDecisionReason[];
  notes: string[];
};
