/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaIntentType } from "../intent/MediaIntentType";

/**
 * @brief Runtime-agnostic committed playback intent built from selection state
 */
export type CommittedPlaybackIntent = {
  intentType: Extract<MediaIntentType, "selected" | "background-active">;
  selectedItemId: string | null;
  activeItemId: string | null;
  targetItemId: string | null;
  startPositionSeconds: number;
};
