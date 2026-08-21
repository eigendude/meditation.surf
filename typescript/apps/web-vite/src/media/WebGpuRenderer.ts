/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

type WebGpuAdapterLike = {
  requestDevice(): Promise<WebGpuDeviceLike>;
};

type WebGpuBindGroupLike = unknown;
type WebGpuBindGroupLayoutLike = unknown;
type WebGpuPipelineLike = {
  getBindGroupLayout(index: number): WebGpuBindGroupLayoutLike;
};

type WebGpuDeviceLike = {
  createBindGroup(descriptor: Record<string, unknown>): WebGpuBindGroupLike;
  createCommandEncoder(): WebGpuCommandEncoderLike;
  createRenderPipeline(descriptor: Record<string, unknown>): WebGpuPipelineLike;
  createSampler(descriptor: Record<string, unknown>): unknown;
  createShaderModule(descriptor: Record<string, unknown>): unknown;
  createTexture(descriptor: Record<string, unknown>): WebGpuTextureLike;
  queue: {
    copyExternalImageToTexture(
      source: Record<string, unknown>,
      destination: Record<string, unknown>,
      copySize: [number, number, number],
    ): void;
    onSubmittedWorkDone?: () => Promise<void>;
    submit(commandBuffers: unknown[]): void;
  };
};

type WebGpuCommandEncoderLike = {
  beginRenderPass(descriptor: Record<string, unknown>): WebGpuRenderPassLike;
  finish(): unknown;
};

type WebGpuContextLike = {
  configure(descriptor: Record<string, unknown>): void;
  getCurrentTexture(): WebGpuTextureLike;
};

type WebGpuNavigatorLike = Navigator & {
  gpu?: {
    getPreferredCanvasFormat(): string;
    requestAdapter(): Promise<WebGpuAdapterLike | null>;
  };
};

type WebGpuRenderPassLike = {
  draw(vertexCount: number): void;
  end(): void;
  setBindGroup(index: number, bindGroup: WebGpuBindGroupLike): void;
  setPipeline(pipeline: WebGpuPipelineLike): void;
};

type WebGpuTextureLike = {
  createView(): unknown;
  destroy?: () => void;
};

/**
 * @brief Practical WebGPU frame renderer used by the first web renderer router
 */
export class WebGpuRenderer {
  public static readonly BACKEND_KIND: "webgpu" = "webgpu";

  private static readonly GPU_TEXTURE_USAGE_COPY_DST: number = 0x02;
  private static readonly GPU_TEXTURE_USAGE_RENDER_ATTACHMENT: number = 0x10;
  private static readonly GPU_TEXTURE_USAGE_TEXTURE_BINDING: number = 0x04;

  public readonly canvasElement: HTMLCanvasElement;

  private bindGroupLayout: WebGpuBindGroupLayoutLike | null;
  private context: WebGpuContextLike | null;
  private device: WebGpuDeviceLike | null;
  private format: string | null;
  private hostElement: HTMLElement | null;
  private pipeline: WebGpuPipelineLike | null;
  private sampler: unknown;

  /**
   * @brief Build one detached WebGPU canvas renderer
   */
  public constructor() {
    this.canvasElement = document.createElement("canvas");
    this.bindGroupLayout = null;
    this.context = null;
    this.device = null;
    this.format = null;
    this.hostElement = null;
    this.pipeline = null;
    this.sampler = null;
    this.canvasElement.className = "browse-thumbnail-renderer-surface";
  }

  /**
   * @brief Report whether the browser exposes the minimum WebGPU entry point
   *
   * @returns `true` when WebGPU can be attempted
   */
  public static isSupported(): boolean {
    const globalNavigator: Navigator | undefined = globalThis.navigator;

    return globalNavigator !== undefined && "gpu" in globalNavigator;
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
   * @brief Render one browser frame source into the WebGPU canvas
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
    await this.ensureReady(width, height);

    if (
      this.context === null ||
      this.device === null ||
      this.pipeline === null ||
      this.format === null ||
      this.sampler === null
    ) {
      throw new Error("WebGPU renderer could not finish initialization.");
    }

    const uploadTexture: WebGpuTextureLike = this.device.createTexture({
      size: [width, height, 1],
      format: "rgba8unorm",
      usage:
        WebGpuRenderer.GPU_TEXTURE_USAGE_TEXTURE_BINDING |
        WebGpuRenderer.GPU_TEXTURE_USAGE_COPY_DST |
        WebGpuRenderer.GPU_TEXTURE_USAGE_RENDER_ATTACHMENT,
    });

    this.device.queue.copyExternalImageToTexture(
      {
        source: frameSource,
      },
      {
        texture: uploadTexture,
      },
      [width, height, 1],
    );

    const bindGroup: WebGpuBindGroupLike = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.sampler,
        },
        {
          binding: 1,
          resource: uploadTexture.createView(),
        },
      ],
    });
    const commandEncoder: WebGpuCommandEncoderLike =
      this.device.createCommandEncoder();
    const renderPass: WebGpuRenderPassLike = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: {
            r: 0,
            g: 0,
            b: 0,
            a: 1,
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6);
    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone?.();
    uploadTexture.destroy?.();
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
    return await this.serializeCanvas(contentType, quality);
  }

  /**
   * @brief Release host ownership and transient WebGPU state
   */
  public async destroy(): Promise<void> {
    this.detach();
    this.bindGroupLayout = null;
    this.context = null;
    this.device = null;
    this.format = null;
    this.pipeline = null;
    this.sampler = null;
  }

  /**
   * @brief Create or reuse the WebGPU device, context, and pipeline
   *
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   */
  private async ensureReady(width: number, height: number): Promise<void> {
    this.canvasElement.width = Math.max(1, Math.round(width));
    this.canvasElement.height = Math.max(1, Math.round(height));

    if (
      this.context !== null &&
      this.device !== null &&
      this.pipeline !== null &&
      this.format !== null &&
      this.sampler !== null
    ) {
      return;
    }

    if (!WebGpuRenderer.isSupported()) {
      throw new Error("WebGPU is unavailable in this browser.");
    }

    const webGpuNavigator: WebGpuNavigatorLike =
      globalThis.navigator as WebGpuNavigatorLike;
    const gpuAdapter: WebGpuAdapterLike | null =
      (await webGpuNavigator.gpu?.requestAdapter()) as WebGpuAdapterLike | null;

    if (gpuAdapter === null || gpuAdapter === undefined) {
      throw new Error("The browser could not acquire a WebGPU adapter.");
    }

    const device: WebGpuDeviceLike = await gpuAdapter.requestDevice();
    const context: WebGpuContextLike | null = this.canvasElement.getContext(
      "webgpu",
    ) as WebGpuContextLike | null;

    if (context === null) {
      throw new Error("The browser could not create a WebGPU canvas context.");
    }

    const format: string =
      webGpuNavigator.gpu?.getPreferredCanvasFormat() ?? "bgra8unorm";

    context.configure({
      device,
      format,
      alphaMode: "premultiplied",
    });
    const shaderModule: unknown = device.createShaderModule({
      code: `
        @group(0) @binding(0) var frameSampler: sampler;
        @group(0) @binding(1) var frameTexture: texture_2d<f32>;

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
        };

        @vertex
        fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
          var positions: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, -1.0),
            vec2<f32>(1.0, 1.0),
          );
          var uvs: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
            vec2<f32>(0.0, 1.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(0.0, 0.0),
            vec2<f32>(0.0, 0.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(1.0, 0.0),
          );
          var output: VertexOutput;
          output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
          output.uv = uvs[vertexIndex];
          return output;
        }

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
          return textureSample(frameTexture, frameSampler, input.uv);
        }
      `,
    });
    const pipeline: WebGpuPipelineLike = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
    const sampler: unknown = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    this.bindGroupLayout = pipeline.getBindGroupLayout(0);
    this.context = context;
    this.device = device;
    this.format = format;
    this.pipeline = pipeline;
    this.sampler = sampler;
  }

  /**
   * @brief Serialize the internal canvas through the standard browser blob path
   *
   * @param contentType - Requested content type
   * @param quality - Optional quality hint
   *
   * @returns Encoded blob
   */
  private async serializeCanvas(
    contentType: string,
    quality: number | undefined,
  ): Promise<Blob> {
    return await new Promise<Blob>((resolve, reject): void => {
      this.canvasElement.toBlob(
        (blob: Blob | null): void => {
          if (blob === null) {
            reject(new Error("WebGPU canvas serialization failed."));
            return;
          }

          resolve(blob);
        },
        contentType,
        quality,
      );
    });
  }
}
