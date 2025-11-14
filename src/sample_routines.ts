import { biteByCreature, Bot, climbDown, climbUp, dig, dropRock, eat, left, right } from "./bot_interface";
import { Creature, Move } from "./controller";
import { Cell, World } from "./world";

export const routines = {
    biteNearby(self: Creature, others: Creature[], world: World): Move | null {
        const { x, y } = self.pos;

        const nearby = others.find(o => Math.abs(o.pos.x - x) <= 1 && Math.abs(o.pos.y - y) <= 1 && world.isReachableFrom(x, y, o.pos.x, o.pos.y));
        if (nearby !== undefined) return biteByCreature(nearby.id);
        
        return null;
    },
    eatGrassNearby(self: Creature, _others: Creature[], world: World): Move | null {
        const { x, y } = self.pos;

        for (let oy = y + 1; oy >= y - 1; oy--) {
            for (let ox = x - 1; ox <= x + 1; ox++) {
                if ([Cell.SmallGrassTufts, Cell.LargeGrassTufts, Cell.GrassyDirt].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                    return eat(ox, oy);
                }
            }
        }

        return null;
    },
    eatMossNearby(self: Creature, _others: Creature[], world: World): Move | null {
        const { x, y } = self.pos;

        for (let oy = y + 1; oy >= y - 1; oy--) {
            for (let ox = x - 1; ox <= x + 1; ox++) {
                if ([Cell.MossyStone, Cell.MossyChippedStone, Cell.MossyBedrock].includes(world.getCell(ox, oy)) && world.isReachableFrom(x, y, ox, oy)) {
                    return eat(ox, oy);
                }
            }
        }

        return null;
    },
};