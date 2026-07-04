/**
 * RenderSystem - Three.js scene setup with orthographic camera and entity rendering.
 * Handles ground plane, grid overlay, entity meshes, health bars, and position interpolation.
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GameConfig } from '../models/config';
import { EntityStore } from '../models/entity-store';
import { Entity, Structure, Enemy, Projectile, Tower } from '../models/entities';
import { GridPosition, gridToWorld, WorldPosition } from '../models/grid';
import { GamePhase } from './state';

// Colors for different structure types
const STRUCTURE_COLORS: Record<string, number> = {
  barrier: 0x8b4513,       // Brown
  basic_tower: 0x4169e1,   // Royal blue
  sniper_tower: 0x9932cc,  // Purple
  aoe_tower: 0xff4500,     // Orange-red
  critical_resource: 0xffd700, // Gold
};

const ENEMY_COLORS: Record<string, number> = {
  basic_enemy: 0x00ff00,   // Green
  brute_enemy: 0x8b0000,   // Dark red
};

/**
 * RenderSystem class managing the Three.js scene.
 */
export class RenderSystem {
  private renderer: THREE.WebGLRenderer;
  private cssRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Scene groups (render order)
  private groundGroup: THREE.Group;
  private structuresGroup: THREE.Group;
  private enemiesGroup: THREE.Group;
  private projectilesGroup: THREE.Group;
  private vfxGroup: THREE.Group;

  // Grid overlay
  private gridOverlay: THREE.LineSegments | null = null;
  private gridOverlayVisible: boolean = true;

  // Entity meshes
  private entityMeshes: Map<string, THREE.Object3D> = new Map();
  private healthBars: Map<string, THREE.Mesh> = new Map();
  private healthBarBgs: Map<string, THREE.Mesh> = new Map();

  // Reference to entity store for interpolation
  private entityStore: EntityStore;

  constructor(container: HTMLElement, entityStore: EntityStore) {
    this.entityStore = entityStore;

    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x1a1a2e);
    container.appendChild(this.renderer.domElement);

    // Create CSS2D renderer for floating text
    this.cssRenderer = new CSS2DRenderer();
    this.cssRenderer.setSize(container.clientWidth, container.clientHeight);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0';
    this.cssRenderer.domElement.style.left = '0';
    this.cssRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.cssRenderer.domElement);

    // Create scene
    this.scene = new THREE.Scene();

    // Setup orthographic camera
    const gridW = GameConfig.grid.width;
    const gridH = GameConfig.grid.height;
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = Math.max(gridW, gridH) * 1.2;

    const halfW = (frustumSize * aspect) / 2;
    const halfH = frustumSize / 2;

    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);

    // Position camera at 45° azimuth, 60° elevation
    const azimuth = (GameConfig.camera.azimuthAngle * Math.PI) / 180;
    const elevation = (GameConfig.camera.elevationAngle * Math.PI) / 180;
    const camDistance = 30;

    this.camera.position.set(
      Math.cos(elevation) * Math.sin(azimuth) * camDistance + gridW / 2,
      Math.sin(elevation) * camDistance,
      Math.cos(elevation) * Math.cos(azimuth) * camDistance + gridH / 2
    );
    this.camera.lookAt(gridW / 2, 0, gridH / 2);

    // Create scene groups (renderOrder for back-to-front)
    this.groundGroup = new THREE.Group();
    this.groundGroup.renderOrder = 0;
    this.scene.add(this.groundGroup);

    this.structuresGroup = new THREE.Group();
    this.structuresGroup.renderOrder = 2;
    this.scene.add(this.structuresGroup);

    this.enemiesGroup = new THREE.Group();
    this.enemiesGroup.renderOrder = 3;
    this.scene.add(this.enemiesGroup);

    this.projectilesGroup = new THREE.Group();
    this.projectilesGroup.renderOrder = 4;
    this.scene.add(this.projectilesGroup);

    this.vfxGroup = new THREE.Group();
    this.vfxGroup.renderOrder = 5;
    this.scene.add(this.vfxGroup);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Create ground plane
    this.createGroundPlane();

    // Create grid overlay
    this.createGridOverlay();

    // Create Critical Resource mesh
    this.createCriticalResourceMesh();

    // Handle window resize
    window.addEventListener('resize', () => this.onResize(container));
  }

  /**
   * Creates the ground plane matching grid dimensions.
   */
  private createGroundPlane(): void {
    const gridW = GameConfig.grid.width;
    const gridH = GameConfig.grid.height;

    const geometry = new THREE.PlaneGeometry(gridW, gridH);
    const material = new THREE.MeshLambertMaterial({ color: 0x2d5016 });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(gridW / 2, -0.01, gridH / 2);
    this.groundGroup.add(plane);
  }

  /**
   * Creates the semi-transparent grid overlay.
   */
  private createGridOverlay(): void {
    const gridW = GameConfig.grid.width;
    const gridH = GameConfig.grid.height;

    const points: number[] = [];

    // Vertical lines
    for (let x = 0; x <= gridW; x++) {
      points.push(x, 0, 0);
      points.push(x, 0, gridH);
    }

    // Horizontal lines
    for (let z = 0; z <= gridH; z++) {
      points.push(0, 0, z);
      points.push(gridW, 0, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
    });

    this.gridOverlay = new THREE.LineSegments(geometry, material);
    this.gridOverlay.position.y = 0.01;
    this.groundGroup.add(this.gridOverlay);
  }

  /**
   * Creates the Critical Resource mesh (2x2, golden, with visible height).
   */
  private createCriticalResourceMesh(): void {
    const cr = this.entityStore.criticalResource;
    const geometry = new THREE.BoxGeometry(2, 1.5, 2);
    const material = new THREE.MeshLambertMaterial({ color: STRUCTURE_COLORS.critical_resource });
    const mesh = new THREE.Mesh(geometry, material);

    // Position at center of the 2x2 area
    const centerRow = GameConfig.grid.height / 2;
    const centerCol = GameConfig.grid.width / 2;
    mesh.position.set(centerCol, 0.75, centerRow);

    this.structuresGroup.add(mesh);
    this.entityMeshes.set(cr.id, mesh);

    // Always show CR health bar
    this.createHealthBar(cr.id, mesh, 2);
  }

  /**
   * Adds a structure entity mesh to the scene.
   */
  addStructure(structure: Structure): void {
    const size = structure.type === 'barrier' ? 0.8 : 0.7;
    const height = structure.type === 'barrier' ? 1.0 : 1.2;

    const geometry = new THREE.BoxGeometry(size, height, size);
    const material = new THREE.MeshLambertMaterial({
      color: STRUCTURE_COLORS[structure.type] || 0xffffff,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const worldPos = gridToWorld(structure.position, GameConfig.grid.cellSize);
    mesh.position.set(worldPos.x, height / 2, worldPos.z);

    this.structuresGroup.add(mesh);
    this.entityMeshes.set(structure.id, mesh);
  }

  /**
   * Adds an enemy entity mesh to the scene.
   */
  addEnemy(enemy: Enemy): void {
    const size = enemy.type === 'brute_enemy' ? 0.6 : 0.4;
    const height = enemy.type === 'brute_enemy' ? 0.8 : 0.5;

    const geometry = new THREE.BoxGeometry(size, height, size);
    const material = new THREE.MeshLambertMaterial({
      color: ENEMY_COLORS[enemy.type] || 0x00ff00,
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(enemy.worldPosition.x, height / 2, enemy.worldPosition.z);

    this.enemiesGroup.add(mesh);
    this.entityMeshes.set(enemy.id, mesh);
  }

  /**
   * Adds a projectile mesh to the scene.
   */
  addProjectile(projectile: Projectile): void {
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    const material = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(
      projectile.worldPosition.x,
      0.5,
      projectile.worldPosition.z
    );

    this.projectilesGroup.add(mesh);
    this.entityMeshes.set(projectile.id, mesh);
  }

  /**
   * Removes an entity mesh from the scene.
   */
  removeEntity(entityId: string): void {
    const mesh = this.entityMeshes.get(entityId);
    if (mesh) {
      mesh.parent?.remove(mesh);
      this.entityMeshes.delete(entityId);
    }

    // Remove health bar if exists
    const bar = this.healthBars.get(entityId);
    if (bar) {
      bar.parent?.remove(bar);
      this.healthBars.delete(entityId);
    }
    const barBg = this.healthBarBgs.get(entityId);
    if (barBg) {
      barBg.parent?.remove(barBg);
      this.healthBarBgs.delete(entityId);
    }
  }

  /**
   * Updates entity positions using interpolation alpha.
   */
  updatePositions(_alpha: number): void {
    // Update enemy positions
    for (const enemy of this.entityStore.enemies.values()) {
      const mesh = this.entityMeshes.get(enemy.id);
      if (mesh) {
        const height = enemy.type === 'brute_enemy' ? 0.4 : 0.25;
        mesh.position.set(enemy.worldPosition.x, height, enemy.worldPosition.z);
      }
    }

    // Update projectile positions
    for (const projectile of this.entityStore.projectiles.values()) {
      const mesh = this.entityMeshes.get(projectile.id);
      if (mesh) {
        mesh.position.set(projectile.worldPosition.x, 0.5, projectile.worldPosition.z);
      }
    }
  }

  /**
   * Updates health bar for an entity.
   */
  updateHealthBar(entityId: string, currentHealth: number, maxHealth: number): void {
    const mesh = this.entityMeshes.get(entityId);
    if (!mesh) return;

    const ratio = Math.max(0, currentHealth / maxHealth);

    // Only show health bars for structures when damaged
    if (entityId !== this.entityStore.criticalResource.id && ratio >= 1) {
      // Remove bar if at full health
      const bar = this.healthBars.get(entityId);
      if (bar) {
        bar.parent?.remove(bar);
        this.healthBars.delete(entityId);
      }
      const barBg = this.healthBarBgs.get(entityId);
      if (barBg) {
        barBg.parent?.remove(barBg);
        this.healthBarBgs.delete(entityId);
      }
      return;
    }

    let bar = this.healthBars.get(entityId);
    if (!bar) {
      const width = entityId === this.entityStore.criticalResource.id ? 2 : 0.8;
      this.createHealthBar(entityId, mesh, width);
      bar = this.healthBars.get(entityId);
    }

    if (bar) {
      bar.scale.x = ratio;
      // Change color based on health
      const mat = bar.material as THREE.MeshBasicMaterial;
      if (ratio > 0.5) mat.color.setHex(0x00ff00);
      else if (ratio > 0.25) mat.color.setHex(0xffff00);
      else mat.color.setHex(0xff0000);
    }
  }

  /**
   * Creates a health bar above an entity.
   */
  private createHealthBar(entityId: string, parentMesh: THREE.Object3D, width: number): void {
    const barHeight = 0.08;
    const yOffset = parentMesh.position.y + 1.2;

    // Background (dark)
    const bgGeometry = new THREE.PlaneGeometry(width, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.set(parentMesh.position.x, yOffset, parentMesh.position.z);
    bgMesh.rotation.x = -Math.PI / 4;
    bgMesh.lookAt(this.camera.position);
    this.vfxGroup.add(bgMesh);
    this.healthBarBgs.set(entityId, bgMesh);

    // Foreground (green)
    const fgGeometry = new THREE.PlaneGeometry(width, barHeight);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const fgMesh = new THREE.Mesh(fgGeometry, fgMaterial);
    fgMesh.position.set(parentMesh.position.x, yOffset + 0.01, parentMesh.position.z);
    fgMesh.rotation.x = -Math.PI / 4;
    fgMesh.lookAt(this.camera.position);
    this.vfxGroup.add(fgMesh);
    this.healthBars.set(entityId, fgMesh);
  }

  /**
   * Sets grid overlay visibility (shown only during Preparation Phase).
   */
  setGridOverlayVisible(visible: boolean): void {
    this.gridOverlayVisible = visible;
    if (this.gridOverlay) {
      this.gridOverlay.visible = visible;
    }
  }

  /**
   * Synchronizes the render state with entity store - adds/removes meshes as needed.
   */
  sync(): void {
    // Add new structures
    for (const structure of this.entityStore.structures.values()) {
      if (!this.entityMeshes.has(structure.id)) {
        this.addStructure(structure);
      }
    }

    // Add new enemies
    for (const enemy of this.entityStore.enemies.values()) {
      if (!this.entityMeshes.has(enemy.id)) {
        this.addEnemy(enemy);
      }
    }

    // Add new projectiles
    for (const projectile of this.entityStore.projectiles.values()) {
      if (!this.entityMeshes.has(projectile.id)) {
        this.addProjectile(projectile);
      }
    }

    // Remove meshes for entities that no longer exist
    for (const [entityId] of this.entityMeshes) {
      if (entityId === this.entityStore.criticalResource.id) continue;
      if (
        !this.entityStore.structures.has(entityId) &&
        !this.entityStore.enemies.has(entityId) &&
        !this.entityStore.projectiles.has(entityId)
      ) {
        this.removeEntity(entityId);
      }
    }

    // Update health bars
    for (const structure of this.entityStore.structures.values()) {
      if (structure.currentHealth < structure.maxHealth) {
        this.updateHealthBar(structure.id, structure.currentHealth, structure.maxHealth);
      }
    }

    // Update CR health bar
    const cr = this.entityStore.criticalResource;
    this.updateHealthBar(cr.id, cr.currentHealth, cr.maxHealth);
  }

  /**
   * Renders the scene.
   */
  render(alpha: number): void {
    this.sync();
    this.updatePositions(alpha);
    this.renderer.render(this.scene, this.camera);
    this.cssRenderer.render(this.scene, this.camera);
  }

  /**
   * Returns the Three.js scene (for VFX system).
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Returns the camera (for raycasting).
   */
  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  /**
   * Returns the renderer DOM element (for event listeners).
   */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Returns the CSS2D renderer (for VFX).
   */
  getCSSRenderer(): CSS2DRenderer {
    return this.cssRenderer;
  }

  /**
   * Handles window resize.
   */
  private onResize(container: HTMLElement): void {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const gridW = GameConfig.grid.width;
    const gridH = GameConfig.grid.height;
    const aspect = width / height;
    const frustumSize = Math.max(gridW, gridH) * 1.2;

    const halfW = (frustumSize * aspect) / 2;
    const halfH = frustumSize / 2;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.cssRenderer.setSize(width, height);
  }

  /**
   * Cleans up renderer resources.
   */
  dispose(): void {
    this.renderer.dispose();
  }
}
