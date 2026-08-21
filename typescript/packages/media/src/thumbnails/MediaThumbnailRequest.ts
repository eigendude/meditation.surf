/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AudioPolicyDecision } from "../audio/AudioPolicyDecision";
import type { CustomDecodeCapability } from "../custom-decode/CustomDecodeCapability";
import type { CustomDecodeDecision } from "../custom-decode/CustomDecodeDecision";
import type { RendererCapability } from "../rendering/RendererCapability";
import type { RendererDecision } from "../rendering/RendererDecision";
import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";
import type { VariantSelectionDecision } from "../variant-policy/VariantSelectionDecision";
import type { MediaThumbnailDescriptor } from "./MediaThumbnailDescriptor";
import type {
  MediaThumbnailExtractionPolicy,
  MediaThumbnailPriority,
  MediaThumbnailQuality,
} from "./MediaThumbnailExtractionPolicy";

/**
 * @brief One runtime-agnostic thumbnail extraction request
 *
 * The request keeps the shared source identity explicit so controllers can
 * dedupe work without knowing anything about the eventual app-shell runtime.
 */
export type MediaThumbnailRequest = {
  descriptor: MediaThumbnailDescriptor;
  sourceDescriptor: MediaSourceDescriptor;
  sourceId: string;
  priorityHint: MediaThumbnailPriority;
  qualityHint: MediaThumbnailQuality;
  targetWidth: number | null;
  targetHeight: number | null;
  timeHintMs: number | null;
  variantSelection: VariantSelectionDecision;
  extractionPolicy: MediaThumbnailExtractionPolicy;
  audioPolicyDecision: AudioPolicyDecision;
  customDecodeCapability: CustomDecodeCapability;
  customDecodeDecision: CustomDecodeDecision;
  rendererCapability: RendererCapability;
  rendererDecision: RendererDecision;
};
