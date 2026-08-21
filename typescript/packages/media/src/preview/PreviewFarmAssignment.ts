/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { PreviewFarmSessionState } from "./PreviewFarmSessionState";
import type { PreviewFarmTransitionReason } from "./PreviewFarmTransitionReason";

/**
 * @brief Mapping from one logical preview session into one farm or runtime slot
 */
export type PreviewFarmAssignment = {
  sessionId: string;
  itemId: string;
  slotId: string;
  warmState: PreviewFarmSessionState;
  sessionState: PreviewFarmSessionState;
  isActive: boolean;
  assignmentDomain: "preview-farm" | "runtime-execution";
  assignmentKind: "active-preview" | "warm-preview";
  rendererBound: boolean;
  rendererKind: MediaRendererKind | null;
  transitionReason: PreviewFarmTransitionReason | null;
};
