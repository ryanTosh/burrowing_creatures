import { Creature, Move } from "./controller";
import { World } from "./world";

export interface Bot {
    id: string;
    name: string;
    run: (self: Creature, others: Creature[], world: World, tick: number) => Move;
}

export function left(): Move {
    return { type: "left" };
}

export function right(): Move {
    return { type: "right" };
}

export function climbUp(): Move {
    return { type: "climb_up" };
}

export function climbDown(): Move {
    return { type: "climb_down" };
}

export function dig(x: number, y: number): Move {
    return { type: "dig", pos: { x, y } };
}

export function pickUpRock(x: number, y: number): Move {
    return { type: "pick_up", pos: { x, y } };
}

export function dropRock(x: number, y: number): Move {
    return { type: "drop", pos: { x, y } };
}

export function eat(x: number, y: number): Move {
    return { type: "eat", pos: { x, y } };
}

export function biteByPos(x: number, y: number): Move {
    return { type: "bite", pos: { x, y } };
}

export function biteByCreature(id: number): Move {
    return { type: "bite", victim: id };
}