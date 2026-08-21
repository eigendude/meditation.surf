/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { RendererBackendKind } from "../rendering/RendererBackendKind";
import type { RuntimeGuardrailReason } from "./RuntimeGuardrailReason";

/**
 * @brief Session-local runtime guardrails derived from bounded telemetry
 */
export type RuntimeGuardrailState = {
  suppressAggressiveWarmExpansion: boolean;
  suppressExtraWarmSessions: boolean;
  disableCustomDecodePreviewWarm: boolean;
  disableRendererBoundPreviewWork: boolean;
  suppressedRendererBackends: RendererBackendKind[];
  preferredRendererBackend: RendererBackendKind | "legacy" | null;
  reasons: RuntimeGuardrailReason[];
  notes: string[];
  evaluatedAtMs: number | null;
};
