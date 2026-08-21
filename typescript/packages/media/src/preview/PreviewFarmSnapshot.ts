/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { TelemetrySnapshot } from "../telemetry/TelemetrySnapshot";
import type { AdaptiveBudgetDecision } from "../tuning/AdaptiveBudgetDecision";
import type { RuntimeGuardrailState } from "../tuning/RuntimeGuardrailState";
import type { PreviewFarmAssignment } from "./PreviewFarmAssignment";
import type { PreviewFarmBudget } from "./PreviewFarmBudget";
import type { PreviewFarmCandidate } from "./PreviewFarmCandidate";
import type { PreviewSchedulerDecision } from "./PreviewSchedulerDecision";

/**
 * @brief Complete preview-farm debug snapshot for one deterministic plan
 */
export type PreviewFarmSnapshot = {
  budget: PreviewFarmBudget;
  telemetry: TelemetrySnapshot;
  adaptiveBudgetDecision: AdaptiveBudgetDecision;
  runtimeGuardrailState: RuntimeGuardrailState;
  budgetUsage: {
    warmSessions: number;
    activePreviewSessions: number;
    hiddenSessions: number;
    rendererBoundSessions: number;
    coldCandidates: number;
    failedCandidates: number;
  };
  candidates: PreviewFarmCandidate[];
  decisions: PreviewSchedulerDecision[];
  sessionAssignments: PreviewFarmAssignment[];
  activeSessionIds: string[];
  warmedSessionIds: string[];
  retainedSessionIds: string[];
  reusedSessionIds: string[];
  rendererBoundSessionIds: string[];
  legacyPathSessionIds: string[];
  evictedSessionIds: string[];
  deferredSessionIds: string[];
  nextTransitionAtMs: number | null;
};
