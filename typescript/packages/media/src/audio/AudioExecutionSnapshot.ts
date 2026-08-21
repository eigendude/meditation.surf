/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AudioFallbackMode } from "./AudioFallbackMode";
import type { AudioMode } from "./AudioMode";
import type { AudioPolicyDecision } from "./AudioPolicyDecision";

/**
 * @brief Inspectable audio execution state reported per active media session
 */
export type AudioExecutionSnapshot = {
  requestedAudioMode: AudioMode;
  actualAudioMode: AudioMode;
  fallbackMode: AudioFallbackMode | null;
  premiumAttemptRequested: boolean;
  usedFallback: boolean;
  runtimeAcceptedRequestedMode: boolean | null;
  policyDecision: AudioPolicyDecision;
  runtimeReason: string | null;
};
