/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";
import type { CustomDecodeCapability } from "./CustomDecodeCapability";
import type { CustomDecodeDecision } from "./CustomDecodeDecision";
import type { CustomDecodeSnapshot } from "./CustomDecodeSnapshot";

/**
 * @brief Runtime-owned adapter contract for one custom decode session attempt
 */
export interface CustomDecodeSessionAdapter {
  /**
   * @brief Open or reuse one role-scoped custom decode session
   *
   * @param sourceDescriptor - Shared source descriptor being decoded
   * @param capability - Shared custom decode capability for the current role
   * @param decision - Shared custom decode decision for the current role
   *
   * @returns Debug snapshot describing the prepared session
   */
  open(
    sourceDescriptor: MediaSourceDescriptor,
    capability: CustomDecodeCapability,
    decision: CustomDecodeDecision,
  ): Promise<CustomDecodeSnapshot>;

  /**
   * @brief Close the runtime session and release transient frame state
   */
  close(): Promise<void>;
}
