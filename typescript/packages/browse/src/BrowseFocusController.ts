/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Snapshot of the shared browse focus model
 */
export type BrowseFocusState = {
  activeRowIndex: number;
  activeItemIndexByRow: number[];
  hasFocusedItem: boolean;
};

/**
 * @brief Listener signature used by the shared browse focus controller
 */
export type BrowseFocusStateListener = (state: BrowseFocusState) => void;

/**
 * @brief Own the shared browse focus semantics for every app surface
 *
 * Row memory is stored in `activeItemIndexByRow`. Changing rows preserves the
 * remembered item index for each row, and returning to a row restores that
 * remembered index automatically after clamping against the latest content.
 */
export class BrowseFocusController {
  private readonly stateListeners: Set<BrowseFocusStateListener>;

  private rowItemCounts: number[];
  private state: BrowseFocusState;

  /**
   * @brief Create the shared browse focus controller
   *
   * @param rowItemCounts - Initial item counts for each browse row
   */
  public constructor(rowItemCounts: readonly number[] = []) {
    this.stateListeners = new Set<BrowseFocusStateListener>();
    this.rowItemCounts = [...rowItemCounts];
    this.state = this.createClampedState({
      activeRowIndex: 0,
      activeItemIndexByRow: this.rowItemCounts.map((): number => 0),
      hasFocusedItem: false,
    });
  }

  /**
   * @brief Return the current shared browse focus state
   *
   * @returns Current browse focus snapshot
   */
  public getState(): BrowseFocusState {
    return {
      activeRowIndex: this.state.activeRowIndex,
      activeItemIndexByRow: [...this.state.activeItemIndexByRow],
      hasFocusedItem: this.state.hasFocusedItem,
    };
  }

  /**
   * @brief Subscribe to browse focus changes
   *
   * @param listener - Callback notified whenever the focus state changes
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: BrowseFocusStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());

    return (): void => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * @brief Sync the controller against new row item counts
   *
   * @param rowItemCounts - Latest item counts for each browse row
   */
  public syncRows(rowItemCounts: readonly number[]): void {
    this.rowItemCounts = [...rowItemCounts];
    this.transitionTo(this.createClampedState(this.state));
  }

  /**
   * @brief Move focus left within the active browse row
   */
  public moveLeft(): void {
    this.focusItem(
      this.state.activeRowIndex,
      this.getActiveItemIndex(this.state.activeRowIndex) - 1,
    );
  }

  /**
   * @brief Move focus right within the active browse row
   */
  public moveRight(): void {
    this.focusItem(
      this.state.activeRowIndex,
      this.getActiveItemIndex(this.state.activeRowIndex) + 1,
    );
  }

  /**
   * @brief Move focus to the previous focusable browse row
   */
  public moveUp(): void {
    const nextRowIndex: number | null = this.findFocusableRowIndex(
      this.state.activeRowIndex,
      -1,
    );

    if (nextRowIndex !== null) {
      this.focusRow(nextRowIndex);
    }
  }

  /**
   * @brief Move focus to the next focusable browse row
   */
  public moveDown(): void {
    const nextRowIndex: number | null = this.findFocusableRowIndex(
      this.state.activeRowIndex,
      1,
    );

    if (nextRowIndex !== null) {
      this.focusRow(nextRowIndex);
    }
  }

  /**
   * @brief Focus a specific item inside a specific row
   *
   * @param rowIndex - Row to activate
   * @param itemIndex - Item to remember and focus inside the row
   */
  public focusItem(rowIndex: number, itemIndex: number): void {
    if (!this.isValidRowIndex(rowIndex)) {
      return;
    }

    const nextState: BrowseFocusState = this.getState();

    nextState.activeRowIndex = rowIndex;
    nextState.activeItemIndexByRow[rowIndex] = this.clampItemIndex(
      rowIndex,
      itemIndex,
    );
    nextState.hasFocusedItem = true;
    this.transitionTo(this.createClampedState(nextState));
  }

  /**
   * @brief Focus a specific row while restoring its remembered item
   *
   * @param rowIndex - Row that should become active
   */
  public focusRow(rowIndex: number): void {
    if (!this.isValidRowIndex(rowIndex)) {
      return;
    }

    const nextState: BrowseFocusState = this.getState();

    nextState.activeRowIndex = rowIndex;
    nextState.hasFocusedItem = true;
    this.transitionTo(this.createClampedState(nextState));
  }

  /**
   * @brief Release all subscribers owned by the controller
   */
  public destroy(): void {
    this.stateListeners.clear();
  }

  /**
   * @brief Clamp a candidate state against the current browse rows
   *
   * @param state - Candidate state before row and item bounds are enforced
   *
   * @returns Safe state aligned with the latest row counts
   */
  private createClampedState(state: BrowseFocusState): BrowseFocusState {
    const activeItemIndexByRow: number[] = this.rowItemCounts.map(
      (rowItemCount: number, rowIndex: number): number => {
        const previousItemIndex: number =
          state.activeItemIndexByRow[rowIndex] ?? 0;

        if (rowItemCount <= 0) {
          return 0;
        }

        return Math.max(0, Math.min(rowItemCount - 1, previousItemIndex));
      },
    );
    const firstFocusableRowIndex: number | null = this.findFocusableRowIndex(
      -1,
      1,
    );

    if (firstFocusableRowIndex === null) {
      return {
        activeRowIndex: 0,
        activeItemIndexByRow,
        hasFocusedItem: state.hasFocusedItem,
      };
    }

    return {
      activeRowIndex: this.resolveActiveRowIndex(
        state.activeRowIndex,
        firstFocusableRowIndex,
      ),
      activeItemIndexByRow,
      hasFocusedItem: state.hasFocusedItem,
    };
  }

  /**
   * @brief Resolve the active row to the nearest currently focusable row
   *
   * @param requestedRowIndex - Row index requested by the caller
   * @param fallbackRowIndex - First focusable row available in the content
   *
   * @returns Active row index that is safe for the current content
   */
  private resolveActiveRowIndex(
    requestedRowIndex: number,
    fallbackRowIndex: number,
  ): number {
    const boundedRowIndex: number = Math.max(
      0,
      Math.min(this.rowItemCounts.length - 1, requestedRowIndex),
    );

    if ((this.rowItemCounts[boundedRowIndex] ?? 0) > 0) {
      return boundedRowIndex;
    }

    const nextRowIndex: number | null = this.findFocusableRowIndex(
      boundedRowIndex,
      1,
    );

    if (nextRowIndex !== null) {
      return nextRowIndex;
    }

    const previousRowIndex: number | null = this.findFocusableRowIndex(
      boundedRowIndex,
      -1,
    );

    return previousRowIndex ?? fallbackRowIndex;
  }

  /**
   * @brief Determine whether a row index currently exists
   *
   * @param rowIndex - Row index to validate
   *
   * @returns `true` when the row exists
   */
  private isValidRowIndex(rowIndex: number): boolean {
    return rowIndex >= 0 && rowIndex < this.rowItemCounts.length;
  }

  /**
   * @brief Clamp one item index against the current row size
   *
   * @param rowIndex - Row containing the item
   * @param itemIndex - Candidate item index
   *
   * @returns Safe item index for the given row
   */
  private clampItemIndex(rowIndex: number, itemIndex: number): number {
    const rowItemCount: number = this.rowItemCounts[rowIndex] ?? 0;

    if (rowItemCount <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(rowItemCount - 1, itemIndex));
  }

  /**
   * @brief Return the remembered item index for one row
   *
   * @param rowIndex - Row whose item memory should be inspected
   *
   * @returns Remembered item index, defaulting to `0`
   */
  private getActiveItemIndex(rowIndex: number): number {
    return this.state.activeItemIndexByRow[rowIndex] ?? 0;
  }

  /**
   * @brief Find the next row that currently contains items
   *
   * @param startRowIndex - Row index to start searching from
   * @param direction - Search direction, either `-1` or `1`
   *
   * @returns Focusable row index, or `null` when none exists
   */
  private findFocusableRowIndex(
    startRowIndex: number,
    direction: -1 | 1,
  ): number | null {
    let candidateRowIndex: number = startRowIndex + direction;

    while (
      candidateRowIndex >= 0 &&
      candidateRowIndex < this.rowItemCounts.length
    ) {
      if ((this.rowItemCounts[candidateRowIndex] ?? 0) > 0) {
        return candidateRowIndex;
      }

      candidateRowIndex += direction;
    }

    return null;
  }

  /**
   * @brief Publish a focus-state change only when the snapshot actually differs
   *
   * @param nextState - Candidate next browse focus state
   */
  private transitionTo(nextState: BrowseFocusState): void {
    if (this.areStatesEqual(this.state, nextState)) {
      return;
    }

    this.state = nextState;

    for (const stateListener of this.stateListeners) {
      stateListener(this.getState());
    }
  }

  /**
   * @brief Compare two browse focus snapshots for semantic equality
   *
   * @param previousState - Current browse focus state
   * @param nextState - Candidate next browse focus state
   *
   * @returns `true` when both snapshots describe the same focus target
   */
  private areStatesEqual(
    previousState: BrowseFocusState,
    nextState: BrowseFocusState,
  ): boolean {
    if (previousState.activeRowIndex !== nextState.activeRowIndex) {
      return false;
    }

    if (previousState.hasFocusedItem !== nextState.hasFocusedItem) {
      return false;
    }

    if (
      previousState.activeItemIndexByRow.length !==
      nextState.activeItemIndexByRow.length
    ) {
      return false;
    }

    return previousState.activeItemIndexByRow.every(
      (itemIndex: number, rowIndex: number): boolean =>
        itemIndex === nextState.activeItemIndexByRow[rowIndex],
    );
  }
}
