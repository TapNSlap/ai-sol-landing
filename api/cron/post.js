// api/cron/post.js
const { TwitterApi } = require("twitter-api-v2");

// ---------- FALLBACK BANKS (used if OpenAI fails) ----------
const MERCH_LINES = [
  "Cold? Buy the hoodie, clown. You’ll look 69% less broke. 🖕 #AiSol #Solana",
  "Still wearing basic tees? Imagine being that guy. Upgrade to $AISOL drip. 👕 #AiSol",
  "This mug flips you off daily. Just like the market. ☕🖕 #AiSol",
  "Not financial advice—just fashion alpha. The AI-SOL cap does numbers. 🧢 #AiSol",
];
const GM_LINES = [
  "gm degenerates ☀️ hydrate, then acquire $AISOL. #AiSol #Solana",
  "gm mortals—memes > meetings. You’re welcome. #AiSol",
  "gm. I move markets with personality. What’s your superpower? #AiSol",
];
const ROAST_LINES = [
  "If you missed the pump, at least don’t miss the merch. Stay winning somehow. #AiSol",
  "Your exit liquidity called—it said ‘thank you’. Try $AISOL next time. #AiSol",
  "I’m not bullish, I’m busy. Keep up. #AiSol #Solana",
];

// Pick a random from an array
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- PROMPT LOGIC ----------
const BASE_RULES = `
You are AI-SOL, a cheeky meme coin on Solana. Voice: sarcastic, playful roast.
Constraints:
- 1–2 sentences, <=250 chars.
- 1–2 hashtags (#AiSol, #Solana).
- No @mentions or links.
- No hate/slurs/harassment toward protected classes; keep it playful roast.
- No financial promises/guarantees.
Return ONLY the tweet text.
`;

function promptFor(topic) {
  if (topic === "merch") {
    return `${BASE_RULES}
Task: Write a short roasty promo for AI-SOL merch (hoodie, tee, mug, or hat). Tease the reader like a funny jerk, but keep it light and safe.`;
  }
  if (topic === "gm") {
    return `${BASE_RULES}
Task: Morning "gm" energy with a playful jab at the reader. Optional light nod to $AISOL or Solana.`;
  }
  // default roast
  return `${BASE_RULES}
Task: Evening-style spicy meme roast about AI-SOL / degen life. Keep it entertaining and short.`;
}

// Map UTC hour to default topic
function pickTopicByTime(hourUTC) {
  // Morning block (13–17 UTC ~ 8am–12pm Central) → gm
  if (hourUTC >= 13 && hourUTC < 17) return "gm";
  // Evening block (00–04 UTC ~ 6pm–10pm Central) → roast
  return "roast";
}

// 1/3 chance to force merch (unless user overrides)
function maybeForceMerch(topic) {
  if (topic) return topic; // explicit override
  return Math.floor((Date.now() / 1000) % 3) === 0 ? "merch" : pickTopicByTime(new Date().getUTCHours());
}

async function generatePost(topicOverride) {
  // Decide topic (merch|gm|roast)
  const topic = maybeForceMerch(topicOverride);
  const system = promptFor(topic);

  // If no OpenAI key, use fallbacks immediately
  if (!process.env.OPENAI_API_KEY) {
    if (topic === "merch") return pick(MERCH_LINES);
    if (topic === "gm") return pick(GM_LINES);
    return pick(ROAST_LINES);
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
        temperature: 0.95,
        messages: [
          { role: "system", content: system },
          { role: "user", content: "Write a fresh AI-SOL tweet now." },
        ],
      }),
    });

    if (!r.ok) throw new Error(`OpenAI ${r.status} ${await r.text()}`);
    const data = await r.json();
    let text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("No text returned");
    if (text.length > 270) text = text.slice(0, 267) + "...";
    return text;
  } catch (e) {
    console.error("OpenAI fail:", e.message || e);
    if (topic === "merch") return pick(MERCH_LINES);
    if (topic === "gm") return pick(GM_LINES);
    return pick(ROAST_LINES);
  }
}

// ---------- HANDLER ----------
module.exports = async function handler(req, res) {
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = (req.query?.secret || "").toString();
  if (headerSecret !== process.env.CRON_SECRET && querySecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const topic = (req.query?.topic || "").toString().toLowerCase(); // optional override: merch|gm|roast

  // Dry-run: preview without posting
  if (req.query?.dry) {
    const text = await generatePost(topic);
    return res.status(200).json({
      ok: true,
      mode: "dry",
      topic: topic || "auto",
      openaiKeyPresent: !!process.env.OPENAI_API_KEY,
      text,
    });
  }

  try {
    const text = await generatePost(topic);
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_KEY_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });
    const result = await client.v2.tweet(text);
    return res.status(200).json({ ok: true, topic: topic || "auto", text, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.data || e?.message || "tweet failed" });
  }
};
