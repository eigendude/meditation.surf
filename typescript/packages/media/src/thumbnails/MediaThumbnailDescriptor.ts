/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";

/**
 * @brief Stable thumbnail identity resolved from one browseable media source
 */
export type MediaThumbnailDescriptor = {
  itemIds: readonly string[];
  sourceId: string;
  sourceDescriptor: MediaSourceDescriptor;
};
