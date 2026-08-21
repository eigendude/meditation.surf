/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AudioExecutionSnapshot } from "../audio/AudioExecutionSnapshot";
import type { CommittedPlaybackDecision } from "../committed/CommittedPlaybackDecision";
import type { CustomDecodeSnapshot } from "../custom-decode/CustomDecodeSnapshot";
import type { RendererSnapshot } from "../rendering/RendererSnapshot";
import type { MediaExecutionState } from "./MediaExecutionState";
import type { MediaRuntimeSessionHandle } from "./MediaRuntimeSessionHandle";
import type { MediaStartupDebugState } from "./MediaStartupDebugState";

/**
 * @brief Result returned by a runtime adapter after one execution command
 */
export type MediaExecutionResult = {
  state: MediaExecutionState;
  runtimeSessionHandle: MediaRuntimeSessionHandle | null;
  committedPlaybackDecision: CommittedPlaybackDecision | null;
  audioExecution: AudioExecutionSnapshot | null;
  failureReason: string | null;
  startupDebugState: MediaStartupDebugState | null;
  customDecode: CustomDecodeSnapshot | null;
  renderer: RendererSnapshot | null;
};
