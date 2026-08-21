/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CommittedPlaybackMode } from "../committed/CommittedPlaybackMode";
import type { MediaIntentType } from "../intent/MediaIntentType";
import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { MediaSessionRole } from "../sessions/MediaSessionRole";
import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";

/**
 * @brief Runtime-agnostic audio intent consumed by the pure audio policy layer
 */
export type AudioActivationIntent = {
  sessionRole: MediaSessionRole;
  committedPlaybackIntentType: Extract<
    MediaIntentType,
    "selected" | "background-active"
  > | null;
  committedPlaybackMode: CommittedPlaybackMode | null;
  committedPlaybackLane: MediaPlaybackLane | null;
  sourceDescriptor: MediaSourceDescriptor | null;
};
