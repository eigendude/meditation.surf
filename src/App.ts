/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

import Home from "./pages/Home";

export default Blits.Application({
  template: `
    <Element>
      <RouterView />
    </Element>`,
  routes: [{ path: "/", component: Home }],
});
