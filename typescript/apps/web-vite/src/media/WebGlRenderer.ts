/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Practical WebGL frame renderer used as the first live fallback backend
 */
export class WebGlRenderer {
  public static readonly BACKEND_KIND: "webgl" = "webgl";

  public readonly canvasElement: HTMLCanvasElement;

  private hostElement: HTMLElement | null;
  private positionBuffer: WebGLBuffer | null;
  private program: WebGLProgram | null;
  private readonly webGlContext: WebGLRenderingContext;

  /**
   * @brief Build one detached WebGL canvas renderer
   */
  public constructor() {
    this.canvasElement = document.createElement("canvas");
    this.hostElement = null;
    this.positionBuffer = null;
    this.program = null;
    this.canvasElement.className = "browse-thumbnail-renderer-surface";
    const webGlContext: WebGLRenderingContext | null =
      this.canvasElement.getContext("webgl") as WebGLRenderingContext | null;

    if (webGlContext === null) {
      throw new Error("The browser could not create a WebGL context.");
    }

    this.webGlContext = webGlContext;
  }

  /**
   * @brief Report whether the browser exposes WebGL
   *
   * @returns `true` when WebGL can be attempted
   */
  public static isSupported(): boolean {
    if (typeof document === "undefined") {
      return false;
    }

    const canvasElement: HTMLCanvasElement = document.createElement("canvas");
    const webGlContext: WebGLRenderingContext | null = canvasElement.getContext(
      "webgl",
    ) as WebGLRenderingContext | null;

    return webGlContext !== null;
  }

  /**
   * @brief Attach the canvas to one host element
   *
   * @param hostElement - Host element that should display the renderer canvas
   */
  public attach(hostElement: HTMLElement): void {
    if (this.hostElement === hostElement) {
      return;
    }

    this.detach();
    hostElement.replaceChildren(this.canvasElement);
    this.hostElement = hostElement;
  }

  /**
   * @brief Detach the canvas from its current host when one exists
   */
  public detach(): void {
    if (
      this.hostElement !== null &&
      this.canvasElement.parentElement === this.hostElement
    ) {
      this.hostElement.replaceChildren();
    }

    this.hostElement = null;
  }

  /**
   * @brief Render one browser frame source into the WebGL canvas
   *
   * @param frameSource - Canvas-friendly source being presented
   * @param width - Output width in pixels
   * @param height - Output height in pixels
   */
  public async renderFrame(
    frameSource: CanvasImageSource,
    width: number,
    height: number,
  ): Promise<void> {
    this.ensureReady();
    this.canvasElement.width = Math.max(1, Math.round(width));
    this.canvasElement.height = Math.max(1, Math.round(height));
    this.webGlContext.viewport(
      0,
      0,
      this.canvasElement.width,
      this.canvasElement.height,
    );

    if (this.program === null || this.positionBuffer === null) {
      throw new Error("WebGL renderer initialization did not complete.");
    }

    const texture: WebGLTexture | null = this.webGlContext.createTexture();

    if (texture === null) {
      throw new Error("The browser could not create a WebGL texture.");
    }

    this.webGlContext.bindTexture(this.webGlContext.TEXTURE_2D, texture);
    this.webGlContext.texParameteri(
      this.webGlContext.TEXTURE_2D,
      this.webGlContext.TEXTURE_MIN_FILTER,
      this.webGlContext.LINEAR,
    );
    this.webGlContext.texParameteri(
      this.webGlContext.TEXTURE_2D,
      this.webGlContext.TEXTURE_MAG_FILTER,
      this.webGlContext.LINEAR,
    );
    this.webGlContext.texParameteri(
      this.webGlContext.TEXTURE_2D,
      this.webGlContext.TEXTURE_WRAP_S,
      this.webGlContext.CLAMP_TO_EDGE,
    );
    this.webGlContext.texParameteri(
      this.webGlContext.TEXTURE_2D,
      this.webGlContext.TEXTURE_WRAP_T,
      this.webGlContext.CLAMP_TO_EDGE,
    );
    this.webGlContext.pixelStorei(this.webGlContext.UNPACK_FLIP_Y_WEBGL, 1);
    this.webGlContext.texImage2D(
      this.webGlContext.TEXTURE_2D,
      0,
      this.webGlContext.RGBA,
      this.webGlContext.RGBA,
      this.webGlContext.UNSIGNED_BYTE,
      frameSource as TexImageSource,
    );

    this.webGlContext.useProgram(this.program);
    this.webGlContext.bindBuffer(
      this.webGlContext.ARRAY_BUFFER,
      this.positionBuffer,
    );

    const positionLocation: number = this.webGlContext.getAttribLocation(
      this.program,
      "aPosition",
    );
    const texCoordLocation: number = this.webGlContext.getAttribLocation(
      this.program,
      "aTexCoord",
    );

    this.webGlContext.enableVertexAttribArray(positionLocation);
    this.webGlContext.vertexAttribPointer(
      positionLocation,
      2,
      this.webGlContext.FLOAT,
      false,
      16,
      0,
    );
    this.webGlContext.enableVertexAttribArray(texCoordLocation);
    this.webGlContext.vertexAttribPointer(
      texCoordLocation,
      2,
      this.webGlContext.FLOAT,
      false,
      16,
      8,
    );

    const samplerLocation: WebGLUniformLocation | null =
      this.webGlContext.getUniformLocation(this.program, "uTexture");

    this.webGlContext.activeTexture(this.webGlContext.TEXTURE0);
    this.webGlContext.bindTexture(this.webGlContext.TEXTURE_2D, texture);

    if (samplerLocation !== null) {
      this.webGlContext.uniform1i(samplerLocation, 0);
    }

    this.webGlContext.clearColor(0, 0, 0, 1);
    this.webGlContext.clear(this.webGlContext.COLOR_BUFFER_BIT);
    this.webGlContext.drawArrays(this.webGlContext.TRIANGLES, 0, 6);
    this.webGlContext.flush();
    this.webGlContext.deleteTexture(texture);
  }

  /**
   * @brief Serialize the current canvas contents into one blob
   *
   * @param contentType - Requested image content type
   * @param quality - Optional quality hint
   *
   * @returns Encoded blob
   */
  public async toBlob(
    contentType: string,
    quality: number | undefined,
  ): Promise<Blob> {
    return await new Promise<Blob>((resolve, reject): void => {
      this.canvasElement.toBlob(
        (blob: Blob | null): void => {
          if (blob === null) {
            reject(new Error("WebGL canvas serialization failed."));
            return;
          }

          resolve(blob);
        },
        contentType,
        quality,
      );
    });
  }

  /**
   * @brief Release host ownership and transient WebGL state
   */
  public async destroy(): Promise<void> {
    this.detach();

    if (this.positionBuffer !== null) {
      this.webGlContext.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }

    if (this.program !== null) {
      this.webGlContext.deleteProgram(this.program);
      this.program = null;
    }
  }

  /**
   * @brief Lazily create the shader program and position buffer
   */
  private ensureReady(): void {
    if (this.program !== null && this.positionBuffer !== null) {
      return;
    }

    const vertexShader: WebGLShader = this.createShader(
      this.webGlContext.VERTEX_SHADER,
      `
        attribute vec2 aPosition;
        attribute vec2 aTexCoord;
        varying vec2 vTexCoord;

        void main(void) {
          gl_Position = vec4(aPosition, 0.0, 1.0);
          vTexCoord = aTexCoord;
        }
      `,
    );
    const fragmentShader: WebGLShader = this.createShader(
      this.webGlContext.FRAGMENT_SHADER,
      `
        precision mediump float;
        varying vec2 vTexCoord;
        uniform sampler2D uTexture;

        void main(void) {
          gl_FragColor = texture2D(uTexture, vTexCoord);
        }
      `,
    );
    const program: WebGLProgram = this.createProgram(
      vertexShader,
      fragmentShader,
    );
    const positionBuffer: WebGLBuffer | null = this.webGlContext.createBuffer();

    if (positionBuffer === null) {
      throw new Error("The browser could not create a WebGL vertex buffer.");
    }

    this.webGlContext.bindBuffer(
      this.webGlContext.ARRAY_BUFFER,
      positionBuffer,
    );
    this.webGlContext.bufferData(
      this.webGlContext.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 1, 1, 1, 1,
        1, 0,
      ]),
      this.webGlContext.STATIC_DRAW,
    );

    this.positionBuffer = positionBuffer;
    this.program = program;
  }

  /**
   * @brief Compile one WebGL shader
   *
   * @param shaderType - WebGL shader type constant
   * @param source - GLSL source code
   *
   * @returns Compiled shader
   */
  private createShader(shaderType: number, source: string): WebGLShader {
    const shader: WebGLShader | null =
      this.webGlContext.createShader(shaderType);

    if (shader === null) {
      throw new Error("The browser could not create a WebGL shader.");
    }

    this.webGlContext.shaderSource(shader, source);
    this.webGlContext.compileShader(shader);

    if (
      this.webGlContext.getShaderParameter(
        shader,
        this.webGlContext.COMPILE_STATUS,
      ) !== true
    ) {
      const shaderInfoLog: string =
        this.webGlContext.getShaderInfoLog(shader) ??
        "WebGL shader compilation failed.";

      this.webGlContext.deleteShader(shader);
      throw new Error(shaderInfoLog);
    }

    return shader;
  }

  /**
   * @brief Link one WebGL program from a vertex and fragment shader
   *
   * @param vertexShader - Compiled vertex shader
   * @param fragmentShader - Compiled fragment shader
   *
   * @returns Linked WebGL program
   */
  private createProgram(
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
  ): WebGLProgram {
    const program: WebGLProgram | null = this.webGlContext.createProgram();

    if (program === null) {
      throw new Error("The browser could not create a WebGL program.");
    }

    this.webGlContext.attachShader(program, vertexShader);
    this.webGlContext.attachShader(program, fragmentShader);
    this.webGlContext.linkProgram(program);
    this.webGlContext.deleteShader(vertexShader);
    this.webGlContext.deleteShader(fragmentShader);

    if (
      this.webGlContext.getProgramParameter(
        program,
        this.webGlContext.LINK_STATUS,
      ) !== true
    ) {
      const programInfoLog: string =
        this.webGlContext.getProgramInfoLog(program) ??
        "WebGL program link failed.";

      this.webGlContext.deleteProgram(program);
      throw new Error(programInfoLog);
    }

    return program;
  }
}
