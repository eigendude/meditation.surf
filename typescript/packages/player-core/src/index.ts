/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Public playback domain API shared across workspace packages
 *
 * This entrypoint intentionally exposes only the stable contracts, domain
 * models, state objects, and playback events used by app-layer consumers.
 */
export type { IPlaybackController } from "./contracts/IPlaybackController";
export type { AudioProfile } from "./domain/AudioProfile";
export { PlaybackSource } from "./domain/PlaybackSource";
export type { IPlaybackEvent } from "./events/IPlaybackEvent";
export { PlaybackDestroyedEvent } from "./events/PlaybackDestroyedEvent";
export { PlaybackInitializedEvent } from "./events/PlaybackInitializedEvent";
export { PlaybackLoadedEvent } from "./events/PlaybackLoadedEvent";
export { PlaybackPausedEvent } from "./events/PlaybackPausedEvent";
export { PlaybackPlayedEvent } from "./events/PlaybackPlayedEvent";
export { PlaybackVolumeChangedEvent } from "./events/PlaybackVolumeChangedEvent";
export { PlaybackState } from "./state/PlaybackState";
export type { PlaybackStatus } from "./state/PlaybackStatuses";
export { PlaybackStatuses } from "./state/PlaybackStatuses";
export {
  PlaybackVisualReadinessController,
  type PlaybackVisualReadiness,
  type PlaybackVisualReadinessListener,
  type PlaybackVisualReadinessState,
} from "./state/PlaybackVisualReadinessController";
