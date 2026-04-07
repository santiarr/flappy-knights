import type * as Party from "partykit/server";

export default class GameServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "connected", id: conn.id }));
    this.room.broadcast(JSON.stringify({
      type: "player_joined",
      playerCount: [...this.room.getConnections()].length,
    }));
  }

  onClose(conn: Party.Connection) {
    this.room.broadcast(JSON.stringify({
      type: "player_left",
      playerCount: [...this.room.getConnections()].length - 1,
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    this.room.broadcast(message, [sender.id]);
  }
}
