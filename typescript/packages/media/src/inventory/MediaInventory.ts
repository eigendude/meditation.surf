/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaAudioTrackInfo } from "./MediaAudioTrackInfo";
import type { MediaInventorySource } from "./MediaInventorySource";
import type { MediaTextTrackInfo } from "./MediaTextTrackInfo";
import type { MediaVariantInfo } from "./MediaVariantInfo";

/**
 * @brief Shared inventory snapshot describing the tracks available for one source
 */
export type MediaInventory = {
  sourceId: string | null;
  inventorySource: MediaInventorySource;
  variants: MediaVariantInfo[];
  audioTracks: MediaAudioTrackInfo[];
  textTracks: MediaTextTrackInfo[];
};
