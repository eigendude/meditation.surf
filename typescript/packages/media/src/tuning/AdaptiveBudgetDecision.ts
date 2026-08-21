/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PreviewFarmBudget } from "../preview/PreviewFarmBudget";
import type { AdaptiveBudgetDecisionReason } from "./AdaptiveBudgetDecisionReason";

/**
 * @brief Conservative runtime budget adjustment result
 */
export type AdaptiveBudgetDecision = {
  baseBudget: PreviewFarmBudget;
  effectiveBudget: PreviewFarmBudget;
  reasons: AdaptiveBudgetDecisionReason[];
  notes: string[];
  evaluatedAtMs: number | null;
};
