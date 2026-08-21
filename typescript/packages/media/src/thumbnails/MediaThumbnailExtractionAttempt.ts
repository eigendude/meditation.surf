/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CustomDecodeSnapshot } from "../custom-decode/CustomDecodeSnapshot";
import type {
  MediaThumbnailExtractionStrategy,
  MediaThumbnailFallbackBehavior,
} from "./MediaThumbnailExtractionPolicy";
import type { MediaThumbnailQualityIntent } from "./MediaThumbnailQualityIntent";

/**
 * @brief Shared summary of one bounded thumbnail extraction attempt
 */
export type MediaThumbnailExtractionAttempt = {
  requestedStrategy: MediaThumbnailExtractionStrategy;
  strategyUsed: MediaThumbnailExtractionStrategy;
  fallbackBehavior: MediaThumbnailFallbackBehavior;
  qualityIntent: MediaThumbnailQualityIntent;
  timeoutMs: number | null;
  firstFrameFastPath: boolean;
  representativeSearchOnRejection: boolean;
  targetTimeSeconds: number | null;
  searchWindowStartSeconds: number | null;
  searchWindowEndSeconds: number | null;
  candidateWindowMs: number;
  candidateFrameStepMs: number;
  maxCandidateFrames: number;
  maxAttemptCount: number;
  attemptedFrameCount: number;
  completedFrameCount: number;
  timedOut: boolean;
  unsupported: boolean;
  customDecode: CustomDecodeSnapshot | null;
  startedAt: number;
  finishedAt: number;
};
