
export interface TerrainData {
  sizeX: number;
  sizeZ: number;

  // Height of the stone bed at each grid point.
  stoneHeights: number[];

  // Height of the top of the surface coating.
  surfaceHeights: number[];
}
