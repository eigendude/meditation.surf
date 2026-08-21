/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Runtime lane-order hints used by committed playback selection
 */
export type CommittedPlaybackLanePreference =
  | "prefer-native"
  | "prefer-shaka"
  | "prefer-existing-runtime";
