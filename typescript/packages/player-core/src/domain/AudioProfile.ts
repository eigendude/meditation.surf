/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Audio layout metadata for a playback source
 *
 * The player implementation can use this to describe or select streams.
 */
export type AudioProfile = "stereo" | "5.1" | "7.1" | "atmos";
