import { useState, useEffect, useCallback } from "react";

// ============================================================
// SIGNALPULSE PRO — WALLET INTEGRATION
// Supports: MetaMask, Coinbase Wallet, WalletConnect
// Features: Connect, Live Balance, Buy/Sell/Transfer
// ============================================================

const SUPPORTED_WALLETS = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Browser extension wallet",
    color: "#F6851B",
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    description: "Coinbase mobile or extension",
    color: "#0052FF",
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    icon: "🔗",
    description: "500+ wallets via QR code",
    color: "#3B99FC",
  },
];

const MOCK_TOKENS = [
  { symbol: "ETH", name: "Ethereum", balance: "1.2847", price: 3821.44, change: 2.31, icon: "⟠" },
  { symbol: "BTC", name: "Bitcoin", balance: "0.0412", price: 67420.0, change: -0.87, icon: "₿" },
  { symbol: "SOL", name: "Solana", balance: "24.51", price: 142.88, change: 5.12, icon: "◎" },
  { symbol: "USDC", name: "USD Coin", balance: "450.00", price: 1.0, change: 0.0, icon: "💲" },
];

// ── Utility ──────────────────────────────────────────────────
const shortenAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

const formatUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const calcPortfolioValue = (tokens) =>
  tokens.reduce((sum, t) => sum + parseFloat(t.balance) * t.price, 0);

// ── Styles ───────────────────────────────────────────────────
const styles = {
  // Layout
  page: {
    minHeight: "100vh",
    background: "#0a0a0f",
    fontFamily: "'Courier New', monospace",
    color: "#e2e8f0",
    padding: "0",
  },
  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "24px 16px",
  },

  // Header
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
    paddingBottom: 16,
    borderBottom: "1px solid #1e2030",
  },
  logo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00ff88",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  statusDot: (connected) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: connected ? "#00ff88" : "#ff4444",
    display: "inline-block",
    marginRight: 6,
    boxShadow: connected ? "0 0 8px #00ff88" : "none",
  }),
  statusText: {
    fontSize: 11,
    color: "#64748b",
    letterSpacing: 1,
  },

  // Cards
  card: {
    background: "#0f1117",
    border: "1px solid #1e2030",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardGreen: {
    background: "linear-gradient(135deg, #0a1f14 0%, #0f1117 100%)",
    border: "1px solid #00ff8833",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },

  // Connect screen
  connectTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: 1,
  },
  connectSub: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 24,
    lineHeight: 1.6,
  },
  walletBtn: (active, color) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    marginBottom: 10,
    background: active ? `${color}15` : "#0a0a0f",
    border: `1px solid ${active ? color : "#1e2030"}`,
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.2s",
    color: "#e2e8f0",
  }),
  walletIcon: {
    fontSize: 24,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1e2030",
    borderRadius: 8,
  },
  walletName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 2,
  },
  walletDesc: {
    fontSize: 11,
    color: "#64748b",
  },

  // Portfolio
  portfolioValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#00ff88",
    letterSpacing: -1,
    marginBottom: 4,
  },
  portfolioChange: (positive) => ({
    fontSize: 13,
    color: positive ? "#00ff88" : "#ff4444",
    marginBottom: 16,
  }),
  addressBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#1e2030",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 20,
    cursor: "pointer",
  },

  // Token rows
  tokenRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #1e203066",
  },
  tokenLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  tokenIconBg: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#1e2030",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  tokenBalance: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  tokenValue: {
    textAlign: "right",
  },
  tokenUSD: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#e2e8f0",
  },
  tokenChange: (positive) => ({
    fontSize: 11,
    color: positive ? "#00ff88" : "#ff4444",
    marginTop: 2,
  }),

  // Action buttons
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginTop: 20,
  },
  actionBtn: (color) => ({
    padding: "12px 8px",
    background: `${color}15`,
    border: `1px solid ${color}44`,
    borderRadius: 10,
    color: color,
    fontSize: 12,
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "center",
    letterSpacing: 1,
    transition: "all 0.2s",
  }),

  // Transaction modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 100,
    backdropFilter: "blur(4px)",
  },
  modal: {
    width: "100%",
    maxWidth: 480,
    background: "#0f1117",
    border: "1px solid #1e2030",
    borderRadius: "20px 20px 0 0",
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: 1,
  },
  modalSub: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    color: "#64748b",
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    background: "#0a0a0f",
    border: "1px solid #1e2030",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#e2e8f0",
    fontSize: 16,
    marginBottom: 16,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Courier New', monospace",
  },
  select: {
    width: "100%",
    background: "#0a0a0f",
    border: "1px solid #1e2030",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#e2e8f0",
    fontSize: 14,
    marginBottom: 16,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Courier New', monospace",
  },
  submitBtn: (color) => ({
    width: "100%",
    padding: "14px",
    background: `linear-gradient(135deg, ${color}, ${color}aa)`,
    border: "none",
    borderRadius: 10,
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
    letterSpacing: 1,
    marginTop: 4,
  }),
  cancelBtn: {
    width: "100%",
    padding: "12px",
    background: "transparent",
    border: "1px solid #1e2030",
    borderRadius: 10,
    color: "#64748b",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 10,
    letterSpacing: 1,
    fontFamily: "'Courier New', monospace",
  },

  // Toast
  toast: (type) => ({
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: type === "success" ? "#00ff8822" : "#ff444422",
    border: `1px solid ${type === "success" ? "#00ff88" : "#ff4444"}`,
    borderRadius: 10,
    padding: "12px 24px",
    color: type === "success" ? "#00ff88" : "#ff4444",
    fontSize: 13,
    fontWeight: "bold",
    zIndex: 200,
    letterSpacing: 1,
    whiteSpace: "nowrap",
  }),

  // Security note
  secNote: {
    display: "flex",
    gap: 10,
    padding: 14,
    background: "#0a1f14",
    border: "1px solid #00ff8822",
    borderRadius: 8,
    marginTop: 16,
  },
  secText: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.6,
  },

  disconnectBtn: {
    width: "100%",
    padding: "11px",
    background: "transparent",
    border: "1px solid #ff444444",
    borderRadius: 8,
    color: "#ff4444",
    fontSize: 12,
    cursor: "pointer",
    letterSpacing: 1,
    marginTop: 8,
    fontFamily: "'Courier New', monospace",
  },

  sectionLabel: {
    fontSize: 11,
    color: "#64748b",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 4,
  },

  liveTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "#00ff8815",
    border: "1px solid #00ff8833",
    borderRadius: 20,
    padding: "3px 10px",
    fontSize: 10,
    color: "#00ff88",
    letterSpacing: 1,
    marginBottom: 16,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#00ff88",
    animation: "pulse 1.5s infinite",
  },
};

// ── Subcomponents ─────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div style={styles.toast(type)}>{message}</div>;
}

function TokenRow({ token, onAction }) {
  const value = parseFloat(token.balance) * token.price;
  const positive = token.change >= 0;
  return (
    <div style={styles.tokenRow}>
      <div style={styles.tokenLeft}>
        <div style={styles.tokenIconBg}>{token.icon}</div>
        <div>
          <div style={styles.tokenSymbol}>{token.symbol}</div>
          <div style={styles.tokenBalance}>
            {token.balance} {token.symbol}
          </div>
        </div>
      </div>
      <div style={styles.tokenValue}>
        <div style={styles.tokenUSD}>{formatUSD(value)}</div>
        <div style={styles.tokenChange(positive)}>
          {positive ? "▲" : "▼"} {Math.abs(token.change)}%
        </div>
      </div>
    </div>
  );
}

function TransactionModal({ type, tokens, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState(tokens[0]?.symbol || "ETH");
  const [confirming, setConfirming] = useState(false);

  const colorMap = { BUY: "#00ff88", SELL: "#ff9900", TRANSFER: "#3B99FC" };
  const color = colorMap[type];

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (type === "TRANSFER" && !toAddress) return;
    setConfirming(true);
    setTimeout(() => {
      onSubmit({ type, token: selectedToken, amount, toAddress });
      setConfirming(false);
    }, 1800);
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalTitle}>{type} CRYPTO</div>
        <div style={styles.modalSub}>
          {type === "BUY" && "Purchase crypto with your connected wallet"}
          {type === "SELL" && "Sell crypto from your wallet balance"}
          {type === "TRANSFER" && "Send crypto to another wallet address"}
        </div>

        <div style={styles.label}>Token</div>
        <select
          style={styles.select}
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
        >
          {tokens.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol} — {t.balance} available
            </option>
          ))}
        </select>

        <div style={styles.label}>Amount ({selectedToken})</div>
        <input
          style={styles.input}
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {type === "TRANSFER" && (
          <>
            <div style={styles.label}>Recipient Address</div>
            <input
              style={styles.input}
              type="text"
              placeholder="0x..."
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
            />
          </>
        )}

        <div
          style={{
            background: "#0a0a0f",
            border: "1px solid #1e2030",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>ESTIMATED VALUE</div>
          <div style={{ fontSize: 18, color, fontWeight: "bold" }}>
            {amount
              ? formatUSD(
                  parseFloat(amount) *
                    (tokens.find((t) => t.symbol === selectedToken)?.price || 0)
                )
              : "$0.00"}
          </div>
        </div>

        <button
          style={styles.submitBtn(color)}
          onClick={handleSubmit}
          disabled={confirming}
        >
          {confirming ? "⏳ CONFIRMING ON CHAIN..." : `✓ CONFIRM ${type}`}
        </button>
        <button style={styles.cancelBtn} onClick={onClose}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function WalletIntegration() {
  const [screen, setScreen] = useState("connect"); // connect | portfolio
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [tokens, setTokens] = useState(MOCK_TOKENS);
  const [activeModal, setActiveModal] = useState(null); // BUY | SELL | TRANSFER | null
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [copied, setCopied] = useState(false);

  // Simulate live price updates every 30s
  useEffect(() => {
    if (screen !== "portfolio") return;
    const interval = setInterval(() => {
      setTokens((prev) =>
        prev.map((t) => ({
          ...t,
          price: t.symbol === "USDC" ? 1.0 : t.price * (1 + (Math.random() - 0.5) * 0.004),
          change: t.symbol === "USDC" ? 0 : +(Math.random() * 6 - 3).toFixed(2),
        }))
      );
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [screen]);

  const handleConnect = useCallback(() => {
    if (!selectedWallet) return;
    setConnecting(true);

    // Simulate wallet connection handshake
    setTimeout(() => {
      const mockAddresses = {
        metamask: "0xAbC3...f9E2",
        coinbase: "0xdeaf...9924",
        walletconnect: "0x71bF...4a1C",
      };
      setWalletAddress(mockAddresses[selectedWallet]);
      setConnecting(false);
      setScreen("portfolio");
      setToast({ message: "✓ WALLET CONNECTED SUCCESSFULLY", type: "success" });
    }, 2000);
  }, [selectedWallet]);

  const handleDisconnect = () => {
    setScreen("connect");
    setSelectedWallet(null);
    setWalletAddress("");
    setToast({ message: "WALLET DISCONNECTED", type: "error" });
  };

  const handleCopyAddress = () => {
    navigator.clipboard?.writeText(walletAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTransaction = ({ type, token, amount }) => {
    setActiveModal(null);
    setToast({
      message: `✓ ${type} ${amount} ${token} SUBMITTED`,
      type: "success",
    });
  };

  const portfolioValue = calcPortfolioValue(tokens);
  const dailyChange = tokens.reduce(
    (sum, t) => sum + (parseFloat(t.balance) * t.price * t.change) / 100,
    0
  );

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        button:hover { opacity: 0.85; }
      `}</style>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {activeModal && (
        <TransactionModal
          type={activeModal}
          tokens={tokens}
          onClose={() => setActiveModal(null)}
          onSubmit={handleTransaction}
        />
      )}

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>SignalPulse Pro</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={styles.statusDot(screen === "portfolio")} />
            <span style={styles.statusText}>
              {screen === "portfolio" ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* ── CONNECT SCREEN ── */}
        {screen === "connect" && (
          <>
            <div style={styles.connectTitle}>Connect Your Wallet</div>
            <div style={styles.connectSub}>
              Your wallet is private to you. We use read/write access to enable trading
              directly through SignalPulse Pro. You sign every transaction yourself.
            </div>

            <div style={styles.sectionLabel}>Choose Wallet</div>
            {SUPPORTED_WALLETS.map((w) => (
              <button
                key={w.id}
                style={styles.walletBtn(selectedWallet === w.id, w.color)}
                onClick={() => setSelectedWallet(w.id)}
              >
                <div style={styles.walletIcon}>{w.icon}</div>
                <div style={{ textAlign: "left" }}>
                  <div style={styles.walletName}>{w.name}</div>
                  <div style={styles.walletDesc}>{w.description}</div>
                </div>
                {selectedWallet === w.id && (
                  <div style={{ marginLeft: "auto", color: w.color, fontSize: 18 }}>✓</div>
                )}
              </button>
            ))}

            <button
              style={{
                ...styles.submitBtn("#00ff88"),
                marginTop: 8,
                opacity: selectedWallet && !connecting ? 1 : 0.4,
              }}
              onClick={handleConnect}
              disabled={!selectedWallet || connecting}
            >
              {connecting ? "⏳ CONNECTING..." : "CONNECT WALLET →"}
            </button>

            <div style={styles.secNote}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <div style={styles.secText}>
                <strong style={{ color: "#00ff88" }}>Your wallet stays private.</strong> Each
                user connects their own wallet — no one else can see your address, balance, or
                transactions. You sign every trade personally from your own device.
              </div>
            </div>
          </>
        )}

        {/* ── PORTFOLIO SCREEN ── */}
        {screen === "portfolio" && (
          <>
            {/* Live tag */}
            <div style={styles.liveTag}>
              <div style={styles.liveDot} />
              LIVE · Updated {lastUpdated.toLocaleTimeString()}
            </div>

            {/* Portfolio value card */}
            <div style={styles.cardGreen}>
              <div
                style={styles.addressBadge}
                onClick={handleCopyAddress}
                title="Click to copy"
              >
                {SUPPORTED_WALLETS.find((w) => w.id === selectedWallet)?.icon}{" "}
                {walletAddress} {copied ? "✓ Copied" : "⎘"}
              </div>
              <div style={styles.portfolioValue}>{formatUSD(portfolioValue)}</div>
              <div style={styles.portfolioChange(dailyChange >= 0)}>
                {dailyChange >= 0 ? "▲" : "▼"} {formatUSD(Math.abs(dailyChange))} today (
                {((dailyChange / portfolioValue) * 100).toFixed(2)}%)
              </div>

              {/* Action buttons */}
              <div style={styles.actionGrid}>
                <button
                  style={styles.actionBtn("#00ff88")}
                  onClick={() => setActiveModal("BUY")}
                >
                  ↓ BUY
                </button>
                <button
                  style={styles.actionBtn("#ff9900")}
                  onClick={() => setActiveModal("SELL")}
                >
                  ↑ SELL
                </button>
                <button
                  style={styles.actionBtn("#3B99FC")}
                  onClick={() => setActiveModal("TRANSFER")}
                >
                  → SEND
                </button>
              </div>
            </div>

            {/* Token holdings */}
            <div style={styles.card}>
              <div style={styles.sectionLabel}>Holdings</div>
              {tokens.map((t) => (
                <TokenRow key={t.symbol} token={t} />
              ))}
            </div>

            {/* Disconnect */}
            <button style={styles.disconnectBtn} onClick={handleDisconnect}>
              DISCONNECT WALLET
            </button>
          </>
        )}
      </div>
    </div>
  );
}
