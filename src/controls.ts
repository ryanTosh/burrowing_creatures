interface Binding {
    id: string;
    keys: string[];
    mouseBtns: number[];
}

// const LEFT_MOUSE_BTN = 0;
const RIGHT_MOUSE_BTN = 2;

const bindings: Binding[] = [
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
    }
];

export class Controls {
    private canvas: HTMLCanvasElement;

    private keysDown: Set<string> = new Set();
    private mouseBtnsDown: Set<number> = new Set();

    private mouseOffset?: [number, number];

    private bindNowDownListeners: Map<string, (() => void)[]>;
    private bindUpListeners: Map<string, (() => void)[]>;
    private mouseMoveListeners: ((pointingDir: number | null) => void)[] = [];
    private clearListeners: (() => void)[] = [];

    private keydownListener: (event: KeyboardEvent) => void;
    private keyupListener: (event: KeyboardEvent) => void;
    private mousedownListener: (event: MouseEvent) => void;
    private mouseupListener: (event: MouseEvent) => void;
    private mousemoveListener: (event: MouseEvent) => void;
    private contextmenuListener: (event: MouseEvent) => void;
    private blurListener: () => void;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.bindNowDownListeners = new Map(bindings.map(b => [b.id, []]));
        this.bindUpListeners = new Map(bindings.map(b => [b.id, []]));

        window.addEventListener("keydown", this.keydownListener = (event: KeyboardEvent) => {
            let bindsNowDown = [];

            bindings: for (const binding of bindings) {
                if (binding.keys.includes(event.code)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouseBtn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouseBtn)) {
                            continue bindings;
                        }
                    }

                    bindsNowDown.push(binding.id);
                }
            }

            this.keysDown.add(event.code);

            for (const binding_id of bindsNowDown) {
                for (const listener of this.bindNowDownListeners.get(binding_id)!) {
                    listener();
                }
            }
        });

        window.addEventListener("keyup", this.keyupListener = (event: KeyboardEvent) => {
            this.keysDown.delete(event.code);

            bindings: for (const binding of bindings) {
                if (binding.keys.includes(event.code)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouseBtn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouseBtn)) {
                            continue bindings;
                        }
                    }

                    for (const listener of this.bindUpListeners.get(binding.id)!) {
                        listener();
                    }
                }
            }
        });

        canvas.addEventListener("mousedown", this.mousedownListener = (event: MouseEvent) => {
            let bindsNowDown = [];

            bindings: for (const binding of bindings) {
                if (binding.mouseBtns.includes(event.button)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouseBtn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouseBtn)) {
                            continue bindings;
                        }
                    }

                    bindsNowDown.push(binding.id);
                }
            }

            this.mouseBtnsDown.add(event.button);

            for (const binding_id of bindsNowDown) {
                for (const listener of this.bindNowDownListeners.get(binding_id)!) {
                    listener();
                }
            }
        });

        canvas.addEventListener("mouseup", this.mouseupListener = (event: MouseEvent) => {
            this.mouseBtnsDown.delete(event.button);

            bindings: for (const binding of bindings) {
                if (binding.mouseBtns.includes(event.button)) {
                    for (const key of binding.keys) {
                        if (this.keysDown.has(key)) {
                            continue bindings;
                        }
                    }
                    for (const mouse_btn of binding.mouseBtns) {
                        if (this.mouseBtnsDown.has(mouse_btn)) {
                            continue bindings;
                        }
                    }

                    for (const listener of this.bindUpListeners.get(binding.id)!) {
                        listener();
                    }
                }
            }
        });

        canvas.addEventListener("mousemove", this.mousemoveListener = (event: MouseEvent) => {
            this.mouseOffset = [event.offsetX, event.offsetY];

            for (const listener of this.mouseMoveListeners) {
                listener(this.pointingDir());
            }
        });

        canvas.addEventListener("contextmenu", this.contextmenuListener = (event: MouseEvent) => {
            for (const binding of bindings) {
                if (binding.mouseBtns.includes(RIGHT_MOUSE_BTN)) {
                    event.preventDefault();

                    break;
                }
            }
        });

        window.addEventListener("blur", this.blurListener = () => {
            this.keysDown.clear();
            this.mouseBtnsDown.clear();

            for (const listener of this.mouseMoveListeners) {
                listener(this.pointingDir());
            }
            for (const listener of this.clearListeners) {
                listener();
            }
        });
    }

    public pointingDir(): number | null {
        return this.mouseOffset === undefined ? null : Math.atan2(this.mouseOffset[1] - this.canvas.height / 2, this.mouseOffset[0] - this.canvas.width / 2);
    }

    public isBindDown(binding_id: string) {
        const binding = bindings.find(b => b.id == binding_id)!;

        return binding!.keys.some(k => this.keysDown.has(k)) || binding!.mouseBtns.some(b => this.mouseBtnsDown.has(b));
    }

    public onBindNowDown(binding_id: string, fn: () => void) {
        this.bindNowDownListeners.get(binding_id)!.push(fn);
    }

    public onBindUp(binding_id: string, fn: () => void) {
        this.bindUpListeners.get(binding_id)!.push(fn);
    }

    public onMouseMove(fn: (pointingDir: number | null) => void) {
        this.mouseMoveListeners.push(fn);
    }

    public onClear(fn: () => void) {
        this.clearListeners.push(fn);
    }

    public close() {
        window.removeEventListener("keydown", this.keydownListener);
        window.removeEventListener("keyup", this.keyupListener);
        this.canvas.removeEventListener("mousedown", this.mousedownListener);
        this.canvas.removeEventListener("mouseup", this.mouseupListener);
        this.canvas.removeEventListener("mousemove", this.mousemoveListener);
        this.canvas.removeEventListener("contextmenu", this.contextmenuListener);
        window.removeEventListener("blur", this.blurListener);
    }
}