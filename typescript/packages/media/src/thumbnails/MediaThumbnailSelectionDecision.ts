/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaThumbnailCandidateFrame } from "./MediaThumbnailCandidateFrame";
import type {
  MediaThumbnailExtractionStrategy,
  MediaThumbnailFallbackBehavior,
} from "./MediaThumbnailExtractionPolicy";
import type { MediaThumbnailFrameRejectionReason } from "./MediaThumbnailFrameRejectionReason";
import type { MediaThumbnailQualityIntent } from "./MediaThumbnailQualityIntent";
import type { MediaThumbnailSelectionReason } from "./MediaThumbnailSelectionReason";

/**
 * @brief Inspectable shared selection outcome for one thumbnail extraction pass
 */
export type MediaThumbnailSelectionDecision = {
  requestedStrategy: MediaThumbnailExtractionStrategy;
  strategyUsed: MediaThumbnailExtractionStrategy;
  fallbackBehavior: MediaThumbnailFallbackBehavior;
  qualityIntent: MediaThumbnailQualityIntent;
  selectionReason: MediaThumbnailSelectionReason;
  resolvedReason: MediaThumbnailSelectionReason;
  firstFrameAccepted: boolean;
  firstFrameRejected: boolean;
  firstFrameRejectionReason: MediaThumbnailFrameRejectionReason | null;
  representativeSearchUsed: boolean;
  representativeTargetTimeMs: number | null;
  representativeWindowStartMs: number | null;
  representativeWindowEndMs: number | null;
  selectedFrameTimeMs: number | null;
  selectedCandidateIndex: number | null;
  attemptedFrameCount: number;
  rejectedFrameCount: number;
  fallbackUsed: boolean;
  cachedArtifactReused: boolean;
  rejectionReasons: MediaThumbnailFrameRejectionReason[];
  candidateFrames: MediaThumbnailCandidateFrame[];
};
