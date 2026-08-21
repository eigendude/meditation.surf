/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  MediaThumbnailExtractionResult,
  MediaThumbnailRequest,
  MediaThumbnailRuntimeAdapter,
  MediaThumbnailRuntimeCapabilities,
} from "@meditation-surf/core";

/**
 * @brief Conservative Expo thumbnail adapter that reports unsupported extraction
 */
export class ExpoMediaThumbnailRuntimeAdapter implements MediaThumbnailRuntimeAdapter {
  public static readonly RUNTIME_ID: string = "mobile-expo-thumbnail";

  private static readonly CAPABILITIES: MediaThumbnailRuntimeCapabilities = {
    canExtractFirstFrame: false,
    canExtractNonBlackFrame: false,
    canExtractFromHiddenMedia: false,
    canCacheObjectUrls: false,
    canPrioritizeFocusedItem: false,
    supportsWebCodecs: false,
    supportsCustomDecodeExtraction: false,
  };

  public readonly runtimeId: string;

  /**
   * @brief Create the conservative Expo thumbnail adapter
   */
  public constructor() {
    this.runtimeId = ExpoMediaThumbnailRuntimeAdapter.RUNTIME_ID;
  }

  /**
   * @brief Report unsupported Expo thumbnail capabilities for this phase
   *
   * @returns Expo thumbnail runtime capability snapshot
   */
  public getCapabilities(): MediaThumbnailRuntimeCapabilities {
    return {
      ...ExpoMediaThumbnailRuntimeAdapter.CAPABILITIES,
    };
  }

  /**
   * @brief Reject real extraction work until Expo adds a dedicated still path
   *
   * @param request - Shared thumbnail request that could not be serviced
   *
   * @returns Never resolves successfully
   */
  public extractThumbnail(
    request: MediaThumbnailRequest,
  ): MediaThumbnailExtractionResult {
    throw new Error(
      `Expo thumbnail extraction is unsupported for ${request.sourceId} in this phase.`,
    );
  }
}
