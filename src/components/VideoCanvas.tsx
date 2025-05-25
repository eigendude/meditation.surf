/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import "./VideoCanvas.css";

import React, { useEffect, useRef } from "react";

const VideoCanvas: React.FC = () => {
  // Reference to the canvas element
  const canvasRef: React.RefObject<HTMLCanvasElement | null> =
    useRef<HTMLCanvasElement | null>(null);
  const containerRef: React.RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Function to update the canvas size to cover the full screen
    const updateCanvasSize = (): void => {
      const canvas: HTMLCanvasElement | null = canvasRef.current;
      const container: HTMLDivElement | null = containerRef.current;
      if (canvas && container) {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
      }
    };

    // Initial setup for full size canvas
    updateCanvasSize();

    // Set up ResizeObserver to adjust canvas size to the size of the container div
    const observer: ResizeObserver = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return (): void => {
      // Cleanup on component unmount
      observer.disconnect();
    };
  }, []);

  // Render the canvas element
  return (
    <div ref={containerRef} className="canvasContainer">
      <canvas ref={canvasRef} id="videoCanvas" />
    </div>
  );
};

export default VideoCanvas;
