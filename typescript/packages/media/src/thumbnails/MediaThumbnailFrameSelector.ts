/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaThumbnailCandidateFrame } from "./MediaThumbnailCandidateFrame";
import type { MediaThumbnailExtractionPolicy } from "./MediaThumbnailExtractionPolicy";
import type { MediaThumbnailFrameRejectionReason } from "./MediaThumbnailFrameRejectionReason";
import type { MediaThumbnailSelectionDecision } from "./MediaThumbnailSelectionDecision";
import type { MediaThumbnailSelectionReason } from "./MediaThumbnailSelectionReason";

/**
 * @brief Pure shared selector for deterministic thumbnail frame choices
 *
 * The selector now keeps the fast path explicit: try the first frame first,
 * then only search the representative window when that first frame is
 * unsuitable, and only then fall back to the first decodable frame.
 */
export class MediaThumbnailFrameSelector {
  /**
   * @brief Build the candidate frame times associated with one extraction policy
   *
   * @param extractionPolicy - Shared extraction policy being executed
   * @param timeHintMs - Optional external time hint requested by callers
   *
   * @returns Ordered frame times that the runtime may inspect
   */
  public static createCandidateFrameTimes(
    extractionPolicy: MediaThumbnailExtractionPolicy,
    timeHintMs: number | null,
  ): number[] {
    if (extractionPolicy.strategy === "time-hint") {
      return [Math.max(0, Math.round(timeHintMs ?? 0))];
    }

    const candidateFrameTimesMs: number[] = [];

    if (extractionPolicy.firstFrameFastPath) {
      candidateFrameTimesMs.push(0);
    }

    if (extractionPolicy.representativeSearchOnRejection) {
      candidateFrameTimesMs.push(
        ...this.createRepresentativeCandidateFrameTimes(extractionPolicy),
      );
    }

    return this.deduplicateCandidateFrameTimes(candidateFrameTimesMs).slice(
      0,
      Math.max(1, extractionPolicy.maxAttemptCount),
    );
  }

  /**
   * @brief Select one thumbnail frame from bounded runtime-provided candidates
   *
   * @param extractionPolicy - Shared extraction policy being evaluated
   * @param candidateFrames - Candidate frames already inspected by the runtime
   *
   * @returns Immutable shared selection decision
   */
  public static selectCandidateFrame(
    extractionPolicy: MediaThumbnailExtractionPolicy,
    candidateFrames: readonly MediaThumbnailCandidateFrame[],
  ): MediaThumbnailSelectionDecision {
    const clonedCandidateFrames: MediaThumbnailCandidateFrame[] =
      candidateFrames.map(
        (
          candidateFrame: MediaThumbnailCandidateFrame,
        ): MediaThumbnailCandidateFrame =>
          this.cloneCandidateFrame(candidateFrame),
      );
    const firstFrameCandidateIndex: number = clonedCandidateFrames.findIndex(
      (candidateFrame: MediaThumbnailCandidateFrame): boolean =>
        candidateFrame.stage === "first-frame",
    );

    let firstDecodableCandidateIndex: number | null = null;

    for (const [
      candidateIndex,
      candidateFrame,
    ] of clonedCandidateFrames.entries()) {
      if (candidateFrame.isDecodable && firstDecodableCandidateIndex === null) {
        firstDecodableCandidateIndex = candidateIndex;
      }

      candidateFrame.rejectionReason = this.getRejectionReason(
        extractionPolicy,
        candidateFrame,
      );
    }

    if (extractionPolicy.strategy === "time-hint") {
      const selectedTimeHintCandidateIndex: number =
        firstDecodableCandidateIndex ?? -1;

      return this.createSelectionDecision(
        extractionPolicy,
        clonedCandidateFrames,
        selectedTimeHintCandidateIndex < 0
          ? "fallback-first-decodable"
          : "first-frame-accepted",
        selectedTimeHintCandidateIndex < 0
          ? null
          : selectedTimeHintCandidateIndex,
        false,
        "time-hint",
      );
    }

    if (
      firstFrameCandidateIndex >= 0 &&
      clonedCandidateFrames[firstFrameCandidateIndex]?.rejectionReason === null
    ) {
      return this.createSelectionDecision(
        extractionPolicy,
        clonedCandidateFrames,
        "first-frame-accepted",
        firstFrameCandidateIndex,
        false,
        "first-frame-fast-path",
      );
    }

    if (extractionPolicy.representativeSearchOnRejection) {
      for (const [
        candidateIndex,
        candidateFrame,
      ] of clonedCandidateFrames.entries()) {
        if (candidateFrame.stage !== "representative-search") {
          continue;
        }

        if (candidateFrame.rejectionReason !== null) {
          continue;
        }

        return this.createSelectionDecision(
          extractionPolicy,
          clonedCandidateFrames,
          "representative-frame-selected",
          candidateIndex,
          false,
          "representative-search-on-rejection",
        );
      }
    }

    if (firstDecodableCandidateIndex !== null) {
      const fallbackSelectionReason: MediaThumbnailSelectionReason =
        extractionPolicy.qualityIntent === "low"
          ? "fallback-low-quality"
          : "fallback-first-decodable";

      return this.createSelectionDecision(
        extractionPolicy,
        clonedCandidateFrames,
        fallbackSelectionReason,
        firstDecodableCandidateIndex,
        true,
        extractionPolicy.representativeSearchOnRejection
          ? "representative-search-on-rejection"
          : "first-frame-fast-path",
      );
    }

    return this.createSelectionDecision(
      extractionPolicy,
      clonedCandidateFrames,
      "fallback-first-decodable",
      null,
      true,
      extractionPolicy.representativeSearchOnRejection
        ? "representative-search-on-rejection"
        : "first-frame-fast-path",
    );
  }

  /**
   * @brief Build a bounded candidate list centered on the representative target
   *
   * @param extractionPolicy - Shared policy carrying target and window bounds
   *
   * @returns Ordered representative candidate frame times in milliseconds
   */
  private static createRepresentativeCandidateFrameTimes(
    extractionPolicy: MediaThumbnailExtractionPolicy,
  ): number[] {
    const targetTimeMs: number = Math.max(
      0,
      Math.round((extractionPolicy.targetTimeSeconds ?? 0) * 1000),
    );
    const windowStartMs: number = Math.max(
      0,
      Math.round((extractionPolicy.searchWindowStartSeconds ?? 0) * 1000),
    );
    const windowEndMs: number = Math.max(
      windowStartMs,
      Math.round((extractionPolicy.searchWindowEndSeconds ?? 0) * 1000),
    );
    const boundedTargetTimeMs: number = Math.min(
      windowEndMs,
      Math.max(windowStartMs, targetTimeMs),
    );
    const boundedStepMs: number = Math.max(
      1,
      extractionPolicy.candidateFrameStepMs,
    );
    const maxCandidateFrames: number = Math.max(
      1,
      extractionPolicy.maxCandidateFrames,
    );
    const candidateFrameTimesMs: number[] = [boundedTargetTimeMs];

    for (
      let offsetIndex: number = 1;
      candidateFrameTimesMs.length < maxCandidateFrames;
      offsetIndex += 1
    ) {
      const negativeCandidateTimeMs: number =
        boundedTargetTimeMs - offsetIndex * boundedStepMs;
      const positiveCandidateTimeMs: number =
        boundedTargetTimeMs + offsetIndex * boundedStepMs;

      if (negativeCandidateTimeMs >= windowStartMs) {
        candidateFrameTimesMs.push(negativeCandidateTimeMs);
      }

      if (
        candidateFrameTimesMs.length < maxCandidateFrames &&
        positiveCandidateTimeMs <= windowEndMs
      ) {
        candidateFrameTimesMs.push(positiveCandidateTimeMs);
      }

      if (
        negativeCandidateTimeMs < windowStartMs &&
        positiveCandidateTimeMs > windowEndMs
      ) {
        break;
      }
    }

    return candidateFrameTimesMs;
  }

  /**
   * @brief Decide whether one candidate frame should be rejected
   *
   * @param extractionPolicy - Shared extraction policy supplying thresholds
   * @param candidateFrame - Candidate frame being evaluated
   *
   * @returns Rejection reason, or `null` when the candidate is acceptable
   */
  private static getRejectionReason(
    extractionPolicy: MediaThumbnailExtractionPolicy,
    candidateFrame: MediaThumbnailCandidateFrame,
  ): MediaThumbnailFrameRejectionReason | null {
    if (!candidateFrame.isDecodable) {
      return candidateFrame.rejectionReason ?? "decode-failed";
    }

    const averageLuma: number = candidateFrame.averageLuma ?? 0;
    const brightestSampleLuma: number = candidateFrame.brightestSampleLuma ?? 0;
    const darkPixelRatio: number = candidateFrame.darkPixelRatio ?? 1;
    const blackFrameThreshold: number = extractionPolicy.blackFrameThreshold;
    const nearBlackFrameThreshold: number =
      extractionPolicy.nearBlackFrameThreshold;
    const fadeInFrameThreshold: number = extractionPolicy.fadeInFrameThreshold;

    if (
      averageLuma <= blackFrameThreshold ||
      brightestSampleLuma <= blackFrameThreshold
    ) {
      return "black-frame";
    }

    if (
      averageLuma <= fadeInFrameThreshold &&
      darkPixelRatio >= 0.75 &&
      brightestSampleLuma > nearBlackFrameThreshold
    ) {
      return "fade-in-frame";
    }

    if (averageLuma <= nearBlackFrameThreshold || darkPixelRatio >= 0.96) {
      return "near-black-frame";
    }

    return null;
  }

  /**
   * @brief Create one immutable selection decision
   *
   * @param extractionPolicy - Shared extraction policy being reported
   * @param candidateFrames - Candidate frames included in the decision
   * @param selectionReason - Selection reason chosen for the decision
   * @param selectedCandidateIndex - Optional chosen candidate index
   * @param fallbackUsed - Whether the final choice was a fallback
   * @param strategyUsed - Concrete strategy that produced the final outcome
   *
   * @returns Immutable shared selection decision
   */
  private static createSelectionDecision(
    extractionPolicy: MediaThumbnailExtractionPolicy,
    candidateFrames: MediaThumbnailCandidateFrame[],
    selectionReason: MediaThumbnailSelectionReason,
    selectedCandidateIndex: number | null,
    fallbackUsed: boolean,
    strategyUsed: MediaThumbnailSelectionDecision["strategyUsed"],
  ): MediaThumbnailSelectionDecision {
    const firstFrameCandidate: MediaThumbnailCandidateFrame | undefined =
      candidateFrames.find(
        (candidateFrame: MediaThumbnailCandidateFrame): boolean =>
          candidateFrame.stage === "first-frame",
      );
    const rejectionReasons: MediaThumbnailFrameRejectionReason[] =
      candidateFrames.flatMap(
        (
          candidateFrame: MediaThumbnailCandidateFrame,
        ): MediaThumbnailFrameRejectionReason[] =>
          candidateFrame.rejectionReason === null
            ? []
            : [candidateFrame.rejectionReason],
      );

    return {
      requestedStrategy: extractionPolicy.strategy,
      strategyUsed,
      fallbackBehavior: extractionPolicy.fallbackBehavior,
      qualityIntent: extractionPolicy.qualityIntent,
      selectionReason,
      resolvedReason: selectionReason,
      firstFrameAccepted: firstFrameCandidate?.rejectionReason === null,
      firstFrameRejected:
        (firstFrameCandidate?.rejectionReason ?? null) !== null,
      firstFrameRejectionReason: firstFrameCandidate?.rejectionReason ?? null,
      representativeSearchUsed:
        extractionPolicy.representativeSearchOnRejection &&
        candidateFrames.some(
          (candidateFrame: MediaThumbnailCandidateFrame): boolean =>
            candidateFrame.stage === "representative-search",
        ),
      representativeTargetTimeMs:
        extractionPolicy.targetTimeSeconds === null
          ? null
          : Math.round(extractionPolicy.targetTimeSeconds * 1000),
      representativeWindowStartMs:
        extractionPolicy.searchWindowStartSeconds === null
          ? null
          : Math.round(extractionPolicy.searchWindowStartSeconds * 1000),
      representativeWindowEndMs:
        extractionPolicy.searchWindowEndSeconds === null
          ? null
          : Math.round(extractionPolicy.searchWindowEndSeconds * 1000),
      selectedFrameTimeMs:
        selectedCandidateIndex === null
          ? null
          : (candidateFrames[selectedCandidateIndex]?.frameTimeMs ?? null),
      selectedCandidateIndex,
      attemptedFrameCount: candidateFrames.length,
      rejectedFrameCount: rejectionReasons.length,
      fallbackUsed,
      cachedArtifactReused: false,
      rejectionReasons,
      candidateFrames,
    };
  }

  /**
   * @brief Deduplicate candidate frame times while preserving order
   *
   * @param candidateFrameTimesMs - Candidate frame times to normalize
   *
   * @returns Deduplicated frame times
   */
  private static deduplicateCandidateFrameTimes(
    candidateFrameTimesMs: number[],
  ): number[] {
    const deduplicatedCandidateFrameTimesMs: number[] = [];

    for (const candidateFrameTimeMs of candidateFrameTimesMs) {
      if (deduplicatedCandidateFrameTimesMs.includes(candidateFrameTimeMs)) {
        continue;
      }

      deduplicatedCandidateFrameTimesMs.push(candidateFrameTimeMs);
    }

    return deduplicatedCandidateFrameTimesMs;
  }

  /**
   * @brief Clone one runtime-provided candidate frame into shared immutable state
   *
   * @param candidateFrame - Candidate frame being cloned
   *
   * @returns Cloned candidate frame
   */
  private static cloneCandidateFrame(
    candidateFrame: MediaThumbnailCandidateFrame,
  ): MediaThumbnailCandidateFrame {
    return {
      attemptIndex: candidateFrame.attemptIndex,
      stage: candidateFrame.stage,
      requestedFrameTimeMs: candidateFrame.requestedFrameTimeMs,
      frameTimeMs: candidateFrame.frameTimeMs,
      averageLuma: candidateFrame.averageLuma,
      darkestSampleLuma: candidateFrame.darkestSampleLuma,
      brightestSampleLuma: candidateFrame.brightestSampleLuma,
      darkPixelRatio: candidateFrame.darkPixelRatio,
      isDecodable: candidateFrame.isDecodable,
      rejectionReason: candidateFrame.rejectionReason,
    };
  }
}
