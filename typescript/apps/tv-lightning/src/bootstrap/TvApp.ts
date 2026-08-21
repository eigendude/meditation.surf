/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";
import type { MeditationExperience } from "@meditation-surf/core";

import { TvExperienceAdapter } from "../experience/TvExperienceAdapter";
import { TvBrowseInputAdapter } from "../input/TvBrowseInputAdapter";
import {
  LIGHTNING_APP_HEIGHT,
  LIGHTNING_APP_WIDTH,
} from "../layout/StageLayout";
import { TvViewportSync } from "../layout/TvViewportSync";
import { createLightningApp } from "../ui/LightningApp";
import { TvTextFont } from "./TvTextFont";

/**
 * @brief Top-level lifecycle owner for the TV Lightning app
 *
 * The TV app coordinates Lightning bootstrapping, viewport syncing, and
 * runtime-specific adaptation of the shared meditation experience.
 */
export class TvApp {
  private readonly experienceAdapter: TvExperienceAdapter;
  private readonly viewportSync: TvViewportSync;
  private readonly handleBeforeUnload: () => void;
  private inputAdapter: TvBrowseInputAdapter | null;

  /**
   * @brief Build the TV app around a shared meditation experience
   *
   * @param experience - Shared meditation experience
   */
  public constructor(experience: MeditationExperience) {
    this.experienceAdapter = new TvExperienceAdapter(experience);
    this.viewportSync = new TvViewportSync();
    this.inputAdapter = null;
    this.handleBeforeUnload = (): void => {
      this.inputAdapter?.destroy();
      this.inputAdapter = null;
      this.experienceAdapter.browseInteractionController.destroy();
      void this.experienceAdapter.backgroundVideoController.destroy();
      this.viewportSync.destroy();
    };
  }

  /**
   * @brief Launch the Lightning app and connect runtime-specific controllers
   */
  public start(): void {
    const mountElement: HTMLElement = this.getMountElement();
    const browseInputAdapter: TvBrowseInputAdapter = new TvBrowseInputAdapter(
      mountElement,
      this.experienceAdapter.browseInteractionController,
    );
    const directionalInputHandlers =
      browseInputAdapter.createDirectionalInputHandlers();
    const lightningApp: ReturnType<typeof Blits.Application> =
      createLightningApp({
        appLayoutController: this.experienceAdapter.appLayoutController,
        browseInputAdapter,
        browseContentAdapter: this.experienceAdapter.browseContentAdapter,
        browseFocusController: this.experienceAdapter.browseFocusController,
        browseSelectionController:
          this.experienceAdapter.browseSelectionController,
        directionalInputHandlers,
        overlayController: this.experienceAdapter.overlayController,
        playbackSequenceController:
          this.experienceAdapter.playbackSequenceController,
        playbackVisualReadinessController:
          this.experienceAdapter.playbackVisualReadinessController,
        viewportSync: this.viewportSync,
        onReady: (): void => {
          browseInputAdapter.attach();
          this.experienceAdapter.backgroundVideoController.initialize();
          void this.experienceAdapter.backgroundVideoController.start();
        },
        onDestroy: (): void => {
          browseInputAdapter.destroy();
          void this.experienceAdapter.backgroundVideoController.destroy();
          this.viewportSync.destroy();
        },
      });
    const textFontDefinition: {
      family: string;
      type: "web";
      file: string;
    } = TvTextFont.createBlitsFontDefinition();

    mountElement.style.position = "relative";
    this.inputAdapter = browseInputAdapter;
    Blits.Launch(lightningApp, mountElement, {
      w: LIGHTNING_APP_WIDTH,
      h: LIGHTNING_APP_HEIGHT,
      // Web fonts are loaded through the canvas text renderer in Blits.
      // Running the TV app in canvas mode keeps the entire text path on the
      // documented renderer route instead of mixing web-font text with the
      // default WebGL stage configuration.
      renderMode: "canvas",
      defaultFont: TvTextFont.family,
      fonts: [textFontDefinition],
    });

    this.viewportSync.start(
      mountElement,
      (left: number, top: number, width: number, height: number): void => {
        this.experienceAdapter.backgroundVideoController.setDisplayBounds(
          left,
          top,
          width,
          height,
        );
      },
    );
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  /**
   * @brief Resolve the DOM mount used by the Lightning runtime
   *
   * @returns Root DOM mount for the TV app
   */
  private getMountElement(): HTMLElement {
    const mountElement: HTMLElement | null = document.getElementById("app");

    if (mountElement === null) {
      throw new Error("Expected the #app root element to exist.");
    }

    return mountElement;
  }
}
