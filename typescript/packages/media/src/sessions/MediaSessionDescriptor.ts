/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";
import type { MediaPlaybackLane } from "./MediaPlaybackLane";
import type { MediaRendererKind } from "./MediaRendererKind";
import type { MediaSessionRole } from "./MediaSessionRole";

/**
 * @brief Runtime-agnostic identity and routing metadata for one media session
 */
export type MediaSessionDescriptor = {
  sessionId: string;
  role: MediaSessionRole;
  itemId: string | null;
  source: MediaSourceDescriptor | null;
  playbackLane: MediaPlaybackLane | null;
  rendererKind: MediaRendererKind;
};
