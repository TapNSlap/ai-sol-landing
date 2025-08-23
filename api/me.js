import { TwitterApi } from "twitter-api-v2";

export default async function handler(_req, res) {
  try {
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_KEY_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });
    const me = await client.v2.me();
    res.status(200).json(me);
  } catch (e) {
    res.status(400).json({ error: e?.data || e?.message || "failed /api/me" });
  }
}
