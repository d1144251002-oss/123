import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const db = createClient(
  "https://mexndpdexhhqshcwyqxk.supabase.co",
  "sb_publishable_XqdRTjYf9JaPCjpn-0jJQA_BZSefPZx",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
const app = document.getElementById("app");
const A = ["A","B","C","D","E","F"];
const state = { user:null, event:null, questions:[], stats:null, guest:null, guestCode:"",
  token:"", editing:null, optionDraft:["","","",""], correctDraft:0, projector:false };
let timer = null, routeVersion = 0, toastTimer = null;

function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function el(id) { return document.getElementById(id); }
function fmt(n) { return Number(n || 0).toLocaleString("zh-TW"); }
function capCode(v) { return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8); }
function errText(e) { return e && e.message ? e.message : "操作失敗，請檢查網路連線"; }
function toast(msg,error=false) {
  const t=el("toast"); t.textContent=String(msg); t.className="show"+(error?" error":"");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.className="";},4200);
}
function badge(status) {
  const m={open:["進行中","good"],draft:["未開始","amber"],closed:["已結束","red"]};
  const s=m[status]||["未知",""];
  return '<span class="badge '+s[1]+'"><span class="dot"></span>'+s[0]+'</span>';
}
function header() {
 return '<header class="topbar"><div class="wrap"><a class="brand" href="#"><span class="brand-icon">✦</span>PulseQuiz</a><nav class="nav"><a href="#">活動首頁</a><a href="#host">管理後台</a></nav></div></header>';
}
function side(current) {
 return '<aside class="sidebar"><a class="brand" href="#"><span class="brand-icon">✦</span>PulseQuiz</a>'+
 '<a class="'+(current==="host"?"active":"")+'" href="#host">⌂　我的活動</a>'+
 '<a class="'+(current==="event"?"active":"")+'" href="'+(state.event?"#event="+state.event.id:"#host")+'">▤　活動控制台</a>'+
 '<a href="#">↗　參加者首頁</a></aside>';
}
function shell(body,current) { return header()+'<div class="shell">'+side(current)+'<main class="main">'+body+'</main></div>'; }
function field(label,id,type,placeholder,value,required=true) {
 return '<div class="field"><label for="'+id+'">'+label+'</label><input class="input" id="'+id+'" type="'+type+'" placeholder="'+esc(placeholder)+'" value="'+esc(value||"")+'" '+(required?"required":"")+'></div>';
}
function safeLocalGet(k) { try {return localStorage.getItem(k);}catch{return null;} }
function safeLocalSet(k,v) { try{localStorage.setItem(k,v);}catch{} }
function activeUrl(code) {return location.origin+location.pathname+"#join="+encodeURIComponent(code);}
function resultBar(name,count,total,correct) {
 const p=total>0?Math.min(100,Math.max(0,Math.round(100*count/total))):0;
 return '<div class="barrow"><div class="barlabel"><span>'+esc(name)+(correct?'　✓ 正確答案':'')+
 '</span><strong>'+fmt(count)+' 票 · '+p+'%</strong></div><div class="barbg"><div class="barfill'+(correct?' correct':'')+'" style="width:'+p+'%"></div></div></div>';
}
function loading(message) {app.innerHTML=header()+'<div class="guest-wrap center"><span class="spinner" style="display:inline-block"></span><p>'+esc(message)+'</p></div>';}
function showHome() {
 document.body.classList.remove("projector");
 app.innerHTML=header()+'<div class="wrap"><section class="hero"><div><div class="eyebrow">LIVE ENGAGEMENT PLATFORM</div>'+
 '<h1>讓每一場活動<br><span class="grad">都有即時回應。</span></h1>'+
 '<p class="lead">現場出題、手機作答、秒懂大家的想法。從校園講座到社團活動，讓參與變得更簡單。</p>'+
 '<div class="hero-actions"><a class="btn primary" href="#host">✦　建立活動</a><a class="btn" href="#join">加入現場問答 →</a></div></div>'+
 '<div class="panel hero-panel"><span class="badge good"><span class="dot"></span> 立即參與</span>'+
 '<h2 style="margin:20px 0 8px;font-size:26px">輸入活動代碼</h2><p class="tiny">向主持人索取六碼代碼，無須註冊即可參加。</p>'+
 '<form id="code-form"><div class="field"><label for="home-code">活動代碼</label><input id="home-code" class="input" inputmode="text" maxlength="8" autocomplete="off" style="font-size:24px;letter-spacing:5px;font-weight:800;text-transform:uppercase" placeholder="例如 A1B2C3" required></div>'+
 '<button type="submit" class="btn primary" style="width:100%">進入活動 →</button></form>'+
 '<div class="divider"></div><p class="tiny" style="margin:0">在現場掃描 QR Code，也能直接加入。</p></div></section>'+
 '<section class="features"><div class="feature"><div class="feature-icon">⚡</div><h3>即時互動</h3><p>題目切換後，手機畫面自動更新。</p></div>'+
 '<div class="feature"><div class="feature-icon">▥</div><h3>清楚的圖表</h3><p>即時票數、百分比與正確答案一目了然。</p></div>'+
 '<div class="feature"><div class="feature-icon">◇</div><h3>安全可靠</h3><p>透過 Supabase 寫入，每一裝置每題只計一次。</p></div></section></div>'+
 '<footer class="footer center">PulseQuiz · Powered by Supabase</footer>';
}
function showAuth(signup=false) {
 document.body.classList.remove("projector");
 app.innerHTML=header()+'<div class="auth-wrap"><div class="panel"><span class="badge">主持人專區</span>'+
 '<h1 style="margin:16px 0 8px">'+(signup?'建立主持人帳號':'登入管理後台')+'</h1>'+
 '<p>建立題目、管理現場進度與查看統計。</p><form id="auth-form" data-signup="'+signup+'">'+
 field("電子郵件","auth-email","email","name@example.com","")+
 field("密碼（至少 6 碼）","auth-pass","password","輸入登入密碼","")+
 '<button type="submit" class="btn primary" style="width:100%">'+(signup?'註冊帳號':'登入後台')+'</button></form>'+
 '<div class="divider"></div><button class="btn ghost" style="width:100%" data-act="'+(signup?'login-view':'signup-view')+'">'+
 (signup?'已有帳號？前往登入':'還沒有帳號？立即註冊')+'</button>'+
 '<p class="tiny center" style="margin:17px 0 0">若有啟用信箱驗證，請先完成 Email 驗證再登入。</p></div></div>';
}
async function showHost(version) {
 document.body.classList.remove("projector");
 if (!state.user) {showAuth();return;}
 loading("正在載入你的活動…");
 const {data,error}=await db.from("evq_events").select("id,code,title,description,status,created_at").order("created_at",{ascending:false});
 if(version!==routeVersion)return;
 if(error){app.innerHTML=shell('<h1>無法載入活動</h1><p>'+esc(errText(error))+'</p><button class="btn" data-act="retry">重新整理</button>',"host");return;}
 const cards=(data||[]).map(e=>'<a href="#event='+e.id+'" class="list-card" style="display:block">'+
 '<div class="question-top"><span class="mini-label">活動代碼 · '+esc(e.code)+'</span>'+badge(e.status)+'</div>'+
 '<h3>'+esc(e.title)+'</h3><p class="tiny">'+esc(e.description||"點擊進入管理控制台")+'</p></a>').join("");
 app.innerHTML=shell('<div class="head"><div><span class="eyebrow">EVENT DASHBOARD</span><h1>我的活動</h1>'+
 '<p>管理活動場次、即時題目及統計資料。</p></div><button class="btn ghost" data-act="logout">登出帳號</button></div>'+
 '<div class="grid2"><div><div class="section-title"><h2>活動清單</h2><span class="badge">'+(data||[]).length+' 場活動</span></div>'+
 '<div class="stack">'+(cards||'<div class="empty">還沒有建立活動。<br>從右邊開始新增第一場活動。</div>')+'</div></div>'+
 '<section class="panel"><span class="badge good">建立新活動</span><h2 style="margin:16px 0">開始一場精彩互動</h2>'+
 '<form id="new-event-form">'+field("活動名稱","new-title","text","例如：新生迎新有獎問答","")+
 '<div class="field"><label for="new-desc">活動說明（選填）</label><textarea id="new-desc" class="input" maxlength="500" placeholder="活動目標、遊戲方式或備註"></textarea></div>'+
 '<button type="submit" class="btn primary" style="width:100%">✦　建立活動</button></form>'+
 '<p class="tiny" style="margin:16px 0 0">系統會自動產生活動代碼，開始活動後才能加入。</p></section></div>',"host");
}
function statsFor(id) {
 return (state.stats && state.stats.questions && state.stats.questions[id]) || {total:0,counts:[]};
}
function eventMetrics() {
 const open=state.questions.find(q=>q.status==="open");
 const v=open?statsFor(open.id).total:0;
 return '<div class="grid3" style="margin-bottom:23px"><div class="stat"><div class="label">參加人數</div><div class="value">'+fmt(state.stats?.participants)+'</div><div class="tiny muted">已加入活動的裝置數</div></div>'+
 '<div class="stat"><div class="label">已建立題目</div><div class="value">'+state.questions.length+'</div><div class="tiny muted">最多 100 題</div></div>'+
 '<div class="stat"><div class="label">目前題目回覆</div><div class="value">'+fmt(v)+'</div><div class="tiny muted">'+(open?'正在收集第 '+open.position+' 題':'目前沒有開放題目')+'</div></div></div>';
}
function optionsEdit() {
 return state.optionDraft.map((v,i)=>'<div class="option-edit"><span class="letter">'+A[i]+'</span>'+
 '<input class="input qoption" data-opt="'+i+'" maxlength="120" placeholder="選項 '+A[i]+'" value="'+esc(v)+'" aria-label="選項 '+A[i]+'">'+
 (state.optionDraft.length>2?'<button type="button" class="btn small ghost" data-act="remove-option" data-index="'+i+'" aria-label="刪除選項 '+A[i]+'">×</button>':'')+'</div>').join("");
}
function correctEdit() {
 return '<label for="correct-select">正確答案</label><select class="input" id="correct-select">'+
 state.optionDraft.map((_,i)=>'<option value="'+i+'" '+(state.correctDraft===i?'selected':'')+'>'+A[i]+'</option>').join("")+'</select>';
}
function composer() {
 const q=state.questions.find(x=>x.id===state.editing);
 return '<section class="panel" id="compose-panel"><div class="section-title"><h2>'+(q?'編輯草稿':'新增題目')+'</h2>'+
 (q?'<button class="btn small" data-act="cancel-edit">取消編輯</button>':'<span class="badge">單選題</span>')+'</div>'+
 '<form id="question-form"><div class="field"><label for="q-prompt">題目內容</label><textarea class="input" id="q-prompt" maxlength="500" required placeholder="例如：本場活動的主題是什麼？">'+esc(q?.prompt||"")+'</textarea></div>'+
 '<div class="field"><label>答案選項（2～6 個）</label><div id="option-editor">'+optionsEdit()+'</div>'+
 '<button class="btn small ghost" type="button" data-act="add-option" '+(state.optionDraft.length>=6?'disabled':'')+'>＋ 新增選項</button></div>'+
 '<div class="field" id="correct-editor">'+correctEdit()+'</div>'+
 '<button class="btn primary" type="submit" style="width:100%">'+(q?'儲存修改':'加入題目清單')+'</button></form></section>';
}
function questionList() {
 if(!state.questions.length)return '<div class="empty">目前沒有題目。請先在上方新增，活動開始後就能發送給所有參加者。</div>';
 return state.questions.map(q=>{
 const st=statsFor(q.id),n=Number(st.total||0),counts=st.counts||[];
 const opts=q.options.map((v,i)=>resultBar(A[i]+". "+v,Number(counts[i]||0),n,i===q.correct_index)).join("");
 const controls='<div class="actions">'+
 (state.event.status==="open"&&q.status!=="open"?'<button class="btn small teal" data-act="activate" data-id="'+q.id+'">▶ 開放此題</button>':'')+
 (q.status==="open"?'<button class="btn small danger" data-act="close-question" data-id="'+q.id+'">■ 停止作答</button>':'')+
 (q.status==="draft"?'<button class="btn small" data-act="edit-question" data-id="'+q.id+'">編輯</button><button class="btn small ghost" data-act="delete-question" data-id="'+q.id+'">刪除</button>':'')+'</div>';
 return '<article class="question-card '+(q.status==="open"?'live':'')+'"><div class="question-top"><span class="mini-label">QUESTION '+String(q.position).padStart(2,"0")+'</span>'+badge(q.status)+'</div>'+
 '<h3>'+esc(q.prompt)+'</h3><div class="question-top"><span class="muted tiny">作答 '+fmt(n)+' 人 · 正確答案 '+A[q.correct_index]+'</span>'+controls+'</div>'+
 '<div class="divider"></div>'+opts+'</article>';
 }).join("");
}
function showEventUI() {
 const e=state.event; if(!e)return;
 document.body.classList.toggle("projector",state.projector);
 const url=activeUrl(e.code);
 const qr="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=9&data="+encodeURIComponent(url);
 const buttons=e.status==="draft"?'<button class="btn primary" data-act="start-event">▶ 開始活動</button>':
 e.status==="open"?'<button class="btn danger" data-act="end-event">■ 結束活動</button>':'';
 app.innerHTML=shell('<div class="head"><div><span class="eyebrow">LIVE EVENT CONTROL</span><h1>'+esc(e.title)+'</h1>'+
 '<p>'+esc(e.description||"出題、收集作答，讓所有人一起參與。")+'</p></div><div class="actions">'+badge(e.status)+
 '<button class="btn" data-act="project">'+(state.projector?'離開投影模式':'▣ 投影模式')+'</button>'+
 '<button class="btn ghost" data-act="refresh-event">↻ 更新</button></div></div>'+
 '<div class="room-banner"><div><div class="mini-label">JOIN CODE · 加入代碼</div><div class="room-code">'+esc(e.code)+'</div>'+
 '<p class="tiny" style="color:#c4d6f1">讓參加者掃描 QR Code，或輸入代碼加入。</p><div class="actions">'+
 '<button class="btn small" data-act="copy-code">複製代碼</button><button class="btn small" data-act="copy-link">複製加入連結</button>'+buttons+
 '<button class="btn small '+(e.show_results?'teal':'')+'" data-act="toggle-results">'+(e.show_results?'✓ 統計已公布':'公布已結束題目的統計')+'</button>'+
 '</div></div><img class="qr" src="'+esc(qr)+'" alt="活動加入 QR Code" loading="lazy"></div>'+
 '<div id="event-metrics">'+eventMetrics()+'</div><div class="grid2" style="margin-bottom:28px">'+composer()+
 '<section class="panel"><div class="section-title"><h2>現場管理提醒</h2><span class="badge good">自動同步</span></div>'+
 '<p>① 建立題目並指定正確答案。</p><p>② 按下「開始活動」，分享右上方的加入代碼。</p>'+
 '<p>③ 點選「開放此題」，參加者即可作答。</p><p>④ 停止作答後可以公布結果，也能切換投影模式。</p>'+
 '<div class="notice">每 3 秒更新統計。同一裝置同一題只接受第一次作答。已發佈題目不提供直接修改，避免統計失真。</div>'+
 '<p class="tiny">外部 QR 圖片服務無法連線時，請使用上方代碼與連結。</p></section></div>'+
 '<div class="section-title"><h2>題目與答案分布</h2><span class="muted tiny">依照題目順序排列，數字由伺服器彙總</span></div>'+
 '<div id="question-list">'+questionList()+'</div>',"event");
}
function readOptionDraft() {
 const inputs=[...document.querySelectorAll(".qoption")];
 if(inputs.length)state.optionDraft=inputs.map(x=>x.value);
 const correct=el("correct-select");if(correct)state.correctDraft=Number(correct.value);
}
function paintOptions() {
 const t=el("option-editor");if(t)t.innerHTML=optionsEdit();
 const c=el("correct-editor");if(c)c.innerHTML=correctEdit();
}
async function loadEvent(id,version=routeVersion) {
 if(!state.user){location.hash="#host";return;}
 loading("載入活動資料…");
 const [e,q,s]=await Promise.all([
  db.from("evq_events").select("*").eq("id",id).single(),
  db.from("evq_questions").select("*").eq("event_id",id).order("position",{ascending:true}),
  db.rpc("evq_host_statistics",{p_event_id:id})
 ]);
 if(version!==routeVersion)return;
 if(e.error||q.error||s.error){
  app.innerHTML=shell('<h1>無法開啟活動</h1><p>'+esc(errText(e.error||q.error||s.error))+'</p><a class="btn" href="#host">返回活動清單</a>',"host");return;
 }
 state.event=e.data;state.questions=q.data||[];state.stats=s.data;
 state.editing=null;state.optionDraft=["","","",""];state.correctDraft=0;
 showEventUI();
 timer=setInterval(refreshStats,3000);
}
async function refreshStats() {
 if(!state.event||!location.hash.startsWith("#event="))return;
 const id=state.event.id;
 const {data,error}=await db.rpc("evq_host_statistics",{p_event_id:id});
 if(error||state.event?.id!==id)return;
 state.stats=data;
 const m=el("event-metrics"),q=el("question-list");
 if(m)m.innerHTML=eventMetrics();
 if(q)q.innerHTML=questionList();
}
function guestNameKey(code){return "pulsequiz:name:"+code;}
function guestTokenKey(code){return "pulsequiz:token:"+code;}
function showJoin(code) {
 document.body.classList.remove("projector");
 app.innerHTML=header()+'<div class="guest-wrap"><div class="guest-heading"><span class="badge good">PARTICIPANT · 參加者</span>'+
 '<h1>加入現場互動</h1><p>只需要暱稱就能參加，不需註冊帳號。</p></div>'+
 '<div class="guest-card"><div class="mini-label">ACTIVITY CODE</div><div class="giant-code">'+esc(code)+'</div>'+
 '<form id="join-form">'+field("你的暱稱","guest-name","text","例如：小明",safeLocalGet(guestNameKey(code))||"")+
 '<button class="btn primary" type="submit" style="width:100%">進入活動 →</button></form>'+
 '<div class="notice">請使用同一支手機、同一個瀏覽器繼續活動。每題只計算首次送出的答案。</div></div></div>';
}
async function loadGuest(code,version=routeVersion,force=false) {
 state.guestCode=code;
 const tok=safeLocalGet(guestTokenKey(code));
 if(!tok){showJoin(code);return;}
 state.token=tok;
 if(!force)loading("正在加入活動…");
 const r=await db.rpc("evq_guest_state",{p_code:code,p_token:tok});
 if(version!==routeVersion)return;
 if(r.error) {
  if(/加入活動|找不到|身分|識別碼/i.test(errText(r.error))){state.token="";showJoin(code);}
  else {app.innerHTML=header()+'<div class="guest-wrap"><div class="panel center"><h2>目前無法連線</h2><p>'+esc(errText(r.error))+'</p>'+
  '<button class="btn" data-act="retry">重新整理</button></div></div>';}
  return;
 }
 const fresh=JSON.stringify(r.data);
 if(force&&fresh===JSON.stringify(state.guest))return;
 state.guest=r.data;
 showGuestUI();
 if(!timer)timer=setInterval(refreshGuest,3000);
}
async function refreshGuest() {
 if(!location.hash.startsWith("#join="))return;
 if(!state.token)return;
 const r=await db.rpc("evq_guest_state",{p_code:state.guestCode,p_token:state.token});
 if(r.error)return;
 if(JSON.stringify(r.data)!==JSON.stringify(state.guest)){state.guest=r.data;showGuestUI();}
}
function guestResult(q) {
 const total=(q.counts||[]).reduce((s,n)=>s+Number(n||0),0);
 return '<div class="results-list"><div class="result-header"><h2 style="margin:0">第 '+q.position+' 題的統計</h2>'+
 '<span class="badge">'+fmt(total)+' 人作答</span></div><h3 style="margin:15px 0">'+esc(q.prompt)+'</h3>'+
 q.options.map((o,i)=>resultBar(A[i]+". "+o,Number(q.counts[i]||0),total,i===q.correct_index)).join("")+'</div>';
}
function showGuestUI() {
 const snapshot=state.guest;if(!snapshot)return;
 document.body.classList.remove("projector");
 const ev=snapshot.event||{},qs=snapshot.questions||[];
 const open=ev.status==="open"?qs.find(q=>q.status==="open"):null;
 const closed=qs.filter(q=>q.status==="closed").sort((a,b)=>b.position-a.position);
 let content="";
 if(open){
  const answered=Number.isInteger(open.my_choice);
  content='<div class="guest-card"><div class="question-top"><span class="guest-number">QUESTION '+String(open.position).padStart(2,"0")+'</span>'+
  '<span class="badge good"><span class="dot"></span> 作答中</span></div><h2 class="guest-title">'+esc(open.prompt)+'</h2>'+
  '<div class="question-options">'+open.options.map((v,i)=>'<button class="choice '+(answered&&open.my_choice===i?"selected":"")+
  '" data-act="answer" data-id="'+open.id+'" data-choice="'+i+'" '+(answered?"disabled":"")+'><span class="letter">'+A[i]+'</span>'+
  '<span>'+esc(v)+'</span></button>').join("")+'</div>'+
  (answered?'<div class="notice success">✓ 已成功送出：選項 '+A[open.my_choice]+'。請等候主持人公布結果。</div>':
  '<p class="tiny" style="margin:5px 0 0">選擇後將直接送出，每題只能提交一次。</p>')+'</div>';
 }else{
  content='<div class="guest-card center"><div style="font-size:46px;margin-bottom:12px">'+(ev.status==="closed"?'🏁':'⌛')+'</div>'+
  '<h2>'+(ev.status==="closed"?'活動已結束':'等待主持人出題')+'</h2><p>'+(ev.status==="closed"?'感謝你參與今天的活動！':'主持人開放下一題時，畫面會自動更新。')+'</p>'+
  '<span class="badge"><span class="dot"></span> 3 秒自動檢查</span></div>';
 }
 const visible=ev.show_results?closed.filter(q=>Array.isArray(q.counts)):[];
 const history=visible.length?'<div class="results-list"><h2>已公布的答案與統計</h2>'+
 visible.map(q=>'<section class="question-card">'+guestResult(q)+'</section>').join("")+'</div>':
 (closed.length?'<div class="notice" style="margin-top:22px">主持人尚未公布答案統計，請稍候。</div>':"");
 app.innerHTML=header()+'<div class="guest-wrap"><div class="guest-heading"><span class="badge">'+esc(ev.code)+'</span>'+
 '<h1>'+esc(ev.title)+'</h1><p>歡迎，'+esc(snapshot.participant?.name)+'　·　'+(ev.status==="closed"?"活動已結束":"正在參與活動")+'</p></div>'+
 content+history+'</div>';
}
async function route() {
 const v=++routeVersion; clearInterval(timer);timer=null;
 state.event=null;
 const hash=decodeURIComponent(location.hash||"");
 if(hash.startsWith("#join=")){const code=capCode(hash.slice(6));if(!code){showHome();return;}await loadGuest(code,v);return;}
 if(hash.startsWith("#event=")){await loadEvent(hash.slice(7),v);return;}
 if(hash==="#host"){await showHost(v);return;}
 if(hash==="#join"){showHome();el("home-code")?.focus();return;}
 showHome();
}
async function run(btn,job) {
 if(btn?.disabled)return;
 if(btn)btn.disabled=true;
 try{await job();}catch(e){toast(errText(e),true);}finally{if(btn?.isConnected)btn.disabled=false;}
}
function must(result){if(result.error)throw result.error;return result.data;}
async function reloadEvent(){clearInterval(timer);timer=null;state.projector=state.projector;await loadEvent(state.event.id);}
document.addEventListener("submit",e=>{
 const form=e.target;if(!form.id)return;e.preventDefault();
 const btn=form.querySelector('[type="submit"]');
 run(btn,async()=>{
  if(form.id==="code-form"){const code=capCode(el("home-code").value);if(code.length<6)throw Error("請輸入六碼活動代碼");location.hash="#join="+code;}
  if(form.id==="auth-form"){
   const email=el("auth-email").value.trim(),password=el("auth-pass").value;
   if(password.length<6)throw Error("密碼至少需要 6 碼");
   if(form.dataset.signup==="true"){
    const data=must(await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname+"#host"}}));
    toast(data.session?"註冊成功，已登入後台":"註冊申請已送出，請依信箱指示驗證帳號");
    if(data.session){state.user=data.user;await route();}
   }else{
    const data=must(await db.auth.signInWithPassword({email,password}));
    state.user=data.user;await route();
   }
  }
  if(form.id==="new-event-form"){
   if(!state.user)throw Error("請先登入");
   const title=el("new-title").value.trim(),description=el("new-desc").value.trim();
   if(!title||title.length>100)throw Error("活動名稱需為 1～100 字");
   let added=null,last=null;
   for(let i=0;i<3;i++){
    const r=await db.from("evq_events").insert({owner_id:state.user.id,title,description}).select("id").single();
    if(!r.error){added=r.data;break;}last=r.error;
    if(!String(r.error.code||"").includes("23505"))break;
   }
   if(!added)throw last||Error("建立活動失敗");
   toast("活動建立成功");location.hash="#event="+added.id;
  }
  if(form.id==="question-form"){
   if(!state.event)throw Error("活動尚未載入");
   readOptionDraft();
   const text=el("q-prompt").value.trim(),opts=state.optionDraft.map(x=>x.trim());
   if(text.length<1||text.length>500)throw Error("題目內容需為 1～500 字");
   if(opts.length<2||opts.length>6||opts.some(x=>!x||x.length>120))throw Error("每個選項都需要 1～120 字（2～6 個選項）");
   if(!Number.isInteger(state.correctDraft)||state.correctDraft<0||state.correctDraft>=opts.length)throw Error("請選擇有效的正確答案");
   const payload={prompt:text,options:opts,correct_index:state.correctDraft};
   if(state.editing){
    must(await db.from("evq_questions").update(payload).eq("id",state.editing).eq("status","draft").select("id").single());
   }else{
    if(state.questions.length>=100)throw Error("單場活動最多 100 題");
    const used=new Set(state.questions.map(q=>q.position));
    let position=1;while(used.has(position)&&position<=100)position++;
    if(position>100)throw Error("活動題目位置已滿");
    must(await db.from("evq_questions").insert({...payload,event_id:state.event.id,position}).select("id").single());
   }
   toast("題目儲存成功");await reloadEvent();
  }
  if(form.id==="join-form"){
   const name=el("guest-name").value.trim(),code=state.guestCode;
   if(!name||name.length>40)throw Error("暱稱需為 1～40 字");
   const token=crypto.randomUUID();
   must(await db.rpc("evq_join",{p_code:code,p_name:name,p_token:token}));
   state.token=token;safeLocalSet(guestTokenKey(code),token);safeLocalSet(guestNameKey(code),name);
   toast("加入成功");await loadGuest(code,routeVersion);
  }
 });
});
document.addEventListener("click",e=>{
 const b=e.target.closest("[data-act]");if(!b)return;
 const action=b.dataset.act;
 run(b,async()=>{
  if(action==="signup-view"){showAuth(true);return;}
  if(action==="login-view"){showAuth(false);return;}
  if(action==="retry"){await route();return;}
  if(action==="logout"){must(await db.auth.signOut());state.user=null;state.event=null;location.hash="#host";await route();return;}
  if(action==="copy-code"||action==="copy-link"){
   const value=action==="copy-code"?state.event.code:activeUrl(state.event.code);
   if(!navigator.clipboard?.writeText)throw Error("瀏覽器不支援一鍵複製，請手動選取活動代碼");
   await navigator.clipboard.writeText(value);toast("已複製到剪貼簿");return;
  }
  if(action==="project"){state.projector=!state.projector;showEventUI();return;}
  if(action==="refresh-event"){await reloadEvent();return;}
  if(action==="add-option"){
   readOptionDraft();if(state.optionDraft.length>=6)return;
   state.optionDraft.push("");paintOptions();return;
  }
  if(action==="remove-option"){
   readOptionDraft();const index=Number(b.dataset.index);
   if(state.optionDraft.length<=2||!Number.isInteger(index))return;
   state.optionDraft.splice(index,1);
   if(state.correctDraft===index)state.correctDraft=0;
   else if(state.correctDraft>index)state.correctDraft--;
   paintOptions();return;
  }
  if(action==="cancel-edit"){state.editing=null;state.optionDraft=["","","",""];state.correctDraft=0;el("compose-panel").outerHTML=composer();return;}
  if(action==="edit-question"){
   const q=state.questions.find(x=>x.id===b.dataset.id);
   if(!q||q.status!=="draft")return;
   state.editing=q.id;state.optionDraft=[...q.options];state.correctDraft=q.correct_index;
   el("compose-panel").outerHTML=composer();el("compose-panel").scrollIntoView({behavior:"smooth",block:"start"});return;
  }
  if(action==="delete-question"){
   const q=state.questions.find(x=>x.id===b.dataset.id);
   if(!q||q.status!=="draft")return;
   if(!confirm("確定刪除這道尚未發佈的題目？"))return;
   must(await db.from("evq_questions").delete().eq("id",q.id).eq("status","draft"));
   toast("草稿題目已刪除");await reloadEvent();return;
  }
  if(action==="start-event"){
   must(await db.from("evq_events").update({status:"open"}).eq("id",state.event.id));
   toast("活動已開放，可分享代碼");await reloadEvent();return;
  }
  if(action==="end-event"){
   if(!confirm("確定結束活動嗎？結束後無法再接受作答。"))return;
   const open=state.questions.find(q=>q.status==="open");
   if(open)must(await db.from("evq_questions").update({status:"closed"}).eq("id",open.id));
   must(await db.from("evq_events").update({status:"closed"}).eq("id",state.event.id));
   toast("活動已結束");await reloadEvent();return;
  }
  if(action==="toggle-results"){
   const target=!state.event.show_results;
   must(await db.from("evq_events").update({show_results:target}).eq("id",state.event.id));
   toast(target?"已向參加者公布結束題目的統計":"已隱藏參加者統計");await reloadEvent();return;
  }
  if(action==="activate"){
   must(await db.rpc("evq_activate_question",{p_question_id:b.dataset.id}));
   toast("題目已開放，參加者畫面將自動更新");await reloadEvent();return;
  }
  if(action==="close-question"){
   must(await db.from("evq_questions").update({status:"closed"}).eq("id",b.dataset.id));
   toast("已停止接收此題答案");await reloadEvent();return;
  }
  if(action==="answer"){
   const q=state.guest?.questions?.find(x=>x.id===b.dataset.id);
   if(!q||q.status!=="open"||Number.isInteger(q.my_choice))return;
   const choice=Number(b.dataset.choice);
   if(!Number.isInteger(choice)||choice<0||choice>=q.options.length)return;
   const result=must(await db.rpc("evq_submit",{p_code:state.guestCode,p_token:state.token,
    p_question_id:q.id,p_choice:choice}));
   toast(result.accepted?"作答已送出！":"本題已作答，保留第一次答案");
   await loadGuest(state.guestCode,routeVersion,true);
  }
 });
});
window.addEventListener("hashchange",route);
db.auth.onAuthStateChange((_type,session)=>{state.user=session?.user||null;});
const init=await db.auth.getSession();
state.user=init.data?.session?.user||null;
route();
