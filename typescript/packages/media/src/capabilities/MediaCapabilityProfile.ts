/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PreviewSchedulerBudget } from "../preview/PreviewSchedulerBudget";

/**
 * @brief Declarative media capabilities that an app runtime can report
 */
export type MediaCapabilityProfile = {
  supportsNativePlayback: boolean;
  supportsShakaPlayback: boolean;
  supportsPreviewVideo: boolean;
  supportsThumbnailExtraction: boolean;
  supportsWebCodecs: boolean;
  supportsCustomDecodeThumbnailExtraction: boolean;
  supportsCustomDecodePreviewWarm: boolean;
  supportsCustomDecodePreviewActive: boolean;
  supportsWorkerOffload: boolean;
  supportsWebGPUPreferred: boolean;
  supportsWebGLFallback: boolean;
  supportsCustomPipeline: boolean;
  supportsPremiumPlayback: boolean;
  previewSchedulerBudget: PreviewSchedulerBudget;
};
