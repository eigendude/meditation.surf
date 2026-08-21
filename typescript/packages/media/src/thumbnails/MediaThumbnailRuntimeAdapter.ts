/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaThumbnailExtractionResult } from "./MediaThumbnailExtractionResult";
import type { MediaThumbnailRequest } from "./MediaThumbnailRequest";
import type { MediaThumbnailRuntimeCapabilities } from "./MediaThumbnailRuntimeCapabilities";

/**
 * @brief Runtime adapter contract used by the shared thumbnail controller
 */
export interface MediaThumbnailRuntimeAdapter {
  readonly runtimeId: string;

  /**
   * @brief Report which thumbnail extraction features the runtime supports
   *
   * @returns Runtime thumbnail capability snapshot
   */
  getCapabilities(): MediaThumbnailRuntimeCapabilities;

  /**
   * @brief Extract one thumbnail for the supplied shared request
   *
   * @param request - Shared extraction request emitted by the thumbnail controller
   *
   * @returns Runtime thumbnail result ready for cache storage
   */
  extractThumbnail(
    request: MediaThumbnailRequest,
  ): MediaThumbnailExtractionResult | Promise<MediaThumbnailExtractionResult>;
}
