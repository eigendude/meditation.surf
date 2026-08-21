/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Explicit preview-farm budget shared across planners and runtimes
 */
export type PreviewFarmBudget = {
  maxWarmSessions: number;
  maxActivePreviewSessions: number;
  maxRendererBoundSessions: number;
  maxHiddenSessions: number;
  keepWarmAfterBlurMs: number;
  maxPreviewReuseMs: number;
  maxPreviewOverlapMs: number;
};
