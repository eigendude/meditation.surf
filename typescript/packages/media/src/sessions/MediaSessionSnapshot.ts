/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaSessionDescriptor } from "./MediaSessionDescriptor";
import type { MediaSessionState } from "./MediaSessionState";
import type { MediaWarmth } from "./MediaWarmth";

/**
 * @brief Immutable shared state published for one logical media session
 */
export type MediaSessionSnapshot = {
  descriptor: MediaSessionDescriptor;
  state: MediaSessionState;
  warmth: MediaWarmth;
  failureReason: string | null;
};
