import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { GridVisualizer } from '../GridVisualizer';
import type { TerrainData } from '../TerrainData';
import type { TerrainPoint } from '../TerrainPoint';

const SIZE_X = 20;
const SIZE_Y = 10;
const SIZE_Z = 20;

type PinchToolOptions = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  visualizer: GridVisualizer;
  getTerrain: () => TerrainData;
  getTerrainPoint: (event: PointerEvent) => TerrainPoint | null;
  isEnabled: () => boolean;
  getViewportHeight: () => number;
};

export class PinchTool {
  private readonly options: PinchToolOptions;
  private readonly highlight: THREE.Mesh;
  private hoveredPoint: TerrainPoint | null = null;
  private dragging = false;
  private lastPointerY = 0;

  constructor(options: PinchToolOptions) {
    this.options = options;
    this.highlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        depthTest: false,
      })
    );

    this.highlight.visible = false;
    this.highlight.renderOrder = 999;
    options.scene.add(this.highlight);
  }

  onPointerMove = (event: PointerEvent): void => {
    const { renderer } = this.options;

    if (!this.options.isEnabled()) {
      this.highlight.visible = false;
      this.hoveredPoint = null;
      renderer.domElement.style.cursor = 'default';
      return;
    }

    if (this.dragging && this.hoveredPoint) {
      const deltaPixels = this.lastPointerY - event.clientY;
      this.lastPointerY = event.clientY;

      const { camera, controls, visualizer } = this.options;
      const terrain = this.options.getTerrain();
      const distance = camera.position.distanceTo(controls.target);
      const visibleWorldHeight =
        2 *
        distance *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const heightChange =
        deltaPixels * visibleWorldHeight / this.options.getViewportHeight();

      if (Math.abs(heightChange) > 0.0001) {
        const centerX = this.hoveredPoint.x;
        const centerZ = this.hoveredPoint.z;
        const radius = 4;

        for (
          let z = Math.max(0, centerZ - radius);
          z <= Math.min(SIZE_Z - 1, centerZ + radius);
          z++
        ) {
          for (
            let x = Math.max(0, centerX - radius);
            x <= Math.min(SIZE_X - 1, centerX + radius);
            x++
          ) {
            const dx = x - centerX;
            const dz = z - centerZ;
            const gridDistance = Math.sqrt(dx * dx + dz * dz);

            if (gridDistance > radius) continue;

            const weight = Math.pow(1 / 3, gridDistance);
            const index = z * SIZE_X + x;
            const minChange = Math.max(
              0.1 - terrain.stoneHeights[index],
              0.1 - terrain.surfaceHeights[index]
            );
            const maxChange = Math.min(
              SIZE_Y - 0.1 - terrain.stoneHeights[index],
              SIZE_Y - 0.1 - terrain.surfaceHeights[index]
            );
            const change = THREE.MathUtils.clamp(
              heightChange * weight,
              minChange,
              maxChange
            );

            terrain.stoneHeights[index] += change;
            terrain.surfaceHeights[index] += change;
          }
        }

        visualizer.update(terrain);
      }

      this.moveHighlight(this.hoveredPoint);
      renderer.domElement.style.cursor = 'ns-resize';
      return;
    }

    this.hoveredPoint = this.options.getTerrainPoint(event);

    if (this.hoveredPoint) {
      this.moveHighlight(this.hoveredPoint);
      renderer.domElement.style.cursor = 'pointer';
    } else {
      this.highlight.visible = false;
      renderer.domElement.style.cursor = 'crosshair';
    }
  };

  onPointerDown = (event: PointerEvent): void => {
    if (!this.options.isEnabled() || !this.hoveredPoint) return;

    const { controls, renderer } = this.options;
    this.dragging = true;
    this.lastPointerY = event.clientY;
    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.style.cursor = 'ns-resize';
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging) return;

    this.dragging = false;
    this.options.controls.enabled = true;

    if (this.options.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.options.renderer.domElement.releasePointerCapture(event.pointerId);
    }
  };

  onPointerLeave = (): void => {
    if (!this.dragging) {
      this.highlight.visible = false;
      this.hoveredPoint = null;
    }
  };

  hideHighlight(): void {
    this.highlight.visible = false;
  }

  dispose(): void {
    this.options.scene.remove(this.highlight);
    this.highlight.geometry.dispose();
    (this.highlight.material as THREE.Material).dispose();
  }

  private moveHighlight(point: TerrainPoint): void {
    const terrain = this.options.getTerrain();
    this.highlight.position.set(
      point.x - (SIZE_X - 1) / 2,
      terrain.surfaceHeights[point.index] + 0.12,
      point.z - (SIZE_Z - 1) / 2
    );
    this.highlight.visible = true;
  }
}
