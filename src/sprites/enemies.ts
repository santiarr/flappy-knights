// Enemies: menacing rider on buzzard, 24x24 grid, facing RIGHT
// Bounder: 3 (red rider), 15 (dark red buzzard)
// Hunter: 6 (gray rider), 16 (medium gray buzzard)
// Shadow Lord: 7 (blue rider), 17 (dark blue buzzard)
// Common: 1=outline, 20=red eyes, 21=dark beak, 19=legs

function makeEnemyFrames(rider: number, body: number): number[][][] {
  const frame0: number[][] = [
    //0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 0
    [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0], // 1  spiked helm
    [0,0,0,0,0,0,0,0,0,1,rider,1,1,0,0,0,0,0,0,0,0,0,0,0], // 2
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0], // 3  head
    [0,0,0,0,0,0,0,0,0,1,rider,1,0,0,0,0,0,0,0,0,0,0,0,0], // 4  neck
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0], // 5  torso
    [0,0,0,0,0,0,0,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0], // 6  torso wide
    [0,0,0,0,0,0,0,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0], // 7  rider base
    [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0], // 8  saddle
    [0,0,0,0,0,1,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0,0,0], // 9  buzzard back
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0], // 10 body + neck
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0], // 11 body + neck
    [0,0,0,0,0,1,body,body,body,body,body,body,body,body,body,1,body,body,1,0,0,0,0,0], // 12 body + head
    [0,0,0,0,0,0,1,body,body,body,body,body,body,body,1,0,1,20,1,0,0,0,0,0], // 13 tail + eye
    [0,0,0,0,0,0,0,1,body,body,body,1,body,1,0,0,1,body,1,21,21,0,0,0], // 14 tail + beak
    [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,21,0,0,0,0,0], // 15 tail end
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 16
    [0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0], // 17 legs
    [0,0,0,0,0,0,0,1,19,1,0,1,19,1,0,0,0,0,0,0,0,0,0,0], // 18
    [0,0,0,0,0,0,1,19,0,1,1,19,0,1,0,0,0,0,0,0,0,0,0,0], // 19
    [0,0,0,0,0,0,19,0,0,0,19,0,0,0,0,0,0,0,0,0,0,0,0,0], // 20
    [0,0,0,0,0,19,19,0,0,19,19,0,0,0,0,0,0,0,0,0,0,0,0,0], // 21
    [0,0,0,0,21,21,21,0,0,21,21,21,0,0,0,0,0,0,0,0,0,0,0,0], // 22
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 23
  ];

  const frame1: number[][] = [
    //0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 0
    [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0], // 1
    [0,0,0,0,0,0,0,0,0,1,rider,1,1,0,0,0,0,0,0,0,0,0,0,0], // 2
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0], // 3
    [0,0,1,1,1,0,0,0,0,1,rider,1,0,0,0,0,0,0,0,0,0,0,0,0], // 4  wing tip
    [0,1,body,body,body,1,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0], // 5  wing
    [0,0,1,body,body,body,1,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0], // 6  wing+torso
    [0,0,0,1,body,1,1,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0], // 7  wing end
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0], // 8  saddle
    [0,0,0,0,0,1,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0,0,0], // 9
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0], // 10
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0], // 11
    [0,0,0,0,0,1,body,body,body,body,body,body,body,body,body,1,body,body,1,0,0,0,0,0], // 12
    [0,0,0,0,0,0,1,body,body,body,body,body,body,body,1,0,1,20,1,0,0,0,0,0], // 13 eye
    [0,0,0,0,0,0,0,1,body,body,body,1,body,1,0,0,1,body,1,21,21,0,0,0], // 14 beak
    [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,21,0,0,0,0,0], // 15
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 16
    [0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0], // 17
    [0,0,0,0,0,0,0,1,19,1,0,1,19,1,0,0,0,0,0,0,0,0,0,0], // 18
    [0,0,0,0,0,0,1,19,0,1,1,19,0,1,0,0,0,0,0,0,0,0,0,0], // 19
    [0,0,0,0,0,0,19,0,0,0,19,0,0,0,0,0,0,0,0,0,0,0,0,0], // 20
    [0,0,0,0,0,19,19,0,0,19,19,0,0,0,0,0,0,0,0,0,0,0,0,0], // 21
    [0,0,0,0,21,21,21,0,0,21,21,21,0,0,0,0,0,0,0,0,0,0,0,0], // 22
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // 23
  ];

  return [frame0, frame1];
}

export const BOUNDER_FRAMES = makeEnemyFrames(3, 15);
export const HUNTER_FRAMES = makeEnemyFrames(6, 16);
export const SHADOW_LORD_FRAMES = makeEnemyFrames(7, 17);
