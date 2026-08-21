/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief High-level readable-source family inferred from playback metadata
 */
export type ReadableFileKind = "hls" | "mp4" | "torrent" | "unknown";

/**
 * @brief Generic origin family used for storage-facing source inspection
 */
export type OriginType = "http" | "magnet" | "torrent-file" | "unknown";

/**
 * @brief Minimal input payload required to resolve one readable source
 */
export type ReadableFilePlaybackSource = {
  url: string;
  mimeType: string | null;
  posterUrl: string | null;
};

/**
 * @brief Stable storage-facing source descriptor consumed by media and VFS
 */
export type ReadableFileDescriptor = {
  sourceId: string;
  kind: ReadableFileKind;
  originType: OriginType;
  url: string;
  mimeType: string | null;
  posterUrl: string | null;
};

/**
 * @brief Build stable readable-source descriptors from playback metadata
 */
export class ReadableFileDescriptorFactory {
  /**
   * @brief Create one stable readable-source descriptor
   *
   * @param sourceId - Stable logical identifier chosen by the caller
   * @param playbackSource - Playback metadata that points at readable bytes
   *
   * @returns Storage-facing source descriptor
   */
  public static create(
    sourceId: string,
    playbackSource: ReadableFilePlaybackSource,
  ): ReadableFileDescriptor {
    const sourceKind: ReadableFileKind = this.inferReadableFileKind(
      playbackSource.url,
      playbackSource.mimeType,
    );
    const originType: OriginType = this.inferOriginType(playbackSource.url);

    return {
      sourceId,
      kind: sourceKind,
      originType,
      url: playbackSource.url,
      mimeType: playbackSource.mimeType,
      posterUrl: playbackSource.posterUrl,
    };
  }

  /**
   * @brief Infer the high-level readable-source kind from URL and MIME type
   *
   * @param url - Playback URL to inspect
   * @param mimeType - Optional MIME type supplied by the caller
   *
   * @returns Best-effort storage-facing source kind
   */
  private static inferReadableFileKind(
    url: string,
    mimeType: string | null,
  ): ReadableFileKind {
    const normalizedUrl: string = url.toLowerCase();
    const normalizedMimeType: string = (mimeType ?? "").toLowerCase();

    if (
      normalizedMimeType.includes("mpegurl") ||
      normalizedMimeType.includes("application/vnd.apple.mpegurl") ||
      normalizedUrl.endsWith(".m3u8")
    ) {
      return "hls";
    }

    if (normalizedMimeType.includes("mp4") || normalizedUrl.endsWith(".mp4")) {
      return "mp4";
    }

    if (
      normalizedMimeType.includes("bittorrent") ||
      normalizedUrl.startsWith("magnet:") ||
      normalizedUrl.endsWith(".torrent")
    ) {
      return "torrent";
    }

    return "unknown";
  }

  /**
   * @brief Infer the generic origin family from the supplied URL
   *
   * @param url - Playback URL to inspect
   *
   * @returns Generic origin family
   */
  private static inferOriginType(url: string): OriginType {
    const normalizedUrl: string = url.toLowerCase();

    if (
      normalizedUrl.startsWith("http://") ||
      normalizedUrl.startsWith("https://")
    ) {
      return "http";
    }

    if (normalizedUrl.startsWith("magnet:")) {
      return "magnet";
    }

    if (normalizedUrl.endsWith(".torrent")) {
      return "torrent-file";
    }

    return "unknown";
  }
}
