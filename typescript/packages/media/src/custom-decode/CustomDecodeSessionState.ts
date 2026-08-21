/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Runtime-agnostic lifecycle states tracked by one custom decode session
 */
export type CustomDecodeSessionState =
  | "idle"
  | "probing"
  | "loading"
  | "decoding"
  | "first-frame-ready"
  | "previewing"
  | "paused"
  | "failed"
  | "unsupported";
