import { Controller } from "./controller";
import { Controls } from "./controls";
import { Graphics } from "./graphics";
import { sample_bots } from "./sample_bots";
import { World } from "./world";

const canvas = document.getElementById("display") as HTMLCanvasElement;

const worldSize = 200;

const world = World.buildWorld(worldSize, {
    dirtHeight: 40,
    stoneHeight: 40,
    dirtHeightRoughness: 1,
    stoneHeightRoughness: 4,

    rockOdds: 0.03125,
    noGrassOdds: 0.125,
    grassTuftsOdds: 0.0625
});
const controls = new Controls(canvas);
const graphics = new Graphics(canvas, window.innerWidth, window.innerHeight, world, controls);
const controller = new Controller(world, sample_bots, 4);

await graphics.loadImages();
graphics.draw();
graphics.startFrames();

let tickCtr = 0;

setInterval(() => {
    controller.tick(tickCtr++);
}, 100);