/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaAudioTrackInfo } from "./MediaAudioTrackInfo";
import type { MediaInventory } from "./MediaInventory";
import type { MediaInventoryResult } from "./MediaInventoryResult";
import type { MediaInventorySnapshot } from "./MediaInventorySnapshot";
import type { MediaTextTrackInfo } from "./MediaTextTrackInfo";
import type { MediaVariantInfo } from "./MediaVariantInfo";

/**
 * @brief Small shared cloning helper for inventory debug state
 */
export class MediaInventoryCloner {
  /**
   * @brief Clone one inventory result for read-only state publication
   *
   * @param inventoryResult - Inventory result to clone
   *
   * @returns Cloned inventory result, or `null` when absent
   */
  public static cloneResult(
    inventoryResult: MediaInventoryResult | null,
  ): MediaInventoryResult | null {
    if (inventoryResult === null) {
      return null;
    }

    return {
      supportLevel: inventoryResult.supportLevel,
      snapshot: this.cloneSnapshot(inventoryResult.snapshot),
      failureReason: inventoryResult.failureReason,
    };
  }

  /**
   * @brief Clone one inventory snapshot
   *
   * @param inventorySnapshot - Inventory snapshot to clone
   *
   * @returns Cloned inventory snapshot
   */
  public static cloneSnapshot(
    inventorySnapshot: MediaInventorySnapshot,
  ): MediaInventorySnapshot {
    return {
      sourceId: inventorySnapshot.sourceId,
      supportLevel: inventorySnapshot.supportLevel,
      inventorySource: inventorySnapshot.inventorySource,
      selectionReason: inventorySnapshot.selectionReason,
      inventory: this.cloneInventory(inventorySnapshot.inventory),
      notes: [...inventorySnapshot.notes],
    };
  }

  /**
   * @brief Clone one inventory payload
   *
   * @param inventory - Inventory payload to clone
   *
   * @returns Cloned inventory payload, or `null` when absent
   */
  public static cloneInventory(
    inventory: MediaInventory | null,
  ): MediaInventory | null {
    if (inventory === null) {
      return null;
    }

    return {
      sourceId: inventory.sourceId,
      inventorySource: inventory.inventorySource,
      variants: inventory.variants.map(
        (variantInfo: MediaVariantInfo): MediaVariantInfo =>
          this.cloneVariantInfo(variantInfo),
      ),
      audioTracks: inventory.audioTracks.map(
        (audioTrackInfo: MediaAudioTrackInfo): MediaAudioTrackInfo =>
          this.cloneAudioTrackInfo(audioTrackInfo),
      ),
      textTracks: inventory.textTracks.map(
        (textTrackInfo: MediaTextTrackInfo): MediaTextTrackInfo =>
          this.cloneTextTrackInfo(textTrackInfo),
      ),
    };
  }

  /**
   * @brief Clone one variant entry
   *
   * @param variantInfo - Variant metadata to clone
   *
   * @returns Cloned variant metadata
   */
  public static cloneVariantInfo(
    variantInfo: MediaVariantInfo,
  ): MediaVariantInfo;
  public static cloneVariantInfo(
    variantInfo: MediaVariantInfo | null,
  ): MediaVariantInfo | null;
  public static cloneVariantInfo(
    variantInfo: MediaVariantInfo | null,
  ): MediaVariantInfo | null {
    if (variantInfo === null) {
      return null;
    }

    return {
      id: variantInfo.id,
      width: variantInfo.width,
      height: variantInfo.height,
      bitrate: variantInfo.bitrate,
      codec: variantInfo.codec,
      frameRate: variantInfo.frameRate,
      isDefault: variantInfo.isDefault,
      isPremiumCandidate: variantInfo.isPremiumCandidate,
    };
  }

  /**
   * @brief Clone one audio-track entry
   *
   * @param audioTrackInfo - Audio-track metadata to clone
   *
   * @returns Cloned audio-track metadata
   */
  public static cloneAudioTrackInfo(
    audioTrackInfo: MediaAudioTrackInfo,
  ): MediaAudioTrackInfo;
  public static cloneAudioTrackInfo(
    audioTrackInfo: MediaAudioTrackInfo | null,
  ): MediaAudioTrackInfo | null;
  public static cloneAudioTrackInfo(
    audioTrackInfo: MediaAudioTrackInfo | null,
  ): MediaAudioTrackInfo | null {
    if (audioTrackInfo === null) {
      return null;
    }

    return {
      id: audioTrackInfo.id,
      language: audioTrackInfo.language,
      channelLayout: audioTrackInfo.channelLayout,
      channelCount: audioTrackInfo.channelCount,
      codec: audioTrackInfo.codec,
      isDefault: audioTrackInfo.isDefault,
      isPremiumCandidate: audioTrackInfo.isPremiumCandidate,
    };
  }

  /**
   * @brief Clone one text-track entry
   *
   * @param textTrackInfo - Text-track metadata to clone
   *
   * @returns Cloned text-track metadata
   */
  public static cloneTextTrackInfo(
    textTrackInfo: MediaTextTrackInfo,
  ): MediaTextTrackInfo;
  public static cloneTextTrackInfo(
    textTrackInfo: MediaTextTrackInfo | null,
  ): MediaTextTrackInfo | null;
  public static cloneTextTrackInfo(
    textTrackInfo: MediaTextTrackInfo | null,
  ): MediaTextTrackInfo | null {
    if (textTrackInfo === null) {
      return null;
    }

    return {
      id: textTrackInfo.id,
      language: textTrackInfo.language,
      kind: textTrackInfo.kind,
      label: textTrackInfo.label,
      codec: textTrackInfo.codec,
      isDefault: textTrackInfo.isDefault,
    };
  }
}
