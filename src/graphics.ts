import { MoveBox } from ".";
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

    private spectateBotId: string | null = null;

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
    private zoomCtlCellSize: number;
    private cellSize: number;

    private lastTime?: number;

    private frameTimes: number[] = [];

    private superHotMoveBox: MoveBox | null;

    constructor(canvas: HTMLCanvasElement, width: number, height: number, controller: Controller, controls: Controls, superHotMoveBox: MoveBox | null = null) {
        this.canvas = canvas;

        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.ctx = this.canvas.getContext("2d")!;

        this.controller = controller;
        this.controls = controls;

        this.sidebar = new SidebarMgr(this);

        this.x = 0;
        this.y = 80;
        this.zoomCtlCellSize = this.cellSize = Math.ceil(this.width / 40 / 7) * 7;

        this.sidebar.setController(this.controller);
        this.updateSidebar();

        this.superHotMoveBox = superHotMoveBox;
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    public setController(controller: Controller) {
        this.controller = controller;
        this.sidebar.setController(controller);
    }

    public setSpectateBotId(spectateBotId: string | null) {
        this.spectateBotId = spectateBotId;
    }

    public setPos(x: number, y: number) {
        if (this.spectateBotId !== null && this.controller.getCreatures().some(c => c.bot!.id == this.spectateBotId)) return;

        this.x = x;
        this.y = y;
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

        if (!window.superHot) {
            this.controls.onBindDown("zoom_in", () => {
                this.zoomCtlCellSize *= 1.1;

                const rounded = Math.round(this.zoomCtlCellSize);

                if (rounded == this.cellSize) {
                    this.zoomCtlCellSize = this.cellSize += 1;
                } else {
                    this.cellSize = rounded;
                }
            });
            this.controls.onBindDown("zoom_out", () => {
                if (this.cellSize > 7) {
                    this.zoomCtlCellSize /= 1.1;

                    const rounded = Math.round(this.zoomCtlCellSize);

                    if (rounded == this.cellSize) {
                        this.zoomCtlCellSize = this.cellSize -= 1;
                    } else {
                        this.cellSize = rounded;
                    }
                }
            });
        }
    }

    private frame(time: number | undefined) {
        const diff = time === undefined || this.lastTime === undefined ? 0 : time - this.lastTime;
        this.lastTime = time;

        if (window.superHot) {
            const player = this.controller.getCreatures().find(c => c.id == 0);

            if (player !== undefined) {
                this.x = player.pos.x + 0.5;
                this.y = player.pos.y - 0.5;
            }
        } else {
            let moveControls = true;
            if (this.spectateBotId !== null) {
                const spectateCreature = this.controller.getCreatures().find(c => c.bot!.id == this.spectateBotId);

                if (spectateCreature) {
                    moveControls = false;

                    this.x = spectateCreature.pos.x + 0.5;
                    this.y = spectateCreature.pos.y - 0.5;
                }
            }

            if (moveControls) {
                const speed = diff / this.cellSize / 2 * (this.controls.isBindDown("fast") ? 2 : 1);

                if (this.controls.isBindDown("up")) this.y += speed;
                if (this.controls.isBindDown("down")) this.y -= speed;
                if (this.controls.isBindDown("left")) this.x -= speed;
                if (this.controls.isBindDown("right")) this.x += speed;
            }
        }
        
        this.draw();
        if (this.superHotMoveBox === null) this.updateSidebar();

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
        const startTime = performance.now();
        
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

        const crosshairSize = this.width / 256;

        this.ctx.strokeStyle = "#000000";
        this.ctx.beginPath();
        this.ctx.moveTo(Math.floor(this.width / 2) - crosshairSize, Math.floor(this.height / 2));
        this.ctx.lineTo(Math.floor(this.width / 2) + crosshairSize, Math.floor(this.height / 2));
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(Math.floor(this.width / 2), Math.floor(this.height / 2) - crosshairSize);
        this.ctx.lineTo(Math.floor(this.width / 2), Math.floor(this.height / 2) + crosshairSize);
        this.ctx.stroke();

        this.ctx.font = "500 12px 'Roboto Mono', monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";

        let filledBoxes: [number, number, number, number][] = [];

        tags.sort((a, b) => a.y - b.y);
        for (const tag of tags) {
            const measures = tag.strs.map(s => this.ctx.measureText(s));

            const width = measures.reduce((w, m) => Math.max(w, m.width), 0);
            const ascent = measures.slice(0, -1).reduce((h, m) => h + m.fontBoundingBoxAscent + m.fontBoundingBoxDescent, measures[measures.length - 1].fontBoundingBoxAscent);
            const descent = measures[measures.length - 1].fontBoundingBoxDescent;

            const xMin = tag.x - width / 2 - 2;
            let yMin = tag.y - ascent;

            for (let i = 0; i < filledBoxes.length; i++) {
                let collidingBox = filledBoxes.find(b => b[0] < xMin + width + 4 && xMin < b[0] + b[2] && b[1] < yMin + ascent + descent && yMin < b[1] + b[3]);

                if (collidingBox === undefined) break;

                yMin = collidingBox[1] - ascent - descent - 2;
            }

            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.ctx.fillRect(xMin, yMin, width + 4, ascent + descent);
            filledBoxes.push([xMin, yMin, width + 4, ascent + descent]);
            this.ctx.fillStyle = "#ffffff";
            let y = yMin + ascent;
            for (let i = tag.strs.length - 1; i >= 0; i--) {
                this.ctx.fillText(tag.strs[i], tag.x, y);
                if (i != 0) {
                    y -= measures[i].fontBoundingBoxAscent + measures[i - 1].fontBoundingBoxDescent;
                }
            }
        }

        if (this.superHotMoveBox !== null) {
            if (!this.superHotMoveBox.safe) {
                this.ctx.fillStyle = "rgba(127.5, 0, 0, 0.5)";

                this.ctx.fillRect(0, 0, this.width, 4);
                this.ctx.fillRect(0, this.height - 4, this.width, 4);
                this.ctx.fillRect(0, 0, 4, this.height);
                this.ctx.fillRect(this.width - 4, 0, 4, this.height);
            }

            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.ctx.fillRect(8, this.height - 8 - 80, 80, 80);

            if (this.controller.getSuperHotPlayer()!.carryingRock) {
                this.ctx.drawImage(this.rockImg!, 24, this.height - 8 - 80 + 16, 48, 48);
            }

            if (this.controller.getSuperHotPlayer()!.fullness < 25) {
                this.ctx.fillStyle = "rgba(255, 0, 0, " + 0.005 * (25 - this.controller.getSuperHotPlayer()!.fullness) + ")";

                this.ctx.fillRect(0, 0, this.width, this.height);
            }
        }

        const frameTime = performance.now() - startTime;

        this.frameTimes.push(frameTime);

        if (this.frameTimes.length > 1000) this.frameTimes.shift();

        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "top";

        if (this.superHotMoveBox !== null) {
            const stillAlive: string[] = [
                "Still alive: " + this.controller.getCreatures().filter(c => c !== this.controller.getSuperHotPlayer()).length + " others"
            ];

            const stillAliveStrs = stillAlive.join("\n").split("\n");

            const measures = stillAliveStrs.map(s => this.ctx.measureText(s));

            const width = measures.reduce((w, m) => Math.max(w, m.width), 0);
            const height = measures.reduce((h, m) => h + m.fontBoundingBoxAscent + m.fontBoundingBoxDescent, 0);

            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.ctx.fillRect(this.width - 8 - (width + 16), 8, width + 16, height + 12);
            this.ctx.fillStyle = "#ffffff";
            let y = 16;
            for (let i = 0; i < stillAliveStrs.length; i++) {
                this.ctx.fillText(stillAliveStrs[i], this.width - (width + 16), y);
                if (i != stillAliveStrs.length - 1) {
                    y += measures[i].fontBoundingBoxDescent + measures[i + 1].fontBoundingBoxAscent;
                }
            }
        }

        const tickTimes = this.controller.getTickTimes();

        const dbg: string[] = [
            "Tick: " + this.controller.getTickCtr(), // MOVE THIS TO CONTROLS
            "",
            "World width: " + world.width,
            "Crosshair pos: (" + Math.floor((this.x % world.width + world.width) % world.width) + ", " + Math.ceil(this.y) + ")",
            "Pointing pos: " + (this.controls.mouseOffset === undefined ? "-" : "(" + Math.floor(((this.x + (this.controls.mouseOffset[0] - this.width / 2) / this.cellSize) % world.width + world.width) % world.width) + ", " + Math.ceil(this.y - (this.controls.mouseOffset[1] - this.height / 2) / this.cellSize) + ")"),
            "",
            "Frame time: " + Math.floor(frameTime) + "ms (" + (this.frameTimes.slice(-60).reduce((s, t) => s + t, 0) / Math.min(this.frameTimes.length, 60)).toFixed(1) + "ms rolling, " + this.frameTimes.reduce((x, t) => Math.max(x, t), 0).toFixed(1) + "ms high)",
            "Tick time: " + Math.floor(tickTimes[tickTimes.length - 1]) + "ms (" + (tickTimes.slice(-20).reduce((s, t) => s + t, 0) / Math.min(tickTimes.length, 20)).toFixed(1) + "ms rolling, " + tickTimes.slice(-100).reduce((x, t) => Math.max(x, t), 0).toFixed(1) + "ms high)",
        ];

        {
            const dbgStrs = dbg.join("\n").split("\n");

            const measures = dbgStrs.map(s => this.ctx.measureText(s));

            const width = measures.reduce((w, m) => Math.max(w, m.width), 0);
            const height = measures.reduce((h, m) => h + m.fontBoundingBoxAscent + m.fontBoundingBoxDescent, 0);

            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.ctx.fillRect(8, 8, width + 16, height + 12);
            this.ctx.fillStyle = "#ffffff";
            let y = 16;
            for (let i = 0; i < dbgStrs.length; i++) {
                this.ctx.fillText(dbgStrs[i], 16, y);
                if (i != dbgStrs.length - 1) {
                    y += measures[i].fontBoundingBoxDescent + measures[i + 1].fontBoundingBoxAscent;
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