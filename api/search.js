export default async function handler(req, res) {
  const q = req.query.q || "Ai Sol";
  const r = await fetch(
    "https://api.x.com/2/tweets/search/recent?query=" + encodeURIComponent(q),
    { headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } }
  );
  const data = await r.json();
  res.status(r.status).json(data);
}
