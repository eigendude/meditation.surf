/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared frame-handoff metadata that a renderer backend can inspect
 */
export type RendererFrameHandle = {
  representation:
    | "image-bitmap"
    | "canvas-image-source"
    | "image-url"
    | "unavailable";
  origin:
    | "custom-decode"
    | "thumbnail-result"
    | "legacy-presentation"
    | "unknown";
  width: number;
  height: number;
  frameTimeMs: number | null;
};
