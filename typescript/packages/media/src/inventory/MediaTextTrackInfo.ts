/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Runtime-agnostic text track metadata published for shared debug state
 */
export type MediaTextTrackInfo = {
  id: string;
  language: string | null;
  kind: string | null;
  label: string | null;
  codec: string | null;
  isDefault: boolean;
};
