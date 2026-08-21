/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PreviewSchedulerDecisionReason } from "./PreviewSchedulerDecisionReason";

/**
 * @brief Deterministic rank metadata attached to one preview-farm candidate
 */
export type PreviewFarmCandidateRank = {
  reason: PreviewSchedulerDecisionReason;
  baseValue: number;
  reuseBonus: number;
  rendererBonus: number;
  rendererPenalty: number;
  totalValue: number;
  notes: string[];
};
