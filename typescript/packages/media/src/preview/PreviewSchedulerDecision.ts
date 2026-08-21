/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { PreviewCandidateScore } from "./PreviewCandidateScore";
import type { PreviewEvictionReason } from "./PreviewEvictionReason";
import type { PreviewFarmTransitionReason } from "./PreviewFarmTransitionReason";
import type { PreviewSchedulerDecisionReason } from "./PreviewSchedulerDecisionReason";
import type { PreviewWarmState } from "./PreviewWarmState";

/**
 * @brief Deterministic scheduler decision recorded for one preview candidate
 */
export type PreviewSchedulerDecision = {
  candidateId: string;
  sessionId: string;
  itemId: string;
  score: PreviewCandidateScore;
  primaryReason: PreviewSchedulerDecisionReason;
  transitionReason: PreviewFarmTransitionReason | null;
  deferredReason: PreviewFarmTransitionReason | null;
  evictionReason: PreviewEvictionReason | null;
  targetWarmState: PreviewWarmState;
  shouldWarm: boolean;
  shouldActivate: boolean;
  shouldRetain: boolean;
  shouldReuse: boolean;
  shouldEvict: boolean;
  isDeferred: boolean;
  retainUntilMs: number | null;
  rendererBound: boolean;
  selectedRendererKind: MediaRendererKind | null;
  shouldAttemptCustomDecode: boolean;
  mustUseLegacyPreviewPath: boolean;
  notes: string[];
};
