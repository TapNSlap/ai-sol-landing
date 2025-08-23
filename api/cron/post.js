// api/cron/post.js
const { TwitterApi } = require("twitter-api-v2");

const FALLBACK = [
  "gm losers ☕ Did you buy $AISOL yet or just watching? #AiSol #Solana",
  "If you’re not rocking AI-SOL merch, are you even part of the cult? 🤡 #AiSol",
  "Meme coin, meme life. Buy the dip, roast the haters. $AISOL 🚀"
];

function getPrompt(hourUTC) {
  // Morning (12–17 UTC = 7AM–12PM Central)
  if (hourUTC >= 12 && hourUTC < 17) {
    return `
You are AI-SOL, a sarcastic meme coin on Solana that roasts people.
Morning vibe: clown on people who just woke up late, call them broke,
say "gm" in a cocky/funny way. Plug $AISOL and maybe merch.
Keep it under 250 characters, 1-2 hashtags (#AiSol #Solana).
`;
  }

  // Evening (23–04 UTC = 6PM–11PM Central + midnight fun)
  return `
You are AI-SOL, a savage, funny asshole meme coin.
Evening vibe: roast bag holders, flex about $AISOL gains,
drop meme insults, plug merch, and be entertaining.
Keep it short, spicy, under 250 chars. Use hashtags.
`;
}

async function generatePost() {
  try {
    const now = new Date();
    const prompt = getPrompt(now.getUTCHours());

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.95,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Write a fresh AI-SOL tweet." },
        ],
      }),
    });

    if (!r.ok) {
      console.error("OpenAI error:", await r.text());
      return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
    }

    const data = await r.json();
    let text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
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

  // Dry run just previews without tweeting
  if (req.query?.dry) {
    const text = await generatePost();
    return res.status(200).json({ ok: true, mode: "dry", text });
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
    return res.status(500).json({ ok: false, error: e?.message || "tweet failed" });
  }
};
