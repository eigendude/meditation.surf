/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Runtime-agnostic audio track metadata used by shared playback policy
 */
export type MediaAudioTrackInfo = {
  id: string;
  language: string | null;
  channelLayout: string | null;
  channelCount: number | null;
  codec: string | null;
  isDefault: boolean;
  isPremiumCandidate: boolean;
};
