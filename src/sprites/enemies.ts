// Enemies: menacing rider on buzzard, 24x24 grid
// Bounder uses: 3 (red rider), 15 (dark red buzzard body)
// Hunter uses: 6 (gray rider), 16 (medium gray buzzard body)
// Shadow Lord uses: 7 (blue rider), 17 (dark blue buzzard body)
// Common: 1=outline, 20=red eyes, 21=dark beak, 19=legs

// Helper: create enemy frames with given rider/body palette indices
function makeEnemyFrames(rider: number, body: number): number[][][] {
  // Frame 0: Wings down (hunched, spiky silhouette)
  const frame0: number[][] = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,body,body,body,body,body,body,body,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,body,body,body,body,body,body,body,body,body,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0],
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0],
    [0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,20,body,body,1,0,0,0,0],
    [0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,body,body,1,21,21,0,0],
    [0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,body,body,1,21,0,0,0,0],
    [0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0],
    [0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0,0],
    [1,body,body,body,body,1,1,1,1,1,body,body,body,body,body,1,0,0,0,0,0,0,0,0],
    [0,1,1,1,1,0,0,0,0,0,1,1,body,body,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,19,0,0,0,0,19,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,19,0,0,0,0,0,0,19,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,19,19,0,0,0,0,0,19,19,0,0,0,0,0,0,0,0],
  ];

  // Frame 1: Wings up (flapping)
  const frame1: number[][] = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0],
    [0,1,1,0,0,0,0,0,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0],
    [1,body,body,1,0,0,0,1,rider,rider,rider,rider,rider,1,0,0,0,0,0,0,0,0,0,0],
    [0,1,body,body,1,0,1,body,body,body,body,body,body,body,1,0,0,0,0,0,0,0,0,0],
    [0,0,1,body,body,1,body,body,body,body,body,body,body,body,body,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,1,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0],
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0],
    [0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,20,body,body,1,0,0,0,0],
    [0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,body,body,1,21,21,0,0],
    [0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,body,body,1,21,0,0,0,0],
    [0,0,0,0,0,1,body,body,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,body,body,body,body,body,body,body,body,body,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,1,1,1,body,body,body,body,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,1,body,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,19,0,0,0,0,19,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,19,0,0,0,0,0,0,19,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,19,19,0,0,0,0,0,19,19,0,0,0,0,0,0,0,0],
  ];

  return [frame0, frame1];
}

export const BOUNDER_FRAMES = makeEnemyFrames(3, 15);
export const HUNTER_FRAMES = makeEnemyFrames(6, 16);
export const SHADOW_LORD_FRAMES = makeEnemyFrames(7, 17);
