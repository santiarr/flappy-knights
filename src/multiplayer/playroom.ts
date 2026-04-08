import { insertCoin, onPlayerJoin, isHost, myPlayer } from "playroomkit";

export interface PlayroomPlayer {
  id: string;
  color: string;
  isMe: boolean;
  setState: (key: string, value: unknown) => void;
  getState: (key: string) => unknown;
  onQuit: (cb: () => void) => void;
}

let initialized = false;

export async function initPlayroom(): Promise<void> {
  if (initialized) return;
  await insertCoin({
    maxPlayersPerRoom: 2,
    matchmaking: true,
  });
  initialized = true;
}

export function onJoin(callback: (player: PlayroomPlayer) => void): void {
  onPlayerJoin((player: { id: string; getProfile: () => { color?: { hex?: string } }; setState: (k: string, v: unknown) => void; getState: (k: string) => unknown; onQuit: (cb: () => void) => void }) => {
    const profile = player.getProfile();
    callback({
      id: player.id,
      color: profile.color?.hex ?? "#ffffff",
      isMe: player.id === myPlayer()?.id,
      setState: (key, value) => player.setState(key, value),
      getState: (key) => player.getState(key),
      onQuit: (cb) => player.onQuit(cb),
    });
  });
}

export function getIsHost(): boolean {
  return isHost();
}

export function getMyId(): string {
  return myPlayer()?.id ?? "";
}

export function setMyInput(action: string): void {
  myPlayer()?.setState("input", { action });
}

export { isHost, myPlayer };
