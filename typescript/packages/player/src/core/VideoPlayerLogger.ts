/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Lightweight logger for grep-friendly player lifecycle output
 */
export class VideoPlayerLogger {
  /**
   * @brief Emit one lifecycle log line
   *
   * @param message - Short lifecycle message
   * @param detail - Optional detail string
   */
  public log(message: string, detail: string): void {
    console.info(`[VideoPlayer] ${message}: ${detail}`);
  }

  /**
   * @brief Emit one error log line
   *
   * @param message - Short lifecycle message
   * @param error - Associated runtime error
   */
  public logError(message: string, error: Error): void {
    console.error(`[VideoPlayer] ${message}: ${error.message}`);
  }

  /**
   * @brief Emit one teardown failure log with the original thrown value
   *
   * @param message - Short lifecycle message
   * @param error - Original thrown value
   */
  public logFailure(message: string, error: unknown): void {
    console.error(`[VideoPlayer] ${message}`, error);
  }
}
