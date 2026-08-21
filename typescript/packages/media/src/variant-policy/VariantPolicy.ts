/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { MediaInventoryCloner } from "../inventory/MediaInventoryCloner";
import type { MediaInventorySelectionReason } from "../inventory/MediaInventorySelectionReason";
import type { MediaInventorySnapshot } from "../inventory/MediaInventorySnapshot";
import type { MediaVariantInfo } from "../inventory/MediaVariantInfo";
import type { VariantQualityTier } from "./VariantQualityTier";
import type { VariantSelectionDecision } from "./VariantSelectionDecision";
import type { VariantSelectionReason } from "./VariantSelectionReason";
import type { VariantSelectionRequest } from "./VariantSelectionRequest";

/**
 * @brief Pure role-based variant policy used by shared planning and execution
 */
export class VariantPolicy {
  /**
   * @brief Resolve one quality-intent decision for the supplied role
   *
   * @param request - Immutable variant selection request
   *
   * @returns Deterministic quality-intent decision
   */
  public static select(
    request: VariantSelectionRequest,
  ): VariantSelectionDecision {
    const reasons: VariantSelectionReason[] = [];
    const notes: string[] = [
      `Variant policy evaluated ${request.role} for the current media request.`,
    ];
    const inventorySnapshot: MediaInventorySnapshot | null =
      request.inventoryResult === null
        ? null
        : MediaInventoryCloner.cloneSnapshot(request.inventoryResult.snapshot);
    const inventorySelectionReason: MediaInventorySelectionReason =
      this.resolveInventorySelectionReason(inventorySnapshot);
    let desiredQualityTier: VariantQualityTier = "medium";
    let preferStartupLatency: boolean = false;
    let preferImageQuality: boolean = false;
    let preferPremiumPlayback: boolean = false;

    switch (request.role) {
      case "thumbnail-extract":
        preferImageQuality = true;
        reasons.push("role-prefers-image-quality");
        desiredQualityTier =
          request.capabilitySnapshot?.decision.premiumPlaybackViable === true
            ? "premium-attempt"
            : "high";
        notes.push(
          "Thumbnail extraction prefers image fidelity so stills stay sharp when decoded off-screen.",
        );
        break;
      case "thumbnail-preview":
        preferStartupLatency = true;
        reasons.push("role-prefers-startup-latency");
        desiredQualityTier =
          request.maxWidth !== null && request.maxWidth <= 320
            ? "low"
            : "medium";
        notes.push(
          "Thumbnail preview favors fast card paint over richer decode cost.",
        );
        break;
      case "preview-warm":
        preferStartupLatency = true;
        reasons.push("role-prefers-startup-latency");
        desiredQualityTier =
          request.capabilitySnapshot?.decision.supportLevel === "supported"
            ? "medium"
            : "low";
        notes.push(
          "Warm preview sessions stay intentionally cheaper so the focused card can light up quickly.",
        );
        break;
      case "preview-active":
        desiredQualityTier = "medium";
        reasons.push("conservative-default");
        notes.push(
          "Active preview remains on a medium tier to preserve current browse-card behavior.",
        );
        break;
      case "background-warm":
        desiredQualityTier =
          request.capabilitySnapshot?.decision.supportLevel === "supported"
            ? "high"
            : "medium";
        reasons.push("conservative-default");
        notes.push(
          "Background warm reserves headroom for better quality without assuming premium playback yet.",
        );
        break;
      case "background-playback":
        preferPremiumPlayback = true;
        reasons.push("role-prefers-premium-playback");
        desiredQualityTier =
          request.capabilitySnapshot?.decision.premiumPlaybackViable === true
            ? "premium-attempt"
            : request.capabilitySnapshot?.decision.supportLevel === "supported"
              ? "high"
              : "medium";
        notes.push(
          "Committed background playback prefers the richest safe tier reported by the runtime.",
        );
        break;
    }

    if (request.capabilitySnapshot?.decision.premiumPlaybackViable === true) {
      reasons.push("premium-tier-viable");
    } else if (preferPremiumPlayback || request.role === "thumbnail-extract") {
      reasons.push("premium-tier-unavailable");
    }

    if (
      request.capabilitySnapshot !== null &&
      request.capabilitySnapshot.decision.supportLevel !== "supported"
    ) {
      reasons.push("runtime-limited");
      notes.push(
        "The current capability snapshot is conservative, so the chosen tier avoids overcommitting to a richer variant.",
      );
    }

    if (request.maxWidth !== null || request.maxHeight !== null) {
      reasons.push("dimension-limited");
    }

    if (request.maxBandwidth !== null) {
      reasons.push("bandwidth-limited");
    }

    this.foldInventoryReasons(inventorySnapshot, reasons, notes);
    const compatibleVariants: MediaVariantInfo[] =
      this.createCompatibleVariants(
        inventorySnapshot,
        request.maxWidth,
        request.maxHeight,
        request.maxBandwidth,
      );
    const premiumCandidateAvailable: boolean | null =
      this.resolvePremiumCandidateAvailability(
        inventorySnapshot,
        compatibleVariants,
      );
    const selectedVariant: MediaVariantInfo | null = this.selectVariant(
      compatibleVariants,
      desiredQualityTier,
    );
    const matchedAvailableVariant: boolean = selectedVariant !== null;
    const matchedDesiredVariantIntent: boolean | null =
      this.resolveMatchedDesiredVariantIntent(
        desiredQualityTier,
        selectedVariant,
      );

    if (selectedVariant !== null) {
      reasons.push("matched-available-variant");
      if (selectedVariant.isPremiumCandidate) {
        reasons.push("selected-premium-variant");
      } else {
        reasons.push("selected-standard-variant");
      }

      if (matchedDesiredVariantIntent === true) {
        notes.push(
          `Variant policy matched quality intent to available variant ${selectedVariant.id}.`,
        );
      } else if (desiredQualityTier === "premium-attempt") {
        notes.push(
          `Variant policy fell back from a premium intent to standard-compatible variant ${selectedVariant.id}.`,
        );
      } else {
        notes.push(
          `Variant policy selected variant ${selectedVariant.id}, but the available inventory did not exactly match the requested standard-compatible intent.`,
        );
      }
    } else if (inventorySnapshot?.inventory !== null) {
      reasons.push("no-compatible-variant");
      notes.push(
        "Inventory was available, but no compatible variant matched the shared quality intent.",
      );
    }

    if (
      preferPremiumPlayback &&
      premiumCandidateAvailable === false &&
      inventorySelectionReason !== "policy-fallback-only"
    ) {
      notes.push(
        "Inventory exposed only standard-compatible video variants for committed playback.",
      );
    }

    return {
      role: request.role,
      desiredQualityTier,
      preferStartupLatency,
      preferImageQuality,
      preferPremiumPlayback,
      maxWidth: request.maxWidth,
      maxHeight: request.maxHeight,
      maxBandwidth: request.maxBandwidth,
      inventorySelectionReason,
      inventorySnapshot,
      premiumCandidateAvailable,
      selectedVariant: MediaInventoryCloner.cloneVariantInfo(selectedVariant),
      matchedAvailableVariant,
      matchedDesiredVariantIntent,
      reasons,
      notes,
    };
  }

  /**
   * @brief Fold inventory availability into the shared variant-policy debug state
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param reasons - Mutable reason collection
   * @param notes - Mutable note collection
   */
  private static foldInventoryReasons(
    inventorySnapshot: MediaInventorySnapshot | null,
    reasons: VariantSelectionReason[],
    notes: string[],
  ): void {
    if (inventorySnapshot === null) {
      reasons.push("inventory-unavailable");
      notes.push(
        "Variant policy used role and capability hints only because no inventory snapshot was available.",
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
      if (!notes.includes(inventoryNote)) {
        notes.push(inventoryNote);
      }
    }
  }

  /**
   * @brief Select the best available variant for one quality intent
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param desiredQualityTier - Shared quality intent
   * @param maxWidth - Optional width cap
   * @param maxHeight - Optional height cap
   * @param maxBandwidth - Optional bandwidth cap
   *
   * @returns Best matching available variant, or `null` when none matched
   */
  private static selectVariant(
    compatibleVariants: MediaVariantInfo[],
    desiredQualityTier: VariantQualityTier,
  ): MediaVariantInfo | null {
    if (compatibleVariants.length === 0) {
      return null;
    }

    if (desiredQualityTier === "premium-attempt") {
      const premiumVariant: MediaVariantInfo | undefined =
        compatibleVariants.find(
          (variantInfo: MediaVariantInfo): boolean =>
            variantInfo.isPremiumCandidate,
        );

      if (premiumVariant !== undefined) {
        return MediaInventoryCloner.cloneVariantInfo(premiumVariant);
      }
    }

    const standardVariant: MediaVariantInfo | undefined =
      compatibleVariants.find(
        (variantInfo: MediaVariantInfo): boolean =>
          !variantInfo.isPremiumCandidate,
      );

    return MediaInventoryCloner.cloneVariantInfo(standardVariant ?? null);
  }

  /**
   * @brief Create the sorted compatible-variant list used for selection
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param maxWidth - Optional width cap
   * @param maxHeight - Optional height cap
   * @param maxBandwidth - Optional bandwidth cap
   *
   * @returns Compatible variants sorted from richest to most conservative
   */
  private static createCompatibleVariants(
    inventorySnapshot: MediaInventorySnapshot | null,
    maxWidth: number | null,
    maxHeight: number | null,
    maxBandwidth: number | null,
  ): MediaVariantInfo[] {
    const availableVariants: MediaVariantInfo[] =
      inventorySnapshot?.inventory?.variants ?? [];

    return availableVariants
      .filter((variantInfo: MediaVariantInfo): boolean =>
        this.isVariantCompatible(
          variantInfo,
          maxWidth,
          maxHeight,
          maxBandwidth,
        ),
      )
      .sort(
        (
          leftVariantInfo: MediaVariantInfo,
          rightVariantInfo: MediaVariantInfo,
        ): number =>
          this.scoreVariant(rightVariantInfo) -
          this.scoreVariant(leftVariantInfo),
      );
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
   * @brief Resolve whether compatible premium candidates are explicitly known
   *
   * @param inventorySnapshot - Optional inventory snapshot
   * @param compatibleVariants - Compatible variants already filtered for this request
   *
   * @returns `true` or `false` when inventory is explicit, otherwise `null`
   */
  private static resolvePremiumCandidateAvailability(
    inventorySnapshot: MediaInventorySnapshot | null,
    compatibleVariants: MediaVariantInfo[],
  ): boolean | null {
    if (
      inventorySnapshot === null ||
      inventorySnapshot.supportLevel === "unsupported"
    ) {
      return null;
    }

    return compatibleVariants.some(
      (variantInfo: MediaVariantInfo): boolean =>
        variantInfo.isPremiumCandidate,
    );
  }

  /**
   * @brief Determine whether the chosen variant matched the requested quality intent
   *
   * @param desiredQualityTier - Requested shared quality tier
   * @param selectedVariant - Chosen available variant
   *
   * @returns `true` when the available variant matched the requested intent
   */
  private static resolveMatchedDesiredVariantIntent(
    desiredQualityTier: VariantQualityTier,
    selectedVariant: MediaVariantInfo | null,
  ): boolean | null {
    if (selectedVariant === null) {
      return null;
    }

    if (desiredQualityTier === "premium-attempt") {
      return selectedVariant.isPremiumCandidate;
    }

    return !selectedVariant.isPremiumCandidate;
  }

  /**
   * @brief Check whether one variant satisfies explicit dimension and bandwidth caps
   *
   * @param variantInfo - Variant being evaluated
   * @param maxWidth - Optional width cap
   * @param maxHeight - Optional height cap
   * @param maxBandwidth - Optional bandwidth cap
   *
   * @returns `true` when the variant remains compatible
   */
  private static isVariantCompatible(
    variantInfo: MediaVariantInfo,
    maxWidth: number | null,
    maxHeight: number | null,
    maxBandwidth: number | null,
  ): boolean {
    if (
      maxWidth !== null &&
      variantInfo.width !== null &&
      variantInfo.width > maxWidth
    ) {
      return false;
    }

    if (
      maxHeight !== null &&
      variantInfo.height !== null &&
      variantInfo.height > maxHeight
    ) {
      return false;
    }

    if (
      maxBandwidth !== null &&
      variantInfo.bitrate !== null &&
      variantInfo.bitrate > maxBandwidth
    ) {
      return false;
    }

    return true;
  }

  /**
   * @brief Score one variant conservatively for higher-fidelity playback
   *
   * @param variantInfo - Variant being scored
   *
   * @returns Relative score where higher values are preferred
   */
  private static scoreVariant(variantInfo: MediaVariantInfo): number {
    const width: number = variantInfo.width ?? 0;
    const height: number = variantInfo.height ?? 0;
    const bitrate: number = variantInfo.bitrate ?? 0;
    const frameRate: number = variantInfo.frameRate ?? 0;
    const resolutionScore: number = width * height;
    const defaultScore: number = variantInfo.isDefault ? 50 : 0;
    const premiumScore: number = variantInfo.isPremiumCandidate ? 100 : 0;

    return resolutionScore + bitrate + frameRate + defaultScore + premiumScore;
  }
}
