/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaIntentType } from "./MediaIntentType";

/**
 * @brief High-level logical media intent derived from browse or playback state
 */
export type MediaIntent = {
  targetItemId: string | null;
  type: MediaIntentType;
};
