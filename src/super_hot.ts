import { Creature, Move } from "./controller";

export interface SuperHot {
    ctx: SuperHotCtx | null;
}

export interface SuperHotCtx {
    creature: Creature | null;
    resolveMove: ((move: Move) => void) | null;
    safe: boolean;
    hand: "rock" | "seeds";
}