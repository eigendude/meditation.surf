/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { ByteRange } from "../ranges/RangeTypes";

/**
 * @brief Parsed HLS init segment reference used by startup warming
 */
export type HlsInitSegmentReference = {
  url: string;
  range: ByteRange | null;
};

/**
 * @brief Small pragmatic parser for the first startup-relevant HLS references
 *
 * The parser intentionally focuses on startup acceleration rather than complete
 * HLS compliance. It resolves the first practical media playlist, init segment,
 * and first segment URL so VFS can prewarm the highest-value startup bytes.
 */
export class StartupManifestParser {
  /**
   * @brief Resolve the first concrete media-playlist URL from one HLS manifest
   *
   * @param manifestUrl - Absolute manifest URL being parsed
   * @param manifestText - Manifest text payload
   *
   * @returns Concrete media-playlist URL, or the original URL when already media
   */
  public static resolveMediaPlaylistUrl(
    manifestUrl: string,
    manifestText: string,
  ): string {
    const manifestLines: string[] = this.getTrimmedManifestLines(manifestText);
    let previousLine: string | null = null;

    for (const manifestLine of manifestLines) {
      if (!manifestLine.startsWith("#")) {
        const isVariantPlaylist: boolean =
          previousLine?.startsWith("#EXT-X-STREAM-INF:") === true ||
          manifestLine.endsWith(".m3u8");

        if (isVariantPlaylist) {
          return this.resolveUrl(manifestUrl, manifestLine);
        }
      }

      previousLine = manifestLine;
    }

    return manifestUrl;
  }

  /**
   * @brief Resolve the first explicit init segment reference from one manifest
   *
   * @param manifestUrl - Absolute media-playlist URL being parsed
   * @param manifestText - Manifest text payload
   *
   * @returns Init segment reference, or `null` when the playlist has none
   */
  public static resolveInitSegmentReference(
    manifestUrl: string,
    manifestText: string,
  ): HlsInitSegmentReference | null {
    const manifestLines: string[] = this.getTrimmedManifestLines(manifestText);

    for (const manifestLine of manifestLines) {
      if (!manifestLine.startsWith("#EXT-X-MAP:")) {
        continue;
      }

      const uriValue: string | null = this.extractQuotedAttributeValue(
        manifestLine,
        "URI",
      );

      if (uriValue === null) {
        return null;
      }

      return {
        url: this.resolveUrl(manifestUrl, uriValue),
        range: this.extractByteRangeAttribute(manifestLine),
      };
    }

    return null;
  }

  /**
   * @brief Resolve the first media-segment URL from one media playlist
   *
   * @param manifestUrl - Absolute media-playlist URL being parsed
   * @param manifestText - Manifest text payload
   *
   * @returns First segment URL, or `null` when no segment line was present
   */
  public static resolveFirstSegmentUrl(
    manifestUrl: string,
    manifestText: string,
  ): string | null {
    const manifestLines: string[] = this.getTrimmedManifestLines(manifestText);

    for (const manifestLine of manifestLines) {
      if (manifestLine.startsWith("#")) {
        continue;
      }

      if (manifestLine.length === 0) {
        continue;
      }

      return this.resolveUrl(manifestUrl, manifestLine);
    }

    return null;
  }

  /**
   * @brief Split one manifest into trimmed, non-empty lines
   *
   * @param manifestText - Manifest text payload
   *
   * @returns Trimmed manifest lines
   */
  private static getTrimmedManifestLines(manifestText: string): string[] {
    return manifestText
      .split(/\r?\n/u)
      .map((manifestLine: string): string => manifestLine.trim())
      .filter((manifestLine: string): boolean => manifestLine.length > 0);
  }

  /**
   * @brief Resolve one relative HLS reference against its manifest URL
   *
   * @param baseUrl - Absolute manifest URL
   * @param relativeUrl - Relative or absolute HLS reference
   *
   * @returns Absolute URL
   */
  private static resolveUrl(baseUrl: string, relativeUrl: string): string {
    return new URL(relativeUrl, baseUrl).toString();
  }

  /**
   * @brief Extract one quoted attribute value from an HLS attribute list
   *
   * @param manifestLine - Manifest line that carries the attribute list
   * @param attributeName - Attribute name to extract
   *
   * @returns Attribute value, or `null` when absent
   */
  private static extractQuotedAttributeValue(
    manifestLine: string,
    attributeName: string,
  ): string | null {
    const attributePattern: RegExp = new RegExp(
      `${attributeName}="([^"]+)"`,
      "u",
    );
    const match: RegExpMatchArray | null = manifestLine.match(attributePattern);

    return match?.[1] ?? null;
  }

  /**
   * @brief Extract one optional HLS byte-range attribute from an init segment
   *
   * @param manifestLine - `#EXT-X-MAP` line carrying the range attribute
   *
   * @returns Parsed byte range, or `null` when none was supplied
   */
  private static extractByteRangeAttribute(
    manifestLine: string,
  ): ByteRange | null {
    const attributePattern: RegExp = /BYTERANGE="(\d+)(?:@(\d+))?"/u;
    const match: RegExpMatchArray | null = manifestLine.match(attributePattern);

    if (match === null) {
      return null;
    }

    const byteLength: number = Number(match[1]);
    const startOffset: number = Number(match[2] ?? 0);

    return {
      startOffset,
      endOffsetExclusive: startOffset + byteLength,
    };
  }
}
