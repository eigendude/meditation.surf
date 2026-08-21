/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CustomDecodeDecisionReason } from "./CustomDecodeDecisionReason";
import type { CustomDecodeLane } from "./CustomDecodeLane";

/**
 * @brief Shared decision describing whether one role should attempt custom decode
 */
export type CustomDecodeDecision = {
  lane: CustomDecodeLane | null;
  shouldAttempt: boolean;
  preferred: boolean;
  fallbackRequired: boolean;
  fallbackReason: string | null;
  reasons: CustomDecodeDecisionReason[];
  notes: string[];
};
