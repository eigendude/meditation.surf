/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { AudioPolicy } from "../audio/AudioPolicy";
import type { AudioPolicyDecision } from "../audio/AudioPolicyDecision";
import type { AudioTrackPolicy } from "../audio/AudioTrackPolicy";
import type { MediaCapabilityProfile } from "../capabilities/MediaCapabilityProfile";
import { CapabilityOracle } from "../capability-oracle/CapabilityOracle";
import type { MediaRoleCapabilitySnapshot } from "../capability-oracle/MediaRoleCapabilitySnapshot";
import type { MediaExecutionSnapshot } from "../execution/MediaExecutionSnapshot";
import type { MediaRuntimeCapabilities } from "../execution/MediaRuntimeCapabilities";
import type { MediaAudioTrackInfo } from "../inventory/MediaAudioTrackInfo";
import { MediaInventoryCloner } from "../inventory/MediaInventoryCloner";
import type { MediaInventoryResult } from "../inventory/MediaInventoryResult";
import type { MediaInventorySelectionReason } from "../inventory/MediaInventorySelectionReason";
import type { MediaInventorySnapshot } from "../inventory/MediaInventorySnapshot";
import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";
import { VariantPolicy } from "../variant-policy/VariantPolicy";
import type { VariantSelectionDecision } from "../variant-policy/VariantSelectionDecision";
import type { AudioActivationMode } from "./AudioActivationMode";
import type { CommittedPlaybackDecision } from "./CommittedPlaybackDecision";
import type { CommittedPlaybackDecisionReason } from "./CommittedPlaybackDecisionReason";
import type { CommittedPlaybackIntent } from "./CommittedPlaybackIntent";
import type { CommittedPlaybackLanePreference } from "./CommittedPlaybackLanePreference";
import type { CommittedPlaybackMode } from "./CommittedPlaybackMode";

/**
 * @brief Immutable chooser inputs used for committed playback selection
 */
export type CommittedPlaybackChooserInput = {
  intent: CommittedPlaybackIntent;
  sourceDescriptor: MediaSourceDescriptor | null;
  appCapabilityProfile: MediaCapabilityProfile | null;
  runtimeCapabilities: MediaRuntimeCapabilities | null;
  currentExecutionSnapshot: MediaExecutionSnapshot | null;
  preferredLaneHint: MediaPlaybackLane | null;
  preferredRendererKindHint: MediaRendererKind | null;
  audioTrackPolicy: AudioTrackPolicy | null;
  inventoryResult: MediaInventoryResult | null;
};

/**
 * @brief Pure chooser for committed playback lane and committed audio policy
 */
export class CommittedPlaybackChooser {
  /**
   * @brief Pick the safest committed playback lane for the current runtime
   *
   * @param input - Immutable chooser inputs
   *
   * @returns Deterministic committed playback decision
   */
  public static choose(
    input: CommittedPlaybackChooserInput,
  ): CommittedPlaybackDecision {
    const runtimeCapabilities: MediaRuntimeCapabilities | null =
      input.runtimeCapabilities;
    const appCapabilityProfile: MediaCapabilityProfile | null =
      input.appCapabilityProfile;
    const audioTrackPolicy: AudioTrackPolicy =
      input.audioTrackPolicy ??
      AudioPolicy.createDefaultTrackPolicy("background");
    const lanePreference: CommittedPlaybackLanePreference | null =
      runtimeCapabilities?.committedPlaybackLanePreference ?? null;
    const existingChosenLane: MediaPlaybackLane | null =
      input.currentExecutionSnapshot?.committedPlayback?.decision.chosenLane ??
      null;
    const capabilitySnapshot: MediaRoleCapabilitySnapshot =
      CapabilityOracle.decide({
        role: "background-playback",
        appCapabilityProfile,
        runtimeCapabilities,
        preferredLaneHint: input.preferredLaneHint,
        preferredRendererKindHint: input.preferredRendererKindHint,
        existingChosenLane,
        runtimeLanePreference: lanePreference,
      });
    const inventoryResult: MediaInventoryResult | null =
      input.inventoryResult === null
        ? null
        : MediaInventoryCloner.cloneResult(input.inventoryResult);
    const inventorySnapshot: MediaInventorySnapshot | null =
      inventoryResult?.snapshot ?? null;
    const qualitySelection: VariantSelectionDecision = VariantPolicy.select({
      role: "background-playback",
      capabilitySnapshot,
      inventoryResult,
      maxWidth: null,
      maxHeight: null,
      maxBandwidth: null,
    });
    const inventorySelectionReason: MediaInventorySelectionReason =
      this.resolveInventorySelectionReason(inventorySnapshot);
    const premiumVideoCandidateAvailable: boolean | null =
      qualitySelection.premiumCandidateAvailable;
    const premiumAudioCandidateAvailable: boolean | null =
      this.resolvePremiumAudioCandidateAvailability(inventorySnapshot);
    const supportedLanes: MediaPlaybackLane[] = this.createSupportedLaneOrder(
      capabilitySnapshot,
      runtimeCapabilities,
      appCapabilityProfile,
    );
    const preferredLaneOrder: MediaPlaybackLane[] =
      capabilitySnapshot.decision.preferredLaneOrder.length > 0
        ? [...capabilitySnapshot.decision.preferredLaneOrder]
        : [...supportedLanes];
    const fallbackOrder: MediaPlaybackLane[] = this.createFallbackOrder(
      capabilitySnapshot,
      input.preferredLaneHint,
      runtimeCapabilities?.existingBackgroundPlaybackLane ?? null,
      existingChosenLane,
    );
    const preferredLane: MediaPlaybackLane | null =
      preferredLaneOrder[0] ?? null;
    const chosenLane: MediaPlaybackLane | null =
      [...preferredLaneOrder, ...fallbackOrder].find(
        (lane: MediaPlaybackLane): boolean => supportedLanes.includes(lane),
      ) ?? null;
    const usedFallbackLane: boolean =
      chosenLane !== null &&
      preferredLane !== null &&
      chosenLane !== preferredLane;
    const reasons: CommittedPlaybackDecisionReason[] = ["capability-oracle"];
    const reasonDetails: string[] = [...capabilitySnapshot.decision.notes];
    this.foldInventoryReasons(inventorySnapshot, reasons, reasonDetails);
    const mode: CommittedPlaybackMode = this.selectMode(
      input,
      chosenLane,
      capabilitySnapshot,
      inventorySnapshot,
      inventorySelectionReason,
      premiumVideoCandidateAvailable,
      premiumAudioCandidateAvailable,
      qualitySelection,
      runtimeCapabilities,
      reasons,
      reasonDetails,
    );
    const audioPolicyDecision: AudioPolicyDecision = AudioPolicy.decide({
      activationIntent: {
        sessionRole: "background",
        committedPlaybackIntentType: input.intent.intentType,
        committedPlaybackMode: mode,
        committedPlaybackLane: chosenLane,
        sourceDescriptor: input.sourceDescriptor,
      },
      runtimeAudioCapabilities: runtimeCapabilities?.audioCapabilities ?? null,
      audioTrackPolicy,
      inventoryResult,
    });
    const audioActivationMode: AudioActivationMode =
      audioPolicyDecision.audioMode;

    this.foldAudioPolicyReasons(
      audioPolicyDecision,
      mode,
      reasons,
      reasonDetails,
    );

    if (lanePreference === "prefer-native") {
      reasons.push("runtime-prefers-native");
      reasonDetails.push("Runtime adapter prefers the native committed lane.");
    } else if (lanePreference === "prefer-shaka") {
      reasons.push("runtime-prefers-shaka");
      reasonDetails.push("Runtime adapter prefers the Shaka committed lane.");
    } else if (
      lanePreference === "prefer-existing-runtime" &&
      runtimeCapabilities?.existingBackgroundPlaybackLane !== null
    ) {
      reasons.push("existing-runtime-path");
      reasonDetails.push(
        "Runtime adapter prefers its existing background playback path.",
      );
    }

    if (
      runtimeCapabilities?.supportsCommittedPlayback !== true ||
      input.sourceDescriptor === null
    ) {
      reasons.push("adapter-unsupported");
      reasonDetails.push(
        "Committed playback could not use a richer runtime adapter path.",
      );
    }

    if (chosenLane === null) {
      reasons.push("runtime-limited");
      reasonDetails.push(
        "No committed playback lane was available for the current runtime.",
      );
    } else if (usedFallbackLane) {
      reasons.push("fallback-from-preferred-lane");
      reasonDetails.push(
        `Committed playback fell back from ${preferredLane ?? "none"} to ${chosenLane}.`,
      );
    } else if (supportedLanes.length <= 1) {
      reasons.push("no-better-lane-available");
      reasonDetails.push(
        "Only one realistic committed playback lane was available.",
      );
    }

    return {
      mode,
      capabilitySnapshot,
      qualitySelection,
      inventoryResult,
      inventorySelectionReason,
      preferredLaneOrder,
      preferredLane,
      chosenLane,
      preferredRendererKind:
        capabilitySnapshot.decision.preferredRendererOrder[0] ??
        (chosenLane === "native" || chosenLane === "shaka"
          ? "native-plane"
          : chosenLane === "custom"
            ? (input.preferredRendererKindHint ?? "none")
            : input.preferredRendererKindHint),
      fallbackOrder,
      premiumPlaybackViable: capabilitySnapshot.decision.premiumPlaybackViable,
      premiumAttemptRequested: input.intent.intentType === "selected",
      premiumAttemptAccepted: mode === "premium-attempt",
      premiumVideoCandidateAvailable,
      premiumAudioCandidateAvailable,
      premiumFallbackReason:
        mode === "premium-attempt"
          ? null
          : this.resolvePremiumFallbackReason(
              input.intent.intentType,
              capabilitySnapshot,
              inventorySnapshot,
              premiumVideoCandidateAvailable,
              premiumAudioCandidateAvailable,
              qualitySelection,
              runtimeCapabilities?.audioCapabilities.canAttemptPremiumAudio ===
                true,
            ),
      reasons,
      reasonDetails,
      audioPolicyDecision,
      audioTrackPolicy,
      audioActivationMode,
      usedPreferredLane: preferredLane !== null && preferredLane === chosenLane,
      usedFallbackLane,
      lanePreference,
      startPositionSeconds: input.intent.startPositionSeconds,
    };
  }

  /**
   * @brief Determine whether a lane is allowed by the app profile
   *
   * @param lane - Candidate playback lane
   * @param appCapabilityProfile - App capability profile for the current shell
   *
   * @returns `true` when the lane is valid for the app profile
   */
  private static isLaneSupportedByProfile(
    lane: MediaPlaybackLane,
    appCapabilityProfile: MediaCapabilityProfile | null,
  ): boolean {
    if (appCapabilityProfile === null) {
      return true;
    }

    switch (lane) {
      case "native":
        return appCapabilityProfile.supportsNativePlayback;
      case "shaka":
        return appCapabilityProfile.supportsShakaPlayback;
      case "custom":
        return appCapabilityProfile.supportsCustomPipeline;
    }
  }

  /**
   * @brief Build the runtime-supported lane list that can satisfy committed playback
   *
   * @param capabilitySnapshot - Capability-oracle decision for committed playback
   * @param runtimeCapabilities - Runtime execution capabilities
   * @param appCapabilityProfile - App profile used to filter impossible lanes
   *
   * @returns Lane order that remains viable after runtime filtering
   */
  private static createSupportedLaneOrder(
    capabilitySnapshot: MediaRoleCapabilitySnapshot,
    runtimeCapabilities: MediaRuntimeCapabilities | null,
    appCapabilityProfile: MediaCapabilityProfile | null,
  ): MediaPlaybackLane[] {
    const runtimeSupportedLanes: MediaPlaybackLane[] =
      runtimeCapabilities?.committedPlaybackLanes.filter(
        (lane: MediaPlaybackLane): boolean =>
          this.isLaneSupportedByProfile(lane, appCapabilityProfile),
      ) ??
      capabilitySnapshot.decision.preferredLaneOrder.filter(
        (lane: MediaPlaybackLane): boolean =>
          this.isLaneSupportedByProfile(lane, appCapabilityProfile),
      );

    if (runtimeSupportedLanes.length > 0) {
      return runtimeSupportedLanes;
    }

    return capabilitySnapshot.decision.preferredLaneOrder.filter(
      (lane: MediaPlaybackLane): boolean =>
        this.isLaneSupportedByProfile(lane, appCapabilityProfile),
    );
  }

  /**
   * @brief Build a stable fallback order for lane selection
   *
   * @param capabilitySnapshot - Capability-oracle decision for committed playback
   * @param preferredLaneHint - Planner-provided lane hint
   * @param existingBackgroundPlaybackLane - Safe existing background lane
   * @param existingChosenLane - Previously chosen committed lane
   *
   * @returns Deduplicated lane order used for fallback and debug output
   */
  private static createFallbackOrder(
    capabilitySnapshot: MediaRoleCapabilitySnapshot,
    preferredLaneHint: MediaPlaybackLane | null,
    existingBackgroundPlaybackLane: MediaPlaybackLane | null,
    existingChosenLane: MediaPlaybackLane | null,
  ): MediaPlaybackLane[] {
    const orderedLanes: Array<MediaPlaybackLane | null> = [
      ...capabilitySnapshot.decision.preferredFallbackLaneOrder,
      preferredLaneHint,
      existingChosenLane,
      existingBackgroundPlaybackLane,
    ];

    const deduplicatedLanes: MediaPlaybackLane[] = [];

    for (const orderedLane of orderedLanes) {
      if (orderedLane === null || deduplicatedLanes.includes(orderedLane)) {
        continue;
      }

      deduplicatedLanes.push(orderedLane);
    }

    return deduplicatedLanes;
  }

  /**
   * @brief Choose the committed playback mode for the selected runtime path
   *
   * @param input - Immutable chooser inputs
   * @param chosenLane - Lane selected for committed playback
   * @param capabilitySnapshot - Capability-oracle snapshot for committed playback
   * @param inventorySnapshot - Inventory snapshot, when available
   * @param inventorySelectionReason - Stable inventory decision basis for debug state
   * @param premiumVideoCandidateAvailable - Whether inventory exposed a premium video candidate
   * @param premiumAudioCandidateAvailable - Whether inventory exposed a premium audio candidate
   * @param qualitySelection - Variant selection resolved for committed playback
   * @param runtimeCapabilities - Runtime execution capabilities
   * @param reasons - Mutable reason collection
   * @param reasonDetails - Mutable human-readable detail collection
   *
   * @returns Chosen committed playback mode
   */
  private static selectMode(
    input: CommittedPlaybackChooserInput,
    chosenLane: MediaPlaybackLane | null,
    capabilitySnapshot: MediaRoleCapabilitySnapshot,
    inventorySnapshot: MediaInventorySnapshot | null,
    inventorySelectionReason: MediaInventorySelectionReason,
    premiumVideoCandidateAvailable: boolean | null,
    premiumAudioCandidateAvailable: boolean | null,
    qualitySelection: VariantSelectionDecision,
    runtimeCapabilities: MediaRuntimeCapabilities | null,
    reasons: CommittedPlaybackDecisionReason[],
    reasonDetails: string[],
  ): CommittedPlaybackMode {
    const runtimeCanAttemptPremiumAudio: boolean =
      runtimeCapabilities?.audioCapabilities.canAttemptPremiumAudio === true;
    const premiumAttemptHasUsableCandidate: boolean =
      premiumVideoCandidateAvailable === true ||
      (premiumAudioCandidateAvailable === true &&
        runtimeCanAttemptPremiumAudio);

    if (chosenLane === null) {
      return "fallback-basic";
    }

    if (
      input.intent.intentType === "selected" &&
      capabilitySnapshot.decision.premiumPlaybackViable &&
      premiumAttemptHasUsableCandidate
    ) {
      if (
        premiumVideoCandidateAvailable === true ||
        (premiumAudioCandidateAvailable === true &&
          runtimeCanAttemptPremiumAudio)
      ) {
        reasons.push("premium-candidate-available");
      }
      reasons.push("premium-supported");
      reasonDetails.push(
        this.resolvePremiumAcceptedDetail(
          premiumVideoCandidateAvailable,
          premiumAudioCandidateAvailable,
          runtimeCanAttemptPremiumAudio,
        ),
      );
      return "premium-attempt";
    }

    if (
      input.intent.intentType === "selected" &&
      capabilitySnapshot.decision.premiumPlaybackViable
    ) {
      if (
        premiumVideoCandidateAvailable === false &&
        premiumAudioCandidateAvailable === false
      ) {
        reasons.push("premium-candidate-unavailable");
      }
      reasons.push("premium-unsupported");
      reasonDetails.push(
        this.resolvePremiumUnsupportedDetail(
          inventorySelectionReason,
          inventorySnapshot,
          premiumVideoCandidateAvailable,
          premiumAudioCandidateAvailable,
          qualitySelection,
          runtimeCanAttemptPremiumAudio,
        ),
      );
    } else if (!capabilitySnapshot.decision.premiumPlaybackViable) {
      reasons.push("premium-unsupported");
      reasonDetails.push(
        "The capability oracle did not treat premium committed playback as viable for this runtime path.",
      );
    }

    if (
      chosenLane === "custom" &&
      runtimeCapabilities?.existingBackgroundPlaybackLane === "custom"
    ) {
      return "fallback-basic";
    }

    return "standard-compatible";
  }

  /**
   * @brief Fold shared audio-policy reasons into committed playback debug output
   *
   * @param audioPolicyDecision - Resolved shared audio-policy decision
   * @param mode - Previously chosen playback mode
   * @param reasons - Mutable reason collection
   * @param reasonDetails - Mutable human-readable detail collection
   */
  private static foldAudioPolicyReasons(
    audioPolicyDecision: AudioPolicyDecision,
    mode: CommittedPlaybackMode,
    reasons: CommittedPlaybackDecisionReason[],
    reasonDetails: string[],
  ): void {
    if (audioPolicyDecision.audioMode === "premium-attempt") {
      if (!reasons.includes("premium-supported")) {
        reasons.push("premium-supported");
      }
    } else if (mode === "premium-attempt") {
      if (!reasons.includes("premium-unsupported")) {
        reasons.push("premium-unsupported");
      }
      if (
        audioPolicyDecision.usedFallback &&
        !reasons.includes("runtime-limited")
      ) {
        reasons.push("runtime-limited");
      }
    }

    for (const reasonDetail of audioPolicyDecision.reasonDetails) {
      if (!reasonDetails.includes(reasonDetail)) {
        reasonDetails.push(reasonDetail);
      }
    }
  }

  /**
   * @brief Fold inventory visibility into committed playback debug output
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param reasons - Mutable reason collection
   * @param reasonDetails - Mutable human-readable detail collection
   */
  private static foldInventoryReasons(
    inventorySnapshot: MediaInventorySnapshot | null,
    reasons: CommittedPlaybackDecisionReason[],
    reasonDetails: string[],
  ): void {
    if (inventorySnapshot === null) {
      reasons.push("inventory-unavailable");
      reasonDetails.push(
        "Committed playback selection used fallback policy only because no inventory snapshot was available.",
      );
      return;
    }

    if (inventorySnapshot.supportLevel === "full") {
      reasons.push("inventory-full");
    } else if (inventorySnapshot.supportLevel === "partial") {
      reasons.push("inventory-partial");
    } else {
      reasons.push("inventory-unavailable");
    }

    for (const inventoryNote of inventorySnapshot.notes) {
      if (!reasonDetails.includes(inventoryNote)) {
        reasonDetails.push(inventoryNote);
      }
    }
  }

  /**
   * @brief Explain why a premium attempt could not be honored
   *
   * @param inventorySelectionReason - Stable inventory decision basis for debug state
   * @param inventorySnapshot - Optional inventory snapshot
   * @param premiumVideoCandidateAvailable - Whether inventory exposed a premium video candidate
   * @param premiumAudioCandidateAvailable - Whether inventory exposed a premium audio candidate
   * @param qualitySelection - Variant decision resolved for committed playback
   * @param runtimeCanAttemptPremiumAudio - Whether the runtime can safely exercise premium audio
   *
   * @returns Human-readable detail string
   */
  private static resolvePremiumUnsupportedDetail(
    inventorySelectionReason: MediaInventorySelectionReason,
    inventorySnapshot: MediaInventorySnapshot | null,
    premiumVideoCandidateAvailable: boolean | null,
    premiumAudioCandidateAvailable: boolean | null,
    qualitySelection: VariantSelectionDecision,
    runtimeCanAttemptPremiumAudio: boolean,
  ): string {
    if (inventorySelectionReason === "policy-fallback-only") {
      return "Committed playback stayed standard-compatible because no inventory snapshot was available to confirm premium variants or tracks.";
    }

    if (
      inventorySnapshot?.supportLevel === "unsupported" ||
      inventorySelectionReason === "inventory-probe-failed"
    ) {
      return "Committed playback stayed standard-compatible because inventory probing did not confirm premium variants or tracks.";
    }

    if (
      premiumVideoCandidateAvailable === false &&
      premiumAudioCandidateAvailable === false
    ) {
      return "Inventory showed only standard variants and audio tracks for committed playback, so the chooser stayed on a standard-compatible mode.";
    }

    if (
      premiumVideoCandidateAvailable !== true &&
      premiumAudioCandidateAvailable === true &&
      !runtimeCanAttemptPremiumAudio
    ) {
      return "Inventory exposed a premium audio track, but the runtime cannot safely attempt premium committed audio in this phase.";
    }

    if (
      premiumVideoCandidateAvailable !== true &&
      qualitySelection.matchedDesiredVariantIntent === false
    ) {
      return "Inventory downgraded the premium video intent to the best available standard-compatible variant.";
    }

    return "The capability oracle did not treat premium committed playback as viable for this runtime path.";
  }

  /**
   * @brief Resolve a stable premium fallback reason for shared debug state
   *
   * @param intentType - Current committed playback intent type
   * @param capabilitySnapshot - Capability-oracle snapshot
   * @param inventorySnapshot - Optional inventory snapshot
   * @param premiumVideoCandidateAvailable - Whether inventory exposed a premium video candidate
   * @param premiumAudioCandidateAvailable - Whether inventory exposed a premium audio candidate
   * @param qualitySelection - Variant decision resolved for committed playback
   * @param runtimeCanAttemptPremiumAudio - Whether the runtime can safely exercise premium audio
   *
   * @returns Human-readable fallback reason, or `null` when none applies
   */
  private static resolvePremiumFallbackReason(
    intentType: CommittedPlaybackIntent["intentType"],
    capabilitySnapshot: MediaRoleCapabilitySnapshot,
    inventorySnapshot: MediaInventorySnapshot | null,
    premiumVideoCandidateAvailable: boolean | null,
    premiumAudioCandidateAvailable: boolean | null,
    qualitySelection: VariantSelectionDecision,
    runtimeCanAttemptPremiumAudio: boolean,
  ): string | null {
    if (intentType !== "selected") {
      return "Committed playback did not request a premium attempt for the current background-active intent.";
    }

    if (!capabilitySnapshot.decision.premiumPlaybackViable) {
      return "Capability policy did not allow a premium committed playback attempt.";
    }

    if (
      premiumVideoCandidateAvailable === false &&
      premiumAudioCandidateAvailable === false
    ) {
      return "Inventory did not expose a plausible premium video variant or audio track for committed playback.";
    }

    if (
      premiumVideoCandidateAvailable !== true &&
      premiumAudioCandidateAvailable === true &&
      !runtimeCanAttemptPremiumAudio
    ) {
      return "Inventory exposed only a premium audio candidate, but the runtime cannot safely attempt premium committed audio.";
    }

    if (
      inventorySnapshot === null ||
      inventorySnapshot.supportLevel === "unsupported"
    ) {
      return "Committed playback stayed standard-compatible because premium inventory could not be confirmed.";
    }

    if (qualitySelection.matchedDesiredVariantIntent === false) {
      return "Inventory could not match the premium video intent to an available premium variant.";
    }

    return null;
  }

  /**
   * @brief Resolve how this chooser treated the current inventory snapshot
   *
   * @param inventorySnapshot - Optional inventory snapshot
   *
   * @returns Stable inventory selection reason for debug state
   */
  private static resolveInventorySelectionReason(
    inventorySnapshot: MediaInventorySnapshot | null,
  ): MediaInventorySelectionReason {
    return inventorySnapshot?.selectionReason ?? "policy-fallback-only";
  }

  /**
   * @brief Resolve whether committed playback explicitly exposed premium audio
   *
   * @param inventorySnapshot - Optional inventory snapshot
   *
   * @returns `true` or `false` when inventory is explicit, otherwise `null`
   */
  private static resolvePremiumAudioCandidateAvailability(
    inventorySnapshot: MediaInventorySnapshot | null,
  ): boolean | null {
    if (
      inventorySnapshot === null ||
      inventorySnapshot.supportLevel === "unsupported"
    ) {
      return null;
    }

    return (
      inventorySnapshot.inventory?.audioTracks.some(
        (audioTrackInfo: MediaAudioTrackInfo): boolean =>
          audioTrackInfo.isPremiumCandidate,
      ) ?? false
    );
  }

  /**
   * @brief Explain which premium inventory candidate unlocked the premium attempt
   *
   * @param premiumVideoCandidateAvailable - Whether a premium video variant was available
   * @param premiumAudioCandidateAvailable - Whether a premium audio track was available
   * @param runtimeCanAttemptPremiumAudio - Whether the runtime can safely exercise premium audio
   *
   * @returns Human-readable detail string
   */
  private static resolvePremiumAcceptedDetail(
    premiumVideoCandidateAvailable: boolean | null,
    premiumAudioCandidateAvailable: boolean | null,
    runtimeCanAttemptPremiumAudio: boolean,
  ): string {
    if (
      premiumVideoCandidateAvailable === true &&
      premiumAudioCandidateAvailable === true &&
      runtimeCanAttemptPremiumAudio
    ) {
      return "Runtime, app capabilities, and inventory exposed premium video and audio candidates for committed playback.";
    }

    if (premiumVideoCandidateAvailable === true) {
      return "Runtime, app capabilities, and inventory exposed a premium video variant for committed playback.";
    }

    if (
      premiumAudioCandidateAvailable === true &&
      runtimeCanAttemptPremiumAudio
    ) {
      return "Runtime, app capabilities, and inventory exposed a premium audio track for committed playback.";
    }

    return "Runtime and app capabilities allowed premium playback, but inventory did not expose a concrete premium candidate.";
  }
}
