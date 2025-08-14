import { Controls } from "./controls";
import { BgCell, Cell, World } from "./world";

export class Graphics {
    private canvas: HTMLCanvasElement;

    private width: number;
    private height: number;

    private ctx: CanvasRenderingContext2D;

    private world: World;
    private controls: Controls;

    private smallGrassTuftsImg?: HTMLImageElement;
    private largeGrassTuftsImg?: HTMLImageElement;
    private grassyDirt?: HTMLImageElement;
    private barrenDirt?: HTMLImageElement;
    private dirt?: HTMLImageElement;
    private rock?: HTMLImageElement;
    private stone?: HTMLImageElement;
    private mossyStone?: HTMLImageElement;
    private chippedStone?: HTMLImageElement;
    private mossyChippedStone?: HTMLImageElement;
    private bedrock?: HTMLImageElement;
    private mossyBedrock?: HTMLImageElement;

    private x: number;
    private y: number;
    private cellSize: number;

    private lastTime?: number;

    constructor(canvas: HTMLCanvasElement, width: number, height: number, world: World, controls: Controls) {
        this.canvas = canvas;

        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.ctx = this.canvas.getContext("2d")!;

        this.world = world;
        this.controls = controls;

        this.x = 0;
        this.y = 80;
        this.cellSize = Math.ceil(this.width / 40 / 7) * 7;
    }

    public async loadImages() {
        this.smallGrassTuftsImg = await this.loadImage("imgs/small_grass_tufts.png");
        this.largeGrassTuftsImg = await this.loadImage("imgs/large_grass_tufts.png");
        this.grassyDirt = await this.loadImage("imgs/grassy_dirt.png");
        this.barrenDirt = await this.loadImage("imgs/barren_dirt.png");
        this.dirt = await this.loadImage("imgs/dirt.png");
        this.rock = await this.loadImage("imgs/rock.png");
        this.stone = await this.loadImage("imgs/stone.png");
        this.mossyStone = await this.loadImage("imgs/mossy_stone.png");
        this.chippedStone = await this.loadImage("imgs/chipped_stone.png");
        this.mossyChippedStone = await this.loadImage("imgs/mossy_chipped_stone.png");
        this.bedrock = await this.loadImage("imgs/bedrock.png");
        this.mossyBedrock = await this.loadImage("imgs/mossy_bedrock.png");
    }

    private loadImage(src: string): Promise<HTMLImageElement> {
        console.log(src);
        return new Promise((r) => {
            const img = document.createElement("img") as HTMLImageElement;
            img.src = src;
            img.onload = () => {
                r(img);
            }
        });
    }

    public startFrames() {
        this.frame(undefined);

        this.controls.onBindNowDown("zoom_in", () => {
            this.cellSize += 7;
        });
        this.controls.onBindNowDown("zoom_out", () => {
            if (this.cellSize > 7) this.cellSize -= 7;
        });
    }

    private frame(time: number | undefined) {
        const diff = time === undefined || this.lastTime === undefined ? 0 : time - this.lastTime;
        this.lastTime = time;

        const speed = diff / this.cellSize / 2;

        if (this.controls.isBindDown("up")) this.y += speed;
        if (this.controls.isBindDown("down")) this.y -= speed;
        if (this.controls.isBindDown("left")) this.x -= speed;
        if (this.controls.isBindDown("right")) this.x += speed;
        this.draw();

        window.requestAnimationFrame(this.frame.bind(this));
    }

    public draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.imageSmoothingEnabled = false;

        const minX = Math.floor(this.x - this.width / this.cellSize / 2 - 1);
        const minY = Math.floor(this.y - this.height / this.cellSize / 2 - 1);
        const maxX = Math.ceil(this.x + this.width / this.cellSize / 2 + 1);
        const maxY = Math.ceil(this.y + this.height / this.cellSize / 2 + 1);

        const baseXOff = Math.floor(this.width / 2 - this.x * this.cellSize);
        const baseYOff = Math.floor(this.height / 2 + this.y * this.cellSize);

        for (let x = minX; x < maxX; x++) {
            for (let y = minY; y < maxY; y++) {
                const cell = this.world.getCell((x % this.world.width + this.world.width) % this.world.width, y < 0 ? 0 : y);

                const xOff = baseXOff + x * this.cellSize;
                const yOff = baseYOff - y * this.cellSize;

                if (cell == Cell.Empty || cell == Cell.SmallGrassTufts || cell == Cell.LargeGrassTufts) {
                    this.ctx.fillStyle = this.bgCellToColor(this.world.getBgCell((x % this.world.width + this.world.width) % this.world.width, y < 0 ? 0 : y), y - this.world.groundHeight);
                    this.ctx.fillRect(xOff, yOff, this.cellSize, this.cellSize);
                }
                
                if (cell != Cell.Empty) {
                    this.ctx.drawImage(this.cellToImg(cell)!, xOff, yOff, this.cellSize, this.cellSize);
                }
            }
        }
    }

    private cellToImg(cell: Cell): HTMLImageElement | null {
        switch (cell) {
            case Cell.Empty:
                return null;
            case Cell.SmallGrassTufts:
                return this.smallGrassTuftsImg!;
            case Cell.LargeGrassTufts:
                return this.largeGrassTuftsImg!;
            case Cell.GrassyDirt:
                return this.grassyDirt!;
            case Cell.BarrenDirt:
                return this.barrenDirt!;
            case Cell.Dirt:
                return this.dirt!;
            case Cell.Rock:
            case Cell.Rock1:
            case Cell.Rock2:
            case Cell.Rock3:
            case Cell.Rock4:
            case Cell.Rock5:
            case Cell.Rock6:
            case Cell.Rock7:
            case Cell.Rock8P:
                return this.rock!;
            case Cell.Stone:
                return this.stone!;
            case Cell.MossyStone:
                return this.mossyStone!;
            case Cell.ChippedStone:
                return this.chippedStone!;
            case Cell.MossyChippedStone:
                return this.mossyChippedStone!;
            case Cell.Bedrock:
                return this.bedrock!;
            case Cell.MossyBedrock:
                return this.mossyBedrock!;
        }
    }

    private bgCellToColor(bgCell: BgCell, groundY: number): string {
        switch (bgCell) {
            case BgCell.Sky: {
                const red = Math.min(Math.max(Math.round(178.5 - groundY), 0), 255);
                const green = Math.min(Math.max(Math.round(232.687 - groundY * 2), 0), 255);

                return "#" + red.toString(16).padStart(2, "0") + green.toString(16).padStart(2, "0") + "ff";
            }
            case BgCell.Dirt:
                return "#604020";
            case BgCell.Stone:
                return "#555555";
            case BgCell.Bedrock:
                return "#2a2a2a";
        }
    }
}