/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { RendererBackendKind } from "./RendererBackendKind";
import type { RendererCapability } from "./RendererCapability";
import type { RendererDecision } from "./RendererDecision";
import type { RendererDecisionReason } from "./RendererDecisionReason";
import type { RendererFrameHandle } from "./RendererFrameHandle";
import type { RendererSessionBinding } from "./RendererSessionBinding";

/**
 * @brief Shared debug snapshot describing one routed or bypassed renderer path
 */
export type RendererSnapshot = {
  capability: RendererCapability | null;
  decision: RendererDecision | null;
  binding: RendererSessionBinding | null;
  selectedBackend: RendererBackendKind | null;
  activeBackend: RendererBackendKind | null;
  usedLegacyPath: boolean;
  bypassedRendererRouter: boolean;
  fallbackReason: string | null;
  failureReason: string | null;
  frameHandle: RendererFrameHandle | null;
  reasons: RendererDecisionReason[];
  notes: string[];
};
