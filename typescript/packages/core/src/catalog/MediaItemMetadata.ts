/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Human-readable catalog metadata associated with a media item
 *
 * The shared catalog fixture stores these values in presentation-ready form so
 * all runtimes can consume the same content metadata without adding UI-only
 * ad hoc fields later.
 */
export interface MediaItemMetadataInit {
  readonly duration: string;
  readonly status: string;
  readonly created: string;
  readonly viewCount: string;
  readonly resolution: string;
  readonly aspectRatio: string;
  readonly videoCodec: string;
  readonly audioCodec: string;
  readonly channelLayout: string;
}

/**
 * @brief A single tag-style value shown in the future stream metadata row
 */
export interface MediaItemMetadataTag {
  readonly id:
    | "duration"
    | "resolution"
    | "aspectRatio"
    | "videoCodec"
    | "audioCodec"
    | "channelLayout";
  readonly value: string;
}

/**
 * @brief Ordered stream-detail metadata prepared for future UI rendering
 */
export interface MediaItemMetadataRow {
  readonly created: string;
  readonly tags: readonly MediaItemMetadataTag[];
}

/**
 * @brief Human-readable catalog metadata associated with a media item
 */
export class MediaItemMetadata {
  public readonly duration: string;
  public readonly status: string;
  public readonly created: string;
  public readonly viewCount: string;
  public readonly resolution: string;
  public readonly aspectRatio: string;
  public readonly videoCodec: string;
  public readonly audioCodec: string;
  public readonly channelLayout: string;

  /**
   * @brief Create the shared metadata attached to a media item
   *
   * @param init - Presentation-ready metadata labels shared across runtimes
   */
  public constructor(init: MediaItemMetadataInit) {
    this.duration = init.duration;
    this.status = init.status;
    this.created = init.created;
    this.viewCount = init.viewCount;
    this.resolution = init.resolution;
    this.aspectRatio = init.aspectRatio;
    this.videoCodec = init.videoCodec;
    this.audioCodec = init.audioCodec;
    this.channelLayout = init.channelLayout;
  }

  /**
   * @brief Return the calendar-style created label for future metadata rows
   *
   * @returns Human-readable created label displayed next to a calendar icon
   */
  public getCreatedLabel(): string {
    return this.created;
  }

  /**
   * @brief Return the chip-style stream details in future UI display order
   *
   * The calendar item is intentionally excluded here so UI layers can render
   * the created label separately next to an icon before the boxed tag chips.
   * Duration remains in the shared metadata model for thumbnail secondary text,
   * but the hero badge row intentionally starts with resolution.
   *
   * @returns Ordered tag values for resolution, codecs, and layout
   */
  public getOrderedStreamDetailTags(): readonly MediaItemMetadataTag[] {
    return [
      {
        id: "resolution",
        value: this.resolution,
      },
      {
        id: "aspectRatio",
        value: this.aspectRatio,
      },
      {
        id: "videoCodec",
        value: this.videoCodec,
      },
      {
        id: "audioCodec",
        value: this.audioCodec,
      },
      {
        id: "channelLayout",
        value: this.channelLayout,
      },
    ];
  }

  /**
   * @brief Return the full future metadata row in presentation order
   *
   * @returns Created label plus the ordered boxed-tag values
   */
  public getOrderedStreamDetailRow(): MediaItemMetadataRow {
    return {
      created: this.getCreatedLabel(),
      tags: this.getOrderedStreamDetailTags(),
    };
  }
}
