/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaSessionRole } from "../sessions/MediaSessionRole";
import type { VariantRolePolicy } from "../variant-policy/VariantRolePolicy";
import type { RendererBackendKind } from "./RendererBackendKind";

/**
 * @brief Runtime-agnostic binding summary for one routed renderer session
 */
export type RendererSessionBinding = {
  sessionId: string;
  sessionRole: MediaSessionRole;
  variantRole: VariantRolePolicy | null;
  backendKind: RendererBackendKind;
  target:
    | "preview-surface"
    | "thumbnail-surface"
    | "extraction-surface"
    | "none";
};
