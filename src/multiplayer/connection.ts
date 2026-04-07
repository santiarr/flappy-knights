import PartySocket from "partysocket";
import type { ClientMessage, ServerMessage } from "./types";

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";

type MessageHandler = (msg: ServerMessage) => void;

class ConnectionManager {
  private socket: PartySocket | null = null;
  private handlers: MessageHandler[] = [];

  connect(roomCode: string): void {
    this.disconnect();
    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode,
    });

    this.socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      for (const handler of this.handlers) {
        handler(msg);
      }
    });
  }

  connectMatchmaking(): void {
    this.disconnect();
    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: "queue",
      party: "matchmaking",
    });

    this.socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      for (const handler of this.handlers) {
        handler(msg);
      }
    });
  }

  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  offMessage(handler: MessageHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.handlers = [];
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const connection = new ConnectionManager();
