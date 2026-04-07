import { Client, Room } from "@colyseus/sdk";
import type { ClientGameState } from "./types";
import { generateRoomCode } from "./types";

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL ?? "ws://localhost:2567";

type EventHandler = (type: string, data: Record<string, unknown>) => void;

class ConnectionManager {
    private client: Client;
    private room: Room | null = null;
    private eventHandlers: EventHandler[] = [];
    private code = "";

    constructor() {
        this.client = new Client(COLYSEUS_URL);
    }

    async createRoom(): Promise<Room> {
        this.disconnect();
        this.code = generateRoomCode();
        this.room = await this.client.create("game", { code: this.code });
        this.setupRoomListeners();
        return this.room;
    }

    async joinRoom(code: string): Promise<Room> {
        this.disconnect();
        this.code = code.toUpperCase();
        // The room's roomId IS the code
        this.room = await this.client.joinById(this.code);
        this.setupRoomListeners();
        return this.room;
    }

    async quickMatch(): Promise<Room> {
        this.disconnect();
        this.room = await this.client.joinOrCreate("game");
        this.code = this.room.roomId;
        this.setupRoomListeners();
        return this.room;
    }

    getRoom(): Room | null {
        return this.room;
    }

    getCode(): string {
        return this.code;
    }

    getState(): ClientGameState | null {
        return this.room?.state as ClientGameState | null;
    }

    getSessionId(): string {
        return this.room?.sessionId ?? '';
    }

    send(type: string, data?: Record<string, unknown>): void {
        if (this.room) {
            this.room.send(type, data);
        }
    }

    onEvent(handler: EventHandler): void {
        this.eventHandlers.push(handler);
    }

    offEvent(handler: EventHandler): void {
        this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    }

    private setupRoomListeners(): void {
        if (!this.room) return;

        this.room.onMessage("event", (data: { name: string; data?: Record<string, unknown> }) => {
            for (const handler of this.eventHandlers) {
                handler(data.name, data.data ?? {});
            }
        });

        this.room.onMessage("match_over", (data: Record<string, unknown>) => {
            for (const handler of this.eventHandlers) {
                handler("match_over", data);
            }
        });

        this.room.onMessage("countdown", (data: Record<string, unknown>) => {
            for (const handler of this.eventHandlers) {
                handler("countdown", data);
            }
        });

        this.room.onMessage("rematch", (data: Record<string, unknown>) => {
            for (const handler of this.eventHandlers) {
                handler("rematch", data);
            }
        });

        this.room.onMessage("player_left", (data: Record<string, unknown>) => {
            for (const handler of this.eventHandlers) {
                handler("player_left", data);
            }
        });
    }

    disconnect(): void {
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
        this.code = "";
        this.eventHandlers = [];
    }

    isConnected(): boolean {
        return this.room !== null;
    }
}

export const connection = new ConnectionManager();
