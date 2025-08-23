import { TwitterApi } from "twitter-api-v2";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "Missing text" });

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_KEY_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  try {
    const result = await client.v2.tweet(text);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: e?.data || e?.message || "Tweet failed" });
  }
}
