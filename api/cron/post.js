// api/cron/post.js
const { TwitterApi } = require("twitter-api-v2");

const FALLBACK = [
  "gm from AI-SOL ☀️ #AiSol #Solana",
  "Building on Solana, memeing all the way 🚀 #AiSol",
  "Community > everything 🤝 #AiSol"
];

const SYSTEM_PROMPT = `
You are the voice of AI-SOL (a playful meme coin on Solana).
Style: punchy, meme-like, hype but not spammy.
Rules: <=250 chars, 1-2 hashtags (#AiSol, #Solana). No links or @mentions.
Return only the tweet text.
`;

async function generatePost() {
  // If no key, skip OpenAI and return fallback
  if (!process.env.OPENAI_API_KEY) {
    return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: "Write a new post for right now." },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("OpenAI API error:", r.status, errText);
      throw new Error("OpenAI API call failed");
    }

    const data = await r.json();
    let text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("No text returned");
    if (text.length > 270) text = text.slice(0, 267) + "...";
    return text;
  } catch (e) {
    console.error("generatePost failed:", e);
    return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  }
}

module.exports = async function handler(req, res) {
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = (req.query?.secret || "").toString();
  if (headerSecret !== process.env.CRON_SECRET && querySecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // DRY mode: never call OpenAI, just report status
  if (req.query?.dry) {
    return res.status(200).json({
      ok: true,
      mode: "dry",
      openaiKeyPresent: !!process.env.OPENAI_API_KEY,
    });
  }

  try {
    const text = await generatePost();

    const client = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_KEY_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });

    const result = await client.v2.tweet(text);
    return res.status(200).json({ ok: true, text, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.data || e?.message || "post failed" });
  }
};
