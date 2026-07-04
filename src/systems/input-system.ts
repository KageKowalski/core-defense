/**
 * InputSystem - Handles mouse/click interactions with raycasting to ground plane.
 * Detects hovered and clicked cells for placement and structure selection.
 */

import * as THREE from 'three';
import { GridPosition } from '../models/grid';
import { GameConfig } from '../models/config';

export type InputEvent =
  | { type: 'cell_click'; position: GridPosition }
  | { type: 'cell_hover'; position: GridPosition | null };

export type InputEventCallback = (event: InputEvent) => void;

/**
 * InputSystem class handling mouse interactions with the game grid.
 */
export class InputSystem {
  private camera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private raycaster: THREE.Raycaster;
  private groundPlane: THREE.Plane;
  private mouse: THREE.Vector2;
  private hoveredCell: GridPosition | null = null;
  private eventCallbacks: InputEventCallback[] = [];

  constructor(camera: THREE.OrthographicCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y=0 ground
    this.mouse = new THREE.Vector2();

    // Bind event listeners
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.onClick(e));
  }

  /**
   * Register a callback for input events.
   */
  onEvent(callback: InputEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Returns the currently hovered grid cell.
   */
  getHoveredCell(): GridPosition | null {
    return this.hoveredCell;
  }

  /**
   * Converts a mouse event to a grid position via raycasting.
   */
  private getGridPositionFromMouse(event: MouseEvent): GridPosition | null {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersection = new THREE.Vector3();
    const ray = this.raycaster.ray;

    if (ray.intersectPlane(this.groundPlane, intersection)) {
      const col = Math.floor(intersection.x);
      const row = Math.floor(intersection.z);

      // Bounds check
      if (row >= 0 && row < GameConfig.grid.height && col >= 0 && col < GameConfig.grid.width) {
        return { row, col };
      }
    }

    return null;
  }

  /**
   * Handles mouse move for hover detection.
   */
  private onMouseMove(event: MouseEvent): void {
    const pos = this.getGridPositionFromMouse(event);
    this.hoveredCell = pos;

    for (const cb of this.eventCallbacks) {
      cb({ type: 'cell_hover', position: pos });
    }
  }

  /**
   * Handles click for cell selection.
   */
  private onClick(event: MouseEvent): void {
    const pos = this.getGridPositionFromMouse(event);
    if (pos) {
      for (const cb of this.eventCallbacks) {
        cb({ type: 'cell_click', position: pos });
      }
    }
  }

  /**
   * Returns mouse coordinates for positioning UI elements.
   */
  getMouseScreenPosition(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}
