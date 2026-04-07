import type * as Party from "partykit/server";

export default class MatchmakingServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "queued" }));
  }
}
