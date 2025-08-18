import { Bot } from "./bot_interface";
import { Cell, World } from "./world";

export interface InteractMove {
    type: "dig" | "pick_up" | "drop" | "eat" | "bite";
    pos: { x: number, y: number };
}

export type Move = null | { type: "left" | "right" | "climb_up" | "climb_down" } | InteractMove | { type: "bite", victim: number };

export function isValidTarget(creature: Creature, pos: { x: number, y: number }, world: World): boolean {
    return world.isReachableFrom(creature.pos.x, creature.pos.y, pos.x, pos.y);
}

export interface LastMove {
    tick: number;
    pos: { x: number, y: number };
    move: Move | null;
}

export interface Creature {
    id: number;
    pos: { x: number, y: number };
    hp: number;
    fullness: number;
    falling: boolean;
    fallDist: number;
    carryingRock: boolean;
    bot?: Bot;
    ctx?: any;
    lastMoves?: LastMove[];
}

const SPAWN_HIT_POINTS = 18;
const MAX_HIT_POINTS = 20;
const SPAWN_FULLNESS = 180;
const MAX_FULLNESS = 200;

const ROCK_CRUSH_BASE_DAMAGE = 5;
const ROCK_CRUSH_PER_UNIT_DAMAGE = 2;
const FALL_MAX_SAFE_DIST = 2;
const FALL_BASE_DAMAGE = 1;
const FALL_PER_UNIT_DAMAGE = 2;
const BITE_DAMAGE = 5;

const FULLNESS_LOSS_PER_TICK = 1;
const SMALL_GRASS_TUFTS_FULLNESS = 25;
const LARGE_GRASS_TUFTS_FULLNESS = 25;
const GRASSY_DIRT_FULLNESS = 25;
const MOSS_FULLNESS = 20;
const SMALL_GRASS_TUFTS_HIT_POINTS = 1;
const LARGE_GRASS_TUFTS_HIT_POINTS = 1;
const GRASSY_DIRT_HIT_POINTS = 1;
const MOSS_HIT_POINTS = 0;

const BARREN_DIRT_SKY_TO_DIRT_ODDS = 1 / 128;
const DIRT_SKY_TO_GRASSY_DIRT_ODDS = 1 / 128;
const GRASSY_DIRT_NO_SKY_TO_DIRT_ODDS = 1 / 8;
const BARREN_DIRT_NO_SKY_TO_DIRT_ODDS = 1 / 8;
const SMALL_GRASS_TUFTS_NO_SKY_DISAPPEAR_ODDS = 1 / 8;
const LARGE_GRASS_TUFTS_NO_SKY_DISAPPEAR_ODDS = 1 / 8;
const GRASSY_DIRT_SKY_GROW_TUFTS_ODDS = 1 / 1024;
const SMALL_GRASS_TUFTS_SKY_GROW_ODDS = 1 / 1024;
const STONE_TO_MOSSY_ODDS = 2 / 2048;
const CHIPPED_STONE_TO_MOSSY_ODDS = 3 / 2048;
const BEDROCK_TO_MOSSY_ODDS = 1 / 2048;

const KILL_FERTILIZE_ROUNDS = 1024;
const KILL_FERTILIZE_MAX_DIST = 8;

export class Controller {
    private world: World;
    private creatures: Creature[];
    private deadCreatures: ({ diedTick: number; creature: Creature })[] = [];

    constructor(world: World, bots: Bot[], copies: number) {
        this.world = world;
        this.creatures = new Array(bots.length * copies);

        const ids = [...new Array(bots.length * copies).keys()];

        for (let i = 0; i < copies; i++) {
            for (let j = 0; j < bots.length; j++) {
                this.creatures[i * bots.length + j] = {
                    id: ids.splice(Math.floor(Math.random() * ids.length), 1)[0],
                    pos: this.findCreatureSpawnPos(),
                    hp: SPAWN_HIT_POINTS,
                    fullness: SPAWN_FULLNESS,
                    fallDist: 0,
                    falling: false,
                    carryingRock: false,
                    bot: bots[j],
                    ctx: {},
                    lastMoves: []
                };
            }
        }

        this.creatures.sort((x, y) => x.id - y.id);
    }

    public getWorld(): World {
        return this.world;
    }

    public getCreatures(): Creature[] {
        return this.creatures;
    }

    public getDeadCreatures(): ({ diedTick: number, creature: Creature })[] {
        return this.deadCreatures;
    }

    private findCreatureSpawnPos() {
        const width = this.world.width;

        if (this.creatures.length > width * 2/3) {
            const x = Math.floor(Math.random() * width);
            const y = this.world.findTopSolidY(x) + 1;
            return { x, y };
        } else if (this.creatures.length > width * 1 / 6) {
            let x: number;
            do {
                x = Math.floor(Math.random() * width);
            } while (this.creatures.some(c => c.pos.x == x));
            const y = this.world.findTopSolidY(x) + 1;
            return { x, y };
        } else {
            let x: number;
            do {
                x = Math.floor(Math.random() * width);
            } while (this.creatures.some(c => Math.abs(c.pos.x - x) < 2));
            const y = this.world.findTopSolidY(x) + 1;
            return { x, y };
        }
    }

    public tick(tickCtr: number) {
        for (let i = 0; i < this.creatures.length; i++) {
            const creature = this.creatures[i];

            if (creature.fullness > 0) {
                creature.fullness -= FULLNESS_LOSS_PER_TICK;
            } else {
                if (this.damageCreature(creature, FULLNESS_LOSS_PER_TICK, tickCtr, false) != -1) {
                    i--;
                    continue;
                }
            }

            if (!this.world.isSolid(creature.pos.x, creature.pos.y - 1)) {
                if (creature.falling || !this.world.isSolid(creature.pos.x - 1, creature.pos.y) || !this.world.isSolid(creature.pos.x + 1, creature.pos.y)) {
                    creature.falling = true;
                    creature.fallDist += 1;
                    creature.pos.y -= 1;
                    continue;
                }
            } else if (creature.falling) {
                if (creature.fallDist > FALL_MAX_SAFE_DIST) {
                    if (this.damageCreature(creature, (creature.fallDist - (FALL_MAX_SAFE_DIST + 1)) * FALL_PER_UNIT_DAMAGE + FALL_BASE_DAMAGE, tickCtr) != -1) {
                        i--;
                        continue;
                    }
                }

                creature.falling = false;
                creature.fallDist = 0;
            }

            const move = this.runCreature(creature, tickCtr);

            creature.lastMoves!.push({ tick: tickCtr, pos: { x: creature.pos.x, y: creature.pos.y }, move });

            if (move === null) continue;

            switch (move.type) {
                case "left":
                {
                    const leftX = (creature.pos.x + this.world.width - 1) % this.world.width;

                    if (!this.world.isSolid(leftX, creature.pos.y)) {
                        if (!this.world.isSolid(leftX, creature.pos.y - 1)) {
                            creature.pos.x = leftX;
                            creature.pos.y -= 1;
                        } else {
                            creature.pos.x = leftX;
                        }
                    } else {
                        if (!this.world.isSolid(creature.pos.x, creature.pos.y + 1) && !this.world.isSolid(leftX, creature.pos.y + 1)) {
                            creature.pos.x = leftX;
                            creature.pos.y += 1;
                        }
                    }

                    break;
                }
                case "right":
                {
                    const rightX = (creature.pos.x + 1) % this.world.width;

                    if (!this.world.isSolid(rightX, creature.pos.y)) {
                        if (!this.world.isSolid(rightX, creature.pos.y - 1)) {
                            creature.pos.x = rightX;
                            creature.pos.y -= 1;
                        } else {
                            creature.pos.x = rightX;
                        }
                    } else {
                        if (!this.world.isSolid(creature.pos.x, creature.pos.y + 1) && !this.world.isSolid(rightX, creature.pos.y + 1)) {
                            creature.pos.x = rightX;
                            creature.pos.y += 1;
                        }
                    }

                    break;
                }
                case "climb_up":
                {
                    const leftX = (creature.pos.x + this.world.width - 1) % this.world.width;
                    const rightX = (creature.pos.x + 1) % this.world.width;

                    if (!this.world.isSolid(creature.pos.x, creature.pos.y + 1) && this.world.isSolid(leftX, creature.pos.y + 1) && this.world.isSolid(rightX, creature.pos.y + 1)) {
                        creature.pos.y += 1;
                    }

                    break;
                }
                case "climb_down":
                {
                    const leftX = (creature.pos.x + this.world.width - 1) % this.world.width;
                    const rightX = (creature.pos.x + 1) % this.world.width;

                    if (!this.world.isSolid(creature.pos.x, creature.pos.y - 1) && this.world.isSolid(leftX, creature.pos.y) && this.world.isSolid(rightX, creature.pos.y)) {
                        creature.pos.y -= 1;
                    }

                    break;
                }
                case "dig":
                {
                    if (!isValidTarget(creature, move.pos, this.world)) break;

                    const cell = this.world.getCell(move.pos.x, move.pos.y);

                    switch (cell) {
                        case Cell.GrassyDirt:
                        case Cell.BarrenDirt:
                        case Cell.Dirt:
                        case Cell.ChippedStone:
                        case Cell.MossyChippedStone:
                        {
                            this.world.setCell(move.pos.x, move.pos.y, Cell.Empty);
                            break;
                        }
                        case Cell.Stone:
                        {
                            this.world.setCell(move.pos.x, move.pos.y, Cell.ChippedStone);
                            break;
                        }
                        case Cell.MossyStone:
                        {
                            this.world.setCell(move.pos.x, move.pos.y, Cell.MossyChippedStone);
                            break;
                        }
                    }

                    break;
                }
                case "pick_up": {
                    if (!isValidTarget(creature, move.pos, this.world)) break;
                    if (creature.carryingRock) break;

                    const cell = this.world.getCell(move.pos.x, move.pos.y);

                    if (cell == Cell.Rock) {
                        this.world.setCell(move.pos.x, move.pos.y, Cell.Empty);
                        creature.carryingRock = true;
                    }

                    break;
                }
                case "drop": {
                    if (!isValidTarget(creature, move.pos, this.world)) break;
                    if (!creature.carryingRock) break;

                    if (!this.world.isSolid(move.pos.x, move.pos.y)) {
                        this.world.setCell(move.pos.x, move.pos.y, Cell.Rock);
                        creature.carryingRock = false;

                        const crushed = this.creatures.filter(c => c.pos.x == move.pos.x && c.pos.y == move.pos.y);
                        if (crushed.length != 0) {
                            const onSolidGround = this.world.isSolid(move.pos.x, move.pos.y - 1);

                            this.world.setCell(move.pos.x, move.pos.y, Cell.Empty);

                            for (const victim of crushed) {
                                const killedIndex = this.damageCreature(creature, ROCK_CRUSH_BASE_DAMAGE, tickCtr);

                                if (killedIndex != -1) {
                                    if (killedIndex < i) i--;
                                } else if (!onSolidGround && !victim.falling) {
                                    victim.pos.y -= 1;
                                    victim.falling = true;
                                }
                            }
                        }
                    }

                    break;
                }
                case "eat": {
                    if (!isValidTarget(creature, move.pos, this.world)) break;

                    const cell = this.world.getCell(move.pos.x, move.pos.y);

                    if (cell == Cell.SmallGrassTufts) {
                        creature.hp = Math.min(creature.hp + SMALL_GRASS_TUFTS_HIT_POINTS, MAX_HIT_POINTS);
                        creature.fullness = Math.min(creature.fullness + SMALL_GRASS_TUFTS_FULLNESS, MAX_FULLNESS);
                        this.world.setCell(move.pos.x, move.pos.y, Cell.Empty);
                    } else if (cell == Cell.LargeGrassTufts) {
                        creature.hp = Math.min(creature.hp + LARGE_GRASS_TUFTS_HIT_POINTS, MAX_HIT_POINTS);
                        creature.fullness = Math.min(creature.fullness + LARGE_GRASS_TUFTS_FULLNESS, MAX_FULLNESS);
                        this.world.setCell(move.pos.x, move.pos.y, Cell.SmallGrassTufts);
                    } else if (cell == Cell.GrassyDirt) {
                        creature.hp = Math.min(creature.hp + GRASSY_DIRT_HIT_POINTS, MAX_HIT_POINTS);
                        creature.fullness = Math.min(creature.fullness + GRASSY_DIRT_FULLNESS, MAX_FULLNESS);
                        this.world.setCell(move.pos.x, move.pos.y, Cell.BarrenDirt);
                    } else if (cell == Cell.MossyStone) {
                        creature.hp = Math.min(creature.hp + MOSS_HIT_POINTS, MAX_HIT_POINTS);
                        creature.fullness = Math.min(creature.fullness + MOSS_FULLNESS, MAX_FULLNESS);
                        this.world.setCell(move.pos.x, move.pos.y, Cell.Stone);
                    } else if (cell == Cell.MossyChippedStone) {
                        creature.hp = Math.min(creature.hp + MOSS_HIT_POINTS, MAX_HIT_POINTS);
                        creature.fullness = Math.min(creature.fullness + MOSS_FULLNESS, MAX_FULLNESS);
                        this.world.setCell(move.pos.x, move.pos.y, Cell.ChippedStone);
                    } else if (cell == Cell.MossyBedrock) {
                        creature.hp = Math.min(creature.hp + MOSS_HIT_POINTS, MAX_HIT_POINTS);
                        creature.fullness = Math.min(creature.fullness + MOSS_FULLNESS, MAX_FULLNESS);
                        this.world.setCell(move.pos.x, move.pos.y, Cell.Bedrock);
                    }

                    break;
                }
                case "bite": {
                    if ("victim" in move) {
                        const victim = this.creatures.find(c => c.id == move.victim);
                        if (victim === undefined) break;

                        if (!isValidTarget(creature, victim.pos, this.world)) break;

                        const killedIndex = this.damageCreature(victim, BITE_DAMAGE, tickCtr);
                        if (killedIndex != -1) {
                            if (killedIndex < i) i--;
                        }
                    } else if ("pos" in move) {
                        if (!isValidTarget(creature, move.pos, this.world)) break;

                        const victims = this.creatures.filter(c => c != creature && c.pos.x == move.pos.x && c.pos.y == move.pos.y);

                        if (victims.length == 0) break;

                        const victim = victims[Math.floor(Math.random() * victims.length)];

                        const killedIndex = this.damageCreature(victim, BITE_DAMAGE, tickCtr);
                        if (killedIndex != -1) {
                            if (killedIndex < i) i--;
                        }
                    }

                    break;
                }
            }
        }

        const maxY = this.world.getGrid().length;
        const roof = [...new Array(this.world.width)].map((_, x) => this.world.findTopSolidY(x));
        for (let x = 0; x < this.world.width; x++) {
            for (let y = 0; y < maxY; y++) {
                const cell = this.world.getCell(x, y);

                switch (cell) {
                    case Cell.Empty: {
                        break;
                    }
                    case Cell.SmallGrassTufts: {
                        if (this.world.getCell(x, y - 1) == Cell.Empty) {
                            this.world.setCell(x, y, Cell.Empty);
                            break;
                        }

                        if (y < roof[x] && Math.random() < SMALL_GRASS_TUFTS_NO_SKY_DISAPPEAR_ODDS) {
                            this.world.setCell(x, y, Cell.Empty);
                            break;
                        }
                        
                        if (y > roof[x] && Math.random() < SMALL_GRASS_TUFTS_SKY_GROW_ODDS) {
                            this.world.setCell(x, y, Cell.LargeGrassTufts);
                            break;
                        }

                        break;
                    }
                    case Cell.LargeGrassTufts: {
                        if (this.world.getCell(x, y - 1) == Cell.Empty) {
                            this.world.setCell(x, y, Cell.Empty);
                            break;
                        }

                        if (y < roof[x] && Math.random() < LARGE_GRASS_TUFTS_NO_SKY_DISAPPEAR_ODDS) {
                            this.world.setCell(x, y, Cell.Empty);
                            break;
                        }
                        
                        break;
                    }
                    case Cell.GrassyDirt: {
                        if (y < roof[x] && Math.random() < GRASSY_DIRT_NO_SKY_TO_DIRT_ODDS) {
                            this.world.setCell(x, y, Cell.Dirt);
                            break;
                        }

                        if (y >= roof[x] && Math.random() < GRASSY_DIRT_SKY_GROW_TUFTS_ODDS) {
                            this.world.setCell(x, y + 1, Cell.SmallGrassTufts);
                            break;
                        }

                        break;
                    }
                    case Cell.BarrenDirt: {
                        if (y < roof[x] && Math.random() < BARREN_DIRT_NO_SKY_TO_DIRT_ODDS) {
                            this.world.setCell(x, y, Cell.Dirt);
                            break;
                        }

                        if (y >= roof[x] && Math.random() < BARREN_DIRT_SKY_TO_DIRT_ODDS) {
                            this.world.setCell(x, y, Cell.Dirt);
                            break;
                        }

                        break;
                    }
                    case Cell.Dirt: {
                        if (y >= roof[x] && Math.random() < DIRT_SKY_TO_GRASSY_DIRT_ODDS) {
                            this.world.setCell(x, y, Cell.GrassyDirt);
                            break;
                        }

                        break;
                    }
                    case Cell.Rock: {
                        if (!this.world.isSolid(x, y - 1)) {
                            this.world.setCell(x, y, Cell.Empty);
                            this.world.setCell(x, y - 1, !this.world.isSolid(x, y - 2) || this.world.isFallingRock(x, y - 2) ? Cell.Rock1 : Cell.Rock);

                            const crushed = this.creatures.filter(c => c.pos.x == x && c.pos.y == y - 1);
                            if (crushed.length != 0) {
                                const onSolidGround = this.world.isSolid(x, y - 2);

                                this.world.setCell(x, y - 1, Cell.Empty);

                                for (const victim of crushed) {
                                    if (this.damageCreature(victim, ROCK_CRUSH_BASE_DAMAGE + ROCK_CRUSH_PER_UNIT_DAMAGE, tickCtr) == -1 && !onSolidGround && !victim.falling) {
                                        victim.pos.y -= 1;
                                        victim.falling = true;
                                    }
                                }
                            }

                            break;
                        }

                        break;
                    }
                    case Cell.Rock1:
                    case Cell.Rock2:
                    case Cell.Rock3:
                    case Cell.Rock4:
                    case Cell.Rock5:
                    case Cell.Rock6:
                    case Cell.Rock7:
                    case Cell.Rock8P: {
                        if (!this.world.isSolid(x, y - 1)) {
                            this.world.setCell(x, y, Cell.Empty);
                            this.world.setCell(x, y - 1, !this.world.isSolid(x, y - 2) || this.world.isFallingRock(x, y - 2) ? cell == Cell.Rock8P ? cell : cell + 1 : Cell.Rock);

                            const crushed = this.creatures.filter(c => c.pos.x == x && c.pos.y == y - 1);
                            if (crushed.length != 0) {
                                const onSolidGround = this.world.isSolid(x, y - 2);

                                this.world.setCell(x, y - 1, Cell.Empty);

                                for (const victim of crushed) {
                                    if (this.damageCreature(victim, ROCK_CRUSH_BASE_DAMAGE + ROCK_CRUSH_PER_UNIT_DAMAGE * (cell - Cell.Rock + 1), tickCtr) == -1 && !onSolidGround && !victim.falling) {
                                        victim.pos.y -= 1;
                                        victim.falling = true;
                                    }
                                }
                            }
                        } else {
                            this.world.setCell(x, y, Cell.Rock);
                        }

                        break;
                    }
                    case Cell.Stone: {
                        if (this.world.isBorderingEmpty(x, y) && Math.random() < STONE_TO_MOSSY_ODDS) {
                            this.world.setCell(x, y, Cell.MossyStone);
                            break;
                        }

                        break;
                    }
                    case Cell.ChippedStone: {
                        if (this.world.isBorderingEmpty(x, y) && Math.random() < CHIPPED_STONE_TO_MOSSY_ODDS) {
                            this.world.setCell(x, y, Cell.MossyChippedStone);
                            break;
                        }

                        break;
                    }
                    case Cell.Bedrock: {
                        if (this.world.isBorderingEmpty(x, y) && Math.random() < BEDROCK_TO_MOSSY_ODDS) {
                            this.world.setCell(x, y, Cell.MossyBedrock);
                            break;
                        }

                        break;
                    }
                }
            }
        }
    }

    private runCreature(creature: Creature, tickCtr: number): Move {
        const self = { ...creature };
        delete self.bot;
        const others = this.creatures.filter(c => c != creature).map(c => {
            const other = { ...c };
            delete other.bot;
            delete other.ctx;
            return other;
        });

        let move;

        try {
            move = creature.bot!.run(self, others, this.world.clone(), tickCtr);

            if (move !== null) {
                if (move === undefined) throw new Error("Invalid move: `undefined`");
                if (typeof move != "object") throw new Error("Invalid move: `typeof` is not `\"object\"`");
                if (Array.isArray(move)) throw new Error("Invalid move: is an array");
                if (!("type" in move)) throw new Error("Invalid move: non-null with no `type`");
                if (!["left", "right", "climb_up", "climb_down", "dig", "pick_up", "drop", "eat", "bite"].includes(move.type)) throw new Error("Invalid move: invalid `type`: `" + JSON.stringify(move.type) + "`");
                if (["dig", "pick_up", "drop", "eat"].includes(move.type) || move.type == "bite" && "pos" in move) {
                    if (!("pos" in move)) throw new Error("Invalid move: missing `pos` for " + move.type);
                    if (move.pos === undefined) throw new Error("Invalid move: `move.pos` is `undefined` for " + move.type);
                    if (move.pos === null) throw new Error("Invalid move: `move.pos` is `null` for " + move.type);
                    if (typeof move.pos != "object") throw new Error("Invalid move: `typeof move.pos` is not `\"object\"` for " + move.type);
                    if (Array.isArray(move.pos)) throw new Error("Invalid move: `move.pos` is array for " + move.type);
                    if (!("x" in move.pos)) throw new Error("Invalid move: missing `pos.x` for " + move.type);
                    if (typeof move.pos.x != "number") throw new Error("Invalid move: `typeof move.pos.x` is not `\"number\"` for " + move.type);
                    if (!Number.isInteger(move.pos.x)) throw new Error("Invalid move: `move.pos.x` is not an integer for " + move.type);
                    if (!Number.isSafeInteger(move.pos.x)) throw new Error("Invalid move: `move.pos.x` is not a safe integer for " + move.type);
                    if (!("y" in move.pos)) throw new Error("Invalid move: missing `pos.y` for " + move.type);
                    if (typeof move.pos.y != "number") throw new Error("Invalid move: `typeof move.pos.y` is not `\"number\"` for " + move.type);
                    if (!Number.isInteger(move.pos.y)) throw new Error("Invalid move: `move.pos.y` is not an integer for " + move.type);
                    if (!Number.isSafeInteger(move.pos.y)) throw new Error("Invalid move: `move.pos.y` is not a safe integer for " + move.type);
                }
                if (move.type == "bite" && !("pos" in move) && !("victim" in move)) throw new Error("Invalid move: missing `pos` or `victim` for bite");
                if (move.type == "bite" && "victim" in move) {
                    if (typeof move.victim != "number") throw new Error("Invalid move: `typeof move.victim` is not `\"number\"` for bite");
                    if (!Number.isInteger(move.victim)) throw new Error("Invalid move: `move.victim` is not an integer for " + move.type);
                }
            }
        } catch (error) {
            console.warn("Bot " + creature.bot!.id + ", creature " + creature.id, error);
            move = null;
        }

        return move;
    }

    private damageCreature(creature: Creature, damage: number, tickCtr: number, fertilize: boolean = true): number {
        creature.hp -= damage;

        if (creature.hp <= 0) {
            const creatureIndex = this.creatures.indexOf(creature);
            this.creatures.splice(creatureIndex, 1);
            this.deadCreatures.push({ diedTick: tickCtr, creature });

            if (fertilize) {
                this.fertilize(creature.pos.x, creature.pos.y);
            }

            return creatureIndex;
        } else {
            return -1;
        }
    }

    private fertilize(x: number, y: number) {
        for (let i = 0; i < KILL_FERTILIZE_ROUNDS; i++) {
            const r = (Math.random() ** 2) * KILL_FERTILIZE_MAX_DIST;
            const dir = Math.random() * Math.PI * 2;

            const fx = Math.round(x + r * Math.cos(dir));
            const fy = Math.round(y + r * Math.sin(dir));

            if (fy < 0) {
                if (Math.random() < 2/3) {
                    i--;
                }

                continue;
            }

            const cell = this.world.getCell(fx, fy);

            switch (cell) {
                case Cell.Empty: {
                    if (Math.random() < 2/3) {
                        i--;
                    }

                    break;
                }
                case Cell.SmallGrassTufts: {
                    if (Math.random() < Math.sqrt(SMALL_GRASS_TUFTS_SKY_GROW_ODDS)) {
                        this.world.setCell(fx, fy, Cell.LargeGrassTufts);
                    }

                    break;
                }
                case Cell.GrassyDirt: {
                    if (this.world.getCell(fx, fy + 1) == Cell.Empty && Math.random() < Math.sqrt(GRASSY_DIRT_SKY_GROW_TUFTS_ODDS)) {
                        this.world.setCell(fx, fy + 1, Cell.SmallGrassTufts);
                    }

                    break;
                }
                case Cell.BarrenDirt: {
                    if (Math.random() < Math.sqrt(BARREN_DIRT_SKY_TO_DIRT_ODDS)) {
                        this.world.setCell(fx, fy, Cell.Dirt);
                    }

                    break;
                }
                case Cell.Dirt: {
                    if (!this.world.isSolid(fx, fy + 1) && Math.random() < Math.sqrt(DIRT_SKY_TO_GRASSY_DIRT_ODDS)) {
                        this.world.setCell(fx, fy, Cell.GrassyDirt);
                    }

                    break;
                }
                case Cell.Stone: {
                    if (Math.random() < Math.sqrt(STONE_TO_MOSSY_ODDS)) {
                        this.world.setCell(fx, fy, Cell.MossyStone);
                    }

                    break;
                }
                case Cell.ChippedStone: {
                    if (Math.random() < Math.sqrt(CHIPPED_STONE_TO_MOSSY_ODDS)) {
                        this.world.setCell(fx, fy, Cell.MossyChippedStone);
                    }

                    break;
                }
                case Cell.Bedrock: {
                    if (Math.random() < Math.sqrt(BEDROCK_TO_MOSSY_ODDS)) {
                        this.world.setCell(fx, fy, Cell.MossyBedrock);
                    }

                    break;
                }
            }
        }
    }
}