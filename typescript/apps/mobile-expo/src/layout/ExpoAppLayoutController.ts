/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { BRAND_ICON_SOURCE } from "@meditation-surf/assets";
import type {
  AppLayout,
  CenteredOverlayLayout,
  CenteredOverlaySize,
} from "@meditation-surf/layout";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

/**
 * @brief Adapt the shared app layout into Expo-specific view layout state
 */
export class ExpoAppLayoutController {
  private static readonly CONTAINER_STYLE: ViewStyle = {
    backgroundColor: "#000000",
    flex: 1,
  };

  private static readonly BACKGROUND_LAYER_STYLE: ViewStyle = {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  };

  private static readonly CENTERED_FULLSCREEN_PLANE_STYLE: ViewStyle = {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  };

  private static readonly CENTERED_OVERLAY_STYLE: ImageStyle = {
    resizeMode: "contain",
  };

  private static readonly OVERLAY_TITLE_STYLE: TextStyle = {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "600",
    maxWidth: "85%",
    paddingHorizontal: 24,
    textAlign: "center",
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 6,
  };

  private readonly appLayout: AppLayout;

  /**
   * @brief Capture the shared app layout consumed by the Expo runtime
   *
   * @param appLayout - Shared app surface layout
   */
  public constructor(appLayout: AppLayout) {
    this.appLayout = appLayout;
  }

  /**
   * @brief Return the root container style for the Expo app surface
   *
   * @returns Root React Native container style
   */
  public getContainerStyle(): ViewStyle {
    return ExpoAppLayoutController.CONTAINER_STYLE;
  }

  /**
   * @brief Return the fullscreen background layer style
   *
   * @returns Fullscreen style for the background video layer
   */
  public getBackgroundLayerStyle(): ViewStyle {
    return ExpoAppLayoutController.BACKGROUND_LAYER_STYLE;
  }

  /**
   * @brief Return the fullscreen loading plane style
   *
   * @returns Fullscreen style for the loading icon plane
   */
  public getLoadingPlaneStyle(): ViewStyle {
    return ExpoAppLayoutController.CENTERED_FULLSCREEN_PLANE_STYLE;
  }

  /**
   * @brief Return the fullscreen overlay UI plane style
   *
   * @returns Fullscreen style for the overlay UI icon plane
   */
  public getOverlayUiPlaneStyle(): ViewStyle {
    return ExpoAppLayoutController.CENTERED_FULLSCREEN_PLANE_STYLE;
  }

  /**
   * @brief Return the base image style for the centered overlay
   *
   * @returns React Native style applied to the overlay image
   */
  public getCenteredOverlayStyle(): ImageStyle {
    return ExpoAppLayoutController.CENTERED_OVERLAY_STYLE;
  }

  /**
   * @brief Return the base title style for the overlay UI plane
   *
   * @returns React Native text style applied to the current item title
   */
  public getOverlayTitleStyle(): TextStyle {
    return ExpoAppLayoutController.OVERLAY_TITLE_STYLE;
  }

  /**
   * @brief Return the image source used by the centered overlay
   *
   * @returns React Native image source for the brand icon
   */
  public getCenteredOverlaySource(): typeof BRAND_ICON_SOURCE {
    return BRAND_ICON_SOURCE;
  }

  /**
   * @brief Compute the overlay size for the live viewport
   *
   * @param viewportWidth - Live viewport width
   * @param viewportHeight - Live viewport height
   *
   * @returns Shared centered-overlay size adapted for React Native
   */
  public getCenteredOverlaySize(
    viewportWidth: number,
    viewportHeight: number,
  ): CenteredOverlaySize {
    const centeredOverlay: CenteredOverlayLayout =
      this.getRequiredCenteredOverlay();

    return centeredOverlay.getLayoutSize(viewportWidth, viewportHeight);
  }

  /**
   * @brief Resolve the centered overlay required by the current app layout
   *
   * @returns Shared centered overlay layout
   */
  private getRequiredCenteredOverlay(): CenteredOverlayLayout {
    const centeredOverlay: CenteredOverlayLayout | null = this.appLayout
      .getForegroundLayer()
      .getCenteredOverlay();

    if (centeredOverlay === null) {
      throw new Error(
        "Expected the demo app layout to expose a centered overlay.",
      );
    }

    return centeredOverlay;
  }
}
