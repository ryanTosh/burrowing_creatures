# Burrowing Creature KotH

[tag:king-of-the-hill]

In this challenge, you'll write code for a bot which lives in a 2d world with two axes: up/down and left/right. Your bot is a Burrowing Creature of some unspecified morphology, exactly one unit tall and one unit wide. In each turn your bot's code will be called, and your Creature can take actions including moving sideways, hopping up or down ledges, climbing up narrow tunnels, digging, placing rocks, or consuming grass.

## The World

The world your Creature lives in consists of a 2d grid. The `-x` and `+x` directions are left and right respectively, and the `-y` and `+y` directions are down and up respectively. Note that down is negative. The world is cylindrical (in other words, it's a finite width and the edges wrap). Each grid cell is occupied by some material or by empty space, and cells with empty space or Grass Tufts can also hold one or more Creatures. The following materials exist:

- Grass Tufts (these come in two sizes: small and large)
- Grassy Dirt
- Barren Dirt
- Dirt
- Rock (which may be falling or non-falling)
- Stone
- Mossy Stone
- Chipped Stone
- Mossy Chipped Stone
- Bedrock
- Mossy Bedrock

The surface level will primarily be Grassy Dirt, some of which may have Grass Tufts on top. Some of the surface may still generate as other materials, particularly Barren Dirt. Beneath the surface will be roughly 40 units of of Dirt, which may have Rocks embedded in it, followed by roughly 40 units of Stone, then Bedrock. Above the surface, aside from Grass Tufts, there will only be empty space.

## Creatures

Each Burrowing Creature (bot) has several properties:

- Hit Points (HP): A Creature's HP is an integer starting at 18 out of a maximum of 20. Eating grass increases HP, and starving, falling, getting crushed by rocks, or getting bitten by other creatures decreases HP
- Fullness: A Creature's fullness is an integer starting at 180 out of a maximum of 200. Eating grass and moss increases fullness, and fullness initially steadily decreases by a rate of 1 per tick. Once a Creature's fullness is zero, it is starving, and instead of losing fullness, it loses HP at a one-to-one rate
- Falling: A Creature is typically not falling. However, once in a falling state, it moves down by one space per tick until it reaches solid ground, and it cannot perform any actions. If the fall is sufficiently far, fall damage is taken
- Carrying a rock: A creature can carry up to one Rock by picking it up

Eating small or large Grass Tufts or Grassy Dirt restores 1 hit point. Fall damage is calculated as \$1+2(d-3)\$, where \$d\$ is the distance fallen (falls of two blocks or fewer do no damage). If a falling rock lands on a Creature, it takes \$5+2d\$ damage, where \$d\$ is the distance the rock fell (the rock then disappears; if the Creature was not on solid ground when the rock hit, the Creature also becomes falling). If a Creature is bitten, it loses 5 HP.

Each tick reduces fullness by 1. Eating small or large Grassy Tufts or Grassy Dirt restores 25 fullness. Eating moss of any variety restores 20 fullness.

## Ticks

The game will consist of "ticks". In one tick, every Burrowing Creature is given a turn to move, and certain changes may happen to the world. In one turn, a Creature can choose to do any one of the following:

- Do nothing (`null`)
- `left()`/`right()`: Will do one of: step sideways on solid ground, step down by one regardless of the presence of solid ground, or step up by one onto a ledge
- `climbUp()` or `climbDown()`: A Creature can climb up or down shafts with a width of exactly 1 (i.e., if the space directly above/below the Creature is empty, and there is a solid block both to the left and right of that empty space)
- `dig(x, y)`: A Creature can dig dirt variants, turning them into empty space. A Creature can also "dig" Stone, which turns it into Chipped Stone, or dig Chipped Stone, which becomes empty space (the mossy variants will behave the same). Rocks and Bedrock cannot be dug, nor can Grassy Tufts (which are not solid)
- `pickUpRock(x, y)`: A Creature can pick up a non-falling Rock. The Rock is replaced with empty space. The Creature is then carrying a rock. Fails if the Creature is already carrying a rock
- `dropRock(x, y)`: A Creature can drop a Rock, turning an empty space or Grass Tufts into a Rock, which may start falling. The Creature is then no longer carrying a rock. Fails if the Creature is not carrying a rock. If there are Creatures in the space where the rock is dropped, the rock disappears and the Creatures have been hit by a falling rock with a fall distance of zero
- `eat(x, y)`: A Creature can eat Grassy Tufts, the grass from Grassy Dirt, or moss from mossy stone variants. A large Grassy Tufts will become a small Grassy Tufts, a small Grassy Tufts will become empty space, Grassy Dirt will become Barren Dirt, and any mossy stone variants will become non-mossy
- `biteByPos(x, y)`/`biteByCreature(id)`: Bite another Creature, dealing 5 HP of damage

Note that for any action which interacts with a grid cell or Creature, the target cell must be either the cell the Creature is standing in (where applicable), an adjacent cell in one of the four cardinal directions, or a cell one space diagonal of the Creature if there is an empty space between that cell and the Creature on one of its two sides.

Additionally, in each tick, various world updates will occur:

- Any Barren Dirt which has sky access (i.e., there is a solid block above it at any `y` level) has a 6.25% chance to become Dirt
- Any Dirt with sky access has a 6.25% chance to become Grassy Dirt
- Any Grassy Dirt or Barren Dirt without sky access has a 12.5% chance to become Dirt
- Any Grassy Tufts without sky access have a 12.5% chance to disappear
- Any Grassy Dirt with sky access and no Grassy Tufts above it has a 3.125% chance to grow a small Grassy Tufts above it
- Any small Grassy Tufts have a 3.125% chance of becoming large Grassy Tufts
- Stone, Chipped Stone, or Bedrock adjacent to an empty space has a 3.125% chance of becoming mossy
- Rocks and Creatures will fall by one space, when possible. If a Rock lands on a Creature, the Rock will disappear and the Creature will take damage (and start falling if above empty space)

When a Creature dies from a cause other than hunger, within a radius of several cells a reward will appear in the form of sudden accelerated plant growth. Barren Dirt may become Dirt, Dirt may become Grassy Dirt (with or without sky access), Grassy Dirt may grow Grass Tufts (with or without sky access), Grass Tufts may grow, and stone variants may become mossy (with or without empty space adjacent).

## Objective

The objective of all bots is to be the last surviving Creature. If a sufficient number of turns passes without a winner, hunger will be set to occur faster and faster until one bot survives.

## Interface

Your bot should be an object in JavaScript/TypeScript implementing the following interface:

```ts
interface Bot {
    id: string;
    name: string;
    run: (self: Creature, others: Creature[], world: World, tick: number) => Move;
}
```

The `name` should be your bot's name (e.g., `The Throngler`). The `id` should be a short unique name consisting of letters, numbers, and underscores, used in error messages (e.g., `throngler`). The `run` function will be called once per turn. It'll be passed information about your creature and the other currently-alive creatures, as well as the entire world's state and an incrementing counter representing the current tick. The interface for a `Creature` is as follows:

```ts
interface Creature {
    id: number; // Sequential
    pos: { x: number, y: number };
    hp: number;
    fullness: number;
    falling: boolean;
    fallDist: number;
    carryingRock: boolean;
    bot?: Bot; // Used internally; never passed to `run`
    ctx?: Object; // An arbitrary, mutable object which you can use for storage; never included in Creatures in the `others` parameter
}
```

Creatures will take turns in the order of their `id`s. The `world` is used by the controller as well, so it has many properties and methods, but the following will be most useful:

- `world.width`: The width of the world (note that it wraps)
- `world.getCell(x, y)`: Gets the `Cell` at a certain coordinate. Will automatically handle wrapping. Note that `y == 0` is the highest solid layer of bedrock
- `world.getGrid()`: Returns a 2d array of `Cell`s, indexed as `grid[y][x]`. May resize during the game if Creatures place Rocks above the previous internal size (note that you will receive a copy of the internal grid, so it won't change if stored across multiple turns in `self.ctx`, and it can be modified without affecting game state)
- `world.isSolid(x, y)`, `world.isNotSolid(x, y)`, `world.isRock(x, y)`: Various functions to quickly check properties of a grid cell

`Cell` is an enum with entries formatted similarly to `Cell.Empty`, `Cell.LargeGrassTufts`, or `Cell.MossyChippedStone`. Most of its naming is self-explanatory, but note that `Cell.Rock` is a non-falling Rock and `Cell.Rock1` through `Cell.Rock7` are falling variants ordered by height fallen, and anything more than 7 is `Cell.Rock8P` (since beyond 7 units, the rock will always kill a full-health Creature). You can use the functions `world.isRock(x, y)` (or `cellIsRock(cell)`) and `world.isFallingRock(x, y)` (or `cellIsFallingRock(cell)`) to deal with this easily.