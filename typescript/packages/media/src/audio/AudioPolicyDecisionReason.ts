/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable reasons explaining why one audio policy decision was selected
 */
export type AudioPolicyDecisionReason =
  | "preview-must-be-muted"
  | "extract-must-be-silent"
  | "committed-playback"
  | "inventory-full"
  | "inventory-partial"
  | "inventory-unavailable"
  | "premium-supported"
  | "premium-unsupported"
  | "premium-track-unavailable"
  | "runtime-limited"
  | "adapter-limited"
  | "fallback-from-premium"
  | "default-track-selected"
  | "fallback-track-selected"
  | "default-runtime-audio"
  | "no-audio-path";
