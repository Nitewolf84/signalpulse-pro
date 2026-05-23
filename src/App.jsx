import { useState, useEffect, useRef, useCallback } from "react";

// ─── OWNER CONFIG ─────────────────────────────────────────────────────────────
const OWNER_KEY = "OWNER-SIGNALPULSE-FREE";

// ─── DEMO PORTFOLIO ───────────────────────────────────────────────────────────
const DEMO_PORTFOLIO = {
  BTC:  { amount: 0.085, avgBuy: 61200 },
  ETH:  { amount: 1.42,  avgBuy: 3200  },
  SOL:  { amount: 12.5,  avgBuy: 155   },
  USDC: { amount: 2840,  avgBuy: 1     },
};

// ─── COINS ────────────────────────────────────────────────────────────────────
const COINS = [
  { symbol:"BTC",  name:"Bitcoin",   color:"#F7931A", cgId:"bitcoin"     },
  { symbol:"ETH",  name:"Ethereum",  color:"#627EEA", cgId:"ethereum"    },
  { symbol:"SOL",  name:"Solana",    color:"#9945FF", cgId:"solana"      },
  { symbol:"ADA",  name:"Cardano",   color:"#0055FF", cgId:"cardano"     },
  { symbol:"AVAX", name:"Avalanche", color:"#E84142", cgId:"avalanche-2" },
  { symbol:"LINK", name:"Chainlink", color:"#2A5ADA", cgId:"chainlink"   },
  { symbol:"DOT",  name:"Polkadot",  color:"#E6007A", cgId:"polkadot"    },
  { symbol:"XRP",  name:"XRP",       color:"#00AAE4", cgId:"ripple"      },
];

const S = {
  SPLASH:"splash", LANDING:"landing", LOGIN:"login", SIGNUP:"signup",
  PAYWALL:"paywall", MAIN:"main", PIVOT:"pivot", DEEP:"deep",
  SETTINGS:"settings", ADMIN:"admin"
};

// ─── FONT STACK ───────────────────────────────────────────────────────────────
// Clash Display for headlines — modern, geometric, premium
// Plus Jakarta Sans for body — clean, readable, contemporary
const FONT_DISPLAY = "'Clash Display', 'Sora', 'Plus Jakarta Sans', sans-serif";
const FONT_BODY    = "'Plus Jakarta Sans', 'Outfit', 'Inter', sans-serif";
const FONT_NUM     = "'Sora', 'Plus Jakarta Sans', sans-serif";

const GOOGLE_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@300;400;600;700;800&display=swap');
  @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes rpl    { 0%{box-shadow:0 0 0 0 rgba(99,102,241,.5)} 70%{box-shadow:0 0 0 10px rgba(99,102,241,0)} 100%{box-shadow:0 0 0 0 rgba(99,102,241,0)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  input::placeholder { color: rgba(255,255,255,.25); }
  input:focus { border-color: rgba(99,102,241,.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }
  input[type=range] { -webkit-appearance:none; height:4px; border-radius:2px; background:rgba(255,255,255,.1); outline:none; cursor:pointer; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#6366F1; cursor:pointer; border:2px solid rgba(255,255,255,.8); box-shadow:0 2px 8px rgba(99,102,241,.5); }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt  = (n,d=2) => n==null?"–":n>=1000?n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):n>=1?n.toFixed(d):n.toFixed(6);
const usd  = n => "$"+fmt(n);
const pct  = n => (n>=0?"+":"")+((n||0).toFixed(2))+"%";
const ago  = ts => { const s=Math.floor((Date.now()-ts)/1000); return s<60?s+"s ago":s<3600?Math.floor(s/60)+"m ago":Math.floor(s/3600)+"h ago"; };
const clamp= (v,a,b) => Math.max(a,Math.min(b,v));

// ─── MOCK AUTH ────────────────────────────────────────────────────────────────
const MOCK_KEY = "sp_users_v2";
const getUsers = () => { try { return JSON.parse(localStorage.getItem(MOCK_KEY)||"[]"); } catch(_){ return []; } };
const saveUsers = u => localStorage.setItem(MOCK_KEY, JSON.stringify(u));

async function signUpUser(email, password, name) {
  const users = getUsers();
  if(users.find(u=>u.email===email)) throw new Error("Email already registered.");
  const user = { id:Date.now().toString(), email, password, name,
    createdAt:new Date().toISOString(), subscribed:false, provider:"email" };
  users.push(user); saveUsers(users); return user;
}
async function signInUser(email, password) {
  const user = getUsers().find(u=>u.email===email&&u.password===password);
  if(!user) throw new Error("Incorrect email or password.");
  return user;
}
async function signInGoogle() {
  return { id:"g_"+Date.now(), email:"demo@gmail.com", name:"Google User",
    subscribed:false, provider:"google", createdAt:new Date().toISOString() };
}
function updateUserSub(userId, val) {
  const users=getUsers(), idx=users.findIndex(u=>u.id===userId);
  if(idx>=0){ users[idx].subscribed=val; saveUsers(users); return users[idx]; }
}

// ─── COINGECKO ────────────────────────────────────────────────────────────────
async function fetchCGPrices() {
  const ids=COINS.map(c=>c.cgId).join(",");
  const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`);
  if(!r.ok) throw new Error("CG");
  return r.json();
}

// ─── CLAUDE AI ────────────────────────────────────────────────────────────────
async function aiPivot(exitSymbol, priceMap, portfolio) {
  const snap=COINS.map(c=>{const d=priceMap[c.cgId]||{};return `${c.symbol}: $${fmt(d.usd)} | 24h: ${(d.usd_24h_change||0).toFixed(2)}%`;}).join("\n");
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,
      messages:[{role:"user",content:`Crypto day-trading AI. User exits ${exitSymbol}.\n${snap}\nHoldings: ${JSON.stringify(portfolio)}\nPick best pivot coin (NOT ${exitSymbol}, NOT stablecoin). Reply ONLY JSON:\n{"pivotCoin":"SYMBOL","confidence":82,"exitReason":"1 sentence","entryReason":"1 sentence","bullish":["f1","f2","f3"],"bearish":["r1","r2"],"targetGain":"+7.5%","timeframe":"4-12h","riskLevel":"MEDIUM","stableReason":"1 sentence"}`}]})});
  const d=await r.json();
  return JSON.parse((d.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());
}
async function aiDeep(coin, price, change, history) {
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,
      messages:[{role:"user",content:`Crypto advisor. ${coin.name} (${coin.symbol}) $${fmt(price)} | 24h: ${(change||0).toFixed(2)}%\nPrices: ${(history||[]).slice(-10).map(p=>"$"+fmt(p)).join(", ")}\nReply ONLY JSON:\n{"summary":"2 sentences","signal":"BUY|HODL|EXIT","confidence":78,"shortTermOutlook":"1-2 sentences","keyLevels":{"support":"$X","resistance":"$Y"},"bullish":["p1","p2","p3"],"bearish":["r1","r2"],"targetPrice":"$X","stopLoss":"$X","riskLevel":"LOW|MEDIUM|HIGH","holdPeriod":"time","action":"1 sentence"}`}]})});
  const d=await r.json();
  return JSON.parse((d.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
const T = {
  // Backgrounds — deep navy not black, more premium
  bg0: "#060A14",
  bg1: "#0B1120",
  bg2: "#111827",
  bg3: "rgba(255,255,255,.04)",
  // Accent — indigo/violet spectrum
  accent:  "#6366F1",
  accent2: "#818CF8",
  accent3: "#C7D2FE",
  // Semantic
  green:  "#10B981",
  green2: "#34D399",
  red:    "#EF4444",
  red2:   "#FCA5A5",
  gold:   "#F59E0B",
  gold2:  "#FCD34D",
  blue:   "#3B82F6",
  // Text
  t1: "#F1F5FD",
  t2: "#94A3B8",
  t3: "#475569",
  t4: "#1E293B",
  // Borders
  b1: "rgba(255,255,255,.08)",
  b2: "rgba(255,255,255,.05)",
  // Radius
  r1: 16, r2: 12, r3: 8, r4: 6,
};

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function LiveDot({active=true}) {
  return <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
    <span style={{width:7,height:7,borderRadius:"50%",background:active?T.green:"rgba(255,255,255,.2)",
      flexShrink:0, animation:active?"rpl 2s infinite":"none",
      boxShadow:active?`0 0 0 0 ${T.green}55`:"none"}}/>
  </span>;
}

function Spark({data,color,w=80,h=32}) {
  if(!data||data.length<2) return <svg width={w} height={h}/>;
  const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*(h-5)-2}`).join(" ");
  const up=data[data.length-1]>=data[0];
  const lineColor = up ? T.green : T.red;
  const gradId = `g${color.replace(/[^a-z0-9]/gi,"")}`;
  return <svg width={w} height={h} style={{overflow:"visible"}}>
    <defs>
      <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={lineColor} stopOpacity=".2"/>
        <stop offset="100%" stopColor={lineColor} stopOpacity="0"/>
      </linearGradient>
    </defs>
    <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function Pill({label, variant="neutral"}) {
  const variants = {
    BUY:    {bg:"rgba(16,185,129,.12)", c:T.green2,  b:"rgba(16,185,129,.25)"},
    EXIT:   {bg:"rgba(239,68,68,.12)",  c:T.red2,    b:"rgba(239,68,68,.25)"},
    HODL:   {bg:"rgba(245,158,11,.1)",  c:T.gold2,   b:"rgba(245,158,11,.25)"},
    HIGH:   {bg:"rgba(239,68,68,.1)",   c:T.red2,    b:"rgba(239,68,68,.2)"},
    MEDIUM: {bg:"rgba(245,158,11,.1)",  c:T.gold2,   b:"rgba(245,158,11,.2)"},
    LOW:    {bg:"rgba(16,185,129,.1)",  c:T.green2,  b:"rgba(16,185,129,.2)"},
    PRO:    {bg:"rgba(99,102,241,.15)", c:T.accent3, b:"rgba(99,102,241,.3)"},
    FREE:   {bg:"rgba(71,85,105,.2)",   c:T.t2,      b:"rgba(71,85,105,.3)"},
    DEMO:   {bg:"rgba(99,102,241,.1)",  c:T.accent2, b:"rgba(99,102,241,.25)"},
    LIVE:   {bg:"rgba(16,185,129,.1)",  c:T.green,   b:"rgba(16,185,129,.25)"},
    neutral:{bg:"rgba(255,255,255,.06)",c:T.t2,      b:T.b1},
  };
  const s = variants[label]||variants.neutral;
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 10px",
    borderRadius:20,fontSize:11,fontWeight:600,letterSpacing:".02em",
    fontFamily:FONT_BODY,border:`1px solid ${s.b}`,background:s.bg,color:s.c,
    whiteSpace:"nowrap"}}>{label}</span>;
}

function ProgressBar({val, color=T.accent, height=3}) {
  return <div style={{display:"flex",alignItems:"center",gap:10}}>
    <div style={{flex:1,height,background:"rgba(255,255,255,.06)",borderRadius:height,overflow:"hidden"}}>
      <div style={{width:`${val}%`,height:"100%",background:color,borderRadius:height,
        transition:"width .8s cubic-bezier(.4,0,.2,1)",
        boxShadow:`0 0 10px ${color}44`}}/>
    </div>
    <span style={{fontSize:12,color:T.t2,fontFamily:FONT_NUM,fontWeight:600,minWidth:32}}>{val}%</span>
  </div>;
}

function CoinAvatar({coin, size=40}) {
  return <div style={{width:size,height:size,borderRadius:size*.3,flexShrink:0,
    background:`${coin.color}18`,border:`1px solid ${coin.color}30`,
    display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:size*.28,fontWeight:700,color:coin.color,fontFamily:FONT_BODY}}>
    {coin.symbol.slice(0,3)}
  </div>;
}

function Card({children, style={}, accent}) {
  return <div style={{
    background:T.bg2,
    border:`1px solid ${accent?`${accent}25`:T.b1}`,
    borderRadius:T.r1,padding:16,
    boxShadow:"0 1px 3px rgba(0,0,0,.3)",
    ...style}}>
    {children}
  </div>;
}

function FormInput({label, type="text", value, onChange, placeholder, error, autoComplete}) {
  return <div style={{marginBottom:16}}>
    {label&&<label style={{fontSize:12,color:T.t2,fontWeight:600,fontFamily:FONT_BODY,
      marginBottom:6,display:"block"}}>{label}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} autoComplete={autoComplete}
      style={{width:"100%",background:T.bg1,border:`1px solid ${error?"rgba(239,68,68,.5)":T.b1}`,
        borderRadius:T.r3,padding:"12px 16px",color:T.t1,fontSize:14,
        fontFamily:FONT_BODY,outline:"none",boxSizing:"border-box",transition:"all .2s"}}/>
    {error&&<p style={{fontSize:12,color:T.red,marginTop:4,fontFamily:FONT_BODY}}>{error}</p>}
  </div>;
}

function SocialBtn({icon, label, onClick}) {
  return <button onClick={onClick} style={{width:"100%",padding:"13px",borderRadius:T.r3,
    border:`1px solid ${T.b1}`,background:T.bg2,color:T.t1,fontSize:14,
    fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",
    justifyContent:"center",gap:10,fontFamily:FONT_BODY,transition:"all .2s",
    marginBottom:8}}>
    <span style={{fontSize:18}}>{icon}</span>{label}
  </button>;
}

function Divider({label}) {
  return <div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0"}}>
    <div style={{flex:1,height:1,background:T.b1}}/>
    <span style={{fontSize:12,color:T.t3,fontFamily:FONT_BODY,fontWeight:500}}>{label}</span>
    <div style={{flex:1,height:1,background:T.b1}}/>
  </div>;
}

function Btn({children, onClick, variant="primary", disabled, style={}}) {
  const variants = {
    primary:   {background:`linear-gradient(135deg,#6366F1,#818CF8)`,color:"#fff",border:"none"},
    secondary: {background:T.bg2,color:T.t1,border:`1px solid ${T.b1}`},
    danger:    {background:"rgba(239,68,68,.1)",color:T.red,border:"1px solid rgba(239,68,68,.2)"},
    paypal:    {background:"linear-gradient(135deg,#009CDE,#003087)",color:"#fff",border:"none"},
    ghost:     {background:"transparent",color:T.t2,border:"none"},
    success:   {background:`linear-gradient(135deg,#059669,#10B981)`,color:"#fff",border:"none"},
  };
  const v = variants[variant]||variants.primary;
  return <button onClick={onClick} disabled={disabled} style={{
    width:"100%",padding:"14px",borderRadius:T.r3,...v,
    fontSize:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",
    fontFamily:FONT_BODY,letterSpacing:".02em",transition:"all .2s",
    opacity:disabled?.6:1,...style}}>
    {children}
  </button>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function SignalPulsePro() {
  const [screen,setScreen]       = useState(S.SPLASH);
  const [tab,setTab]             = useState("signals");
  const [user,setUser]           = useState(null);
  const [isOwner,setIsOwner]     = useState(false);

  const [authName,setAuthName]   = useState("");
  const [authEmail,setAuthEmail] = useState("");
  const [authPass,setAuthPass]   = useState("");
  const [authErr,setAuthErr]     = useState("");
  const [authBusy,setAuthBusy]   = useState(false);
  const [ownerInput,setOwnerInput] = useState("");

  const [prices,setPrices]       = useState({});
  const [histories,setHistories] = useState({});
  const [signals,setSignals]     = useState({});
  const [notes,setNotes]         = useState([]);
  const [unread,setUnread]       = useState(0);
  const [lastFetch,setLastFetch] = useState(null);
  const [fetching,setFetching]   = useState(false);
  const priceRef                 = useRef(null);

  const [portfolio,setPortfolio] = useState(DEMO_PORTFOLIO);
  const [tradeLog,setTradeLog]   = useState([]);

  const [pivotCoin,setPivotCoin] = useState(null);
  const [pivotRec,setPivotRec]   = useState(null);
  const [pivotBusy,setPivotBusy] = useState(false);
  const [pivotPct,setPivotPct]   = useState(60);
  const [remainder,setRemainder] = useState("HODL");
  const [confirming,setConfirming] = useState(false);
  const [tradeMsg,setTradeMsg]   = useState("");

  const [deepCoin,setDeepCoin]   = useState(null);
  const [deepData,setDeepData]   = useState({});
  const [deepBusy,setDeepBusy]   = useState({});

  const [adminUsers,setAdminUsers] = useState([]);

  // Splash
  useEffect(()=>{ const t=setTimeout(()=>setScreen(S.LANDING),2000); return()=>clearTimeout(t); },[]);

  // Market feed
  const fetchMarket = useCallback(async()=>{
    setFetching(true);
    try {
      const data=await fetchCGPrices();
      setPrices(data);
      setHistories(prev=>{
        const next={...prev};
        COINS.forEach(c=>{ const p=data[c.cgId]?.usd; if(p){ const a=[...(prev[c.cgId]||[p])]; a.push(p); if(a.length>24)a.shift(); next[c.cgId]=a; } });
        return next;
      });
      const sigs={},newN=[];
      COINS.forEach(c=>{
        const ch=data[c.cgId]?.usd_24h_change||0;
        let action,confidence,reason;
        if(ch>4){action="BUY";confidence=clamp(65+Math.abs(ch)*2|0,65,95);reason=`Strong momentum +${ch.toFixed(1)}%. Volume surge confirms bullish trend.`;}
        else if(ch>1.5){action="BUY";confidence=clamp(60+ch|0,60,80);reason=`Positive trend +${ch.toFixed(1)}%. Accumulation phase building.`;}
        else if(ch<-4){action="EXIT";confidence=clamp(65+Math.abs(ch)*2|0,65,94);reason=`Sharp decline ${ch.toFixed(1)}%. AI recommends pivot to protect capital.`;}
        else if(ch<-1.5){action="EXIT";confidence=clamp(58+Math.abs(ch)|0,58,78);reason=`Bearish pressure ${ch.toFixed(1)}%. Consider rotating to stronger asset.`;}
        else{action="HODL";confidence=52+Math.floor(Math.random()*22);reason=`Consolidating ${ch.toFixed(1)}%. No clear signal — maintain position.`;}
        sigs[c.symbol]={action,confidence,reason,change:ch,price:data[c.cgId]?.usd};
        if(action!=="HODL") newN.push({id:Date.now()+Math.random(),coin:c.symbol,coinColor:c.color,action,confidence,reason,price:data[c.cgId]?.usd,change:ch,time:Date.now(),read:false});
      });
      setSignals(sigs);
      if(newN.length){ setNotes(p=>[...newN,...p].slice(0,50)); setUnread(n=>n+newN.length); }
      setLastFetch(Date.now());
    } catch(_){}
    setFetching(false);
  },[]);

  useEffect(()=>{
    if(screen===S.MAIN){ fetchMarket(); priceRef.current=setInterval(fetchMarket,45000); return()=>clearInterval(priceRef.current); }
  },[screen,fetchMarket]);

  const portfolioUSD = Object.entries(portfolio).reduce((s,[sym,h])=>{
    if(["USDC","USDT","DAI"].includes(sym)) return s+h.amount;
    const c=COINS.find(x=>x.symbol===sym); const p=c?prices[c.cgId]?.usd:0;
    return s+(p?h.amount*p:0);
  },0);
  const portfolioPnL = Object.entries(portfolio).reduce((s,[sym,h])=>{
    if(["USDC","USDT","DAI"].includes(sym)) return s;
    const c=COINS.find(x=>x.symbol===sym); const p=c?prices[c.cgId]?.usd:0;
    if(!p||!h.avgBuy) return s; return s+((p-h.avgBuy)*h.amount);
  },0);

  // Auth
  const doSignUp = async()=>{
    if(!authName||!authEmail||!authPass){ setAuthErr("All fields are required."); return; }
    if(authPass.length<6){ setAuthErr("Password must be at least 6 characters."); return; }
    setAuthBusy(true); setAuthErr("");
    try { const u=await signUpUser(authEmail.toLowerCase(),authPass,authName); setUser(u); setScreen(S.PAYWALL); }
    catch(e){ setAuthErr(e.message); }
    setAuthBusy(false);
  };
  const doSignIn = async()=>{
    if(!authEmail||!authPass){ setAuthErr("Email and password are required."); return; }
    setAuthBusy(true); setAuthErr("");
    try { const u=await signInUser(authEmail.toLowerCase(),authPass); setUser(u); setScreen(u.subscribed||isOwner?S.MAIN:S.PAYWALL); }
    catch(e){ setAuthErr(e.message); }
    setAuthBusy(false);
  };
  const doGoogle = async()=>{
    setAuthBusy(true); setAuthErr("");
    try { const u=await signInGoogle(); setUser(u); setScreen(S.PAYWALL); }
    catch(e){ setAuthErr(e.message); }
    setAuthBusy(false);
  };
  const doOwnerKey = ()=>{
    if(ownerInput.trim()===OWNER_KEY){
      setIsOwner(true);
      setUser({id:"owner",email:"owner@signalpulse.app",name:"Owner",subscribed:true,provider:"owner"});
      setScreen(S.MAIN);
    } else { setAuthErr("Invalid owner key."); }
  };

  // Pivot
  const openPivot = async(symbol)=>{
    setPivotCoin(symbol); setPivotRec(null); setPivotBusy(true);
    setConfirming(false); setTradeMsg(""); setPivotPct(60); setRemainder("HODL");
    setScreen(S.PIVOT);
    const holdings=Object.fromEntries(Object.entries(portfolio).filter(([,v])=>v.amount>0).map(([k,v])=>[k,v.amount]));
    try { setPivotRec(await aiPivot(symbol,prices,holdings)); }
    catch(_){ setPivotRec({pivotCoin:"USDC",confidence:65,exitReason:"Exit signal triggered.",entryReason:"Stable coin preserves capital.",bullish:[],bearish:[],targetGain:"0%",timeframe:"–",riskLevel:"LOW",stableReason:"Safety first."}); }
    setPivotBusy(false);
  };
  const executeTrade = ()=>{
    const exitH=portfolio[pivotCoin]||{amount:0};
    if(!exitH.amount){ setTradeMsg("No balance to pivot."); return; }
    const exitPrice=prices[COINS.find(c=>c.symbol===pivotCoin)?.cgId]?.usd||0;
    const totalUSD=exitH.amount*exitPrice;
    const pivotUSD=totalUSD*pivotPct/100, remUSD=totalUSD*(100-pivotPct)/100;
    const pivotPrice=prices[COINS.find(c=>c.symbol===pivotRec.pivotCoin)?.cgId]?.usd||1;
    const pivotAmt=pivotUSD/pivotPrice;
    setPortfolio(prev=>{
      const next={...prev};
      next[pivotCoin]={...next[pivotCoin],amount:0};
      if(!next[pivotRec.pivotCoin]) next[pivotRec.pivotCoin]={amount:0,avgBuy:pivotPrice};
      next[pivotRec.pivotCoin]={amount:(next[pivotRec.pivotCoin].amount||0)+pivotAmt,avgBuy:pivotPrice};
      if(remainder!=="HODL"){
        if(!next[remainder]) next[remainder]={amount:0,avgBuy:1};
        next[remainder]={amount:(next[remainder].amount||0)+remUSD,avgBuy:1};
      } else {
        if(exitPrice>0) next[pivotCoin]={amount:remUSD/exitPrice,avgBuy:exitH.avgBuy||exitPrice};
      }
      return next;
    });
    setTradeLog(prev=>[{id:Date.now(),time:Date.now(),from:pivotCoin,to:pivotRec.pivotCoin,pivotPct,pivotUSD,remUSD,remDest:remainder,toPrice:pivotPrice},...prev]);
    setTradeMsg(`Trade executed — ${fmt(pivotAmt,6)} ${pivotRec.pivotCoin} acquired`);
    setTimeout(()=>{ setScreen(S.MAIN); setPivotCoin(null); setPivotRec(null); setTradeMsg(""); },2200);
  };

  const openDeep = async(coin)=>{
    setDeepCoin(coin); setScreen(S.DEEP);
    if(deepData[coin.symbol]) return;
    setDeepBusy(p=>({...p,[coin.symbol]:true}));
    try { const result = await aiDeep(coin,prices[coin.cgId]); setDeepData(p->({...p,[coin.symbol]:result}));} catch(_){setDeepData(p=>({...p,[coin.symbol]:{summary:"Analysisunavailable.",signal:"HODL",confide...}}));}
    catch(_){ setDeepData(p=>({...p,[coin.symbol]:{summary:"Analysis unavailable.",signal:"HODL",confidence:50,riskLevel:"MEDIUM"}})); }
    setDeepBusy(p=>({...p,[coin.symbol]:false}));
  };
  const markRead=()=>{ setNotes(p=>p.map(n=>({...n,read:true}))); setUnread(0); };

  // ─── SHARED LAYOUT ────────────────────────────────────────────────────────
  const appStyle = { minHeight:"100vh", background:T.bg0, color:T.t1,
    fontFamily:FONT_BODY, maxWidth:430, margin:"0 auto", position:"relative" };
  const pageStyle = { ...appStyle, padding:"44px 20px 60px" };
  const hdrStyle  = { position:"sticky",top:0,zIndex:50,
    background:`${T.bg0}ee`,backdropFilter:"blur(20px)",
    borderBottom:`1px solid ${T.b2}` };
  const backBtnStyle = { background:T.bg2,border:`1px solid ${T.b1}`,color:T.t2,
    width:36,height:36,borderRadius:T.r3,cursor:"pointer",fontSize:18,
    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 };

  // ══════════════════════════════════════════════════════════════════════════
  // SPLASH
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.SPLASH) return (
    <div style={{...appStyle,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{background:`radial-gradient(ellipse at 30% 30%,rgba(99,102,241,.15) 0%,transparent 60%),radial-gradient(ellipse at 70% 70%,rgba(16,185,129,.08) 0%,transparent 60%)`,position:"fixed",inset:0,pointerEvents:"none"}}/>
      <div style={{textAlign:"center",zIndex:1,animation:"fadeUp .7s ease"}}>
        <div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#6366F1,#818CF8)",
          display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",
          boxShadow:"0 0 40px rgba(99,102,241,.4)"}}>
          <span style={{fontSize:28}}>◈</span>
        </div>
        <div style={{fontSize:36,fontWeight:800,letterSpacing:"-.03em",fontFamily:FONT_DISPLAY,lineHeight:1.1}}>
          SignalPulse
        </div>
        <div style={{fontSize:13,color:T.t2,marginTop:8,fontWeight:500}}>AI Crypto Day Trading</div>
        <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",marginTop:32}}>
          <LiveDot/><span style={{fontSize:12,color:T.t3,fontWeight:500}}>Connecting to markets...</span>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // LANDING
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.LANDING) return (
    <div style={pageStyle}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{background:`radial-gradient(ellipse at 20% 0%,rgba(99,102,241,.12) 0%,transparent 50%)`,position:"fixed",inset:0,pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{marginBottom:36,textAlign:"center"}}>
          <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#6366F1,#818CF8)",
            display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",
            boxShadow:"0 8px 24px rgba(99,102,241,.35)"}}>
            <span style={{fontSize:22}}>◈</span>
          </div>
          <h1 style={{fontSize:30,fontWeight:800,letterSpacing:"-.03em",fontFamily:FONT_DISPLAY,margin:"0 0 8px",lineHeight:1.2}}>
            SignalPulse Pro
          </h1>
          <p style={{fontSize:14,color:T.t2,margin:"0 0 20px",fontWeight:400,lineHeight:1.6}}>
            AI-powered signals that tell you exactly<br/>when to buy, hold, or pivot.
          </p>
          <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
            {["Real-time AI","Pivot Advisor","Live Prices","PayPal Billing"].map(f=>(
              <span key={f} style={{fontSize:11,color:T.accent2,background:"rgba(99,102,241,.1)",
                padding:"4px 10px",borderRadius:20,border:`1px solid rgba(99,102,241,.2)`,fontWeight:600}}>{f}</span>
            ))}
          </div>
        </div>

        <Btn onClick={()=>{ setAuthErr(""); setScreen(S.SIGNUP); }}>Create Free Account</Btn>
        <div style={{height:8}}/>
        <Btn variant="secondary" onClick={()=>{ setAuthErr(""); setScreen(S.LOGIN); }}>Sign In</Btn>

        {/* Owner key */}
        <div style={{marginTop:24,padding:16,background:"rgba(245,158,11,.06)",
          border:`1px solid rgba(245,158,11,.15)`,borderRadius:T.r1}}>
          <p style={{fontSize:12,color:T.gold,fontWeight:600,marginBottom:10}}>👑 Owner Access</p>
          <div style={{display:"flex",gap:8}}>
            <input value={ownerInput} onChange={e=>setOwnerInput(e.target.value)}
              placeholder="Enter owner key..."
              style={{flex:1,background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:T.r3,
                padding:"10px 14px",color:T.t1,fontSize:13,fontFamily:FONT_BODY,outline:"none"}}/>
            <button onClick={doOwnerKey}
              style={{padding:"10px 16px",borderRadius:T.r3,border:`1px solid rgba(245,158,11,.3)`,
                background:"rgba(245,158,11,.15)",color:T.gold,fontSize:12,fontWeight:700,
                cursor:"pointer",fontFamily:FONT_BODY,whiteSpace:"nowrap"}}>
              Unlock
            </button>
          </div>
          {authErr&&<p style={{fontSize:12,color:T.red,marginTop:6}}>{authErr}</p>}
          <button style={{background:"none",border:"none",color:T.t3,fontSize:11,cursor:"pointer",
            marginTop:6,fontFamily:FONT_BODY}} onClick={()=>setOwnerInput(OWNER_KEY)}>
            Fill demo key
          </button>
        </div>

        <p style={{textAlign:"center",marginTop:20,fontSize:12,color:T.t3,lineHeight:1.7}}>
          $19.99/month · Cancel anytime · Secured by PayPal
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SIGN UP
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.SIGNUP) return (
    <div style={pageStyle}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
          <button style={backBtnStyle} onClick={()=>setScreen(S.LANDING)}>←</button>
          <div>
            <h2 style={{fontSize:20,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>Create Account</h2>
            <p style={{fontSize:13,color:T.t2,margin:0,marginTop:2}}>Start trading smarter today</p>
          </div>
        </div>

        <SocialBtn icon="G" label="Continue with Google" onClick={doGoogle}/>
        <SocialBtn icon="🍎" label="Continue with Apple" onClick={()=>setAuthErr("Apple Sign In requires deployment.")}/>
        <Divider label="or sign up with email"/>
        <FormInput label="Full name" value={authName} onChange={setAuthName} placeholder="Your name" autoComplete="name"/>
        <FormInput label="Email address" type="email" value={authEmail} onChange={setAuthEmail} placeholder="you@email.com" autoComplete="email"/>
        <FormInput label="Password" type="password" value={authPass} onChange={setAuthPass} placeholder="Min 6 characters" autoComplete="new-password"/>
        {authErr&&<Card style={{marginBottom:14,borderColor:"rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",padding:12}}>
          <p style={{fontSize:13,color:T.red,margin:0}}>{authErr}</p>
        </Card>}
        <Btn onClick={doSignUp} disabled={authBusy}>{authBusy?"Creating account...":"Create Account →"}</Btn>
        <p style={{textAlign:"center",marginTop:14,fontSize:13,color:T.t2}}>
          Already have an account?{" "}
          <button style={{background:"none",border:"none",color:T.accent2,cursor:"pointer",
            fontSize:13,fontFamily:FONT_BODY,fontWeight:600}} onClick={()=>{ setAuthErr(""); setScreen(S.LOGIN); }}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SIGN IN
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.LOGIN) return (
    <div style={pageStyle}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
          <button style={backBtnStyle} onClick={()=>setScreen(S.LANDING)}>←</button>
          <div>
            <h2 style={{fontSize:20,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>Welcome back</h2>
            <p style={{fontSize:13,color:T.t2,margin:0,marginTop:2}}>Sign in to your account</p>
          </div>
        </div>

        <SocialBtn icon="G" label="Continue with Google" onClick={doGoogle}/>
        <SocialBtn icon="🍎" label="Continue with Apple" onClick={()=>setAuthErr("Apple Sign In requires deployment.")}/>
        <Divider label="or sign in with email"/>
        <FormInput label="Email address" type="email" value={authEmail} onChange={setAuthEmail} placeholder="you@email.com" autoComplete="email"/>
        <FormInput label="Password" type="password" value={authPass} onChange={setAuthPass} placeholder="Your password" autoComplete="current-password"/>
        {authErr&&<Card style={{marginBottom:14,borderColor:"rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",padding:12}}>
          <p style={{fontSize:13,color:T.red,margin:0}}>{authErr}</p>
        </Card>}
        <Btn onClick={doSignIn} disabled={authBusy}>{authBusy?"Signing in...":"Sign In →"}</Btn>
        <p style={{textAlign:"center",marginTop:14,fontSize:13,color:T.t2}}>
          Don't have an account?{" "}
          <button style={{background:"none",border:"none",color:T.accent2,cursor:"pointer",
            fontSize:13,fontFamily:FONT_BODY,fontWeight:600}} onClick={()=>{ setAuthErr(""); setScreen(S.SIGNUP); }}>
            Sign up
          </button>
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PAYWALL
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.PAYWALL) return (
    <div style={pageStyle}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <p style={{fontSize:13,color:T.t2,marginBottom:6}}>Welcome, {user?.name||"Trader"} 👋</p>
          <h2 style={{fontSize:26,fontWeight:800,fontFamily:FONT_DISPLAY,letterSpacing:"-.03em",margin:"0 0 8px"}}>
            Unlock SignalPulse Pro
          </h2>
          <p style={{fontSize:14,color:T.t2,margin:0}}>Full AI trading signals · Real-time pivot advisor</p>
        </div>

        {/* Pricing */}
        <Card style={{marginBottom:16,background:"linear-gradient(135deg,rgba(99,102,241,.12),rgba(16,185,129,.07))",
          borderColor:"rgba(99,102,241,.25)",textAlign:"center",padding:24}}>
          <p style={{fontSize:12,color:T.accent2,fontWeight:700,letterSpacing:".08em",marginBottom:8,textTransform:"uppercase"}}>Monthly Plan</p>
          <p style={{fontSize:48,fontWeight:800,fontFamily:FONT_NUM,color:T.t1,margin:"0 0 4px",letterSpacing:"-.04em"}}>
            $19<span style={{fontSize:24,color:T.t2}}>.99</span>
          </p>
          <p style={{fontSize:13,color:T.t3,marginBottom:20}}>per month · cancel anytime</p>
          {["Real-time AI BUY / EXIT / HODL signals","AI Pivot Advisor with % allocation slider","8 coins monitored around the clock","Deep Claude AI analysis with price targets","Trade history & portfolio PnL tracking"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10,textAlign:"left"}}>
              <span style={{color:T.green2,fontWeight:700,flexShrink:0,marginTop:1}}>✓</span>
              <span style={{fontSize:13,color:T.t2,lineHeight:1.4}}>{f}</span>
            </div>
          ))}
        </Card>

        {/* PayPal */}
        <Card style={{marginBottom:12,borderColor:"rgba(0,112,204,.25)",background:"rgba(0,56,133,.08)"}}>
          <p style={{fontSize:12,color:"#60A5FA",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:8}}>Pay with PayPal</p>
          <p style={{fontSize:13,color:T.t2,marginBottom:14,lineHeight:1.6}}>
            Your payment is secured by PayPal. After subscribing, your account unlocks immediately.
          </p>
          <Btn variant="paypal" onClick={()=>{ setUser(p=>({...p,subscribed:true})); setScreen(S.MAIN); }}>
            🅿 Subscribe with PayPal — $19.99/mo
          </Btn>
          <p style={{fontSize:11,color:T.t3,textAlign:"center",marginTop:8}}>
            Demo mode — tap to simulate payment
          </p>
        </Card>

        <p style={{textAlign:"center",fontSize:12,color:T.t3,lineHeight:1.7}}>
          256-bit SSL encryption · Cancel anytime from PayPal
        </p>
        <Btn variant="ghost" onClick={()=>setScreen(S.LANDING)} style={{marginTop:8,fontSize:13,color:T.t3}}>
          ← Back
        </Btn>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN PANEL
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.ADMIN) {
    const allUsers=getUsers();
    const subCount=allUsers.filter(u=>u.subscribed).length;
    return (
      <div style={{...appStyle,paddingBottom:40}}>
        <style>{GOOGLE_FONTS}</style>
        <div style={{...hdrStyle,padding:"16px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button style={backBtnStyle} onClick={()=>setScreen(S.SETTINGS)}>←</button>
          <h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>Admin Panel</h2>
          <div style={{marginLeft:"auto"}}><Pill label="PRO"/></div>
        </div>
        <div style={{padding:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[["Total Users",allUsers.length,T.accent2],["Subscribed",subCount,T.green2],
              ["Free",allUsers.length-subCount,T.gold2],["Monthly Rev",`$${(subCount*19.99).toFixed(0)}`,T.t1]
            ].map(([l,v,c])=>(
              <Card key={l} style={{textAlign:"center",padding:14}}>
                <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 6px"}}>{l}</p>
                <p style={{fontSize:22,fontWeight:700,fontFamily:FONT_NUM,color:c,margin:0}}>{v}</p>
              </Card>
            ))}
          </div>
          <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Users</p>
          {allUsers.length===0&&<p style={{textAlign:"center",padding:"30px 0",color:T.t3,fontSize:14}}>No users yet.</p>}
          {allUsers.map(u=>(
            <Card key={u.id} style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <p style={{fontWeight:600,fontSize:14,margin:"0 0 2px"}}>{u.name||"—"}</p>
                <p style={{fontSize:12,color:T.t2,margin:"0 0 2px"}}>{u.email}</p>
                <p style={{fontSize:11,color:T.t3,margin:0}}>{u.provider} · {new Date(u.createdAt).toLocaleDateString()}</p>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <Pill label={u.subscribed?"PRO":"FREE"}/>
                <button onClick={()=>{ updateUserSub(u.id,!u.subscribed); setAdminUsers(getUsers()); }}
                  style={{padding:"6px 12px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,
                    border:`1px solid ${u.subscribed?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"}`,
                    background:u.subscribed?"rgba(239,68,68,.1)":"rgba(16,185,129,.1)",
                    color:u.subscribed?T.red:T.green2,fontSize:12,fontWeight:600}}>
                  {u.subscribed?"Revoke":"Grant"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PIVOT ADVISOR
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.PIVOT) {
    const exitC=COINS.find(c=>c.symbol===pivotCoin);
    const exitH=portfolio[pivotCoin]||{amount:0};
    const exitPrice=prices[exitC?.cgId]?.usd||0;
    const exitUSD=exitH.amount*exitPrice;
    const pivotC=pivotRec?COINS.find(c=>c.symbol===pivotRec.pivotCoin):null;
    const pivotUSD=exitUSD*pivotPct/100, remUSD=exitUSD*(100-pivotPct)/100;
    return (
      <div style={{...appStyle,paddingBottom:40}}>
        <style>{GOOGLE_FONTS}</style>
        <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button style={backBtnStyle} onClick={()=>{ setScreen(S.MAIN); setPivotCoin(null); setPivotRec(null); }}>←</button>
          <div style={{flex:1}}>
            <h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>AI Pivot Advisor</h2>
            <p style={{fontSize:12,color:T.t2,margin:0}}>Exit {pivotCoin} → Find best opportunity</p>
          </div>
          <Pill label="DEMO"/>
        </div>
        <div style={{padding:16}}>
          {/* Exit position */}
          <Card style={{marginBottom:14,borderLeft:`3px solid ${exitC?.color}`}} accent={exitC?.color}>
            <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Exiting Position</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <CoinAvatar coin={exitC||{symbol:pivotCoin,color:"#888"}} size={44}/>
                <div>
                  <p style={{fontWeight:700,fontSize:18,margin:0,color:exitC?.color}}>{pivotCoin}</p>
                  <p style={{fontSize:12,color:T.t2,margin:0}}>{fmt(exitH.amount,6)} coins</p>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontWeight:700,fontSize:18,margin:0}}>{usd(exitUSD)}</p>
                <p style={{fontSize:12,color:T.red,margin:0}}>{pct(prices[exitC?.cgId]?.usd_24h_change||0)} today</p>
              </div>
            </div>
            {pivotRec&&<div style={{marginTop:12,padding:"10px 12px",background:"rgba(239,68,68,.08)",borderRadius:T.r3,borderLeft:`2px solid ${T.red}`}}>
              <p style={{fontSize:12,color:T.red2,margin:0,lineHeight:1.5}}>{pivotRec.exitReason}</p>
            </div>}
          </Card>

          {pivotBusy?(
            <Card style={{textAlign:"center",padding:"48px 20px"}}>
              <div style={{fontSize:28,color:T.accent,marginBottom:12,animation:"spin 1.5s linear infinite"}}>◈</div>
              <p style={{fontSize:15,fontWeight:600,color:T.t1,margin:"0 0 6px",fontFamily:FONT_DISPLAY}}>Scanning all markets...</p>
              <p style={{fontSize:13,color:T.t2,margin:0}}>Claude is finding your best pivot opportunity</p>
            </Card>
          ):pivotRec&&(<>
            {/* AI Recommendation */}
            <Card style={{marginBottom:14,borderColor:"rgba(99,102,241,.25)",background:"rgba(99,102,241,.06)"}}>
              <p style={{fontSize:11,color:T.accent2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>◈ Claude Recommends</p>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                <CoinAvatar coin={pivotC||{symbol:pivotRec.pivotCoin,color:"#6366F1"}} size={52}/>
                <div style={{flex:1}}>
                  <p style={{fontWeight:800,fontSize:24,margin:0,fontFamily:FONT_DISPLAY,letterSpacing:"-.02em"}}>{pivotRec.pivotCoin}</p>
                  <p style={{fontSize:13,color:T.t2,margin:0}}>{usd(prices[pivotC?.cgId]?.usd)}</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontSize:16,color:T.green2,fontWeight:700,margin:0,fontFamily:FONT_NUM}}>{pivotRec.targetGain}</p>
                  <p style={{fontSize:12,color:T.t2,margin:"2px 0"}}>{pivotRec.timeframe}</p>
                  <Pill label={pivotRec.riskLevel}/>
                </div>
              </div>
              <ProgressBar val={pivotRec.confidence}/>
              <p style={{fontSize:13,color:T.t2,marginTop:12,lineHeight:1.6}}>{pivotRec.entryReason}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
                <div style={{background:"rgba(16,185,129,.06)",borderRadius:T.r3,padding:"10px 12px",border:`1px solid rgba(16,185,129,.12)`}}>
                  <p style={{fontSize:11,color:T.green2,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Bullish</p>
                  {(pivotRec.bullish||[]).slice(0,3).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 4px",lineHeight:1.4}}>• {b}</p>)}
                </div>
                <div style={{background:"rgba(239,68,68,.06)",borderRadius:T.r3,padding:"10px 12px",border:`1px solid rgba(239,68,68,.12)`}}>
                  <p style={{fontSize:11,color:T.red2,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Risks</p>
                  {(pivotRec.bearish||[]).slice(0,2).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 4px",lineHeight:1.4}}>• {b}</p>)}
                </div>
              </div>
            </Card>

            {/* Allocation Slider */}
            <Card style={{marginBottom:14}}>
              <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:16}}>Allocate Your {pivotCoin}</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
                <div>
                  <span style={{fontSize:44,fontWeight:800,fontFamily:FONT_NUM,color:T.accent2,letterSpacing:"-.04em"}}>{pivotPct}</span>
                  <span style={{fontSize:18,color:T.t2,marginLeft:2}}>%</span>
                  <p style={{fontSize:12,color:T.t2,margin:"4px 0 0"}}>→ {pivotRec.pivotCoin} · {usd(pivotUSD)}</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:26,fontWeight:700,fontFamily:FONT_NUM,color:remainder==="HODL"?T.gold2:T.blue}}>{100-pivotPct}</span>
                  <span style={{fontSize:14,color:T.t2,marginLeft:2}}>%</span>
                  <p style={{fontSize:12,color:T.t2,margin:"4px 0 0"}}>{remainder} · {usd(remUSD)}</p>
                </div>
              </div>

              <input type="range" min={10} max={100} step={5} value={pivotPct}
                onChange={e=>setPivotPct(Number(e.target.value))}
                style={{width:"100%",marginBottom:6}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:16}}>
                <span>10%</span><span>50%</span><span>100%</span>
              </div>

              {/* Split bar */}
              <div style={{height:8,borderRadius:4,overflow:"hidden",background:"rgba(255,255,255,.06)",marginBottom:16,display:"flex"}}>
                <div style={{width:`${pivotPct}%`,background:"linear-gradient(90deg,#4F46E5,#818CF8)",transition:"width .3s",borderRadius:"4px 0 0 4px"}}/>
                <div style={{flex:1,background:remainder==="HODL"?"rgba(245,158,11,.35)":"rgba(59,130,246,.35)",transition:"background .3s",borderRadius:"0 4px 4px 0"}}/>
              </div>

              <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Remainder goes to</p>
              <div style={{display:"flex",gap:8}}>
                {["HODL","USDC","USDT"].map(opt=>(
                  <button key={opt} onClick={()=>setRemainder(opt)}
                    style={{flex:1,padding:"10px 0",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,
                      border:`1px solid ${remainder===opt?T.accent:"rgba(255,255,255,.08)"}`,
                      background:remainder===opt?"rgba(99,102,241,.18)":T.bg2,
                      color:remainder===opt?T.accent2:T.t2,
                      fontSize:13,fontWeight:600,transition:"all .15s"}}>
                    {opt}
                  </button>
                ))}
              </div>
              {remainder!=="HODL"&&<p style={{fontSize:12,color:T.blue,marginTop:10,lineHeight:1.5}}>💡 {pivotRec.stableReason}</p>}
            </Card>

            {tradeMsg?(
              <Card style={{textAlign:"center",padding:20,borderColor:"rgba(16,185,129,.25)",background:"rgba(16,185,129,.08)"}}>
                <p style={{fontSize:15,color:T.green2,fontWeight:700,margin:0}}>✓ {tradeMsg}</p>
              </Card>
            ):confirming?(
              <Card style={{marginBottom:14,borderColor:"rgba(245,158,11,.25)",background:"rgba(245,158,11,.06)"}}>
                <p style={{fontSize:12,color:T.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Confirm Trade</p>
                <div style={{fontSize:14,lineHeight:2.2,color:T.t1}}>
                  <div>Pivot <strong style={{color:T.red}}>{pivotPct}% of {pivotCoin}</strong> → <strong style={{color:T.green2}}>{pivotRec.pivotCoin}</strong></div>
                  <div>Value: <strong style={{color:T.accent2}}>{usd(pivotUSD)}</strong></div>
                  <div>Remainder: <strong style={{color:remainder==="HODL"?T.gold2:T.blue}}>{100-pivotPct}% → {remainder}</strong> ({usd(remUSD)})</div>
                </div>
                <div style={{display:"flex",gap:10,marginTop:14}}>
                  <Btn variant="danger" onClick={()=>setConfirming(false)} style={{flex:1,width:"auto"}}>Cancel</Btn>
                  <Btn variant="success" onClick={executeTrade} style={{flex:2,width:"auto"}}>Execute Trade ▸</Btn>
                </div>
              </Card>
            ):(
              <Btn onClick={()=>setConfirming(true)}>Preview Trade →</Btn>
            )}
            <p style={{fontSize:11,color:T.t3,textAlign:"center",marginTop:12,lineHeight:1.6}}>
              Demo mode — no real money moves. Connect Uphold OAuth2 to execute real trades.
            </p>
          </>)}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DEEP ANALYSIS
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.DEEP&&deepCoin) {
    const da=deepData[deepCoin.symbol];
    const price=prices[deepCoin.cgId]?.usd;
    const change=prices[deepCoin.cgId]?.usd_24h_change;
    const sigColor = da?.signal==="BUY"?T.green:da?.signal==="EXIT"?T.red:T.gold;
    return (
      <div style={{...appStyle,paddingBottom:40}}>
        <style>{GOOGLE_FONTS}</style>
        <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button style={backBtnStyle} onClick={()=>setScreen(S.MAIN)}>←</button>
          <CoinAvatar coin={deepCoin} size={36}/>
          <div style={{flex:1}}>
            <h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>{deepCoin.symbol} Analysis</h2>
            <p style={{fontSize:12,color:T.t2,margin:0}}>Claude AI · {deepCoin.name}</p>
          </div>
        </div>
        <div style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <p style={{fontSize:32,fontWeight:800,fontFamily:FONT_NUM,margin:0,letterSpacing:"-.03em"}}>{usd(price)}</p>
              <p style={{fontSize:13,color:(change||0)>=0?T.green2:T.red,fontWeight:600,margin:"4px 0 0"}}>{pct(change||0)} today</p>
            </div>
            <Spark data={histories[deepCoin.cgId]} color={deepCoin.color} w={100} h={48}/>
          </div>

          {deepBusy[deepCoin.symbol]?(
            <Card style={{textAlign:"center",padding:"48px 20px",marginTop:14}}>
              <div style={{fontSize:26,color:T.accent,marginBottom:12}}>◈</div>
              <p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,margin:"0 0 6px"}}>Analyzing {deepCoin.symbol}...</p>
              <p style={{fontSize:13,color:T.t2,margin:0}}>Claude is building your market analysis</p>
            </Card>
          ):da&&(<>
            <Card style={{marginTop:14,marginBottom:14,borderColor:`${sigColor}25`,background:`${sigColor}08`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <Pill label={da.signal||"HODL"}/><Pill label={da.riskLevel||"MEDIUM"}/>
              </div>
              <ProgressBar val={da.confidence||70} color={sigColor} height={4}/>
              <p style={{fontSize:13,color:T.t2,marginTop:14,lineHeight:1.7}}>{da.summary}</p>
              <div style={{marginTop:12,padding:"12px 14px",background:`${T.accent}12`,borderRadius:T.r3,borderLeft:`3px solid ${T.accent}`}}>
                <p style={{fontSize:13,color:T.accent2,margin:0,lineHeight:1.5,fontWeight:500}}>{da.action}</p>
              </div>
            </Card>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[["Target",da.targetPrice,T.green2],["Stop Loss",da.stopLoss,T.red],
                ["Support",da.keyLevels?.support,T.gold2],["Resistance",da.keyLevels?.resistance,T.accent2]
              ].map(([l,v,c])=>(
                <Card key={l} style={{textAlign:"center",padding:12}}>
                  <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{l}</p>
                  <p style={{fontSize:16,fontWeight:700,fontFamily:FONT_NUM,color:c,margin:0}}>{v||"–"}</p>
                </Card>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <Card style={{borderLeft:`2px solid ${T.green}`}}>
                <p style={{fontSize:11,color:T.green2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Bullish</p>
                {(da.bullish||[]).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 6px",lineHeight:1.4}}>• {b}</p>)}
              </Card>
              <Card style={{borderLeft:`2px solid ${T.red}`}}>
                <p style={{fontSize:11,color:T.red2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Bearish</p>
                {(da.bearish||[]).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 6px",lineHeight:1.4}}>• {b}</p>)}
              </Card>
            </div>

            {da.signal==="EXIT"&&<Btn variant="danger" onClick={()=>openPivot(deepCoin.symbol)}>⇄ Open Pivot Advisor →</Btn>}
          </>)}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.SETTINGS) return (
    <div style={{...appStyle,paddingBottom:40}}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
        <button style={backBtnStyle} onClick={()=>setScreen(S.MAIN)}>←</button>
        <h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em",flex:1}}>Settings</h2>
        {isOwner&&<Pill label="PRO"/>}
      </div>
      <div style={{padding:16}}>
        <Card style={{marginBottom:12,borderColor:"rgba(16,185,129,.2)"}}>
          <p style={{fontSize:11,color:T.green2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Account</p>
          <p style={{fontWeight:600,fontSize:16,margin:"0 0 4px",fontFamily:FONT_DISPLAY}}>{user?.name||"–"}</p>
          <p style={{fontSize:13,color:T.t2,margin:"0 0 4px"}}>{user?.email}</p>
          <p style={{fontSize:12,color:T.t3,margin:0}}>via {user?.provider} · {user?.subscribed?"Active":"Free"}</p>
        </Card>
        <Card style={{marginBottom:12}}>
          <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Subscription</p>
          <p style={{fontWeight:600,fontSize:15,color:isOwner?T.gold:user?.subscribed?T.green2:T.gold2,margin:0}}>
            {isOwner?"Owner — Free Lifetime":user?.subscribed?"Pro — $19.99/mo":"Free — Upgrade to unlock"}
          </p>
          {!isOwner&&!user?.subscribed&&<Btn onClick={()=>setScreen(S.PAYWALL)} style={{marginTop:12}}>Upgrade to Pro →</Btn>}
        </Card>
        {isOwner&&<Btn variant="secondary" onClick={()=>{ setAdminUsers(getUsers()); setScreen(S.ADMIN); }}
          style={{marginBottom:10}}>👑 Admin Panel →</Btn>}
        <Card style={{marginBottom:12}}>
          <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Market Data</p>
          <p style={{fontSize:14,color:T.t1,margin:0}}>CoinGecko · Live · Refreshes every 45s</p>
        </Card>
        <Card style={{marginBottom:16}}>
          <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>AI Engine</p>
          <p style={{fontSize:14,color:T.t1,margin:0}}>Claude Sonnet 4 · Real-time analysis</p>
        </Card>
        <Btn variant="danger" onClick={()=>{ setUser(null); setIsOwner(false); setScreen(S.LANDING); }}>Sign Out</Btn>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={appStyle}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{background:`radial-gradient(ellipse at 80% 0%,rgba(99,102,241,.08) 0%,transparent 50%)`,position:"fixed",inset:0,pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1}}>

        {/* Header */}
        <div style={{...hdrStyle,padding:"14px 18px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <h1 style={{fontSize:20,fontWeight:800,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.03em"}}>
                  SignalPulse
                </h1>
                {isOwner&&<Pill label="PRO"/>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                <LiveDot active={!fetching}/>
                <span style={{fontSize:11,color:T.t3,fontWeight:500}}>
                  {fetching?"Fetching prices...":lastFetch?`Updated ${ago(lastFetch)}`:"Connecting..."}
                </span>
              </div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:0}}>Portfolio</p>
                <p style={{fontSize:17,fontWeight:700,fontFamily:FONT_NUM,color:T.green2,margin:"2px 0 0"}}>{usd(portfolioUSD)}</p>
                <p style={{fontSize:11,color:portfolioPnL>=0?T.green2:T.red,margin:0,fontWeight:600}}>
                  {portfolioPnL>=0?"↑":"↓"} {usd(Math.abs(portfolioPnL))} PnL
                </p>
              </div>
              <button onClick={()=>setScreen(S.SETTINGS)}
                style={{...backBtnStyle,width:38,height:38,fontSize:16}}>⚙</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${T.b2}`}}>
            {[["signals","Signals"],["alerts",`Alerts${unread>0?` · ${unread}`:""}`],["portfolio","Wallet"],["log","Trades"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>{ setTab(id); if(id==="alerts")markRead(); }}
                style={{flex:1,padding:"10px 0 12px",fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
                  border:"none",background:"none",cursor:"pointer",transition:"all .2s",
                  color:tab===id?T.accent2:T.t3,
                  borderBottom:`2px solid ${tab===id?T.accent:"transparent"}`,
                  marginBottom:-1}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{padding:"16px 16px 70px"}}>

          {/* SIGNALS */}
          {tab==="signals"&&COINS.map(coin=>{
            const cg=prices[coin.cgId]||{};
            const sig=signals[coin.symbol];
            const hist=histories[coin.cgId]||[];
            const holding=portfolio[coin.symbol];
            const holdBal=holding?.amount||0;
            const holdUSD=holdBal*(cg.usd||0);
            const pnlPct=holding?.avgBuy&&cg.usd?((cg.usd-holding.avgBuy)/holding.avgBuy)*100:null;
            const sigColor=sig?.action==="BUY"?T.green:sig?.action==="EXIT"?T.red:T.gold;
            return (
              <Card key={coin.symbol} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <CoinAvatar coin={coin}/>
                    <div>
                      <p style={{fontWeight:700,fontSize:15,margin:0,fontFamily:FONT_DISPLAY}}>{coin.symbol}</p>
                      <p style={{fontSize:12,color:T.t3,margin:0,fontWeight:400}}>{coin.name}</p>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:17,fontWeight:700,fontFamily:FONT_NUM,margin:0}}>{cg.usd?usd(cg.usd):"–"}</p>
                    <p style={{fontSize:12,color:(cg.usd_24h_change||0)>=0?T.green2:T.red,margin:0,fontWeight:600}}>
                      {pct(cg.usd_24h_change||0)}
                    </p>
                  </div>
                </div>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <Spark data={hist} color={coin.color} w={90} h={32}/>
                  {sig&&<Pill label={sig.action}/>}
                </div>

                {sig&&<ProgressBar val={sig.confidence} color={sigColor}/>}
                {sig&&<p style={{fontSize:12,color:T.t2,marginTop:8,lineHeight:1.5}}>{sig.reason}</p>}

                {holdBal>0&&(
                  <div style={{marginTop:10,padding:"8px 12px",background:`${coin.color}0e`,
                    borderRadius:T.r3,display:"flex",justifyContent:"space-between",
                    alignItems:"center",border:`1px solid ${coin.color}20`}}>
                    <span style={{fontSize:12,color:coin.color,fontWeight:600}}>{fmt(holdBal,["USDC","USDT"].includes(coin.symbol)?2:6)} {coin.symbol}</span>
                    <span style={{fontSize:12,color:T.t2}}>{usd(holdUSD)}</span>
                    {pnlPct!=null&&<span style={{fontSize:12,color:pnlPct>=0?T.green2:T.red,fontWeight:700}}>{pct(pnlPct)}</span>}
                  </div>
                )}

                <div style={{display:"flex",gap:8,marginTop:12}}>
                  {sig?.action==="EXIT"&&(
                    <button onClick={()=>openPivot(coin.symbol)}
                      style={{flex:2,padding:"10px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,
                        border:`1px solid rgba(239,68,68,.3)`,background:"rgba(239,68,68,.1)",
                        color:T.red,fontSize:13,fontWeight:600}}>⇄ Pivot Advisor</button>
                  )}
                  {sig?.action==="BUY"&&(
                    <button style={{flex:2,padding:"10px",borderRadius:T.r3,fontFamily:FONT_BODY,
                      border:`1px solid rgba(16,185,129,.3)`,background:"rgba(16,185,129,.1)",
                      color:T.green2,fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ AI Signal: Buy</button>
                  )}
                  {sig?.action==="HODL"&&(
                    <button style={{flex:2,padding:"10px",borderRadius:T.r3,fontFamily:FONT_BODY,
                      border:`1px solid rgba(245,158,11,.25)`,background:"rgba(245,158,11,.07)",
                      color:T.gold2,fontSize:13,fontWeight:600,cursor:"pointer"}}>◈ Holding</button>
                  )}
                  <button onClick={()=>openDeep(coin)}
                    style={{flex:1,padding:"10px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,
                      border:`1px solid rgba(99,102,241,.25)`,background:"rgba(99,102,241,.08)",
                      color:T.accent2,fontSize:13,fontWeight:600}}>AI ▸</button>
                </div>
              </Card>
            );
          })}

          {/* ALERTS */}
          {tab==="alerts"&&(
            <div>
              <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>
                Live Alerts · {notes.length} total
              </p>
              {notes.length===0&&(
                <Card style={{textAlign:"center",padding:"50px 20px"}}>
                  <p style={{fontSize:32,marginBottom:12}}>📡</p>
                  <p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,color:T.t1,margin:"0 0 6px"}}>Scanning markets</p>
                  <p style={{fontSize:13,color:T.t2,margin:0}}>Buy and Exit signals will appear here automatically.</p>
                </Card>
              )}
              {notes.map(n=>(
                <Card key={n.id} style={{marginBottom:10,borderLeft:`3px solid ${n.coinColor}`,
                  opacity:n.read?.65:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontWeight:700,color:n.coinColor,fontSize:14,fontFamily:FONT_DISPLAY}}>{n.coin}</span>
                      <Pill label={n.action}/>
                    </div>
                    <span style={{fontSize:11,color:T.t3}}>{ago(n.time)}</span>
                  </div>
                  <p style={{fontSize:13,color:T.t2,lineHeight:1.5,margin:"0 0 6px"}}>{n.reason}</p>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.t3}}>
                    <span>{usd(n.price)}</span>
                    <span>{pct(n.change)} · {n.confidence}% confidence</span>
                  </div>
                  {n.action==="EXIT"&&(
                    <button onClick={()=>openPivot(n.coin)}
                      style={{width:"100%",marginTop:10,padding:"9px",borderRadius:T.r3,cursor:"pointer",
                        fontFamily:FONT_BODY,border:`1px solid rgba(239,68,68,.25)`,
                        background:"rgba(239,68,68,.08)",color:T.red,fontSize:13,fontWeight:600}}>
                      Open Pivot Advisor →
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* PORTFOLIO */}
          {tab==="portfolio"&&(
            <div>
              <Card style={{marginBottom:14,background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(16,185,129,.07))",
                borderColor:"rgba(99,102,241,.2)",padding:20}}>
                <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 8px"}}>Demo Portfolio</p>
                <p style={{fontSize:34,fontWeight:800,fontFamily:FONT_NUM,color:T.green2,margin:"0 0 4px",letterSpacing:"-.03em"}}>{usd(portfolioUSD)}</p>
                <p style={{fontSize:13,color:portfolioPnL>=0?T.green2:T.red,fontWeight:600,margin:0}}>
                  {portfolioPnL>=0?"↑":"↓"} {usd(Math.abs(portfolioPnL))} unrealized PnL
                </p>
              </Card>
              {Object.entries(portfolio).filter(([,v])=>v.amount>0).map(([sym,h])=>{
                const coin=COINS.find(c=>c.symbol===sym);
                const isStable=["USDC","USDT","DAI"].includes(sym);
                const price=isStable?1:(coin?prices[coin.cgId]?.usd:0)||0;
                const val=h.amount*price;
                const pnlPct=!isStable&&h.avgBuy&&price?((price-h.avgBuy)/h.avgBuy)*100:null;
                const sig=coin?signals[coin.symbol]:null;
                return (
                  <Card key={sym} style={{marginBottom:10,borderLeft:`3px solid ${coin?.color||T.blue}40`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",gap:12,alignItems:"center"}}>
                        <CoinAvatar coin={coin||{symbol:sym,color:T.blue}} size={38}/>
                        <div>
                          <p style={{fontWeight:600,fontSize:14,margin:0,fontFamily:FONT_DISPLAY}}>{sym}</p>
                          <p style={{fontSize:12,color:T.t2,margin:0}}>{isStable?usd(h.amount):fmt(h.amount,6)} {!isStable&&sym}</p>
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <p style={{fontWeight:700,fontSize:15,fontFamily:FONT_NUM,margin:0}}>{usd(val)}</p>
                        {pnlPct!=null&&<p style={{fontSize:12,color:pnlPct>=0?T.green2:T.red,fontWeight:600,margin:"2px 0 0"}}>{pct(pnlPct)}</p>}
                        {sig&&<div style={{marginTop:4}}><Pill label={sig.action}/></div>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* TRADE LOG */}
          {tab==="log"&&(
            <div>
              <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>
                Trade History · {tradeLog.length} trades
              </p>
              {tradeLog.length===0&&(
                <Card style={{textAlign:"center",padding:"50px 20px"}}>
                  <p style={{fontSize:32,marginBottom:12}}>📊</p>
                  <p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,color:T.t1,margin:"0 0 6px"}}>No trades yet</p>
                  <p style={{fontSize:13,color:T.t2,margin:0}}>Use the Pivot Advisor to execute your first trade.</p>
                </Card>
              )}
              {tradeLog.map(t=>(
                <Card key={t.id} style={{marginBottom:10,borderLeft:`3px solid ${T.accent}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{color:T.accent2,fontWeight:700,fontSize:14,fontFamily:FONT_DISPLAY}}>⇄ {t.from} → {t.to}</span>
                    <span style={{fontSize:11,color:T.t3}}>{ago(t.time)}</span>
                  </div>
                  <p style={{fontSize:13,color:T.t2,margin:"0 0 4px"}}>{t.pivotPct}% · {usd(t.pivotUSD)} → {t.to} @ {usd(t.toPrice)}</p>
                  <p style={{fontSize:12,color:T.t3,margin:0}}>Remainder {100-t.pivotPct}% → {t.remDest}</p>
                </Card>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default SignalPulsePro
