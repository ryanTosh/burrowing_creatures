import { Controls } from "./controls";
import { Graphics } from "./graphics";
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

await graphics.loadImages();
graphics.draw();
graphics.startFrames();