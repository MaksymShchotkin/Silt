
export type TerrainBiome = 'hills' | 'desert';

export interface TerrainLayerProperties {
  name: string;
  color: number;
  hardiness: number;
}

export interface TerrainData {
  sizeX: number;
  sizeZ: number;
  biome: TerrainBiome;
  lowerLayer: TerrainLayerProperties;
  upperLayer: TerrainLayerProperties;

  // Height of the lower layer at each grid point.
  stoneHeights: number[];

  // Height of the upper layer at each grid point.
  surfaceHeights: number[];
}
