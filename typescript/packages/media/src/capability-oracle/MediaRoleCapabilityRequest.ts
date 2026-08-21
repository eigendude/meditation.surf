/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaCapabilityProfile } from "../capabilities/MediaCapabilityProfile";
import type { CommittedPlaybackLanePreference } from "../committed/CommittedPlaybackLanePreference";
import type { MediaRuntimeCapabilities } from "../execution/MediaRuntimeCapabilities";
import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { VariantRolePolicy } from "../variant-policy/VariantRolePolicy";

/**
 * @brief Immutable capability-oracle request keyed by runtime profile and role
 */
export type MediaRoleCapabilityRequest = {
  role: VariantRolePolicy;
  appCapabilityProfile: MediaCapabilityProfile | null;
  runtimeCapabilities: MediaRuntimeCapabilities | null;
  preferredLaneHint: MediaPlaybackLane | null;
  preferredRendererKindHint: MediaRendererKind | null;
  existingChosenLane: MediaPlaybackLane | null;
  runtimeLanePreference: CommittedPlaybackLanePreference | null;
};
