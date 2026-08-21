/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AudioCapabilityProfile } from "../audio/AudioCapabilityProfile";
import type { CommittedPlaybackLanePreference } from "../committed/CommittedPlaybackLanePreference";
import type { CustomDecodeLane } from "../custom-decode/CustomDecodeLane";
import type { PreviewSchedulerBudget } from "../preview/PreviewSchedulerBudget";
import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";

/**
 * @brief Runtime execution features currently available in one app shell
 */
export type MediaRuntimeCapabilities = {
  canWarmFirstFrame: boolean;
  canActivateBackground: boolean;
  canPreviewInline: boolean;
  canKeepHiddenWarmSession: boolean;
  canPromoteWarmSession: boolean;
  canRunMultipleWarmSessions: boolean;
  supportsWebCodecs: boolean;
  supportsWebGpuRenderer: boolean;
  supportsWebGlRenderer: boolean;
  supportsRendererPreviewRouting: boolean;
  supportsRendererExtractionRouting: boolean;
  committedPlaybackBypassesRendererRouter: boolean;
  customDecodeLanes: CustomDecodeLane[];
  supportsCommittedPlayback: boolean;
  supportsPremiumCommittedPlayback: boolean;
  committedPlaybackLanePreference: CommittedPlaybackLanePreference;
  committedPlaybackLanes: MediaPlaybackLane[];
  existingBackgroundPlaybackLane: MediaPlaybackLane | null;
  previewSchedulerBudget: PreviewSchedulerBudget;
  audioCapabilities: AudioCapabilityProfile;
};
