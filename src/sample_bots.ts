import { biteByCreature, Bot, climbDown, climbUp, dig, dropRock, eat, left, right } from "./bot_interface";
import { Creature, Move } from "./controller";
import { Cell, cellIsFallingRock, cellIsRock, cellIsSolid, World } from "./world";

export const sampleBots: Bot[] = [
    {
        id: "runner",
        run(self: Creature, _others: Creature[], world: World): Move {
            const x = self.pos.x;
            const y = self.pos.y;

            // If it's possible to move right
            if (!world.isSolid(x + 1, y) || !world.isSolid(x, y + 1) && !world.isSolid(x + 1, y + 1)) {
                return right();
            }

            // Otherwise, try to staircase up
            if (world.isSolid(x, y + 1)) {
                return dig(x, y + 1);
            } else {
                return dig(x + 1, y + 1);
            }

            // Flaws:
            // - Cannot handle rocks, which can't be dug
            // - Will fall down holes
            // - Will die of starvation
        }
    },
    {
        id: "sheep",
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
        id: "simple_hunter",
        run(self: Creature, others: Creature[], world: World): Move {
            others.sort((a, b) => Math.hypot(a.pos.x - self.pos.x, a.pos.y - self.pos.y) - Math.hypot(b.pos.x - self.pos.x, b.pos.y - self.pos.y));
            const target = others[0];

            // If the target is close, try to bite it
            if (Math.hypot(target.pos.x - self.pos.x, target.pos.y - self.pos.y) < 2) {
                return biteByCreature(target.id);
            }
            // If hungry and on top of grass, eat it
            if (self.fullness <= 175 && [Cell.SmallGrassTufts, Cell.LargeGrassTufts].includes(world.getCell(self.pos.x, self.pos.y))) {
                return eat(self.pos.x, self.pos.y);
            }
            if (self.fullness <= 175 && world.getCell(self.pos.x, self.pos.y - 1) == Cell.GrassyDirt) {
                return eat(self.pos.x, self.pos.y - 1);
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
                for (const offset of [[0, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]]) {
                    const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                    if ([Cell.GrassyDirt, Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) {
                        return eat(self.pos.x + offset[0], self.pos.y + offset[1]);
                    }
                }
                // If in a shaft and not at the bottom, go down
                if (!cellIsSolid(cellBeneath)) {
                    return climbDown();
                }
                // Pick up rock if it's in the way
                if (cellBeneath == Cell.Rock) {
                    return dig(self.pos.x, self.pos.y - 1);
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
    },
    {
        id: "rock_dropper",
        run(self: Creature, _others: Creature[], world: World): Move {
            if (!("dead" in self.ctx)) self.ctx.dead = [];

            const { x, y } = self.pos;

            // If hungry, try to eat
            for (let ox = x - 1; ox <= x + 1; ox++) {
                for (let oy = y - 1; oy <= y + 1; oy++) {
                    if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt, Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                        return eat(ox, oy);
                    }
                }
            }

            if (self.carryingRocks == 0) {
                const rocks: [number, number][] = [];
                for (let rx = x - 10; rx <= x + 10; rx++) {
                    if (self.ctx.dead.includes(rx)) continue;

                    for (let ry = 35; ry <= y; ry++) {
                        if (world.getCell(rx, ry) == Cell.Rock) {
                            rocks.push([rx, ry]);
                        }
                    }
                }
                rocks.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));

                if (rocks.length != 0) {
                    const rock = rocks[0];

                    if (rock[1] < y) {
                        if (world.isSolid(x, y - 1)) {
                            if (world.getCell(x, y - 1) == Cell.Rock) {
                                if (!self.ctx.dead.includes(x)) {
                                    return dig(x, y - 1);
                                } else {
                                    if (!world.isSolid(x - 1, y)) return left();
                                    if (!world.isSolid(x + 1, y)) return right();
                                    if (world.getCell(x - 1, y) == Cell.Rock && !self.ctx.dead.includes(x - 1)) return dig(x - 1, y);
                                    if (world.getCell(x + 1, y) == Cell.Rock && !self.ctx.dead.includes(x + 1)) return dig(x + 1, y);
                                    if (world.getCell(x - 1, y) != Cell.Rock) return dig(x - 1, y);
                                    if (world.getCell(x + 1, y) != Cell.Rock) return dig(x + 1, y);
                                }
                            } else {
                                return dig(x, y - 1);
                            }
                        } else {
                            return climbDown();
                        }
                    } else {
                        if (rock[0] < x) {
                            if (world.getCell(x - 1, y) == Cell.Rock) {
                                return dig(x - 1, y);
                            }

                            if (world.isSolid(x - 1, y)) {
                                return dig(x - 1, y);
                            }

                            return left();
                        } else {
                            if (world.getCell(x + 1, y) == Cell.Rock) {
                                return dig(x + 1, y);
                            }

                            if (world.isSolid(x + 1, y)) {
                                return dig(x + 1, y);
                            }

                            return right();
                        }
                    }
                }
            } else {
                const topM1 = world.findTopSolidY(x - 1);
                const top = world.findTopSolidY(x);
                const topP1 = world.findTopSolidY(x + 1);
                if (y >= topM1 && y > top && y >= topP1) {
                    if (topM1 < y - 1) {
                        self.ctx.dead.push(x - 1);
                        return dropRock(x - 1, y + 1);
                    }
                    if (top < y - 1) {
                        self.ctx.dead.push(x);
                        return dropRock(x, y - 1);
                    }
                    if (topP1 < y - 1) {
                        self.ctx.dead.push(x + 1);
                        return dropRock(x + 1, y + 1);
                    }
                }
            }

            // Can't find a rock, try to go to the surface
            if (!world.isSolid(x, y + 1) && world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1)) {
                return climbUp();
            }

            let leftSafe = world.isSolid(x - 1, y - 1) || world.isSolid(x - 1, y);
            let rightSafe = world.isSolid(x + 1, y - 1) || world.isSolid(x + 1, y);
            let leftPoss = leftSafe && (!world.isSolid(x - 1, y) || !world.isSolid(x - 1, y + 1) && !world.isSolid(x, y + 1));
            let rightPoss = rightSafe && (!world.isSolid(x + 1, y) || !world.isSolid(x + 1, y + 1) && !world.isSolid(x, y + 1));

            if (leftPoss && !rightPoss) return left();
            if (rightPoss && !leftPoss) return right();
            if (leftPoss && rightPoss) return Math.random() < 1 / 2 ? left() : right();

            return world.isSolid(x, y + 1) ? dig(x, y + 1) : dig(x + (Math.random() < 1 / 2 ? -1 : 1), y + 1);
        }
    },
    {
        id: "bedrock_lurker",
        run(self: Creature, others: Creature[], world: World, tickCtr: number): Move {
            if (!("stage" in self.ctx)) {
                self.ctx.stage = 0;
            }

            if (self.ctx.stage == 0 && tickCtr > 80 && tickCtr % 10 == 0) {
                xloop: for (let x = 0; x < world.width; x++) {
                    if (world.findTopSolidY(x) == 0) {
                        const topM1 = world.findTopSolidY(x - 1);
                        const topP1 = world.findTopSolidY(x + 1);

                        for (let y = 1; y <= Math.min(topM1, topP1); y++) {
                            if (!world.isSolid(x - 1, y) || !world.isSolid(x + 1, y)) {
                                continue xloop;
                            }
                        }
                        if (topM1 < topP1) {
                            for (let y = topM1 + 1; y <= topP1; y++) {
                                if (!world.isSolid(x + 1, y) || world.isRock(x + 1, y)) {
                                    continue xloop;
                                }
                            }
                        } else if (topP1 < topM1) {
                            for (let y = topP1 + 1; y <= topM1; y++) {
                                if (!world.isSolid(x - 1, y) || world.isRock(x - 1, y)) {
                                    continue xloop;
                                }
                            }
                        }

                        self.ctx.stage = 1;
                        self.ctx.target = x;
                        break;
                    }
                }
            }
                
            const { x, y } = self.pos;

            // If near someone, bite
            const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            // If hungry, try to eat
            if (self.fullness < 190 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 190) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            if (self.ctx.stage == 1 && x == self.ctx.target) {
                if (y == 1) {
                    self.ctx.stage = 2;
                } else {
                    return climbDown();
                }
            }

            if (self.ctx.stage == 3) {
                if (self.fullness > 175 || world.isSolid(x - 1, y)) {
                    self.ctx.stage = 2;
                    return null;
                }

                return left();
            }

            if (self.ctx.stage == 2) {
                if (self.fullness < 100) {
                    for (let sx = x; sx > x - world.width; sx--) {
                        if (world.isSolid(sx, y)) break;
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(sx, 0)) || [Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(sx, 2))) {
                            self.ctx.stage = 3;
                            return left();
                        }
                    }
                }
                if (!world.isSolid(x, y + 2)) {
                    if (world.isSolid(x - 1, y + 1)) {
                        return dig(x - 1, y + 1);
                    }
                    if (world.isSolid(x + 1, y + 1)) {
                        return dig(x + 1, y + 1);
                    }
                }
                if (world.isSolid(x + 1, y)) {
                    return dig(x + 1, y);
                }
                return right();
            }

            // Wander rightward
            if ((world.isSolid(x + 1, y - 2) || world.isSolid(x + 1, y - 1)) && !world.isSolid(x + 1, y)) {
                return right();
            }
            if (!world.isSolid(x + 1, y - 1) && !world.isSolid(x + 1, y) && world.isSolid(x + 2, y - 1)) {
                return right();
            }
            if (world.isSolid(x + 1, y)) {
                if (world.isSolid(x, y + 1)) {
                    return dig(x, y + 1);
                }
                if (world.isSolid(x + 1, y + 1)) {
                    return dig(x + 1, y + 1);
                }
                return right();
            }
            if (self.carryingRocks != 0) return dropRock(x + 1, y);
            if (!world.isRock(x, y - 1)) return dig(x, y - 1);
            return dig(x, y - 1);
        }
    },
    {
        id: "dirt_destroyer",
        run(self: Creature, others: Creature[], world: World): Move {
            if (!("dir" in self.ctx)) self.ctx.dir = Math.random() < 1/2 ? -1 : 1;

            const { x, y } = self.pos;

            // If near someone, bite
            const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            // If hungry, try to eat
            if (self.fullness < 190 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 190) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            // Destroy dirt
            if (world.isSolid(x, y - 1)) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if (ox == x && oy == y - 1) continue;
                        if (ox == x && oy == y + 1 && world.isRock(ox, oy + 1)) continue;
                        if (world.isSolid(ox, oy - 1) && oy != world.findTopSolidY(ox)) continue;

                        if ([Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return dig(ox, oy);
                        }
                    }
                }
            }

            // Wander in direction
            if ((world.isSolid(x + self.ctx.dir, y - 2) || world.isSolid(x + self.ctx.dir, y - 1)) && !world.isSolid(x + self.ctx.dir, y)) {
                const maxY = world.findTopSolidY(x + self.ctx.dir);
                let skip = false;
                for (let sy = y; sy <= maxY; sy++) {
                    if (world.isRock(x + self.ctx.dir, sy) && !world.isSolid(x + self.ctx.dir, sy - 1)) {
                        skip = true;
                        break;
                    }
                }
                if (!skip) return self.ctx.dir == -1 ? left() : right();
            }
            if (!world.isSolid(x + self.ctx.dir, y - 1) && !world.isSolid(x + self.ctx.dir, y) && world.isSolid(x + self.ctx.dir * 2, y - 1)) {
                const maxY = world.findTopSolidY(x + self.ctx.dir);
                let skip = false;
                for (let sy = y; sy <= maxY; sy++) {
                    if (world.isRock(x + self.ctx.dir, sy) && !world.isSolid(x + self.ctx.dir, sy - 1)) {
                        skip = true;
                        break;
                    }
                }
                if (!skip) return self.ctx.dir == -1 ? left() : right();
            }
            if (world.isSolid(x + self.ctx.dir, y)) {
                if (world.isSolid(x, y + 1)) {
                    return dig(x, y + 1);
                }
                if (world.isSolid(x + self.ctx.dir, y + 1)) {
                    return dig(x + self.ctx.dir, y + 1);
                }
                const maxY = world.findTopSolidY(x + self.ctx.dir);
                let skip = false;
                for (let sy = y; sy <= maxY; sy++) {
                    if (world.isRock(x + self.ctx.dir, sy) && !world.isSolid(x + self.ctx.dir, sy - 1)) {
                        skip = true;
                        break;
                    }
                }
                if (!skip) return self.ctx.dir == -1 ? left() : right();
            }
            if (self.carryingRocks != 0) return dropRock(x + self.ctx.dir, y);
            if (!world.isRock(x, y - 1)) return dig(x, y - 1);
            return dig(x, y - 1);
        }
    },
    {
        id: "smart_hunter",
        run(self: Creature, others: Creature[], world: World): Move {
            if (!("dir" in self.ctx)) self.ctx.dir = Math.random() < 1 / 2 ? -1 : 1;

            const { x, y } = self.pos;

            others.sort((a, b) => (Math.abs(world.wrappingXOffset(a.pos.x, self.pos.x)) + Math.abs(a.pos.y - self.pos.y)) - (Math.abs(world.wrappingXOffset(b.pos.x, self.pos.x)) + Math.abs(b.pos.y - self.pos.y)));
            const target = others[0];

            const diffX = world.wrappingXOffset(x, target.pos.x);
            const diffY = target.pos.y - y;
            const dist = Math.abs(diffX) + Math.abs(diffY);

            let running = false;
            if (self.hp - Math.ceil(target.hp / 5) * 5 <= 0 && self.hp < 16) {
                if (world.isReachableFrom(x, y, target.pos.x, target.pos.y) && self.hp >= 11) {
                    return biteByCreature(target.id);
                } else {
                    if (dist < 8) self.ctx.dir = -Math.sign(diffX);
                    running = true;
                }
            } else {
                if (world.isReachableFrom(x, y, target.pos.x, target.pos.y)) {
                    return biteByCreature(target.id);
                } else {
                    self.ctx.dir = Math.sign(diffX);
                }
            }

            if (self.fullness < target.fullness + dist || self.hp < 20) {
                // Not strong enough

                if (!running || dist > 3) {
                    if (self.fullness < 190 || self.hp < 20) {
                        for (let oy = y + 1; oy >= y - 1; oy--) {
                            for (let ox = x - 1; ox <= x + 1; ox++) {
                                if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                    return eat(ox, oy);
                                }
                            }
                        }
                    }
                    if (self.fullness < 190) {
                        for (let oy = y + 1; oy >= y - 1; oy--) {
                            for (let ox = x - 1; ox <= x + 1; ox++) {
                                if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                    return eat(ox, oy);
                                }
                            }
                        }
                    }
                }
            }

            // Pursue
            if (world.findTopSolidY(x) < y && world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1) && (running ? diffY < 0 : diffY > 0)) {
                return climbUp();
            }
            if (!world.isSolid(x + self.ctx.dir, y - 1) && !world.isSolid(x + self.ctx.dir, y) && world.isSolid(x + self.ctx.dir * 2, y - 1)) {
                const maxY = world.findTopSolidY(x + self.ctx.dir);
                let skip = false;
                for (let sy = y; sy <= maxY; sy++) {
                    if (world.isRock(x + self.ctx.dir, sy) && !world.isSolid(x + self.ctx.dir, sy - 1)) {
                        skip = true;
                        break;
                    }
                }
                if (!skip) return self.ctx.dir == -1 ? left() : right();
            }
            if (Math.abs(diffX) <= (running ? 0 : 1) && (running ? diffY < 0 : diffY > 0)) {
                if (!world.isSolid(x, y + 1) && world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1)) return climbUp();
                if ((world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1) || diffY == 2) && !world.isRock(x, y + 2)) return dig(x, y + 1);
            }
            if (Math.abs(diffX) <= (running ? 0 : 1) && (running ? diffY > 0 : diffY < 0)) {
                if (!world.isSolid(x, y - 1) && world.isSolid(x - 1, y - 1) && world.isSolid(x + 1, y - 1)) return climbDown();
                if (world.isRock(x, y - 1)) {
                    return dig(x, y - 1);
                }
                if (world.isSolid(x, y - 1) && (world.isSolid(x, y - 2) || world.isSolid(x, y - 3))) return dig(x, y - 1);
            }
            if ((world.isSolid(x + self.ctx.dir, y - 3) || world.isSolid(x + self.ctx.dir, y - 2) || world.isSolid(x + self.ctx.dir, y - 1)) && !world.isSolid(x + self.ctx.dir, y)) {
                const maxY = world.findTopSolidY(x + self.ctx.dir);
                let skip = false;
                for (let sy = y; sy <= maxY; sy++) {
                    if (world.isRock(x + self.ctx.dir, sy) && !world.isSolid(x + self.ctx.dir, sy - 1)) {
                        skip = true;
                        break;
                    }
                }
                if (!skip) return self.ctx.dir == -1 ? left() : right();
            }
            if (world.isSolid(x + self.ctx.dir, y)) {
                if (world.isSolid(x, y + 1)) {
                    return dig(x, y + 1);
                }
                if (world.isSolid(x + self.ctx.dir, y + 1)) {
                    return dig(x + self.ctx.dir, y + 1);
                }
                const maxY = world.findTopSolidY(x + self.ctx.dir);
                let skip = false;
                for (let sy = y; sy <= maxY; sy++) {
                    if (world.isRock(x + self.ctx.dir, sy) && !world.isSolid(x + self.ctx.dir, sy - 1)) {
                        skip = true;
                        break;
                    }
                }
                if (!skip) return self.ctx.dir == -1 ? left() : right();
            }
            if (self.carryingRocks != 0) return dropRock(x + self.ctx.dir, y);
            if (!world.isRock(x, y - 1)) return dig(x, y - 1);
            return dig(x, y - 1);
        }
    },
    {
        id: "island_builder",
        run(self: Creature, others: Creature[], world: World): Move {
            if (!("minIslandSize" in self.ctx)) {
                self.ctx.minIslandSize = Math.round(1.1 ** (Math.random() ** 2 * 16) * 20);
            }

            const { x, y } = self.pos;

            if (!("state" in self.ctx)) self.ctx.state = {
                state: 0,
                topY: y
            };

            let state: { state: 0; topY: number } | { state: 1; minX: number; } | { state: 2; minX: number; minY: number; } | { state: 3 | 4; minX: number; minY: number; maxX: number; } | { state: 5 | 6; minX: number; maxX: number; } = self.ctx.state;

            // If near someone, bite
            const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            // If hungry, try to eat
            if (self.fullness < 180 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 185) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            // State 0: Dig down left perimeter
            if (state.state == 0) {
                if (y <= state.topY - 8) {
                    self.ctx.state = state = {
                        state: 1,
                        minX: x + 1
                    };
                }

                if (state.state == 0) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x; ox++) {
                            const cell = world.getCell(ox, oy);

                            if (!world.isReachableFrom(x, y, ox, oy)) continue;
                            if (!cellIsSolid(cell)) continue;
                            if (cellIsFallingRock(cell)) continue;
                            if (cell == Cell.Rock) {
                                return dig(ox, oy);
                            }
                            return dig(ox, oy);
                        }
                    }
                }
            }
            // State 1: Dig across
            if (state.state == 1) {
                if (x >= state.minX + self.ctx.minIslandSize || x < state.minX - 2 && x >= (state.minX + self.ctx.minIslandSize) % world.width) {
                    let isSafe = true;
                    
                    const topM1 = world.findTopSolidY(x - 1);
                    const top = world.findTopSolidY(x);
                    const topP1 = world.findTopSolidY(x + 1);

                    for (let sy = y + 1; sy < top; sy++) {
                        if (world.isRock(x, sy)) {
                            isSafe = false;
                            break;
                        }
                    }
                    for (let sy = y + 1; sy <= Math.min(topM1, topP1); sy++) {
                        if (!world.isSolid(x - 1, sy) || !world.isSolid(x + 1, sy)) {
                            isSafe = false;
                            break;
                        }
                    }

                    if (isSafe) {
                        self.ctx.state = state = {
                            state: 2,
                            minX: state.minX,
                            minY: y
                        };
                    }
                }

                if (state.state == 1) {
                    if (self.carryingRocks != 0 && !world.isSolid(x - 1, y)) return dropRock(x - 1, y);
                    if (world.getCell(x + 1, y) == Cell.Rock) {
                        return dig(x + 1, y);
                    }
                    if (!world.isSolid(x + 1, y)) return right();
                    if (!world.isSolid(x, y - 1)) {
                        if (self.carryingRocks != 0) return dropRock(x, y - 1);
                        if (world.getCell(x + 1, y + 1) == Cell.Rock) return dig(x + 1, y + 1);
                        if (world.isSolid(x, y + 1)) return dig(x, y + 1);
                        if (!world.isSolid(x + 1, y + 1)) return right();
                        return dig(x + 1, y + 1);
                    }
                    return dig(x + 1, y);
                }
            }
            // State 2: Dig up right perimeter
            if (state.state == 2) {
                if (world.isSolid(x, y + 1)) return dig(x, y + 1);

                const topM1 = world.findTopSolidY(x - 1);
                const topP1 = world.findTopSolidY(x + 1);

                if (y >= topM1) {
                    self.ctx.state = state = {
                        state: 3,
                        minX: state.minX,
                        minY: state.minY,
                        maxX: x - 2
                    };

                    return left();
                }
                if (y == topP1) {
                    if (topM1 == topP1 + 1) {
                        return dig(x - 1, y + 1);
                    }

                    self.ctx.state = state = {
                        state: 3,
                        minX: state.minX,
                        minY: state.minY,
                        maxX: x - 1
                    };

                    return right();
                }

                return climbUp();
            }
            // State 3: Dig down again for right perimeter hole
            if (state.state == 3) {
                if (y == state.minY) {
                    self.ctx.state = state = {
                        state: 4,
                        minX: state.minX,
                        minY: state.minY,
                        maxX: state.maxX
                    };
                }

                if (state.state == 3) {
                    const cell = world.getCell(x, y - 1);

                    if (cell == Cell.Rock) {
                        return dig(x, y - 1);
                    }
                    return dig(x, y - 1);
                }
            }
            // State 4: Center self under island
            if (state.state == 4) {
                let safeDigUp = true;

                const topM1 = world.findTopSolidY(x - 1);
                const top = world.findTopSolidY(x);
                const topP1 = world.findTopSolidY(x + 1);

                if (topM1 <= state.minY || top <= state.minY || topP1 <= state.minY) safeDigUp = false;

                for (let sy = y + 1; sy < top; sy++) {
                    if (world.isRock(x, sy)) {
                        safeDigUp = false;
                        break;
                    }
                }
                for (let sy = y + 1; sy <= Math.min(topM1, topP1); sy++) {
                    if (!world.isSolid(x - 1, sy) || !world.isSolid(x + 1, sy)) {
                        safeDigUp = false;
                        break;
                    }
                }

                if (safeDigUp) {
                    self.ctx.state = state = {
                        state: 5,
                        minX: state.minX,
                        maxX: state.maxX
                    };
                }

                if (state.state == 4) {
                    if (self.carryingRocks != 0 && !world.isSolid(x + 1, y)) return dropRock(x + 1, y);
                    if (world.getCell(x - 1, y) == Cell.Rock) {
                        return dig(x - 1, y);
                    }
                    if (!world.isSolid(x - 1, y)) return left();
                    if (!world.isSolid(x, y - 1)) {
                        if (self.carryingRocks != 0) return dropRock(x, y - 1);
                        if (world.getCell(x - 1, y + 1) == Cell.Rock) return dig(x - 1, y + 1);
                        if (world.isSolid(x, y + 1)) return dig(x, y + 1);
                        if (!world.isSolid(x - 1, y + 1)) return left();
                        return dig(x - 1, y + 1);
                    }
                    return dig(x - 1, y);
                }
            }
            // State 5: Climb up to surface
            if (state.state == 5) {
                if (world.isSolid(x, y + 1)) return dig(x, y + 1);

                const topM1 = world.findTopSolidY(x - 1);
                const topP1 = world.findTopSolidY(x + 1);

                if (y == topM1) {
                    if (topP1 == topM1 + 1) {
                        return dig(x + 1, y + 1);
                    }

                    self.ctx.state = state = {
                        state: 6,
                        minX: state.minX,
                        maxX: state.maxX
                    };
                    self.ctx.dir = 1;
                }
                if (y == topP1) {
                    if (topM1 == topP1 + 1) {
                        return dig(x - 1, y + 1);
                    }

                    self.ctx.state = state = {
                        state: 6,
                        minX: state.minX,
                        maxX: state.maxX
                    };
                    self.ctx.dir = -1;
                }

                if (state.state == 5) return climbUp();
            }
            // State 6: Roam island
            if (state.state == 6) {
                if (x == state.minX) {
                    self.ctx.dir = 1;
                } else if (x == state.maxX) {
                    self.ctx.dir = -1;
                }

                for (let i = 0; i < 2; i++) {
                    if ((world.isSolid(x + self.ctx.dir, y - 2) || world.isSolid(x + self.ctx.dir, y - 1)) && !world.isSolid(x + self.ctx.dir, y)) {
                        return self.ctx.dir == -1 ? left() : right();
                    }
                    if (!world.isSolid(x + self.ctx.dir, y - 1) && !world.isSolid(x + self.ctx.dir, y) && world.isSolid(x + self.ctx.dir * 2, y - 1)) {
                        return self.ctx.dir == -1 ? left() : right();
                    }
                    if (world.isSolid(x + self.ctx.dir, y)) {
                        if (world.isSolid(x, y + 1)) {
                            return dig(x, y + 1);
                        }
                        if (world.isSolid(x + self.ctx.dir, y + 1)) {
                            return dig(x + self.ctx.dir, y + 1);
                        }
                        return self.ctx.dir == -1 ? left() : right();
                    }
                    if (self.carryingRocks != 0) return dropRock(x + self.ctx.dir, y);
                    self.ctx.dir *= -1;
                }
            }

            return null;
        }
    },
    {
        id: "goat",
        run(self: Creature, others: Creature[], world: World): Move {
            const { x, y } = self.pos;

            // If near someone, bite
            const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            // If hungry, try to eat
            if (self.fullness < 180 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 185) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            let leftY: number | null = null;
            let rightY: number | null = null;

            let sx = x;
            let sy = y;
            let ticks = 0;

            let distToFoodLeft = Infinity;
            while (true) {
                for (let oy = sy + 1; oy >= sy - 1; oy--) {
                    for (let ox = sx - 1; ox <= sx + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt, Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(sx, sy, ox, oy)) {
                            distToFoodLeft = ticks;
                            break;
                        }
                    }
                }

                ticks++;

                if (world.isSolid(sx - 1, sy)) {
                    if (!world.isSolid(sx - 1, sy + 1) && !world.isSolid(sx, sy + 1)) {
                        sx -= 1;
                        sy += 1;
                    } else {
                        break;
                    }
                } else {
                    if (world.isSolid(sx - 1, sy - 1)) {
                        sx -= 1;
                    } else if (world.isSolid(sx - 1, sy - 2) || world.isSolid(sx - 2, sy - 1)) {
                        sx -= 1;
                        sy -= 1;
                    }
                }

                if (ticks == 1) {
                    leftY = sy;
                }

                if (ticks >= world.width) break;
                if (distToFoodLeft != Infinity) break;
            }

            sx = x;
            sy = y;
            ticks = 0;

            let distToFoodRight = Infinity;
            while (true) {
                for (let oy = sy + 1; oy >= sy - 1; oy--) {
                    for (let ox = sx - 1; ox <= sx + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt, Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(sx, sy, ox, oy)) {
                            distToFoodRight = ticks;
                            break;
                        }
                    }
                }

                ticks++;

                if (world.isSolid(sx + 1, sy)) {
                    if (!world.isSolid(sx + 1, sy + 1) && !world.isSolid(sx, sy + 1)) {
                        sx += 1;
                        sy += 1;
                    } else {
                        break;
                    }
                } else {
                    if (world.isSolid(sx + 1, sy - 1)) {
                        sx += 1;
                    } else if (world.isSolid(sx + 1, sy - 2) || world.isSolid(sx + 2, sy - 1)) {
                        sx += 1;
                        sy -= 1;
                    }
                }

                if (ticks == 1) {
                    rightY = sy;
                }

                if (ticks >= world.width) break;
                if (distToFoodRight != Infinity) break;
            }

            let leftFood = 0;
            let stillFood = 0;
            let rightFood = 0;

            for (let oy = y + 2; oy >= y - 2; oy--) {
                for (let ox = x - 2; ox <= x + 2; ox++) {
                    const cell = world.getCell(ox, oy);
                    const food = cell == Cell.LargeGrassTufts ? 50 : cell == Cell.SmallGrassTufts || cell == Cell.GrassyDirt ? 25 : [Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell) ? 20 : 0;
                    
                    if (leftY !== null && world.isReachableFrom(x - 1, leftY, ox, oy)) leftFood += food;
                    if (world.isReachableFrom(x, y, ox, oy)) stillFood += food;
                    if (rightY !== null && world.isReachableFrom(x + 1, rightY, ox, oy)) rightFood += food;
                }
            }

            if (distToFoodLeft == Infinity && distToFoodRight == Infinity) return null;
            if (distToFoodLeft == 0 || distToFoodRight == 0) {
                if (leftFood > stillFood && leftFood > rightFood) return left();
                if (rightFood > stillFood && rightFood > leftFood) return right();
                return null;
            }
            if (distToFoodLeft < distToFoodRight) return left();
            return right();
        }
    },
    {
        id: "randomizer",
        run(self, others, world) {
            const { x, y } = self.pos;

            const moves: (Move | null)[] = [null];

            if (!world.isSolid(x - 1, y) || !world.isSolid(x - 1, y + 1) && !world.isSolid(x, y + 1)) {
                moves.push(left());
            }
            if (!world.isSolid(x + 1, y) || !world.isSolid(x + 1, y + 1) && !world.isSolid(x, y + 1)) {
                moves.push(right());
            }
            if (!world.isSolid(x, y + 1) && world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1)) {
                moves.push(climbUp());
            }
            if (!world.isSolid(x, y - 1)) {
                moves.push(climbDown());
            }
            for (let oy = y + 1; oy >= y - 1; oy--) {
                for (let ox = x - 1; ox <= x + 1; ox++) {
                    if (!world.isReachableFrom(x, y, ox, oy)) continue;

                    const cell = world.getCell(ox, oy);
                    if (cellIsSolid(cell)) {
                        if (!cellIsRock(cell)) moves.push(dig(ox, oy));
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt, Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) moves.push(eat(ox, oy));
                        if (cell == Cell.Rock) moves.push(dig(ox, oy));
                    } else {
                        if (self.carryingRocks != 0) moves.push(dropRock(ox, oy));
                    }
                }
            }
            for (const other of others.filter(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y))) {
                moves.push(biteByCreature(other.id));
            }
            return moves[Math.floor(Math.random() * moves.length)];
        }
    },
    {
        id: "groundimizer",
        run(self, others, world) {
            const { x, y } = self.pos;

            const moves: (Move | null)[] = [null];

            if (!world.isSolid(x - 1, y) || !world.isSolid(x - 1, y + 1) && !world.isSolid(x, y + 1)) {
                moves.push(left());
            }
            if (!world.isSolid(x + 1, y) || !world.isSolid(x + 1, y + 1) && !world.isSolid(x, y + 1)) {
                moves.push(right());
            }
            if (!world.isSolid(x, y + 1) && world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1)) {
                moves.push(climbUp());
            }
            if (!world.isSolid(x, y - 1)) {
                moves.push(climbDown());
            }
            for (let oy = y + 1; oy >= y - 1; oy--) {
                for (let ox = x - 1; ox <= x + 1; ox++) {
                    if (!world.isReachableFrom(x, y, ox, oy)) continue;

                    const cell = world.getCell(ox, oy);
                    if (cellIsSolid(cell)) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt, Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) moves.push(eat(ox, oy));
                        if (cell == Cell.Rock) moves.push(dig(ox, oy));
                    } else {
                        if (self.carryingRocks != 0) moves.push(dropRock(ox, oy));
                    }
                }
            }
            for (const other of others.filter(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y))) {
                moves.push(biteByCreature(other.id));
            }
            return moves[Math.floor(Math.random() * moves.length)];
        }
    },
    {
        id: "burlurk_hybrid",
        run(self, others, world) {
            if (!("stage" in self.ctx)) {
                self.ctx.stage = 0;
            }

            // Stage 0: Dig straight down until hungry or at bedrock
            // Stage 1: Climb up shaft hunting for moss (not yet at bedrock)
            // Stage 2/3: Bedrock lurker behavior

            const { x, y } = self.pos;

            // If near someone, bite
            const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            // If hungry, try to eat
            if (self.fullness < 190 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 190) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            for (let i = 0; i < 4; i++) {
                switch (self.ctx.stage) {
                    case 0: {
                        // In stage 0, the goal is to dig straight down

                        const cellBeneath = world.getCell(self.pos.x, self.pos.y - 1);

                        // If in a shaft and not at the bottom, go down
                        if (!cellIsSolid(cellBeneath)) {
                            return climbDown();
                        }
                        // Pick up rock if it's in the way
                        if (cellBeneath == Cell.Rock) {
                            // If already carrying a rock, dig a hole off to the side to drop it in
                            if (self.carryingRocks != 0) {
                                if (!world.isSolid(self.pos.x - 1, self.pos.y)) {
                                    return dropRock(self.pos.x - 1, self.pos.y);
                                }
                                if (!world.isSolid(self.pos.x + 1, self.pos.y)) {
                                    return dropRock(self.pos.x + 1, self.pos.y);
                                }
                                if (world.getCell(self.pos.x - 1, self.pos.y) != Cell.Rock) {
                                    return dig(self.pos.x - 1, self.pos.y);
                                }
                                return dig(self.pos.x + 1, self.pos.y);
                            }

                            return dig(self.pos.x, self.pos.y - 1);
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

                        // If we've reached this point, we're at stage 2 if not hungry
                        self.ctx.stage = self.fullness < 100 ? 1 : 2;

                        break;
                    }
                    case 1: {
                        // In stage 1, the goal is to move up our tunnel until we hit dirt

                        // Check four spaces around us for dirt
                        for (const offset of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
                            const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                            if ([Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt].includes(cell) || cellIsRock(cell)) {
                                // We've found dirt! Move back to stage 0
                                self.ctx.stage = 0;
                                break;
                            }
                        }

                        if (self.ctx.stage == 1) {
                            return climbUp();
                        }

                        break;
                    }
                    case 2: {
                        if (self.fullness < 100) {
                            for (let sx = x; sx > x - world.width; sx--) {
                                if (world.isSolid(sx, y)) break;
                                if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(sx, 0)) || [Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(sx, 2))) {
                                    self.ctx.stage = 3;
                                    return left();
                                }
                            }
                        }
                        if (!world.isSolid(x, y + 2)) {
                            if (world.isSolid(x - 1, y + 1)) {
                                return dig(x - 1, y + 1);
                            }
                            if (world.isSolid(x + 1, y + 1)) {
                                return dig(x + 1, y + 1);
                            }
                        }
                        if (world.isSolid(x + 1, y)) {
                            return dig(x + 1, y);
                        }
                        if (self.fullness > 180 && (world.getCell(x, y + 1) == Cell.Stone || world.getCell(x, y + 1) == Cell.MossyStone)) {
                            return dig(x, y + 1);
                        }
                        return right();
                    }
                    case 3: {
                        if (self.fullness > 175 || world.isSolid(x - 1, y)) {
                            self.ctx.stage = 2;
                        } else {
                            return left();
                        }

                        break;
                    }
                }
            }

            return null;
        }
    },
    {
        id: "chasm",
        run(self, others, world) {
            const { x, y } = self.pos;

            if (!("center" in self.ctx)) self.ctx.center = x;

            const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            if (self.fullness < 190 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 190) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            if (x == self.ctx.center) {
                for (const [offX, offY] of [[-1, 1], [-1, 0], [-1, -1]]) {
                    const ox = x + offX;
                    const oy = y + offY;

                    if (world.isReachableFrom(x, y, ox, oy) && world.isSolid(ox, oy) && !world.isFallingRock(ox, oy)) {
                        if (world.getCell(ox, oy) == Cell.Rock) {
                            return dig(ox, oy);
                        }

                        return dig(ox, oy);
                    }
                }

                return left();
            } else {
                for (const [offX, offY] of [[1, 1], [1, 0], [1, -1]]) {
                    const ox = x + offX;
                    const oy = y + offY;

                    if (world.isReachableFrom(x, y, ox, oy) && world.isSolid(ox, oy) && !world.isFallingRock(ox, oy)) {
                        if (world.getCell(ox, oy) == Cell.Rock) {
                            return dig(ox, oy);
                        }

                        return dig(ox, oy);
                    }
                }

                return right();
            }
        }
    },
    {
        id: "coward",
        run(self, others, world): Move | null {
            const { x, y } = self.pos;

            function findMinMoveDist(x1: number, y1: number, falling1: boolean, x2: number, y2: number): number {
                if (world.isReachableFrom(x1, y1, x2, y2)) return 0;

                const queue: ({ x: number, y: number, falling: boolean })[] = [{ x: x1, y: y1, falling: falling1 }];
                const tickCount: Map<string, number> = new Map([[x1 + "," + y1, 0]]);
                for (let i = 0; i < 128; i++) {
                    if (!queue.length) break;

                    const pos = queue.shift()!;

                    if (!world.willFall(pos.x, pos.y) || pos.falling && !world.isSolid(pos.x, pos.y - 1)) {
                        queue.push({ x: pos.x, y: pos.y - 1, falling: true });
                        tickCount.set(pos.x + "," + (pos.y - 1), tickCount.get(pos.x + "," + pos.y)! + 1);
                    } else {
                        const leftPos = world.simulateLeft(pos.x, pos.y);
                        const rightPos = world.simulateRight(pos.x, pos.y);
                        const climbUpPos = world.simulateClimbUp(pos.x, pos.y);
                        const climbDownPos = world.simulateClimbDown(pos.x, pos.y);

                        if (leftPos !== null && !tickCount.has(leftPos.x + "," + leftPos.y)) {
                            queue.push(leftPos);
                            if (world.isReachableFrom(leftPos.x, leftPos.y, x2, y2)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            if (world.isReachableFrom(leftPos.x, leftPos.y, x2, y2 - 1)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            tickCount.set(leftPos.x + "," + leftPos.y, tickCount.get(pos.x + "," + pos.y)! + 1);
                        }
                        if (rightPos !== null && !tickCount.has(rightPos.x + "," + rightPos.y)) {
                            queue.push(rightPos);
                            if (world.isReachableFrom(rightPos.x, rightPos.y, x2, y2)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            if (world.isReachableFrom(rightPos.x, rightPos.y, x2, y2 - 1)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            tickCount.set(rightPos.x + "," + rightPos.y, tickCount.get(pos.x + "," + pos.y)! + 1);
                        }
                        if (climbUpPos !== null && !tickCount.has(climbUpPos.x + "," + climbUpPos.y)) {
                            queue.push(climbUpPos);
                            if (world.isReachableFrom(climbUpPos.x, climbUpPos.y, x2, y2)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            if (world.isReachableFrom(climbUpPos.x, climbUpPos.y, x2, y2 - 1)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            tickCount.set(climbUpPos.x + "," + climbUpPos.y, tickCount.get(pos.x + "," + pos.y)! + 1);
                        }
                        if (climbDownPos !== null && !tickCount.has(climbDownPos.x + "," + climbDownPos.y)) {
                            queue.push(climbDownPos);
                            if (world.isReachableFrom(climbDownPos.x, climbDownPos.y, x2, y2)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            if (world.isReachableFrom(climbDownPos.x, climbDownPos.y, x2, y2 - 1)) return tickCount.get(pos.x + "," + pos.y)! + 1;
                            tickCount.set(climbDownPos.x + "," + climbDownPos.y, tickCount.get(pos.x + "," + pos.y)! + 1);
                        }
                    }
                }

                return Infinity;
            }

            function findThreatDist(x: number, y: number): number {
                const threats = others.filter(o => self.hp - Math.ceil(o.hp / 5) * 5 <= 0);

                if (threats.length == 0) return Infinity;

                const dists = threats.map(t => findMinMoveDist(t.pos.x, t.pos.y, t.falling, x, y));
                dists.sort((a, b) => a - b);
                return dists[0];
            }

            function findSimThreatDist(sim: { x: number, y: number, falling: boolean } | null): number | null {
                return sim !== null && (!sim.falling || world.isSolid(sim.x, sim.y - 2) || world.isSolid(sim.x, sim.y - 3)) ? findThreatDist(sim.x, sim.y) : null;
            }

            const leftPos = world.simulateLeft(x, y);
            const rightPos = world.simulateRight(x, y);
            const climbUpPos = world.simulateClimbUp(x, y);
            const climbDownPos = world.simulateClimbDown(x, y);

            const noMoveThreatDist = findThreatDist(x, y);
            const leftThreatDist = findSimThreatDist(leftPos);
            const rightThreatDist = findSimThreatDist(rightPos);
            const climbUpThreatDist = findSimThreatDist(climbUpPos);
            const climbDownThreatDist = findSimThreatDist(climbDownPos);

            const minThreatDist = Math.min(...[noMoveThreatDist, leftThreatDist, rightThreatDist, climbUpThreatDist, climbDownThreatDist].filter(d => d !== null));
            const maxThreatDist = Math.max(...[noMoveThreatDist, leftThreatDist, rightThreatDist, climbUpThreatDist, climbDownThreatDist].filter(d => d !== null));

            const routes: Map<string, (Move | { type: "_falling" })[]> = new Map();

            if (minThreatDist < 8) {
                const nearby = others.find(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y) && self.hp - Math.ceil(o.hp / 5) * 5 > 0);
                if (nearby !== undefined) return biteByCreature(nearby.id);

                if ((self.fullness <= 20 || self.hp < 20) && noMoveThreatDist > 2) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }

                if (noMoveThreatDist == maxThreatDist) routes.set(x + "," + y, []);
                if (leftThreatDist == maxThreatDist) routes.set(leftPos!.x + "," + leftPos!.y, [left()]);
                if (rightThreatDist == maxThreatDist) routes.set(rightPos!.x + "," + rightPos!.y, [right()]);
                if (climbUpThreatDist == maxThreatDist) routes.set(climbUpPos!.x + "," + climbUpPos!.y, [climbUp()]);
                if (climbDownThreatDist == maxThreatDist) routes.set(climbDownPos!.x + "," + climbDownPos!.y, [climbDown()]);
            } else {
                const nearby = others.find(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y));
                if (nearby !== undefined) return biteByCreature(nearby.id);

                if (self.fullness < 180 || self.hp < 20) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }
                if (self.fullness < 185) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }

                const queue: ({ x: number, y: number, falling: boolean })[] = [{ ...self.pos, falling: false }];
                routes.set(x + "," + y, []);
                for (let i = 0; i < 128; i++) {
                    if (!queue.length) break;

                    const pos = queue.shift()!;

                    if (world.willFall(pos.x, pos.y) || pos.falling && !world.isSolid(pos.x, pos.y - 1)) {
                        queue.push({ x: pos.x, y: pos.y - 1, falling: true });
                        routes.set(pos.x + "," + (pos.y - 1), routes.get(pos.x + "," + pos.y)!.concat([{ type: "_falling" }]));
                    } else {
                        const leftPos = world.simulateLeft(pos.x, pos.y);
                        const rightPos = world.simulateRight(pos.x, pos.y);
                        const climbUpPos = world.simulateClimbUp(pos.x, pos.y);
                        const climbDownPos = world.simulateClimbDown(pos.x, pos.y);

                        if (leftPos !== null && !routes.has(leftPos.x + "," + leftPos.y)) {
                            queue.push(leftPos);
                            routes.set(leftPos.x + "," + leftPos.y, routes.get(pos.x + "," + pos.y)!.concat([left()]));
                        }
                        if (rightPos !== null && !routes.has(rightPos.x + "," + rightPos.y)) {
                            queue.push(rightPos);
                            routes.set(rightPos.x + "," + rightPos.y, routes.get(pos.x + "," + pos.y)!.concat([right()]));
                        }
                        if (climbUpPos !== null && !routes.has(climbUpPos.x + "," + climbUpPos.y)) {
                            queue.push(climbUpPos);
                            routes.set(climbUpPos.x + "," + climbUpPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbUp()]));
                        }
                        if (climbDownPos !== null && !routes.has(climbDownPos.x + "," + climbDownPos.y)) {
                            queue.push(climbDownPos);
                            routes.set(climbDownPos.x + "," + climbDownPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbDown()]));
                        }
                    }
                }
            }

            let bestTargetScore = -Infinity;
            // let bestTargetPos: { x: number, y: number } | null = null;
            let bestTargetMove: Move | null = null;
            for (const [posStr, moves] of routes) {
                const [rx, ry] = posStr.split(",").map(Number);

                if (world.willFall(rx, ry) || moves.length != 0 && moves[moves.length - 1] !== null && moves[moves.length - 1]!.type == "_falling") continue;

                let hp = 0;
                let food = 0;

                let fallDist = 0;
                for (const move of moves) {
                    if (move !== null && move.type == "_falling") {
                        fallDist++;
                    } else {
                        hp -= fallDist > 2 ? (fallDist - 2) * 2 + 1 : 0;
                        fallDist = 0;
                    }
                }

                if (hp < 0) continue;

                for (let oy = ry + 1; oy >= ry - 1; oy--) {
                    for (let ox = rx - 1; ox <= rx + 1; ox++) {
                        if (!world.isReachableFrom(rx, ry, ox, oy)) continue;

                        const cell = world.getCell(ox, oy);
                        if (cell == Cell.LargeGrassTufts) {
                            hp += 2;
                            food += 50;
                        } else if ([Cell.SmallGrassTufts, Cell.GrassyDirt].includes(cell)) {
                            hp += 1;
                            food += 25;
                        } else if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) {
                            food += 20;
                        }
                    }
                }

                const score = food + Math.min(20 - self.hp, hp) * 2;
                if (score > bestTargetScore) {
                    bestTargetScore = score;
                    // bestTargetPos = { x: rx, y: ry };
                    bestTargetMove = (moves[0] ?? null) as typeof bestTargetMove;
                }
            }

            if (bestTargetMove === null && minThreatDist < 8) {
                const nearby = others.find(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y));
                if (nearby !== undefined) return biteByCreature(nearby.id);

                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }

                if (world.isSolid(x, y - 1) && !world.isRock(x, y - 1)) return dig(x, y - 1);
            }

            if (bestTargetMove === null) {
                if (world.isSolid(x - 1, y) && world.isSolid(x - 1, y + 1) && (!world.isSolid(x - 2, y + 1) || !world.isSolid(x - 2, y + 2) || !world.isSolid(x - 2, y)) && world.isReachableFrom(x, y, x - 1, y + 1)) {
                    return dig(x - 1, y + 1);
                }
                if (world.isSolid(x + 1, y) && world.isSolid(x + 1, y + 1) && (!world.isSolid(x + 2, y + 1) || !world.isSolid(x + 2, y + 2) || !world.isSolid(x + 2, y)) && world.isReachableFrom(x, y, x + 1, y + 1)) {
                    return dig(x + 1, y + 1);
                }
                // if (world.isSolid(x, y + 1) && !world.isRock(x, y + 2) && (world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1) || world.isSolid(x - 1, y) || world.isSolid(x + 1, y))) {
                //     return dig(x, y + 1);
                // }
                if (world.isSolid(x - 1, y) && !world.isSolid(x - 2, y) && !world.isSolid(x - 2, y - 2) && world.isSolid(x, y - 1)) {
                    return dig(x - 1, y);
                }
                if (world.isSolid(x + 1, y) && !world.isSolid(x + 2, y) && !world.isSolid(x + 2, y - 2) && world.isSolid(x, y - 1)) {
                    return dig(x + 1, y);
                }
                if (self.carryingRocks != 0) {
                    if (!world.isSolid(x - 1, y - 1) && !world.isSolid(x - 1, y - 2) && world.isReachableFrom(x, y, x - 1, y - 1)) return dropRock(x - 1, y - 1);
                    if (!world.isSolid(x + 1, y - 1) && !world.isSolid(x + 1, y - 2) && world.isReachableFrom(x, y, x + 1, y - 1)) return dropRock(x + 1, y - 1);
                }
            }

            return bestTargetMove;
        }
    },
    {
        id: "tunneler",
        run(self, others, world, tickCtr): Move | null {
            const { x, y } = self.pos;

            if (!("stoneY" in self.ctx)) {
                self.ctx.stoneY = y;
                yloop: for (let sy = y; sy >= 1; sy--) {
                    let foundStone = false;
                    for (let sx = 0; sx < world.width; sx++) {
                        const cell = world.getCell(sx, sy);
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt, Cell.Dirt, Cell.BarrenDirt].includes(cell) || cellIsRock(cell)) {
                            continue yloop;
                        }
                        if ([Cell.Stone, Cell.MossyStone, Cell.ChippedStone, Cell.MossyChippedStone].includes(cell)) {
                            foundStone = true;
                        }
                    }
                    if (foundStone) {
                        self.ctx.stoneY = sy;
                        break;
                    }
                }
            }

            const stoneY: number = self.ctx.stoneY;

            if (!("stage" in self.ctx)) self.ctx.stage = 0;

            // If near someone, bite
            const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            // If hungry, try to eat
            if (self.fullness < 180 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 185) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            const stones = [Cell.Stone, Cell.MossyStone, Cell.ChippedStone, Cell.MossyChippedStone, Cell.Bedrock, Cell.MossyBedrock];

            function checkDiamond(x: number, y: number, ix: number, _iy: number): boolean {
                // if (iy != -1) {
                //     if (!stones.includes(world.getCell(x, y - 2))) return false;
                //     for (let o = -1; o <= 1; o++) {
                //         if (o == ix) continue;
                //         if (!stones.includes(world.getCell(x + o, y - 1))) return false;
                //     }
                // }
                // for (let o = ix == -1 ? 1 : -2; o <= (ix == 1 ? -1 : 2); o++) {
                //     if (o == 0) continue;
                //     if (!stones.includes(world.getCell(x + o, y))) return false;
                // }
                // if (iy != 1) {
                //     for (let o = -1; o <= 1; o++) {
                //         if (o == ix) continue;
                //         if (!stones.includes(world.getCell(x + o, y + 1))) return false;
                //     }
                //     if (!stones.includes(world.getCell(x, y + 2))) return false;
                // }
                // return true;
                if (ix == 0) {
                    for (let o = -2; o <= 2; o++) {
                        if (o == 0) continue;
                        if (!stones.includes(world.getCell(x + o, y))) return false;
                    }
                    if (stones.includes(x, y - 1) && (!stones.includes(x - 1, y - 1) || !stones.includes(x + 1, y - 1))) return false;
                    if (stones.includes(x, y + 1) && (!stones.includes(x - 1, y + 1) || !stones.includes(x + 1, y + 1))) return false;
                } else {
                    for (let o = -2; o <= 2; o++) {
                        if (o == 0) continue;
                        if (!stones.includes(world.getCell(x, y + o))) return false;
                    }
                    if (stones.includes(x - 1, y) && (!stones.includes(x - 1, y - 1) || !stones.includes(x - 1, y + 1))) return false;
                    if (stones.includes(x + 1, y) && (!stones.includes(x + 1, y - 1) || !stones.includes(x + 1, y + 1))) return false;
                }

                return true;
            }

            function findDigDirs(x: number, y: number): Move[] {
                const digDirs: Move[] = [];

                if (stones.includes(world.getCell(x, y - 1))) {
                    if (stones.includes(world.getCell(x - 1, y))) {
                        if (checkDiamond(x - 1, y, 1, 0)) digDirs.push(dig(x - 1, y));
                    }

                    if (stones.includes(world.getCell(x + 1, y))) {
                        if (checkDiamond(x + 1, y, -1, 0)) digDirs.push(dig(x + 1, y));
                    }

                    if (stones.includes(world.getCell(x, y - 2)) && stones.includes(world.getCell(x, y + 1)) && ![Cell.Bedrock, Cell.MossyBedrock].includes(world.getCell(x, y - 1))) {
                        if (checkDiamond(x, y - 1, 0, 1)) digDirs.push(dig(x, y - 1));
                    }
                }

                if (!stones.includes(world.getCell(x, y + 1)) && stones.includes(world.getCell(x, y + 2))) {
                    if (stones.includes(world.getCell(x - 1, y + 1))) {
                        if (checkDiamond(x - 1, y + 1, 1, 0)) digDirs.push(dig(x - 1, y + 1));
                    }

                    if (stones.includes(world.getCell(x + 1, y + 1))) {
                        if (checkDiamond(x + 1, y + 1, -1, 0)) digDirs.push(dig(x + 1, y + 1));
                    }
                }

                if (stones.includes(world.getCell(x, y + 1)) && stones.includes(world.getCell(x, y + 2))) {
                    if (checkDiamond(x, y + 1, 0, -1)) digDirs.push(dig(x, y + 1));
                }

                return digDirs;
            }

            for (let i = 0; i < 4; i++) {
                switch (self.ctx.stage) {
                    case 0: {
                        // In stage 0, the goal is to dig straight down

                        const cellBeneath = world.getCell(self.pos.x, self.pos.y - 1);

                        // If in a shaft and not at the bottom, go down
                        if (!cellIsSolid(cellBeneath)) {
                            return climbDown();
                        }
                        // Pick up rock if it's in the way
                        if (cellBeneath == Cell.Rock) {
                            return dig(self.pos.x, self.pos.y - 1);
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

                        // If we've reached this point, we're at stage 2 if not hungry
                        self.ctx.stage = self.fullness < 100 ? 1 : 2;

                        break;
                    }
                    case 1: {
                        // In stage 1, the goal is to move up our tunnel until we hit dirt

                        // Check four spaces around us for dirt
                        for (const offset of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
                            const cell = world.getCell(self.pos.x + offset[0], self.pos.y + offset[1]);
                            if ([Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt].includes(cell) || cellIsRock(cell)) {
                                // We've found dirt! Move back to stage 0
                                self.ctx.stage = 0;
                                break;
                            }
                        }

                        if (self.ctx.stage == 1) {
                            return climbUp();
                        }

                        break;
                    }
                    // @ts-expect-error
                    case 2: {
                        if (self.fullness < 100) {
                            self.ctx.stage = 3;
                            break;
                        }

                        const digDirs = findDigDirs(x, y);

                        if (digDirs.length != 0) {
                            return digDirs[Math.floor(Math.random() * digDirs.length)];
                        }

                        const queue: ({ x: number, y: number, falling: boolean })[] = [{ ...self.pos, falling: false }];
                        const routes: Map<string, (Move | { type: "_falling" })[]> = new Map([[x + "," + y, []]]);

                        for (let i = 0; i < 128; i++) {
                            if (!queue.length) break;

                            const pos = queue.shift()!;

                            if (world.willFall(pos.x, pos.y) || pos.falling && !world.isSolid(pos.x, pos.y - 1)) {
                                queue.push({ x: pos.x, y: pos.y - 1, falling: true });
                                routes.set(pos.x + "," + (pos.y - 1), routes.get(pos.x + "," + pos.y)!.concat([{ type: "_falling" }]));
                            } else {
                                const leftPos = world.simulateLeft(pos.x, pos.y);
                                const rightPos = world.simulateRight(pos.x, pos.y);
                                const climbUpPos = world.simulateClimbUp(pos.x, pos.y);
                                const climbDownPos = world.simulateClimbDown(pos.x, pos.y);

                                if (leftPos !== null && !routes.has(leftPos.x + "," + leftPos.y)) {
                                    queue.push(leftPos);
                                    routes.set(leftPos.x + "," + leftPos.y, routes.get(pos.x + "," + pos.y)!.concat([left()]));
                                }
                                if (rightPos !== null && !routes.has(rightPos.x + "," + rightPos.y)) {
                                    queue.push(rightPos);
                                    routes.set(rightPos.x + "," + rightPos.y, routes.get(pos.x + "," + pos.y)!.concat([right()]));
                                }
                                if (climbUpPos !== null && !routes.has(climbUpPos.x + "," + climbUpPos.y)) {
                                    queue.push(climbUpPos);
                                    routes.set(climbUpPos.x + "," + climbUpPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbUp()]));
                                }
                                if (climbDownPos !== null && !routes.has(climbDownPos.x + "," + climbDownPos.y)) {
                                    queue.push(climbDownPos);
                                    routes.set(climbDownPos.x + "," + climbDownPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbDown()]));
                                }
                            }
                        }

                        let shortestScore = Infinity;
                        let shortestMove: Move | null = null;
                        for (const [posStr, moves] of routes) {
                            const [rx, ry] = posStr.split(",").map(Number);

                            if (world.willFall(rx, ry) || moves.length != 0 && moves[moves.length - 1] !== null && moves[moves.length - 1]!.type == "_falling") continue;

                            if (findDigDirs(rx, ry).length == 0) continue;

                            let hp = 0;

                            let fallDist = 0;
                            for (const move of moves) {
                                if (move !== null && move.type == "_falling") {
                                    fallDist++;
                                } else if (fallDist != 0) {
                                    hp -= fallDist > 2 ? (fallDist - 2) * 2 + 1 : 0;
                                    fallDist = 0;
                                }
                            }

                            if (hp < 0) continue;

                            if (moves.length < shortestScore) {
                                shortestScore = moves.length;
                                shortestMove = (moves[0] ?? null) as typeof shortestMove;
                            }
                        }

                        if (shortestMove !== null) return shortestMove;
                    }
                    case 3: {
                        if (self.fullness >= 175 && y <= stoneY && tickCtr < 4000) {
                            self.ctx.stage = 2;
                            break;
                        }

                        const queue: ({ x: number, y: number, falling: boolean })[] = [{ ...self.pos, falling: false }];
                        const routes: Map<string, (Move | { type: "_falling" })[]> = new Map([[x + "," + y, []]]);

                        for (let i = 0; i < 128; i++) {
                            if (!queue.length) break;

                            const pos = queue.shift()!;

                            if (world.willFall(pos.x, pos.y) || pos.falling && !world.isSolid(pos.x, pos.y - 1)) {
                                queue.push({ x: pos.x, y: pos.y - 1, falling: true });
                                routes.set(pos.x + "," + (pos.y - 1), routes.get(pos.x + "," + pos.y)!.concat([{ type: "_falling" }]));
                            } else {
                                const leftPos = world.simulateLeft(pos.x, pos.y);
                                const rightPos = world.simulateRight(pos.x, pos.y);
                                const climbUpPos = world.simulateClimbUp(pos.x, pos.y);
                                const climbDownPos = world.simulateClimbDown(pos.x, pos.y);

                                if (leftPos !== null && !routes.has(leftPos.x + "," + leftPos.y)) {
                                    queue.push(leftPos);
                                    routes.set(leftPos.x + "," + leftPos.y, routes.get(pos.x + "," + pos.y)!.concat([left()]));
                                }
                                if (rightPos !== null && !routes.has(rightPos.x + "," + rightPos.y)) {
                                    queue.push(rightPos);
                                    routes.set(rightPos.x + "," + rightPos.y, routes.get(pos.x + "," + pos.y)!.concat([right()]));
                                }
                                if (climbUpPos !== null && !routes.has(climbUpPos.x + "," + climbUpPos.y)) {
                                    queue.push(climbUpPos);
                                    routes.set(climbUpPos.x + "," + climbUpPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbUp()]));
                                }
                                if (climbDownPos !== null && !routes.has(climbDownPos.x + "," + climbDownPos.y)) {
                                    queue.push(climbDownPos);
                                    routes.set(climbDownPos.x + "," + climbDownPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbDown()]));
                                }
                            }
                        }

                        let bestTargetScore = -Infinity;
                        let bestTargetPos: { x: number, y: number } | null = null;
                        let bestTargetMove: Move | null = null;
                        for (const [posStr, moves] of routes) {
                            const [rx, ry] = posStr.split(",").map(Number);

                            if (world.willFall(rx, ry) || moves.length != 0 && moves[moves.length - 1] !== null && moves[moves.length - 1]!.type == "_falling") continue;

                            let hp = 0;
                            let food = 0;

                            let fallDist = 0;
                            for (const move of moves) {
                                if (move !== null && move.type == "_falling") {
                                    fallDist++;
                                } else if (fallDist != 0) {
                                    hp -= fallDist > 2 ? (fallDist - 2) * 2 + 1 : 0;
                                    fallDist = 0;
                                }
                            }

                            if (hp < 0 && self.hp + hp <= 0) continue;

                            for (let oy = ry + 1; oy >= ry - 1; oy--) {
                                for (let ox = rx - 1; ox <= rx + 1; ox++) {
                                    if (!world.isReachableFrom(rx, ry, ox, oy)) continue;

                                    const cell = world.getCell(ox, oy);
                                    if (cell == Cell.LargeGrassTufts) {
                                        hp += 2;
                                        food += 50;
                                    } else if ([Cell.SmallGrassTufts, Cell.GrassyDirt].includes(cell)) {
                                        hp += 1;
                                        food += 25;
                                    } else if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(cell)) {
                                        food += 20;
                                    }
                                }
                            }

                            const score = food + Math.min(20 - self.hp, hp) * 2;
                            if (bestTargetPos === null || ry <= stoneY && (bestTargetPos.y > stoneY || score > bestTargetScore)) {
                                bestTargetScore = score;
                                bestTargetPos = { x: rx, y: ry };
                                bestTargetMove = (moves[0] ?? null) as typeof bestTargetMove;
                            }
                        }

                        return bestTargetMove;
                    }
                }
            }

            return null;
        }
    },
    {
        id: "trapper",
        run(self, others, world) {
            const { x, y } = self.pos;

            if (self.carryingRocks == 0) {
                // Find rock

                const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
                if (nearby !== undefined) return biteByCreature(nearby.id);

                if (self.fullness < 180 || self.hp < 20) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }
                if (self.fullness < 185) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }

                const rocks: ({ x: number, y: number })[] = [];
                for (let rx = x - 10; rx <= x + 10; rx++) {
                    for (let ry = 1; ry <= y; ry++) {
                        if (world.getCell(rx, ry) == Cell.Rock) {
                            rocks.push({ x: rx, y: ry });
                        }
                    }
                }
                rocks.sort((a, b) => world.dist(x, y, a.x, a.y) - world.dist(x, y, b.x, b.y));

                if (rocks.length != 0) {
                    const rock = rocks[0];

                    if (rock.y < y) {
                        if (world.isSolid(x, y - 1)) {
                            if (world.getCell(x, y - 1) == Cell.Rock) {
                                return dig(x, y - 1);
                            } else {
                                return dig(x, y - 1);
                            }
                        } else {
                            return climbDown();
                        }
                    } else {
                        if (rock.x < x) {
                            if (world.getCell(x - 1, y) == Cell.Rock) {
                                return dig(x - 1, y);
                            }

                            if (world.isSolid(x - 1, y)) {
                                return dig(x - 1, y);
                            }

                            return left();
                        } else {
                            if (world.getCell(x + 1, y) == Cell.Rock) {
                                return dig(x + 1, y);
                            }

                            if (world.isSolid(x + 1, y)) {
                                return dig(x + 1, y);
                            }

                            return right();
                        }
                    }
                } else {
                    const simRight = world.simulateRight(x, y);
                    if (simRight !== null && (!simRight.falling || world.isSolid(x + 1, y - 3))) {
                        return right();
                    }
                    if (world.isSolid(x + 1, y)) {
                        if (world.isSolid(x, y + 1)) {
                            return dig(x, y + 1);
                        } else {
                            return dig(x + 1, y + 1);
                        }
                    }
                    return dig(x, y - 1);
                }
            } else {
                const fragiles = [Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt, Cell.ChippedStone, Cell.MossyChippedStone];

                if (fragiles.includes(x - 1, y - 1) && others.some(o => (o.pos.x == x - 1 || o.pos.x == world.width - 1 && x == 0) && o.pos.y == y)) {
                    return dig(x - 1, y - 1);
                }
                if (fragiles.includes(x + 1, y - 1) && others.some(o => (o.pos.x == x + 1 || o.pos.x == 0 && x == world.width - 1) && o.pos.y == y)) {
                    return dig(x + 1, y - 1);
                }
                if (fragiles.includes(x - 1, y) && others.some(o => (o.pos.x == x - 1 || o.pos.x == world.width - 1 && x == 0) && o.pos.y == y + 1)) {
                    return dig(x - 1, y);
                }
                if (fragiles.includes(x + 1, y) && others.some(o => (o.pos.x == x + 1 || o.pos.x == 0 && x == world.width - 1) && o.pos.y == y + 1)) {
                    return dig(x + 1, y);
                }
                if (!world.isSolid(x - 1, y) && others.some(o => (o.pos.x == x - 1 || o.pos.x == world.width - 1 && x == 0) && o.pos.y == y - 1)) {
                    return dropRock(x - 1, y);
                }
                if (!world.isSolid(x + 1, y) && others.some(o => (o.pos.x == x + 1 || o.pos.x == 0 && x == world.width - 1) && o.pos.y == y - 1)) {
                    return dropRock(x + 1, y);
                }

                const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
                if (nearby !== undefined) return biteByCreature(nearby.id);

                if (self.fullness < 180 || self.hp < 20) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }
                if (self.fullness < 185) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }

                const queue: ({ x: number, y: number, falling: boolean })[] = [{ ...self.pos, falling: false }];
                const routes: Map<string, (Move | { type: "_falling" })[]> = new Map([[x + "," + y, []]]);
                for (let i = 0; i < 128; i++) {
                    if (!queue.length) break;

                    const pos = queue.shift()!;

                    if (world.willFall(pos.x, pos.y) || pos.falling && !world.isSolid(pos.x, pos.y - 1)) {
                        queue.push({ x: pos.x, y: pos.y - 1, falling: true });
                        routes.set(pos.x + "," + (pos.y - 1), routes.get(pos.x + "," + pos.y)!.concat([{ type: "_falling" }]));
                    } else {
                        const leftPos = world.simulateLeft(pos.x, pos.y);
                        const rightPos = world.simulateRight(pos.x, pos.y);
                        const climbUpPos = world.simulateClimbUp(pos.x, pos.y);
                        const climbDownPos = world.simulateClimbDown(pos.x, pos.y);

                        if (leftPos !== null && !routes.has(leftPos.x + "," + leftPos.y)) {
                            queue.push(leftPos);
                            routes.set(leftPos.x + "," + leftPos.y, routes.get(pos.x + "," + pos.y)!.concat([left()]));
                        }
                        if (rightPos !== null && !routes.has(rightPos.x + "," + rightPos.y)) {
                            queue.push(rightPos);
                            routes.set(rightPos.x + "," + rightPos.y, routes.get(pos.x + "," + pos.y)!.concat([right()]));
                        }
                        if (climbUpPos !== null && !routes.has(climbUpPos.x + "," + climbUpPos.y)) {
                            queue.push(climbUpPos);
                            routes.set(climbUpPos.x + "," + climbUpPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbUp()]));
                        }
                        if (climbDownPos !== null && !routes.has(climbDownPos.x + "," + climbDownPos.y)) {
                            queue.push(climbDownPos);
                            routes.set(climbDownPos.x + "," + climbDownPos.y, routes.get(pos.x + "," + pos.y)!.concat([climbDown()]));
                        }
                    }
                }

                let bestTargetScore = -Infinity;
                let bestTargetMove: Move | null = null;
                for (const [posStr, moves] of routes) {
                    const [rx, ry] = posStr.split(",").map(Number);

                    if (world.willFall(rx, ry) || moves.length != 0 && moves[moves.length - 1] !== null && moves[moves.length - 1]!.type == "_falling") continue;

                    let hp = 0;
                    let food = 0;

                    let fallDist = 0;
                    for (const move of moves) {
                        if (move !== null && move.type == "_falling") {
                            fallDist++;
                        } else if (fallDist != 0) {
                            hp -= fallDist > 2 ? (fallDist - 2) * 2 + 1 : 0;
                            fallDist = 0;
                        }
                    }

                    if (self.hp + hp <= 0) continue;

                    for (let oy = ry + 1; oy >= ry - 1; oy--) {
                        for (let ox = rx - 1; ox <= rx + 1; ox++) {
                            if (!world.isReachableFrom(rx, ry, ox, oy)) continue;

                            const cell = world.getCell(ox, oy);
                            if (cell == Cell.LargeGrassTufts) {
                                hp += 2;
                                food += 50;
                            } else if ([Cell.SmallGrassTufts, Cell.GrassyDirt].includes(cell)) {
                                hp += 1;
                                food += 25;
                            }
                        }
                    }

                    const score = food + Math.min(20 - self.hp, hp) * 2;
                    if (score > bestTargetScore) {
                        bestTargetScore = score;
                        bestTargetMove = (moves[0] ?? null) as typeof bestTargetMove;
                    }
                }

                return bestTargetMove;
            }
        }
    },
    {
        id: "backfiller",
        run(self, others, world): Move | null {
            const { x, y } = self.pos;

            if (self.carryingRocks != 0) {
                const nearby = others.find(o => world.isXAdjacent(o.pos.x, x) && o.pos.y == y - 1 && !world.isSolid(o.pos.x, o.pos.y + 1));
                if (nearby !== undefined) return dropRock(nearby.pos.x, nearby.pos.y + 1);
            }
            {
                const nearby = others.find(o => world.isXAdjacent(o.pos.x, x) && (o.pos.y == y || o.pos.y == y + 1) && [Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt, Cell.ChippedStone, Cell.MossyChippedStone].includes(world.getCell(o.pos.x, o.pos.y - 1)));
                if (nearby !== undefined) return dig(nearby.pos.x, nearby.pos.y - 1);
            }
            {
                const nearby = others.find(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y));
                if (nearby !== undefined) return biteByCreature(nearby.id);
            }

            if (self.fullness < 180 || self.hp < 20) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }
            if (self.fullness < 185) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            function withDig(world: World, x: number, y: number): World {
                const grid = [...world.getGrid()];
                grid[y] = [...grid[y]];
                const nWorld = new World(world.width, world.groundHeight, grid, world.getBgGrid());
                nWorld.setCell(x, y, Cell.Empty);
                return nWorld;
            }

            if (self.carryingRocks != 0) {
                if (!world.isSolid(x - 1, y) && !world.isSolid(x - 1, y - 1) && !world.isSolid(x - 1, y - 2)) {
                    return dropRock(x - 1, y - 1);
                }
                if (!world.isSolid(x + 1, y) && !world.isSolid(x + 1, y - 1) && !world.isSolid(x + 1, y - 2)) {
                    return dropRock(x + 1, y - 1);
                }

                const queue: ({ x: number, y: number, falling: boolean, world: World, cost: number })[] = [{ ...self.pos, falling: false, world, cost: 0 }];
                const routes: Map<string, (Move | { type: "_falling" })[]> = new Map([[x + "," + y, []]]);
                for (let i = 0; i < 128;) {
                    if (!queue.length) break;

                    const pos = queue.shift()!;
                    const past = routes.get(pos.x + "," + pos.y + (pos.falling ? "," : ""))!;

                    if (pos.world.willFall(pos.x, pos.y) || pos.falling && !pos.world.isSolid(pos.x, pos.y - 1)) {
                        if (!routes.get(pos.x + "," + (pos.y - 1) + ",")) {
                            queue.push({ x: pos.x, y: pos.y - 1, falling: true, world: pos.world, cost: pos.cost + 1 });
                            routes.set(pos.x + "," + (pos.y - 1) + ",", past.concat([{ type: "_falling" }]));
                        }
                    } else {
                        const leftPos = pos.world.simulateLeft(pos.x, pos.y);
                        const rightPos = pos.world.simulateRight(pos.x, pos.y);
                        const climbUpPos = pos.world.simulateClimbUp(pos.x, pos.y);
                        const climbDownPos = pos.world.simulateClimbDown(pos.x, pos.y);

                        if (leftPos !== null && !routes.has(leftPos.x + "," + leftPos.y)) {
                            queue.push({ ...leftPos, world: pos.world, cost: pos.cost + 1 });
                            routes.set(leftPos.x + "," + leftPos.y, past.concat([left()]));
                        }
                        if (rightPos !== null && !routes.has(rightPos.x + "," + rightPos.y)) {
                            queue.push({ ...rightPos, world: pos.world, cost: pos.cost + 1 });
                            routes.set(rightPos.x + "," + rightPos.y, past.concat([right()]));
                        }
                        if (climbUpPos !== null && !routes.has(climbUpPos.x + "," + climbUpPos.y)) {
                            queue.push({ ...climbUpPos, world: pos.world, cost: pos.cost + 1 });
                            routes.set(climbUpPos.x + "," + climbUpPos.y, past.concat([climbUp()]));
                        }
                        if (climbDownPos !== null && !routes.has(climbDownPos.x + "," + climbDownPos.y)) {
                            queue.push({ ...climbDownPos, world: pos.world, cost: pos.cost + 1 });
                            routes.set(climbDownPos.x + "," + climbDownPos.y, past.concat([climbDown()]));
                        }

                        const oneHits = [Cell.GrassyDirt, Cell.BarrenDirt, Cell.Dirt, Cell.ChippedStone, Cell.MossyChippedStone];
                        const twoHits = [Cell.Stone, Cell.MossyStone];

                        const cellUp = pos.world.getCell(pos.x, pos.y + 1);
                        const cellDown = pos.world.getCell(pos.x, pos.y + 1);
                        const cellLeft = pos.world.getCell(pos.x, pos.y + 1);
                        const cellRight = pos.world.getCell(pos.x, pos.y + 1);
                        if ((oneHits.includes(cellUp) || twoHits.includes(cellUp)) && !pos.world.isRock(pos.x, pos.y + 2) && pos.world.isSolid(pos.x - 1, pos.y + 1) && pos.world.isSolid(pos.x + 1, pos.y + 1) && !routes.has(pos.x + "," + (pos.y + 1))) {
                            queue.push({ x: pos.x, y: pos.y + 1, world: withDig(pos.world, pos.x, pos.y + 1), falling: false, cost: pos.cost + (oneHits.includes(cellUp) ? 1 : 2) });
                            routes.set(pos.x + "," + (pos.y + 1), past.concat([dig(pos.x, pos.y + 1), climbUp()]));
                        }
                        if (oneHits.includes(cellDown) || twoHits.includes(cellDown)) {
                            const falling = !pos.world.isSolid(pos.x - 1, y) || !pos.world.isSolid(pos.x + 1, y);
                            queue.push({ x: pos.x, y: pos.y - 1, world: withDig(pos.world, pos.x, pos.y - 1), falling, cost: pos.cost + (oneHits.includes(cellDown) ? 1 : 2) });
                            routes.set(pos.x + "," + (pos.y - 1), past.concat([dig(pos.x, pos.y - 1), falling ? { type: "_falling" } : climbDown()]));
                        }
                    }
                }

                console.log(queue, routes);

                let bestTargetScore = -Infinity;
                let bestTargetMove: Move | null = null;
                for (const [posStr, moves] of routes) {
                    const [rx, ry] = posStr.split(",").map(Number);

                    if (world.willFall(rx, ry) || moves.length != 0 && moves[moves.length - 1] !== null && moves[moves.length - 1]!.type == "_falling") continue;

                    let hp = 0;
                    let food = 0;

                    let fallDist = 0;
                    for (const move of moves) {
                        if (move !== null && move.type == "_falling") {
                            fallDist++;
                        } else if (fallDist != 0) {
                            hp -= fallDist > 2 ? (fallDist - 2) * 2 + 1 : 0;
                            fallDist = 0;
                        }
                    }

                    if (self.hp + hp <= 0) continue;

                    for (let oy = ry + 1; oy >= ry - 1; oy--) {
                        for (let ox = rx - 1; ox <= rx + 1; ox++) {
                            if (!world.isReachableFrom(rx, ry, ox, oy)) continue;

                            const cell = world.getCell(ox, oy);
                            if (cell == Cell.LargeGrassTufts) {
                                hp += 2;
                                food += 50;
                            } else if ([Cell.SmallGrassTufts, Cell.GrassyDirt].includes(cell)) {
                                hp += 1;
                                food += 25;
                            }
                        }
                    }

                    const score = food + Math.min(20 - self.hp, hp) * 2;
                    if (score > bestTargetScore) {
                        bestTargetScore = score;
                        bestTargetMove = (moves[0] ?? null) as typeof bestTargetMove;
                    }
                }

                return bestTargetMove;
            } else {
                const rocks: ({ x: number, y: number })[] = [];
                for (let rx = x - 10; rx <= x + 10; rx++) {
                    for (let ry = 1; ry <= y; ry++) {
                        if (world.getCell(rx, ry) == Cell.Rock) {
                            rocks.push({ x: rx, y: ry });
                        }
                    }
                }
                rocks.sort((a, b) => world.dist(x, y, a.x, a.y) - world.dist(x, y, b.x, b.y));

                if (rocks.length != 0) {
                    const rock = rocks[0];

                    if (rock.y < y) {
                        if (world.isSolid(x, y - 1)) {
                            if (world.getCell(x, y - 1) == Cell.Rock) {
                                return dig(x, y - 1);
                            } else {
                                return dig(x, y - 1);
                            }
                        } else {
                            return climbDown();
                        }
                    } else {
                        if (rock.x < x) {
                            if (world.getCell(x - 1, y) == Cell.Rock) {
                                return dig(x - 1, y);
                            }

                            if (world.isSolid(x - 1, y)) {
                                return dig(x - 1, y);
                            }

                            return left();
                        } else {
                            if (world.getCell(x + 1, y) == Cell.Rock) {
                                return dig(x + 1, y);
                            }

                            if (world.isSolid(x + 1, y)) {
                                return dig(x + 1, y);
                            }

                            return right();
                        }
                    }
                } else {
                    const simRight = world.simulateRight(x, y);
                    if (simRight !== null && (!simRight.falling || world.isSolid(x + 1, y - 3))) {
                        return right();
                    }
                    if (world.isSolid(x + 1, y)) {
                        if (world.isSolid(x, y + 1)) {
                            return dig(x, y + 1);
                        } else {
                            return dig(x + 1, y + 1);
                        }
                    }
                    return dig(x, y - 1);
                }
            }
        }
    },
    {
        id: "trencher",
        run(self, others, world) {
            const { x, y } = self.pos;

            if (!("stage" in self.ctx)) {
                const width = Math.round(1.1 ** (Math.random() ** 2 * 16) * 20);

                self.ctx.stage = 0;
                self.ctx.boundLeft = x;
                self.ctx.boundRight = x + width;
                self.ctx.boundRightWrapped = self.ctx.boundRight % world.width;
            }

            if (self.carryingRocks != 0) {
                const crushable = others.find(o => o.pos.y == y - 1 && o.pos.x != x && world.isReachableFrom(x, y, o.pos.x, o.pos.y + 1));
                if (crushable !== undefined) return dropRock(crushable.pos.x, crushable.pos.y + 1);
            } else {
                const rockUnderminable = others.find(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y - 1) && (o.pos.x != x || o.pos.y != y) && world.getCell(o.pos.x, o.pos.y - 1) == Cell.Rock);
                if (rockUnderminable !== undefined) return dig(rockUnderminable.pos.x, rockUnderminable.pos.y - 1);
            }
            const underminable = others.find(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y - 1) && (o.pos.x != x || o.pos.y != y) && world.isSolid(o.pos.x, o.pos.y - 1) && !world.isRock(o.pos.x, o.pos.y - 1) && ![Cell.Stone, Cell.MossyStone, Cell.Bedrock, Cell.MossyBedrock].includes(world.getCell(o.pos.x, o.pos.y - 1)));
            if (underminable !== undefined) return dig(underminable.pos.x, underminable.pos.y - 1);
            const nearby = others.find(o => world.isReachableFrom(x, y, o.pos.x, o.pos.y));
            if (nearby !== undefined) return biteByCreature(nearby.id);

            if (self.ctx.stage == 0) {
                if (self.fullness < 190 || self.hp < 20) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }
            } else {
                if (self.fullness < 190 || self.hp < 20) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }
                if (self.fullness < 80 || self.hp < 10) {
                    for (let oy = y + 1; oy >= y - 1; oy--) {
                        for (let ox = x - 1; ox <= x + 1; ox++) {
                            if (world.getCell(ox, oy) == Cell.GrassyDirt && world.isReachableFrom(x, y, ox, oy)) {
                                return eat(ox, oy);
                            }
                        }
                    }
                }
            }
            if (self.fullness < 190) {
                for (let oy = y + 1; oy >= y - 1; oy--) {
                    for (let ox = x - 1; ox <= x + 1; ox++) {
                        if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                            return eat(ox, oy);
                        }
                    }
                }
            }

            if (self.ctx.stage == 0) {
                // Destroy the highest point in the trench bounds

                let topSolidY = -Infinity;
                let tsyXs = [];

                for (let sx = self.ctx.boundLeft; sx <= self.ctx.boundRight; sx++) {
                    const tsy = world.findTopSolidY(sx);

                    if (tsy > topSolidY) {
                        topSolidY = tsy;
                        tsyXs = [sx];
                    } else if (tsy == topSolidY) {
                        tsyXs.push(sx);
                    }
                }

                if (topSolidY <= world.groundHeight * 0.75 + 1) {
                    self.ctx.stage = 1;
                } else {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (x == self.ctx.boundLeft && ox == -1 || x == self.ctx.boundRightWrapped && ox == 1) continue;

                        if (world.isSolid(x + ox, topSolidY) && world.isReachableFrom(x, y, x + ox, topSolidY)) {
                            return dig(x + ox, topSolidY);
                        }
                    }

                    const tx = tsyXs.sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];

                    if (tx < x) {
                        if (world.isSolid(x - 1, y)) {
                            if (world.isSolid(x, y + 1)) return dig(x, y + 1);
                            if (world.isSolid(x - 1, y + 1)) {
                                if (world.getCell(x - 1, y + 1) == Cell.Rock) {
                                    return dig(x - 1, y + 1);
                                }
                                return dig(x - 1, y + 1);
                            }
                        } else if (!world.isSolid(x - 1, y - 1)) {
                            if (world.findTopSolidY(x - 1) < y - 3) {
                                self.ctx.boundLeft = x;
                                return null;
                            }

                            return dig(x, y - 1);
                        }
                        return left();
                    } else if (tx > x) {
                        if (world.isSolid(x + 1, y)) {
                            if (world.isSolid(x, y + 1)) return dig(x, y + 1);
                            if (world.isSolid(x + 1, y + 1)) {
                                if (world.getCell(x + 1, y + 1) == Cell.Rock) {
                                    return dig(x + 1, y + 1);
                                }
                                return dig(x + 1, y + 1);
                            }
                        } else if (!world.isSolid(x + 1, y - 1)) {
                            if (world.findTopSolidY(x + 1) < y - 3) {
                                self.ctx.boundRight = x < self.ctx.boundLeft ? x + world.width : x;
                                self.ctx.boundRightWrapped = x;
                                return null;
                            }

                            return dig(x, y - 1);
                        }
                        return right();
                    } else {
                        if (world.isSolid(x, y + 1)) return dig(x, y + 1);
                        if (world.isSolid(x - 1, y + 1) && world.isSolid(x + 1, y + 1)) return climbUp();
                        if (world.isSolid(x - 1, y)) {
                            if (world.isSolid(x, y + 1)) return dig(x, y + 1);
                            if (world.isSolid(x - 1, y + 1)) return dig(x - 1, y + 1);
                        } else if (!world.isSolid(x - 1, y - 1)) {
                            if (world.findTopSolidY(x - 1) < y - 3) {
                                self.ctx.boundLeft = x;
                                return null;
                            }

                            return dig(x, y - 1);
                        }
                        return left();
                    }
                }
            }

            if (self.ctx.stage == 1 && x == self.ctx.boundLeft) {
                self.ctx.stage = 2;
            } else if (self.ctx.stage == 2 && x == self.ctx.boundRightWrapped) {
                self.ctx.stage = 1;
            }

            if (self.ctx.stage == 1) return left();
            return right();
        }
    },
];