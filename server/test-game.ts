/**
 * Integration test: simulates two clients joining, readying, and playing through waves.
 * Run with: npx ts-node test-game.ts
 */
import { Client } from "@colyseus/sdk";

const URL = process.env.TEST_URL || "ws://localhost:2567";

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
    console.log("=== Flappy Knights Multiplayer Integration Test ===");
    console.log(`Connecting to ${URL}\n`);

    const client1 = new Client(URL);
    const client2 = new Client(URL);

    // Player 1 creates room
    console.log("1. Player 1 creating room...");
    const room1 = await client1.create("game");
    console.log(`   Room created: ${room1.roomId} (session: ${room1.sessionId})`);

    // Player 2 joins
    console.log("2. Player 2 joining room...");
    const room2 = await client2.joinById(room1.roomId);
    console.log(`   Joined room: ${room2.roomId} (session: ${room2.sessionId})`);

    // Track state
    let stateUpdates = 0;
    let lastPhase = "";
    let lastWave = 0;
    let enemyCount = 0;
    let errors: string[] = [];

    room1.onStateChange((state: any) => {
        stateUpdates++;
        if (state.phase !== lastPhase) {
            console.log(`   Phase: ${lastPhase} -> ${state.phase}`);
            lastPhase = state.phase;
        }
        if (state.wave !== lastWave) {
            console.log(`   Wave: ${state.wave}`);
            lastWave = state.wave;
        }

        // Count active enemies
        let active = 0;
        state.enemies?.forEach((e: any) => {
            if (e.active) {
                active++;
                // Verify enemy has valid fields
                if (typeof e.x !== "number" || isNaN(e.x)) errors.push(`Enemy ${e.id}: invalid x=${e.x}`);
                if (typeof e.y !== "number" || isNaN(e.y)) errors.push(`Enemy ${e.id}: invalid y=${e.y}`);
                if (!e.enemyType) errors.push(`Enemy ${e.id}: missing enemyType`);
                if (!e.anim) errors.push(`Enemy ${e.id}: missing anim`);
                // Verify anim key format
                if (e.anim && !e.anim.endsWith("_anim")) {
                    errors.push(`Enemy ${e.id}: bad anim key "${e.anim}" (must end with _anim)`);
                }
            }
        });
        if (active !== enemyCount) {
            enemyCount = active;
            console.log(`   Active enemies: ${enemyCount}`);
        }

        // Verify players
        state.players?.forEach((p: any, sid: string) => {
            if (typeof p.x !== "number" || isNaN(p.x)) errors.push(`Player ${sid}: invalid x`);
            if (typeof p.y !== "number" || isNaN(p.y)) errors.push(`Player ${sid}: invalid y`);
            if (p.anim && !p.anim.endsWith("_anim")) {
                errors.push(`Player ${sid}: bad anim key "${p.anim}"`);
            }
        });
    });

    room1.onMessage("event", (data: any) => {
        console.log(`   Event: ${data.name}`, data.data ? JSON.stringify(data.data) : "");
    });

    room1.onError((code: number, message: string) => {
        errors.push(`Room error [${code}]: ${message}`);
    });

    // Both ready
    console.log("\n3. Both players sending ready...");
    room1.send("ready");
    room2.send("ready");

    // Wait for countdown
    await sleep(4000);
    console.log(`\n4. Game should be playing now (phase: ${lastPhase})`);

    // Simulate some input
    console.log("5. Sending inputs...");
    room1.send("input", { action: "flap" });
    room2.send("input", { action: "flap" });
    room1.send("input", { action: "right" });
    room2.send("input", { action: "left" });

    // Wait for enemies to spawn and be synced
    console.log("6. Waiting for enemies to spawn and sync...");
    await sleep(5000);

    // More input
    room1.send("input", { action: "flap" });
    room2.send("input", { action: "flap" });
    await sleep(3000);

    // Report
    console.log("\n=== RESULTS ===");
    console.log(`State updates received: ${stateUpdates}`);
    console.log(`Final phase: ${lastPhase}`);
    console.log(`Final wave: ${lastWave}`);
    console.log(`Active enemies: ${enemyCount}`);

    if (errors.length > 0) {
        console.log(`\n❌ ERRORS (${errors.length}):`);
        // Deduplicate
        const unique = [...new Set(errors)];
        unique.forEach(e => console.log(`  - ${e}`));
    } else {
        console.log("\n✅ NO ERRORS — all state fields valid");
    }

    // Cleanup
    room1.leave();
    room2.leave();
    await sleep(500);

    process.exit(errors.length > 0 ? 1 : 0);
}

test().catch(err => {
    console.error("❌ TEST CRASHED:", err);
    process.exit(1);
});
