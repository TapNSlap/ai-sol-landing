// api/cron/post.js
const { TwitterApi } = require("twitter-api-v2");

// ----------- CONFIG -----------
const SITE = process.env.SITE_URL || "https://ai-sol.tapnslap.ai";

// Merch probability (0.0–1.0). At 0.15 ≈ 15%.
const MERCH_PROB = 0.15;

// ----------- FALLBACK LINES -----------
const FB = {
  gm: [
    "gm degenerates ☀️ hydrate, then acquire $AISOL. #AiSol #Solana",
    "gm. Memes > meetings. You’re welcome. #AiSol",
    "Rise, cry, buy. Repeat. #AiSol #Solana",
  ],
  roast: [
    "You bought the top again? Congrats, you’re my exit liquidity. 🖕 $AISOL #Solana",
    "I’m not bullish, I’m busy. Keep up. #AiSol",
    "Cope harder. I’m the main character. $AISOL",
  ],
  market: [
    "Red candles? Relax, you weren’t gonna make it anyway. 🚽 $AISOL",
    "Green day and you’re still poor. Tragic. #AiSol",
    "Charts up, IQ down. Perfect combo. $AISOL",
  ],
  degen: [
    "47 tabs open, 0 profits. Close Discord and touch grass. #AiSol",
    "Sleep is for whales. You? You’re bait. $AISOL",
    "Hustle harder or get roasted daily. #AiSol",
  ],
  merch: [
    "Still trading in your mom’s basement? At least look decent. Hoodie soon. 🖕 #AiSol",
    "Basic tee? Couldn’t be me. Drip incoming. #AiSol",
    "This mug flips you off every morning. Soulmate unlocked. ☕🖕 #AiSol",
  ],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------- PROMPTS -----------
const BASE_RULES = `
You are AI-SOL, a sarcastic meme coin on Solana. Voice: funny, cocky, roasty "asshole"—but playful.
Constraints:
- 1–2 sentences, <=230 chars for body (we append a link).
- 1–2 hashtags (#AiSol, #Solana).
- No @mentions or links in your text (we append site).
- No slurs/hate/harassment of protected classes. Punch up at behavior, not identity.
- No financial guarantees.
Return ONLY the body text (no link).
`;

function topicPrompt(topic) {
  switch (topic) {
    case "gm":
      return `${BASE_RULES}\nTask: Morning 'gm' jab. Light roast, degen energy.`;
    case "market":
      return `${BASE_RULES}\nTask: Market/trader roast. Pumps/dumps, cope/comedy.`;
    case "degen":
      return `${BASE_RULES}\nTask: Degenerate lifestyle roast (late nights, Discord addicts, fake gurus).`;
    case "merch":
      return `${BASE_RULES}\nTask: Rare merch plug as a roast (hoodie/tee/mug/hat). Tease, don't hard-sell.`;
    default:
      return `${BASE_RULES}\nTask: General spicy roast about AI-SOL / the timeline.`;
  }
}

// ----------- TOPIC SELECTION -----------
function chooseTopic(override) {
  if (override) return override; // gm|roast|market|degen|merch
  const h = new Date().getUTCHours();
  if (Math.random() < MERCH_PROB) return "merch";      // ~15% merch chance
  if (h >= 13 && h < 17) return "gm";                  // ~8a–12p Central
  const pool = ["roast", "market", "degen"];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ----------- OPENAI GENERATION -----------
async function generateBody(topic) {
  if (!process.env.OPENAI_API_KEY) {
    return pick(FB[topic] || FB.roast);
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
          { role: "system", content: topicPrompt(topic) },
          { role: "user", content: "Write 1 new tweet body now." },
        ],
      }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status} ${await r.text()}`);
    const data = await r.json();
    let body = data?.choices?.[0]?.message?.content?.trim();
    if (!body) throw new Error("No text");
    if (body.length > 230) body = body.slice(0, 227) + "...";
    return body;
  } catch (e) {
    console.error("OpenAI fail:", e?.message || e);
    return pick(FB[topic] || FB.roast);
  }
}

// (kept for future image support; not used in text-only mode)
async function fetchImageBuffer(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error("[IMAGE FETCH ERROR]", r.status, url);
      return null;
    }
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.error("[IMAGE FETCH ERROR]", e?.message || e, url);
    return null;
  }
}

// ----------- HANDLER -----------
module.exports = async function handler(req, res) {
  // Auth: allow Vercel scheduled runs OR callers that know CRON_SECRET (header or ?secret=)
  const isVercelCron = Boolean(req.headers["x-vercel-cron"]);
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = (req.query?.secret || "").toString();

  if (
    !(
      isVercelCron ||
      headerSecret === process.env.CRON_SECRET ||
      querySecret === process.env.CRON_SECRET
    )
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Select topic
  const override = (req.query?.topic || "").toString().toLowerCase();
  const topic = chooseTopic(override);

  // --- Dry run = preview only (never crash) ---
  if (req.query?.dry) {
    try {
      const body = await generateBody(topic);
      const text = `${body} ${SITE}`;
      return res.status(200).json({
        ok: true,
        mode: "dry",
        topic,
        openaiKeyPresent: !!process.env.OPENAI_API_KEY,
        willAttachMedia: false, // text-only mode
        text,
      });
    } catch (e) {
      console.error("[DRY RUN ERROR]", e?.stack || e?.message || e);
      const text = `${pick(FB[topic] || FB.roast)} ${SITE}`;
      return res.status(200).json({
        ok: true,
        mode: "dry-fallback",
        topic,
        openaiKeyPresent: !!process.env.OPENAI_API_KEY,
        willAttachMedia: false,
        text,
      });
    }
  }

  // --- Live tweet (text-only; never 500) ---
  try {
    const body = await generateBody(topic);
    const text = `${body} ${SITE}`;

    const client = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_KEY_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });

    // Text-only tweet (images disabled for stability)
    const result = await client.v2.tweet(text);

    return res.status(200).json({ ok: true, topic, text, result });
  } catch (e) {
    const msg = e?.data || e?.message || "tweet failed";
    console.error("[TWEET ERROR]", msg);
    return res.status(200).json({
      ok: false,
      topic,
      error: msg,
      env: {
        hasKey: !!process.env.X_API_KEY,
        hasKeySecret: !!process.env.X_API_KEY_SECRET,
        hasAccess: !!process.env.X_ACCESS_TOKEN,
        hasAccessSecret: !!process.env.X_ACCESS_TOKEN_SECRET,
      },
    });
  }
};
