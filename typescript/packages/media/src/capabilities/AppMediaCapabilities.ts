/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaCapabilityProfile } from "./MediaCapabilityProfile";

/**
 * @brief Capability report published by one app shell into the shared kernel
 */
export type AppMediaCapabilities = {
  appId: string;
  profile: MediaCapabilityProfile;
};
