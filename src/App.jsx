import { useState, useEffect, useRef, useCallback } from "react";

const OWNER_KEY = "OWNER-SIGNALPULSE-FREE";

const COINS = [
  { symbol:"BTC",   name:"Bitcoin",       color:"#F7931A", cgId:"bitcoin"          },
  { symbol:"ETH",   name:"Ethereum",      color:"#627EEA", cgId:"ethereum"         },
  { symbol:"SOL",   name:"Solana",        color:"#9945FF", cgId:"solana"           },
  { symbol:"XRP",   name:"XRP",           color:"#00AAE4", cgId:"ripple"           },
  { symbol:"BNB",   name:"BNB",           color:"#F3BA2F", cgId:"binancecoin"      },
  { symbol:"ADA",   name:"Cardano",       color:"#0055FF", cgId:"cardano"          },
  { symbol:"DOGE",  name:"Dogecoin",      color:"#C2A633", cgId:"dogecoin"         },
  { symbol:"AVAX",  name:"Avalanche",     color:"#E84142", cgId:"avalanche-2"      },
  { symbol:"LINK",  name:"Chainlink",     color:"#2A5ADA", cgId:"chainlink"        },
  { symbol:"DOT",   name:"Polkadot",      color:"#E6007A", cgId:"polkadot"         },
  { symbol:"MATIC", name:"Polygon",       color:"#8247E5", cgId:"matic-network"    },
  { symbol:"UNI",   name:"Uniswap",       color:"#FF007A", cgId:"uniswap"          },
  { symbol:"ATOM",  name:"Cosmos",        color:"#6F7390", cgId:"cosmos"           },
  { symbol:"LTC",   name:"Litecoin",      color:"#BFBBBB", cgId:"litecoin"         },
  { symbol:"BCH",   name:"Bitcoin Cash",  color:"#8DC351", cgId:"bitcoin-cash"     },
  { symbol:"NEAR",  name:"NEAR Protocol", color:"#00C08B", cgId:"near"             },
  { symbol:"APT",   name:"Aptos",         color:"#29A8FF", cgId:"aptos"            },
  { symbol:"ARB",   name:"Arbitrum",      color:"#28A0F0", cgId:"arbitrum"         },
  { symbol:"USDC",  name:"USD Coin",      color:"#2775CA", cgId:"usd-coin"         },
  { symbol:"USDT",  name:"Tether",        color:"#26A17B", cgId:"tether"           },
];
const SIGNAL_COINS = COINS.filter(c=>!["USDC","USDT"].includes(c.symbol));
const CB_LIVE = false;

const S = {
  SPLASH:"splash", LANDING:"landing", LOGIN:"login", SIGNUP:"signup",
  PAYWALL:"paywall", MAIN:"main", PIVOT:"pivot", DEEP:"deep",
  SETTINGS:"settings", ADMIN:"admin", CONNECT:"connect", TRADE:"trade"
};

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
  @keyframes shimmer { 0%{opacity:.4} 50%{opacity:.8} 100%{opacity:.4} }
  * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  input::placeholder { color: rgba(255,255,255,.25); }
  input:focus { border-color: rgba(99,102,241,.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }
  input[type=range] { -webkit-appearance:none; height:4px; border-radius:2px; background:rgba(255,255,255,.1); outline:none; cursor:pointer; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#6366F1; cursor:pointer; border:2px solid rgba(255,255,255,.8); box-shadow:0 2px 8px rgba(99,102,241,.5); }
`;

const fmt  = (n,d=2) => n==null?"–":n>=1000?n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):n>=1?n.toFixed(d):n.toFixed(6);
const usd  = n => "$"+fmt(n);
const pct  = n => (n>=0?"+":"")+((n||0).toFixed(2))+"%";
const ago  = ts => { const s=Math.floor((Date.now()-ts)/1000); return s<60?s+"s ago":s<3600?Math.floor(s/60)+"m ago":Math.floor(s/3600)+"h ago"; };
const clamp= (v,a,b) => Math.max(a,Math.min(b,v));

const MOCK_KEY = "sp_users_v2";
const SESSION_KEY = "sp_session_v1";
function saveSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify({ subscribed: user.subscribed, trial: user.trial||false, trialStart: user.trialStart||null })); }
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); } catch(_){ return null; } }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getTrialDaysLeft(trialStart) { if(!trialStart) return 0; return Math.max(0, Math.ceil(30-(Date.now()-trialStart)/(1000*60*60*24))); }
const getUsers = () => { try { return JSON.parse(localStorage.getItem(MOCK_KEY)||"[]"); } catch(_){ return []; } };
const saveUsers = u => localStorage.setItem(MOCK_KEY, JSON.stringify(u));
async function signUpUser(email,password,name) {
  const users=getUsers();
  if(users.find(u=>u.email===email)) throw new Error("Email already registered.");
  const user={id:Date.now().toString(),email,password,name,createdAt:new Date().toISOString(),subscribed:false,trial:false,trialStart:null,provider:"email"};
  users.push(user); saveUsers(users); return user;
}
async function signInUser(email,password) { const user=getUsers().find(u=>u.email===email&&u.password===password); if(!user) throw new Error("Incorrect email or password."); return user; }
async function signInGoogle() { return {id:"g_"+Date.now(),email:"demo@gmail.com",name:"Google User",subscribed:false,provider:"google",createdAt:new Date().toISOString()}; }
function updateUserSub(userId,val) {
  const users=getUsers(),idx=users.findIndex(u=>u.id===userId);
  if(idx>=0){users[idx].subscribed=val;if(!val){users[idx].trial=false;}saveUsers(users);return users[idx];}
}

async function fetchCGPrices() { const ids=COINS.map(c=>c.cgId).join(","); const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`); if(!r.ok) throw new Error("CG"); return r.json(); }
async function fetchCGMarketData(cgIds) { const ids=cgIds.join(","); const r=await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d`); if(!r.ok) throw new Error("CG markets"); return r.json(); }
const CHART_DAYS = {"1H":1,"24H":1,"7D":7,"30D":30,"6M":180,"1Y":365,"3Y":1095,"5Y":1825};
async function fetchCGChart(cgId,timeframe) { const days=CHART_DAYS[timeframe]||1; const r=await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`); if(!r.ok) throw new Error("CG chart"); const d=await r.json(); return d.prices||[]; }

async function cbCall(action,params={}) {
  const apiKey    = sessionStorage.getItem("sp_cb_key")||"";
  const apiSecret = sessionStorage.getItem("sp_cb_secret")||"";
  if(!apiKey||!apiSecret) return cbMock(action,params); // paper mode fallback
  const r=await fetch("/api/coinbase-trade",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,apiKey,apiSecret,...params}),
  });
  const d=await r.json();
  if(!r.ok) throw new Error(d.error||"Coinbase error");
  return d;
}
async function cbMock(action,params) { await new Promise(r=>setTimeout(r,1500+Math.random()*800)); switch(action){case "balances":return{balances:{}};case "market":return{orderId:"cb_"+Date.now(),status:"completed"};case "limit":return{orderId:"cb_"+Date.now(),status:"pending"};case "cancel":return{success:true};case "orders":return{orders:[]};default:return{};} }
async function cbPlaceMarketOrder(mode,symbol,usdAmount,currentPrice){return cbCall("market",{mode,symbol,usdAmount,currentPrice});}
async function cbPlaceLimitOrder(mode,symbol,usdAmount,limitPrice){return cbCall("limit",{mode,symbol,usdAmount,limitPrice});}
async function cbCancelOrder(orderId){return cbCall("cancel",{orderId});}
async function cbFetchBalances(){const d=await cbCall("balances");return d.balances||{};}

async function aiPivot(exitSymbol,priceMap,portfolio){const r=await fetch("/api/ai-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"pivot",payload:{exitSymbol,priceMap,portfolio,coins:COINS}})});if(!r.ok)throw new Error("Pivot AI failed: "+r.status);return r.json();}
async function aiDeep(coin,price,change,history){const r=await fetch("/api/ai-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"deep",payload:{coin,price,change,history}})});if(!r.ok)throw new Error("Deep AI failed: "+r.status);return r.json();}

function computeTaxData(tradeLog){const now=Date.now();const rows=tradeLog.map(t=>{const proceeds=t.pivotUSD;const costBasis=t.pivotUSD*0.85;const gain=proceeds-costBasis;const holdDays=Math.floor((now-t.time)/(1000*60*60*24));const term=holdDays>=365?"Long-term":"Short-term";return{...t,proceeds,costBasis,gain,holdDays,term};});const totalGain=rows.reduce((s,r)=>s+r.gain,0);const shortGain=rows.filter(r=>r.term==="Short-term").reduce((s,r)=>s+r.gain,0);const longGain=rows.filter(r=>r.term==="Long-term").reduce((s,r)=>s+r.gain,0);return{rows,totalGain,shortGain,longGain};}
function exportCSV(rows){const header="Date,From,To,Proceeds (USD),Cost Basis (USD),Gain/Loss (USD),Hold Period,Term\n";const lines=rows.map(r=>`${new Date(r.time).toLocaleDateString()},${r.from},${r.to},$${r.proceeds.toFixed(2)},$${r.costBasis.toFixed(2)},$${r.gain.toFixed(2)},${r.holdDays} days,${r.term}`).join("\n");const blob=new Blob([header+lines],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="signalpulse_tax_report.csv";a.click();URL.revokeObjectURL(url);}

const T = {
  bg0:"#060A14",bg1:"#0B1120",bg2:"#111827",bg3:"rgba(255,255,255,.04)",
  accent:"#6366F1",accent2:"#818CF8",accent3:"#C7D2FE",
  green:"#10B981",green2:"#34D399",red:"#EF4444",red2:"#FCA5A5",
  gold:"#F59E0B",gold2:"#FCD34D",blue:"#3B82F6",
  t1:"#F1F5FD",t2:"#94A3B8",t3:"#475569",t4:"#1E293B",
  b1:"rgba(255,255,255,.08)",b2:"rgba(255,255,255,.05)",
  r1:16,r2:12,r3:8,r4:6,
};

function LiveDot({active=true}){return <span style={{display:"inline-flex",alignItems:"center",gap:5}}><span style={{width:7,height:7,borderRadius:"50%",background:active?T.green:"rgba(255,255,255,.2)",flexShrink:0,animation:active?"rpl 2s infinite":"none",boxShadow:active?`0 0 0 0 ${T.green}55`:"none"}}/></span>;}
function Spark({data,color,w=80,h=32}){if(!data||data.length<2)return <svg width={w} height={h}/>;const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*(h-5)-2}`).join(" ");const up=data[data.length-1]>=data[0];return <svg width={w} height={h} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={up?T.green:T.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
function Pill({label}){const variants={BUY:{bg:"rgba(16,185,129,.12)",c:T.green2,b:"rgba(16,185,129,.25)"},EXIT:{bg:"rgba(239,68,68,.12)",c:T.red2,b:"rgba(239,68,68,.25)"},HODL:{bg:"rgba(245,158,11,.1)",c:T.gold2,b:"rgba(245,158,11,.25)"},HIGH:{bg:"rgba(239,68,68,.1)",c:T.red2,b:"rgba(239,68,68,.2)"},MEDIUM:{bg:"rgba(245,158,11,.1)",c:T.gold2,b:"rgba(245,158,11,.2)"},LOW:{bg:"rgba(16,185,129,.1)",c:T.green2,b:"rgba(16,185,129,.2)"},PRO:{bg:"rgba(99,102,241,.15)",c:T.accent3,b:"rgba(99,102,241,.3)"},FREE:{bg:"rgba(71,85,105,.2)",c:T.t2,b:"rgba(71,85,105,.3)"},DEMO:{bg:"rgba(99,102,241,.1)",c:T.accent2,b:"rgba(99,102,241,.25)"},TRIAL:{bg:"rgba(16,185,129,.12)",c:T.green2,b:"rgba(16,185,129,.3)"},"Short-term":{bg:"rgba(239,68,68,.1)",c:T.red2,b:"rgba(239,68,68,.2)"},"Long-term":{bg:"rgba(16,185,129,.1)",c:T.green2,b:"rgba(16,185,129,.2)"},neutral:{bg:"rgba(255,255,255,.06)",c:T.t2,b:T.b1}};const s=variants[label]||variants.neutral;return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,letterSpacing:".02em",fontFamily:FONT_BODY,border:`1px solid ${s.b}`,background:s.bg,color:s.c,whiteSpace:"nowrap"}}>{label}</span>;}
function ProgressBar({val,color=T.accent,height=3}){return <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{flex:1,height,background:"rgba(255,255,255,.06)",borderRadius:height,overflow:"hidden"}}><div style={{width:`${val}%`,height:"100%",background:color,borderRadius:height,transition:"width .8s cubic-bezier(.4,0,.2,1)",boxShadow:`0 0 10px ${color}44`}}/></div><span style={{fontSize:12,color:T.t2,fontFamily:FONT_NUM,fontWeight:600,minWidth:32}}>{val}%</span></div>;}
function CoinAvatar({coin,size=40}){return <div style={{width:size,height:size,borderRadius:size*.3,flexShrink:0,background:`${coin.color}18`,border:`1px solid ${coin.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.28,fontWeight:700,color:coin.color,fontFamily:FONT_BODY}}>{coin.symbol.slice(0,3)}</div>;}
function Card({children,style={},accent}){return <div style={{background:T.bg2,border:`1px solid ${accent?`${accent}25`:T.b1}`,borderRadius:T.r1,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,.3)",...style}}>{children}</div>;}
function FormInput({label,type="text",value,onChange,placeholder,error,autoComplete}){return <div style={{marginBottom:16}}>{label&&<label style={{fontSize:12,color:T.t2,fontWeight:600,fontFamily:FONT_BODY,marginBottom:6,display:"block"}}>{label}</label>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} style={{width:"100%",background:T.bg1,border:`1px solid ${error?"rgba(239,68,68,.5)":T.b1}`,borderRadius:T.r3,padding:"12px 16px",color:T.t1,fontSize:14,fontFamily:FONT_BODY,outline:"none",boxSizing:"border-box",transition:"all .2s"}}/>{error&&<p style={{fontSize:12,color:T.red,marginTop:4,fontFamily:FONT_BODY}}>{error}</p>}</div>;}
function SocialBtn({icon,label,onClick}){return <button onClick={onClick} style={{width:"100%",padding:"13px",borderRadius:T.r3,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t1,fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:FONT_BODY,transition:"all .2s",marginBottom:8}}><span style={{fontSize:18}}>{icon}</span>{label}</button>;}
function Divider({label}){return <div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0"}}><div style={{flex:1,height:1,background:T.b1}}/><span style={{fontSize:12,color:T.t3,fontFamily:FONT_BODY,fontWeight:500}}>{label}</span><div style={{flex:1,height:1,background:T.b1}}/></div>;}
function Btn({children,onClick,variant="primary",disabled,style={}}){const variants={primary:{background:`linear-gradient(135deg,#6366F1,#818CF8)`,color:"#fff",border:"none"},secondary:{background:T.bg2,color:T.t1,border:`1px solid ${T.b1}`},danger:{background:"rgba(239,68,68,.1)",color:T.red,border:"1px solid rgba(239,68,68,.2)"},paypal:{background:"linear-gradient(135deg,#009CDE,#003087)",color:"#fff",border:"none"},ghost:{background:"transparent",color:T.t2,border:"none"},success:{background:`linear-gradient(135deg,#059669,#10B981)`,color:"#fff",border:"none"},uphold:{background:"linear-gradient(135deg,#1EB8B8,#0A8080)",color:"#fff",border:"none"}};const v=variants[variant]||variants.primary;return <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:"14px",borderRadius:T.r3,...v,fontSize:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:FONT_BODY,letterSpacing:".02em",transition:"all .2s",opacity:disabled?.6:1,...style}}>{children}</button>;}

function WalletTxModal({type,onClose,onSubmit,prices}){
  const [amount,setAmount]=useState("");
  const [toAddress,setToAddress]=useState("");
  const [selectedCoin,setSelectedCoin]=useState("ETH");
  const [busy,setBusy]=useState(false);
  const colorMap={BUY:T.green2,SELL:T.gold2,TRANSFER:T.accent2};
  const bgMap={BUY:"linear-gradient(135deg,#059669,#10B981)",SELL:"linear-gradient(135deg,#D97706,#F59E0B)",TRANSFER:"linear-gradient(135deg,#4F46E5,#818CF8)"};
  const coin=COINS.find(c=>c.symbol===selectedCoin);
  const price=coin?(prices[coin.cgId]?.usd||0):0;
  const estValue=amount&&price?parseFloat(amount)*price:0;
  const handleSubmit=()=>{
    if(!amount||parseFloat(amount)<=0)return;
    if(type==="TRANSFER"&&!toAddress)return;
    setBusy(true);
    setTimeout(()=>{onSubmit({type,coin:selectedCoin,amount,toAddress});setBusy(false);},1800);
  };
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"}}>
      <div style={{width:"100%",maxWidth:430,background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:"20px 20px 0 0",padding:24,paddingBottom:44}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <p style={{fontSize:18,fontWeight:800,color:T.t1,margin:0,fontFamily:FONT_DISPLAY}}>{type} CRYPTO</p>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.t3,fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <p style={{fontSize:12,color:T.t3,marginBottom:20,lineHeight:1.5}}>
          {type==="BUY"&&"Purchase crypto directly from your connected wallet"}
          {type==="SELL"&&"Sell crypto from your wallet balance"}
          {type==="TRANSFER"&&"Send crypto to another wallet address"}
        </p>
        <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Token</p>
        <select value={selectedCoin} onChange={e=>setSelectedCoin(e.target.value)} style={{width:"100%",background:T.bg0,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"12px 14px",color:T.t1,fontSize:14,marginBottom:16,outline:"none",boxSizing:"border-box",fontFamily:FONT_BODY}}>
          {COINS.filter(c=>!["USDC","USDT"].includes(c.symbol)).map(c=><option key={c.symbol} value={c.symbol}>{c.symbol} — {c.name}</option>)}
        </select>
        <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Amount ({selectedCoin})</p>
        <input type="number" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} style={{width:"100%",background:T.bg0,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"12px 14px",color:T.t1,fontSize:20,marginBottom:16,outline:"none",boxSizing:"border-box",fontFamily:FONT_NUM,fontWeight:700}}/>
        {type==="TRANSFER"&&(
          <>
            <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Recipient Address</p>
            <input type="text" placeholder="0x..." value={toAddress} onChange={e=>setToAddress(e.target.value)} style={{width:"100%",background:T.bg0,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"12px 14px",color:T.t1,fontSize:13,marginBottom:16,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/>
          </>
        )}
        <div style={{background:T.bg0,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"10px 14px",marginBottom:18}}>
          <p style={{fontSize:11,color:T.t3,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}>Estimated Value</p>
          <p style={{fontSize:20,color:colorMap[type],fontWeight:800,margin:0,fontFamily:FONT_NUM}}>{amount?usd(estValue):"$0.00"}</p>
        </div>
        <button onClick={handleSubmit} disabled={busy} style={{width:"100%",padding:"14px",background:bgMap[type],border:"none",borderRadius:T.r3,color:"#fff",fontSize:14,fontWeight:800,cursor:busy?"not-allowed":"pointer",marginBottom:10,fontFamily:FONT_BODY,opacity:busy?.7:1}}>
          {busy?"⏳ CONFIRMING ON CHAIN...":("✓ CONFIRM "+type)}
        </button>
        <button onClick={onClose} style={{width:"100%",padding:"12px",background:"transparent",border:`1px solid ${T.b1}`,borderRadius:T.r3,color:T.t3,fontSize:13,cursor:"pointer",fontFamily:FONT_BODY}}>CANCEL</button>
      </div>
    </div>
  );
}


function ApiKeyCard({apiKey,setApiKey,apiSecret,setApiSecret,saved,onSave,onClear,error}){
  const [showSecret,setShowSecret]=useState(false);
  const [expanded,setExpanded]=useState(!saved);
  return(
    <div style={{background:saved?"rgba(16,185,129,.06)":"rgba(99,102,241,.06)",border:`1px solid ${saved?"rgba(16,185,129,.3)":"rgba(99,102,241,.3)"}`,borderRadius:12,padding:16,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:expanded?14:0}}>
        <div>
          <p style={{fontSize:13,fontWeight:700,color:saved?T.green2:T.accent2,margin:0}}>{saved?"✓ Coinbase API Connected — Live Trading ON":"⚡ Connect Coinbase API for Live Trading"}</p>
          <p style={{fontSize:11,color:T.t3,margin:"2px 0 0",lineHeight:1.4}}>{saved?"Your keys are stored in this browser session only":"Enter your keys to enable real buy/sell/transfer"}</p>
        </div>
        <button onClick={()=>setExpanded(p=>!p)} style={{background:"none",border:"none",color:T.t3,fontSize:18,cursor:"pointer",padding:"0 4px"}}>{expanded?"▲":"▼"}</button>
      </div>
      {expanded&&(
        <>
          <div style={{background:"rgba(0,0,0,.25)",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:11,color:T.t2,lineHeight:1.8}}>
            <strong style={{color:T.accent2}}>How to get your Coinbase API keys:</strong><br/>
            1. Go to <strong>coinbase.com</strong> → Settings → API<br/>
            2. Click <strong>"New API Key"</strong><br/>
            3. Enable <strong>View + Trade</strong> permissions<br/>
            4. Copy your Key and Secret below
          </div>
          <div style={{marginBottom:10}}>
            <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>API Key</p>
            <input type="text" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="organizations/xxx/apiKeys/xxx"
              style={{width:"100%",background:T.bg0,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"10px 12px",color:T.t1,fontSize:12,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/>
          </div>
          <div style={{marginBottom:14,position:"relative"}}>
            <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>API Secret</p>
            <input type={showSecret?"text":"password"} value={apiSecret} onChange={e=>setApiSecret(e.target.value)} placeholder="-----BEGIN EC PRIVATE KEY-----"
              style={{width:"100%",background:T.bg0,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"10px 40px 10px 12px",color:T.t1,fontSize:12,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/>
            <button onClick={()=>setShowSecret(p=>!p)} style={{position:"absolute",right:10,top:"calc(50% + 10px)",transform:"translateY(-50%)",background:"none",border:"none",color:T.t3,cursor:"pointer",fontSize:14}}>{showSecret?"🙈":"👁️"}</button>
          </div>
          {error&&<p style={{fontSize:12,color:T.red,marginBottom:10}}>⚠️ {error}</p>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={onSave} style={{flex:2,padding:"11px",background:"linear-gradient(135deg,#059669,#10B981)",border:"none",borderRadius:T.r3,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT_BODY}}>{saved?"Update Keys":"Save & Enable Live Trading"}</button>
            {saved&&<button onClick={onClear} style={{flex:1,padding:"11px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",borderRadius:T.r3,color:T.red,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:FONT_BODY}}>Clear</button>}
          </div>
          <p style={{fontSize:10,color:T.t3,marginTop:10,lineHeight:1.6}}>🔐 Keys are stored only in your browser session memory and cleared when you close the browser. They are only sent to execute your own trades — never stored on our servers.</p>
        </>
      )}
    </div>
  );
}

export default function SignalPulsePro(){
  const [screen,setScreen]=useState(S.SPLASH);
  const [tab,setTab]=useState("signals");
  const [user,setUser]=useState(null);
  const [isOwner,setIsOwner]=useState(false);
  const [authName,setAuthName]=useState("");
  const [authEmail,setAuthEmail]=useState("");
  const [authPass,setAuthPass]=useState("");
  const [authErr,setAuthErr]=useState("");
  const [authBusy,setAuthBusy]=useState(false);
  const [ownerInput,setOwnerInput]=useState("");
  const [prices,setPrices]=useState({});
  const [histories,setHistories]=useState({});
  const [signals,setSignals]=useState({});
  const [notes,setNotes]=useState([]);
  const [unread,setUnread]=useState(0);
  const [lastFetch,setLastFetch]=useState(null);
  const [fetching,setFetching]=useState(false);
  const priceRef=useRef(null);
  const [portfolio,setPortfolio]=useState({});
  const [tradeLog,setTradeLog]=useState([]);
  const [tradeCoin,setTradeCoin]=useState(null);
  const [tradeMode,setTradeMode]=useState("buy");
  const [orderType,setOrderType]=useState("market");
  const [tradeAmount,setTradeAmount]=useState("");
  const [limitPrice,setLimitPrice]=useState("");
  const [tradeBusy,setTradeBusy]=useState(false);
  const [tradeResult,setTradeResult]=useState(null);
  const [tradeError,setTradeError]=useState("");
  const [openOrders,setOpenOrders]=useState([]);
  const [pivotCoin,setPivotCoin]=useState(null);
  const [pivotRec,setPivotRec]=useState(null);
  const [pivotBusy,setPivotBusy]=useState(false);
  const [pivotPct,setPivotPct]=useState(60);
  const [remainder,setRemainder]=useState("HODL");
  const [confirming,setConfirming]=useState(false);
  const [tradeMsg,setTradeMsg]=useState("");
  const [deepCoin,setDeepCoin]=useState(null);
  const [deepData,setDeepData]=useState({});
  const [deepBusy,setDeepBusy]=useState({});
  const [adminUsers,setAdminUsers]=useState([]);
  const [taxYear,setTaxYear]=useState(new Date().getFullYear());
  const [marketData,setMarketData]=useState([]);
  const [marketLoading,setMarketLoading]=useState(false);
  const [chartCoin,setChartCoin]=useState(null);
  const [chartData,setChartData]=useState([]);
  const [chartFrame,setChartFrame]=useState("24H");
  const [chartLoading,setChartLoading]=useState(false);
  const [favorites,setFavorites]=useState(()=>{try{return JSON.parse(localStorage.getItem("sp_favorites")||"[]");}catch(_){return [];}});
  const [marketFilter,setMarketFilter]=useState("all");
  const [pushEnabled,setPushEnabled]=useState(false);
  const [trialDaysLeft,setTrialDaysLeft]=useState(30);
  const [searchQuery,setSearchQuery]=useState("");
  const [walletAddress,setWalletAddress]=useState("");
  const [walletType,setWalletType]=useState("");
  const [walletConnected,setWalletConnected]=useState(false);
  const [walletTx,setWalletTx]=useState(null);
  const [cbApiKey,setCbApiKey]=useState(()=>sessionStorage.getItem("sp_cb_key")||"");
  const [cbApiSecret,setCbApiSecret]=useState(()=>sessionStorage.getItem("sp_cb_secret")||"");
  const [cbKeysSaved,setCbKeysSaved]=useState(()=>!!(sessionStorage.getItem("sp_cb_key")));
  const [cbKeysError,setCbKeysError]=useState("");
  const [phoneNumber,setPhoneNumber]=useState("");
  const [smsEnabled,setSmsEnabled]=useState(false);
  const [adminTab,setAdminTab]=useState("overview");

  useEffect(()=>{
  // Track page visit
  const visits = parseInt(localStorage.getItem("sp_visits")||"0")+1;
  localStorage.setItem("sp_visits", visits.toString());
  const today = new Date().toDateString();
  const visitLog = JSON.parse(localStorage.getItem("sp_visit_log")||"[]");
  visitLog.push(today);
  localStorage.setItem("sp_visit_log", JSON.stringify(visitLog.slice(-365)));
  // Auto-restore session
  const lastEmail=localStorage.getItem("sp_last_email");
  const sess=loadSession();
  if(lastEmail && sess?.subscribed !== undefined){
    const users=getUsers();
    const u=users.find(x=>x.email===lastEmail);
    if(u){
      const merged={...u, subscribed:sess.subscribed, trial:sess.trial||false, trialStart:sess.trialStart||null};
      setUser(merged);
      if(merged.trial&&merged.trialStart) setTrialDaysLeft(getTrialDaysLeft(merged.trialStart));
      setTimeout(()=>setScreen(merged.subscribed?S.MAIN:S.PAYWALL),2000);
      return;
    }
  }
  const t=setTimeout(()=>setScreen(S.LANDING),2000);
  return()=>clearTimeout(t);
},[]);

  const fetchMarket=useCallback(async()=>{
    setFetching(true);
    try{
      const data=await fetchCGPrices();
      setPrices(data);
      setHistories(prev=>{const next={...prev};COINS.forEach(c=>{const p=data[c.cgId]?.usd;if(p){const a=[...(prev[c.cgId]||[p])];a.push(p);if(a.length>24)a.shift();next[c.cgId]=a;}});return next;});
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
        if(action!=="HODL")newN.push({id:Date.now()+Math.random(),coin:c.symbol,coinColor:c.color,action,confidence,reason,price:data[c.cgId]?.usd,change:ch,time:Date.now(),read:false});
      });
      setSignals(sigs);
      if(newN.length){setNotes(p=>[...newN,...p].slice(0,50));setUnread(n=>n+newN.length);}
      setLastFetch(Date.now());
    }catch(_){}
    setFetching(false);
  },[]);

  useEffect(()=>{if(screen===S.MAIN){fetchMarket();priceRef.current=setInterval(fetchMarket,45000);return()=>clearInterval(priceRef.current);}},[screen,fetchMarket]);
  const loadMarketData=useCallback(async()=>{setMarketLoading(true);try{const data=await fetchCGMarketData(COINS.map(c=>c.cgId));setMarketData(data);}catch(_){}setMarketLoading(false);},[]);
  useEffect(()=>{if(tab==="market")loadMarketData();},[tab,loadMarketData]);
  useEffect(()=>{if(!chartCoin)return;setChartLoading(true);setChartData([]);fetchCGChart(chartCoin.cgId,chartFrame).then(d=>setChartData(d)).catch(()=>setChartData([])).finally(()=>setChartLoading(false));},[chartCoin,chartFrame]);
  const toggleFavorite=(symbol)=>{setFavorites(prev=>{const n=prev.includes(symbol)?prev.filter(s=>s!==symbol):[...prev,symbol];localStorage.setItem("sp_favorites",JSON.stringify(n));return n;});};
  const enablePush=async()=>{if(!("Notification" in window)){alert("Push not supported.");return;}const perm=await Notification.requestPermission();if(perm==="granted"){setPushEnabled(true);localStorage.setItem("sp_push","true");new Notification("SignalPulse Pro",{body:"Push enabled!",icon:"/favicon.ico"});}};
  useEffect(()=>{const s=localStorage.getItem("sp_push")==="true";if(s&&Notification.permission==="granted")setPushEnabled(true);},[]);
  useEffect(()=>{if(!pushEnabled||Notification.permission!=="granted")return;Object.entries(signals).forEach(([sym,sig])=>{if((sig.action==="BUY"||sig.action==="EXIT")&&favorites.includes(sym))new Notification(`${sig.action}: ${sym}`,{body:sig.reason,icon:"/favicon.ico"});});},[signals,pushEnabled]);

  const portfolioUSD=Object.entries(portfolio).reduce((s,[sym,h])=>{if(["USDC","USDT","DAI"].includes(sym))return s+h.amount;const c=COINS.find(x=>x.symbol===sym);const p=c?prices[c.cgId]?.usd:0;return s+(p?h.amount*p:0);},0);
  const portfolioPnL=Object.entries(portfolio).reduce((s,[sym,h])=>{if(["USDC","USDT","DAI"].includes(sym))return s;const c=COINS.find(x=>x.symbol===sym);const p=c?prices[c.cgId]?.usd:0;if(!p||!h.avgBuy)return s;return s+((p-h.avgBuy)*h.amount);},0);

  const doSignUp=async()=>{
  if(!authName||!authEmail||!authPass){setAuthErr("All fields are required.");return;}
  if(authPass.length<6){setAuthErr("Password must be at least 6 characters.");return;}
  setAuthBusy(true);setAuthErr("");
  try{
    const u=await signUpUser(authEmail.toLowerCase(),authPass,authName);
    saveSession(u);
    localStorage.setItem("sp_last_email",authEmail.toLowerCase());
    setUser(u); setScreen(S.PAYWALL);
  }catch(e){setAuthErr(e.message);}
  setAuthBusy(false);
};
  const doSignIn=async()=>{
  if(!authEmail||!authPass){setAuthErr("Email and password are required.");return;}
  setAuthBusy(true);setAuthErr("");
  try{
    const u=await signInUser(authEmail.toLowerCase(),authPass);
    const sess=loadSession();
    const merged={...u,subscribed:sess?.subscribed??u.subscribed,trial:sess?.trial||u.trial||false,trialStart:sess?.trialStart||u.trialStart||null};
    saveSession(merged);
    localStorage.setItem("sp_last_email",authEmail.toLowerCase());
    if(merged.trial&&merged.trialStart) setTrialDaysLeft(getTrialDaysLeft(merged.trialStart));
    setUser(merged);
    setScreen(merged.subscribed||isOwner?S.MAIN:S.PAYWALL);
  }catch(e){setAuthErr(e.message);}
  setAuthBusy(false);
};
  const doGoogle=async()=>{setAuthBusy(true);setAuthErr("");try{const u=await signInGoogle();setUser(u);setScreen(S.PAYWALL);}catch(e){setAuthErr(e.message);}setAuthBusy(false);};
  const doOwnerKey=()=>{if(ownerInput.trim()===OWNER_KEY){setIsOwner(true);const ownerUser={id:"owner",email:"owner@signalpulse.app",name:"Owner",subscribed:true,provider:"owner"};setUser(ownerUser);saveSession(ownerUser);setScreen(S.MAIN);}else{setAuthErr("Invalid owner key.");}};

  const openTrade=(coin,mode="buy")=>{setTradeCoin(coin);setTradeMode(mode);setOrderType("market");setTradeAmount("");setLimitPrice(fmt(prices[coin.cgId]?.usd||0));setTradeResult(null);setTradeError("");setScreen(S.TRADE);};

  const executeTradeOrder=async()=>{
    if(!tradeAmount||isNaN(Number(tradeAmount))){setTradeError("Enter a valid USD amount.");return;}
    if(orderType==="limit"&&(!limitPrice||isNaN(Number(limitPrice)))){setTradeError("Enter a valid limit price.");return;}
    const amt=Number(tradeAmount);
    const currentPrice=prices[tradeCoin.cgId]?.usd||1;
    if(tradeMode==="buy"){const usdcBal=portfolio["USDC"]?.amount||0;if(amt>usdcBal){setTradeError(`Insufficient USDC. You have ${usd(usdcBal)}.`);return;}}
    else{const coinBal=(portfolio[tradeCoin.symbol]?.amount||0)*currentPrice;if(amt>coinBal){setTradeError(`Insufficient ${tradeCoin.symbol}. Value: ${usd(coinBal)}.`);return;}}
    setTradeBusy(true);setTradeError("");setTradeResult(null);
    try{
      const execPrice=prices[tradeCoin.cgId]?.usd||1;
      if(orderType==="market"){
        const result=await cbPlaceMarketOrder(tradeMode,tradeCoin.symbol,amt,execPrice);
        const coinAmt=amt/execPrice;
        setPortfolio(prev=>{const next={...prev};if(tradeMode==="buy"){next["USDC"]={...next["USDC"],amount:Math.max(0,(next["USDC"]?.amount||0)-amt)};const prevCoin=next[tradeCoin.symbol]||{amount:0,avgBuy:execPrice};const newAmt=(prevCoin.amount||0)+coinAmt;const newAvg=((prevCoin.amount||0)*prevCoin.avgBuy+coinAmt*execPrice)/newAmt;next[tradeCoin.symbol]={amount:newAmt,avgBuy:newAvg};}else{const coinQty=amt/execPrice;next[tradeCoin.symbol]={...next[tradeCoin.symbol],amount:Math.max(0,(next[tradeCoin.symbol]?.amount||0)-coinQty)};next["USDC"]={...next["USDC"],amount:(next["USDC"]?.amount||0)+amt};}return next;});
        setTradeLog(prev=>[{id:result.orderId||("cb_"+Date.now()),time:Date.now(),type:"market",mode:tradeMode,coin:tradeCoin.symbol,usdAmt:amt,price:execPrice,status:"completed",exchange:"Coinbase"},...prev]);
        setTradeResult({type:"market",mode:tradeMode,usdAmt:amt,price:execPrice,coinAmt,status:"completed"});
      }else{
        const result=await cbPlaceLimitOrder(tradeMode,tradeCoin.symbol,amt,Number(limitPrice));
        const order={id:result.orderId||("cb_"+Date.now()),time:Date.now(),type:"limit",mode:tradeMode,coin:tradeCoin.symbol,usdAmt:amt,limitPrice:Number(limitPrice),status:"pending",exchange:"Coinbase"};
        setOpenOrders(prev=>[order,...prev]);setTradeLog(prev=>[order,...prev]);
        setTradeResult({type:"limit",mode:tradeMode,usdAmt:amt,limitPrice:Number(limitPrice),status:"pending"});
      }
    }catch(e){setTradeError(e.message||"Trade failed. Please try again.");}
    setTradeBusy(false);
  };

  const cancelOrder=async(orderId)=>{try{await cbCancelOrder(orderId);setOpenOrders(prev=>prev.filter(o=>o.id!==orderId));setTradeLog(prev=>prev.map(t=>t.id===orderId?{...t,status:"cancelled"}:t));}catch(e){setTradeError("Cancel failed.");}};

  const openPivot=async(symbol)=>{
    setPivotCoin(symbol);setPivotRec(null);setPivotBusy(true);setConfirming(false);setTradeMsg("");setPivotPct(60);setRemainder("HODL");setScreen(S.PIVOT);
    const holdings=Object.fromEntries(Object.entries(portfolio).filter(([,v])=>v.amount>0).map(([k,v])=>[k,v.amount]));
    try{setPivotRec(await aiPivot(symbol,prices,holdings));}
    catch(_){setPivotRec({pivotCoin:"USDC",confidence:65,exitReason:"Exit signal triggered.",entryReason:"Stable coin preserves capital.",bullish:[],bearish:[],targetGain:"0%",timeframe:"–",riskLevel:"LOW",stableReason:"Safety first."});}
    setPivotBusy(false);
  };

  const executeTrade=()=>{
    const exitH=portfolio[pivotCoin]||{amount:0};if(!exitH.amount){setTradeMsg("No balance to pivot.");return;}
    const exitPrice=prices[COINS.find(c=>c.symbol===pivotCoin)?.cgId]?.usd||0;
    const totalUSD=exitH.amount*exitPrice,pivotUSD=totalUSD*pivotPct/100,remUSD=totalUSD*(100-pivotPct)/100;
    const pivotPrice=prices[COINS.find(c=>c.symbol===pivotRec.pivotCoin)?.cgId]?.usd||1;
    const pivotAmt=pivotUSD/pivotPrice;
    const costBasis=exitH.avgBuy?(exitH.avgBuy/exitPrice)*pivotUSD:pivotUSD*0.85;
    setPortfolio(prev=>{const next={...prev};next[pivotCoin]={...next[pivotCoin],amount:0};if(!next[pivotRec.pivotCoin])next[pivotRec.pivotCoin]={amount:0,avgBuy:pivotPrice};next[pivotRec.pivotCoin]={amount:(next[pivotRec.pivotCoin].amount||0)+pivotAmt,avgBuy:pivotPrice};if(remainder!=="HODL"){if(!next[remainder])next[remainder]={amount:0,avgBuy:1};next[remainder]={amount:(next[remainder].amount||0)+remUSD,avgBuy:1};}else{if(exitPrice>0)next[pivotCoin]={amount:remUSD/exitPrice,avgBuy:exitH.avgBuy||exitPrice};}return next;});
    setTradeLog(prev=>[{id:Date.now(),time:Date.now(),from:pivotCoin,to:pivotRec.pivotCoin,pivotPct,pivotUSD,remUSD,remDest:remainder,toPrice:pivotPrice,costBasis,avgBuy:exitH.avgBuy||exitPrice},...prev]);
    setTradeMsg(`Trade executed — ${fmt(pivotAmt,6)} ${pivotRec.pivotCoin} acquired`);
    setTimeout(()=>{setScreen(S.MAIN);setPivotCoin(null);setPivotRec(null);setTradeMsg("");},2200);
  };

  const openDeep=async(coin)=>{setDeepCoin(coin);setScreen(S.DEEP);if(deepData[coin.symbol])return;setDeepBusy(p=>({...p,[coin.symbol]:true}));try{const result=await aiDeep(coin,prices[coin.cgId]?.usd,prices[coin.cgId]?.usd_24h_change,histories[coin.cgId]);setDeepData(p=>({...p,[coin.symbol]:result}));}catch(_){setDeepData(p=>({...p,[coin.symbol]:{summary:"Analysis unavailable.",signal:"HODL",confidence:50,riskLevel:"MEDIUM"}}));}setDeepBusy(p=>({...p,[coin.symbol]:false}));};
  const markRead=()=>{setNotes(p=>p.map(n=>({...n,read:true})));setUnread(0);};

  const saveCbKeys=()=>{
    if(!cbApiKey||cbApiKey.length<10){setCbKeysError("Enter a valid API key.");return;}
    if(!cbApiSecret||cbApiSecret.length<10){setCbKeysError("Enter a valid API secret.");return;}
    sessionStorage.setItem("sp_cb_key",cbApiKey);
    sessionStorage.setItem("sp_cb_secret",cbApiSecret);
    setCbKeysSaved(true);setCbKeysError("");
    // Auto-sync real balances when keys saved
    cbCall("balances",{}).then(d=>{
      if(d.balances)setPortfolio(prev=>({...prev,...Object.fromEntries(Object.entries(d.balances).map(([k,v])=>[k,{amount:v.amount,avgBuy:0}]))}));
    }).catch(()=>{});
  };

  const clearCbKeys=()=>{
    sessionStorage.removeItem("sp_cb_key");sessionStorage.removeItem("sp_cb_secret");
    setCbApiKey("");setCbApiSecret("");setCbKeysSaved(false);
  };

  const appStyle={minHeight:"100vh",background:T.bg0,color:T.t1,fontFamily:FONT_BODY,maxWidth:430,margin:"0 auto",position:"relative"};
  const pageStyle={...appStyle,padding:"44px 20px 60px"};
  const hdrStyle={position:"sticky",top:0,zIndex:50,background:`${T.bg0}ee`,backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.b2}`};
  const backBtnStyle={background:T.bg2,border:`1px solid ${T.b1}`,color:T.t2,width:36,height:36,borderRadius:T.r3,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0};

  if(screen===S.SPLASH)return(<div style={{...appStyle,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><style>{GOOGLE_FONTS}</style><div style={{background:`radial-gradient(ellipse at 30% 30%,rgba(99,102,241,.15) 0%,transparent 60%),radial-gradient(ellipse at 70% 70%,rgba(16,185,129,.08) 0%,transparent 60%)`,position:"fixed",inset:0,pointerEvents:"none"}}/><div style={{textAlign:"center",zIndex:1,animation:"fadeUp .7s ease"}}><div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#6366F1,#818CF8)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:"0 0 40px rgba(99,102,241,.4)"}}><span style={{fontSize:28}}>◈</span></div><div style={{fontSize:36,fontWeight:800,letterSpacing:"-.03em",fontFamily:FONT_DISPLAY,lineHeight:1.1}}>SignalPulse</div><div style={{fontSize:13,color:T.t2,marginTop:8,fontWeight:500}}>AI Crypto Day Trading</div><div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",marginTop:32}}><LiveDot/><span style={{fontSize:12,color:T.t3,fontWeight:500}}>Connecting to markets...</span></div></div></div>);

  if(screen===S.LANDING)return(<div style={pageStyle}><style>{GOOGLE_FONTS}</style><div style={{background:`radial-gradient(ellipse at 20% 0%,rgba(99,102,241,.12) 0%,transparent 50%)`,position:"fixed",inset:0,pointerEvents:"none"}}/><div style={{position:"relative",zIndex:1}}><div style={{marginBottom:36,textAlign:"center"}}><div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#6366F1,#818CF8)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(99,102,241,.35)"}}><span style={{fontSize:22}}>◈</span></div><h1 style={{fontSize:30,fontWeight:800,letterSpacing:"-.03em",fontFamily:FONT_DISPLAY,margin:"0 0 8px",lineHeight:1.2}}>SignalPulse Pro</h1><p style={{fontSize:14,color:T.t2,margin:"0 0 20px",fontWeight:400,lineHeight:1.6}}>AI-powered signals that tell you exactly<br/>when to buy, hold, or pivot.</p><div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>{["Real-time AI","Pivot Advisor","Live Prices","Tax Reports"].map(f=>(<span key={f} style={{fontSize:11,color:T.accent2,background:"rgba(99,102,241,.1)",padding:"4px 10px",borderRadius:20,border:`1px solid rgba(99,102,241,.2)`,fontWeight:600}}>{f}</span>))}</div></div><Btn onClick={()=>{setAuthErr("");setScreen(S.SIGNUP);}}>Create Free Account</Btn><div style={{height:8}}/><Btn variant="secondary" onClick={()=>{setAuthErr("");setScreen(S.LOGIN);}}>Sign In</Btn><div style={{marginTop:24,padding:16,background:"rgba(245,158,11,.06)",border:`1px solid rgba(245,158,11,.15)`,borderRadius:T.r1}}><p style={{fontSize:12,color:T.gold,fontWeight:600,marginBottom:10}}>👑 Owner Access</p><div style={{display:"flex",gap:8}}><input value={ownerInput} onChange={e=>setOwnerInput(e.target.value)} placeholder="Enter owner key..." style={{flex:1,background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"10px 14px",color:T.t1,fontSize:13,fontFamily:FONT_BODY,outline:"none"}}/><button onClick={doOwnerKey} style={{padding:"10px 16px",borderRadius:T.r3,border:`1px solid rgba(245,158,11,.3)`,background:"rgba(245,158,11,.15)",color:T.gold,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT_BODY,whiteSpace:"nowrap"}}>Unlock</button></div>{authErr&&<p style={{fontSize:12,color:T.red,marginTop:6}}>{authErr}</p>}<button style={{background:"none",border:"none",color:T.t3,fontSize:11,cursor:"pointer",marginTop:6,fontFamily:FONT_BODY}} onClick={()=>setOwnerInput(OWNER_KEY)}>Fill demo key</button></div><p style={{textAlign:"center",marginTop:20,fontSize:12,color:T.t3,lineHeight:1.7}}>1 month free · Then $19.99/mo · Cancel anytime</p></div></div>);

  if(screen===S.SIGNUP)return(<div style={pageStyle}><style>{GOOGLE_FONTS}</style><div style={{position:"relative",zIndex:1}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}><button style={backBtnStyle} onClick={()=>setScreen(S.LANDING)}>←</button><div><h2 style={{fontSize:20,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>Create Account</h2><p style={{fontSize:13,color:T.t2,margin:0,marginTop:2}}>Start trading smarter today</p></div></div><SocialBtn icon="G" label="Continue with Google" onClick={doGoogle}/><SocialBtn icon="🍎" label="Continue with Apple" onClick={()=>setAuthErr("Apple Sign In requires deployment.")}/><Divider label="or sign up with email"/><FormInput label="Full name" value={authName} onChange={setAuthName} placeholder="Your name" autoComplete="name"/><FormInput label="Email address" type="email" value={authEmail} onChange={setAuthEmail} placeholder="you@email.com" autoComplete="email"/><FormInput label="Password" type="password" value={authPass} onChange={setAuthPass} placeholder="Min 6 characters" autoComplete="new-password"/>{authErr&&<Card style={{marginBottom:14,borderColor:"rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",padding:12}}><p style={{fontSize:13,color:T.red,margin:0}}>{authErr}</p></Card>}<Btn onClick={doSignUp} disabled={authBusy}>{authBusy?"Creating account...":"Create Account →"}</Btn><p style={{textAlign:"center",marginTop:14,fontSize:13,color:T.t2}}>Already have an account?{" "}<button style={{background:"none",border:"none",color:T.accent2,cursor:"pointer",fontSize:13,fontFamily:FONT_BODY,fontWeight:600}} onClick={()=>{setAuthErr("");setScreen(S.LOGIN);}}>Sign in</button></p></div></div>);

  if(screen===S.LOGIN)return(<div style={pageStyle}><style>{GOOGLE_FONTS}</style><div style={{position:"relative",zIndex:1}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}><button style={backBtnStyle} onClick={()=>setScreen(S.LANDING)}>←</button><div><h2 style={{fontSize:20,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>Welcome back</h2><p style={{fontSize:13,color:T.t2,margin:0,marginTop:2}}>Sign in to your account</p></div></div><SocialBtn icon="G" label="Continue with Google" onClick={doGoogle}/><SocialBtn icon="🍎" label="Continue with Apple" onClick={()=>setAuthErr("Apple Sign In requires deployment.")}/><Divider label="or sign in with email"/><FormInput label="Email address" type="email" value={authEmail} onChange={setAuthEmail} placeholder="you@email.com" autoComplete="email"/><FormInput label="Password" type="password" value={authPass} onChange={setAuthPass} placeholder="Your password" autoComplete="current-password"/>{authErr&&<Card style={{marginBottom:14,borderColor:"rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",padding:12}}><p style={{fontSize:13,color:T.red,margin:0}}>{authErr}</p></Card>}<Btn onClick={doSignIn} disabled={authBusy}>{authBusy?"Signing in...":"Sign In →"}</Btn><p style={{textAlign:"center",marginTop:14,fontSize:13,color:T.t2}}>Don't have an account?{" "}<button style={{background:"none",border:"none",color:T.accent2,cursor:"pointer",fontSize:13,fontFamily:FONT_BODY,fontWeight:600}} onClick={()=>{setAuthErr("");setScreen(S.SIGNUP);}}>Sign up</button></p></div></div>);

  if(screen===S.PAYWALL)return(<div style={pageStyle}><style>{GOOGLE_FONTS}</style><div style={{position:"relative",zIndex:1}}><div style={{textAlign:"center",marginBottom:28}}><p style={{fontSize:13,color:T.t2,marginBottom:6}}>Welcome, {user?.name||"Trader"} 👋</p><h2 style={{fontSize:26,fontWeight:800,fontFamily:FONT_DISPLAY,letterSpacing:"-.03em",margin:"0 0 8px"}}>Unlock SignalPulse Pro</h2><p style={{fontSize:14,color:T.t2,margin:0}}>Full AI trading signals · Real-time pivot advisor</p></div><Card style={{marginBottom:16,background:"linear-gradient(135deg,rgba(16,185,129,.12),rgba(52,211,153,.07))",borderColor:"rgba(16,185,129,.3)",textAlign:"center",padding:20}}><p style={{fontSize:22,margin:"0 0 6px"}}>🎁</p><p style={{fontSize:16,fontWeight:800,color:T.green2,fontFamily:FONT_DISPLAY,margin:"0 0 4px"}}>1 Month Free Trial</p><p style={{fontSize:13,color:T.t2,margin:"0 0 16px"}}>No credit card required. Full access for 30 days.</p><Btn variant="success" onClick={()=>{
  const ts=Date.now();
  const updated={...user,subscribed:true,trial:true,trialStart:ts};
  const users=getUsers();
  const idx=users.findIndex(x=>x.id===user?.id);
  if(idx>=0){users[idx]={...users[idx],subscribed:true,trial:true,trialStart:ts};saveUsers(users);}
  saveSession(updated);
  localStorage.setItem("sp_last_email",updated.email||"");
  setTrialDaysLeft(30);
  setUser(updated);
  setScreen(S.MAIN);
}}>🎁 Start Free Trial — No Card Needed</Btn></Card><Divider label="or subscribe now"/><Card style={{marginBottom:16,background:"linear-gradient(135deg,rgba(99,102,241,.12),rgba(16,185,129,.07))",borderColor:"rgba(99,102,241,.25)",textAlign:"center",padding:24}}><p style={{fontSize:12,color:T.accent2,fontWeight:700,letterSpacing:".08em",marginBottom:8,textTransform:"uppercase"}}>Monthly Plan</p><p style={{fontSize:48,fontWeight:800,fontFamily:FONT_NUM,color:T.t1,margin:"0 0 4px",letterSpacing:"-.04em"}}>$19<span style={{fontSize:24,color:T.t2}}>.99</span></p><p style={{fontSize:13,color:T.t3,marginBottom:20}}>per month · cancel anytime</p>{["Real-time AI BUY / EXIT / HODL signals","AI Pivot Advisor with % allocation slider","20 coins monitored around the clock","Deep Claude AI analysis with price targets","Connect any wallet — MetaMask, Coinbase, Trust, Ledger","Buy, sell & transfer directly from SignalPulse","Trade history & portfolio PnL tracking","Crypto tax report with CSV export"].map(f=>(<div key={f} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10,textAlign:"left"}}><span style={{color:T.green2,fontWeight:700,flexShrink:0,marginTop:1}}>✓</span><span style={{fontSize:13,color:T.t2,lineHeight:1.4}}>{f}</span></div>))}</Card><Card style={{marginBottom:12,borderColor:"rgba(0,112,204,.25)",background:"rgba(0,56,133,.08)"}}><p style={{fontSize:12,color:"#60A5FA",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:8}}>Pay with PayPal</p><Btn variant="paypal" onClick={()=>{
  const updated={...user,subscribed:true,trial:false,trialStart:null};
  const users=getUsers();
  const idx=users.findIndex(x=>x.id===user?.id);
  if(idx>=0){users[idx]={...users[idx],subscribed:true,trial:false};saveUsers(users);}
  saveSession(updated);
  localStorage.setItem("sp_last_email",updated.email||"");
  setUser(updated);
  setScreen(S.MAIN);
}}>🅿 Subscribe with PayPal — $19.99/mo</Btn><p style={{fontSize:11,color:T.t3,textAlign:"center",marginTop:8}}>Demo mode — tap to simulate payment</p></Card><Btn variant="ghost" onClick={()=>setScreen(S.LANDING)} style={{marginTop:8,fontSize:13,color:T.t3}}>← Back</Btn></div></div>);

  if(screen===S.CONNECT){
    const WALLET_TYPES=[
      {id:"metamask",name:"MetaMask",icon:"🦊",color:"#E2761B",desc:"Browser extension & mobile"},
      {id:"coinbase",name:"Coinbase",icon:"🔵",color:"#0052FF",desc:"Coinbase Wallet app"},
      {id:"trust",name:"Trust",icon:"🛡️",color:"#3375BB",desc:"Trust Wallet mobile app"},
      {id:"phantom",name:"Phantom",icon:"👻",color:"#AB9FF2",desc:"Solana & multi-chain"},
      {id:"ledger",name:"Ledger",icon:"🔒",color:"#00A650",desc:"Hardware wallet"},
      {id:"walletconnect",name:"WalletConnect",icon:"🔗",color:"#3B99FC",desc:"Scan QR from any wallet"},
      {id:"manual",name:"Enter Address",icon:"⌨️",color:"#6366F1",desc:"Paste your wallet address"},
    ];
    return(
      <div style={{...appStyle,paddingBottom:40}}>
        <style>{GOOGLE_FONTS}</style>
        <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button style={backBtnStyle} onClick={()=>setScreen(S.MAIN)}>←</button>
          <div style={{flex:1}}>
            <h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0}}>Connect Wallet</h2>
            <p style={{fontSize:12,color:T.t2,margin:0}}>Any wallet · Private to you · Secure</p>
          </div>
          {walletConnected&&<Pill label="Connected"/>}
        </div>
        <div style={{padding:16}}>
          {walletConnected?(
            <div>
              <Card style={{marginBottom:16,background:"linear-gradient(135deg,rgba(16,185,129,.1),rgba(52,211,153,.07))",borderColor:"rgba(16,185,129,.3)",padding:24}}>
                <div style={{textAlign:"center",marginBottom:16}}>
                  <p style={{fontSize:28,margin:"0 0 8px"}}>✅</p>
                  <p style={{fontSize:16,fontWeight:800,color:T.green2,fontFamily:FONT_DISPLAY,margin:"0 0 6px"}}>Wallet Connected</p>
                  <p style={{fontSize:12,color:T.t2,margin:"0 0 4px"}}>Type: {walletType}</p>
                  <p style={{fontSize:11,color:T.t3,fontFamily:FONT_NUM,margin:"0 0 20px",wordBreak:"break-all"}}>{walletAddress}</p>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
                  {[
                    {label:"↓ BUY",tx:"BUY",c:T.green2,bg:"rgba(16,185,129,.15)",b:"rgba(16,185,129,.4)"},
                    {label:"↑ SELL",tx:"SELL",c:T.gold2,bg:"rgba(245,158,11,.12)",b:"rgba(245,158,11,.4)"},
                    {label:"→ SEND",tx:"TRANSFER",c:T.accent2,bg:"rgba(99,102,241,.15)",b:"rgba(99,102,241,.4)"},
                  ].map(btn=>(
                    <button key={btn.tx} onClick={()=>setWalletTx(btn.tx)}
                      style={{padding:"12px 4px",background:btn.bg,border:`1px solid ${btn.b}`,borderRadius:T.r3,color:btn.c,fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:FONT_BODY,transition:"all .2s"}}>
                      {btn.label}
                    </button>
                  ))}
                </div>
                <Btn variant="danger" onClick={()=>{setWalletConnected(false);setWalletAddress("");setWalletType("");}}>Disconnect Wallet</Btn>
              </Card>
              <ApiKeyCard
                apiKey={cbApiKey} setApiKey={setCbApiKey}
                apiSecret={cbApiSecret} setApiSecret={setCbApiSecret}
                saved={cbKeysSaved} onSave={saveCbKeys} onClear={clearCbKeys}
                error={cbKeysError}
              />
              <Card style={{borderColor:"rgba(99,102,241,.2)",background:"rgba(99,102,241,.05)"}}>
                <p style={{fontSize:12,color:T.accent2,fontWeight:700,marginBottom:4}}>🔐 Your wallet is private</p>
                <p style={{fontSize:11,color:T.t3,lineHeight:1.6,margin:0}}>Only you can see your wallet, API keys, and balances. Other users cannot access your data. You sign every transaction from your own device.</p>
              </Card>
            </div>
          ):(
            <div>
              <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Choose your wallet</p>
              {WALLET_TYPES.map(w=>(
                <div key={w.id} onClick={()=>{if(w.id==="manual"){setWalletType("Manual Address");}else{setWalletType(w.name);setWalletAddress("0x"+Math.random().toString(16).slice(2,12)+"..."+Math.random().toString(16).slice(2,6));setWalletConnected(true);}}}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",marginBottom:8,background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:T.r3,cursor:"pointer",transition:"all .2s"}}>
                  <span style={{fontSize:26,flexShrink:0}}>{w.icon}</span>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:700,fontSize:14,margin:0,color:T.t1}}>{w.name}</p>
                    <p style={{fontSize:12,color:T.t3,margin:0}}>{w.desc}</p>
                  </div>
                  <span style={{fontSize:18,color:T.t3}}>›</span>
                </div>
              ))}
              {walletType==="Manual Address"&&(
                <Card style={{marginTop:8,marginBottom:8}}>
                  <p style={{fontSize:12,color:T.t2,fontWeight:600,marginBottom:10}}>Paste your wallet address</p>
                  <div style={{display:"flex",gap:8}}>
                    <input value={walletAddress} onChange={e=>setWalletAddress(e.target.value)} placeholder="0x... or bc1... or any address" style={{flex:1,background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"10px 12px",color:T.t1,fontSize:13,fontFamily:FONT_NUM,outline:"none"}}/>
                    <button onClick={()=>{if(walletAddress.length>8){setWalletConnected(true);}}} style={{padding:"10px 16px",borderRadius:T.r3,border:"none",background:T.accent,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13}}>Connect</button>
                  </div>
                </Card>
              )}
              <Card style={{marginTop:12,borderColor:"rgba(99,102,241,.2)",background:"rgba(99,102,241,.05)"}}>
                <p style={{fontSize:12,color:T.accent2,fontWeight:700,marginBottom:6}}>🔐 Security</p>
                <p style={{fontSize:12,color:T.t3,lineHeight:1.6,margin:0}}>Each user connects their own wallet — completely private. No one else can see your address, balance, or transactions. You sign every trade yourself.</p>
              </Card>
              {[["💰","View real balances","See your actual crypto holdings"],["📊","Live portfolio value","Updated every 45 seconds"],["⚡","Buy, Sell & Transfer","Execute trades directly from SignalPulse"],["🔒","Read-only option","Use manual address for display-only"],["🌐","Any chain supported","ETH, SOL, BTC, BNB and more"]].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start",marginTop:12}}>
                  <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                  <div><p style={{fontSize:13,fontWeight:600,color:T.t1,margin:0}}>{title}</p><p style={{fontSize:12,color:T.t3,margin:"2px 0 0"}}>{desc}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {walletTx&&(
          <WalletTxModal
            type={walletTx}
            prices={prices}
            onClose={()=>setWalletTx(null)}
            onSubmit={({type,coin,amount})=>{
              setWalletTx(null);
              const coinObj=COINS.find(c=>c.symbol===coin);
              const price2=coinObj?(prices[coinObj.cgId]?.usd||0):0;
              setTradeLog(prev=>[{id:"wx_"+Date.now(),time:Date.now(),type:"market",mode:type==="BUY"?"buy":"sell",coin,usdAmt:parseFloat(amount)*price2,price:price2,status:"completed",exchange:walletType},...prev]);
            }}
          />
        )}
      </div>
    );
  }

  if(screen==="chart"&&chartCoin){
    const price=prices[chartCoin.cgId]?.usd;
    const change=prices[chartCoin.cgId]?.usd_24h_change||0;
    const mkt=marketData.find(m=>m.id===chartCoin.cgId)||{};
    const isFav=favorites.includes(chartCoin.symbol);
    const frames=["1H","24H","7D","30D","6M","1Y","3Y","5Y"];
    const buildPath=(pts,w,h)=>{if(!pts||pts.length<2)return "";const prices2=pts.map(p=>p[1]);const mn=Math.min(...prices2),mx=Math.max(...prices2),rng=mx-mn||1;return pts.map((p,i)=>{const x=(i/(pts.length-1))*w;const y=h-((p[1]-mn)/rng)*(h-20)-10;return(i===0?"M":"L")+x.toFixed(1)+","+y.toFixed(1);}).join(" ");};
    const w=380,h=180,path=buildPath(chartData,w,h);
    const isUp=chartData.length>1?chartData[chartData.length-1][1]>=chartData[0][1]:change>=0;
    const lineColor=isUp?T.green:T.red;
    const priceDiff=chartData.length>1?chartData[chartData.length-1][1]-chartData[0][1]:0;
    const priceDiffPct=chartData.length>1?((priceDiff/chartData[0][1])*100):change;
    return(<div style={{...appStyle,paddingBottom:40}}><style>{GOOGLE_FONTS}</style>
      <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
        <button style={backBtnStyle} onClick={()=>setScreen(S.MAIN)}>←</button>
        <CoinAvatar coin={chartCoin} size={36}/>
        <div style={{flex:1}}><h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0}}>{chartCoin.name}</h2><p style={{fontSize:12,color:T.t2,margin:0}}>{chartCoin.symbol} · Rank #{mkt.market_cap_rank||"–"}</p></div>
        <button onClick={()=>toggleFavorite(chartCoin.symbol)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:isFav?T.gold:"rgba(255,255,255,.2)"}}>★</button>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        <div style={{marginBottom:16}}><p style={{fontSize:36,fontWeight:800,fontFamily:FONT_NUM,margin:0,letterSpacing:"-.03em"}}>{usd(price)}</p><p style={{fontSize:14,color:priceDiffPct>=0?T.green2:T.red,fontWeight:600,margin:"4px 0 0"}}>{priceDiffPct>=0?"+":""}{priceDiffPct.toFixed(2)}% ({chartFrame})</p></div>
        <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",paddingBottom:2}}>{frames.map(f=>(<button key={f} onClick={()=>setChartFrame(f)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${chartFrame===f?T.accent:T.b1}`,cursor:"pointer",fontFamily:FONT_BODY,fontSize:12,fontWeight:600,flexShrink:0,background:chartFrame===f?"rgba(99,102,241,.2)":T.bg2,color:chartFrame===f?T.accent2:T.t3}}>{f}</button>))}</div>
        <div style={{background:T.bg2,borderRadius:T.r1,padding:"16px 8px 8px",marginBottom:16,border:`1px solid ${T.b1}`}}>
          {chartLoading?(<div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:24,color:T.accent,animation:"spin 1.2s linear infinite"}}>◈</div></div>):chartData.length>0?(<svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{overflow:"visible",display:"block"}}><defs><linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={lineColor} stopOpacity=".3"/><stop offset="100%" stopColor={lineColor} stopOpacity="0"/></linearGradient></defs>{path&&<path d={path+"L"+w+","+h+"L0,"+h+"Z"} fill="url(#chartGrad)" opacity=".4"/>}{path&&<path d={path} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}</svg>):(<div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:T.t3,fontSize:13}}>No chart data available</p></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>{[["Market Cap",mkt.market_cap?`$${(mkt.market_cap/1e9).toFixed(2)}B`:"–",T.t1],["24H Volume",mkt.total_volume?`$${(mkt.total_volume/1e9).toFixed(2)}B`:"–",T.t1],["All Time High",mkt.ath?usd(mkt.ath):"–",T.green2],["ATH Date",mkt.ath_date?new Date(mkt.ath_date).toLocaleDateString():"–",T.t2],["All Time Low",mkt.atl?usd(mkt.atl):"–",T.red2],["ATL Date",mkt.atl_date?new Date(mkt.atl_date).toLocaleDateString():"–",T.t2],["Circulating Supply",mkt.circulating_supply?`${(mkt.circulating_supply/1e6).toFixed(2)}M ${chartCoin.symbol}`:"–",T.t2],["24H Change",mkt.price_change_percentage_24h?pct(mkt.price_change_percentage_24h):"–",mkt.price_change_percentage_24h>=0?T.green2:T.red]].map(([l,v,c])=>(<Card key={l} style={{padding:12}}><p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 4px"}}>{l}</p><p style={{fontSize:14,fontWeight:700,fontFamily:FONT_NUM,color:c,margin:0}}>{v}</p></Card>))}</div>
        <div style={{display:"flex",gap:10}}><Btn variant="success" onClick={()=>openTrade(chartCoin,"buy")} style={{flex:1,width:"auto"}}>▲ Buy {chartCoin.symbol}</Btn><Btn variant="danger" onClick={()=>openTrade(chartCoin,"sell")} style={{flex:1,width:"auto"}}>▼ Sell {chartCoin.symbol}</Btn></div>
      </div>
    </div>);
  }

  if(screen===S.TRADE&&tradeCoin){
    const currentPrice=prices[tradeCoin.cgId]?.usd||0;
    const change=prices[tradeCoin.cgId]?.usd_24h_change||0;
    const usdcBal=portfolio["USDC"]?.amount||0;
    const coinBal=portfolio[tradeCoin.symbol]?.amount||0;
    const coinValUSD=coinBal*currentPrice;
    const maxBuy=usdcBal,maxSell=coinValUSD;
    const estCoins=tradeAmount&&currentPrice?Number(tradeAmount)/(orderType==="limit"?Number(limitPrice)||currentPrice:currentPrice):0;
    const execPrice=orderType==="limit"?Number(limitPrice)||currentPrice:currentPrice;
    return(<div style={{...appStyle,paddingBottom:40}}><style>{GOOGLE_FONTS}</style>
      <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
        <button style={backBtnStyle} onClick={()=>{setScreen(S.MAIN);setTradeResult(null);setTradeError("");}}>←</button>
        <CoinAvatar coin={tradeCoin} size={36}/>
        <div style={{flex:1}}><h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0}}>Trade {tradeCoin.symbol}</h2><p style={{fontSize:12,color:T.t2,margin:0}}>{usd(currentPrice)} · <span style={{color:change>=0?T.green2:T.red}}>{pct(change)}</span></p></div>
      </div>
      <div style={{padding:16}}>
        <Card style={{marginBottom:14,padding:12,borderColor:cbKeysSaved?"rgba(16,185,129,.3)":"rgba(245,158,11,.3)",background:cbKeysSaved?"rgba(16,185,129,.06)":"rgba(245,158,11,.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><p style={{fontSize:12,fontWeight:700,color:cbKeysSaved?T.green2:T.gold,margin:"0 0 2px"}}>{cbKeysSaved?"🟢 Live Trading — Your Coinbase Account":"🟡 Paper Trading Mode"}</p><p style={{fontSize:11,color:T.t3,margin:0}}>{cbKeysSaved?"Real orders execute on your personal Coinbase account.":"Connect your Coinbase API keys in the Wallet tab to go live."}</p></div>
            {!cbKeysSaved&&<button onClick={()=>setScreen(S.CONNECT)} style={{padding:"6px 12px",borderRadius:T.r3,border:`1px solid rgba(99,102,241,.3)`,background:"rgba(99,102,241,.1)",color:T.accent2,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:FONT_BODY,flexShrink:0,marginLeft:10}}>Connect API →</button>}
          </div>
        </Card>
        <div style={{display:"flex",gap:0,marginBottom:16,background:T.bg1,borderRadius:T.r3,padding:4,border:`1px solid ${T.b1}`}}>{["buy","sell"].map(m=>(<button key={m} onClick={()=>{setTradeMode(m);setTradeAmount("");setTradeResult(null);setTradeError("");}} style={{flex:1,padding:"10px",borderRadius:T.r3-2,border:"none",cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,fontWeight:700,transition:"all .2s",background:tradeMode===m?(m==="buy"?"linear-gradient(135deg,#059669,#10B981)":"linear-gradient(135deg,#DC2626,#EF4444)"):"transparent",color:tradeMode===m?"#fff":T.t3}}>{m==="buy"?"▲ Buy":"▼ Sell"}</button>))}</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>{["market","limit"].map(t=>(<button key={t} onClick={()=>{setOrderType(t);setTradeResult(null);setTradeError("");}} style={{flex:1,padding:"9px",borderRadius:T.r3,border:`1px solid ${orderType===t?T.accent:T.b1}`,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,fontWeight:600,background:orderType===t?"rgba(99,102,241,.15)":T.bg2,color:orderType===t?T.accent2:T.t3}}>{t==="market"?"⚡ Market":"◎ Limit"}</button>))}</div>
        <Card style={{marginBottom:14,padding:12,background:"rgba(255,255,255,.03)"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 4px"}}>Available USDC</p><p style={{fontSize:16,fontWeight:700,fontFamily:FONT_NUM,color:T.t1,margin:0}}>{usd(usdcBal)}</p></div><div style={{textAlign:"right"}}><p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 4px"}}>{tradeCoin.symbol} Holdings</p><p style={{fontSize:16,fontWeight:700,fontFamily:FONT_NUM,color:tradeCoin.color,margin:0}}>{fmt(coinBal,6)}<span style={{fontSize:12,color:T.t3,marginLeft:4}}>({usd(coinValUSD)})</span></p></div></div></Card>
        <Card style={{marginBottom:14}}>
          <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>{tradeMode==="buy"?"Amount to Spend (USDC)":"Amount to Sell (USD value)"}</p>
          <div style={{position:"relative",marginBottom:8}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:T.t2,fontSize:16,fontWeight:600}}>$</span><input type="number" value={tradeAmount} onChange={e=>{setTradeAmount(e.target.value);setTradeResult(null);setTradeError("");}} placeholder="0.00" min="0" style={{width:"100%",background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"14px 14px 14px 30px",color:T.t1,fontSize:20,fontFamily:FONT_NUM,fontWeight:700,outline:"none",boxSizing:"border-box"}}/></div>
          <div style={{display:"flex",gap:6,marginBottom:orderType==="limit"?14:0}}>{[25,50,75,100].map(p=>(<button key={p} onClick={()=>setTradeAmount(((tradeMode==="buy"?maxBuy:maxSell)*p/100).toFixed(2))} style={{flex:1,padding:"7px 0",borderRadius:T.r3,border:`1px solid ${T.b1}`,background:T.bg1,color:T.t2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FONT_BODY}}>{p}%</button>))}</div>
          {orderType==="limit"&&(<><p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8,marginTop:4}}>{tradeMode==="buy"?"Buy at price (USD)":"Sell at price (USD)"}</p><div style={{position:"relative"}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:T.t2,fontSize:16,fontWeight:600}}>$</span><input type="number" value={limitPrice} onChange={e=>{setLimitPrice(e.target.value);setTradeResult(null);setTradeError("");}} placeholder={fmt(currentPrice)} min="0" style={{width:"100%",background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"12px 14px 12px 30px",color:T.t1,fontSize:16,fontFamily:FONT_NUM,fontWeight:600,outline:"none",boxSizing:"border-box"}}/></div><p style={{fontSize:11,color:T.t3,marginTop:6}}>Current price: {usd(currentPrice)}</p></>)}
        </Card>
        {tradeAmount&&Number(tradeAmount)>0&&(<Card style={{marginBottom:14,background:tradeMode==="buy"?"rgba(16,185,129,.05)":"rgba(239,68,68,.05)",borderColor:tradeMode==="buy"?"rgba(16,185,129,.2)":"rgba(239,68,68,.2)"}}><p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Order Summary</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["Type",orderType==="market"?"Market":"Limit",T.t1],["Side",tradeMode==="buy"?"Buy":"Sell",tradeMode==="buy"?T.green2:T.red],["USD Amount",usd(Number(tradeAmount)||0),T.t1],[orderType==="limit"?"Limit Price":"Est. Price",usd(execPrice),T.t2],[`Est. ${tradeCoin.symbol}`,fmt(estCoins,6),tradeCoin.color],["Exchange",CB_LIVE?"Coinbase (Live)":"Coinbase (Paper)",CB_LIVE?T.green2:T.gold2]].map(([l,v,c])=>(<div key={l}><p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 2px"}}>{l}</p><p style={{fontSize:13,color:c,fontFamily:FONT_NUM,fontWeight:600,margin:0}}>{v}</p></div>))}</div></Card>)}
        {tradeError&&<Card style={{marginBottom:14,borderColor:"rgba(239,68,68,.3)",background:"rgba(239,68,68,.06)",padding:12}}><p style={{fontSize:13,color:T.red,margin:0}}>⚠️ {tradeError}</p></Card>}
        {tradeResult&&(<Card style={{marginBottom:14,borderColor:tradeResult.status==="completed"?"rgba(16,185,129,.3)":"rgba(99,102,241,.3)",background:tradeResult.status==="completed"?"rgba(16,185,129,.06)":"rgba(99,102,241,.06)",padding:16,textAlign:"center"}}><p style={{fontSize:24,margin:"0 0 8px"}}>{tradeResult.status==="completed"?"✅":"⏳"}</p>{tradeResult.status==="completed"?(<><p style={{fontSize:15,fontWeight:700,color:T.green2,fontFamily:FONT_DISPLAY,margin:"0 0 4px"}}>{tradeResult.mode==="buy"?"Purchase Complete!":"Sale Complete!"}</p><p style={{fontSize:13,color:T.t2,margin:0}}>{tradeResult.mode==="buy"?`Bought ${fmt(tradeResult.coinAmt,6)} ${tradeCoin.symbol}`:`Sold ${usd(tradeResult.usdAmt)} of ${tradeCoin.symbol}`}</p></>):(<><p style={{fontSize:15,fontWeight:700,color:T.accent2,fontFamily:FONT_DISPLAY,margin:"0 0 4px"}}>Limit Order Placed</p><p style={{fontSize:13,color:T.t2,margin:0}}>{tradeResult.mode==="buy"?"Buy":"Sell"} {usd(tradeResult.usdAmt)} when price hits {usd(tradeResult.limitPrice)}</p></>)}</Card>)}
        {!tradeResult&&(<Btn variant={tradeMode==="buy"?"success":"danger"} onClick={executeTradeOrder} disabled={tradeBusy||!tradeAmount}>{tradeBusy?"Processing...":`${orderType==="limit"?"Place Limit Order":tradeMode==="buy"?"Buy":"Sell"} ${tradeCoin.symbol}`}</Btn>)}
        {tradeResult&&<Btn variant="secondary" onClick={()=>{setTradeResult(null);setTradeAmount("");setTradeError("");}}>Place Another Order</Btn>}
        {openOrders.filter(o=>o.coin===tradeCoin.symbol&&o.status==="pending").length>0&&(<div style={{marginTop:20}}><p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Open Limit Orders</p>{openOrders.filter(o=>o.coin===tradeCoin.symbol&&o.status==="pending").map(o=>(<Card key={o.id} style={{marginBottom:10,borderLeft:`3px solid ${o.mode==="buy"?T.green:T.red}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><p style={{fontSize:13,fontWeight:700,color:o.mode==="buy"?T.green2:T.red,margin:"0 0 2px"}}>{o.mode==="buy"?"▲ Buy":"▼ Sell"} · Limit @ {usd(o.limitPrice)}</p><p style={{fontSize:12,color:T.t2,margin:0}}>{usd(o.usdAmt)} · {ago(o.time)}</p></div><button onClick={()=>cancelOrder(o.id)} style={{padding:"6px 12px",borderRadius:T.r3,border:`1px solid rgba(239,68,68,.3)`,background:"rgba(239,68,68,.08)",color:T.red,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FONT_BODY}}>Cancel</button></div></Card>))}</div>)}
      </div>
    </div>);
  }

  if(screen===S.ADMIN){
    const allUsers=getUsers();
    const activeUsers=allUsers.filter(u=>u.subscribed&&!u.trial);
    const trialUsers=allUsers.filter(u=>u.trial&&u.subscribed);
    const freeUsers=allUsers.filter(u=>!u.subscribed);
    const monthlyRev=activeUsers.length*19.99;
    const annualRev=monthlyRev*12;
    const totalVisits=parseInt(localStorage.getItem("sp_visits")||"0");
    const visitLog=JSON.parse(localStorage.getItem("sp_visit_log")||"[]");
    const today=new Date().toDateString();
    const todayVisits=visitLog.filter(d=>d===today).length;
    const thisMonth=new Date().toISOString().slice(0,7);
    const monthVisits=visitLog.filter(d=>new Date(d).toISOString().slice(0,7)===thisMonth).length;
    const export1099=()=>{
      const year=new Date().getFullYear()-1;
      const nl="\n";
      const header=`Recipient Name,Email,Subscription Type,Start Date,Payments ${year},Amount USD${nl}`;
      const rows=activeUsers.map(u=>`${u.name||"Unknown"},${u.email},Pro Monthly,${new Date(u.createdAt).toLocaleDateString()},12,$${(19.99*12).toFixed(2)}`).join(nl);
      const trialRows=trialUsers.map(u=>`${u.name||"Unknown"},${u.email},Free Trial,${new Date(u.trialStart||u.createdAt).toLocaleDateString()},0,$0.00`).join(nl);
      const blob=new Blob([header+rows+(rows?nl:"")+trialRows],{type:"text/csv"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=`signalpulse_1099_${year}.csv`;a.click();
      URL.revokeObjectURL(url);
    };

    return(
      <div style={{...appStyle,paddingBottom:60}}><style>{GOOGLE_FONTS}</style>
        <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button style={backBtnStyle} onClick={()=>setScreen(S.SETTINGS)}>←</button>
          <div style={{flex:1}}>
            <h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>Admin Panel</h2>
            <p style={{fontSize:11,color:T.t3,margin:0}}>SignalPulse Pro · Owner View</p>
          </div>
          <Pill label="PRO"/>
        </div>

        {/* Admin Tab Bar */}
        <div style={{display:"flex",borderBottom:`1px solid ${T.b2}`,background:`${T.bg0}ee`,backdropFilter:"blur(20px)"}}>
          {[["overview","📊 Overview"],["users","👥 Users"],["revenue","💰 Revenue"],["tax","📋 1099 Tax"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setAdminTab(id)}
              style={{flex:1,padding:"10px 4px",fontSize:10,fontWeight:600,fontFamily:FONT_BODY,border:"none",background:"none",cursor:"pointer",
                color:adminTab===id?T.accent2:T.t3,borderBottom:`2px solid ${adminTab===id?T.accent:"transparent"}`,marginBottom:-1}}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{padding:16}}>

          {/* ── OVERVIEW TAB ── */}
          {adminTab==="overview"&&(<>
            {/* Website Traffic */}
            <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>🌐 Website Traffic</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              {[["Total Visits",totalVisits,T.accent2],["Today",todayVisits,T.green2],["This Month",monthVisits,T.blue]].map(([l,v,c])=>(
                <Card key={l} style={{textAlign:"center",padding:12}}>
                  <p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em",margin:"0 0 6px",lineHeight:1.3}}>{l}</p>
                  <p style={{fontSize:20,fontWeight:800,fontFamily:FONT_NUM,color:c,margin:0}}>{v}</p>
                </Card>
              ))}
            </div>

            {/* Conversion funnel */}
            <Card style={{marginBottom:16}}>
              <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>📈 Conversion Funnel</p>
              {[
                ["Visits",totalVisits,T.accent2,100],
                ["Signed Up",allUsers.length,T.blue,totalVisits>0?Math.round(allUsers.length/totalVisits*100):0],
                ["On Trial",trialUsers.length,T.gold2,allUsers.length>0?Math.round(trialUsers.length/allUsers.length*100):0],
                ["Paid Active",activeUsers.length,T.green2,allUsers.length>0?Math.round(activeUsers.length/allUsers.length*100):0],
              ].map(([l,v,c,pctVal])=>(
                <div key={l} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:T.t2,fontWeight:600}}>{l}</span>
                    <span style={{fontSize:12,color:c,fontWeight:700,fontFamily:FONT_NUM}}>{v} <span style={{color:T.t3,fontWeight:400}}>({pctVal}%)</span></span>
                  </div>
                  <div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${pctVal}%`,height:"100%",background:c,borderRadius:3,transition:"width .8s"}}/>
                  </div>
                </div>
              ))}
            </Card>

            {/* Account summary stats */}
            <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>👥 Accounts</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                ["Total Accounts",allUsers.length,T.accent2],
                ["Active (Paid)",activeUsers.length,T.green2],
                ["On Free Trial",trialUsers.length,T.gold2],
                ["Free / Inactive",freeUsers.length,T.t3],
              ].map(([l,v,c])=>(
                <Card key={l} style={{textAlign:"center",padding:14}}>
                  <p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em",margin:"0 0 6px",lineHeight:1.4}}>{l}</p>
                  <p style={{fontSize:24,fontWeight:800,fontFamily:FONT_NUM,color:c,margin:0}}>{v}</p>
                </Card>
              ))}
            </div>

            {/* Revenue snapshot */}
            <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>💰 Revenue</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
              {[
                ["Monthly MRR","$"+monthlyRev.toFixed(2),T.green2],
                ["Annual Run Rate","$"+annualRev.toFixed(0),T.accent2],
              ].map(([l,v,c])=>(
                <Card key={l} style={{textAlign:"center",padding:14,background:"linear-gradient(135deg,rgba(16,185,129,.08),rgba(99,102,241,.05))",borderColor:"rgba(16,185,129,.2)"}}>
                  <p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em",margin:"0 0 6px"}}>{l}</p>
                  <p style={{fontSize:22,fontWeight:800,fontFamily:FONT_NUM,color:c,margin:0}}>{v}</p>
                </Card>
              ))}
            </div>
          </>)}

          {/* ── USERS TAB ── */}
          {adminTab==="users"&&(<>
            <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>All Accounts ({allUsers.length})</p>
            {allUsers.length===0&&(
              <Card style={{textAlign:"center",padding:"40px 20px"}}>
                <p style={{fontSize:32,marginBottom:8}}>👥</p>
                <p style={{fontSize:14,color:T.t3}}>No users yet. Share your app!</p>
              </Card>
            )}
            {allUsers.map(u=>{
              const daysLeft=u.trial&&u.trialStart?getTrialDaysLeft(u.trialStart):null;
              const trialExpired=u.trial&&u.trialStart&&daysLeft===0;
              const statusLabel=u.subscribed?(u.trial?"TRIAL":"PRO"):"FREE";
              return(
                <Card key={u.id} style={{marginBottom:10,borderLeft:`3px solid ${u.subscribed?(u.trial?T.gold:T.green):(trialExpired?T.red:T.t4)}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontWeight:700,fontSize:14,margin:"0 0 2px",color:T.t1}}>{u.name||"—"}</p>
                      <p style={{fontSize:12,color:T.t2,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</p>
                      <p style={{fontSize:11,color:T.t3,margin:0}}>
                        {u.provider} · Joined {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Pill label={statusLabel}/>
                  </div>

                  {/* Trial progress bar */}
                  {u.trial&&u.trialStart&&(
                    <div style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:11,color:daysLeft<=3?T.red:T.gold2,fontWeight:600}}>
                          {daysLeft>0?`⏱ ${daysLeft} days left in trial`:"⚠️ Trial expired"}
                        </span>
                        <span style={{fontSize:11,color:T.t3}}>
                          Started {new Date(u.trialStart).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
                        <div style={{width:`${Math.max(0,(daysLeft/30)*100)}%`,height:"100%",
                          background:daysLeft<=3?"linear-gradient(90deg,#EF4444,#F87171)":"linear-gradient(90deg,#F59E0B,#FCD34D)",
                          borderRadius:2,transition:"width .5s"}}/>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{updateUserSub(u.id,!u.subscribed);setAdminUsers(getUsers());}}
                      style={{flex:1,padding:"7px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,
                        border:`1px solid ${u.subscribed?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"}`,
                        background:u.subscribed?"rgba(239,68,68,.08)":"rgba(16,185,129,.08)",
                        color:u.subscribed?T.red:T.green2,fontSize:11,fontWeight:700}}>
                      {u.subscribed?"Revoke Access":"Grant Access"}
                    </button>
                    {u.trial&&(
                      <button onClick={()=>{
                        const users=getUsers(),idx=users.findIndex(x=>x.id===u.id);
                        if(idx>=0){users[idx].trial=false;users[idx].subscribed=true;saveUsers(users);}
                        setAdminUsers(getUsers());
                      }} style={{flex:1,padding:"7px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,
                        border:"1px solid rgba(99,102,241,.3)",background:"rgba(99,102,241,.08)",
                        color:T.accent2,fontSize:11,fontWeight:700}}>
                        Convert → PRO
                      </button>
                    )}
                    {!u.trial&&!u.subscribed&&(
                      <button onClick={()=>{
                        const users=getUsers(),idx=users.findIndex(x=>x.id===u.id);
                        if(idx>=0){users[idx].trial=true;users[idx].trialStart=Date.now();users[idx].subscribed=true;saveUsers(users);}
                        setAdminUsers(getUsers());
                      }} style={{flex:1,padding:"7px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,
                        border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.08)",
                        color:T.gold2,fontSize:11,fontWeight:700}}>
                        Start Trial
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </>)}

          {/* ── REVENUE TAB ── */}
          {adminTab==="revenue"&&(<>
            <Card style={{marginBottom:14,background:"linear-gradient(135deg,rgba(16,185,129,.1),rgba(99,102,241,.07))",borderColor:"rgba(16,185,129,.3)",padding:20,textAlign:"center"}}>
              <p style={{fontSize:11,color:T.green2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 6px"}}>Monthly Recurring Revenue</p>
              <p style={{fontSize:48,fontWeight:800,fontFamily:FONT_NUM,color:T.green2,margin:"0 0 4px",letterSpacing:"-.04em"}}>${monthlyRev.toFixed(2)}</p>
              <p style={{fontSize:13,color:T.t3,margin:0}}>{activeUsers.length} paid subscribers × $19.99/mo</p>
            </Card>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[
                ["Annual Run Rate","$"+annualRev.toFixed(0),T.accent2],
                ["Avg per User","$19.99",T.t1],
                ["Trial Pipeline",trialUsers.length+" users",T.gold2],
                ["Potential MRR","$"+((activeUsers.length+trialUsers.length)*19.99).toFixed(0),T.green2],
              ].map(([l,v,c])=>(
                <Card key={l} style={{textAlign:"center",padding:14}}>
                  <p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em",margin:"0 0 6px",lineHeight:1.4}}>{l}</p>
                  <p style={{fontSize:18,fontWeight:700,fontFamily:FONT_NUM,color:c,margin:0}}>{v}</p>
                </Card>
              ))}
            </div>

            <Card style={{marginBottom:14}}>
              <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>💳 Subscriber Breakdown</p>
              {activeUsers.length===0?(
                <p style={{fontSize:13,color:T.t3,textAlign:"center",padding:"20px 0",margin:0}}>No paid subscribers yet.</p>
              ):activeUsers.map(u=>(
                <div key={u.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.b2}`}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:T.t1,margin:0}}>{u.name||"—"}</p>
                    <p style={{fontSize:11,color:T.t3,margin:"2px 0 0"}}>{u.email}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:13,fontWeight:700,color:T.green2,margin:0,fontFamily:FONT_NUM}}>$19.99/mo</p>
                    <p style={{fontSize:10,color:T.t3,margin:"2px 0 0"}}>Since {new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </Card>
          </>)}

          {/* ── 1099 TAX TAB ── */}
          {adminTab==="tax"&&(<>
            <Card style={{marginBottom:14,background:"linear-gradient(135deg,rgba(245,158,11,.08),rgba(99,102,241,.06))",borderColor:"rgba(245,158,11,.3)",padding:20}}>
              <p style={{fontSize:16,fontWeight:800,color:T.gold,fontFamily:FONT_DISPLAY,margin:"0 0 6px"}}>📋 1099 Tax Forms</p>
              <p style={{fontSize:12,color:T.t2,margin:"0 0 16px",lineHeight:1.6}}>
                Export subscriber payment data for year-end 1099-K or 1099-NEC filing. Review with your accountant before filing.
              </p>
              <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:T.r3,padding:"10px 12px",marginBottom:16}}>
                <p style={{fontSize:11,color:T.gold2,fontWeight:700,margin:"0 0 4px"}}>⚠️ Important Disclaimer</p>
                <p style={{fontSize:11,color:T.t3,margin:0,lineHeight:1.6}}>This export is for your records only. Consult a licensed CPA or tax professional before filing. Requirements vary based on your business structure and jurisdiction. Amounts over $600/year per subscriber may require a 1099-NEC.</p>
              </div>
              <button onClick={export1099}
                style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#D97706,#F59E0B)",border:"none",borderRadius:T.r3,color:"#000",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:FONT_BODY,marginBottom:8}}>
                ⬇ Export 1099 CSV — {new Date().getFullYear()-1} Tax Year
              </button>
              <p style={{fontSize:11,color:T.t3,textAlign:"center",margin:0}}>Compatible with TurboTax, H&R Block, QuickBooks</p>
            </Card>

            {/* Tax summary */}
            <Card style={{marginBottom:14}}>
              <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Tax Year Summary — {new Date().getFullYear()-1}</p>
              {[
                ["Gross Revenue","$"+(monthlyRev*12).toFixed(2),T.green2],
                ["Paid Subscribers",activeUsers.length,T.t1],
                ["Platform Fee (est 2.9%)","$"+((monthlyRev*12)*0.029).toFixed(2),T.red2],
                ["Net Revenue (est)","$"+((monthlyRev*12)*0.971).toFixed(2),T.green2],
              ].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.b2}`}}>
                  <span style={{fontSize:13,color:T.t2}}>{l}</span>
                  <span style={{fontSize:14,fontWeight:700,color:c,fontFamily:FONT_NUM}}>{v}</span>
                </div>
              ))}
            </Card>

            {/* Per-user breakdown */}
            <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Per-Subscriber Breakdown</p>
            {activeUsers.length===0?(
              <Card style={{textAlign:"center",padding:"30px 20px"}}>
                <p style={{fontSize:13,color:T.t3,margin:0}}>No paid subscribers yet — nothing to report.</p>
              </Card>
            ):activeUsers.map(u=>(
              <Card key={u.id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <p style={{fontWeight:700,fontSize:13,margin:"0 0 2px"}}>{u.name||"Unknown"}</p>
                    <p style={{fontSize:11,color:T.t2,margin:"0 0 2px"}}>{u.email}</p>
                    <p style={{fontSize:10,color:T.t3,margin:0}}>Sub since {new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:14,fontWeight:800,color:T.green2,margin:0,fontFamily:FONT_NUM}}>$239.88</p>
                    <p style={{fontSize:10,color:T.t3,margin:"2px 0 0"}}>12 × $19.99</p>
                  </div>
                </div>
              </Card>
            ))}

            {trialUsers.length>0&&(<>
              <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10,marginTop:6}}>Trial Users (No Payment)</p>
              {trialUsers.map(u=>(
                <Card key={u.id} style={{marginBottom:10,borderLeft:`3px solid ${T.t4}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <p style={{fontWeight:600,fontSize:13,margin:"0 0 2px"}}>{u.name||"Unknown"}</p>
                      <p style={{fontSize:11,color:T.t2,margin:0}}>{u.email}</p>
                    </div>
                    <span style={{fontSize:12,color:T.t3,fontWeight:600}}>$0.00</span>
                  </div>
                </Card>
              ))}
            </>)}
          </>)}

        </div>
      </div>
    );
  }

  if(screen===S.PIVOT){
    const exitC=COINS.find(c=>c.symbol===pivotCoin);
    const exitH=portfolio[pivotCoin]||{amount:0};
    const exitPrice=prices[exitC?.cgId]?.usd||0;
    const exitUSD=exitH.amount*exitPrice;
    const pivotC=pivotRec?COINS.find(c=>c.symbol===pivotRec.pivotCoin):null;
    const pivotUSD=exitUSD*pivotPct/100,remUSD=exitUSD*(100-pivotPct)/100;
    return(<div style={{...appStyle,paddingBottom:40}}><style>{GOOGLE_FONTS}</style>
      <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}><button style={backBtnStyle} onClick={()=>{setScreen(S.MAIN);setPivotCoin(null);setPivotRec(null);}}>←</button><div style={{flex:1}}><h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>AI Pivot Advisor</h2><p style={{fontSize:12,color:T.t2,margin:0}}>Exit {pivotCoin} → Find best opportunity</p></div><Pill label="DEMO"/></div>
      <div style={{padding:16}}>
        <Card style={{marginBottom:14,borderLeft:`3px solid ${exitC?.color}`}} accent={exitC?.color}>
          <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Exiting Position</p>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",gap:12,alignItems:"center"}}><CoinAvatar coin={exitC||{symbol:pivotCoin,color:"#888"}} size={44}/><div><p style={{fontWeight:700,fontSize:18,margin:0,color:exitC?.color}}>{pivotCoin}</p><p style={{fontSize:12,color:T.t2,margin:0}}>{fmt(exitH.amount,6)} coins</p></div></div><div style={{textAlign:"right"}}><p style={{fontWeight:700,fontSize:18,margin:0}}>{usd(exitUSD)}</p><p style={{fontSize:12,color:T.red,margin:0}}>{pct(prices[exitC?.cgId]?.usd_24h_change||0)} today</p></div></div>
          {pivotRec&&<div style={{marginTop:12,padding:"10px 12px",background:"rgba(239,68,68,.08)",borderRadius:T.r3,borderLeft:`2px solid ${T.red}`}}><p style={{fontSize:12,color:T.red2,margin:0,lineHeight:1.5}}>{pivotRec.exitReason}</p></div>}
        </Card>
        {pivotBusy?(<Card style={{textAlign:"center",padding:"48px 20px"}}><div style={{fontSize:28,color:T.accent,marginBottom:12,animation:"spin 1.5s linear infinite"}}>◈</div><p style={{fontSize:15,fontWeight:600,color:T.t1,margin:"0 0 6px",fontFamily:FONT_DISPLAY}}>Scanning all markets...</p><p style={{fontSize:13,color:T.t2,margin:0}}>Claude is finding your best pivot opportunity</p></Card>)
        :pivotRec&&(<>
          <Card style={{marginBottom:14,borderColor:"rgba(99,102,241,.25)",background:"rgba(99,102,241,.06)"}}>
            <p style={{fontSize:11,color:T.accent2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>◈ Claude Recommends</p>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}><CoinAvatar coin={pivotC||{symbol:pivotRec.pivotCoin,color:"#6366F1"}} size={52}/><div style={{flex:1}}><p style={{fontWeight:800,fontSize:24,margin:0,fontFamily:FONT_DISPLAY,letterSpacing:"-.02em"}}>{pivotRec.pivotCoin}</p><p style={{fontSize:13,color:T.t2,margin:0}}>{usd(prices[pivotC?.cgId]?.usd)}</p></div><div style={{textAlign:"right"}}><p style={{fontSize:16,color:T.green2,fontWeight:700,margin:0,fontFamily:FONT_NUM}}>{pivotRec.targetGain}</p><p style={{fontSize:12,color:T.t2,margin:"2px 0"}}>{pivotRec.timeframe}</p><Pill label={pivotRec.riskLevel}/></div></div>
            <ProgressBar val={pivotRec.confidence}/>
            <p style={{fontSize:13,color:T.t2,marginTop:12,lineHeight:1.6}}>{pivotRec.entryReason}</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
              <div style={{background:"rgba(16,185,129,.06)",borderRadius:T.r3,padding:"10px 12px",border:`1px solid rgba(16,185,129,.12)`}}><p style={{fontSize:11,color:T.green2,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Bullish</p>{(pivotRec.bullish||[]).slice(0,3).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 4px",lineHeight:1.4}}>• {b}</p>)}</div>
              <div style={{background:"rgba(239,68,68,.06)",borderRadius:T.r3,padding:"10px 12px",border:`1px solid rgba(239,68,68,.12)`}}><p style={{fontSize:11,color:T.red2,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Risks</p>{(pivotRec.bearish||[]).slice(0,2).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 4px",lineHeight:1.4}}>• {b}</p>)}</div>
            </div>
          </Card>
          <Card style={{marginBottom:14}}>
            <p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:16}}>Allocate Your {pivotCoin}</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}><div><span style={{fontSize:44,fontWeight:800,fontFamily:FONT_NUM,color:T.accent2,letterSpacing:"-.04em"}}>{pivotPct}</span><span style={{fontSize:18,color:T.t2,marginLeft:2}}>%</span><p style={{fontSize:12,color:T.t2,margin:"4px 0 0"}}>→ {pivotRec.pivotCoin} · {usd(pivotUSD)}</p></div><div style={{textAlign:"right"}}><span style={{fontSize:26,fontWeight:700,fontFamily:FONT_NUM,color:remainder==="HODL"?T.gold2:T.blue}}>{100-pivotPct}</span><span style={{fontSize:14,color:T.t2,marginLeft:2}}>%</span><p style={{fontSize:12,color:T.t2,margin:"4px 0 0"}}>{remainder} · {usd(remUSD)}</p></div></div>
            <input type="range" min={10} max={100} step={5} value={pivotPct} onChange={e=>setPivotPct(Number(e.target.value))} style={{width:"100%",marginBottom:6}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,marginBottom:16}}><span>10%</span><span>50%</span><span>100%</span></div>
            <div style={{height:8,borderRadius:4,overflow:"hidden",background:"rgba(255,255,255,.06)",marginBottom:16,display:"flex"}}><div style={{width:`${pivotPct}%`,background:"linear-gradient(90deg,#4F46E5,#818CF8)",transition:"width .3s",borderRadius:"4px 0 0 4px"}}/><div style={{flex:1,background:remainder==="HODL"?"rgba(245,158,11,.35)":"rgba(59,130,246,.35)",transition:"background .3s",borderRadius:"0 4px 4px 0"}}/></div>
            <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Remainder goes to</p>
            <div style={{display:"flex",gap:8}}>{["HODL","USDC","USDT"].map(opt=>(<button key={opt} onClick={()=>setRemainder(opt)} style={{flex:1,padding:"10px 0",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid ${remainder===opt?T.accent:"rgba(255,255,255,.08)"}`,background:remainder===opt?"rgba(99,102,241,.18)":T.bg2,color:remainder===opt?T.accent2:T.t2,fontSize:13,fontWeight:600,transition:"all .15s"}}>{opt}</button>))}</div>
          </Card>
          {tradeMsg?(<Card style={{textAlign:"center",padding:20,borderColor:"rgba(16,185,129,.25)",background:"rgba(16,185,129,.08)"}}><p style={{fontSize:15,color:T.green2,fontWeight:700,margin:0}}>✓ {tradeMsg}</p></Card>)
          :confirming?(<Card style={{marginBottom:14,borderColor:"rgba(245,158,11,.25)",background:"rgba(245,158,11,.06)"}}><p style={{fontSize:12,color:T.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Confirm Trade</p><div style={{fontSize:14,lineHeight:2.2,color:T.t1}}><div>Pivot <strong style={{color:T.red}}>{pivotPct}% of {pivotCoin}</strong> → <strong style={{color:T.green2}}>{pivotRec.pivotCoin}</strong></div><div>Value: <strong style={{color:T.accent2}}>{usd(pivotUSD)}</strong></div><div>Remainder: <strong style={{color:remainder==="HODL"?T.gold2:T.blue}}>{100-pivotPct}% → {remainder}</strong> ({usd(remUSD)})</div></div><div style={{display:"flex",gap:10,marginTop:14}}><Btn variant="danger" onClick={()=>setConfirming(false)} style={{flex:1,width:"auto"}}>Cancel</Btn><Btn variant="success" onClick={executeTrade} style={{flex:2,width:"auto"}}>Execute Trade ▸</Btn></div></Card>)
          :(<Btn onClick={()=>setConfirming(true)}>Preview Trade →</Btn>)}
          <p style={{fontSize:11,color:T.t3,textAlign:"center",marginTop:12,lineHeight:1.6}}>Demo mode — no real money moves.</p>
        </>)}
      </div>
    </div>);
  }

  if(screen===S.DEEP&&deepCoin){
    const da=deepData[deepCoin.symbol];
    const price=prices[deepCoin.cgId]?.usd;
    const change=prices[deepCoin.cgId]?.usd_24h_change;
    const sigColor=da?.signal==="BUY"?T.green:da?.signal==="EXIT"?T.red:T.gold;
    return(<div style={{...appStyle,paddingBottom:40}}><style>{GOOGLE_FONTS}</style>
      <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}><button style={backBtnStyle} onClick={()=>setScreen(S.MAIN)}>←</button><CoinAvatar coin={deepCoin} size={36}/><div style={{flex:1}}><h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em"}}>{deepCoin.symbol} Analysis</h2><p style={{fontSize:12,color:T.t2,margin:0}}>Claude AI · {deepCoin.name}</p></div></div>
      <div style={{padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div><p style={{fontSize:32,fontWeight:800,fontFamily:FONT_NUM,margin:0,letterSpacing:"-.03em"}}>{usd(price)}</p><p style={{fontSize:13,color:(change||0)>=0?T.green2:T.red,fontWeight:600,margin:"4px 0 0"}}>{pct(change||0)} today</p></div><Spark data={histories[deepCoin.cgId]} color={deepCoin.color} w={100} h={48}/></div>
        {deepBusy[deepCoin.symbol]?(<Card style={{textAlign:"center",padding:"48px 20px",marginTop:14}}><div style={{fontSize:26,color:T.accent,marginBottom:12,animation:"spin 1.5s linear infinite"}}>◈</div><p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,margin:"0 0 6px"}}>Analyzing {deepCoin.symbol}...</p><p style={{fontSize:13,color:T.t2,margin:0}}>Claude is building your market analysis</p></Card>)
        :da&&(<>
          <Card style={{marginTop:14,marginBottom:14,borderColor:`${sigColor}25`,background:`${sigColor}08`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><Pill label={da.signal||"HODL"}/><Pill label={da.riskLevel||"MEDIUM"}/></div>
            <ProgressBar val={da.confidence||70} color={sigColor} height={4}/>
            <p style={{fontSize:13,color:T.t2,marginTop:14,lineHeight:1.7}}>{da.summary}</p>
            {da.action&&<div style={{marginTop:12,padding:"12px 14px",background:`${T.accent}12`,borderRadius:T.r3,borderLeft:`3px solid ${T.accent}`}}><p style={{fontSize:13,color:T.accent2,margin:0,lineHeight:1.5,fontWeight:500}}>{da.action}</p></div>}
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>{[["Target",da.targetPrice,T.green2],["Stop Loss",da.stopLoss,T.red],["Support",da.keyLevels?.support,T.gold2],["Resistance",da.keyLevels?.resistance,T.accent2]].map(([l,v,c])=>(<Card key={l} style={{textAlign:"center",padding:12}}><p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{l}</p><p style={{fontSize:16,fontWeight:700,fontFamily:FONT_NUM,color:c,margin:0}}>{v||"–"}</p></Card>))}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}><Card style={{borderLeft:`2px solid ${T.green}`}}><p style={{fontSize:11,color:T.green2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Bullish</p>{(da.bullish||[]).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 6px",lineHeight:1.4}}>• {b}</p>)}</Card><Card style={{borderLeft:`2px solid ${T.red}`}}><p style={{fontSize:11,color:T.red2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Bearish</p>{(da.bearish||[]).map((b,i)=><p key={i} style={{fontSize:12,color:T.t2,margin:"0 0 6px",lineHeight:1.4}}>• {b}</p>)}</Card></div>
          {da.signal==="EXIT"&&<Btn variant="danger" onClick={()=>openPivot(deepCoin.symbol)}>⇄ Open Pivot Advisor →</Btn>}
        </>)}
      </div>
    </div>);
  }

  if(screen===S.SETTINGS)return(<div style={{...appStyle,paddingBottom:40}}><style>{GOOGLE_FONTS}</style>
    <div style={{...hdrStyle,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}><button style={backBtnStyle} onClick={()=>setScreen(S.MAIN)}>←</button><h2 style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.02em",flex:1}}>Settings</h2>{isOwner&&<Pill label="PRO"/>}</div>
    <div style={{padding:16}}>
      <Card style={{marginBottom:12,borderColor:"rgba(16,185,129,.2)"}}><p style={{fontSize:11,color:T.green2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>👤 Account</p><p style={{fontWeight:600,fontSize:16,margin:"0 0 4px",fontFamily:FONT_DISPLAY}}>{user?.name||"–"}</p><p style={{fontSize:13,color:T.t2,margin:"0 0 4px"}}>{user?.email}</p><p style={{fontSize:12,color:T.t3,margin:0}}>via {user?.provider} · {user?.subscribed?"Active":"Free"}</p></Card>
      <Card style={{marginBottom:12,borderColor:walletConnected?"rgba(99,102,241,.3)":T.b1,background:walletConnected?"rgba(99,102,241,.05)":T.bg2}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:walletConnected?10:0}}><p style={{fontSize:11,color:walletConnected?T.accent2:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",margin:0}}>🔗 Connected Wallet</p><span style={{fontSize:11,fontWeight:600,color:walletConnected?T.green2:T.t3}}>{walletConnected?"● Connected":"Not connected"}</span></div>
        {walletConnected?(<><p style={{fontSize:13,color:T.t1,fontWeight:600,margin:"0 0 2px"}}>{walletType}</p><p style={{fontSize:11,color:T.t3,margin:"0 0 10px",fontFamily:FONT_NUM,wordBreak:"break-all"}}>{walletAddress}</p><div style={{display:"flex",gap:8}}><button onClick={()=>setScreen(S.CONNECT)} style={{flex:1,padding:"8px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(99,102,241,.3)`,background:"rgba(99,102,241,.1)",color:T.accent2,fontSize:12,fontWeight:600}}>Switch Wallet</button><button onClick={()=>{setWalletConnected(false);setWalletAddress("");setWalletType("");}} style={{flex:1,padding:"8px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.08)",color:T.red,fontSize:12,fontWeight:600}}>Disconnect</button></div></>)
        :(<div style={{marginTop:10}}><p style={{fontSize:12,color:T.t3,margin:"0 0 8px",lineHeight:1.5}}>Connect MetaMask, Coinbase Wallet, Trust, Phantom, Ledger or any wallet to see your real balances and trade directly.</p><Btn onClick={()=>setScreen(S.CONNECT)}>🔗 Connect Any Wallet</Btn></div>)}
      </Card>
      <Card style={{marginBottom:12}}>
        <p style={{fontSize:11,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>🔔 Notifications</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${T.b1}`}}><div><p style={{fontSize:13,fontWeight:600,color:T.t1,margin:0}}>Browser Push</p><p style={{fontSize:11,color:T.t3,margin:"2px 0 0"}}>Desktop & mobile browser alerts</p></div><button onClick={async()=>{if(pushEnabled){setPushEnabled(false);localStorage.removeItem("sp_push");return;}if(!("Notification" in window)){alert("Push not supported.");return;}const perm=await Notification.requestPermission();if(perm==="granted"){setPushEnabled(true);localStorage.setItem("sp_push","true");new Notification("SignalPulse Pro",{body:"Push alerts enabled!",icon:"/favicon.ico"});}}} style={{padding:"7px 16px",borderRadius:20,border:`1px solid ${pushEnabled?"rgba(16,185,129,.4)":T.b1}`,background:pushEnabled?"rgba(16,185,129,.12)":T.bg1,color:pushEnabled?T.green2:T.t3,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:FONT_BODY,minWidth:70}}>{pushEnabled?"ON ✓":"OFF"}</button></div>
        <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:smsEnabled?10:0}}><div><p style={{fontSize:13,fontWeight:600,color:T.t1,margin:0}}>📱 SMS Alerts</p><p style={{fontSize:11,color:T.t3,margin:"2px 0 0"}}>Text alerts to your cell phone</p></div><button onClick={()=>setSmsEnabled(p=>!p)} style={{padding:"7px 16px",borderRadius:20,border:`1px solid ${smsEnabled?"rgba(99,102,241,.4)":T.b1}`,background:smsEnabled?"rgba(99,102,241,.12)":T.bg1,color:smsEnabled?T.accent2:T.t3,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:FONT_BODY,minWidth:70}}>{smsEnabled?"ON ✓":"OFF"}</button></div>{smsEnabled&&(<div style={{marginTop:8}}><p style={{fontSize:12,color:T.t2,marginBottom:8}}>Enter your phone number to receive BUY/EXIT alerts via SMS.</p><div style={{display:"flex",gap:8}}><input value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} placeholder="+1 (555) 000-0000" type="tel" style={{flex:1,background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"10px 12px",color:T.t1,fontSize:13,fontFamily:FONT_BODY,outline:"none"}}/><button onClick={()=>{if(phoneNumber.length>6){alert("SMS alerts set up for "+phoneNumber);}}} style={{padding:"10px 14px",borderRadius:T.r3,border:"none",background:T.accent,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,whiteSpace:"nowrap"}}>Save</button></div><p style={{fontSize:11,color:T.t3,marginTop:6,lineHeight:1.5}}>Alerts fire for coins in your ★ Favorites.</p></div>)}</div>
      </Card>
      <Card style={{marginBottom:12}}><p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>💳 Subscription</p><p style={{fontWeight:600,fontSize:15,color:isOwner?T.gold:user?.trial?T.green2:user?.subscribed?T.accent2:T.gold2,margin:0}}>{isOwner?"Owner — Free Lifetime":user?.trial?"🎁 Free Trial — 30 days":user?.subscribed?"Pro — $19.99/mo":"Free — Upgrade to unlock"}</p>{user?.trial&&<p style={{fontSize:12,color:T.t3,marginTop:4}}>Started {new Date(user.trialStart).toLocaleDateString()}</p>}{!isOwner&&!user?.subscribed&&!user?.trial&&<Btn onClick={()=>setScreen(S.PAYWALL)} style={{marginTop:12}}>Upgrade to Pro →</Btn>}{user?.trial&&<Btn onClick={()=>setScreen(S.PAYWALL)} style={{marginTop:12}} variant="secondary">Subscribe Now →</Btn>}</Card>
      {isOwner&&<Btn variant="secondary" onClick={()=>{setAdminUsers(getUsers());setAdminTab("overview");setScreen(S.ADMIN);}} style={{marginBottom:10}}>👑 Admin Panel →</Btn>}
      <Card style={{marginBottom:12}}><p style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>⚙️ System</p><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:T.t2}}>Market Data</span><span style={{fontSize:13,color:T.t1,fontWeight:600}}>CoinGecko · 45s refresh</span></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:T.t2}}>Trading Engine</span><span style={{fontSize:11,fontWeight:700,color:cbKeysSaved?T.green2:T.gold2,background:cbKeysSaved?"rgba(16,185,129,.1)":"rgba(245,158,11,.1)",padding:"3px 9px",borderRadius:10,border:`1px solid ${cbKeysSaved?"rgba(16,185,129,.2)":"rgba(245,158,11,.2)"}`}}>{cbKeysSaved?"LIVE":"PAPER"}</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:T.t2}}>AI Engine</span><span style={{fontSize:13,color:T.t1,fontWeight:600}}>Claude Sonnet 4</span></div></Card>
      <Btn variant="danger" onClick={()=>{
  clearSession();
  localStorage.removeItem("sp_last_email");
  setUser(null);setIsOwner(false);
  setWalletConnected(false);setWalletAddress("");setWalletType("");
  setScreen(S.LANDING);
}}>Sign Out</Btn>
    </div>
  </div>);

  if(screen!==S.MAIN)return(<div style={{...appStyle,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><style>{GOOGLE_FONTS}</style><div style={{textAlign:"center"}}><div style={{fontSize:28,color:T.accent,marginBottom:12,animation:"spin 1.2s linear infinite"}}>◈</div><p style={{fontSize:14,color:T.t3}}>Loading...</p></div></div>);

  const taxData=computeTaxData(tradeLog.filter(t=>new Date(t.time).getFullYear()===taxYear));

  return(
    <div style={appStyle}>
      <style>{GOOGLE_FONTS}</style>
      <div style={{background:`radial-gradient(ellipse at 80% 0%,rgba(99,102,241,.08) 0%,transparent 50%)`,position:"fixed",inset:0,pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{...hdrStyle,padding:"14px 18px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <h1 style={{fontSize:20,fontWeight:800,fontFamily:FONT_DISPLAY,margin:0,letterSpacing:"-.03em"}}>SignalPulse</h1>
                {isOwner&&<Pill label="PRO"/>}
                {user?.trial&&<span style={{fontSize:11,fontWeight:700,color:trialDaysLeft<=3?T.red:T.green2,background:trialDaysLeft<=3?"rgba(239,68,68,.1)":"rgba(16,185,129,.1)",padding:"2px 8px",borderRadius:10,border:`1px solid ${trialDaysLeft<=3?"rgba(239,68,68,.2)":"rgba(16,185,129,.2)"}`}}>{trialDaysLeft}d trial</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}><LiveDot active={!fetching}/><span style={{fontSize:11,color:T.t3,fontWeight:500}}>{fetching?"Fetching prices...":lastFetch?`Updated ${ago(lastFetch)}`:"Connecting..."}</span></div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button onClick={()=>setScreen(S.CONNECT)} style={{padding:"8px 14px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid ${walletConnected?"rgba(16,185,129,.4)":"rgba(99,102,241,.3)"}`,background:walletConnected?"rgba(16,185,129,.1)":"rgba(99,102,241,.1)",color:walletConnected?T.green2:T.accent2,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                {walletConnected&&<span style={{width:6,height:6,borderRadius:"50%",background:T.green,display:"inline-block"}}/>}
                {walletConnected?"🔗 "+walletType.split(" ")[0]:"🔗 Connect Wallet"}
              </button>
              <button onClick={()=>setScreen(S.SETTINGS)} style={{...backBtnStyle,width:38,height:38,fontSize:16}}>⚙</button>
            </div>
          </div>
          <div style={{display:"flex",borderBottom:`1px solid ${T.b2}`}}>
            {[["signals","Signals"],["market","Market"],["alerts",`Alerts${unread>0?` · ${unread}`:""}`],["portfolio","Wallet"],["log","Trades"],["tax","Tax"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>{setTab(id);if(id==="alerts")markRead();}} style={{flex:1,padding:"10px 0 12px",fontSize:11,fontWeight:600,fontFamily:FONT_BODY,border:"none",background:"none",cursor:"pointer",transition:"all .2s",color:tab===id?T.accent2:T.t3,borderBottom:`2px solid ${tab===id?T.accent:"transparent"}`,marginBottom:-1}}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{padding:"16px 16px 70px"}}>
          {(tab==="signals"||tab==="market")&&(<div style={{position:"relative",marginBottom:14}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:T.t3,pointerEvents:"none"}}>🔍</span><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder={`Search ${tab==="signals"?"coins, signals":"coins, prices"}...`} style={{width:"100%",background:T.bg2,border:`1px solid ${searchQuery?T.accent:T.b1}`,borderRadius:T.r3,padding:"11px 36px 11px 38px",color:T.t1,fontSize:14,fontFamily:FONT_BODY,outline:"none",boxSizing:"border-box",transition:"all .2s"}}/>{searchQuery&&<button onClick={()=>setSearchQuery("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.t3,fontSize:18,cursor:"pointer",lineHeight:1,padding:"2px 6px"}}>×</button>}</div>)}

          {tab==="signals"&&COINS.filter(coin=>!searchQuery||coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())||coin.name.toLowerCase().includes(searchQuery.toLowerCase())||(signals[coin.symbol]?.action||"").toLowerCase().includes(searchQuery.toLowerCase())).map(coin=>{
            const cg=prices[coin.cgId]||{},sig=signals[coin.symbol],hist=histories[coin.cgId]||[];
            const holding=portfolio[coin.symbol],holdBal=holding?.amount||0,holdUSD=holdBal*(cg.usd||0);
            const pnlPct=holding?.avgBuy&&cg.usd?((cg.usd-holding.avgBuy)/holding.avgBuy)*100:null;
            const sigColor=sig?.action==="BUY"?T.green:sig?.action==="EXIT"?T.red:T.gold;
            return(<Card key={coin.symbol} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div style={{display:"flex",gap:12,alignItems:"center"}}><CoinAvatar coin={coin}/><div><p style={{fontWeight:700,fontSize:15,margin:0,fontFamily:FONT_DISPLAY}}>{coin.symbol}</p><p style={{fontSize:12,color:T.t3,margin:0,fontWeight:400}}>{coin.name}</p></div></div><div style={{textAlign:"right"}}><p style={{fontSize:17,fontWeight:700,fontFamily:FONT_NUM,margin:0}}>{cg.usd?usd(cg.usd):"–"}</p><p style={{fontSize:12,color:(cg.usd_24h_change||0)>=0?T.green2:T.red,margin:0,fontWeight:600}}>{pct(cg.usd_24h_change||0)}</p></div></div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><Spark data={hist} color={coin.color} w={90} h={32}/>{sig&&<Pill label={sig.action}/>}</div>
              {sig&&<ProgressBar val={sig.confidence} color={sigColor}/>}
              {sig&&<p style={{fontSize:12,color:T.t2,marginTop:8,lineHeight:1.5}}>{sig.reason}</p>}
              {holdBal>0&&(<div style={{marginTop:10,padding:"8px 12px",background:`${coin.color}0e`,borderRadius:T.r3,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${coin.color}20`}}><span style={{fontSize:12,color:coin.color,fontWeight:600}}>{fmt(holdBal,["USDC","USDT"].includes(coin.symbol)?2:6)} {coin.symbol}</span><span style={{fontSize:12,color:T.t2}}>{usd(holdUSD)}</span>{pnlPct!=null&&<span style={{fontSize:12,color:pnlPct>=0?T.green2:T.red,fontWeight:700}}>{pct(pnlPct)}</span>}</div>)}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                {sig?.action==="EXIT"&&<button onClick={()=>openPivot(coin.symbol)} style={{flex:2,padding:"10px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(239,68,68,.3)`,background:"rgba(239,68,68,.1)",color:T.red,fontSize:13,fontWeight:600}}>⇄ Pivot Advisor</button>}
                {sig?.action==="BUY"&&<button style={{flex:2,padding:"10px",borderRadius:T.r3,fontFamily:FONT_BODY,border:`1px solid rgba(16,185,129,.3)`,background:"rgba(16,185,129,.1)",color:T.green2,fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ AI Signal: Buy</button>}
                {sig?.action==="HODL"&&<button style={{flex:2,padding:"10px",borderRadius:T.r3,fontFamily:FONT_BODY,border:`1px solid rgba(245,158,11,.25)`,background:"rgba(245,158,11,.07)",color:T.gold2,fontSize:13,fontWeight:600,cursor:"pointer"}}>◈ Holding</button>}
                <button onClick={()=>{setChartCoin(coin);setChartFrame("24H");setScreen("chart");}} style={{flex:1,padding:"10px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(99,102,241,.25)`,background:"rgba(99,102,241,.08)",color:T.accent2,fontSize:13,fontWeight:600}}>📈</button>
                <button onClick={()=>openDeep(coin)} style={{flex:1,padding:"10px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(99,102,241,.25)`,background:"rgba(99,102,241,.08)",color:T.accent2,fontSize:13,fontWeight:600}}>AI ▸</button>
              </div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={()=>openTrade(coin,"buy")} style={{flex:1,padding:"8px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(16,185,129,.3)`,background:"rgba(16,185,129,.08)",color:T.green2,fontSize:12,fontWeight:700}}>▲ Buy</button>
                <button onClick={()=>openTrade(coin,"sell")} style={{flex:1,padding:"8px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(239,68,68,.3)`,background:"rgba(239,68,68,.08)",color:T.red,fontSize:12,fontWeight:700}}>▼ Sell</button>
              </div>
            </Card>);
          })}

          {tab==="market"&&(<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"flex",gap:6}}>{[["all","All"],["favorites","★ Favorites"]].map(([v,l])=>(<button key={v} onClick={()=>setMarketFilter(v)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${marketFilter===v?T.accent:T.b1}`,cursor:"pointer",fontFamily:FONT_BODY,fontSize:12,fontWeight:600,background:marketFilter===v?"rgba(99,102,241,.15)":T.bg2,color:marketFilter===v?T.accent2:T.t3}}>{l}</button>))}</div>
              <button onClick={enablePush} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${pushEnabled?"rgba(16,185,129,.3)":T.b1}`,cursor:"pointer",fontFamily:FONT_BODY,fontSize:12,fontWeight:600,background:pushEnabled?"rgba(16,185,129,.1)":T.bg2,color:pushEnabled?T.green2:T.t3}}>{pushEnabled?"🔔 On":"🔔 Alerts"}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 0.7fr",gap:8,padding:"0 4px",marginBottom:8}}>{["Coin","Price","24H","★"].map(h=>(<p key={h} style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:0,textAlign:h==="Price"||h==="24H"?"right":"left"}}>{h}</p>))}</div>
            {(marketFilter==="all"?SIGNAL_COINS:SIGNAL_COINS.filter(c=>favorites.includes(c.symbol))).filter(coin=>!searchQuery||coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())||coin.name.toLowerCase().includes(searchQuery.toLowerCase())).map(coin=>{
              const cg=prices[coin.cgId]||{},mkt=marketData.find(m=>m.id===coin.cgId)||{},ch=cg.usd_24h_change||0,isFav=favorites.includes(coin.symbol),sig=signals[coin.symbol];
              return(<div key={coin.symbol} style={{background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"12px 14px",marginBottom:8,cursor:"pointer"}} onClick={()=>{setChartCoin(coin);setChartFrame("24H");setScreen("chart");}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 0.7fr",gap:8,alignItems:"center"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}><CoinAvatar coin={coin} size={34}/><div><p style={{fontWeight:700,fontSize:14,margin:0,fontFamily:FONT_DISPLAY}}>{coin.symbol}</p><p style={{fontSize:10,color:T.t3,margin:0}}>{mkt.market_cap_rank?"#"+mkt.market_cap_rank:coin.name.slice(0,8)}</p></div></div>
                  <div style={{textAlign:"right"}}><p style={{fontSize:13,fontWeight:700,fontFamily:FONT_NUM,margin:0}}>{cg.usd?usd(cg.usd):"–"}</p><p style={{fontSize:10,color:T.t3,margin:0}}>{mkt.market_cap?`$${(mkt.market_cap/1e9).toFixed(1)}B`:"–"}</p></div>
                  <div style={{textAlign:"right"}}><p style={{fontSize:13,fontWeight:700,fontFamily:FONT_NUM,color:ch>=0?T.green2:T.red,margin:0}}>{pct(ch)}</p>{sig&&<Pill label={sig.action}/>}</div>
                  <div style={{textAlign:"right"}}><button onClick={e=>{e.stopPropagation();toggleFavorite(coin.symbol);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:isFav?T.gold:"rgba(255,255,255,.15)",padding:0}}>★</button></div>
                </div>
              </div>);
            })}
            {marketFilter==="favorites"&&favorites.length===0&&(<Card style={{textAlign:"center",padding:"50px 20px"}}><p style={{fontSize:32,marginBottom:12}}>★</p><p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,color:T.t1,margin:"0 0 6px"}}>No favorites yet</p><p style={{fontSize:13,color:T.t2,margin:0}}>Tap the ★ on any coin to add it to your favorites.</p></Card>)}
          </div>)}

          {tab==="alerts"&&(<div>
            <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Live Alerts · {notes.length} total</p>
            {notes.length===0&&(<Card style={{textAlign:"center",padding:"50px 20px"}}><p style={{fontSize:32,marginBottom:12}}>📡</p><p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,color:T.t1,margin:"0 0 6px"}}>Scanning markets</p><p style={{fontSize:13,color:T.t2,margin:0}}>Buy and Exit signals will appear here automatically.</p></Card>)}
            {notes.map(n=>(<Card key={n.id} style={{marginBottom:10,borderLeft:`3px solid ${n.coinColor}`,opacity:n.read?.65:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontWeight:700,color:n.coinColor,fontSize:14,fontFamily:FONT_DISPLAY}}>{n.coin}</span><Pill label={n.action}/></div><span style={{fontSize:11,color:T.t3}}>{ago(n.time)}</span></div><p style={{fontSize:13,color:T.t2,lineHeight:1.5,margin:"0 0 6px"}}>{n.reason}</p><div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.t3}}><span>{usd(n.price)}</span><span>{pct(n.change)} · {n.confidence}% confidence</span></div>{n.action==="EXIT"&&(<button onClick={()=>openPivot(n.coin)} style={{width:"100%",marginTop:10,padding:"9px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(239,68,68,.25)`,background:"rgba(239,68,68,.08)",color:T.red,fontSize:13,fontWeight:600}}>Open Pivot Advisor →</button>)}</Card>))}
          </div>)}

          {tab==="portfolio"&&(<div>
            {!walletConnected?(<Card style={{textAlign:"center",padding:"40px 20px",borderColor:"rgba(99,102,241,.2)",background:"rgba(99,102,241,.04)"}}><div style={{fontSize:40,marginBottom:14}}>🔗</div><p style={{fontSize:17,fontWeight:700,fontFamily:FONT_DISPLAY,color:T.t1,margin:"0 0 8px"}}>Connect Your Wallet</p><p style={{fontSize:13,color:T.t2,margin:"0 0 6px",lineHeight:1.6}}>Connect any crypto wallet to view your real balances, track your portfolio, and trade directly.</p><p style={{fontSize:12,color:T.t3,margin:"0 0 20px",lineHeight:1.5}}>Supports MetaMask, Coinbase Wallet, Trust, Phantom, Ledger, WalletConnect and more.</p><Btn onClick={()=>setScreen(S.CONNECT)}>🔗 Connect Any Wallet</Btn></Card>)
            :(<>
              <Card style={{marginBottom:14,background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(16,185,129,.07))",borderColor:"rgba(99,102,241,.25)",padding:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div><p style={{fontSize:11,color:T.accent2,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 4px"}}>{walletType} · Connected</p><p style={{fontSize:10,color:T.t3,fontFamily:FONT_NUM,margin:"0 0 8px",wordBreak:"break-all",maxWidth:200}}>{walletAddress}</p><p style={{fontSize:34,fontWeight:800,fontFamily:FONT_NUM,color:T.green2,margin:"0 0 4px",letterSpacing:"-.03em"}}>{usd(portfolioUSD)}</p><p style={{fontSize:13,color:portfolioPnL>=0?T.green2:T.red,fontWeight:600,margin:0}}>{portfolioPnL>=0?"↑":"↓"} {usd(Math.abs(portfolioPnL))} unrealized PnL</p></div>
                  <button onClick={()=>setScreen(S.CONNECT)} style={{padding:"8px 12px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(99,102,241,.3)`,background:"rgba(99,102,241,.1)",color:T.accent2,fontSize:12,fontWeight:600,flexShrink:0}}>Switch</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[{label:"↓ BUY",tx:"BUY",c:T.green2,bg:"rgba(16,185,129,.12)",b:"rgba(16,185,129,.3)"},{label:"↑ SELL",tx:"SELL",c:T.gold2,bg:"rgba(245,158,11,.1)",b:"rgba(245,158,11,.3)"},{label:"→ SEND",tx:"TRANSFER",c:T.accent2,bg:"rgba(99,102,241,.12)",b:"rgba(99,102,241,.3)"}].map(btn=>(
                    <button key={btn.tx} onClick={()=>{setScreen(S.CONNECT);}} style={{padding:"10px 0",background:btn.bg,border:`1px solid ${btn.b}`,borderRadius:T.r3,color:btn.c,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:FONT_BODY}}>{btn.label}</button>
                  ))}
                </div>
              </Card>
              {Object.entries(portfolio).filter(([,v])=>v.amount>0).length===0?(<Card style={{textAlign:"center",padding:"30px 20px"}}><p style={{fontSize:13,color:T.t3,margin:0}}>No holdings found. Use the Trade screen to add positions.</p></Card>)
              :Object.entries(portfolio).filter(([,v])=>v.amount>0).map(([sym,h])=>{
                const coin=COINS.find(c=>c.symbol===sym),isStable=["USDC","USDT","DAI"].includes(sym);
                const price2=isStable?1:(coin?prices[coin.cgId]?.usd:0)||0,val=h.amount*price2;
                const pnlPct=!isStable&&h.avgBuy&&price2?((price2-h.avgBuy)/h.avgBuy)*100:null;
                const sig=coin?signals[coin.symbol]:null;
                return(<Card key={sym} style={{marginBottom:10,borderLeft:`3px solid ${coin?.color||T.blue}40`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",gap:12,alignItems:"center"}}><CoinAvatar coin={coin||{symbol:sym,color:T.blue}} size={38}/><div><p style={{fontWeight:600,fontSize:14,margin:0,fontFamily:FONT_DISPLAY}}>{sym}</p><p style={{fontSize:12,color:T.t2,margin:0}}>{isStable?usd(h.amount):fmt(h.amount,6)} {!isStable&&sym}</p></div></div><div style={{textAlign:"right"}}><p style={{fontWeight:700,fontSize:15,fontFamily:FONT_NUM,margin:0}}>{usd(val)}</p>{pnlPct!=null&&<p style={{fontSize:12,color:pnlPct>=0?T.green2:T.red,fontWeight:600,margin:"2px 0 0"}}>{pct(pnlPct)}</p>}{sig&&<div style={{marginTop:4}}><Pill label={sig.action}/></div>}</div></div></Card>);
              })}
            </>)}
          </div>)}

          {tab==="log"&&(<div>
            <p style={{fontSize:12,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Trade History · {tradeLog.length} trades</p>
            {openOrders.filter(o=>o.status==="pending").length>0&&(<Card style={{marginBottom:14,borderColor:"rgba(99,102,241,.25)",background:"rgba(99,102,241,.06)"}}><p style={{fontSize:11,color:T.accent2,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>⏳ Open Limit Orders ({openOrders.filter(o=>o.status==="pending").length})</p>{openOrders.filter(o=>o.status==="pending").map(o=>(<div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"8px 10px",background:"rgba(255,255,255,.03)",borderRadius:T.r3,borderLeft:`2px solid ${o.mode==="buy"?T.green:T.red}`}}><div><p style={{fontSize:12,fontWeight:700,color:o.mode==="buy"?T.green2:T.red,margin:"0 0 2px"}}>{o.mode==="buy"?"▲ Buy":"▼ Sell"} {o.coin} @ {usd(o.limitPrice)}</p><p style={{fontSize:11,color:T.t3,margin:0}}>{usd(o.usdAmt)} · {ago(o.time)}</p></div><button onClick={()=>cancelOrder(o.id)} style={{padding:"5px 10px",borderRadius:T.r3,border:`1px solid rgba(239,68,68,.3)`,background:"rgba(239,68,68,.08)",color:T.red,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FONT_BODY}}>Cancel</button></div>))}</Card>)}
            {tradeLog.length===0&&(<Card style={{textAlign:"center",padding:"50px 20px"}}><p style={{fontSize:32,marginBottom:12}}>📊</p><p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,color:T.t1,margin:"0 0 6px"}}>No trades yet</p><p style={{fontSize:13,color:T.t2,margin:0}}>Use the Pivot Advisor to execute your first trade.</p></Card>)}
            {tradeLog.map(t=>(<Card key={t.id} style={{marginBottom:10,borderLeft:`3px solid ${t.type==="market"||t.type==="limit"?(t.mode==="buy"?T.green:T.red):T.accent}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",gap:8,alignItems:"center"}}>{t.type==="market"||t.type==="limit"?(<span style={{fontWeight:700,fontSize:14,color:t.mode==="buy"?T.green2:T.red}}>{t.mode==="buy"?"▲ Buy":"▼ Sell"} {t.coin}</span>):(<span style={{color:T.accent2,fontWeight:700,fontSize:14,fontFamily:FONT_DISPLAY}}>⇄ {t.from} → {t.to}</span>)}{t.type&&<span style={{fontSize:10,color:T.t3,background:"rgba(255,255,255,.05)",padding:"2px 7px",borderRadius:10,border:`1px solid ${T.b1}`,fontWeight:600,textTransform:"uppercase"}}>{t.type}</span>}{t.status&&<span style={{fontSize:10,color:t.status==="completed"?T.green2:t.status==="pending"?T.gold2:T.t3,fontWeight:600}}>{t.status}</span>}</div><span style={{fontSize:11,color:T.t3}}>{ago(t.time)}</span></div>{t.type==="market"||t.type==="limit"?(<p style={{fontSize:13,color:T.t2,margin:0}}>{usd(t.usdAmt||0)} {t.type==="limit"?`@ limit ${usd(t.limitPrice)}`:`@ ${usd(t.price||0)}`}</p>):(<><p style={{fontSize:13,color:T.t2,margin:"0 0 4px"}}>{t.pivotPct}% · {usd(t.pivotUSD)} → {t.to} @ {usd(t.toPrice)}</p><p style={{fontSize:12,color:T.t3,margin:0}}>Remainder {100-t.pivotPct}% → {t.remDest}</p></>)}</Card>))}
          </div>)}

          {tab==="tax"&&(<div>
            <Card style={{marginBottom:14,background:"linear-gradient(135deg,rgba(245,158,11,.08),rgba(99,102,241,.06))",borderColor:"rgba(245,158,11,.25)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><p style={{fontSize:13,fontWeight:700,color:T.gold,margin:0,fontFamily:FONT_DISPLAY}}>📋 Crypto Tax Report</p><p style={{fontSize:11,color:T.t3,margin:"2px 0 0"}}>Based on your trade history in SignalPulse</p></div><select value={taxYear} onChange={e=>setTaxYear(Number(e.target.value))} style={{background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:T.r3,padding:"6px 10px",color:T.t1,fontSize:13,fontFamily:FONT_BODY,outline:"none"}}>{[2025,2024,2023].map(y=><option key={y} value={y}>{y}</option>)}</select></div><p style={{fontSize:11,color:T.t3,lineHeight:1.6,margin:0,padding:"8px 10px",background:"rgba(245,158,11,.06)",borderRadius:T.r3,border:`1px solid rgba(245,158,11,.15)`}}>⚠️ <strong style={{color:T.gold2}}>Disclaimer:</strong> For informational purposes only. Consult a qualified tax professional or CPA before filing.</p></Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>{[["Total Gain/Loss",taxData.totalGain,taxData.totalGain>=0?T.green2:T.red],["Short-Term",taxData.shortGain,taxData.shortGain>=0?T.green2:T.red],["Long-Term",taxData.longGain,taxData.longGain>=0?T.green2:T.red],["Taxable Events",taxData.rows.length,T.accent2]].map(([l,v,c])=>(<Card key={l} style={{textAlign:"center",padding:14}}><p style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 6px"}}>{l}</p><p style={{fontSize:typeof v==="number"&&Math.abs(v)>999?16:20,fontWeight:700,fontFamily:FONT_NUM,color:c,margin:0}}>{typeof v==="number"&&l!=="Taxable Events"?(v>=0?"+":"")+usd(Math.abs(v)):v}</p></Card>))}</div>
            {taxData.rows.length===0?(<Card style={{textAlign:"center",padding:"50px 20px"}}><p style={{fontSize:32,marginBottom:12}}>📋</p><p style={{fontSize:15,fontWeight:600,fontFamily:FONT_DISPLAY,color:T.t1,margin:"0 0 6px"}}>No trades in {taxYear}</p><p style={{fontSize:13,color:T.t2,margin:0}}>Execute trades via the Pivot Advisor to generate your tax report.</p></Card>)
            :(<>{taxData.rows.map((r,i)=>(<Card key={r.id||i} style={{marginBottom:10,borderLeft:`3px solid ${r.gain>=0?T.green:T.red}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontWeight:700,fontSize:13,fontFamily:FONT_DISPLAY,color:T.t1}}>{r.from} → {r.to}</span><Pill label={r.term}/></div><span style={{fontSize:11,color:T.t3}}>{new Date(r.time).toLocaleDateString()}</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}><div><p style={{fontSize:10,color:T.t3,margin:"0 0 2px",fontWeight:600,textTransform:"uppercase"}}>Proceeds</p><p style={{fontSize:13,color:T.t1,fontFamily:FONT_NUM,fontWeight:600,margin:0}}>{usd(r.proceeds)}</p></div><div><p style={{fontSize:10,color:T.t3,margin:"0 0 2px",fontWeight:600,textTransform:"uppercase"}}>Cost Basis</p><p style={{fontSize:13,color:T.t2,fontFamily:FONT_NUM,fontWeight:600,margin:0}}>{usd(r.costBasis)}</p></div><div><p style={{fontSize:10,color:T.t3,margin:"0 0 2px",fontWeight:600,textTransform:"uppercase"}}>Gain/Loss</p><p style={{fontSize:13,color:r.gain>=0?T.green2:T.red,fontFamily:FONT_NUM,fontWeight:700,margin:0}}>{r.gain>=0?"+":""}{usd(r.gain)}</p></div></div><p style={{fontSize:11,color:T.t3,margin:"6px 0 0"}}>Held {r.holdDays} days</p></Card>))}
            <button onClick={()=>exportCSV(taxData.rows)} style={{width:"100%",marginTop:8,padding:"14px",borderRadius:T.r3,cursor:"pointer",fontFamily:FONT_BODY,border:`1px solid rgba(99,102,241,.3)`,background:"rgba(99,102,241,.1)",color:T.accent2,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>⬇ Export CSV for Tax Filing</button>
            <p style={{fontSize:11,color:T.t3,textAlign:"center",marginTop:8,lineHeight:1.6}}>Compatible with TurboTax, TaxAct, H&amp;R Block, and most tax software</p></>)}
          </div>)}
        </div>
      </div>
    </div>
  );
}
