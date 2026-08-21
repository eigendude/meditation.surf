/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { ByteRange } from "../ranges/RangeTypes";
import type { ReadableFileDescriptor } from "../sources/ReadableFileTypes";

/**
 * @brief Storage-facing torrent source descriptor kept explicit but unsupported
 */
export type TorrentSourceDescriptor = ReadableFileDescriptor & {
  kind: "torrent";
  infoHash: string | null;
};

/**
 * @brief Piece-store contract reserved for future torrent-backed persistence
 */
export interface TorrentPieceStore {
  hasRange(source: TorrentSourceDescriptor, range: ByteRange): Promise<boolean>;
  readRange(
    source: TorrentSourceDescriptor,
    range: ByteRange,
  ): Promise<Uint8Array | null>;
}

/**
 * @brief Future torrent-origin adapter contract kept stubbed in this phase
 */
export interface TorrentOriginAdapter {
  createSession(source: TorrentSourceDescriptor): Promise<void>;
}

/**
 * @brief Explicit unsupported torrent adapter used during the current phase
 */
export class UnsupportedTorrentOriginAdapter implements TorrentOriginAdapter {
  /**
   * @inheritdoc
   */
  public async createSession(source: TorrentSourceDescriptor): Promise<void> {
    void source;
    throw new Error(
      "Torrent-backed streaming is intentionally stubbed in this phase.",
    );
  }
}
