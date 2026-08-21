/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable reason codes emitted by shared custom decode decisions
 */
export type CustomDecodeDecisionReason =
  | "webcodecs-supported"
  | "webcodecs-unsupported"
  | "role-allows-custom-decode"
  | "role-disallows-custom-decode"
  | "runtime-fallback"
  | "source-unsupported"
  | "container-unsupported"
  | "implementation-stub"
  | "preferred-for-preview"
  | "preferred-for-extraction";
