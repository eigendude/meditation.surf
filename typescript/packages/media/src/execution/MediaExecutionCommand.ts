/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AudioExecutionSnapshot } from "../audio/AudioExecutionSnapshot";
import type { AudioPolicyDecision } from "../audio/AudioPolicyDecision";
import type { CommittedPlaybackDecision } from "../committed/CommittedPlaybackDecision";
import type { MediaPlan } from "../planning/MediaPlan";
import type { MediaPlanSession } from "../planning/MediaPlanSession";
import type { MediaExecutionCommandType } from "./MediaExecutionCommandType";
import type { MediaExecutionSnapshot } from "./MediaExecutionSnapshot";
import type { MediaRuntimeSessionHandle } from "./MediaRuntimeSessionHandle";

/**
 * @brief Shared runtime command built from the latest media plan
 */
export type MediaExecutionCommand = {
  type: MediaExecutionCommandType;
  plan: MediaPlan;
  session: MediaPlanSession | null;
  snapshot: MediaExecutionSnapshot | null;
  runtimeSessionHandle: MediaRuntimeSessionHandle | null;
  committedPlaybackDecision: CommittedPlaybackDecision | null;
  audioExecution: AudioExecutionSnapshot | null;
  audioPolicyDecision: AudioPolicyDecision | null;
};
