import * as THREE from 'three';
import type { TerrainData } from './TerrainData';

type Point3 = [number, number, number];

const COATING_BLEND_DEPTH = 0.35;

export class GridVisualizer {
  private readonly scene: THREE.Scene;
  private readonly lowerColor = new THREE.Color();
  private readonly upperColor = new THREE.Color();
  private meshes: THREE.Mesh[] = [];
  private surfaceMesh: THREE.Mesh | null = null;
  private topMeshes: THREE.Mesh[] = [];
  private stoneSideMesh: THREE.Mesh | null = null;
  private coatingSideMesh: THREE.Mesh | null = null;
  private sizeX = 0;
  private sizeZ = 0;

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
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.lowerColor.setHex(data.lowerLayer.color);
    this.upperColor.setHex(data.upperLayer.color);

    const indexOf = (x: number, z: number) => z * sizeX + x;
    const worldX = (x: number) => x - (sizeX - 1) / 2;
    const worldZ = (z: number) => z - (sizeZ - 1) / 2;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

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

        positions.push(worldX(x), surfaceHeights[index], worldZ(z));
        colors.push(
          THREE.MathUtils.lerp(this.lowerColor.r, this.upperColor.r, blend),
          THREE.MathUtils.lerp(this.lowerColor.g, this.upperColor.g, blend),
          THREE.MathUtils.lerp(this.lowerColor.b, this.upperColor.b, blend)
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

    const surfaceGeometry = new THREE.BufferGeometry();
    surfaceGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    surfaceGeometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colors, 3)
    );
    surfaceGeometry.setIndex(indices);
    surfaceGeometry.computeVertexNormals();

    this.surfaceMesh = new THREE.Mesh(
      surfaceGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
    );
    this.addMesh(this.surfaceMesh);
    this.topMeshes = [this.surfaceMesh];

    const sidePositions = this.createSidePositions(data);
    this.stoneSideMesh = new THREE.Mesh(
      this.makeGeometry(sidePositions.stone, sidePositions.stoneIndices),
      new THREE.MeshStandardMaterial({
        color: data.lowerLayer.color,
        roughness: 1,
        side: THREE.DoubleSide,
      })
    );
    this.addMesh(this.stoneSideMesh);

    this.coatingSideMesh = new THREE.Mesh(
      this.makeGeometry(sidePositions.coating, sidePositions.coatingIndices),
      new THREE.MeshStandardMaterial({
        color: data.upperLayer.color,
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
    );
    this.addMesh(this.coatingSideMesh);

    const bottom = this.makeGeometry(
      [
        worldX(0), 0, worldZ(0),
        worldX(sizeX - 1), 0, worldZ(0),
        worldX(0), 0, worldZ(sizeZ - 1),
        worldX(sizeX - 1), 0, worldZ(sizeZ - 1),
      ],
      [0, 2, 1, 1, 2, 3]
    );
    this.addMesh(
      new THREE.Mesh(
        bottom,
        new THREE.MeshStandardMaterial({
          color: data.lowerLayer.color,
          roughness: 1,
          side: THREE.DoubleSide,
        })
      )
    );
  }

  update(data: TerrainData): void {
    if (
      !this.surfaceMesh ||
      !this.stoneSideMesh ||
      !this.coatingSideMesh ||
      data.sizeX !== this.sizeX ||
      data.sizeZ !== this.sizeZ
    ) {
      this.rebuild(data);
      return;
    }

    const { sizeX, sizeZ, stoneHeights, surfaceHeights } = data;
    const surfaceGeometry = this.surfaceMesh.geometry;
    const position = surfaceGeometry.getAttribute('position');
    const color = surfaceGeometry.getAttribute('color');

    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const index = z * sizeX + x;
        const thickness = Math.max(
          0,
          surfaceHeights[index] - stoneHeights[index]
        );
        const blend = THREE.MathUtils.clamp(
          thickness / COATING_BLEND_DEPTH,
          0,
          1
        );

        position.setXYZ(
          index,
          x - (sizeX - 1) / 2,
          surfaceHeights[index],
          z - (sizeZ - 1) / 2
        );
        color.setXYZ(
          index,
          THREE.MathUtils.lerp(this.lowerColor.r, this.upperColor.r, blend),
          THREE.MathUtils.lerp(this.lowerColor.g, this.upperColor.g, blend),
          THREE.MathUtils.lerp(this.lowerColor.b, this.upperColor.b, blend)
        );
      }
    }

    position.needsUpdate = true;
    color.needsUpdate = true;
    surfaceGeometry.computeVertexNormals();
    surfaceGeometry.computeBoundingSphere();

    const sidePositions = this.createSidePositions(data);
    this.updateGeometryPositions(this.stoneSideMesh.geometry, sidePositions.stone);
    this.updateGeometryPositions(
      this.coatingSideMesh.geometry,
      sidePositions.coating
    );
  }

  private createSidePositions(data: TerrainData): {
    stone: number[];
    coating: number[];
    stoneIndices: number[];
    coatingIndices: number[];
  } {
    const { sizeX, sizeZ, stoneHeights, surfaceHeights } = data;
    const indexOf = (x: number, z: number) => z * sizeX + x;
    const worldX = (x: number) => x - (sizeX - 1) / 2;
    const worldZ = (z: number) => z - (sizeZ - 1) / 2;
    const stone: number[] = [];
    const coating: number[] = [];
    const stoneIndices: number[] = [];
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

    const addEdge = (x1: number, z1: number, x2: number, z2: number) => {
      const i1 = indexOf(x1, z1);
      const i2 = indexOf(x2, z2);
      const xa = worldX(x1);
      const za = worldZ(z1);
      const xb = worldX(x2);
      const zb = worldZ(z2);
      const stoneA = stoneHeights[i1];
      const stoneB = stoneHeights[i2];

      addQuad(
        stone,
        stoneIndices,
        [xa, 0, za],
        [xb, 0, zb],
        [xa, stoneA, za],
        [xb, stoneB, zb]
      );
      addQuad(
        coating,
        coatingIndices,
        [xa, stoneA, za],
        [xb, stoneB, zb],
        [xa, surfaceHeights[i1], za],
        [xb, surfaceHeights[i2], zb]
      );
    };

    for (let x = 0; x < sizeX - 1; x++) {
      addEdge(x, 0, x + 1, 0);
      addEdge(x + 1, sizeZ - 1, x, sizeZ - 1);
    }

    for (let z = 0; z < sizeZ - 1; z++) {
      addEdge(0, z + 1, 0, z);
      addEdge(sizeX - 1, z, sizeX - 1, z + 1);
    }

    return { stone, coating, stoneIndices, coatingIndices };
  }

  private makeGeometry(
    positions: number[],
    indices: number[]
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private updateGeometryPositions(
    geometry: THREE.BufferGeometry,
    positions: number[]
  ): void {
    const attribute = geometry.getAttribute('position');

    for (let i = 0; i < positions.length / 3; i++) {
      attribute.setXYZ(
        i,
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
    }

    attribute.needsUpdate = true;
    geometry.computeVertexNormals();
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
    this.stoneSideMesh = null;
    this.coatingSideMesh = null;
    this.sizeX = 0;
    this.sizeZ = 0;
  }
}
