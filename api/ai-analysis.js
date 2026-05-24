// api/ai-analysis.js  ─── Vercel Serverless Function
// Place this file at:  /api/ai-analysis.js  in your project root
//
// Required env var in Vercel dashboard:
//   ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxxxxx

export default async function handler(req, res) {

  // ── CORS headers ────────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Only allow POST ─────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Check API key ───────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables." });
  }

  try {
    const { type, payload } = req.body;

    if (!type || !payload) {
      return res.status(400).json({ error: "Missing type or payload in request body." });
    }

    let prompt = "";

    // ── DEEP ANALYSIS ──────────────────────────────────────────────────────────
    if (type === "deep") {
      const { coin, price, change, history } = payload;

      const fmt = (n, d = 2) => {
        if (n == null) return "–";
        if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
        if (n >= 1) return n.toFixed(d);
        return n.toFixed(6);
      };

      const recentPrices = (history || []).slice(-10).map(p => "$" + fmt(p)).join(", ");

      prompt = `You are a professional crypto trading analyst with deep technical analysis expertise.

Coin: ${coin.name} (${coin.symbol})
Current Price: $${fmt(price)}
24h Change: ${(change || 0).toFixed(2)}%
Recent Price History: ${recentPrices || "unavailable"}

Provide a detailed trading analysis. Reply ONLY with valid JSON — no markdown, no code fences, no extra text whatsoever:
{
  "summary": "2 clear sentences describing the current market situation for this coin",
  "signal": "BUY",
  "confidence": 78,
  "shortTermOutlook": "1 to 2 sentences on what to expect in the next 4-24 hours",
  "keyLevels": {
    "support": "$X",
    "resistance": "$Y"
  },
  "bullish": ["bullish factor 1", "bullish factor 2", "bullish factor 3"],
  "bearish": ["bearish risk 1", "bearish risk 2"],
  "targetPrice": "$X",
  "stopLoss": "$X",
  "riskLevel": "MEDIUM",
  "holdPeriod": "4-8 hours",
  "action": "1 clear sentence telling the user exactly what to do right now"
}

signal must be exactly one of: BUY, HODL, EXIT
riskLevel must be exactly one of: LOW, MEDIUM, HIGH`;
    }

    // ── PIVOT ADVISOR ──────────────────────────────────────────────────────────
    else if (type === "pivot") {
      const { exitSymbol, priceMap, portfolio, coins } = payload;

      const fmt = (n, d = 2) => {
        if (n == null) return "–";
        if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
        if (n >= 1) return n.toFixed(d);
        return n.toFixed(6);
      };

      const snap = (coins || [])
        .map(c => {
          const d = (priceMap || {})[c.cgId] || {};
          return `${c.symbol}: $${fmt(d.usd)} | 24h: ${(d.usd_24h_change || 0).toFixed(2)}%`;
        })
        .join("\n");

      prompt = `You are a professional crypto day-trading AI advisor.

The user is exiting ${exitSymbol} and wants to pivot to the best opportunity right now.

Current Market Snapshot:
${snap}

User's Current Holdings: ${JSON.stringify(portfolio || {})}

Pick the single best coin to pivot into. Rules:
- Do NOT suggest ${exitSymbol}
- Do NOT suggest stablecoins (USDC, USDT, DAI, BUSD)
- Choose based on momentum, volume, and short-term potential

Reply ONLY with valid JSON — no markdown, no code fences, no extra text:
{
  "pivotCoin": "SYMBOL",
  "confidence": 82,
  "exitReason": "1 sentence explaining why exiting ${exitSymbol} makes sense now",
  "entryReason": "1 sentence explaining why this pivot coin is the best choice right now",
  "bullish": ["bullish factor 1", "bullish factor 2", "bullish factor 3"],
  "bearish": ["risk 1", "risk 2"],
  "targetGain": "+7.5%",
  "timeframe": "4-12h",
  "riskLevel": "MEDIUM",
  "stableReason": "1 sentence on how this protects or grows capital"
}

pivotCoin must be a valid symbol from the market snapshot above.
riskLevel must be exactly one of: LOW, MEDIUM, HIGH`;
    }

    else {
      return res.status(400).json({ error: `Unknown type "${type}". Use "deep" or "pivot".` });
    }

    // ── CALL ANTHROPIC ─────────────────────────────────────────────────────────
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", errText);
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await anthropicRes.json();

    // Extract text from response
    const rawText = (data.content || [])
      .map(b => b.text || "")
      .join("")
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    if (!rawText) {
      return res.status(500).json({ error: "Empty response from Anthropic" });
    }

    // Parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("JSON parse error. Raw text:", rawText);
      return res.status(500).json({ error: "Failed to parse AI response as JSON", raw: rawText });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("ai-analysis handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
