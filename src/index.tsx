/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

/*
 * Vite entry point
 */
const root: HTMLElement | null = document.getElementById("root");
if (root) {
  // Obtain a root instance from ReactDOM using the createRoot method
  const appRoot: ReactDOM.Root = ReactDOM.createRoot(root);

  // Render the App component within the root instance
  appRoot.render(
    // Using React's StrictMode to highlight potential problems in an app
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} else {
  console.error("Failed to find the root element");
}
