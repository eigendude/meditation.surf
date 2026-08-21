/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PreviewFarmEvictionReason } from "../preview/PreviewFarmEvictionReason";

/**
 * @brief Structured preview-domain telemetry event
 */
export type PreviewTelemetryEvent =
  | {
      domain: "preview";
      kind:
        | "warm-requested"
        | "warm-completed"
        | "warm-reused"
        | "activation-success"
        | "activation-failure"
        | "reuse-hit"
        | "reuse-miss";
      occurredAtMs: number;
      sessionId: string | null;
      itemId: string | null;
      sourceId: string | null;
      latencyMs: number | null;
      reason: string | null;
    }
  | {
      domain: "preview";
      kind: "evicted";
      occurredAtMs: number;
      sessionId: string | null;
      itemId: string | null;
      sourceId: string | null;
      latencyMs: null;
      reason: PreviewFarmEvictionReason | string | null;
    };
