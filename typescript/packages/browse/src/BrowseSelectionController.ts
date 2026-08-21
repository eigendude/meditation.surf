/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Snapshot of the shared browse selection model
 */
export type BrowseSelectionState = {
  hasSelectedItem: boolean;
  selectedRowIndex: number;
  selectedItemIndex: number;
};

/**
 * @brief Listener signature used by the shared browse selection controller
 */
export type BrowseSelectionStateListener = (
  state: BrowseSelectionState,
) => void;

/**
 * @brief Own the shared browse selection semantics for every app surface
 *
 * Selection is intentionally separate from focus. The experience starts with
 * no explicit selection so future playback or details flows can opt into
 * selection deliberately instead of inheriting focus or playback implicitly.
 */
export class BrowseSelectionController {
  private readonly stateListeners: Set<BrowseSelectionStateListener>;

  private rowItemCounts: number[];
  private state: BrowseSelectionState;

  /**
   * @brief Create the shared browse selection controller
   *
   * @param rowItemCounts - Initial item counts for each browse row
   */
  public constructor(rowItemCounts: readonly number[] = []) {
    this.stateListeners = new Set<BrowseSelectionStateListener>();
    this.rowItemCounts = [...rowItemCounts];
    this.state = this.createClampedState({
      hasSelectedItem: false,
      selectedItemIndex: 0,
      selectedRowIndex: 0,
    });
  }

  /**
   * @brief Return the current shared browse selection state
   *
   * @returns Current browse selection snapshot
   */
  public getState(): BrowseSelectionState {
    return {
      hasSelectedItem: this.state.hasSelectedItem,
      selectedItemIndex: this.state.selectedItemIndex,
      selectedRowIndex: this.state.selectedRowIndex,
    };
  }

  /**
   * @brief Subscribe to browse selection changes
   *
   * @param listener - Callback notified whenever the selection state changes
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: BrowseSelectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());

    return (): void => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * @brief Sync the controller against new row item counts
   *
   * When the selected item disappears, selection clears rather than hopping to
   * a nearby item. That keeps selection explicit and avoids silent playback- or
   * detail-target changes when browse content shifts.
   *
   * @param rowItemCounts - Latest item counts for each browse row
   */
  public syncRows(rowItemCounts: readonly number[]): void {
    this.rowItemCounts = [...rowItemCounts];
    this.transitionTo(this.createClampedState(this.state));
  }

  /**
   * @brief Select a specific item inside a specific row
   *
   * @param rowIndex - Row containing the selected item
   * @param itemIndex - Item position to mark as selected
   */
  public selectItem(rowIndex: number, itemIndex: number): void {
    if (!this.isValidRowIndex(rowIndex)) {
      return;
    }

    if ((this.rowItemCounts[rowIndex] ?? 0) <= 0) {
      return;
    }

    this.transitionTo(
      this.createClampedState({
        hasSelectedItem: true,
        selectedItemIndex: itemIndex,
        selectedRowIndex: rowIndex,
      }),
    );
  }

  /**
   * @brief Clear the current explicit selection
   */
  public clearSelection(): void {
    this.transitionTo(
      this.createClampedState({
        hasSelectedItem: false,
        selectedItemIndex: this.state.selectedItemIndex,
        selectedRowIndex: this.state.selectedRowIndex,
      }),
    );
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
  private createClampedState(
    state: BrowseSelectionState,
  ): BrowseSelectionState {
    const firstFocusableRowIndex: number | null = this.findFocusableRowIndex(
      -1,
      1,
    );

    if (firstFocusableRowIndex === null) {
      return {
        hasSelectedItem: false,
        selectedItemIndex: 0,
        selectedRowIndex: 0,
      };
    }

    const resolvedRowIndex: number = this.resolveRowIndex(
      state.selectedRowIndex,
      firstFocusableRowIndex,
    );
    const rowItemCount: number = this.rowItemCounts[resolvedRowIndex] ?? 0;

    if (rowItemCount <= 0) {
      return {
        hasSelectedItem: false,
        selectedItemIndex: 0,
        selectedRowIndex: resolvedRowIndex,
      };
    }

    if (
      !state.hasSelectedItem ||
      !this.isSelectableIndex(state.selectedRowIndex, state.selectedItemIndex)
    ) {
      return {
        hasSelectedItem: false,
        selectedItemIndex: Math.max(
          0,
          Math.min(rowItemCount - 1, state.selectedItemIndex),
        ),
        selectedRowIndex: resolvedRowIndex,
      };
    }

    return {
      hasSelectedItem: true,
      selectedItemIndex: Math.max(
        0,
        Math.min(rowItemCount - 1, state.selectedItemIndex),
      ),
      selectedRowIndex: resolvedRowIndex,
    };
  }

  /**
   * @brief Resolve a requested row to the nearest currently focusable row
   *
   * @param requestedRowIndex - Row index requested by the caller
   * @param fallbackRowIndex - First focusable row available in the content
   *
   * @returns Row index that is safe for the current content
   */
  private resolveRowIndex(
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
   * @brief Determine whether one selected item still exists
   *
   * @param rowIndex - Row containing the selected item
   * @param itemIndex - Selected item position inside that row
   *
   * @returns `true` when the item still exists
   */
  private isSelectableIndex(rowIndex: number, itemIndex: number): boolean {
    const rowItemCount: number = this.rowItemCounts[rowIndex] ?? 0;

    return rowItemCount > 0 && itemIndex >= 0 && itemIndex < rowItemCount;
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
   * @brief Publish a selection-state change only when the snapshot differs
   *
   * @param nextState - Candidate next browse selection state
   */
  private transitionTo(nextState: BrowseSelectionState): void {
    if (this.areStatesEqual(this.state, nextState)) {
      return;
    }

    this.state = nextState;

    for (const stateListener of this.stateListeners) {
      stateListener(this.getState());
    }
  }

  /**
   * @brief Compare two browse selection snapshots for semantic equality
   *
   * @param previousState - Current browse selection state
   * @param nextState - Candidate next browse selection state
   *
   * @returns `true` when both snapshots describe the same selection
   */
  private areStatesEqual(
    previousState: BrowseSelectionState,
    nextState: BrowseSelectionState,
  ): boolean {
    return (
      previousState.hasSelectedItem === nextState.hasSelectedItem &&
      previousState.selectedRowIndex === nextState.selectedRowIndex &&
      previousState.selectedItemIndex === nextState.selectedItemIndex
    );
  }
}
