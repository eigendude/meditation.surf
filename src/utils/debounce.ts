/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * Create a function that executes the callback immediately and again after the
 * specified delay if it continues to be invoked. The trailing execution uses
 * the arguments from the last invocation.
 *
 * @param callback - Function to debounce
 * @param waitMs - Milliseconds to wait before the trailing execution
 * @returns A debounced version of the callback
 */
export function debounce<Args extends unknown[]>(
  callback: (...errArgs: Args) => void,
  waitMs: number,
): (...errArgs: Args) => void {
  let timer: number | undefined;

  return (...errArgs: Args): void => {
    if (timer === undefined) {
      callback(...errArgs);
    }

    window.clearTimeout(timer);
    timer = window.setTimeout((): void => {
      callback(...errArgs);
      timer = undefined;
    }, waitMs);
  };
}
