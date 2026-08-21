/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Minimal player-local media source contract
 *
 * The shared player only needs a source URL and an optional MIME type to feed
 * the active runtime engine beneath it. Higher-level packages can adapt richer
 * domain objects into this focused contract at the boundary.
 */
export type VideoSource = {
  readonly url: string;
  readonly mimeType?: string;
};
