/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared media roles that drive lane and quality intent selection
 */
export type VariantRolePolicy =
  | "thumbnail-extract"
  | "thumbnail-preview"
  | "preview-warm"
  | "preview-active"
  | "background-warm"
  | "background-playback";
