
import * as THREE from 'three';
import type { TerrainData } from './TerrainData';

type Point3 = [number, number, number];

export class GridVisualizer {
  private scene: THREE.Scene;
  private meshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  rebuild(data: TerrainData): void {
    this.dispose();

    const { sizeX, sizeZ, stoneHeights, surfaceHeights } = data;

    const indexOf = (x: number, z: number) => z * sizeX + x;

    const worldX = (x: number) => x - (sizeX - 1) / 2;
    const worldZ = (z: number) => z - (sizeZ - 1) / 2;

    // Build the green top surface.
    const topPositions: number[] = [];
    const topIndices: number[] = [];

    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        topPositions.push(
          worldX(x),
          surfaceHeights[indexOf(x, z)],
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

        topIndices.push(a, c, b);
        topIndices.push(b, c, d);
      }
    }

    const topGeometry = new THREE.BufferGeometry();
    topGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(topPositions, 3)
    );
    topGeometry.setIndex(topIndices);
    topGeometry.computeVertexNormals();

    const surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x78a66a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });

    this.addMesh(topGeometry, surfaceMaterial);

    // Helper for constructing vertical wall quads.
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

      positions.push(
        ...lowerA,
        ...lowerB,
        ...upperA,
        ...upperB
      );

      indices.push(
        start, start + 1, start + 2,
        start + 1, start + 3, start + 2
      );
    };

    // Add both the stone wall and green coating to an edge.
    const addEdge = (x1: number, z1: number, x2: number, z2: number) => {
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

      // Stone foundation: ground level to the top of the stone.
      addQuad(
        stonePositions,
        stoneIndices,
        [xa, 0, za],
        [xb, 0, zb],
        [xa, stoneA, za],
        [xb, stoneB, zb]
      );

      // Surface coating: top of stone to the terrain surface.
      addQuad(
        coatingPositions,
        coatingIndices,
        [xa, stoneA, za],
        [xb, stoneB, zb],
        [xa, surfaceA, za],
        [xb, surfaceB, zb]
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

    const stoneGeometry = new THREE.BufferGeometry();
    stoneGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(stonePositions, 3)
    );
    stoneGeometry.setIndex(stoneIndices);
    stoneGeometry.computeVertexNormals();

    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x777b80,
      roughness: 1,
      side: THREE.DoubleSide,
    });

    this.addMesh(stoneGeometry, stoneMaterial);

    const coatingGeometry = new THREE.BufferGeometry();
    coatingGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(coatingPositions, 3)
    );
    coatingGeometry.setIndex(coatingIndices);
    coatingGeometry.computeVertexNormals();

    this.addMesh(coatingGeometry, surfaceMaterial);

    // Flat underside of the stone bed.
    const xMin = worldX(0);
    const xMax = worldX(sizeX - 1);
    const zMin = worldZ(0);
    const zMax = worldZ(sizeZ - 1);

    const bottomGeometry = new THREE.BufferGeometry();
    bottomGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          xMin, 0, zMin,
          xMax, 0, zMin,
          xMin, 0, zMax,
          xMax, 0, zMax,
        ],
        3
      )
    );
    bottomGeometry.setIndex([0, 2, 1, 1, 2, 3]);
    bottomGeometry.computeVertexNormals();

    this.addMesh(
      bottomGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x777b80,
        roughness: 1,
        side: THREE.DoubleSide,
      })
    );
  }

  private addMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material
  ): void {
    const mesh = new THREE.Mesh(geometry, material);
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
  }
}
