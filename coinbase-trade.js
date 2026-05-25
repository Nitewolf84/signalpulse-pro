// api/coinbase-trade.js
// Vercel serverless function — handles live trading per user
// Each user passes their own Coinbase API key + secret with every request

import crypto from "crypto";

const BASE = "https://api.coinbase.com";

// Build Coinbase Advanced Trade auth headers using user's own keys
function buildHeaders(method, path, body, apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + (body || "");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(message)
    .digest("hex");
  return {
    "Content-Type": "application/json",
    "CB-ACCESS-KEY": apiKey,
    "CB-ACCESS-SIGN": signature,
    "CB-ACCESS-TIMESTAMP": timestamp,
  };
}

async function cbRequest(method, path, body, apiKey, apiSecret) {
  const bodyStr = body ? JSON.stringify(body) : "";
  const headers = buildHeaders(method, path, bodyStr, apiKey, apiSecret);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Coinbase API error");
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, apiKey, apiSecret, ...params } = req.body;

  // Validate keys present for live actions
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: "API key and secret are required for live trading." });
  }

  try {
    switch (action) {

      // ── GET USER BALANCES ──────────────────────────────────────────────
      case "balances": {
        const data = await cbRequest("GET", "/api/v3/brokerage/accounts", null, apiKey, apiSecret);
        const balances = {};
        for (const acct of data.accounts || []) {
          const sym = acct.currency;
          const amt = parseFloat(acct.available_balance?.value || 0);
          if (amt > 0) balances[sym] = { amount: amt, avgBuy: 0 };
        }
        return res.json({ balances });
      }

      // ── PLACE MARKET ORDER ─────────────────────────────────────────────
      case "market": {
        const { mode, symbol, usdAmount } = params;
        const productId = `${symbol}-USDC`;
        const side = mode === "buy" ? "BUY" : "SELL";

        const orderConfig = mode === "buy"
          ? { market_market_ioc: { quote_size: usdAmount.toFixed(2) } }
          : { market_market_ioc: { base_size: (usdAmount / (params.currentPrice || 1)).toFixed(8) } };

        const order = await cbRequest("POST", "/api/v3/brokerage/orders", {
          client_order_id: `sp_${Date.now()}`,
          product_id: productId,
          side,
          order_configuration: orderConfig,
        }, apiKey, apiSecret);

        return res.json({
          orderId: order.success_response?.order_id || order.order_id || ("cb_" + Date.now()),
          status: "completed",
        });
      }

      // ── PLACE LIMIT ORDER ──────────────────────────────────────────────
      case "limit": {
        const { mode, symbol, usdAmount, limitPrice } = params;
        const productId = `${symbol}-USDC`;
        const side = mode === "buy" ? "BUY" : "SELL";
        const baseSize = (usdAmount / limitPrice).toFixed(8);

        const order = await cbRequest("POST", "/api/v3/brokerage/orders", {
          client_order_id: `sp_${Date.now()}`,
          product_id: productId,
          side,
          order_configuration: {
            limit_limit_gtc: {
              base_size: baseSize,
              limit_price: limitPrice.toFixed(2),
              post_only: false,
            },
          },
        }, apiKey, apiSecret);

        return res.json({
          orderId: order.success_response?.order_id || ("cb_" + Date.now()),
          status: "pending",
        });
      }

      // ── CANCEL ORDER ───────────────────────────────────────────────────
      case "cancel": {
        const { orderId } = params;
        await cbRequest("POST", "/api/v3/brokerage/orders/batch_cancel",
          { order_ids: [orderId] }, apiKey, apiSecret);
        return res.json({ success: true });
      }

      // ── LIST OPEN ORDERS ───────────────────────────────────────────────
      case "orders": {
        const data = await cbRequest("GET",
          "/api/v3/brokerage/orders/historical/batch?order_status=OPEN",
          null, apiKey, apiSecret);
        return res.json({ orders: data.orders || [] });
      }

      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    console.error("Coinbase trade error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
