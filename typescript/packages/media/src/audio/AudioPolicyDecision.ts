/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaAudioTrackInfo } from "../inventory/MediaAudioTrackInfo";
import type { MediaInventorySelectionReason } from "../inventory/MediaInventorySelectionReason";
import type { MediaInventorySnapshot } from "../inventory/MediaInventorySnapshot";
import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { AudioCapabilityProfile } from "./AudioCapabilityProfile";
import type { AudioFallbackMode } from "./AudioFallbackMode";
import type { AudioMode } from "./AudioMode";
import type { AudioPolicyDecisionReason } from "./AudioPolicyDecisionReason";
import type { AudioTrackPolicy } from "./AudioTrackPolicy";

/**
 * @brief Pure shared audio-policy output published to execution and debug state
 */
export type AudioPolicyDecision = {
  audioMode: AudioMode;
  fallbackMode: AudioFallbackMode | null;
  requestedPremiumAttempt: boolean;
  usedFallback: boolean;
  trackPolicy: AudioTrackPolicy;
  inventorySelectionReason: MediaInventorySelectionReason;
  inventorySnapshot: MediaInventorySnapshot | null;
  premiumCandidateAvailable: boolean | null;
  selectedAudioTrack: MediaAudioTrackInfo | null;
  selectedTrackStrategy:
    | "premium-candidate"
    | "default-track"
    | "fallback-stereo"
    | "no-track";
  capabilityProfile: AudioCapabilityProfile | null;
  committedPlaybackLane: MediaPlaybackLane | null;
  reasons: AudioPolicyDecisionReason[];
  reasonDetails: string[];
};
