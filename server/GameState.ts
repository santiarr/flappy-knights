import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("string") playerId: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") score: number = 0;
    @type("number") lives: number = 3;
    @type("number") combo: number = 0;
    @type("boolean") isInvulnerable: boolean = false;
    @type("boolean") isRespawning: boolean = false;
    @type("boolean") flipX: boolean = false;
    @type("string") anim: string = "player_idle_anim";
}

export class EnemyState extends Schema {
    @type("number") id: number = 0;
    @type("string") enemyType: string = "BOUNDER";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("boolean") flipX: boolean = false;
    @type("string") anim: string = "bounder_idle_anim";
    @type("boolean") active: boolean = false;
}

export class EggState extends Schema {
    @type("number") id: number = 0;
    @type("string") eggType: string = "BOUNDER";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("boolean") active: boolean = false;
}

export class GameRoomState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
    @type([EnemyState]) enemies = new ArraySchema<EnemyState>();
    @type([EggState]) eggs = new ArraySchema<EggState>();
    @type("number") wave: number = 0;
    @type("string") phase: string = "waiting"; // waiting, countdown, playing, wave_transition, finished
    @type("number") countdown: number = 0;
    @type("string") code: string = "";
}
