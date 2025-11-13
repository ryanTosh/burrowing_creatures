import { Controller, Creature } from "./controller";
import { Graphics } from "./graphics";

interface CreatureRecord {
    creature: Creature;
    node: HTMLDivElement;
}

export class SidebarMgr {
    private graphics: Graphics;

    private controller: Controller | null = null;

    private width: number | null = null;
    private creatures: (CreatureRecord | null)[] | null = null;

    private creaturesOnScreenNode: HTMLDivElement;
    private creaturesOtherNode: HTMLDivElement;
    private creaturesDeadNode: HTMLDivElement;

    constructor(graphics: Graphics) {
        this.graphics = graphics;

        const creaturesOnScreenNode = document.getElementById("creatures_on_screen");
        const creaturesOtherNode = document.getElementById("creatures_other");
        const creaturesDeadNode = document.getElementById("creatures_dead");

        if (creaturesOnScreenNode === null || creaturesOnScreenNode.tagName != "DIV") throw new Error("Failed to set creaturesOnScreenNode");
        if (creaturesOtherNode === null || creaturesOtherNode.tagName != "DIV") throw new Error("Failed to set creaturesOtherNode");
        if (creaturesDeadNode === null || creaturesDeadNode.tagName != "DIV") throw new Error("Failed to set creaturesDeadNode");
        
        this.creaturesOnScreenNode = creaturesOnScreenNode as HTMLDivElement;
        this.creaturesOtherNode = creaturesOtherNode as HTMLDivElement;
        this.creaturesDeadNode = creaturesDeadNode as HTMLDivElement;
    }

    private buildProp(prop: string, conts: string | number | boolean, click?: () => void): HTMLLIElement {
        const li = document.createElement("li");
        li.appendChild(document.createTextNode(prop + ": "));

        if (click === undefined) {
            const contsNode = document.createElement("span");
            contsNode.className = "prop_" + prop;
            contsNode.textContent = conts.toString();
            li.appendChild(contsNode);
        } else {
            const contsNode = document.createElement("a");
            contsNode.className = "prop_" + prop;
            contsNode.textContent = conts.toString();
            contsNode.href = "javascript:void(0)";
            contsNode.addEventListener("click", click);
            li.appendChild(contsNode);
        }

        return li;
    }

    private buildLastMoves(creature: Creature): HTMLUListElement {
        const lastMoves = document.createElement("ul");
        lastMoves.className = "lastMoves";

        const padWidth = creature.lastMoves!.length == 0 ? 0 : creature.lastMoves![creature.lastMoves!.length - 1].tick.toString().length + 1;
        for (const move of creature.lastMoves!.slice(-5)) {
            const li = document.createElement("li");

            li.textContent = move.tick.toString().padEnd(padWidth) + "(" + move.pos.x + ", " + move.pos.y + "): ";

            if (move.move === null) {
                li.textContent += "null";
            } else {
                switch (move.move.type) {
                    case "left":
                    case "right": {
                        li.textContent += move.move.type + "()";
                        break;
                    }
                    case "climb_up": {
                        li.textContent += "climbUp()";
                        break;
                    }
                    case "climb_down": {
                        li.textContent += "climbDown()";
                        break;
                    }
                    case "dig": {
                        li.textContent += "dig(" + move.move.pos.x + ", " + move.move.pos.y + ")";
                        break;
                    }
                    case "pick_up": {
                        li.textContent += "pickUpRock(" + move.move.pos.x + ", " + move.move.pos.y + ")";
                        break;
                    }
                    case "drop": {
                        li.textContent += "dropRock(" + move.move.pos.x + ", " + move.move.pos.y + ")";
                        break;
                    }
                    case "eat": {
                        li.textContent += "eat(" + move.move.pos.x + ", " + move.move.pos.y + ")";
                        break;
                    }
                    case "bite": {
                        if ("pos" in move.move) {
                            li.textContent += "biteByPos(" + move.move.pos.x + ", " + move.move.pos.y + ")";
                        } else {
                            li.textContent += "biteByCreature(" + move.move.victim + ")";
                        }
                        break;
                    }
                }
            }

            lastMoves.appendChild(li);
        }

        return lastMoves;
    }

    private buildCreatureNode(creature: Creature): HTMLDivElement {
        const node = document.createElement("div");
        node.className = "creature";

        const details = document.createElement("details");
        node.appendChild(details);

        const summary = document.createElement("summary");
        summary.textContent = creature.id + ": " + creature.bot!.id;
        details.appendChild(summary);

        const other = document.createElement("div");
        details.appendChild(other);

        const props = document.createElement("ul");
        props.appendChild(this.buildProp("id", creature.id));
        props.appendChild(this.buildProp("pos", "(" + creature.pos.x + ", " + creature.pos.y + ")", () => { this.graphics.setPos(creature.pos.x + 0.5, creature.pos.y - 0.5) }));
        props.appendChild(this.buildProp("hp", creature.hp));
        props.appendChild(this.buildProp("fullness", creature.fullness));
        props.appendChild(this.buildProp("falling", creature.falling));
        props.appendChild(this.buildProp("fallDist", creature.fallDist));
        props.appendChild(this.buildProp("carryingRocks", creature.carryingRocks));
        other.appendChild(props);

        const ctxH = document.createElement("h4");
        ctxH.textContent = "Context:";
        other.appendChild(ctxH);

        const ctxUl = document.createElement("ul");
        const ctx = document.createElement("li");
        ctx.className = "ctx";
        ctx.textContent = JSON.stringify(creature.ctx, null, 2);
        ctx.addEventListener("click", () => {
            console.log(creature.ctx);
        });
        ctxUl.appendChild(ctx);
        other.appendChild(ctxUl);

        const lastMovesH = document.createElement("h4");
        lastMovesH.className = "lastMovesH";
        lastMovesH.textContent = "Last moves:";
        other.appendChild(lastMovesH);

        other.appendChild(this.buildLastMoves(creature));

        return node;
    }

    public setController(controller: Controller) {
        this.controller = controller;
        this.width = controller.getWorld().width;

        const creatures = this.controller.getCreatures();

        this.creatures = new Array(creatures.length == 0 ? 0 : creatures[creatures.length - 1].id + 1).fill(null);

        for (const creature of creatures) {
            const node = this.buildCreatureNode(creature);

            this.creatures[creature.id] = {
                creature,
                node
            };
        }

        while (this.creaturesOnScreenNode.firstChild !== null) this.creaturesOnScreenNode.removeChild(this.creaturesOnScreenNode.firstChild);
        while (this.creaturesOtherNode.firstChild !== null) this.creaturesOtherNode.removeChild(this.creaturesOtherNode.firstChild);
        while (this.creaturesDeadNode.firstChild !== null) this.creaturesDeadNode.removeChild(this.creaturesDeadNode.firstChild);
    }

    private insertCreatureNode(record: CreatureRecord, parent: HTMLDivElement) {
        if (record.node.parentNode != parent) {
            if (record.node.parentNode !== null) record.node.parentNode.removeChild(record.node);

            let inserted = false;
            for (const child of parent.children) {
                if (Number(child.getElementsByClassName("prop_id")[0].textContent) > record.creature.id) {
                    parent.insertBefore(record.node, child);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) parent.appendChild(record.node);
        }
    }

    private isInsideBounds(pos: { x: number; y: number }, minX: number, minY: number, maxX: number, maxY: number): boolean {
        return (
            (pos.x >= minX && pos.x <= maxX || pos.x + this.width! >= minX && pos.x + this.width! <= maxX) &&
            pos.y >= minY && pos.y <= maxY
        );
    }

    private updateCreatureNode(node: HTMLDivElement, creature: Creature) {
        node.getElementsByClassName("prop_id")[0].textContent = creature.id.toString();
        node.getElementsByClassName("prop_pos")[0].textContent = "(" + creature.pos.x + ", " + creature.pos.y + ")";
        node.getElementsByClassName("prop_hp")[0].textContent = creature.hp.toString();
        node.getElementsByClassName("prop_fullness")[0].textContent = creature.fullness.toString();
        node.getElementsByClassName("prop_falling")[0].textContent = creature.falling.toString();
        node.getElementsByClassName("prop_fallDist")[0].textContent = creature.fallDist.toString();
        node.getElementsByClassName("prop_carryingRocks")[0].textContent = creature.carryingRocks.toString();

        node.getElementsByClassName("ctx")[0].textContent = JSON.stringify(creature.ctx, null, 2);

        for (const lastMoves of node.getElementsByClassName("lastMoves")) lastMoves.parentNode!.removeChild(lastMoves);
        const lastMovesH = node.getElementsByClassName("lastMovesH")[0];
        lastMovesH.parentNode!.appendChild(this.buildLastMoves(creature));
    }

    public update(minX: number, minY: number, maxX: number, maxY: number) {
        if (this.controller === null) return;

        const creatures = this.controller.getCreatures();
        const deadCreatures = this.controller.getDeadCreatures();

        for (let i = 0; i < this.creatures!.length; i++) {
            const record = this.creatures![i];

            if (record === null) continue;

            const creature = creatures.find(c => c.id == i);

            if (creature === undefined) {
                const deadCreature = deadCreatures.find(c => c.creature.id == i);

                if (deadCreature !== undefined) {
                    record.creature = deadCreature.creature;
                    this.updateCreatureNode(record.node, deadCreature.creature);

                    if (record.node.getElementsByClassName("prop_diedTick").length == 0) {
                        record.node.getElementsByTagName("ul")[0].appendChild(this.buildProp("diedTick", deadCreature.diedTick));
                    }

                    this.insertCreatureNode(record, this.creaturesDeadNode);
                }
            } else {
                record.creature = creature;
                this.updateCreatureNode(record.node, creature);

                if (this.isInsideBounds(creature.pos, minX, minY, maxX, maxY)) {
                    this.insertCreatureNode(record, this.creaturesOnScreenNode);
                } else {
                    this.insertCreatureNode(record, this.creaturesOtherNode);
                }
            }
        }
    }
}