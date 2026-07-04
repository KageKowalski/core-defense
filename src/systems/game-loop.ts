/**
 * GameLoop - Fixed-timestep game loop with accumulator pattern.
 * Updates game logic at 60Hz and renders at display refresh rate with interpolation.
 */

export const FIXED_DT = 1 / 60; // 16.67ms per tick

export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (alpha: number) => void;

/**
 * GameLoop class implementing fixed-timestep update with variable rendering.
 */
export class GameLoop {
  private accumulator: number = 0;
  private lastTime: number = 0;
  private running: boolean = false;
  private paused: boolean = false;
  private animationFrameId: number | null = null;
  private updateFn: UpdateCallback;
  private renderFn: RenderCallback;

  constructor(updateFn: UpdateCallback, renderFn: RenderCallback) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
  }

  /**
   * Starts the game loop.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.tick();
  }

  /**
   * Stops the game loop completely.
   */
  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Pauses the game loop (rendering continues, updates stop).
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resumes the game loop after a pause.
   */
  resume(): void {
    if (!this.running) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  /**
   * Returns whether the loop is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Returns whether the loop is currently paused.
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Main loop tick - called via requestAnimationFrame.
   */
  private tick(): void {
    if (!this.running) return;

    const currentTime = performance.now();
    let frameTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    // Clamp frame time to prevent spiral of death (max 250ms)
    if (frameTime > 0.25) {
      frameTime = 0.25;
    }

    if (!this.paused) {
      this.accumulator += frameTime;

      // Process fixed-step updates
      while (this.accumulator >= FIXED_DT) {
        this.updateFn(FIXED_DT);
        this.accumulator -= FIXED_DT;
      }
    }

    // Calculate interpolation alpha for rendering
    const alpha = this.accumulator / FIXED_DT;
    this.renderFn(alpha);

    this.animationFrameId = requestAnimationFrame(() => this.tick());
  }
}
