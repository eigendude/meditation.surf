/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Runtime-agnostic video variant metadata used by shared playback policy
 */
export type MediaVariantInfo = {
  id: string;
  width: number | null;
  height: number | null;
  bitrate: number | null;
  codec: string | null;
  frameRate: number | null;
  isDefault: boolean;
  isPremiumCandidate: boolean;
};
