/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaInventoryProvider } from "../inventory/MediaInventoryProvider";
import type { MediaExecutionCommand } from "./MediaExecutionCommand";
import type { MediaExecutionResult } from "./MediaExecutionResult";
import type { MediaRuntimeCapabilities } from "./MediaRuntimeCapabilities";

/**
 * @brief Runtime adapter contract implemented by each app shell
 */
export interface MediaRuntimeAdapter extends MediaInventoryProvider {
  readonly runtimeId: string;

  /**
   * @brief Report which execution behaviors are currently supported
   *
   * @returns Runtime execution capability snapshot
   */
  getCapabilities(): MediaRuntimeCapabilities;

  /**
   * @brief Execute one shared runtime command
   *
   * @param command - Shared execution command emitted by the media kernel
   *
   * @returns Result reported by the app shell
   */
  execute(
    command: MediaExecutionCommand,
  ): MediaExecutionResult | Promise<MediaExecutionResult>;
}
