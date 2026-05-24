// ─── /api/coinbase-trade.js ───────────────────────────────────────────────────
// Vercel serverless function — place this file at /api/coinbase-trade.js in your repo
// Handles all Coinbase Advanced Trade API calls securely (keys never exposed to browser)
//
// Supported actions (POST body: { action, ...params }):
//   action: "balances"   → returns account balances
//   action: "market"     → places a market buy or sell order
//   action: "limit"      → places a limit buy or sell order
//   action: "cancel"     → cancels an open order
//   action: "orders"     → lists open orders

import crypto from "crypto";

const CB_API_KEY    = process.env.COINBASE_API_KEY;
const CB_API_SECRET = process.env.COINBASE_API_SECRET;
const CB_BASE_URL   = "https://api.coinbase.com";

// ─── REQUEST SIGNER ──────────────────────────────────────────────────────────
// Coinbase Advanced Trade requires HMAC-SHA256 signature on every request
function signRequest(method, path, body = "") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message   = timestamp + method.toUpperCase() + path + body;
  const signature = crypto
    .createHmac("sha256", CB_API_SECRET)
    .update(message)
    .digest("hex");
  return { timestamp, signature };
}

async function cbFetch(method, path, bodyObj = null) {
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : "";
  const { timestamp, signature } = signRequest(method, path, bodyStr);

  const res = await fetch(`${CB_BASE_URL}${path}`, {
    method,
    headers: {
      "CB-ACCESS-KEY":       CB_API_KEY,
      "CB-ACCESS-SIGN":      signature,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "Content-Type":        "application/json",
    },
    ...(bodyStr ? { body: bodyStr } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_response?.message || data?.message || "Coinbase API error");
  return data;
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers for your Vercel frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  if (!CB_API_KEY || !CB_API_SECRET) {
    return res.status(500).json({ error: "Coinbase API keys not configured in Vercel environment variables." });
  }

  const { action, ...params } = req.body;

  try {
    switch (action) {

      // ── GET BALANCES ──────────────────────────────────────────────────────
      case "balances": {
        const data = await cbFetch("GET", "/api/v3/brokerage/accounts");
        // Map to { SYMBOL: { amount, avgBuy } } format SignalPulse expects
        const balances = {};
        for (const acct of data.accounts || []) {
          const symbol = acct.currency;
          const amount = parseFloat(acct.available_balance?.value || 0);
          if (amount > 0) {
            balances[symbol] = { amount, avgBuy: 0 }; // avgBuy filled from cost basis if available
          }
        }
        return res.status(200).json({ balances });
      }

      // ── MARKET ORDER ──────────────────────────────────────────────────────
      case "market": {
        // params: { mode: "buy"|"sell", symbol: "BTC", usdAmount: 100 }
        const { mode, symbol, usdAmount } = params;
        if (!mode || !symbol || !usdAmount) throw new Error("Missing required params: mode, symbol, usdAmount");

        const productId = `${symbol}-USD`;
        const clientOrderId = `sp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

        const orderConfig = mode === "buy"
          ? { market_market_ioc: { quote_size: usdAmount.toFixed(2) } }  // buy $X worth
          : { market_market_ioc: { base_size: (usdAmount / (params.currentPrice || 1)).toFixed(8) } }; // sell X coins

        const body = {
          client_order_id: clientOrderId,
          product_id:      productId,
          side:            mode === "buy" ? "BUY" : "SELL",
          order_configuration: orderConfig,
        };

        const data = await cbFetch("POST", "/api/v3/brokerage/orders", body);
        return res.status(200).json({
          orderId:       data.order_id || data.success_response?.order_id,
          status:        "completed",
          productId,
          side:          mode,
          usdAmount,
        });
      }

      // ── LIMIT ORDER ───────────────────────────────────────────────────────
      case "limit": {
        // params: { mode: "buy"|"sell", symbol: "BTC", usdAmount: 100, limitPrice: 60000 }
        const { mode, symbol, usdAmount, limitPrice } = params;
        if (!mode || !symbol || !usdAmount || !limitPrice) throw new Error("Missing required params: mode, symbol, usdAmount, limitPrice");

        const productId    = `${symbol}-USD`;
        const clientOrderId = `sp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        const baseSize     = (usdAmount / limitPrice).toFixed(8); // coin quantity

        const body = {
          client_order_id: clientOrderId,
          product_id:      productId,
          side:            mode === "buy" ? "BUY" : "SELL",
          order_configuration: {
            limit_limit_gtc: {
              base_size:   baseSize,
              limit_price: limitPrice.toFixed(2),
              post_only:   false,
            },
          },
        };

        const data = await cbFetch("POST", "/api/v3/brokerage/orders", body);
        return res.status(200).json({
          orderId:    data.order_id || data.success_response?.order_id,
          status:     "pending",
          productId,
          side:       mode,
          usdAmount,
          limitPrice,
          baseSize,
        });
      }

      // ── CANCEL ORDER ──────────────────────────────────────────────────────
      case "cancel": {
        const { orderId } = params;
        if (!orderId) throw new Error("Missing orderId");
        await cbFetch("POST", "/api/v3/brokerage/orders/batch_cancel", { order_ids: [orderId] });
        return res.status(200).json({ success: true, orderId });
      }

      // ── LIST OPEN ORDERS ──────────────────────────────────────────────────
      case "orders": {
        const data = await cbFetch("GET", "/api/v3/brokerage/orders/historical/batch?order_status=OPEN");
        const orders = (data.orders || []).map(o => ({
          orderId:    o.order_id,
          productId:  o.product_id,
          symbol:     o.product_id.replace("-USD",""),
          side:       o.side.toLowerCase(),
          type:       o.order_configuration?.limit_limit_gtc ? "limit" : "market",
          limitPrice: parseFloat(o.order_configuration?.limit_limit_gtc?.limit_price || 0),
          baseSize:   parseFloat(o.order_configuration?.limit_limit_gtc?.base_size || 0),
          status:     o.status.toLowerCase(),
          createdAt:  o.created_time,
        }));
        return res.status(200).json({ orders });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Coinbase API error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
