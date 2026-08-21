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
 * @brief Conservative TV thumbnail adapter that reports unsupported extraction
 */
export class TvMediaThumbnailRuntimeAdapter implements MediaThumbnailRuntimeAdapter {
  public static readonly RUNTIME_ID: string = "tv-lightning-thumbnail";

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
   * @brief Create the conservative TV thumbnail adapter
   */
  public constructor() {
    this.runtimeId = TvMediaThumbnailRuntimeAdapter.RUNTIME_ID;
  }

  /**
   * @brief Report unsupported TV thumbnail capabilities for this phase
   *
   * @returns TV thumbnail runtime capability snapshot
   */
  public getCapabilities(): MediaThumbnailRuntimeCapabilities {
    return {
      ...TvMediaThumbnailRuntimeAdapter.CAPABILITIES,
    };
  }

  /**
   * @brief Reject real extraction work until the TV shell grows a still path
   *
   * @param request - Shared thumbnail request that could not be serviced
   *
   * @returns Never resolves successfully
   */
  public extractThumbnail(
    request: MediaThumbnailRequest,
  ): MediaThumbnailExtractionResult {
    throw new Error(
      `TV thumbnail extraction is unsupported for ${request.sourceId} in this phase.`,
    );
  }
}
