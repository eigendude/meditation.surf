/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief One browse-card preview host registered by the web shell
 */
export type WebPreviewSurfaceEntry = {
  itemId: string;
  hostElement: HTMLDivElement;
};

/**
 * @brief Listener signature used by the web preview surface registry
 */
export type WebPreviewSurfaceRegistryListener = () => void;

/**
 * @brief Track which browse cards can currently host an inline preview
 *
 * The shared media kernel should not know about DOM nodes, so the web shell
 * records those bindings here and the runtime adapter reads them back by item
 * identifier when it needs to attach or detach the reusable preview element.
 */
export class WebPreviewSurfaceRegistry {
  private readonly listeners: Set<WebPreviewSurfaceRegistryListener>;
  private readonly surfaceEntriesByItemId: Map<
    string,
    WebPreviewSurfaceEntry[]
  >;

  /**
   * @brief Create the web-only preview surface registry
   */
  public constructor() {
    this.listeners = new Set<WebPreviewSurfaceRegistryListener>();
    this.surfaceEntriesByItemId = new Map<string, WebPreviewSurfaceEntry[]>();
  }

  /**
   * @brief Replace the currently registered preview hosts in one batch
   *
   * @param surfaceEntries - Latest preview hosts rendered by the browse shell
   */
  public replaceEntries(
    surfaceEntries: readonly WebPreviewSurfaceEntry[],
  ): void {
    this.surfaceEntriesByItemId.clear();

    for (const surfaceEntry of surfaceEntries) {
      const existingEntries: WebPreviewSurfaceEntry[] =
        this.surfaceEntriesByItemId.get(surfaceEntry.itemId) ?? [];

      existingEntries.push(surfaceEntry);
      this.surfaceEntriesByItemId.set(surfaceEntry.itemId, existingEntries);
    }

    this.notifyListeners();
  }

  /**
   * @brief Resolve the current preview host for one item identifier
   *
   * @param itemId - Stable media item identifier
   *
   * @returns Registered preview host, or `null` when the card is not rendered
   */
  public getEntry(itemId: string | null): WebPreviewSurfaceEntry | null {
    if (itemId === null) {
      return null;
    }

    const surfaceEntries: WebPreviewSurfaceEntry[] | undefined =
      this.surfaceEntriesByItemId.get(itemId);

    if (surfaceEntries === undefined || surfaceEntries.length === 0) {
      return null;
    }

    const focusedSurfaceEntry: WebPreviewSurfaceEntry | undefined =
      surfaceEntries.find(
        (surfaceEntry: WebPreviewSurfaceEntry): boolean =>
          surfaceEntry.hostElement
            .closest(".browse-thumbnail-card")
            ?.classList.contains("is-focused") === true,
      );

    return focusedSurfaceEntry ?? surfaceEntries[0] ?? null;
  }

  /**
   * @brief Subscribe to preview host updates triggered by shell rerenders
   *
   * @param listener - Callback invoked after registered hosts change
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: WebPreviewSurfaceRegistryListener): () => void {
    this.listeners.add(listener);

    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @brief Notify listeners that the rendered preview hosts changed
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
