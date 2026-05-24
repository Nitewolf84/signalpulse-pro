// api/ai-analysis.js  ─── Vercel Serverless Function
// Place this file at:  /api/ai-analysis.js  in your project root
//
// Required env var in Vercel dashboard:
//   ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxxxxx

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured in Vercel environment variables." });
  }

  try {
    const { type, payload } = req.body;

    let prompt = "";

    // ── DEEP ANALYSIS ──────────────────────────────────────────────────────────
    if (type === "deep") {
      const { coin, price, change, history } = payload;
      const fmt = (n, d = 2) =>
        n == null ? "–" : n >= 1000
          ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
          : n >= 1 ? n.toFixed(d) : n.toFixed(6);

      prompt = `You are a professional crypto trading analyst. Analyze ${coin.name} (${coin.symbol}).
Current price: $${fmt(price)} | 24h change: ${(change || 0).toFixed(2)}%
Recent prices: ${(history || []).slice(-10).map(p => "$" + fmt(p)).join(", ")}

Reply ONLY with valid JSON, no markdown, no extra text:
{
  "summary": "2 clear sentences about current market situation",
  "signal": "BUY or HODL or EXIT",
  "confidence": 78,
  "shortTermOutlook": "1-2 sentences on short term",
  "keyLevels": { "support": "$X", "resistance": "$Y" },
  "bullish": ["point 1", "point 2", "point 3"],
  "bearish": ["risk 1", "risk 2"],
  "targetPrice": "$X",
  "stopLoss": "$X",
  "riskLevel": "LOW or MEDIUM or HIGH",
  "holdPeriod": "e.g. 4-8 hours",
  "action": "1 sentence clear action recommendation"
}`;
    }

    // ── PIVOT ADVISOR ──────────────────────────────────────────────────────────
    else if (type === "pivot") {
      const { exitSymbol, priceMap, portfolio, coins } = payload;
      const fmt = (n, d = 2) =>
        n == null ? "–" : n >= 1000
          ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
          : n >= 1 ? n.toFixed(d) : n.toFixed(6);

      const snap = coins
        .map(c => {
          const d = priceMap[c.cgId] || {};
          return `${c.symbol}: $${fmt(d.usd)} | 24h: ${(d.usd_24h_change || 0).toFixed(2)}%`;
        })
        .join("\n");

      prompt = `You are a crypto day-trading AI. The user is exiting ${exitSymbol}.

Current market snapshot:
${snap}

User holdings: ${JSON.stringify(portfolio)}

Pick the single best pivot coin (NOT ${exitSymbol}, NOT a stablecoin like USDC/USDT/DAI).
Reply ONLY with valid JSON, no markdown, no extra text:
{
  "pivotCoin": "SYMBOL",
  "confidence": 82,
  "exitReason": "1 sentence why exit ${exitSymbol}",
  "entryReason": "1 sentence why enter the pivot coin",
  "bullish": ["factor 1", "factor 2", "factor 3"],
  "bearish": ["risk 1", "risk 2"],
  "targetGain": "+7.5%",
  "timeframe": "4-12h",
  "riskLevel": "LOW or MEDIUM or HIGH",
  "stableReason": "1 sentence on capital preservation if applicable"
}`;
    }

    else {
      return res.status(400).json({ error: "Invalid type. Use 'deep' or 'pivot'." });
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", errText);
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();

    // Parse and validate JSON
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error("ai-analysis error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
