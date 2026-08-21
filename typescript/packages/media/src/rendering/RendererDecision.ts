/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VariantRolePolicy } from "../variant-policy/VariantRolePolicy";
import type { RendererBackendKind } from "./RendererBackendKind";
import type { RendererDecisionReason } from "./RendererDecisionReason";

/**
 * @brief Pure renderer routing decision derived from role and capability input
 */
export type RendererDecision = {
  role: VariantRolePolicy;
  shouldRouteThroughRenderer: boolean;
  bypassesRendererRouter: boolean;
  preferredBackendOrder: RendererBackendKind[];
  fallbackBackendOrder: RendererBackendKind[];
  selectedBackend: RendererBackendKind | null;
  fallbackRequired: boolean;
  fallbackReason: string | null;
  reasons: RendererDecisionReason[];
  notes: string[];
};
