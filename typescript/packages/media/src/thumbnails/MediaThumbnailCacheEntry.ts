/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaThumbnailDescriptor } from "./MediaThumbnailDescriptor";
import type { MediaThumbnailRequest } from "./MediaThumbnailRequest";
import type { MediaThumbnailResult } from "./MediaThumbnailResult";
import type { MediaThumbnailState } from "./MediaThumbnailState";

/**
 * @brief Shared cache record for one stable thumbnail source identifier
 */
export type MediaThumbnailCacheEntry = {
  descriptor: MediaThumbnailDescriptor;
  state: MediaThumbnailState;
  request: MediaThumbnailRequest | null;
  result: MediaThumbnailResult | null;
  failureReason: string | null;
  isRelevant: boolean;
  lastRequestedAt: number | null;
  lastUpdatedAt: number | null;
};
