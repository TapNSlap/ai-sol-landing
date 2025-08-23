import { TwitterApi } from "twitter-api-v2";

// --- simple rotating content queue ---
// Option A: hardcode an array here…
const QUEUE = [
  "gm from AI-SOL 🌞 building on Solana.",
  "Community > everything. Tell us what to post next. ⚡",
  "AI-SOL tip: Consistency beats intensity. 1% better daily.",
  "Memes + markets = momentum. 🚀 #AiSol",
  "Wen utility? Wen community! 🧠🤝",
];

// If you prefer, move these lines into /data/posts.json and import it.

let index = 0; // stateless fallback; see NOTE below

export default async function handler(req, res) {
  try {
    // 1) protect the endpoint so randoms can’t hit it
    const secret = req.headers["x-cron-secret"];
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 2) pick the next post
    // NOTE: Serverless is stateless; for a simple rotation we can use time-based index:
    const now = new Date();
    // change divisor if your QUEUE length changes
    index = Math.floor(now.getUTCDate() + now.getUTCHours()) % QUEUE.length;
    const text = QUEUE[index];

    // 3) post the tweet via OAuth 1.0a (you already have these env vars)
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_KEY_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });

    const result = await client.v2.tweet(text);
    return res.status(200).json({ ok: true, posted: text, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.data || e?.message || "fail" });
  }
}
