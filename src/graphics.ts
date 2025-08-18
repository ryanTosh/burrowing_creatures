import { Controller } from "./controller";
import { Controls } from "./controls";
import { SidebarMgr } from "./sidebar";
import { BgCell, Cell } from "./world";

interface Tag {
    x: number;
    y: number;
    strs: string[];
}

export class Graphics {
    private canvas: HTMLCanvasElement;

    private width: number;
    private height: number;

    private ctx: CanvasRenderingContext2D;

    private controller: Controller;
    private controls: Controls;

    private sidebar: SidebarMgr;

    private creatureImg?: HTMLImageElement;
    private smallGrassTuftsImg?: HTMLImageElement;
    private largeGrassTuftsImg?: HTMLImageElement;
    private grassyDirtImg?: HTMLImageElement;
    private barrenDirtImg?: HTMLImageElement;
    private dirtImg?: HTMLImageElement;
    private rockImg?: HTMLImageElement;
    private stoneImg?: HTMLImageElement;
    private mossyStoneImg?: HTMLImageElement;
    private chippedStoneImg?: HTMLImageElement;
    private mossyChippedStoneImg?: HTMLImageElement;
    private bedrockImg?: HTMLImageElement;
    private mossyBedrockImg?: HTMLImageElement;

    private x: number;
    private y: number;
    private cellSize: number;

    private lastTime?: number;

    constructor(canvas: HTMLCanvasElement, width: number, height: number, controller: Controller, controls: Controls) {
        this.canvas = canvas;

        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.ctx = this.canvas.getContext("2d")!;

        this.controller = controller;
        this.controls = controls;

        this.sidebar = new SidebarMgr();

        this.x = 0;
        this.y = 80;
        this.cellSize = Math.ceil(this.width / 40 / 7) * 7;

        this.sidebar.setController(this.controller);
        this.updateSidebar();
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    private updateSidebar() {
        const width = this.controller.getWorld().width;
        let { minX, minY, maxX, maxY } = this.calcScreenCoords();

        if (maxX - minX >= width) {
            minX = 0;
            maxX = width - 1;
        } else {
            const offset = Math.max(-Math.floor(minX / width), 0) * width;

            minX += offset;
            maxX += offset;
        }

        this.sidebar.update(minX, minY, maxX, maxY);
    }

    public async loadImages() {
        [
            this.creatureImg,
            this.smallGrassTuftsImg,
            this.largeGrassTuftsImg,
            this.grassyDirtImg,
            this.barrenDirtImg,
            this.dirtImg,
            this.rockImg,
            this.stoneImg,
            this.mossyStoneImg,
            this.chippedStoneImg,
            this.mossyChippedStoneImg,
            this.bedrockImg,
            this.mossyBedrockImg
        ] = await Promise.all([
            this.loadImage("imgs/creature.png"),
            this.loadImage("imgs/small_grass_tufts.png"),
            this.loadImage("imgs/large_grass_tufts.png"),
            this.loadImage("imgs/grassy_dirt.png"),
            this.loadImage("imgs/barren_dirt.png"),
            this.loadImage("imgs/dirt.png"),
            this.loadImage("imgs/rock.png"),
            this.loadImage("imgs/stone.png"),
            this.loadImage("imgs/mossy_stone.png"),
            this.loadImage("imgs/chipped_stone.png"),
            this.loadImage("imgs/mossy_chipped_stone.png"),
            this.loadImage("imgs/bedrock.png"),
            this.loadImage("imgs/mossy_bedrock.png")
        ]);
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

        const speed = diff / this.cellSize / 2 * (this.controls.isBindDown("fast") ? 2 : 1);

        if (this.controls.isBindDown("up")) this.y += speed;
        if (this.controls.isBindDown("down")) this.y -= speed;
        if (this.controls.isBindDown("left")) this.x -= speed;
        if (this.controls.isBindDown("right")) this.x += speed;
        this.draw();
        this.updateSidebar();

        window.requestAnimationFrame(this.frame.bind(this));
    }

    private calcScreenCoords() {
        return {
            minX: Math.floor(this.x - this.width / this.cellSize / 2 - 1),
            minY: Math.floor(this.y - this.height / this.cellSize / 2 - 1),
            maxX: Math.ceil(this.x + this.width / this.cellSize / 2 + 1),
            maxY: Math.ceil(this.y + this.height / this.cellSize / 2 + 1)
        };
    }

    public draw() {
        const world = this.controller.getWorld();
        const creatures = this.controller.getCreatures();

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.imageSmoothingEnabled = false;

        const { minX, minY, maxX, maxY } = this.calcScreenCoords();

        const baseXOff = Math.floor(this.width / 2 - this.x * this.cellSize);
        const baseYOff = Math.floor(this.height / 2 + this.y * this.cellSize);

        const tags: Tag[] = [];

        for (let x = minX; x < maxX; x++) {
            for (let y = minY; y < maxY; y++) {
                const cell = world.getCell(x, y);

                const xOff = baseXOff + x * this.cellSize;
                const yOff = baseYOff - y * this.cellSize;

                const filteredCreatures = creatures.filter(c => c.pos.x == (x % world.width + world.width) % world.width && c.pos.y == y);
                if (filteredCreatures.length != 0) {
                    if (filteredCreatures.some(c => c.falling)) {
                        this.ctx.save();
                        this.ctx.translate(xOff, yOff);
                        this.ctx.rotate(Math.PI);
                        this.ctx.translate(-this.cellSize, -this.cellSize);
                        this.ctx.drawImage(this.creatureImg!, 0, 0, this.cellSize, this.cellSize);
                        this.ctx.restore();
                    } else {
                        this.ctx.drawImage(this.creatureImg!, xOff, yOff, this.cellSize, this.cellSize);
                    }

                    let tagStrings: string[] = [];
                    for (const creature of filteredCreatures) {
                        tagStrings.push(creature.id + ": " + creature.bot!.id + " [" + creature.hp + " HP, " + creature.fullness + " FN]");
                    }
                    tags.push({ x: xOff + this.cellSize / 2, y: yOff - 6, strs: tagStrings });
                } else {
                    if (cell == Cell.Empty || cell == Cell.SmallGrassTufts || cell == Cell.LargeGrassTufts) {
                        this.ctx.fillStyle = this.bgCellToColor(world.getBgCell(x, y), y - world.groundHeight);
                        this.ctx.fillRect(xOff, yOff, this.cellSize, this.cellSize);
                    }

                    if (cell != Cell.Empty) {
                        this.ctx.drawImage(this.cellToImg(cell)!, xOff, yOff, this.cellSize, this.cellSize);
                    }
                }
            }
        }

        this.ctx.font = "500 12px 'Roboto Mono', monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";

        for (const tag of tags) {
            const measures = tag.strs.map(s => this.ctx.measureText(s));

            const width = measures.reduce((w, m) => Math.max(w, m.width), 0);
            const ascent = measures.slice(0, -1).reduce((h, m) => h + m.fontBoundingBoxAscent + m.fontBoundingBoxDescent, measures[measures.length - 1].fontBoundingBoxAscent);
            const descent = measures[measures.length - 1].fontBoundingBoxDescent;

            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.ctx.fillRect(tag.x - width / 2 - 2, tag.y - ascent, width + 4, ascent + descent);
            this.ctx.fillStyle = "#ffffff";
            let y = tag.y;
            for (let i = tag.strs.length - 1; i >= 0; i--) {
                this.ctx.fillText(tag.strs[i], tag.x, y);
                if (i != 0) {
                    y -= measures[i].fontBoundingBoxAscent + measures[i - 1].fontBoundingBoxDescent;
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
                return this.grassyDirtImg!;
            case Cell.BarrenDirt:
                return this.barrenDirtImg!;
            case Cell.Dirt:
                return this.dirtImg!;
            case Cell.Rock:
            case Cell.Rock1:
            case Cell.Rock2:
            case Cell.Rock3:
            case Cell.Rock4:
            case Cell.Rock5:
            case Cell.Rock6:
            case Cell.Rock7:
            case Cell.Rock8P:
                return this.rockImg!;
            case Cell.Stone:
                return this.stoneImg!;
            case Cell.MossyStone:
                return this.mossyStoneImg!;
            case Cell.ChippedStone:
                return this.chippedStoneImg!;
            case Cell.MossyChippedStone:
                return this.mossyChippedStoneImg!;
            case Cell.Bedrock:
                return this.bedrockImg!;
            case Cell.MossyBedrock:
                return this.mossyBedrockImg!;
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
                return "#402a15";
            case BgCell.Stone:
                return "#404040";
            case BgCell.Bedrock:
                return "#202020";
        }
    }
}