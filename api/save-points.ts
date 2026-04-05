import type { VercelRequest, VercelResponse } from '@vercel/node';

// Try both SDK class names — docs show both PlayFunClient and OpenGameClient
let clientInstance: any = null;

async function getClient() {
    if (clientInstance) return clientInstance;
    try {
        const sdk = await import('@playdotfun/server-sdk');
        const ClientClass = (sdk as any).PlayFunClient ?? (sdk as any).OpenGameClient;
        clientInstance = new ClientClass({
            apiKey: process.env.OGP_API_KEY!,
            secretKey: process.env.OGP_API_SECRET_KEY!,
        });
        return clientInstance;
    } catch (e) {
        console.error('Failed to initialize Play.fun client:', e);
        throw e;
    }
}

const GAME_ID = 'aea6b5ee-eccf-419e-a163-652bbf568333';

const MAX_SCORE_PER_SESSION = 5000;
const MAX_REASONABLE_SCORE_PER_WAVE = 1200; // ~8 enemies * max 1000 pts + eggs

// Simple in-memory replay prevention (resets on cold start, but catches most abuse)
const recentSubmissions = new Map<string, number>();

function validateScore(
    score: number, wave: number, timePlayed: number
): { valid: boolean; reason?: string } {
    if (score <= 0 || !Number.isFinite(score)) {
        return { valid: false, reason: 'Invalid score value' };
    }
    if (score > MAX_SCORE_PER_SESSION) {
        return { valid: false, reason: 'Score exceeds session maximum' };
    }
    if (wave < 1 || !Number.isFinite(wave)) {
        return { valid: false, reason: 'Invalid wave' };
    }
    // Must have played at least 5 seconds
    if (timePlayed < 5000) {
        return { valid: false, reason: 'Session too short' };
    }
    // Score proportional to waves — generous but catches blatant hacks
    const maxReasonableScore = wave * MAX_REASONABLE_SCORE_PER_WAVE;
    if (score > maxReasonableScore) {
        return { valid: false, reason: 'Score too high for waves completed' };
    }
    // Each wave takes at least ~3 seconds realistically
    const minTimeForWaves = wave * 3000;
    if (timePlayed < minTimeForWaves * 0.5) {
        return { valid: false, reason: 'Completed waves too fast' };
    }
    return { valid: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { playerId, score, wave, timePlayed } = req.body ?? {};

    if (!playerId || score === undefined || wave === undefined || timePlayed === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate score
    const validation = validateScore(score, wave, timePlayed);
    if (!validation.valid) {
        console.warn(`[anti-cheat] Rejected: player=${playerId} score=${score} wave=${wave} time=${timePlayed} reason=${validation.reason}`);
        return res.status(400).json({ error: validation.reason });
    }

    // Rate limit: max 1 submission per 10 seconds per player
    const now = Date.now();
    const lastSubmit = recentSubmissions.get(playerId) ?? 0;
    if (now - lastSubmit < 10000) {
        return res.status(429).json({ error: 'Too many submissions, wait a moment' });
    }
    recentSubmissions.set(playerId, now);

    // Clean old entries every 100 submissions
    if (recentSubmissions.size > 100) {
        for (const [id, time] of recentSubmissions) {
            if (now - time > 60000) recentSubmissions.delete(id);
        }
    }

    try {
        const client = await getClient();
        await client.play.savePoints({
            gameId: GAME_ID,
            playerId,
            points: score,
        });
        return res.status(200).json({ success: true, points: score });
    } catch (error: any) {
        console.error('Failed to save points:', error?.message ?? error);
        return res.status(500).json({ error: 'Failed to save points' });
    }
}
