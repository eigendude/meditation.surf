/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CommittedPlaybackDecision } from "./CommittedPlaybackDecision";
import type { CommittedPlaybackIntent } from "./CommittedPlaybackIntent";
import type { CommittedPlaybackLifecycleState } from "./CommittedPlaybackLifecycleState";

/**
 * @brief Shared committed playback snapshot published for debug and execution
 */
export type CommittedPlaybackSnapshot = {
  itemId: string | null;
  selectedItemId: string | null;
  activeItemId: string | null;
  lifecycleState: CommittedPlaybackLifecycleState;
  intent: CommittedPlaybackIntent;
  decision: CommittedPlaybackDecision;
};
