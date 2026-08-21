/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { MediaSessionRole } from "../sessions/MediaSessionRole";
import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";

/**
 * @brief Shared inventory lookup request passed into runtime adapters
 */
export type MediaInventoryRequest = {
  sourceDescriptor: MediaSourceDescriptor | null;
  preferredPlaybackLane: MediaPlaybackLane | null;
  fallbackPlaybackLaneOrder: MediaPlaybackLane[];
  sessionRole: MediaSessionRole;
};
