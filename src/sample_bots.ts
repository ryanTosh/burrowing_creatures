import { biteByCreature, Bot, climbDown, climbUp, dig, dropRock, eat, left, pickUpRock, right } from "./bot_interface";
import { Creature, Move } from "./controller";
import { Cell, cellIsNotSolid, cellIsRock, World } from "./world";

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
            // Create a "stage" property in self.ctx
            if (!("stage" in self.ctx)) self.ctx.stage = 0;

            // Stage 0: Dig straight down until hungry or at bedrock
            // Stage 1: Climb up shaft hunting for moss (not yet at bedrock)
            // Stage 2: Climb up shaft hunting for moss (found bedrock)
            // Stage 3: Climb down shaft hunting for moss (found bedrock)

            if (self.ctx.stage == 0) {
                // In stage 0, the goal is to dig straight down

                const cellBeneath = world.getCell(self.pos.x, self.pos.y - 1);

                // Look for food
                for (const offset of [[0, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]) {
                    const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                    if ([Cell.GrassyDirt, Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) {
                        return eat(self.pos.x + offset[0], self.pos.y + offset[1]);
                    }
                }
                // If in a shaft and not at the bottom, go down
                if (cellIsNotSolid(cellBeneath)) {
                    return climbDown();
                }
                // Pick up rock if it's in the way
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
                // Check if past dirt
                let foundDirt = false;
                for (const offset of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
                    const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                    if ([Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt].includes(cell) || cellIsRock(cell)) {
                        // We've found dirt! Move on to stage 2
                        foundDirt = true;
                        break;
                    }
                }
                // If hungry and below stone, switch to stage 1
                if (!foundDirt && self.fullness < 40) {
                    self.ctx.stage = 1;
                    return climbUp();
                }
                // Dig down if not at bedrock
                if (cellBeneath != Cell.Bedrock && cellBeneath != Cell.MossyBedrock) {
                    return dig(self.pos.x, self.pos.y - 1);
                }

                // If we've reached this point, we're at stage 2!
                self.ctx.stage = 2;
            }

            if (self.ctx.stage == 1 || self.ctx.stage == 2) {
                // In stages 1 and 2, the goal is to move up our tunnel until we hit dirt

                // Check four spaces around us for dirt
                for (const offset of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
                    const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                    if ([Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt].includes(cell) || cellIsRock(cell)) {
                        // We've found dirt! Move on to stage 0 or 3
                        self.ctx.stage = self.ctx.stage == 1 ? 0 : 3;
                        break;
                    }
                }

                // If we didn't find dirt, continue with current stage
                if (self.ctx.stage == 1 || self.ctx.stage == 2) {
                    // If we're not full, search for moss
                    if (self.fullness < 180) {
                        // Check the spaces around us for moss
                        for (const offset of [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]) {
                            const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                            if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) {
                                return eat(self.pos.x + offset[0], self.pos.y + offset[1]);
                            }
                        }
                    }

                    // If we didn't find moss or we're not hungry, move up
                    return climbUp();
                }
            }

            // Otherwise, we're in stage 3
            // In stage 3, the goal is to move down our tunnel until we hit the bottom

            // If we hit the bottom, return to stage 1
            const cellBeneath = world.getCell(self.pos.x, self.pos.y - 1);
            if (cellBeneath == Cell.Bedrock || cellBeneath == Cell.MossyBedrock) {
                self.ctx.stage = 1;

                // Check the bottom for moss
                if (cellBeneath == Cell.MossyBedrock) {
                    return eat(self.pos.x, self.pos.y - 1);
                }

                // Otherwise, just start climbing up
                return climbUp();
            }
            // If there's still stone to be dug, continue with stage 0
            if (cellBeneath != Cell.Empty) {
                self.ctx.stage = 0;
                return dig(self.pos.x, self.pos.y - 1);
            }

            // Do the same thing as stage 1, but climbing down instead
            if (self.fullness < 180) {
                for (const offset of [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]) {
                    const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                    if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) {
                        return eat(self.pos.x + offset[0], self.pos.y + offset[1]);
                    }
                }
            }

            return climbDown();
            
            // Flaws
            // - Can get mildly softlocked by certain formations of rocks
            // - Is easy prey at all times, especially to dropped rocks
            // - Could spend ages going in the opposite direction of just-grown moss
            // - Can be softlocked if dirt is dug near the boundary with stone
            // - Can starve digging initial hole if unlucky
        }
    }
];