/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaThumbnailFrameRejectionReason } from "./MediaThumbnailFrameRejectionReason";

/**
 * @brief Inspectable shared description of one candidate frame evaluation
 */
export type MediaThumbnailCandidateFrame = {
  attemptIndex: number;
  stage: "first-frame" | "representative-search" | "time-hint";
  requestedFrameTimeMs: number | null;
  frameTimeMs: number | null;
  averageLuma: number | null;
  darkestSampleLuma: number | null;
  brightestSampleLuma: number | null;
  darkPixelRatio: number | null;
  isDecodable: boolean;
  rejectionReason: MediaThumbnailFrameRejectionReason | null;
};
