/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { StartupWarmResult } from "@meditation-surf/vfs";

/**
 * @brief Shared VFS startup debug state surfaced for preview and background work
 */
export type MediaStartupDebugState = {
  phase: "preview-warm" | "committed-playback-startup";
  sourceId: string | null;
  warmResult: StartupWarmResult | null;
  directRuntimeFallbackReason: string | null;
};
