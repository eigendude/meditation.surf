/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared reasons used when thumbnail candidate frames are rejected
 */
export type MediaThumbnailFrameRejectionReason =
  | "black-frame"
  | "near-black-frame"
  | "fade-in-frame"
  | "decode-failed"
  | "timeout"
  | "unsupported";
