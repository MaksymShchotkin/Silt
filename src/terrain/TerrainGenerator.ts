
import { CubicMatrix } from './CubicMatrix';

export class TerrainGenerator {
  generate(
    sizeX: number,
    sizeY: number,
    sizeZ: number
  ): CubicMatrix {
    const matrix = new CubicMatrix(sizeX, sizeY, sizeZ);

    for (let x = 0; x < sizeX; x++) {
      for (let z = 0; z < sizeZ; z++) {
        // Smooth waves create the main hills and valleys.
        const waveX = Math.sin(x * 0.35) * 1.5;
        const waveZ = Math.cos(z * 0.3) * 1.5;

        // Random noise changes the terrain each time.
        const noise = (Math.random() - 0.5) * 2;

        const rawHeight = 4 + waveX + waveZ + noise;

        // Keep the terrain within the matrix boundaries.
        const height = Math.max(
          1,
          Math.min(sizeY, Math.round(rawHeight))
        );

        // Fill the cells below the terrain surface.
        for (let y = 0; y < height; y++) {
          matrix.setCell(x, y, z, 1);
        }
      }
    }

    return matrix;
  }
}
