/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Runtime thumbnail extraction features exposed by one app shell
 */
export type MediaThumbnailRuntimeCapabilities = {
  canExtractFirstFrame: boolean;
  canExtractNonBlackFrame: boolean;
  canExtractFromHiddenMedia: boolean;
  canCacheObjectUrls: boolean;
  canPrioritizeFocusedItem: boolean;
  supportsWebCodecs: boolean;
  supportsCustomDecodeExtraction: boolean;
};
