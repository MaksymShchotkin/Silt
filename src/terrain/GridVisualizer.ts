
import * as THREE from 'three';
import type { TerrainData } from './TerrainData';

type Point3 = [number, number, number];

export class GridVisualizer {
  private scene: THREE.Scene;
  private meshes: THREE.Mesh[] = [];
  private surfaceMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getSurfaceMesh(): THREE.Mesh | null {
    return this.surfaceMesh;
  }

  rebuild(data: TerrainData): void {
    this.dispose();

    const { sizeX, sizeZ, stoneHeights, surfaceHeights } = data;

    const indexOf = (x: number, z: number) => z * sizeX + x;
    const worldX = (x: number) => x - (sizeX - 1) / 2;
    const worldZ = (z: number) => z - (sizeZ - 1) / 2;

    // Create a triangulated top surface from any height map.
    const createTopMesh = (
      heights: number[],
      color: number
    ): THREE.Mesh => {
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

    // The stone bed gets its own polygonal top.
    const stoneTop = createTopMesh(stoneHeights, 0x777b80);
    this.addMesh(stoneTop);

    // The green surface is the visible top of the terrain.
    this.surfaceMesh = createTopMesh(surfaceHeights, 0x78a66a);
    this.addMesh(this.surfaceMesh);

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
          color: 0x777b80,
          roughness: 1,
          side: THREE.DoubleSide,
        })
      )
    );

    this.addMesh(
      new THREE.Mesh(
        makeGeometry(coatingPositions, coatingIndices),
        new THREE.MeshStandardMaterial({
          color: 0x78a66a,
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
          color: 0x777b80,
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
  }
}
