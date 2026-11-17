
import * as THREE from 'three';
import type { TerrainData } from './TerrainData';

type Point3 = [number, number, number];

const STONE_COLOR = 0x777b80;
const SURFACE_COLOR = 0x78a66a;
const COATING_BLEND_DEPTH = 0.35;
const COATING_EPSILON = 0.0001;

export class GridVisualizer {
  private scene: THREE.Scene;
  private meshes: THREE.Mesh[] = [];
  private surfaceMesh: THREE.Mesh | null = null;
  private topMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getSurfaceMesh(): THREE.Mesh | null {
    return this.surfaceMesh;
  }

  getTopMeshes(): THREE.Mesh[] {
    return this.topMeshes;
  }

  rebuild(data: TerrainData): void {
    this.dispose();

    const { sizeX, sizeZ, stoneHeights, surfaceHeights } = data;

    const indexOf = (x: number, z: number) => z * sizeX + x;
    const worldX = (x: number) => x - (sizeX - 1) / 2;
    const worldZ = (z: number) => z - (sizeZ - 1) / 2;

    // Create a triangulated top surface from any height map.
    const createTopMesh = (heights: number[], color: number): THREE.Mesh => {
      const positions: number[] = [];
      const indices: number[] = [];

      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          positions.push(
            worldX(x),
            heights[indexOf(x, z)],
            worldZ(z)
          );
        }
      }

      for (let z = 0; z < sizeZ - 1; z++) {
        for (let x = 0; x < sizeX - 1; x++) {
          const a = indexOf(x, z);
          const b = indexOf(x + 1, z);
          const c = indexOf(x, z + 1);
          const d = indexOf(x + 1, z + 1);

          indices.push(a, c, b, b, c, d);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });

      return new THREE.Mesh(geometry, material);
    };

    const createSurfaceMesh = (): THREE.Mesh => {
      const positions: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const stoneColor = new THREE.Color(STONE_COLOR);
      const surfaceColor = new THREE.Color(SURFACE_COLOR);

      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          const index = indexOf(x, z);
          const thickness = Math.max(
            0,
            surfaceHeights[index] - stoneHeights[index]
          );
          const blend = THREE.MathUtils.clamp(
            thickness / COATING_BLEND_DEPTH,
            0,
            1
          );
          const vertexColor = stoneColor.clone().lerp(surfaceColor, blend);

          positions.push(
            worldX(x),
            surfaceHeights[index],
            worldZ(z)
          );
          colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
        }
      }

      const hasCoating = (index: number) =>
        surfaceHeights[index] - stoneHeights[index] > COATING_EPSILON;

      for (let z = 0; z < sizeZ - 1; z++) {
        for (let x = 0; x < sizeX - 1; x++) {
          const a = indexOf(x, z);
          const b = indexOf(x + 1, z);
          const c = indexOf(x, z + 1);
          const d = indexOf(x + 1, z + 1);

          if (hasCoating(a) || hasCoating(c) || hasCoating(b)) {
            indices.push(a, c, b);
          }

          if (hasCoating(b) || hasCoating(c) || hasCoating(d)) {
            indices.push(b, c, d);
          }
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3)
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      return new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.9,
          side: THREE.DoubleSide,
        })
      );
    };

    // The stone bed gets its own polygonal top.
    const stoneTop = createTopMesh(stoneHeights, STONE_COLOR);
    this.addMesh(stoneTop);

    // Exposed stone triangles are omitted; thin coating blends into stone.
    this.surfaceMesh = createSurfaceMesh();
    this.addMesh(this.surfaceMesh);
    this.topMeshes = [stoneTop, this.surfaceMesh];

    const stonePositions: number[] = [];
    const stoneIndices: number[] = [];
    const coatingPositions: number[] = [];
    const coatingIndices: number[] = [];

    const addQuad = (
      positions: number[],
      indices: number[],
      lowerA: Point3,
      lowerB: Point3,
      upperA: Point3,
      upperB: Point3
    ) => {
      const start = positions.length / 3;

      positions.push(...lowerA, ...lowerB, ...upperA, ...upperB);

      indices.push(
        start, start + 1, start + 2,
        start + 1, start + 3, start + 2
      );
    };

    const addEdge = (
      x1: number,
      z1: number,
      x2: number,
      z2: number
    ) => {
      const i1 = indexOf(x1, z1);
      const i2 = indexOf(x2, z2);

      const xa = worldX(x1);
      const za = worldZ(z1);
      const xb = worldX(x2);
      const zb = worldZ(z2);

      const stoneA = stoneHeights[i1];
      const stoneB = stoneHeights[i2];
      const surfaceA = surfaceHeights[i1];
      const surfaceB = surfaceHeights[i2];

      // Gray stone from the base to the stone-bed top.
      addQuad(
        stonePositions, stoneIndices,
        [xa, 0, za], [xb, 0, zb],
        [xa, stoneA, za], [xb, stoneB, zb]
      );

      // Green coating above the stone bed.
      addQuad(
        coatingPositions, coatingIndices,
        [xa, stoneA, za], [xb, stoneB, zb],
        [xa, surfaceA, za], [xb, surfaceB, zb]
      );
    };

    // Front and back edges.
    for (let x = 0; x < sizeX - 1; x++) {
      addEdge(x, 0, x + 1, 0);
      addEdge(x + 1, sizeZ - 1, x, sizeZ - 1);
    }

    // Left and right edges.
    for (let z = 0; z < sizeZ - 1; z++) {
      addEdge(0, z + 1, 0, z);
      addEdge(sizeX - 1, z, sizeX - 1, z + 1);
    }

    const makeGeometry = (
      positions: number[],
      indices: number[]
    ): THREE.BufferGeometry => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    this.addMesh(
      new THREE.Mesh(
        makeGeometry(stonePositions, stoneIndices),
        new THREE.MeshStandardMaterial({
          color: STONE_COLOR,
          roughness: 1,
          side: THREE.DoubleSide,
        })
      )
    );

    this.addMesh(
      new THREE.Mesh(
        makeGeometry(coatingPositions, coatingIndices),
        new THREE.MeshStandardMaterial({
          color: SURFACE_COLOR,
          roughness: 0.9,
          side: THREE.DoubleSide,
        })
      )
    );

    // Flat underside of the stone bed.
    const xMin = worldX(0);
    const xMax = worldX(sizeX - 1);
    const zMin = worldZ(0);
    const zMax = worldZ(sizeZ - 1);

    const bottom = makeGeometry(
      [
        xMin, 0, zMin,
        xMax, 0, zMin,
        xMin, 0, zMax,
        xMax, 0, zMax,
      ],
      [0, 2, 1, 1, 2, 3]
    );

    this.addMesh(
      new THREE.Mesh(
        bottom,
        new THREE.MeshStandardMaterial({
          color: STONE_COLOR,
          roughness: 1,
          side: THREE.DoubleSide,
        })
      )
    );
  }

  private addMesh(mesh: THREE.Mesh): void {
    this.meshes.push(mesh);
    this.scene.add(mesh);
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();

      const material = mesh.material;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
    }

    this.meshes = [];
    this.surfaceMesh = null;
    this.topMeshes = [];
  }
}
