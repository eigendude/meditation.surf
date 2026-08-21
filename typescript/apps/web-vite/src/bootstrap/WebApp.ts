/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  BrowseFocusState,
  BrowseRowContent,
  BrowseScreenContent,
} from "@meditation-surf/browse";
import type {
  MediaItem,
  MediaThumbnailSnapshot,
  MeditationExperience,
  PlaybackSequenceState,
} from "@meditation-surf/core";
import type { OverlayState } from "@meditation-surf/overlay";
import type { PlaybackVisualReadinessState } from "@meditation-surf/player-core";

import { WebExperienceAdapter } from "../experience/WebExperienceAdapter";
import { WebBrowseInputAdapter } from "../input/WebBrowseInputAdapter";
import { WebAppShell } from "../ui/WebAppShell";

/**
 * @brief Top-level lifecycle owner for the web app
 *
 * The app coordinates runtime-specific controllers and keeps the entry module
 * thin, while still consuming the shared meditation experience as its scene.
 */
export class WebApp {
  private readonly experienceAdapter: WebExperienceAdapter;
  private readonly inputAdapter: WebBrowseInputAdapter;
  private readonly shell: WebAppShell;
  private readonly handleBeforeUnload: () => void;
  private readonly handleResize: () => void;
  private activePlaybackItem: MediaItem | null;
  private removeLoadingSubscription: (() => void) | null;
  private removeOverlaySubscription: (() => void) | null;
  private removePlaybackSequenceSubscription: (() => void) | null;
  private removeBrowseFocusSubscription: (() => void) | null;
  private removeThumbnailSubscription: (() => void) | null;

  /**
   * @brief Assemble the runtime-specific web app around a shared experience
   *
   * @param experience - Shared meditation experience
   */
  public constructor(experience: MeditationExperience) {
    this.experienceAdapter = new WebExperienceAdapter(experience);
    this.activePlaybackItem =
      this.experienceAdapter.playbackSequenceController.getActiveItem();
    const initialBrowseContent: BrowseScreenContent =
      this.experienceAdapter.browseContentAdapter.getBrowseScreenContent(
        this.activePlaybackItem,
        this.experienceAdapter.browseFocusController.getState(),
      );
    const initialRowItemCounts: number[] = initialBrowseContent.rows.map(
      (browseRow: BrowseRowContent): number => browseRow.items.length,
    );

    this.experienceAdapter.browseFocusController.syncRows(initialRowItemCounts);
    this.experienceAdapter.browseSelectionController.syncRows(
      initialRowItemCounts,
    );

    this.shell = new WebAppShell(
      this.experienceAdapter.appLayoutController,
      initialBrowseContent,
      this.experienceAdapter.previewSurfaceRegistry,
      this.experienceAdapter.mediaThumbnailController.getState(),
    );
    this.inputAdapter = new WebBrowseInputAdapter(
      this.shell,
      this.experienceAdapter.browseInteractionController,
    );
    this.removeLoadingSubscription = null;
    this.removeOverlaySubscription = null;
    this.removePlaybackSequenceSubscription = null;
    this.removeBrowseFocusSubscription = null;
    this.removeThumbnailSubscription = null;
    this.handleBeforeUnload = (): void => {
      this.removeLoadingSubscription?.();
      this.removeLoadingSubscription = null;
      this.removeOverlaySubscription?.();
      this.removeOverlaySubscription = null;
      this.removePlaybackSequenceSubscription?.();
      this.removePlaybackSequenceSubscription = null;
      this.removeBrowseFocusSubscription?.();
      this.removeBrowseFocusSubscription = null;
      this.removeThumbnailSubscription?.();
      this.removeThumbnailSubscription = null;
      this.inputAdapter.destroy();
      this.experienceAdapter.browseInteractionController.destroy();
      void this.experienceAdapter.backgroundVideoController.destroy();
    };
    this.handleResize = (): void => {
      this.experienceAdapter.appLayoutController.applyCenteredOverlayLayout(
        this.shell.loadingOverlayElement,
      );
    };
  }

  /**
   * @brief Start the runtime-specific web app
   *
   * @returns A promise that resolves after startup work has been kicked off
   */
  public async start(): Promise<void> {
    await this.experienceAdapter.vfsController.serviceWorker.registerDefaultWorker();
    this.experienceAdapter.backgroundVideoController.configureElement(
      this.shell.backgroundVideoElement,
    );
    this.experienceAdapter.appLayoutController.applyCenteredOverlayLayout(
      this.shell.loadingOverlayElement,
    );
    this.shell.loadingOverlayElement.style.transition = `opacity ${this.experienceAdapter.overlayController.getConfig().fadeDurationMs}ms ease`;
    this.shell.overlayUiElement.style.transition = `opacity ${this.experienceAdapter.overlayController.getConfig().fadeDurationMs}ms ease`;
    this.shell.renderBrowseFocusState(
      this.experienceAdapter.browseFocusController.getState(),
    );
    this.shell.renderThumbnailSnapshot(
      this.experienceAdapter.mediaThumbnailController.getState(),
    );
    this.inputAdapter.attach();
    this.removeLoadingSubscription =
      this.experienceAdapter.playbackVisualReadinessController.subscribe(
        (playbackVisualReadinessState: PlaybackVisualReadinessState): void => {
          this.shell.loadingOverlayElement.style.opacity =
            playbackVisualReadinessState.readiness === "loading" ? "1" : "0";
        },
      );
    this.removeOverlaySubscription =
      this.experienceAdapter.overlayController.subscribe(
        (overlayState: OverlayState): void => {
          this.shell.overlayUiElement.style.opacity =
            overlayState.visibility === "visible" ? "1" : "0";
        },
      );
    this.removePlaybackSequenceSubscription =
      this.experienceAdapter.playbackSequenceController.subscribe(
        (playbackSequenceState: PlaybackSequenceState): void => {
          this.activePlaybackItem = playbackSequenceState.activeItem;
          const browseContent: BrowseScreenContent =
            this.experienceAdapter.browseContentAdapter.getBrowseScreenContent(
              this.activePlaybackItem,
              this.experienceAdapter.browseFocusController.getState(),
            );
          const rowItemCounts: number[] = browseContent.rows.map(
            (browseRow: BrowseRowContent): number => browseRow.items.length,
          );

          this.experienceAdapter.browseFocusController.syncRows(rowItemCounts);
          this.experienceAdapter.browseSelectionController.syncRows(
            rowItemCounts,
          );
          this.shell.renderBrowseContent(browseContent);
          this.inputAdapter.syncBrowseTargets();
        },
      );
    this.removeBrowseFocusSubscription =
      this.experienceAdapter.browseFocusController.subscribe(
        (browseFocusState: BrowseFocusState): void => {
          const browseContent: BrowseScreenContent =
            this.experienceAdapter.browseContentAdapter.getBrowseScreenContent(
              this.activePlaybackItem,
              browseFocusState,
            );

          this.shell.renderBrowseContent(browseContent);
          this.shell.renderBrowseFocusState(browseFocusState);
          this.inputAdapter.syncBrowseTargets();
        },
      );
    this.removeThumbnailSubscription =
      this.experienceAdapter.mediaThumbnailController.subscribe(
        (thumbnailSnapshot: MediaThumbnailSnapshot): void => {
          this.shell.renderThumbnailSnapshot(thumbnailSnapshot);
        },
      );
    window.addEventListener("beforeunload", this.handleBeforeUnload);
    window.addEventListener("resize", this.handleResize);
    await this.experienceAdapter.backgroundVideoController.start(
      this.shell.backgroundVideoElement,
    );
  }
}
