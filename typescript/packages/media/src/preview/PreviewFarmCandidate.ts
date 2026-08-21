/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";
import type { PreviewFarmCandidateRank } from "./PreviewFarmCandidateRank";
import type { PreviewFarmSessionState } from "./PreviewFarmSessionState";
import type { PreviewSchedulerDecisionReason } from "./PreviewSchedulerDecisionReason";

/**
 * @brief One logical preview target considered by the shared preview farm
 */
export type PreviewFarmCandidate = {
  candidateId: string;
  sessionId: string;
  itemId: string;
  source: MediaSourceDescriptor;
  rowIndex: number | null;
  itemIndex: number | null;
  reason: PreviewSchedulerDecisionReason;
  score: PreviewFarmCandidateRank;
  currentWarmState: PreviewFarmSessionState;
  focusStartedAtMs: number | null;
  lastFocusedAtMs: number | null;
  canReuseWarmSession: boolean;
  canUseCustomDecode: boolean;
  canUseWebGpuRenderer: boolean;
  canUseWebGlRenderer: boolean;
  mustUseLegacyPreviewPath: boolean;
  rendererRoutingSupported: boolean;
  preferredRendererKind: MediaRendererKind | null;
  requiresRendererBudget: boolean;
  notes: string[];
};
