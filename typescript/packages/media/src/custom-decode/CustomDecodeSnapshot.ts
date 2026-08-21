/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { RendererSnapshot } from "../rendering/RendererSnapshot";
import type { CustomDecodeCapability } from "./CustomDecodeCapability";
import type { CustomDecodeDecision } from "./CustomDecodeDecision";
import type { CustomDecodeFrameHandle } from "./CustomDecodeFrameHandle";
import type { CustomDecodeLane } from "./CustomDecodeLane";
import type { CustomDecodeSessionState } from "./CustomDecodeSessionState";

/**
 * @brief Shared debug snapshot for one custom decode attempt or session
 */
export type CustomDecodeSnapshot = {
  lane: CustomDecodeLane | null;
  state: CustomDecodeSessionState;
  usedCustomDecode: boolean;
  usedFallback: boolean;
  fallbackReason: string | null;
  failureReason: string | null;
  selectedFrame: CustomDecodeFrameHandle | null;
  renderer: RendererSnapshot | null;
  capability: CustomDecodeCapability | null;
  decision: CustomDecodeDecision | null;
  notes: string[];
};
