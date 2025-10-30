import { Bot, climbDown, climbUp, left, right } from "./bot_interface";
import { Controller, Move } from "./controller";
import { Controls } from "./controls";
import { Graphics } from "./graphics";
import { sampleBots } from "./sample_bots";

declare global {
    interface Window {
        superHot: boolean;
        sampleBots: Bot[];
        runCompetitionController: (bots: Bot[], copies: number, debug: boolean) => { bot: string, ticks: number };
    }
}

window.superHot = true;
window.sampleBots = sampleBots;
window.runCompetitionController = (bots: Bot[], copies: number, debug: boolean = false): { bot: string, ticks: number } => {
    const controller = Controller.buildController(bots, copies, debug);

    let lastCreatures = [...controller.getCreatures()];

    while (new Set(controller.getCreatures().map(c => c.bot!.id)).size > 1) {
        lastCreatures = [...controller.getCreatures()];
        controller.tick();
    }

    const creatures = controller.getCreatures();

    if (creatures.length == 0) {
        return {
            bot: lastCreatures[0].bot!.id,
            ticks: controller.getTickCtr()
        };
    } else {
        return {
            bot: creatures[0].bot!.id,
            ticks: controller.getTickCtr()
        };
    }
};

const canvas = document.getElementById("display") as HTMLCanvasElement;

if (window.superHot) {
    const moveBox: { resolve?: (move: Move) => void } = {};
    const controls = new Controls([
        {
            id: "still",
            keys: ["KeyS"],
            mouseBtns: []
        },
        {
            id: "up",
            keys: ["KeyW", "ArrowUp"],
            mouseBtns: []
        },
        {
            id: "down",
            keys: ["KeyX", "ArrowDown"],
            mouseBtns: []
        },
        {
            id: "left",
            keys: ["KeyA", "ArrowLeft"],
            mouseBtns: []
        },
        {
            id: "right",
            keys: ["KeyD", "ArrowRight"],
            mouseBtns: []
        },
        {
            id: "-1_-1",
            keys: ["KeyZ"],
            mouseBtns: []
        },
        {
            id: "1_-1",
            keys: ["KeyC"],
            mouseBtns: []
        },
        {
            id: "-1_1",
            keys: ["KeyQ"],
            mouseBtns: []
        },
        {
            id: "1_1",
            keys: ["KeyE"],
            mouseBtns: []
        },
        {
            id: "shift",
            keys: ["ShiftLeft", "ShiftRight"],
            mouseBtns: []
        },
        {
            id: "mode_dig",
            keys: ["KeyF"],
            mouseBtns: []
        },
        {
            id: "mode_rock",
            keys: ["KeyR"],
            mouseBtns: []
        },
        {
            id: "mode_eat",
            keys: ["Digit1"],
            mouseBtns: []
        },
        {
            id: "mode_bite",
            keys: ["Digit2"],
            mouseBtns: []
        }
    ], canvas);

    // Left click: move or dig
    // Right click: eat
    // Unmapped: rock interactions, bite

    let controller = Controller.buildSuperHotController(moveBox, sampleBots, 4);
    const graphics = new Graphics(canvas, window.innerWidth, window.innerHeight, controller, controls, true);

    (document.getElementById("sidebar") as HTMLDivElement).style.display = "none";

    await graphics.loadImages();
    graphics.draw();
    graphics.startFrames();

    let mode: "dig" | "rock" | "eat" | "bite" = "dig";

    controls.onBindDown("still", () => {
        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x, y) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve(controls.isBindDown("shift") ? { type: modeType, pos: { x: x, y: y } } : null);
    });
    controls.onBindDown("up", () => {
        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x, y + 1) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve(controls.isBindDown("shift") ? { type: modeType, pos: { x: x, y: y + 1 } } : climbUp());
    });
    controls.onBindDown("down", () => {
        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x, y - 1) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve(controls.isBindDown("shift") ? { type: modeType, pos: { x: x, y: y - 1 } } : climbDown());
    });
    controls.onBindDown("left", () => {
        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x - 1, y) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve(controls.isBindDown("shift") ? { type: modeType, pos: { x: x - 1, y: y } } : left());
    });
    controls.onBindDown("right", () => {
        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x + 1, y) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve(controls.isBindDown("shift") ? { type: modeType, pos: { x: x + 1, y: y } } : right());
    });
    controls.onBindDown("-1_-1", () => {
        if (!controls.isBindDown("shift")) return;

        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x - 1, y - 1) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve({ type: modeType, pos: { x: x - 1, y: y - 1 } });
    });
    controls.onBindDown("1_-1", () => {
        if (!controls.isBindDown("shift")) return;

        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x + 1, y - 1) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve({ type: modeType, pos: { x: x + 1, y: y - 1 } });
    });
    controls.onBindDown("-1_1", () => {
        if (!controls.isBindDown("shift")) return;

        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x - 1, y + 1) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve({ type: modeType, pos: { x: x - 1, y: y + 1 } });
    });
    controls.onBindDown("1_1", () => {
        if (!controls.isBindDown("shift")) return;

        const player = controller.getCreatures().find(c => c.id == 0);
        if (player === undefined) return;

        const { x, y } = player.pos;
        const modeType = mode == "rock" ? controller.getWorld().isSolid(x + 1, y + 1) ? "pick_up" : "drop" : mode;
        if (moveBox.resolve !== undefined) moveBox.resolve({ type: modeType, pos: { x: x + 1, y: y + 1 } });
    });
    controls.onBindDown("mode_dig", () => {
        mode = "dig";
    });
    controls.onBindDown("mode_rock", () => {
        mode = "rock";
    });
    controls.onBindDown("mode_eat", () => {
        mode = "eat";
    });
    controls.onBindDown("mode_bite", () => {
        mode = "bite";
    });

    window.addEventListener("resize", () => {
        graphics.resize(window.innerWidth, window.innerHeight);
    });

    async function tick() {
        await controller.tick();

        setTimeout(tick, 0);
    }

    tick();
} else {
    const controls = new Controls([
        {
            id: "up",
            keys: ["KeyW", "ArrowUp"],
            mouseBtns: []
        },
        {
            id: "down",
            keys: ["KeyS", "ArrowDown"],
            mouseBtns: []
        },
        {
            id: "left",
            keys: ["KeyA", "ArrowLeft"],
            mouseBtns: []
        },
        {
            id: "right",
            keys: ["KeyD", "ArrowRight"],
            mouseBtns: []
        },
        {
            id: "zoom_in",
            keys: ["KeyZ"],
            mouseBtns: []
        },
        {
            id: "zoom_out",
            keys: ["KeyX"],
            mouseBtns: []
        },
        {
            id: "fast",
            keys: ["ShiftLeft", "ShiftRight"],
            mouseBtns: []
        },
        {
            id: "step",
            keys: ["Space"],
            mouseBtns: []
        },
        {
            id: "toggle",
            keys: ["KeyR"],
            mouseBtns: []
        },
        {
            id: "spectate",
            keys: ["KeyG"],
            mouseBtns: []
        }
    ], canvas);
    let controller = Controller.buildController(sampleBots, 1);
    const graphics = new Graphics(canvas, Math.floor(window.innerWidth * (1 - 0.0625) - 120 - 180), window.innerHeight, controller, controls, false);

    let tickInterval: number | null = null;

    const tick = document.getElementById("tick") as HTMLSpanElement;
    const tickRate = document.getElementById("tick_rate") as HTMLInputElement;
    const step = document.getElementById("step") as HTMLButtonElement;
    const start = document.getElementById("start") as HTMLButtonElement;
    const stop = document.getElementById("stop") as HTMLButtonElement;
    const reset = document.getElementById("reset") as HTMLButtonElement;
    const spectate = document.getElementById("spectate") as HTMLSelectElement;

    for (const bot of sampleBots) {
        const option = document.createElement("option");
        option.textContent = bot.id;
        spectate.appendChild(option);
    }

    let lastSpectated: string | null = sampleBots[sampleBots.length - 1]?.id ?? null;

    step.addEventListener("click", async () => {
        await controller.tick();
        tick.textContent = controller.getTickCtr().toString();
    });

    controls.onBindDown("step", async () => {
        await controller.tick();
        tick.textContent = controller.getTickCtr().toString();
    });

    controls.onBindDown("toggle", () => {
        if (tickInterval === null) {
            tickInterval = setInterval(async () => {
                await controller.tick();
                tick.textContent = controller.getTickCtr().toString();
            }, 1000 / Number(tickRate.value || 1));

            stop.disabled = false;
        } else {
            clearInterval(tickInterval);
            tickInterval = null;

            stop.disabled = true;
        }
    });

    start.addEventListener("click", () => {
        if (tickInterval !== null) {
            clearInterval(tickInterval);
        }

        tickInterval = setInterval(async () => {
            await controller.tick();
            tick.textContent = controller.getTickCtr().toString();
        }, 1000 / Number(tickRate.value || 1));

        stop.disabled = false;
    });

    stop.addEventListener("click", () => {
        if (tickInterval === null) return;

        clearInterval(tickInterval);
        tickInterval = null;

        stop.disabled = true;
    });

    reset.addEventListener("click", () => {
        controller = Controller.buildController(sampleBots, 4);
        graphics.setController(controller);
        tick.textContent = controller.getTickCtr().toString();
    });

    controls.onBindDown("spectate", () => {
        if (spectate.selectedIndex == 0) {
            if (lastSpectated !== null) {
                spectate.value = lastSpectated;
                graphics.setSpectateBotId(lastSpectated);
            }
        } else {
            spectate.selectedIndex = 0;
            graphics.setSpectateBotId(null);
        }
    });

    spectate.addEventListener("change", () => {
        if (spectate.selectedIndex == 0) {
            graphics.setSpectateBotId(null);
        } else {
            graphics.setSpectateBotId(spectate.value);
            lastSpectated = spectate.value;
        }
    });

    await graphics.loadImages();
    graphics.draw();
    graphics.startFrames();

    window.addEventListener("resize", () => {
        graphics.resize(Math.floor(window.innerWidth * (1 - 0.0625) - 120 - 180), window.innerHeight);
    });
}