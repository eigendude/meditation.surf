/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CustomDecodeSnapshot } from "../custom-decode/CustomDecodeSnapshot";
import type { RendererSnapshot } from "../rendering/RendererSnapshot";
import type { MediaThumbnailExtractionAttempt } from "./MediaThumbnailExtractionAttempt";
import type { MediaThumbnailSelectionDecision } from "./MediaThumbnailSelectionDecision";

/**
 * @brief Raw thumbnail extraction payload emitted by runtime adapters
 *
 * The controller persists this payload through VFS so runtimes no longer own
 * cache identity or object-URL lifecycle details.
 */
export type MediaThumbnailExtractionResult = {
  sourceId: string;
  imagePayload: Blob;
  imageContentType: string;
  width: number;
  height: number;
  frameTimeMs: number | null;
  extractedAt: number;
  wasApproximate: boolean;
  extractionAttempt: MediaThumbnailExtractionAttempt;
  selectionDecision: MediaThumbnailSelectionDecision;
  customDecode: CustomDecodeSnapshot | null;
  renderer: RendererSnapshot | null;
};
