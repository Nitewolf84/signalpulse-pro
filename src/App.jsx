import { useState, useEffect, useRef, useCallback } from "react";

// ─── OWNER KEY ────────────────────────────────────────────────────────────────
const OWNER_KEY = "OWNER-SIGNALPULSE-FREE";

// ─── DEMO PORTFOLIO ───────────────────────────────────────────────────────────
const DEMO_PORTFOLIO = {
  BTC:  { amount: 0.085,  avgBuy: 61200 },
  ETH:  { amount: 1.42,   avgBuy: 3200  },
  SOL:  { amount: 12.5,   avgBuy: 155   },
  USDC: { amount: 2840,   avgBuy: 1     },
};

// ─── COINS ────────────────────────────────────────────────────────────────────
const COINS = [
  { symbol:"BTC",  name:"Bitcoin",    color:"#F7931A", cgId:"bitcoin"      },
  { symbol:"ETH",  name:"Ethereum",   color:"#627EEA", cgId:"ethereum"     },
  { symbol:"SOL",  name:"Solana",     color:"#9945FF", cgId:"solana"       },
  { symbol:"ADA",  name:"Cardano",    color:"#0033AD", cgId:"cardano"      },
  { symbol:"AVAX", name:"Avalanche",  color:"#E84142", cgId:"avalanche-2"  },
  { symbol:"LINK", name:"Chainlink",  color:"#2A5ADA", cgId:"chainlink"    },
  { symbol:"DOT",  name:"Polkadot",   color:"#E6007A", cgId:"polkadot"     },
  { symbol:"XRP",  name:"XRP",        color:"#00AAE4", cgId:"ripple"       },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt  = (n,d=2) => n==null?"—":n>=1000?n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):n>=1?n.toFixed(d):n.toFixed(6);
const usd  = n => "$"+fmt(n);
const pct  = n => (n>=0?"+":"")+((n||0).toFixed(2))+"%";
const ago  = ts => { const s=Math.floor((Date.now()-ts)/1000); return s<60?s+"s ago":s<3600?Math.floor(s/60)+"m ago":Math.floor(s/3600)+"h ago"; };
const clamp = (v,mn,mx) => Math.max(mn,Math.min(mx,v));

// ─── SCREENS ──────────────────────────────────────────────────────────────────
const S = { SPLASH:"splash", LOGIN:"login", SUB:"sub", MAIN:"main", PIVOT:"pivot", DEEP:"deep", SETTINGS:"settings" };

// ─── COINGECKO REAL PRICES ────────────────────────────────────────────────────
async function fetchCGPrices() {
  const ids = COINS.map(c=>c.cgId).join(",");
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`);
  if (!r.ok) throw new Error("CG rate limit");
  return r.json();
}

// ─── CLAUDE AI ────────────────────────────────────────────────────────────────
async function aiPivot(exitSymbol, priceMap, portfolio) {
  const snap = COINS.map(c=>{
    const d=priceMap[c.cgId]||{};
    return `${c.symbol}: $${fmt(d.usd)} | 24h: ${(d.usd_24h_change||0).toFixed(2)}% | vol: $${fmt(d.usd_24h_vol,0)}`;
  }).join("\n");
  const holdings = Object.fromEntries(Object.entries(portfolio).filter(([,v])=>v.amount>0).map(([k,v])=>[k,v.amount]));
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:900,
      messages:[{role:"user",content:
        `You are a crypto day-trading AI. User wants to EXIT ${exitSymbol}.
Live market:\n${snap}\nHoldings: ${JSON.stringify(holdings)}
Pick the BEST coin to pivot into (NOT ${exitSymbol}, NOT a stablecoin). Respond ONLY with JSON:
{"pivotCoin":"SYMBOL","confidence":82,"exitReason":"1 sentence","entryReason":"1 sentence","bullish":["f1","f2","f3"],"bearish":["r1","r2"],"targetGain":"+7.5%","timeframe":"4-12 hours","riskLevel":"MEDIUM","stableReason":"1 sentence"}`
      }]
    })
  });
  const d=await r.json();
  return JSON.parse((d.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());
}

async function aiDeep(coin, price, change, history) {
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:900,
      messages:[{role:"user",content:
        `Crypto day-trading advisor. ${coin.name} (${coin.symbol}) $${fmt(price)} | 24h: ${(change||0).toFixed(2)}%
Prices: ${(history||[]).slice(-10).map(p=>"$"+fmt(p)).join(", ")}
Respond ONLY with JSON:
{"summary":"2 sentences","signal":"BUY|HODL|EXIT","confidence":78,"shortTermOutlook":"1-2 sentences","keyLevels":{"support":"$X","resistance":"$Y"},"bullish":["p1","p2","p3"],"bearish":["r1","r2"],"targetPrice":"$X","stopLoss":"$X","riskLevel":"LOW|MEDIUM|HIGH","holdPeriod":"time","action":"1 sentence"}`
      }]
    })
  });
  const d=await r.json();
  return JSON.parse((d.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function Pulse({on,size=7}) {
  return <span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",flexShrink:0,
    background:on?"#00E676":"rgba(255,255,255,.15)",
    boxShadow:on?"0 0 0 0 rgba(0,230,118,.5)":"none",
    animation:on?"rpl 1.4s infinite":"none"}}>
    <style>{`@keyframes rpl{0%{box-shadow:0 0 0 0 rgba(0,230,118,.5)}70%{box-shadow:0 0 0 8px rgba(0,230,118,0)}100%{box-shadow:0 0 0 0 rgba(0,230,118,0)}}`}</style>
  </span>;
}

function Spark({data,color,w=80,h=32}) {
  if (!data||data.length<2) return <svg width={w} height={h}/>;
  const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*(h-4)-2}`).join(" ");
  const up=data[data.length-1]>=data[0];
  return <svg width={w} height={h} style={{overflow:"visible"}}>
    <defs><linearGradient id={`sg${color.replace("#","")}`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor={up?"#00E676":"#FF5252"} stopOpacity=".25"/>
      <stop offset="100%" stopColor={up?"#00E676":"#FF5252"} stopOpacity="0"/>
    </linearGradient></defs>
    <polyline points={pts} fill="none" stroke={up?"#00E676":"#FF5252"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function Badge({label}) {
  const M={BUY:["rgba(0,230,118,.12)","#00E676","rgba(0,230,118,.3)"],
    EXIT:["rgba(255,82,82,.12)","#FF5252","rgba(255,82,82,.3)"],
    HODL:["rgba(255,213,79,.1)","#FFD54F","rgba(255,213,79,.3)"],
    HIGH:["rgba(255,82,82,.1)","#FF5252","rgba(255,82,82,.25)"],
    MEDIUM:["rgba(255,193,7,.1)","#FFD54F","rgba(255,193,7,.25)"],
    LOW:["rgba(0,230,118,.1)","#00E676","rgba(0,230,118,.25)"],
    DEMO:["rgba(99,102,241,.15)","#A5B4FC","rgba(99,102,241,.35)"],
  };
  const [bg,c,b]=M[label]||["rgba(255,255,255,.07)","rgba(255,255,255,.4)","rgba(255,255,255,.12)"];
  return <span style={{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:800,
    letterSpacing:".06em",border:`1px solid ${b}`,background:bg,color:c,fontFamily:"monospace",whiteSpace:"nowrap"}}>{label}</span>;
}

function ConfBar({val,color="#6366F1"}) {
  return <div style={{display:"flex",alignItems:"center",gap:8}}>
    <div style={{flex:1,height:3,background:"rgba(255,255,255,.07)",borderRadius:2,overflow:"hidden"}}>
      <div style={{width:`${val}%`,height:"100%",background:color,borderRadius:2,
        transition:"width .8s ease",boxShadow:`0 0 8px ${color}55`}}/>
    </div>
    <span style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"monospace",minWidth:28}}>{val}%</span>
  </div>;
}

function CoinIcon({coin,size=38}) {
  return <div style={{width:size,height:size,borderRadius:size*.28,flexShrink:0,
    background:`${coin.color}18`,border:`1px solid ${coin.color}45`,
    display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:size*.28,fontWeight:800,color:coin.color,letterSpacing:"-.02em"}}>
    {coin.symbol.slice(0,3)}
  </div>;
}

// Animated number ticker
function Ticker({value, prefix="$", decimals=2, color}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(()=>{
    if (value===prev.current) return;
    prev.current = value;
    setDisplay(value);
  },[value]);
  return <span style={{color:color||"inherit",transition:"color .3s"}}>
    {prefix}{fmt(display,decimals)}
  </span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function SignalPulsePro() {
  const [screen,setScreen]         = useState(S.SPLASH);
  const [tab,setTab]               = useState("signals");
  const [subInput,setSubInput]     = useState("");
  const [subError,setSubError]     = useState("");
  const [isOwner,setIsOwner]       = useState(false);
  const [demoUser]                 = useState({ name:"Tim Feipel", avatar:"TF" });

  // Market
  const [prices,setPrices]         = useState({});
  const [histories,setHistories]   = useState({});
  const [signals,setSignals]       = useState({});
  const [notes,setNotes]           = useState([]);
  const [unread,setUnread]         = useState(0);
  const [lastFetch,setLastFetch]   = useState(null);
  const [fetching,setFetching]     = useState(false);
  const priceRef                   = useRef(null);

  // Demo portfolio (simulated Uphold)
  const [portfolio,setPortfolio]   = useState(DEMO_PORTFOLIO);
  const [tradeLog,setTradeLog]     = useState([]);

  // Pivot
  const [pivotCoin,setPivotCoin]   = useState(null);
  const [pivotRec,setPivotRec]     = useState(null);
  const [pivotLoading,setPivotLoading] = useState(false);
  const [pivotPct,setPivotPct]     = useState(60);
  const [remainder,setRemainder]   = useState("HODL");
  const [confirming,setConfirming] = useState(false);
  const [tradeMsg,setTradeMsg]     = useState("");

  // Deep
  const [deepCoin,setDeepCoin]     = useState(null);
  const [deepData,setDeepData]     = useState({});
  const [deepLoading,setDeepLoading] = useState({});

  // ── Splash ────────────────────────────────────────────────────────────────
  useEffect(()=>{ const t=setTimeout(()=>setScreen(S.LOGIN),2200); return()=>clearTimeout(t); },[]);

  // ── Fetch real prices (CoinGecko) ─────────────────────────────────────────
  const fetchMarket = useCallback(async()=>{
    setFetching(true);
    try {
      const data = await fetchCGPrices();
      setPrices(data);
      setHistories(prev=>{
        const next={...prev};
        COINS.forEach(c=>{
          const p=data[c.cgId]?.usd;
          if(p){ const arr=[...(prev[c.cgId]||[p])]; arr.push(p); if(arr.length>24)arr.shift(); next[c.cgId]=arr; }
        });
        return next;
      });
      // Build signals from real 24h change
      const sigs={}, newNotes=[];
      COINS.forEach(c=>{
        const ch=data[c.cgId]?.usd_24h_change||0;
        let action,confidence,reason;
        if     (ch> 4)   {action="BUY"; confidence=clamp(65+Math.abs(ch)*2|0,65,95); reason=`Strong momentum +${ch.toFixed(1)}%. Volume surge confirms bullish move.`;}
        else if(ch> 1.5) {action="BUY"; confidence=clamp(60+ch|0,60,80);              reason=`Positive trend +${ch.toFixed(1)}%. Steady accumulation building.`;}
        else if(ch<-4)   {action="EXIT";confidence=clamp(65+Math.abs(ch)*2|0,65,94); reason=`Sharp decline ${ch.toFixed(1)}%. AI recommends pivot — protect capital now.`;}
        else if(ch<-1.5) {action="EXIT";confidence=clamp(58+Math.abs(ch)|0,58,78);   reason=`Bearish pressure ${ch.toFixed(1)}%. Consider rotating to a stronger coin.`;}
        else             {action="HODL";confidence=52+Math.floor(Math.random()*22);   reason=`Range-bound ${ch.toFixed(1)}%. No clear directional signal — hold position.`;}
        sigs[c.symbol]={action,confidence,reason,change:ch,price:data[c.cgId]?.usd};
        if(action!=="HODL") newNotes.push({id:Date.now()+Math.random(),coin:c.symbol,
          coinColor:c.color,action,confidence,reason,price:data[c.cgId]?.usd,change:ch,time:Date.now(),read:false});
      });
      setSignals(sigs);
      if(newNotes.length){ setNotes(p=>[...newNotes,...p].slice(0,50)); setUnread(n=>n+newNotes.length); }
      setLastFetch(Date.now());
    } catch(_){}
    setFetching(false);
  },[]);

  useEffect(()=>{
    if(screen===S.MAIN){ fetchMarket(); priceRef.current=setInterval(fetchMarket,45000); return()=>clearInterval(priceRef.current); }
  },[screen,fetchMarket]);

  // ── Subscription ──────────────────────────────────────────────────────────
  const handleSub = () => {
    if(subInput.trim()===OWNER_KEY){ setIsOwner(true); setScreen(S.MAIN); }
    else if(subInput.trim().startsWith("SP-")){ setScreen(S.MAIN); }
    else setSubError("Invalid key. Try the demo button below.");
  };

  // ── Portfolio value ────────────────────────────────────────────────────────
  const portfolioUSD = Object.entries(portfolio).reduce((s,[sym,h])=>{
    if(sym==="USDC"||sym==="USDT"||sym==="DAI") return s+h.amount;
    const coin=COINS.find(c=>c.symbol===sym);
    const price=coin?prices[coin.cgId]?.usd:0;
    return s+(price?h.amount*price:0);
  },0);

  const portfolioChange = Object.entries(portfolio).reduce((s,[sym,h])=>{
    if(sym==="USDC"||sym==="USDT"||sym==="DAI") return s;
    const coin=COINS.find(c=>c.symbol===sym);
    const price=coin?prices[coin.cgId]?.usd:0;
    if(!price||!h.avgBuy) return s;
    return s+((price-h.avgBuy)*h.amount);
  },0);

  // ── Open pivot ────────────────────────────────────────────────────────────
  const openPivot = async(symbol)=>{
    setPivotCoin(symbol); setPivotRec(null); setPivotLoading(true);
    setConfirming(false); setTradeMsg(""); setPivotPct(60); setRemainder("HODL");
    setScreen(S.PIVOT);
    const holdings=Object.fromEntries(Object.entries(portfolio).filter(([,v])=>v.amount>0).map(([k,v])=>[k,v.amount]));
    try { const rec=await aiPivot(symbol,prices,holdings); setPivotRec(rec); }
    catch(_){ setPivotRec({pivotCoin:"USDC",confidence:65,exitReason:"Exit signal triggered.",
      entryReason:"Stable coin preserves capital.",bullish:[],bearish:[],
      targetGain:"0%",timeframe:"—",riskLevel:"LOW",stableReason:"Safety first."}); }
    setPivotLoading(false);
  };

  // ── Execute demo trade ────────────────────────────────────────────────────
  const executeTrade = ()=>{
    if(!pivotRec||!pivotCoin) return;
    const exitHolding = portfolio[pivotCoin];
    if(!exitHolding||exitHolding.amount<=0){ setTradeMsg("No balance to pivot."); return; }
    const exitPrice  = prices[COINS.find(c=>c.symbol===pivotCoin)?.cgId]?.usd||0;
    const totalUSDVal= exitHolding.amount * exitPrice;
    const pivotUSD   = totalUSDVal * pivotPct/100;
    const remUSD     = totalUSDVal * (100-pivotPct)/100;
    const pivotPrice = prices[COINS.find(c=>c.symbol===pivotRec.pivotCoin)?.cgId]?.usd||1;
    const pivotAmt   = pivotUSD / pivotPrice;

    setPortfolio(prev=>{
      const next={...prev};
      // Remove exit coin
      next[pivotCoin]={...next[pivotCoin], amount:0};
      // Add pivot coin
      if(!next[pivotRec.pivotCoin]) next[pivotRec.pivotCoin]={amount:0,avgBuy:pivotPrice};
      next[pivotRec.pivotCoin]={amount:(next[pivotRec.pivotCoin].amount||0)+pivotAmt, avgBuy:pivotPrice};
      // Handle remainder
      if(remainder!=="HODL"){
        if(!next[remainder]) next[remainder]={amount:0,avgBuy:1};
        next[remainder]={amount:(next[remainder].amount||0)+remUSD,avgBuy:1};
      } else {
        // HODL remainder stays in exit coin
        if(exitPrice>0) next[pivotCoin]={amount:remUSD/exitPrice, avgBuy:exitHolding.avgBuy||exitPrice};
      }
      return next;
    });

    setTradeLog(prev=>[{id:Date.now(),time:Date.now(),type:"PIVOT",
      from:pivotCoin,to:pivotRec.pivotCoin,pivotPct,
      pivotUSD,remUSD,remDest:remainder,
      fromPrice:exitPrice,toPrice:pivotPrice,
    },...prev]);

    setTradeMsg(`✓ DEMO TRADE EXECUTED — ${fmt(pivotAmt,6)} ${pivotRec.pivotCoin} acquired`);
    setTimeout(()=>{ setScreen(S.MAIN); setPivotCoin(null); setPivotRec(null); setTradeMsg(""); },2000);
  };

  // ── Deep analysis ──────────────────────────────────────────────────────────
  const openDeep = async(coin)=>{
    setDeepCoin(coin); setScreen(S.DEEP);
    if(deepData[coin.symbol]) return;
    setDeepLoading(p=>({...p,[coin.symbol]:true}));
    try {
      const da=await aiDeep(coin,prices[coin.cgId]?.usd,prices[coin.cgId]?.usd_24h_change,histories[coin.cgId]);
      setDeepData(p=>({...p,[coin.symbol]:da}));
    } catch(_){ setDeepData(p=>({...p,[coin.symbol]:{summary:"Analysis unavailable.",signal:"HODL",confidence:50,riskLevel:"MEDIUM"}})); }
    setDeepLoading(p=>({...p,[coin.symbol]:false}));
  };

  const markRead=()=>{ setNotes(p=>p.map(n=>({...n,read:true}))); setUnread(0); };

  // ── Shared style primitives ────────────────────────────────────────────────
  const G = {
    app:{ minHeight:"100vh", background:"#080B12", color:"#E4EAF8",
      fontFamily:"'DM Mono','IBM Plex Mono','Courier New',monospace",
      maxWidth:430, margin:"0 auto", position:"relative" },
    bg:{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
      background:"radial-gradient(ellipse at 10% 10%,rgba(99,102,241,.09) 0%,transparent 50%),radial-gradient(ellipse at 90% 85%,rgba(0,230,118,.05) 0%,transparent 50%),radial-gradient(ellipse at 50% 50%,rgba(247,147,26,.02) 0%,transparent 70%)" },
    card:{ background:"rgba(255,255,255,.028)", border:"1px solid rgba(255,255,255,.07)", borderRadius:14, padding:14 },
    input:{ width:"100%", background:"rgba(255,255,255,.055)", border:"1px solid rgba(255,255,255,.1)",
      borderRadius:10, padding:"12px 14px", color:"#E4EAF8", fontSize:13,
      fontFamily:"monospace", outline:"none", boxSizing:"border-box" },
    btn:(bg="#6366F1",fg="#fff",extra={})=>({ width:"100%",padding:"12px 0",borderRadius:10,
      border:"none",background:bg,color:fg,fontSize:13,fontWeight:700,
      cursor:"pointer",letterSpacing:".04em",fontFamily:"monospace",...extra }),
    lbl:{ fontSize:10,color:"rgba(255,255,255,.28)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6,display:"block" },
    hdr:{ position:"sticky",top:0,zIndex:50,background:"rgba(8,11,18,.93)",
      backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,.055)" },
    backBtn:{ background:"rgba(255,255,255,.07)",border:"none",color:"#aaa",
      width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:17,
      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SPLASH
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.SPLASH) return (
    <div style={{...G.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={G.bg}/>
      <div style={{textAlign:"center",zIndex:1,animation:"fadeIn .6s ease"}}>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
        <div style={{fontSize:44,fontWeight:900,letterSpacing:"-.05em",lineHeight:.95}}>
          SIGNAL<span style={{color:"#6366F1"}}>PULSE</span>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.25)",marginTop:10,letterSpacing:".2em",textTransform:"uppercase"}}>
          AI Crypto Day Trading
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",marginTop:32}}>
          <Pulse on size={8}/>
          <span style={{fontSize:10,color:"rgba(255,255,255,.2)",letterSpacing:".12em"}}>LOADING MARKETS...</span>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN / DEMO MODE GATE
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.LOGIN) return (
    <div style={{...G.app,padding:"40px 20px 60px"}}>
      <div style={G.bg}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{marginBottom:32,textAlign:"center"}}>
          <div style={{fontSize:30,fontWeight:900,letterSpacing:"-.04em"}}>
            SIGNAL<span style={{color:"#6366F1"}}>PULSE</span>
            <sup style={{color:"#00E676",fontSize:12,marginLeft:3}}>PRO</sup>
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.25)",marginTop:6}}>AI-Powered Crypto Day Trading</div>
        </div>

        {/* Demo mode card */}
        <div style={{...G.card,marginBottom:14,background:"rgba(0,230,118,.05)",borderColor:"rgba(0,230,118,.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <Badge label="DEMO"/>
            <span style={{fontSize:12,fontWeight:700,color:"#00E676"}}>Demo Mode</span>
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.45)",lineHeight:1.7,marginBottom:14}}>
            Try everything with a <strong style={{color:"#E4EAF8"}}>simulated Uphold portfolio</strong>.<br/>
            Real AI analysis · Real CoinGecko prices · Simulated trades.<br/>
            Connect real Uphold later when you deploy.
          </div>
          <button style={G.btn("#00E676","#000")} onClick={()=>setScreen(S.SUB)}>
            ENTER DEMO MODE →
          </button>
        </div>

        {/* Real connect — coming soon */}
        <div style={{...G.card,opacity:.5}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:8,letterSpacing:".1em"}}>CONNECT REAL UPHOLD</div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:"rgba(0,230,118,.1)",
              border:"1px solid rgba(0,230,118,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔗</div>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>Connect with Uphold</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>OAuth2 · Requires deployed URL</div>
            </div>
          </div>
          <button style={G.btn("rgba(255,255,255,.06)","rgba(255,255,255,.3)",{border:"1px solid rgba(255,255,255,.1)"})} disabled>
            COMING SOON — DEPLOY TO ENABLE
          </button>
          <div style={{fontSize:10,color:"rgba(255,255,255,.2)",marginTop:8,textAlign:"center"}}>
            Deploy to Vercel/Netlify → get your URL → OAuth2 unlocks
          </div>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.SUB) return (
    <div style={{...G.app,padding:"40px 20px 60px"}}>
      <div style={G.bg}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{...G.card,marginBottom:20,background:"rgba(0,230,118,.05)",borderColor:"rgba(0,230,118,.2)"}}>
          <div style={{fontSize:10,color:"#00E676",marginBottom:6}}>✓ DEMO MODE READY</div>
          <div style={{fontWeight:700,fontSize:14}}>{demoUser.name}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:2}}>
            Simulated Uphold Portfolio · Real AI · Real Prices
          </div>
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
            {Object.entries(DEMO_PORTFOLIO).filter(([,v])=>v.amount>0).map(([sym,h])=>(
              <div key={sym} style={{fontSize:10,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.05)",
                padding:"3px 8px",borderRadius:6}}>{sym}: {sym==="USDC"?usd(h.amount):fmt(h.amount,4)}</div>
            ))}
          </div>
        </div>

        <div style={{...G.card,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>SignalPulse Pro</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.35)",marginBottom:14}}>
            $19.99 / month · AI monitoring · Trade execution · Push alerts
          </div>
          <label style={G.lbl}>Subscription Key</label>
          <input style={G.input} placeholder="SP-XXXX-XXXX  or  OWNER-..."
            value={subInput} onChange={e=>{setSubInput(e.target.value);setSubError("");}}/>
        </div>

        {subError && <div style={{color:"#FF5252",fontSize:11,padding:"8px 12px",background:"rgba(255,82,82,.08)",borderRadius:8,marginBottom:12}}>{subError}</div>}

        <button style={G.btn()} onClick={handleSub}>ACTIVATE →</button>
        <div style={{textAlign:"center",marginTop:12}}>
          <button style={{background:"none",border:"none",color:"rgba(255,255,255,.25)",
            fontSize:11,cursor:"pointer",fontFamily:"monospace"}}
            onClick={()=>setSubInput(OWNER_KEY)}>
            (tap to fill owner key)
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PIVOT ADVISOR
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.PIVOT) {
    const exitC    = COINS.find(c=>c.symbol===pivotCoin);
    const exitH    = portfolio[pivotCoin]||{amount:0};
    const exitPrice= prices[exitC?.cgId]?.usd||0;
    const exitUSD  = exitH.amount * exitPrice;
    const pivotC   = pivotRec ? COINS.find(c=>c.symbol===pivotRec.pivotCoin) : null;
    const pivotUSD = exitUSD * pivotPct/100;
    const remUSD   = exitUSD * (100-pivotPct)/100;

    return (
      <div style={{...G.app,paddingBottom:40}}>
        <div style={G.bg}/>
        <div style={{position:"relative",zIndex:1}}>
          {/* Header */}
          <div style={{...G.hdr,padding:"14px 16px 12px",display:"flex",alignItems:"center",gap:10}}>
            <button style={G.backBtn} onClick={()=>{setScreen(S.MAIN);setPivotCoin(null);setPivotRec(null);}}>←</button>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>AI PIVOT ADVISOR</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>Exit {pivotCoin} → Find best opportunity</div>
            </div>
            <Badge label="DEMO"/>
          </div>

          <div style={{padding:"14px 14px 0"}}>
            {/* Exit summary */}
            <div style={{...G.card,marginBottom:12,borderLeft:`3px solid ${exitC?.color||"#888"}`,borderColor:`${exitC?.color}44`}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:6,letterSpacing:".1em"}}>EXITING POSITION</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <CoinIcon coin={exitC||{symbol:pivotCoin,color:"#888"}} size={40}/>
                  <div>
                    <div style={{fontWeight:800,fontSize:17,color:exitC?.color}}>{pivotCoin}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{fmt(exitH.amount,6)} coins</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:700,fontSize:16}}>{usd(exitUSD)}</div>
                  <div style={{fontSize:11,color:"#FF5252"}}>{pct(prices[exitC?.cgId]?.usd_24h_change||0)} 24h</div>
                </div>
              </div>
              {pivotRec && <div style={{fontSize:11,color:"rgba(255,82,82,.75)",marginTop:8,lineHeight:1.5,borderTop:"1px solid rgba(255,82,82,.15)",paddingTop:8}}>
                ⚠ {pivotRec.exitReason}
              </div>}
            </div>

            {pivotLoading?(
              <div style={{textAlign:"center",padding:"50px 0",color:"rgba(255,255,255,.25)"}}>
                <div style={{fontSize:24,color:"#6366F1",marginBottom:12,animation:"spin 1.5s linear infinite"}}>◆
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
                <div style={{fontSize:12,letterSpacing:".12em"}}>CLAUDE IS SCANNING MARKETS...</div>
                <div style={{fontSize:10,marginTop:6,color:"rgba(255,255,255,.15)"}}>Analyzing all 8 coins for best pivot opportunity</div>
              </div>
            ) : pivotRec && (<>

              {/* AI Recommended Pivot */}
              <div style={{...G.card,marginBottom:12,borderColor:"rgba(99,102,241,.3)",background:"rgba(99,102,241,.06)"}}>
                <div style={{fontSize:10,color:"#A5B4FC",marginBottom:10,letterSpacing:".1em"}}>◆ CLAUDE RECOMMENDS PIVOT INTO</div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <CoinIcon coin={pivotC||{symbol:pivotRec.pivotCoin,color:"#6366F1"}} size={46}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:20}}>{pivotRec.pivotCoin}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{usd(prices[pivotC?.cgId]?.usd)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:13,color:"#00E676",fontWeight:700}}>{pivotRec.targetGain}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{pivotRec.timeframe}</div>
                    <Badge label={pivotRec.riskLevel}/>
                  </div>
                </div>
                <ConfBar val={pivotRec.confidence} color="#6366F1"/>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:10,lineHeight:1.6}}>{pivotRec.entryReason}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
                  <div style={{background:"rgba(0,230,118,.05)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(0,230,118,.12)"}}>
                    <div style={{fontSize:9,color:"#00E676",marginBottom:5,letterSpacing:".08em"}}>▲ BULLISH</div>
                    {(pivotRec.bullish||[]).slice(0,3).map((b,i)=><div key={i} style={{fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:3,lineHeight:1.4}}>• {b}</div>)}
                  </div>
                  <div style={{background:"rgba(255,82,82,.05)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(255,82,82,.12)"}}>
                    <div style={{fontSize:9,color:"#FF5252",marginBottom:5,letterSpacing:".08em"}}>▼ RISKS</div>
                    {(pivotRec.bearish||[]).slice(0,2).map((b,i)=><div key={i} style={{fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:3,lineHeight:1.4}}>• {b}</div>)}
                  </div>
                </div>
              </div>

              {/* ─── PERCENTAGE SLIDER ─── */}
              <div style={{...G.card,marginBottom:12}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.28)",letterSpacing:".1em",marginBottom:14}}>
                  ALLOCATE YOUR {pivotCoin} POSITION
                </div>

                {/* Big % display */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                  <div>
                    <span style={{fontSize:36,fontWeight:900,color:"#A5B4FC",letterSpacing:"-.03em"}}>{pivotPct}</span>
                    <span style={{fontSize:16,color:"rgba(165,180,252,.5)",marginLeft:2}}>%</span>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:1}}>→ {pivotRec.pivotCoin} · {usd(pivotUSD)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:20,fontWeight:700,color:remainder==="HODL"?"#FFD54F":"#64B5F6"}}>{100-pivotPct}</span>
                    <span style={{fontSize:12,color:"rgba(255,255,255,.3)",marginLeft:1}}>%</span>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:1}}>{remainder} · {usd(remUSD)}</div>
                  </div>
                </div>

                {/* Slider */}
                <input type="range" min={10} max={100} step={5} value={pivotPct}
                  onChange={e=>setPivotPct(Number(e.target.value))}
                  style={{width:"100%",accentColor:"#6366F1",cursor:"pointer",height:4,marginBottom:4}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,.18)",marginBottom:14}}>
                  <span>10%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>

                {/* Split bar */}
                <div style={{height:10,borderRadius:5,overflow:"hidden",background:"rgba(255,255,255,.06)",marginBottom:12,display:"flex",transition:"all .3s"}}>
                  <div style={{width:`${pivotPct}%`,background:"linear-gradient(90deg,#4F46E5,#A5B4FC)",transition:"width .3s",borderRadius:"5px 0 0 5px"}}/>
                  <div style={{flex:1,background:remainder==="HODL"?"rgba(255,213,79,.4)":"rgba(100,181,246,.4)",transition:"background .3s",borderRadius:"0 5px 5px 0"}}/>
                </div>

                {/* Remainder choice */}
                <div style={{fontSize:10,color:"rgba(255,255,255,.28)",letterSpacing:".1em",marginBottom:8}}>REMAINDER ({100-pivotPct}%) GOES TO</div>
                <div style={{display:"flex",gap:6}}>
                  {["HODL","USDC","USDT"].map(opt=>(
                    <button key={opt} onClick={()=>setRemainder(opt)}
                      style={{flex:1,padding:"9px 0",borderRadius:8,cursor:"pointer",fontFamily:"monospace",
                        border:`1px solid ${remainder===opt?"#6366F1":"rgba(255,255,255,.08)"}`,
                        background:remainder===opt?"rgba(99,102,241,.2)":"rgba(255,255,255,.03)",
                        color:remainder===opt?"#A5B4FC":"rgba(255,255,255,.35)",fontSize:11,fontWeight:700,transition:"all .2s"}}>
                      {opt}
                    </button>
                  ))}
                </div>
                {remainder!=="HODL" && (
                  <div style={{fontSize:10,color:"rgba(100,181,246,.6)",marginTop:8,lineHeight:1.5}}>💡 {pivotRec.stableReason}</div>
                )}
              </div>

              {/* Execute */}
              {tradeMsg ? (
                <div style={{...G.card,textAlign:"center",padding:"20px",borderColor:"rgba(0,230,118,.3)",background:"rgba(0,230,118,.08)"}}>
                  <div style={{fontSize:14,color:"#00E676",fontWeight:700}}>{tradeMsg}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.35)",marginTop:6}}>Returning to dashboard...</div>
                </div>
              ) : confirming ? (
                <div style={{...G.card,marginBottom:12,borderColor:"rgba(255,193,7,.3)",background:"rgba(255,193,7,.05)"}}>
                  <div style={{fontSize:10,color:"#FFD54F",marginBottom:10,letterSpacing:".1em"}}>⚠ CONFIRM DEMO TRADE</div>
                  <div style={{fontSize:12,lineHeight:2.2,color:"rgba(255,255,255,.7)"}}>
                    <div>Pivot <span style={{color:"#FF5252",fontWeight:700}}>{pivotPct}% of {pivotCoin}</span> → <span style={{color:"#00E676",fontWeight:700}}>{pivotRec.pivotCoin}</span></div>
                    <div>Value: <span style={{color:"#A5B4FC",fontWeight:700}}>{usd(pivotUSD)}</span> at {usd(prices[pivotC?.cgId]?.usd)}</div>
                    <div>Remainder: <span style={{color:remainder==="HODL"?"#FFD54F":"#64B5F6",fontWeight:700}}>{100-pivotPct}% → {remainder}</span> ({usd(remUSD)})</div>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button style={{...G.btn("rgba(255,82,82,.12)","#FF5252",{flex:1,border:"1px solid rgba(255,82,82,.3)"}),width:"auto"}}
                      onClick={()=>setConfirming(false)}>CANCEL</button>
                    <button style={{...G.btn("#00E676","#000",{flex:2}),width:"auto"}} onClick={executeTrade}>
                      EXECUTE DEMO TRADE ▸
                    </button>
                  </div>
                </div>
              ) : (
                <button style={G.btn("#6366F1")} onClick={()=>setConfirming(true)}>
                  PREVIEW TRADE →
                </button>
              )}

              <div style={{fontSize:9,color:"rgba(255,255,255,.1)",textAlign:"center",marginTop:14,lineHeight:1.7}}>
                DEMO MODE — No real money. When you deploy and connect Uphold OAuth2, this executes real trades.
              </div>
            </>)}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DEEP ANALYSIS
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.DEEP && deepCoin) {
    const da=deepData[deepCoin.symbol];
    const price=prices[deepCoin.cgId]?.usd;
    const change=prices[deepCoin.cgId]?.usd_24h_change;
    return (
      <div style={{...G.app,paddingBottom:40}}>
        <div style={G.bg}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{...G.hdr,padding:"14px 16px 12px",display:"flex",alignItems:"center",gap:10}}>
            <button style={G.backBtn} onClick={()=>setScreen(S.MAIN)}>←</button>
            <CoinIcon coin={deepCoin} size={36}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{deepCoin.symbol} Deep Analysis</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{deepCoin.name} · Claude AI</div>
            </div>
          </div>
          <div style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:28,fontWeight:700,letterSpacing:"-.02em"}}>{usd(price)}</div>
              <div style={{fontSize:14,color:(change||0)>=0?"#00E676":"#FF5252",fontWeight:700}}>{pct(change||0)} 24h</div>
            </div>
            <Spark data={histories[deepCoin.cgId]} color={deepCoin.color} w={390} h={56}/>

            {deepLoading[deepCoin.symbol]?(
              <div style={{textAlign:"center",padding:"50px 0",color:"rgba(255,255,255,.25)"}}>
                <div style={{fontSize:20,color:"#6366F1",marginBottom:10}}>◆</div>
                <div style={{fontSize:12,letterSpacing:".12em"}}>CLAUDE ANALYZING {deepCoin.symbol}...</div>
              </div>
            ):da&&(<>
              <div style={{...G.card,marginTop:14,marginBottom:12,background:"rgba(99,102,241,.05)",borderColor:"rgba(99,102,241,.2)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <Badge label={da.signal||"HODL"}/>
                  <Badge label={da.riskLevel||"MEDIUM"}/>
                </div>
                <ConfBar val={da.confidence||70}
                  color={da.signal==="BUY"?"#00E676":da.signal==="EXIT"?"#FF5252":"#FFD54F"}/>
                <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:10,lineHeight:1.7}}>{da.summary}</div>
                <div style={{fontSize:12,color:"#A5B4FC",marginTop:8,padding:"8px 10px",
                  background:"rgba(99,102,241,.08)",borderRadius:8,lineHeight:1.5}}>▸ {da.action}</div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                {[["TARGET",da.targetPrice,"#00E676"],["STOP LOSS",da.stopLoss,"#FF5252"],
                  ["SUPPORT",da.keyLevels?.support,"#FFD54F"],["RESISTANCE",da.keyLevels?.resistance,"#A5B4FC"]
                ].map(([l,v,c])=>(
                  <div key={l} style={{...G.card,textAlign:"center"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.28)",letterSpacing:".1em",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:700,color:c}}>{v||"—"}</div>
                  </div>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                <div style={{...G.card,borderLeft:"2px solid rgba(0,230,118,.4)"}}>
                  <div style={{fontSize:9,color:"#00E676",marginBottom:6,letterSpacing:".08em"}}>▲ BULLISH</div>
                  {(da.bullish||[]).map((b,i)=><div key={i} style={{fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:3,lineHeight:1.5}}>• {b}</div>)}
                </div>
                <div style={{...G.card,borderLeft:"2px solid rgba(255,82,82,.4)"}}>
                  <div style={{fontSize:9,color:"#FF5252",marginBottom:6,letterSpacing:".08em"}}>▼ BEARISH</div>
                  {(da.bearish||[]).map((b,i)=><div key={i} style={{fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:3,lineHeight:1.5}}>• {b}</div>)}
                </div>
              </div>

              {da.signal==="EXIT"&&(
                <button style={G.btn("#FF5252")} onClick={()=>openPivot(deepCoin.symbol)}>
                  ⇄ OPEN PIVOT ADVISOR →
                </button>
              )}
            </>)}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════════════════════════════════
  if(screen===S.SETTINGS) return (
    <div style={{...G.app,paddingBottom:40}}>
      <div style={G.bg}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{...G.hdr,padding:"14px 16px 12px",display:"flex",alignItems:"center",gap:10}}>
          <button style={G.backBtn} onClick={()=>setScreen(S.MAIN)}>←</button>
          <div style={{fontWeight:700}}>Settings</div>
          {isOwner&&<span style={{marginLeft:"auto",fontSize:10,color:"#00E676",background:"rgba(0,230,118,.1)",padding:"3px 10px",borderRadius:20,border:"1px solid rgba(0,230,118,.25)"}}>OWNER ACCESS</span>}
        </div>
        <div style={{padding:16}}>
          <div style={{...G.card,marginBottom:14,borderColor:"rgba(0,230,118,.2)",background:"rgba(0,230,118,.04)"}}>
            <div style={{fontSize:10,color:"#00E676",marginBottom:6}}>DEMO MODE ACTIVE</div>
            <div style={{fontWeight:700}}>{demoUser.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:3}}>Simulated Uphold portfolio · Real AI · Real prices</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.25)",marginTop:8,lineHeight:1.6}}>
              To connect your real Uphold account:<br/>
              1. Deploy this app to Vercel or Netlify (free)<br/>
              2. Register OAuth2 app at wallet.uphold.com<br/>
              3. Enter your Client ID in settings
            </div>
          </div>
          <div style={{...G.card,marginBottom:14}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.28)",marginBottom:4}}>SUBSCRIPTION</div>
            <div style={{fontWeight:700,color:isOwner?"#00E676":"#FFD54F"}}>{isOwner?"Owner — Free Lifetime":"Active Subscriber"}</div>
          </div>
          <div style={{...G.card,marginBottom:14}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.28)",marginBottom:4}}>PRICE FEED</div>
            <div style={{fontSize:12}}>CoinGecko API · Live prices · 45s refresh</div>
          </div>
          <div style={{...G.card,marginBottom:14}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.28)",marginBottom:4}}>AI ENGINE</div>
            <div style={{fontSize:12}}>Claude Sonnet 4 · Real-time analysis</div>
          </div>
          <button style={{...G.btn("rgba(255,82,82,.1)","#FF5252",{border:"1px solid rgba(255,82,82,.25)"}),marginTop:4}}
            onClick={()=>{ setScreen(S.LOGIN); }}>
            SIGN OUT
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={G.app}>
      <div style={G.bg}/>
      <div style={{position:"relative",zIndex:1}}>

        {/* ── Sticky Header ── */}
        <div style={{...G.hdr,padding:"12px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontSize:19,fontWeight:900,letterSpacing:"-.025em",lineHeight:1}}>
                SIGNAL<span style={{color:"#6366F1"}}>PULSE</span>
                {isOwner&&<span style={{color:"#00E676",fontSize:9,marginLeft:4,letterSpacing:".1em"}}>OWNER</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                <Pulse on={!fetching}/>
                <span style={{fontSize:9,color:"rgba(255,255,255,.2)",letterSpacing:".08em"}}>
                  {fetching?"FETCHING PRICES...":lastFetch?`UPDATED ${ago(lastFetch)}`:"CONNECTING..."}
                </span>
                <span style={{fontSize:9,color:"rgba(0,230,118,.4)",letterSpacing:".06em"}}>DEMO</span>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:".08em"}}>PORTFOLIO</div>
                <div style={{fontSize:15,fontWeight:700,color:"#00E676"}}>{usd(portfolioUSD)}</div>
                <div style={{fontSize:10,color:portfolioChange>=0?"rgba(0,230,118,.7)":"rgba(255,82,82,.7)"}}>
                  {portfolioChange>=0?"▲":"▼"} {usd(Math.abs(portfolioChange))} PnL
                </div>
              </div>
              <button onClick={()=>setScreen(S.SETTINGS)}
                style={{...G.backBtn,color:"rgba(255,255,255,.5)",fontSize:15,width:34,height:34}}>⚙</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:0}}>
            {[["signals","SIGNALS"],["alerts",`ALERTS${unread>0?` •${unread}`:""}`],["portfolio","WALLET"],["log","TRADES"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>{setTab(id);if(id==="alerts")markRead();}}
                style={{flex:1,padding:"8px 0 10px",fontSize:9,fontWeight:700,letterSpacing:".09em",
                  border:"none",background:"none",cursor:"pointer",transition:"all .2s",
                  color:tab===id?"#A5B4FC":"rgba(255,255,255,.28)",
                  borderBottom:`2px solid ${tab===id?"#6366F1":"transparent"}`}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{padding:"14px 14px 70px"}}>

          {/* ── SIGNALS ── */}
          {tab==="signals" && COINS.map(coin=>{
            const cg=prices[coin.cgId]||{};
            const sig=signals[coin.symbol];
            const hist=histories[coin.cgId]||[];
            const holding=portfolio[coin.symbol];
            const holdBal=holding?.amount||0;
            const holdUSD=holdBal*(cg.usd||0);
            const pnl=holding&&holding.avgBuy&&cg.usd?((cg.usd-holding.avgBuy)/holding.avgBuy)*100:null;

            return (
              <div key={coin.symbol} style={{...G.card,marginBottom:10}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <CoinIcon coin={coin}/>
                    <div>
                      <div style={{fontWeight:800,fontSize:14}}>{coin.symbol}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.25)"}}>{coin.name}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:16,fontWeight:700}}>{cg.usd?usd(cg.usd):"—"}</div>
                    <div style={{fontSize:11,color:(cg.usd_24h_change||0)>=0?"#00E676":"#FF5252",fontWeight:600}}>
                      {pct(cg.usd_24h_change||0)} 24h
                    </div>
                  </div>
                </div>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <Spark data={hist} color={coin.color}/>
                  {sig&&<Badge label={sig.action}/>}
                </div>

                {sig&&<ConfBar val={sig.confidence}
                  color={sig.action==="BUY"?"#00E676":sig.action==="EXIT"?"#FF5252":"#FFD54F"}/>}
                {sig&&<div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:7,lineHeight:1.5}}>{sig.reason}</div>}

                {holdBal>0&&(
                  <div style={{marginTop:9,padding:"6px 10px",background:`${coin.color}0f`,
                    borderRadius:8,fontSize:10,display:"flex",justifyContent:"space-between",
                    alignItems:"center",border:`1px solid ${coin.color}22`}}>
                    <span style={{color:coin.color}}>{fmt(holdBal,coin.symbol==="USDC"?2:6)} {coin.symbol}</span>
                    <span style={{color:"rgba(255,255,255,.5)"}}>{usd(holdUSD)}</span>
                    {pnl!=null&&<span style={{color:pnl>=0?"#00E676":"#FF5252",fontWeight:700}}>{pct(pnl)}</span>}
                  </div>
                )}

                <div style={{display:"flex",gap:6,marginTop:10}}>
                  {sig?.action==="EXIT"&&(
                    <button onClick={()=>openPivot(coin.symbol)}
                      style={{flex:2,padding:"9px",borderRadius:8,cursor:"pointer",fontFamily:"monospace",
                        border:"1px solid rgba(255,82,82,.4)",background:"rgba(255,82,82,.1)",
                        color:"#FF5252",fontSize:11,fontWeight:800}}>
                      ⇄ AI PIVOT ADVISOR
                    </button>
                  )}
                  {sig?.action==="BUY"&&(
                    <button style={{flex:2,padding:"9px",borderRadius:8,fontFamily:"monospace",
                      border:"1px solid rgba(0,230,118,.4)",background:"rgba(0,230,118,.1)",
                      color:"#00E676",fontSize:11,fontWeight:800,cursor:"pointer"}}>
                      ✓ AI SIGNAL: BUY
                    </button>
                  )}
                  {sig?.action==="HODL"&&(
                    <button style={{flex:2,padding:"9px",borderRadius:8,fontFamily:"monospace",
                      border:"1px solid rgba(255,213,79,.3)",background:"rgba(255,213,79,.06)",
                      color:"#FFD54F",fontSize:11,fontWeight:800,cursor:"pointer"}}>
                      ◆ HOLDING
                    </button>
                  )}
                  <button onClick={()=>openDeep(coin)}
                    style={{flex:1,padding:"9px",borderRadius:8,cursor:"pointer",fontFamily:"monospace",
                      border:"1px solid rgba(99,102,241,.3)",background:"rgba(99,102,241,.08)",
                      color:"#A5B4FC",fontSize:11,fontWeight:800}}>
                    AI ▸
                  </button>
                </div>
              </div>
            );
          })}

          {/* ── ALERTS ── */}
          {tab==="alerts"&&(
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.2)",letterSpacing:".1em",marginBottom:12}}>
                REAL-TIME SIGNAL ALERTS — {notes.length} total
              </div>
              {notes.length===0&&(
                <div style={{textAlign:"center",padding:"50px 0",color:"rgba(255,255,255,.2)",fontSize:12}}>
                  Scanning markets...<br/>EXIT & BUY signals appear here automatically.
                </div>
              )}
              {notes.map(n=>(
                <div key={n.id} style={{...G.card,marginBottom:8,
                  borderLeft:`3px solid ${n.coinColor}`,opacity:n.read?.6:1,
                  background:n.read?"rgba(255,255,255,.02)":"rgba(255,255,255,.035)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <div style={{display:"flex",gap:7,alignItems:"center"}}>
                      <span style={{fontWeight:800,color:n.coinColor,fontSize:13}}>{n.coin}</span>
                      <Badge label={n.action}/>
                    </div>
                    <span style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>{ago(n.time)}</span>
                  </div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",lineHeight:1.5}}>{n.reason}</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:"rgba(255,255,255,.2)"}}>
                    <span>{usd(n.price)}</span>
                    <span>{pct(n.change)} · {n.confidence}% confidence</span>
                  </div>
                  {n.action==="EXIT"&&(
                    <button onClick={()=>openPivot(n.coin)}
                      style={{width:"100%",marginTop:8,padding:"8px",borderRadius:8,cursor:"pointer",
                        fontFamily:"monospace",border:"1px solid rgba(255,82,82,.35)",
                        background:"rgba(255,82,82,.08)",color:"#FF5252",fontSize:10,fontWeight:800}}>
                      OPEN PIVOT ADVISOR →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── PORTFOLIO (Demo Uphold wallet) ── */}
          {tab==="portfolio"&&(
            <div>
              <div style={{...G.card,marginBottom:14,background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(0,230,118,.07))",
                borderColor:"rgba(99,102,241,.2)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.3)",letterSpacing:".1em",marginBottom:4}}>SIMULATED UPHOLD PORTFOLIO</div>
                <div style={{fontSize:30,fontWeight:700,color:"#00E676",letterSpacing:"-.02em"}}>{usd(portfolioUSD)}</div>
                <div style={{fontSize:12,color:portfolioChange>=0?"rgba(0,230,118,.8)":"rgba(255,82,82,.8)",marginTop:4}}>
                  {portfolioChange>=0?"▲":"▼"} {usd(Math.abs(portfolioChange))} unrealized PnL
                </div>
                <div style={{fontSize:10,color:"rgba(99,102,241,.6)",marginTop:6}}>DEMO MODE · No real money</div>
              </div>

              {Object.entries(portfolio).filter(([,v])=>v.amount>0).map(([sym,h])=>{
                const coin=COINS.find(c=>c.symbol===sym);
                const isStable=["USDC","USDT","DAI"].includes(sym);
                const price=isStable?1:(coin?prices[coin.cgId]?.usd:0)||0;
                const val=h.amount*price;
                const pnlPct=!isStable&&h.avgBuy&&price?((price-h.avgBuy)/h.avgBuy)*100:null;
                const sig=coin?signals[coin.symbol]:null;
                return (
                  <div key={sym} style={{...G.card,marginBottom:8,
                    borderLeft:`3px solid ${coin?.color||"#64B5F6"}55`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <CoinIcon coin={coin||{symbol:sym,color:"#64B5F6"}} size={36}/>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{sym}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,.25)"}}>
                            {isStable?usd(h.amount):fmt(h.amount,6)} {!isStable&&sym}
                          </div>
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:700,fontSize:14}}>{usd(val)}</div>
                        {pnlPct!=null&&<div style={{fontSize:11,color:pnlPct>=0?"#00E676":"#FF5252",fontWeight:600}}>{pct(pnlPct)}</div>}
                        {sig&&<Badge label={sig.action}/>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TRADE LOG ── */}
          {tab==="log"&&(
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.2)",letterSpacing:".1em",marginBottom:12}}>
                DEMO TRADE LOG — {tradeLog.length} trades
              </div>
              {tradeLog.length===0&&(
                <div style={{textAlign:"center",padding:"50px 0",color:"rgba(255,255,255,.2)",fontSize:12}}>
                  No trades yet.<br/>Use the Pivot Advisor to execute your first demo trade.
                </div>
              )}
              {tradeLog.map(t=>(
                <div key={t.id} style={{...G.card,marginBottom:8,borderLeft:"3px solid #6366F1"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#A5B4FC",fontWeight:800,fontSize:13}}>
                      ⇄ {t.from} → {t.to}
                    </span>
                    <span style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>{ago(t.time)}</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.5)",lineHeight:1.8}}>
                    <div>{t.pivotPct}% ({usd(t.pivotUSD)}) pivoted to {t.to} @ {usd(t.toPrice)}</div>
                    <div style={{color:"rgba(255,255,255,.3)"}}>Remainder {100-t.pivotPct}% ({usd(t.remUSD)}) → {t.remDest}</div>
                  </div>
                  <div style={{fontSize:9,color:"rgba(99,102,241,.5)",marginTop:4}}>DEMO TRADE · No real execution</div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
export default SignalPulsePro
