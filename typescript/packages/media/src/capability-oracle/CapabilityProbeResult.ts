/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRuntimeSupportLevel } from "./MediaRuntimeSupportLevel";

/**
 * @brief Small runtime-agnostic probe summary consumed by the capability oracle
 */
export type CapabilityProbeResult = {
  overallSupportLevel: MediaRuntimeSupportLevel;
  nativeLaneSupportLevel: MediaRuntimeSupportLevel;
  shakaLaneSupportLevel: MediaRuntimeSupportLevel;
  customLaneSupportLevel: MediaRuntimeSupportLevel;
  webCodecsSupportLevel: MediaRuntimeSupportLevel;
  nativeRendererSupportLevel: MediaRuntimeSupportLevel;
  webgpuRendererSupportLevel: MediaRuntimeSupportLevel;
  webglRendererSupportLevel: MediaRuntimeSupportLevel;
  previewRendererRoutingSupportLevel: MediaRuntimeSupportLevel;
  extractionRendererRoutingSupportLevel: MediaRuntimeSupportLevel;
  committedPlaybackBypassesRendererRouter: boolean;
  premiumPlaybackSupportLevel: MediaRuntimeSupportLevel;
  workerOffloadSupportLevel: MediaRuntimeSupportLevel;
};
