
export class CubicMatrix {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;

  private cells: Uint8Array;

  constructor(sizeX: number, sizeY: number, sizeZ: number) {
    if (
      !Number.isInteger(sizeX) || sizeX <= 0 ||
      !Number.isInteger(sizeY) || sizeY <= 0 ||
      !Number.isInteger(sizeZ) || sizeZ <= 0
    ) {
      throw new Error('Matrix dimensions must be positive integers.');
    }

    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;

    this.cells = new Uint8Array(sizeX * sizeY * sizeZ);
  }

  private getIndex(x: number, y: number, z: number): number {
    if (
      !Number.isInteger(x) || x < 0 || x >= this.sizeX ||
      !Number.isInteger(y) || y < 0 || y >= this.sizeY ||
      !Number.isInteger(z) || z < 0 || z >= this.sizeZ
    ) {
      throw new Error(`Cell coordinates out of bounds: (${x}, ${y}, ${z})`);
    }

    return x + this.sizeX * (z + this.sizeZ * y);
  }

  getCell(x: number, y: number, z: number): number {
    return this.cells[this.getIndex(x, y, z)];
  }

  setCell(x: number, y: number, z: number, value: number): void {
    if (value !== 0 && value !== 1) {
      throw new Error('Cell value must be 0 (empty) or 1 (solid).');
    }

    this.cells[this.getIndex(x, y, z)] = value;
  }

  fill(value: 0 | 1): void {
    this.cells.fill(value);
  }

  get totalCells(): number {
    return this.cells.length;
  }
}
