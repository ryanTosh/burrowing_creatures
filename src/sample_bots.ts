import { biteByCreature, Bot, climbDown, climbUp, dig, dropRock, eat, left, pickUpRock, right } from "./bot_interface";
import { Creature, Move } from "./controller";
import { Cell, cellIsNotSolid, World } from "./world";

export const sample_bots: Bot[] = [
    {
        id: "runner",
        name: "Runner",
        run(self: Creature, _others: Creature[], world: World): Move {
            const x = self.pos.x;
            const y = self.pos.y;

            // If it's possible to move right without stepping up/down
            if (world.isSolid(x + 1, y - 1) && !world.isSolid(x + 1, y)) {
                return right();
            }

            // If it's possible to move right by stepping down onto solid ground
            if (world.isSolid(x + 1, y - 2) && !world.isSolid(x + 1, y)) {
                return right();
            }

            // If it's possible to move right by stepping up
            if (world.isNotSolid(x, y + 1) && world.isNotSolid(x + 1, y + 1)) {
                return right();
            }

            // Otherwise, try to staircase up
            if (world.isSolid(x, y + 1)) {
                return dig(x, y + 1);
            } else if (world.isSolid(x + 1, y + 1)) {
                return dig(x + 1, y + 1);
            } else {
                // This means it's a hole that's blocking us. Dig down

                return dig(x, y - 1);
            }

            // Flaws:
            // - Cannot handle rocks, which can't be dug
            // - Will dig up unnecessarily if a hole is the problem
            // - Will die of starvation
        }
    },
    {
        id: "sheep",
        name: "Sheep",
        run(self: Creature, _others: Creature[], world: World): Move {
            const { x, y } = self.pos;

            // If standing in grass tufts, eat them
            if (world.getCell(x, y) == Cell.SmallGrassTufts || world.getCell(x, y) == Cell.LargeGrassTufts) {
                return eat(x, y);
            }
            // If standing on grass, eat it
            if (world.getCell(x, y - 1) == Cell.GrassyDirt) {
                return eat(x, y - 1);
            }

            // try to move in a random direction
            return [left(), right()][Math.floor(Math.random() * 2)];

            // Flaws:
            // - Can get stuck
            // - Will eat when not strictly necessary
            // - Can't hunt or fight
            // - Easy prey
        }
    },
    {
        id: "hunter",
        name: "Simple Hunter",
        run(self: Creature, others: Creature[]): Move {
            others.sort(o => Math.hypot(o.pos.x - self.pos.x, o.pos.y - self.pos.y));
            const target = others[0];

            // If the target is close, try to bite it
            if (Math.hypot(target.pos.x - self.pos.x, target.pos.y - self.pos.y) < 2) {
                return biteByCreature(target.id);
            }
            // Otherwise, try to move to the target's x position
            if (target.pos.x > self.pos.x) {
                return right();
            } else {
                return left();
            }
        }
    },
    {
        id: "burrower",
        name: "Burrower",
        run(self: Creature, _others: Creature[], world: World): Move {
            // Store spawn y level
            if (!("spawn_y" in self.ctx)) self.ctx.spawn_y = self.pos.y;

            if (self.fullness > 100) {
                const cellBeneath = world.getCell(self.pos.x, self.pos.y - 1);

                // If in a shaft and not at the bottom, go down
                if (cellIsNotSolid(cellBeneath)) {
                    return climbDown();
                }
                // Trying to dig down; pick up rock if it's in the way
                if (cellBeneath == Cell.Rock) {
                    // If already carrying a rock, dig a hole off to the side to drop it in
                    if (self.carryingRock) {
                        if (world.isNotSolid(self.pos.x - 1, self.pos.y)) {
                            return dropRock(self.pos.x - 1, self.pos.y);
                        }
                        if (world.isNotSolid(self.pos.x + 1, self.pos.y)) {
                            return dropRock(self.pos.x + 1, self.pos.y);
                        }
                        if (world.getCell(self.pos.x - 1, self.pos.y) != Cell.Rock) {
                            return dig(self.pos.x - 1, self.pos.y);
                        }
                        return dig(self.pos.x + 1, self.pos.y);
                    }

                    return pickUpRock(self.pos.x, self.pos.y - 1);
                }
                // Dig down if not at bedrock
                if (cellBeneath != Cell.Bedrock && cellBeneath != Cell.MossyBedrock) {
                    return dig(self.pos.x, self.pos.y - 1);
                }
                // Stay still once at bedrock
                return null;
            } else {
                // Eat moss if easy to find
                if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(self.pos.x, self.pos.y - 1))) {
                    return eat(self.pos.x, self.pos.y - 1);
                }
                if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(self.pos.x - 1, self.pos.y))) {
                    return eat(self.pos.x - 1, self.pos.y);
                }
                if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(self.pos.x + 1, self.pos.y))) {
                    return eat(self.pos.x + 1, self.pos.y);
                }

                // Otherwise, go up, if not at the surface
                if (self.pos.y < self.ctx.spawn_y - 1) {
                    return climbUp();
                }

                // Once at the surface, try to find adjacent grass
                for (const offset of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
                    const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                    if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(cell)) {
                        return eat(self.pos.x + offset[0], self.pos.y + offset[1]);
                    }
                }

                // Otherwise, stay still
                return null;
            }

            // Flaws
            // - Can get mildly softlocked by certain formations of rocks
            // - Is easy prey when not busy
            // - Can get stuck waiting at the surface when moss has grown further down
            // - Can be softlocked if terrain changes occur at the surface
        }
    }
];