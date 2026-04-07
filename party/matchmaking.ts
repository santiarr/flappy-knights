import type * as Party from "partykit/server";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface QueueEntry {
  conn: Party.Connection;
  joinedAt: number;
}

export default class MatchmakingServer implements Party.Server {
  private queue: QueueEntry[] = [];

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    this.queue.push({ conn, joinedAt: Date.now() });
    conn.send(JSON.stringify({ type: "queued", position: this.queue.length }));
    this.tryMatch();
  }

  onClose(conn: Party.Connection) {
    this.queue = this.queue.filter(e => e.conn.id !== conn.id);
  }

  private tryMatch() {
    while (this.queue.length >= 2) {
      const p1 = this.queue.shift()!;
      const p2 = this.queue.shift()!;
      const roomCode = generateRoomCode();

      const msg = JSON.stringify({ type: "matched", roomCode });
      p1.conn.send(msg);
      p2.conn.send(msg);
    }
  }
}
