/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRuntimeSupportLevel } from "../capability-oracle/MediaRuntimeSupportLevel";
import type { CustomDecodeDecisionReason } from "./CustomDecodeDecisionReason";
import type { CustomDecodeLane } from "./CustomDecodeLane";

/**
 * @brief Inspectable capability snapshot for one role-scoped custom decode lane
 */
export type CustomDecodeCapability = {
  lane: CustomDecodeLane | null;
  allowedByRole: boolean;
  supportLevel: MediaRuntimeSupportLevel;
  webCodecsSupportLevel: MediaRuntimeSupportLevel;
  reasons: CustomDecodeDecisionReason[];
  notes: string[];
};
