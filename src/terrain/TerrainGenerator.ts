
import type { TerrainBiome, TerrainData } from './TerrainData';

type Hill = {
  x: number;
  z: number;
  radius: number;
  strength: number;
};

export class TerrainGenerator {
  generate(
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    biome: TerrainBiome = 'hills'
  ): TerrainData {
    if (biome === 'desert') {
      return this.generateDesert(sizeX, sizeY, sizeZ);
    }

    return this.generateHills(sizeX, sizeY, sizeZ);
  }

  private generateHills(
    sizeX: number,
    sizeY: number,
    sizeZ: number
  ): TerrainData {
    const stoneHeights: number[] = [];
    const surfaceHeights: number[] = [];

    // Randomly positioned hills for the stone foundation.
    const stoneHills: Hill[] = [];

    const hillCount = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < hillCount; i++) {
      stoneHills.push({
        x: Math.random() * sizeX,
        z: Math.random() * sizeZ,
        radius: 4 + Math.random() * 4,
        strength: 0.5 + Math.random() * 1.5,
      });
    }

    // Independent random offsets for the broad stone waves.
    const stonePhaseX = Math.random() * Math.PI * 2;
    const stonePhaseZ = Math.random() * Math.PI * 2;

    // Surface gets its own randomized pattern.
    const surfacePhaseX = Math.random() * Math.PI * 2;
    const surfacePhaseZ = Math.random() * Math.PI * 2;

    // Generate one column at a time.
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        // 1. Generate the smooth stone foundation.
        let stoneHeight =
          3 +
          Math.sin(x * 0.2 + stonePhaseX) * 0.6 +
          Math.cos(z * 0.2 + stonePhaseZ) * 0.6;

        for (const hill of stoneHills) {
          const dx = x - hill.x;
          const dz = z - hill.z;
          const distanceSquared = dx * dx + dz * dz;

          stoneHeight += hill.strength * Math.exp(
            -distanceSquared / (2 * hill.radius * hill.radius)
          );
        }

        stoneHeight = Math.max(1, Math.min(sizeY - 2, stoneHeight));

          // Round to the nearest 0.5 instead of a whole integer.
          stoneHeight = Math.round(stoneHeight * 2) / 2;

          stoneHeights.push(stoneHeight);

        // 2. Generate the surface as a coating over the stone.
        const broadSurface =
          Math.sin(x * 0.42 + surfacePhaseX) * 0.3 +
          Math.cos(z * 0.38 + surfacePhaseZ) * 0.3;

        const roughness = (Math.random() - 0.5) * 0.5;

        // The coating thickness varies, but stays above the stone.
        const coatingThickness = Math.max(
          0.35,
          1.1 + broadSurface + roughness
        );

        const surfaceHeight = Math.min(
          sizeY - 0.1,
          stoneHeight + coatingThickness
        );

        surfaceHeights.push(surfaceHeight);
      }
    }

    return {
      sizeX,
      sizeZ,
      biome: 'hills',
      lowerLayer: {
        name: 'Stone',
        color: 0x777b80,
        hardiness: 3,
      },
      upperLayer: {
        name: 'Surface',
        color: 0x78a66a,
        hardiness: 1,
      },
      stoneHeights,
      surfaceHeights,
    };
  }

  private generateDesert(
    sizeX: number,
    sizeY: number,
    sizeZ: number
  ): TerrainData {
    const stoneHeights: number[] = [];
    const surfaceHeights: number[] = [];
    const phaseX = Math.random() * Math.PI * 2;
    const phaseZ = Math.random() * Math.PI * 2;
    const dunePhase = Math.random() * Math.PI * 2;
    const duneDirection = Math.random() * Math.PI;
    const duneX = Math.cos(duneDirection);
    const duneZ = Math.sin(duneDirection);

    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const sandstoneHeight = Math.max(
          1,
          Math.min(
            sizeY - 2,
            2.8 +
              Math.sin(x * 0.18 + phaseX) * 0.45 +
              Math.cos(z * 0.2 + phaseZ) * 0.45
          )
        );
        const duneWave = (
          Math.sin((x * duneX + z * duneZ) * 0.8 + dunePhase) + 1
        ) / 2;
        const crossRipple =
          Math.sin((-x * duneZ + z * duneX) * 0.38 + phaseZ) * 0.08;
        const duneHeight =
          sandstoneHeight +
          Math.max(0.3, 0.3 + Math.pow(duneWave, 2) * 0.85 + crossRipple);

        stoneHeights.push(sandstoneHeight);
        surfaceHeights.push(Math.min(sizeY - 0.1, duneHeight));
      }
    }

    return {
      sizeX,
      sizeZ,
      biome: 'desert',
      lowerLayer: {
        name: 'Sandstone',
        color: 0x9b704d,
        hardiness: 1,
      },
      upperLayer: {
        name: 'Sand',
        color: 0xd8bd73,
        hardiness: 0.5,
      },
      stoneHeights,
      surfaceHeights,
    };
  }
}
