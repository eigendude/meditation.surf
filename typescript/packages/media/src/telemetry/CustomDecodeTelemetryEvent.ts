/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CustomDecodeLane } from "../custom-decode/CustomDecodeLane";

/**
 * @brief Structured custom-decode telemetry event
 */
export type CustomDecodeTelemetryEvent = {
  domain: "custom-decode";
  kind: "used" | "fallback" | "failed";
  occurredAtMs: number;
  lane: CustomDecodeLane | null;
  sourceId: string | null;
  reason: string | null;
};
