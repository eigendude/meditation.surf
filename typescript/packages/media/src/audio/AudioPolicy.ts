/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaAudioTrackInfo } from "../inventory/MediaAudioTrackInfo";
import { MediaInventoryCloner } from "../inventory/MediaInventoryCloner";
import type { MediaInventoryResult } from "../inventory/MediaInventoryResult";
import type { MediaInventorySelectionReason } from "../inventory/MediaInventorySelectionReason";
import type { MediaInventorySnapshot } from "../inventory/MediaInventorySnapshot";
import type { AudioActivationIntent } from "./AudioActivationIntent";
import type { AudioCapabilityProfile } from "./AudioCapabilityProfile";
import type { AudioPolicyDecision } from "./AudioPolicyDecision";
import type { AudioPolicyDecisionReason } from "./AudioPolicyDecisionReason";
import type { AudioTrackPolicy } from "./AudioTrackPolicy";

/**
 * @brief Immutable input consumed by the pure shared audio policy
 */
export type AudioPolicyInput = {
  activationIntent: AudioActivationIntent;
  runtimeAudioCapabilities: AudioCapabilityProfile | null;
  audioTrackPolicy: AudioTrackPolicy | null;
  inventoryResult: MediaInventoryResult | null;
};

/**
 * @brief Pure audio-policy subsystem for preview, extraction, and committed playback
 *
 * The current phase stays intentionally conservative. It keeps preview and
 * extraction silent while making committed playback audio explicit and
 * inspectable for every runtime adapter.
 */
export class AudioPolicy {
  /**
   * @brief Build the conservative default track policy for one session role
   *
   * @param sessionRole - Shared media session role
   *
   * @returns Default track-policy preferences for the role
   */
  public static createDefaultTrackPolicy(
    sessionRole: AudioActivationIntent["sessionRole"],
  ): AudioTrackPolicy {
    return {
      preferPremiumAudio: sessionRole === "background",
      preferDefaultTrack: true,
      preferredLanguage: null,
      preferredChannelLayout: null,
      allowFallbackStereo: sessionRole === "background",
    };
  }

  /**
   * @brief Resolve one deterministic audio-policy decision
   *
   * @param input - Immutable audio policy inputs
   *
   * @returns Inspectable audio-policy decision
   */
  public static decide(input: AudioPolicyInput): AudioPolicyDecision {
    const activationIntent: AudioActivationIntent = input.activationIntent;
    const runtimeAudioCapabilities: AudioCapabilityProfile | null =
      input.runtimeAudioCapabilities;
    const audioTrackPolicy: AudioTrackPolicy =
      input.audioTrackPolicy ??
      this.createDefaultTrackPolicy(activationIntent.sessionRole);
    const inventorySnapshot: MediaInventorySnapshot | null =
      input.inventoryResult === null
        ? null
        : MediaInventoryCloner.cloneSnapshot(input.inventoryResult.snapshot);
    const inventorySelectionReason: MediaInventorySelectionReason =
      this.resolveInventorySelectionReason(inventorySnapshot);
    const reasons: AudioPolicyDecisionReason[] = [];
    const reasonDetails: string[] = [];
    const committedPlaybackLane = activationIntent.committedPlaybackLane;

    if (activationIntent.sessionRole === "extractor") {
      reasons.push("extract-must-be-silent");
      reasonDetails.push(
        "Thumbnail extraction stays silent so hidden extraction media never emits audible playback.",
      );

      if (runtimeAudioCapabilities?.canKeepExtractionSilent === false) {
        reasons.push("adapter-limited");
        reasonDetails.push(
          "The runtime did not explicitly report a stable silent-extraction path, so the policy still requested silent extraction.",
        );
      }

      return {
        audioMode: "silent-extract",
        fallbackMode: null,
        requestedPremiumAttempt: false,
        usedFallback: false,
        trackPolicy: audioTrackPolicy,
        inventorySelectionReason,
        inventorySnapshot,
        premiumCandidateAvailable: null,
        selectedAudioTrack: null,
        selectedTrackStrategy: "no-track",
        capabilityProfile: this.cloneCapabilityProfile(
          runtimeAudioCapabilities,
        ),
        committedPlaybackLane,
        reasons,
        reasonDetails,
      };
    }

    if (activationIntent.sessionRole === "preview") {
      reasons.push("preview-must-be-muted");
      reasonDetails.push(
        "Preview sessions stay muted so focus-driven browse media never leaks into committed playback audio.",
      );

      if (runtimeAudioCapabilities?.canKeepPreviewMuted === false) {
        reasons.push("adapter-limited");
        reasonDetails.push(
          "The runtime did not explicitly report a stable muted-preview path, so the policy still requested a muted preview.",
        );
      }

      return {
        audioMode: "muted-preview",
        fallbackMode: null,
        requestedPremiumAttempt: false,
        usedFallback: false,
        trackPolicy: audioTrackPolicy,
        inventorySelectionReason,
        inventorySnapshot,
        premiumCandidateAvailable: null,
        selectedAudioTrack: null,
        selectedTrackStrategy: "no-track",
        capabilityProfile: this.cloneCapabilityProfile(
          runtimeAudioCapabilities,
        ),
        committedPlaybackLane,
        reasons,
        reasonDetails,
      };
    }

    const wantsPremiumAttempt: boolean =
      activationIntent.committedPlaybackMode === "premium-attempt" &&
      audioTrackPolicy.preferPremiumAudio;
    const premiumCandidateAvailable: boolean | null =
      this.resolvePremiumCandidateAvailability(inventorySnapshot);
    const selectedPremiumTrack: MediaAudioTrackInfo | null =
      this.selectPremiumAudioTrack(inventorySnapshot, audioTrackPolicy);
    const selectedDefaultTrack: MediaAudioTrackInfo | null =
      this.selectDefaultAudioTrack(inventorySnapshot, audioTrackPolicy);
    const selectedFallbackTrack: MediaAudioTrackInfo | null =
      this.selectFallbackStereoTrack(inventorySnapshot, audioTrackPolicy);

    reasons.push("committed-playback");
    reasonDetails.push(
      "Committed playback is the only shared media path allowed to activate audible playback.",
    );
    this.foldInventoryReasons(inventorySnapshot, reasons, reasonDetails);

    if (
      wantsPremiumAttempt &&
      selectedPremiumTrack !== null &&
      runtimeAudioCapabilities?.canAttemptPremiumAudio === true
    ) {
      reasons.push("premium-supported");
      reasonDetails.push(
        "The runtime reported that it can safely attempt the premium committed-audio path.",
      );

      if (selectedPremiumTrack !== null) {
        reasonDetails.push(
          `Inventory selected premium audio track ${selectedPremiumTrack.id} for committed playback.`,
        );
      }

      return {
        audioMode: "premium-attempt",
        fallbackMode: null,
        requestedPremiumAttempt: true,
        usedFallback: false,
        trackPolicy: audioTrackPolicy,
        inventorySelectionReason,
        inventorySnapshot,
        premiumCandidateAvailable,
        selectedAudioTrack:
          MediaInventoryCloner.cloneAudioTrackInfo(selectedPremiumTrack),
        selectedTrackStrategy: "premium-candidate",
        capabilityProfile: this.cloneCapabilityProfile(
          runtimeAudioCapabilities,
        ),
        committedPlaybackLane,
        reasons,
        reasonDetails,
      };
    }

    if (wantsPremiumAttempt) {
      reasons.push("premium-unsupported");
      if (selectedPremiumTrack === null && inventorySnapshot !== null) {
        reasons.push("premium-track-unavailable");
        reasonDetails.push(
          "Inventory did not expose a plausible premium audio track for committed playback.",
        );
      } else if (selectedPremiumTrack === null) {
        reasonDetails.push(
          "Committed audio stayed on the default path because inventory did not explicitly confirm a premium audio track.",
        );
      } else {
        reasonDetails.push(
          "The runtime did not report premium committed-audio support for this phase.",
        );
      }
    }

    if (runtimeAudioCapabilities?.canPlayCommittedAudio === true) {
      if (!reasons.includes("default-runtime-audio")) {
        reasons.push("default-runtime-audio");
      }

      if (selectedDefaultTrack !== null) {
        reasons.push("default-track-selected");
        reasonDetails.push(
          `Inventory selected default committed audio track ${selectedDefaultTrack.id}.`,
        );
      }

      if (wantsPremiumAttempt) {
        reasons.push("fallback-from-premium");
        reasonDetails.push(
          "The shared policy downgraded the premium request to the runtime's default committed audio path.",
        );
      }

      return {
        audioMode: "committed-playback",
        fallbackMode: wantsPremiumAttempt ? "fallback-default" : null,
        requestedPremiumAttempt: wantsPremiumAttempt,
        usedFallback: wantsPremiumAttempt,
        trackPolicy: audioTrackPolicy,
        inventorySelectionReason,
        inventorySnapshot,
        premiumCandidateAvailable,
        selectedAudioTrack:
          MediaInventoryCloner.cloneAudioTrackInfo(selectedDefaultTrack),
        selectedTrackStrategy:
          selectedDefaultTrack === null ? "no-track" : "default-track",
        capabilityProfile: this.cloneCapabilityProfile(
          runtimeAudioCapabilities,
        ),
        committedPlaybackLane,
        reasons,
        reasonDetails,
      };
    }

    if (
      runtimeAudioCapabilities?.canFallbackStereo === true &&
      audioTrackPolicy.allowFallbackStereo
    ) {
      reasons.push("runtime-limited");
      if (wantsPremiumAttempt) {
        reasons.push("fallback-from-premium");
      }
      if (selectedFallbackTrack !== null) {
        reasons.push("fallback-track-selected");
        reasonDetails.push(
          `Inventory selected fallback stereo track ${selectedFallbackTrack.id}.`,
        );
      }
      reasonDetails.push(
        "The runtime could not honor the preferred committed audio path, so the policy selected a stereo fallback.",
      );

      return {
        audioMode: "fallback-stereo",
        fallbackMode: "fallback-stereo",
        requestedPremiumAttempt: wantsPremiumAttempt,
        usedFallback: true,
        trackPolicy: audioTrackPolicy,
        inventorySelectionReason,
        inventorySnapshot,
        premiumCandidateAvailable,
        selectedAudioTrack: MediaInventoryCloner.cloneAudioTrackInfo(
          selectedFallbackTrack,
        ),
        selectedTrackStrategy:
          selectedFallbackTrack === null ? "no-track" : "fallback-stereo",
        capabilityProfile: this.cloneCapabilityProfile(
          runtimeAudioCapabilities,
        ),
        committedPlaybackLane,
        reasons,
        reasonDetails,
      };
    }

    reasons.push("no-audio-path");
    reasonDetails.push(
      "The runtime did not report any committed playback audio path for this phase.",
    );

    return {
      audioMode: "committed-playback",
      fallbackMode: "unsupported",
      requestedPremiumAttempt: wantsPremiumAttempt,
      usedFallback: true,
      trackPolicy: audioTrackPolicy,
      inventorySelectionReason,
      inventorySnapshot,
      premiumCandidateAvailable,
      selectedAudioTrack: MediaInventoryCloner.cloneAudioTrackInfo(
        selectedDefaultTrack ?? selectedFallbackTrack,
      ),
      selectedTrackStrategy:
        selectedDefaultTrack !== null
          ? "default-track"
          : selectedFallbackTrack !== null
            ? "fallback-stereo"
            : "no-track",
      capabilityProfile: this.cloneCapabilityProfile(runtimeAudioCapabilities),
      committedPlaybackLane,
      reasons,
      reasonDetails,
    };
  }

  /**
   * @brief Fold inventory visibility into the shared audio-policy debug state
   *
   * @param inventorySnapshot - Optional inventory snapshot used by the policy
   * @param reasons - Mutable reason collection
   * @param reasonDetails - Mutable human-readable detail collection
   */
  private static foldInventoryReasons(
    inventorySnapshot: MediaInventorySnapshot | null,
    reasons: AudioPolicyDecisionReason[],
    reasonDetails: string[],
  ): void {
    if (inventorySnapshot === null) {
      reasons.push("inventory-unavailable");
      reasonDetails.push(
        "Committed audio selection used fallback policy only because no inventory snapshot was available.",
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
   * @brief Select a premium audio track when inventory exposes one
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param audioTrackPolicy - Shared audio policy preferences
   *
   * @returns Premium audio track, or `null` when none matched
   */
  private static selectPremiumAudioTrack(
    inventorySnapshot: MediaInventorySnapshot | null,
    audioTrackPolicy: AudioTrackPolicy,
  ): MediaAudioTrackInfo | null {
    const availableAudioTracks: MediaAudioTrackInfo[] =
      inventorySnapshot?.inventory?.audioTracks ?? [];
    const premiumAudioTracks: MediaAudioTrackInfo[] = availableAudioTracks
      .filter(
        (audioTrackInfo: MediaAudioTrackInfo): boolean =>
          audioTrackInfo.isPremiumCandidate,
      )
      .sort(
        (
          leftAudioTrackInfo: MediaAudioTrackInfo,
          rightAudioTrackInfo: MediaAudioTrackInfo,
        ): number =>
          this.scoreAudioTrack(rightAudioTrackInfo, audioTrackPolicy) -
          this.scoreAudioTrack(leftAudioTrackInfo, audioTrackPolicy),
      );

    return MediaInventoryCloner.cloneAudioTrackInfo(
      premiumAudioTracks[0] ?? null,
    );
  }

  /**
   * @brief Select a conservative default audio track from inventory
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param audioTrackPolicy - Shared audio policy preferences
   *
   * @returns Default-safe audio track, or `null` when none matched
   */
  private static selectDefaultAudioTrack(
    inventorySnapshot: MediaInventorySnapshot | null,
    audioTrackPolicy: AudioTrackPolicy,
  ): MediaAudioTrackInfo | null {
    const availableAudioTracks: MediaAudioTrackInfo[] =
      inventorySnapshot?.inventory?.audioTracks ?? [];
    const defaultStandardTracks: MediaAudioTrackInfo[] =
      availableAudioTracks.filter(
        (audioTrackInfo: MediaAudioTrackInfo): boolean =>
          audioTrackInfo.isDefault && !audioTrackInfo.isPremiumCandidate,
      );
    const defaultTracks: MediaAudioTrackInfo[] = availableAudioTracks.filter(
      (audioTrackInfo: MediaAudioTrackInfo): boolean =>
        audioTrackInfo.isDefault,
    );
    const standardTracks: MediaAudioTrackInfo[] = availableAudioTracks.filter(
      (audioTrackInfo: MediaAudioTrackInfo): boolean =>
        !audioTrackInfo.isPremiumCandidate,
    );

    return (
      this.selectBestAudioTrack(defaultStandardTracks, audioTrackPolicy) ??
      this.selectBestAudioTrack(defaultTracks, audioTrackPolicy) ??
      this.selectBestAudioTrack(standardTracks, audioTrackPolicy) ??
      this.selectBestAudioTrack(availableAudioTracks, audioTrackPolicy)
    );
  }

  /**
   * @brief Select a stereo-capable fallback audio track when possible
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param audioTrackPolicy - Shared audio policy preferences
   *
   * @returns Fallback stereo track, or `null` when none matched
   */
  private static selectFallbackStereoTrack(
    inventorySnapshot: MediaInventorySnapshot | null,
    audioTrackPolicy: AudioTrackPolicy,
  ): MediaAudioTrackInfo | null {
    const availableAudioTracks: MediaAudioTrackInfo[] =
      inventorySnapshot?.inventory?.audioTracks ?? [];
    const stereoTracks: MediaAudioTrackInfo[] = availableAudioTracks.filter(
      (audioTrackInfo: MediaAudioTrackInfo): boolean =>
        audioTrackInfo.channelCount === null ||
        audioTrackInfo.channelCount <= 2,
    );
    const defaultStandardStereoTracks: MediaAudioTrackInfo[] =
      stereoTracks.filter(
        (audioTrackInfo: MediaAudioTrackInfo): boolean =>
          audioTrackInfo.isDefault && !audioTrackInfo.isPremiumCandidate,
      );
    const standardStereoTracks: MediaAudioTrackInfo[] = stereoTracks.filter(
      (audioTrackInfo: MediaAudioTrackInfo): boolean =>
        !audioTrackInfo.isPremiumCandidate,
    );

    return (
      this.selectBestAudioTrack(
        defaultStandardStereoTracks,
        audioTrackPolicy,
      ) ??
      this.selectBestAudioTrack(standardStereoTracks, audioTrackPolicy) ??
      this.selectBestAudioTrack(stereoTracks, audioTrackPolicy)
    );
  }

  /**
   * @brief Select the best track from one already-filtered cohort
   *
   * @param audioTracks - Candidate audio-track cohort
   * @param audioTrackPolicy - Shared audio policy preferences
   *
   * @returns Highest-scoring audio track, or `null` when the cohort is empty
   */
  private static selectBestAudioTrack(
    audioTracks: MediaAudioTrackInfo[],
    audioTrackPolicy: AudioTrackPolicy,
  ): MediaAudioTrackInfo | null {
    const sortedAudioTracks: MediaAudioTrackInfo[] = [...audioTracks].sort(
      (
        leftAudioTrackInfo: MediaAudioTrackInfo,
        rightAudioTrackInfo: MediaAudioTrackInfo,
      ): number =>
        this.scoreAudioTrack(rightAudioTrackInfo, audioTrackPolicy) -
        this.scoreAudioTrack(leftAudioTrackInfo, audioTrackPolicy),
    );

    return MediaInventoryCloner.cloneAudioTrackInfo(
      sortedAudioTracks[0] ?? null,
    );
  }

  /**
   * @brief Score one audio track using conservative default-track preferences
   *
   * @param audioTrackInfo - Audio track being ranked
   * @param audioTrackPolicy - Shared audio policy preferences
   *
   * @returns Relative score where higher values are preferred
   */
  private static scoreAudioTrack(
    audioTrackInfo: MediaAudioTrackInfo,
    audioTrackPolicy: AudioTrackPolicy,
  ): number {
    let score: number = 0;

    if (audioTrackInfo.isDefault && audioTrackPolicy.preferDefaultTrack) {
      score += 100;
    }

    if (
      audioTrackPolicy.preferredLanguage !== null &&
      audioTrackInfo.language === audioTrackPolicy.preferredLanguage
    ) {
      score += 40;
    }

    if (
      audioTrackPolicy.preferredChannelLayout !== null &&
      audioTrackInfo.channelLayout === audioTrackPolicy.preferredChannelLayout
    ) {
      score += 20;
    }

    if (audioTrackInfo.channelCount !== null) {
      score += audioTrackInfo.channelCount;
    }

    return score;
  }

  /**
   * @brief Resolve how this decision treated the current inventory snapshot
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
  private static resolvePremiumCandidateAvailability(
    inventorySnapshot: MediaInventorySnapshot | null,
  ): boolean | null {
    if (
      inventorySnapshot === null ||
      inventorySnapshot.supportLevel === "unsupported"
    ) {
      return null;
    }

    const availableAudioTracks: MediaAudioTrackInfo[] =
      inventorySnapshot.inventory?.audioTracks ?? [];

    return availableAudioTracks.some(
      (audioTrackInfo: MediaAudioTrackInfo): boolean =>
        audioTrackInfo.isPremiumCandidate,
    );
  }

  /**
   * @brief Clone one runtime audio-capability profile for read-only snapshots
   *
   * @param runtimeAudioCapabilities - Runtime audio-capability profile
   *
   * @returns Cloned capability profile, or `null` when absent
   */
  private static cloneCapabilityProfile(
    runtimeAudioCapabilities: AudioCapabilityProfile | null,
  ): AudioCapabilityProfile | null {
    if (runtimeAudioCapabilities === null) {
      return null;
    }

    return {
      canPlayCommittedAudio: runtimeAudioCapabilities.canPlayCommittedAudio,
      canAttemptPremiumAudio: runtimeAudioCapabilities.canAttemptPremiumAudio,
      canFallbackStereo: runtimeAudioCapabilities.canFallbackStereo,
      canKeepPreviewMuted: runtimeAudioCapabilities.canKeepPreviewMuted,
      canKeepExtractionSilent: runtimeAudioCapabilities.canKeepExtractionSilent,
    };
  }
}
