/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable reason codes emitted by shared renderer decisions and snapshots
 */
export type RendererDecisionReason =
  | "webgpu-supported"
  | "webgpu-unsupported"
  | "webgl-supported"
  | "webgl-fallback"
  | "role-prefers-renderer"
  | "custom-decode-source"
  | "runtime-fallback"
  | "implementation-stub";
