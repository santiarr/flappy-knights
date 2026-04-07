import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("string") playerId: string = "";
    @type("int16") x: number = 0;
    @type("int16") y: number = 0;
    @type("int16") vx: number = 0;
    @type("int16") vy: number = 0;
    @type("int32") score: number = 0;
    @type("uint8") lives: number = 3;
    @type("uint8") combo: number = 0;
    @type("boolean") isInvulnerable: boolean = false;
    @type("boolean") isRespawning: boolean = false;
    @type("boolean") flipX: boolean = false;
    @type("string") anim: string = "player_idle_anim";
}

export class EnemyState extends Schema {
    @type("uint8") id: number = 0;
    @type("string") enemyType: string = "BOUNDER";
    @type("int16") x: number = 0;
    @type("int16") y: number = 0;
    @type("int16") vx: number = 0;
    @type("int16") vy: number = 0;
    @type("boolean") flipX: boolean = false;
    @type("string") anim: string = "bounder_idle_anim";
    @type("boolean") active: boolean = false;
}

export class EggState extends Schema {
    @type("uint8") id: number = 0;
    @type("string") eggType: string = "BOUNDER";
    @type("int16") x: number = 0;
    @type("int16") y: number = 0;
    @type("boolean") active: boolean = false;
}

export class GameRoomState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
    @type([EnemyState]) enemies = new ArraySchema<EnemyState>();
    @type([EggState]) eggs = new ArraySchema<EggState>();
    @type("uint8") wave: number = 0;
    @type("string") phase: string = "waiting";
    @type("uint8") countdown: number = 0;
    @type("string") code: string = "";

    constructor() {
        super();
        // Pre-allocate pools so schema structure never changes
        for (let i = 0; i < 12; i++) {
            const e = new EnemyState();
            e.id = i;
            e.active = false;
            this.enemies.push(e);
        }
        for (let i = 0; i < 12; i++) {
            const e = new EggState();
            e.id = i;
            e.active = false;
            this.eggs.push(e);
        }
    }
}
