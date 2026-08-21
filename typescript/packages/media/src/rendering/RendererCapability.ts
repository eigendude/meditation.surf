/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRuntimeSupportLevel } from "../capability-oracle/MediaRuntimeSupportLevel";
import type { VariantRolePolicy } from "../variant-policy/VariantRolePolicy";
import type { RendererDecisionReason } from "./RendererDecisionReason";

/**
 * @brief Inspectable renderer capability summary for one role-scoped session
 */
export type RendererCapability = {
  role: VariantRolePolicy;
  webgpuSupportLevel: MediaRuntimeSupportLevel;
  webglSupportLevel: MediaRuntimeSupportLevel;
  rendererRoutingSupportLevel: MediaRuntimeSupportLevel;
  rendererRoutingAllowed: boolean;
  committedPlaybackBypassesRendererRouter: boolean;
  reasons: RendererDecisionReason[];
  notes: string[];
};
