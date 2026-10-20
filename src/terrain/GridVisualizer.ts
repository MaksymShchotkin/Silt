
import * as THREE from 'three';
import { CubicMatrix } from './CubicMatrix';

export class GridVisualizer {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  rebuild(matrix: CubicMatrix): void {
    // Remove the previous terrain surface.
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();

      const material = this.mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }

      this.mesh = null;
    }

    const { sizeX, sizeZ, sizeY } = matrix;

    // Find the top occupied cell in each column.
    const heights: number[] = [];

    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        let height = 0;

        for (let y = sizeY - 1; y >= 0; y--) {
          if (matrix.getCell(x, y, z) === 1) {
            height = y + 1;
            break;
          }
        }

        heights.push(height);
      }
    }

    // Create one vertex for each terrain grid point.
    const positions: number[] = [];
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const index = z * sizeX + x;

        positions.push(
          x - (sizeX - 1) / 2,
          heights[index],
          z - (sizeZ - 1) / 2
        );
      }
    }

    // Connect neighboring vertices into triangles.
    const indices: number[] = [];

    for (let z = 0; z < sizeZ - 1; z++) {
      for (let x = 0; x < sizeX - 1; x++) {
        const a = z * sizeX + x;
        const b = a + 1;
        const c = a + sizeX;
        const d = c + 1;

        // Two triangles form each rectangular terrain section.
        indices.push(a, c, b);
        indices.push(b, c, d);
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
      color: 0x78a66a,
      roughness: 0.9,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
  }

  dispose(): void {
    if (!this.mesh) return;

    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();

    const material = this.mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material.dispose();
    }

    this.mesh = null;
  }
}
