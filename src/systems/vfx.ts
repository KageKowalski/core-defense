/**
 * VFXSystem - Visual effects: floating text, destruction particles, placement indicators.
 * Uses CSS2DRenderer for floating text projected into 3D space.
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { WorldPosition } from '../models/grid';
import { GameConfig } from '../models/config';

interface FloatingText {
  id: string;
  element: HTMLDivElement;
  cssObject: CSS2DObject;
  position: WorldPosition;
  age: number;
  maxAge: number;
  yOffset: number;
  stackIndex: number;
}

interface DestructionEffect {
  particles: THREE.Mesh[];
  velocities: THREE.Vector3[];
  age: number;
  maxAge: number;
}

interface PlacementIndicator {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

const MAX_FLOATING_TEXTS = 20;

/**
 * VFXSystem class managing floating text, destruction effects, and indicators.
 */
export class VFXSystem {
  private scene: THREE.Scene;
  private floatingTexts: FloatingText[] = [];
  private destructionEffects: DestructionEffect[] = [];
  private placementIndicators: PlacementIndicator[] = [];
  private nextId: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Updates all active VFX.
   * @param dt - Time delta in seconds
   */
  update(dt: number): void {
    this.updateFloatingTexts(dt);
    this.updateDestructionEffects(dt);
    this.updatePlacementIndicators(dt);
  }

  /**
   * Spawns a floating text at a world position.
   * Text animates upward and fades over 1 second.
   */
  spawnFloatingText(position: WorldPosition, text: string, color: string): void {
    // Cap at MAX_FLOATING_TEXTS - remove oldest first
    while (this.floatingTexts.length >= MAX_FLOATING_TEXTS) {
      const oldest = this.floatingTexts.shift()!;
      this.scene.remove(oldest.cssObject);
      oldest.element.remove();
    }

    // Calculate stack index (nearby texts)
    const nearbyTexts = this.floatingTexts.filter(t => {
      const dx = t.position.x - position.x;
      const dz = t.position.z - position.z;
      return Math.sqrt(dx * dx + dz * dz) < 0.5;
    });
    const stackIndex = nearbyTexts.length;

    // Create HTML element
    const element = document.createElement('div');
    element.className = 'floating-text';
    element.textContent = text;
    element.style.color = color;
    element.style.fontSize = '14px';
    element.style.fontWeight = 'bold';
    element.style.textShadow = '1px 1px 2px black';
    element.style.pointerEvents = 'none';
    element.style.whiteSpace = 'nowrap';

    const cssObject = new CSS2DObject(element);
    cssObject.position.set(
      position.x,
      1.5 + stackIndex * 0.3,
      position.z
    );

    this.scene.add(cssObject);

    const ft: FloatingText = {
      id: `ft_${this.nextId++}`,
      element,
      cssObject,
      position,
      age: 0,
      maxAge: 1.0,
      yOffset: stackIndex * 20,
      stackIndex,
    };

    this.floatingTexts.push(ft);
  }

  /**
   * Spawns a destruction particle burst at a position.
   * 8-12 small cubes expanding outward, lasting 0.5 seconds.
   */
  spawnDestructionEffect(position: WorldPosition): void {
    const particleCount = 8 + Math.floor(Math.random() * 5); // 8-12
    const particles: THREE.Mesh[] = [];
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 1,
      });
      const particle = new THREE.Mesh(geometry, material);
      particle.position.set(position.x, 0.5, position.z);

      // Random outward velocity
      const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * speed,
        2 + Math.random() * 3,
        Math.sin(angle) * speed
      ));

      this.scene.add(particle);
      particles.push(particle);
    }

    this.destructionEffects.push({
      particles,
      velocities,
      age: 0,
      maxAge: 0.5,
    });
  }

  /**
   * Spawns a red flash indicator for invalid placement.
   * Lasts 1 second.
   */
  spawnInvalidPlacementIndicator(row: number, col: number): void {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(col + 0.5, 0.02, row + 0.5);
    this.scene.add(mesh);

    this.placementIndicators.push({
      mesh,
      age: 0,
      maxAge: 1.0,
    });
  }

  /**
   * Updates floating text - animate upward and fade.
   */
  private updateFloatingTexts(dt: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.age += dt;

      if (ft.age >= ft.maxAge) {
        toRemove.push(i);
        this.scene.remove(ft.cssObject);
        ft.element.remove();
        continue;
      }

      // Animate upward
      ft.cssObject.position.y += dt * 1.5;

      // Fade out
      const progress = ft.age / ft.maxAge;
      ft.element.style.opacity = String(1 - progress);
    }

    // Remove expired texts (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.floatingTexts.splice(toRemove[i], 1);
    }
  }

  /**
   * Updates destruction particle effects.
   */
  private updateDestructionEffects(dt: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.destructionEffects.length; i++) {
      const effect = this.destructionEffects[i];
      effect.age += dt;

      if (effect.age >= effect.maxAge) {
        toRemove.push(i);
        for (const particle of effect.particles) {
          this.scene.remove(particle);
        }
        continue;
      }

      const progress = effect.age / effect.maxAge;

      for (let j = 0; j < effect.particles.length; j++) {
        const particle = effect.particles[j];
        const vel = effect.velocities[j];

        // Update position
        particle.position.x += vel.x * dt;
        particle.position.y += vel.y * dt - 9.8 * dt * effect.age; // Gravity
        particle.position.z += vel.z * dt;

        // Fade out
        const mat = particle.material as THREE.MeshBasicMaterial;
        mat.opacity = 1 - progress;
      }
    }

    // Remove expired effects (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.destructionEffects.splice(toRemove[i], 1);
    }
  }

  /**
   * Updates placement indicators (fade out).
   */
  private updatePlacementIndicators(dt: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.placementIndicators.length; i++) {
      const indicator = this.placementIndicators[i];
      indicator.age += dt;

      if (indicator.age >= indicator.maxAge) {
        toRemove.push(i);
        this.scene.remove(indicator.mesh);
        continue;
      }

      // Fade out
      const progress = indicator.age / indicator.maxAge;
      const mat = indicator.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 * (1 - progress);
    }

    // Remove expired indicators (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.placementIndicators.splice(toRemove[i], 1);
    }
  }

  /**
   * Clears all active VFX.
   */
  reset(): void {
    // Clear floating texts
    for (const ft of this.floatingTexts) {
      this.scene.remove(ft.cssObject);
      ft.element.remove();
    }
    this.floatingTexts = [];

    // Clear destruction effects
    for (const effect of this.destructionEffects) {
      for (const particle of effect.particles) {
        this.scene.remove(particle);
      }
    }
    this.destructionEffects = [];

    // Clear placement indicators
    for (const indicator of this.placementIndicators) {
      this.scene.remove(indicator.mesh);
    }
    this.placementIndicators = [];
  }
}
