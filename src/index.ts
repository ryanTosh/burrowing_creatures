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
const controller = new Controller(world, sample_bots, 4);
const graphics = new Graphics(canvas, Math.floor(window.innerWidth * (1 - 0.0625) - 120 - 180), window.innerHeight, controller, controls);

await graphics.loadImages();
graphics.draw();
graphics.startFrames();

let tickCtr = 0;

setInterval(() => {
    controller.tick(tickCtr++);
}, 500);

window.addEventListener("resize", () => {
    graphics.resize(Math.floor(window.innerWidth * (1 - 0.0625) - 120 - 180), window.innerHeight);
});