/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VariantQualityTier } from "../variant-policy/VariantQualityTier";
import type { MediaThumbnailQualityIntent } from "./MediaThumbnailQualityIntent";

/**
 * @brief Shared thumbnail quality intent carried from browse orchestration to runtimes
 */
export type MediaThumbnailQuality = VariantQualityTier;

/**
 * @brief Shared thumbnail priority intent used to order pending extraction work
 */
export type MediaThumbnailPriority = "none" | "low" | "medium" | "high";

/**
 * @brief Conservative extraction strategies supported by the shared thumbnail system
 */
export type MediaThumbnailExtractionStrategy =
  | "first-frame-fast-path"
  | "representative-search-on-rejection"
  | "time-hint";

/**
 * @brief Stable fallback modes supported by the shared thumbnail selector
 */
export type MediaThumbnailFallbackBehavior =
  | "none"
  | "representative-search-then-first-decodable"
  | "first-decodable-only";

/**
 * @brief Runtime-agnostic thumbnail extraction policy
 */
export type MediaThumbnailExtractionPolicy = {
  strategy: MediaThumbnailExtractionStrategy;
  fallbackBehavior: MediaThumbnailFallbackBehavior;
  firstFrameFastPath: boolean;
  representativeSearchOnRejection: boolean;
  qualityIntent: MediaThumbnailQualityIntent;
  timeoutMs: number | null;
  targetWidth: number | null;
  targetHeight: number | null;
  targetTimeSeconds: number | null;
  searchWindowStartSeconds: number | null;
  searchWindowEndSeconds: number | null;
  candidateWindowMs: number;
  candidateFrameStepMs: number;
  maxCandidateFrames: number;
  maxAttemptCount: number;
  blackFrameThreshold: number;
  nearBlackFrameThreshold: number;
  fadeInFrameThreshold: number;
};
