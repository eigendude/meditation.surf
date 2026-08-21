/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PreviewFarmState } from "../preview/PreviewFarmState";
import type { MediaPlanSession } from "./MediaPlanSession";

/**
 * @brief Deterministic session plan produced by the shared media planner
 */
export type MediaPlan = {
  sessions: MediaPlanSession[];
  previewFarm: PreviewFarmState;
};
