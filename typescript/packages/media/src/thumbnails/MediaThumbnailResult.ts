/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  DerivedArtifactKey,
  VfsCacheLayer,
  VfsCacheLookupStep,
} from "@meditation-surf/vfs";

import type { AudioPolicyDecision } from "../audio/AudioPolicyDecision";
import type { CustomDecodeSnapshot } from "../custom-decode/CustomDecodeSnapshot";
import type { RendererSnapshot } from "../rendering/RendererSnapshot";
import type { MediaThumbnailExtractionAttempt } from "./MediaThumbnailExtractionAttempt";
import type { MediaThumbnailSelectionDecision } from "./MediaThumbnailSelectionDecision";

/**
 * @brief Runtime thumbnail payload that can be rendered by an app shell
 */
export type MediaThumbnailResult = {
  sourceId: string;
  artifactKey: DerivedArtifactKey;
  imageUrl: string;
  width: number;
  height: number;
  frameTimeMs: number | null;
  extractedAt: number;
  wasApproximate: boolean;
  debug: {
    resolvedLayer: VfsCacheLayer;
    lookupSteps: VfsCacheLookupStep[];
    reusedFromVfs: boolean;
    fallbackReason: string | null;
    audioPolicyDecision: AudioPolicyDecision;
    extractionAttempt: MediaThumbnailExtractionAttempt;
    selectionDecision: MediaThumbnailSelectionDecision;
    customDecode: CustomDecodeSnapshot | null;
    renderer: RendererSnapshot | null;
  };
};
