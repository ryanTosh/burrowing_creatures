export interface WorldSettings {
    dirtHeight: number;
    stoneHeight: number;
    dirtHeightRoughness: number;
    stoneHeightRoughness: number;

    rockOdds: number;
    noGrassOdds: number;
    grassTuftsOdds: number;
}

export enum Cell {
    Empty,
    SmallGrassTufts,
    LargeGrassTufts,
    GrassyDirt,
    BarrenDirt,
    Dirt,
    Rock,
    Rock1,
    Rock2,
    Rock3,
    Rock4,
    Rock5,
    Rock6,
    Rock7,
    Rock8P,
    Stone,
    MossyStone,
    ChippedStone,
    MossyChippedStone,
    Bedrock,
    MossyBedrock
}

export function cellIsRock(cell: Cell): boolean {
    return cell >= Cell.Rock && cell <= Cell.Rock8P;
}

export function cellIsFallingRock(cell: Cell): boolean {
    return cell >= Cell.Rock1 && cell <= Cell.Rock8P;
}

export function cellIsSolid(cell: Cell): boolean {
    return !(cell == Cell.Empty || cell == Cell.SmallGrassTufts || cell == Cell.LargeGrassTufts);
}

export enum BgCell {
    Sky,
    Dirt,
    Stone,
    Bedrock
}

export class World {
    public readonly width: number;
    public readonly groundHeight: number;

    private grid: Cell[][];
    private bgGrid: BgCell[][];

    constructor(width: number, groundHeight: number, grid: Cell[][], bgGrid: BgCell[][]) {
        this.width = width;
        this.groundHeight = groundHeight;

        this.grid = grid;
        this.bgGrid = bgGrid;
    }

    public static buildWorld(width: number, settings: WorldSettings) {
        const groundHeight = 1 + settings.stoneHeight + settings.dirtHeight;
        const grid = [...new Array(groundHeight + 16)].map(_ => new Array(width).fill(Cell.Empty));
        const bgGrid = [...new Array(groundHeight + 8)].map(_ => new Array(width).fill(BgCell.Sky));

        const stonePhaseOffsets = [];
        for (let i = 1; i < width / 2; i *= 2) {
            stonePhaseOffsets.push(Math.random());
        }
        const dirtPhaseOffsets = [];
        for (let i = 1; i < width / 2; i *= 2) {
            dirtPhaseOffsets.push(Math.random());
        }

        for (let x = 0; x < width; x++) {
            grid[0][x] = Cell.Bedrock;
            bgGrid[0][x] = BgCell.Bedrock;

            let stoneHeight = 1 + settings.stoneHeight + (Math.random() * 2 - 1) / 4;
            for (let i = 1, j = 0; i < width / 2; i *= 2, j++) {
                stoneHeight += Math.sin((x / (width / i) + stonePhaseOffsets[j]) * Math.PI) / (Math.log2(width / 2) / settings.stoneHeightRoughness);
            }
            stoneHeight = Math.max(1, Math.round(stoneHeight));

            for (let y = 1; y < stoneHeight; y++) {
                if (y >= grid.length) grid.push(new Array(width).fill(Cell.Empty));
                grid[y][x] = Cell.Stone;
                if (y >= bgGrid.length) bgGrid.push(new Array(width).fill(BgCell.Sky));
                bgGrid[y][x] = BgCell.Stone;
            }

            let dirtHeight = 1 + settings.stoneHeight + settings.dirtHeight + (Math.random() * 2 - 1) / 4;
            for (let i = 1, j = 0; i < width / 2; i *= 2, j++) {
                dirtHeight += Math.sin((x / (width / i) + dirtPhaseOffsets[j]) * Math.PI) / (Math.log2(width / 2) / settings.stoneHeightRoughness);
            }
            dirtHeight = Math.max(stoneHeight, Math.round(dirtHeight));

            for (let y = stoneHeight; y < dirtHeight - 1; y++) {
                if (y >= grid.length) grid.push(new Array(width).fill(Cell.Empty));
                grid[y][x] = Math.random() < settings.rockOdds ? Cell.Rock : Cell.Dirt;
                if (y >= bgGrid.length) bgGrid.push(new Array(width).fill(BgCell.Sky));
                bgGrid[y][x] = BgCell.Dirt;
            }

            const isGrass = Math.random() >= settings.noGrassOdds;

            if (dirtHeight - 1 >= grid.length) grid.push(new Array(width).fill(Cell.Empty));
            grid[dirtHeight - 1][x] = isGrass ? Cell.GrassyDirt : Math.random() < 1 / 3 ? Cell.Dirt : Cell.BarrenDirt;
            if (dirtHeight - 1 >= bgGrid.length) bgGrid.push(new Array(width).fill(BgCell.Sky));
            bgGrid[dirtHeight - 1][x] = BgCell.Dirt;

            if (isGrass && Math.random() < settings.grassTuftsOdds) {
                if (dirtHeight >= grid.length) grid.push(new Array(width).fill(Cell.Empty));
                grid[dirtHeight][x] = Math.random() < 2/3 ? Cell.SmallGrassTufts : Cell.LargeGrassTufts;
            }
        }

        return new World(width, groundHeight, grid, bgGrid);
    }

    public getCell(x: number, y: number): Cell {
        if (x < 0 || x >= this.width) x = (x % this.width + this.width) % this.width;
        if (y >= this.grid.length) return Cell.Empty;
        if (y < 0) return Cell.Bedrock;

        return this.grid[y][x];
    }

    public getBgCell(x: number, y: number): BgCell {
        if (x < 0 || x >= this.width) x = (x % this.width + this.width) % this.width;
        if (y >= this.bgGrid.length) return BgCell.Sky;
        if (y < 0) return BgCell.Bedrock;

        return this.bgGrid[y][x];
    }

    public setCell(x: number, y: number, cell: Cell) {
        if (x < 0 || x >= this.width) x = (x % this.width + this.width) % this.width;
        while (y >= this.grid.length) this.grid.push(new Array(this.width).fill(Cell.Empty));

        this.grid[y][x] = cell;
    }

    public isRock(x: number, y: number): boolean {
        return cellIsRock(this.getCell(x, y));
    }

    public isFallingRock(x: number, y: number): boolean {
        return cellIsFallingRock(this.getCell(x, y));
    }

    public isSolid(x: number, y: number): boolean {
        return cellIsSolid(this.getCell(x, y));
    }

    public isBorderingEmpty(x: number, y: number): boolean {
        return (
            this.getCell(x - 1, y) == Cell.Empty ||
            this.getCell(x, y - 1) == Cell.Empty ||
            this.getCell(x + 1, y) == Cell.Empty ||
            this.getCell(x, y + 1) == Cell.Empty
        );
    }

    private isXAdjacentUnchecked(x1: number, x2: number): boolean {
        return Math.abs(x1 - x2) == 1 || x1 == 0 && x2 == this.width - 1 || x1 == this.width - 1 && x2 == 0;
    }

    public isXAdjacent(x1: number, x2: number): boolean {
        if (x1 < 0 || x1 >= this.width) x1 = (x1 % this.width + this.width) % this.width;
        if (x2 < 0 || x2 >= this.width) x2 = (x2 % this.width + this.width) % this.width;

        return this.isXAdjacentUnchecked(x1, x2);
    }

    public wrappingXOffset(x1: number, x2: number): number {
        if (x1 < 0 || x1 >= this.width) x1 = (x1 % this.width + this.width) % this.width;
        if (x2 < 0 || x2 >= this.width) x2 = (x2 % this.width + this.width) % this.width;

        const off1 = (x2 + this.width) - x1;
        const off2 = x2 - (x1 + this.width);

        return Math.abs(off1) < Math.abs(x2 - x1) ? off1 : Math.abs(off2) < Math.abs(x2 - x1) ? off2 : x2 - x1;
    }

    public isReachableFrom(x1: number, y1: number, x2: number, y2: number): boolean {
        if (x1 < 0 || x1 >= this.width) x1 = (x1 % this.width + this.width) % this.width;
        if (x2 < 0 || x2 >= this.width) x2 = (x2 % this.width + this.width) % this.width;

        if (x1 == x2 && y1 == y2) return true;
        if (x1 == x2 && (Math.abs(y1 - y2) == 1)) return true;
        if (this.isXAdjacentUnchecked(x1, x2) && y1 == y2) return true;

        if (!this.isSolid(x1, y2) || !this.isSolid(x2, y1)) {
            if ((x1 == x2 - 1 || x1 == this.width - 1 && x2 == 0) && y1 == y2 - 1) return true;
            if ((x1 == x2 - 1 || x1 == this.width - 1 && x2 == 0) && y1 == y2 + 1) return true;
            if ((x1 == x2 + 1 || x1 == 0 && x2 == this.width - 1) && y1 == y2 - 1) return true;
            if ((x1 == x2 + 1 || x1 == 0 && x2 == this.width - 1) && y1 == y2 + 1) return true;
        }

        return false;
    }

    public dist(x1: number, y1: number, x2: number, y2: number): number {
        return Math.abs(this.wrappingXOffset(x1, x2)) + Math.abs(y1 - y2);
    }

    public getGrid(): Cell[][] {
        return this.grid;
    }

    public getBgGrid(): BgCell[][] {
        return this.bgGrid;
    }

    public findTopSolidY(x: number): number {
        let y = this.grid.length;
        while (!this.isSolid(x, y)) y--;
        return y;
    }

    public clone(): World {
        return new World(this.width, this.groundHeight, [...this.grid].map(g => [...g]), [...this.bgGrid].map(g => [...g]));
    }

    public willFall(x: number, y: number): boolean {
        return !this.isSolid(x, y - 1) && !(this.isSolid(x - 1, y) && this.isSolid(x + 1, y));
    }
    
    public simulateLeft(x: number, y: number): { x: number, y: number, falling: boolean } | null {
        const leftX = (x + this.width - 1) % this.width;

        if (!this.isSolid(leftX, y)) {
            if (!this.isSolid(leftX, y - 1)) {
                return { x: leftX, y: y - 1, falling: this.willFall(leftX, y - 1) };
            } else {
                return { x: leftX, y, falling: false };
            }
        } else {
            if (!this.isSolid(x, y + 1) && !this.isSolid(leftX, y + 1)) {
                return { x: leftX, y: y + 1, falling: false };
            }
        }

        return null;
    }

    public simulateRight(x: number, y: number): { x: number, y: number, falling: boolean } | null {
        const rightX = (x + 1) % this.width;

        if (!this.isSolid(rightX, y)) {
            if (!this.isSolid(rightX, y - 1)) {
                return { x: rightX, y: y - 1, falling: this.willFall(rightX, y - 1) };
            } else {
                return { x: rightX, y, falling: false };
            }
        } else {
            if (!this.isSolid(x, y + 1) && !this.isSolid(rightX, y + 1)) {
                return { x: rightX, y: y + 1, falling: false };
            }
        }

        return null;
    }

    public simulateClimbUp(x: number, y: number): { x: number, y: number, falling: boolean } | null {
        if (!this.isSolid(x, y + 1) && this.isSolid(x - 1, y + 1) && this.isSolid(x + 1, y + 1)) {
            return { x, y: y + 1, falling: false };
        }

        return null;
    }

    public simulateClimbDown(x: number, y: number): { x: number, y: number, falling: boolean } | null {
        if (!this.isSolid(x, y - 1)) {
            return { x, y: y - 1, falling: this.willFall(x, y - 1) };
        }

        return null;
    }
}