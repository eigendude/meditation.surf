/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaKernelItem } from "../kernel/MediaKernelItem";
import type { PreviewSchedulerDecisionReason } from "./PreviewSchedulerDecisionReason";

/**
 * @brief Browse-derived candidate input used to build preview candidates
 */
export type PreviewCandidateInput<
  TMediaItem extends MediaKernelItem = MediaKernelItem,
> = {
  mediaItem: TMediaItem;
  rowIndex: number;
  itemIndex: number;
  reason: Extract<
    PreviewSchedulerDecisionReason,
    | "focused-item"
    | "focus-neighbor"
    | "likely-next-item"
    | "visible-item"
    | "recent-focus"
  >;
  focusStartedAtMs: number | null;
  lastFocusedAtMs: number | null;
};
