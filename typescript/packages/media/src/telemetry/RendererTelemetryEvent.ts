/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { RendererBackendKind } from "../rendering/RendererBackendKind";

/**
 * @brief Structured renderer-domain telemetry event
 */
export type RendererTelemetryEvent = {
  domain: "renderer";
  kind: "route-success" | "route-fallback" | "route-failure";
  occurredAtMs: number;
  backend: RendererBackendKind | "legacy" | null;
  target: "preview" | "thumbnail" | "other";
  reason: string | null;
};
