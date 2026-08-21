/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IAnalyticsEvent } from "./IAnalyticsEvent";

/**
 * @brief Supported shared applications that emit launch analytics
 */
export type AppLaunchedAnalyticsEventApp = "tv-lightning" | "mobile-expo";

/**
 * @brief Payload emitted when an app session is launched
 */
export type AppLaunchedAnalyticsEventPayload = {
  app: AppLaunchedAnalyticsEventApp;
};

/**
 * @brief Analytics event describing shared app launch activity
 *
 * This event keeps the stable `app_launched` vocabulary while making the
 * payload an explicit domain object owned by one class.
 */
export class AppLaunchedAnalyticsEvent implements IAnalyticsEvent<
  "app_launched",
  AppLaunchedAnalyticsEventPayload
> {
  public static readonly EVENT_NAME: "app_launched" = "app_launched";

  public readonly app: AppLaunchedAnalyticsEventApp;

  /**
   * @brief Create an app launched analytics event
   *
   * @param app - Shared application identifier that emitted the event
   */
  public constructor(app: AppLaunchedAnalyticsEventApp) {
    this.app = app;
  }

  /**
   * @brief Return the stable analytics event name
   */
  public get eventName(): "app_launched" {
    return AppLaunchedAnalyticsEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable analytics payload
   */
  public get payload(): AppLaunchedAnalyticsEventPayload {
    return {
      app: this.app,
    };
  }
}
