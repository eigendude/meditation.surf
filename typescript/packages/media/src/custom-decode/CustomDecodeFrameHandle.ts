/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared metadata describing one browser-friendly decoded frame handoff
 */
export type CustomDecodeFrameHandle = {
  representation: "image-bitmap" | "canvas-image-source" | "unavailable";
  width: number;
  height: number;
  frameTimeMs: number | null;
};
