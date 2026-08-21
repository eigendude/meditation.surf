/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief All abstract browse input intents understood by shared input layers
 */
export type BrowseInputIntentType =
  | "enterPointerMode"
  | "enterDirectionalMode"
  | "moveLeft"
  | "moveRight"
  | "moveUp"
  | "moveDown"
  | "focusItem"
  | "activateFocusedItem"
  | "activateItem";

/**
 * @brief Shared directional browse intents
 */
export type BrowseDirectionalInputIntent =
  | { type: "moveLeft" }
  | { type: "moveRight" }
  | { type: "moveUp" }
  | { type: "moveDown" };

/**
 * @brief Shared mode-transition browse intents
 */
export type BrowseModeInputIntent =
  | { type: "enterPointerMode" }
  | { type: "enterDirectionalMode" };

/**
 * @brief Shared direct-focus browse intent
 */
export type BrowseFocusItemInputIntent = {
  type: "focusItem";
  rowIndex: number;
  itemIndex: number;
};

/**
 * @brief Shared browse activation intent
 */
export type BrowseActivateFocusedItemInputIntent = {
  type: "activateFocusedItem";
};

/**
 * @brief Shared browse activation intent targeting one explicit item
 */
export type BrowseActivateItemInputIntent = {
  type: "activateItem";
  rowIndex: number;
  itemIndex: number;
};

/**
 * @brief One abstract browse input intent emitted by platform adapters
 */
export type BrowseInputIntent =
  | BrowseDirectionalInputIntent
  | BrowseModeInputIntent
  | BrowseFocusItemInputIntent
  | BrowseActivateFocusedItemInputIntent
  | BrowseActivateItemInputIntent;

/**
 * @brief Backward-compatible alias for browse input intent payloads
 */
export type BrowseInputCommand = BrowseInputIntent;
