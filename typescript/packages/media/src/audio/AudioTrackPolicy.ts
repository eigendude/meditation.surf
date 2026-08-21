/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Conservative shared track preferences for committed playback audio
 */
export type AudioTrackPolicy = {
  preferPremiumAudio: boolean;
  preferDefaultTrack: boolean;
  preferredLanguage: string | null;
  preferredChannelLayout: string | null;
  allowFallbackStereo: boolean;
};
