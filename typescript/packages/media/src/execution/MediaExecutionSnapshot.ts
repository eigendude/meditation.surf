/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AudioExecutionSnapshot } from "../audio/AudioExecutionSnapshot";
import type { CommittedPlaybackSnapshot } from "../committed/CommittedPlaybackSnapshot";
import type { CustomDecodeSnapshot } from "../custom-decode/CustomDecodeSnapshot";
import type { MediaPlanSession } from "../planning/MediaPlanSession";
import type { PreviewSessionAssignment } from "../preview/PreviewSessionAssignment";
import type { RendererSnapshot } from "../rendering/RendererSnapshot";
import type { MediaExecutionCommandType } from "./MediaExecutionCommandType";
import type { MediaExecutionState } from "./MediaExecutionState";
import type { MediaRuntimeSessionHandle } from "./MediaRuntimeSessionHandle";
import type { MediaStartupDebugState } from "./MediaStartupDebugState";

/**
 * @brief Read-only execution snapshot for one planned media session
 */
export type MediaExecutionSnapshot = {
  sessionId: string;
  planSession: MediaPlanSession | null;
  state: MediaExecutionState;
  runtimeSessionHandle: MediaRuntimeSessionHandle | null;
  previewSessionAssignment: PreviewSessionAssignment | null;
  committedPlayback: CommittedPlaybackSnapshot | null;
  audioExecution: AudioExecutionSnapshot | null;
  startupDebugState: MediaStartupDebugState | null;
  customDecode: CustomDecodeSnapshot | null;
  renderer: RendererSnapshot | null;
  lastCommandType: MediaExecutionCommandType | null;
  failureReason: string | null;
};
