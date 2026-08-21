/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Explainable reasons that may adjust preview budgets
 */
export type AdaptiveBudgetDecisionReason =
  | "stable-default-budget"
  | "preview-failure-guardrail"
  | "poor-preview-reuse"
  | "good-preview-reuse"
  | "renderer-fallback-churn"
  | "custom-decode-failure-rate";
