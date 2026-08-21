/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { DEFAULT_CACHE_POLICY } from "../cache/CacheTypes";
import type { RangeReadRequest, RangeReadResult } from "../ranges/RangeTypes";

/**
 * @brief Conservative HTTP origin adapter for manifest and byte-range reads
 */
export class HttpOriginAdapter {
  /**
   * @brief Read one range from an HTTP-backed readable source
   *
   * @param request - Range read request being satisfied from origin
   *
   * @returns Range read result backed by origin bytes
   */
  public async readRange(request: RangeReadRequest): Promise<RangeReadResult> {
    const endOffsetExclusive: number | null = request.range.endOffsetExclusive;
    const rangeHeader: string =
      endOffsetExclusive === null
        ? `bytes=${request.range.startOffset}-`
        : `bytes=${request.range.startOffset}-${Math.max(request.range.startOffset, endOffsetExclusive - 1)}`;
    const response: Response = await globalThis.fetch(request.source.url, {
      headers: {
        Range: rangeHeader,
      },
    });
    const responseBuffer: ArrayBuffer = await response.arrayBuffer();
    const responseBytes: Uint8Array = new Uint8Array(responseBuffer);

    return {
      key: `${request.source.sourceId}:${request.purpose}:${rangeHeader}`,
      source: request.source,
      purpose: request.purpose,
      range: request.range,
      tier: request.cachePolicy === DEFAULT_CACHE_POLICY ? "origin" : "origin",
      bytes: responseBytes,
      contentType: response.headers.get("content-type"),
      fetchedAt: Date.now(),
      statusCode: response.status,
    };
  }

  /**
   * @brief Read one manifest text payload from an HTTP-backed source
   *
   * @param sourceUrl - Manifest URL being fetched
   *
   * @returns Manifest text and response content type
   */
  public async readText(
    sourceUrl: string,
  ): Promise<{ contentType: string | null; statusCode: number; text: string }> {
    const response: Response = await globalThis.fetch(sourceUrl);
    const text: string = await response.text();

    return {
      contentType: response.headers.get("content-type"),
      statusCode: response.status,
      text,
    };
  }
}
