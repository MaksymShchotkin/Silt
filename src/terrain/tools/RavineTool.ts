import * as THREE from 'three';

import type { GridVisualizer } from '../GridVisualizer';
import type { TerrainData } from '../TerrainData';
import type { TerrainPoint } from '../TerrainPoint';

const SIZE_X = 20;
const SIZE_Z = 20;
const RAVINE_WIDTH = 1.8;
const RAVINE_SPEED = 0.2;
const TERRAIN_BOTTOM = 0.1;

type RavineToolOptions = {
  scene: THREE.Scene;
  visualizer: GridVisualizer;
  getTerrain: () => TerrainData;
  onPointsChange: (points: TerrainPoint[]) => void;
};

export class RavineTool {
  private readonly options: RavineToolOptions;
  private readonly markers: THREE.Mesh[] = [];
  private readonly line: THREE.Line;
  private points: TerrainPoint[] = [];
  private erosionWeights = new Float32Array(SIZE_X * SIZE_Z);

  constructor(options: RavineToolOptions) {
    this.options = options;
    this.line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffd166,
        depthTest: false,
      })
    );
    this.line.visible = false;
    this.line.renderOrder = 1000;
    options.scene.add(this.line);
  }

  get selectedPoints(): readonly TerrainPoint[] {
    return this.points;
  }

  addPoint(point: TerrainPoint): boolean {
    if (this.points.some((selected) => selected.index === point.index)) {
      return false;
    }

    this.points.push(point);
    this.updateErosionWeights();
    this.updateVisuals();
    this.options.onPointsChange([...this.points]);
    return true;
  }

  clear(): void {
    this.points = [];
    this.erosionWeights.fill(0);
    this.options.onPointsChange([]);

    for (const marker of this.markers) {
      marker.visible = false;
    }

    this.line.visible = false;
  }

  erode(deltaSeconds: number): void {
    if (this.points.length < 2) return;

    const terrain = this.options.getTerrain();
    let terrainChanged = false;

    for (let index = 0; index < this.erosionWeights.length; index++) {
      const weight = this.erosionWeights[index];
      if (weight === 0) continue;

      let erosionBudget = RAVINE_SPEED * deltaSeconds * weight;
      const stoneHeight = terrain.stoneHeights[index];
      const surfaceHeight = terrain.surfaceHeights[index];
      const coatingThickness = Math.max(0, surfaceHeight - stoneHeight);

      if (coatingThickness > 0) {
        const surfaceHardiness = terrain.upperLayer.hardiness;
        const surfaceDrop = Math.min(
          coatingThickness,
          erosionBudget / surfaceHardiness
        );
        terrain.surfaceHeights[index] -= surfaceDrop;
        erosionBudget -= surfaceDrop * surfaceHardiness;

        if (erosionBudget > 0) {
          const stoneDrop = Math.min(
            erosionBudget / terrain.lowerLayer.hardiness,
            Math.max(0, stoneHeight - TERRAIN_BOTTOM)
          );
          terrain.stoneHeights[index] -= stoneDrop;
          terrain.surfaceHeights[index] -= stoneDrop;
        }
      } else {
        const stoneDrop = Math.min(
          erosionBudget / terrain.lowerLayer.hardiness,
          Math.max(0, stoneHeight - TERRAIN_BOTTOM)
        );
        terrain.stoneHeights[index] -= stoneDrop;
        terrain.surfaceHeights[index] -= stoneDrop;
      }

      if (
        terrain.stoneHeights[index] !== stoneHeight ||
        terrain.surfaceHeights[index] !== surfaceHeight
      ) {
        terrainChanged = true;
      }
    }

    if (terrainChanged) {
      this.options.visualizer.update(terrain);
    }
  }

  dispose(): void {
    for (const marker of this.markers) {
      this.options.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    }
    this.markers.length = 0;

    this.options.scene.remove(this.line);
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
    this.points = [];
  }

  private updateVisuals(): void {
    const { scene, getTerrain } = this.options;
    const terrain = getTerrain();

    for (const marker of this.markers) {
      scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    }
    this.markers.length = 0;

    for (const point of this.points) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 12, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffd166,
          depthTest: false,
        })
      );
      marker.position.set(
        point.x - (SIZE_X - 1) / 2,
        terrain.surfaceHeights[point.index] + 0.2,
        point.z - (SIZE_Z - 1) / 2
      );
      marker.renderOrder = 1000;
      scene.add(marker);
      this.markers.push(marker);
    }

    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry().setFromPoints(
      this.points.map(
        (point) => new THREE.Vector3(
          point.x - (SIZE_X - 1) / 2,
          terrain.surfaceHeights[point.index] + 0.2,
          point.z - (SIZE_Z - 1) / 2
        )
      )
    );
    this.line.visible = this.points.length >= 2;
  }

  private updateErosionWeights(): void {
    this.erosionWeights.fill(0);

    if (this.points.length < 2) return;

    const curvePoints = this.points.map(
      (point) => new THREE.Vector3(point.x, 0, point.z)
    );
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const pathPoints = curve.getPoints((this.points.length - 1) * 20);

    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        let shortestDistance = Infinity;

        for (let i = 0; i < pathPoints.length - 1; i++) {
          shortestDistance = Math.min(
            shortestDistance,
            this.distanceToSegment(
              x,
              z,
              pathPoints[i].x,
              pathPoints[i].z,
              pathPoints[i + 1].x,
              pathPoints[i + 1].z
            )
          );
        }

        if (shortestDistance >= RAVINE_WIDTH) continue;

        const falloff = 1 - shortestDistance / RAVINE_WIDTH;
        this.erosionWeights[z * SIZE_X + x] = falloff * falloff;
      }
    }
  }

  private distanceToSegment(
    px: number,
    pz: number,
    ax: number,
    az: number,
    bx: number,
    bz: number
  ): number {
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;

    if (lengthSquared === 0) {
      return Math.hypot(px - ax, pz - az);
    }

    const t = THREE.MathUtils.clamp(
      ((px - ax) * dx + (pz - az) * dz) / lengthSquared,
      0,
      1
    );
    const closestX = ax + t * dx;
    const closestZ = az + t * dz;
    return Math.hypot(px - closestX, pz - closestZ);
  }
}
