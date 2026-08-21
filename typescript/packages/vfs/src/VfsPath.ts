/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Inspectable virtual path derived from one stable cache key
 */
export class VfsPath {
  public readonly segments: readonly string[];

  /**
   * @brief Build one immutable VFS path
   *
   * @param segments - Ordered path segments
   */
  public constructor(segments: readonly string[]) {
    this.segments = [...segments];
  }

  /**
   * @brief Build one VFS path from a stable cache key
   *
   * @param cacheKey - Stable cache key to inspect
   *
   * @returns Inspectable VFS path
   */
  public static fromCacheKey(cacheKey: string): VfsPath {
    const normalizedKey: string = cacheKey.replaceAll("|", ":");
    const segments: string[] = normalizedKey
      .split(":")
      .map((segment: string): string => segment.trim())
      .filter((segment: string): boolean => segment.length > 0);

    return new VfsPath(segments);
  }

  /**
   * @brief Return the normalized slash-separated path string
   *
   * @returns Slash-separated path
   */
  public toString(): string {
    return `/${this.segments.join("/")}`;
  }
}
