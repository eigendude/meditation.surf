/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Fixed-stage thumbnail presentation state rendered by Lightning browse rows
 */
export type LightningThumbnailState = {
  id: string;
  title: string;
  secondaryText: string;
  monogram: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * @brief Fixed-stage row presentation state rendered by the Lightning browse overlay
 */
export type LightningRowState = {
  id: string;
  title: string;
  titleX: number;
  titleY: number;
  items: LightningThumbnailState[];
  rowPosition: number;
  activeItemIndex: number;
  hasFocusedItem: boolean;
  isActiveRow: boolean;
};
