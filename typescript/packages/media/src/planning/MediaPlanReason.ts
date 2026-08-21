/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaIntentType } from "../intent/MediaIntentType";

/**
 * @brief Serializable explanation for why a logical session was planned
 */
export type MediaPlanReason = {
  intentType: MediaIntentType;
  kind:
    | "focused-item"
    | "focused-delay-elapsed-item"
    | "focus-neighbor-item"
    | "visible-item"
    | "recent-focus-item"
    | "selected-item"
    | "background-active-item"
    | "preserve-existing-background-session";
  message: string;
};
