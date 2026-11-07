/* 社会トレーニング（慶應中等部対策） — 端末内だけで動く学習アプリ */
(function(){
'use strict';
const KEY='keio-shakai-v1';
const EXAM=new Date('2027-02-03T08:30:00+09:00');
const K_STYLES=['知識カード','T1組合せ','T2並べ替え','T3正しくない','T4語群','T5地図','T6首相','T10字数','T13時事','T14福澤','T15数え上げ'];
const CAUSES=['知らなかった','忘れた','読み違えた','ひっかけ','計算ミス','時間切れ'];
const L1S=['歴史','地理','公民','生活文化','時事'];
let D={nodes:[],qs:[],byId:{},nodeById:{},profile:{}};
let S=null, SES=null, TIMER=null;
const $=s=>document.querySelector(s);
const app=()=>$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const addDays=(ds,n)=>{const d=new Date(ds+'T00:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pct=(a,b)=>b?Math.round(100*a/b):0;

/* ---------- 保存 ---------- */
function blank(){return{v:1,created:today(),settings:{newPerDay:10,mcqPerDay:8,pass:'0000'},nodes:{},qlog:{},log:{},causes:{},streak:{last:'',count:0},kr:{K:[0,0],R:[0,0]},intime:[0,0],mocks:[],kijutsu:{}}}
function load(){try{const s=localStorage.getItem(KEY);S=s?JSON.parse(s):blank()}catch(e){S=blank()}
  const b=blank();for(const k in b)if(S[k]===undefined)S[k]=b[k];}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

/* ---------- 間隔反復（SM-2を簡略化。速さも判定に使う） ---------- */
function nst(id){return S.nodes[id]}
function rateNode(id,grade,fast){
  const t=today();let n=S.nodes[id];
  if(!n){n=S.nodes[id]={reps:0,int:0,ease:2.3,due:t,lapses:0,first:t,last:t}}
  n.last=t;
  if(grade===0){n.lapses++;n.reps=0;n.int=0;n.ease=Math.max(1.3,n.ease-0.2);n.due=addDays(t,1);}
  else if(grade===1||!fast){n.int=Math.max(1,Math.round(n.int*1.2));n.ease=Math.max(1.3,n.ease-0.1);n.reps++;n.due=addDays(t,n.int);}
  else{n.int=n.reps===0?1:(n.reps===1?3:Math.round(Math.max(n.int,1)*n.ease));n.ease=Math.min(3,n.ease+0.05);n.reps++;n.due=addDays(t,n.int);}
}
function mastery(id){const n=S.nodes[id];if(!n)return 0;return Math.min(1,n.int/21)}
function isMastered(id){const n=S.nodes[id];return !!n&&n.int>=7}

/* ---------- 集計 ---------- */
function deckStats(){const m={};for(const n of D.nodes){(m[n.deck]=m[n.deck]||{deck:n.deck,L1:n.L1,n:0,sum:0,w:0,seen:0});const x=m[n.deck];x.n++;x.sum+=mastery(n.id);x.w+=n.pr*(1-mastery(n.id));if(S.nodes[n.id])x.seen++}return Object.values(m).map(x=>(x.m=x.sum/x.n,x))}
function l1Mastery(){const r={};for(const l of L1S){let s=0,w=0;for(const n of D.nodes)if(n.L1===l){s+=n.pr*mastery(n.id);w+=n.pr}r[l]=w?s/w:0}return r}
function estimate(){const share=D.profile.L1_share||{};const m=l1Mastery();let tot=0,sw=0;
  for(const l of L1S){const s=share[l]||0;sw+=s;tot+=s*m[l]}
  const base=sw?tot/sw:0;const kr=S.kr;const acc=(kr.K[1]+kr.R[1])>=20?(kr.K[0]+kr.R[0])/(kr.K[1]+kr.R[1]):base;
  return Math.round(50*(0.8*base+0.2*acc))}
function logDay(f){const t=today();const L=S.log[t]=S.log[t]||{n:0,ok:0,sec:0,est:0};f(L);L.est=estimate()}
function bumpStreak(){const t=today();if(S.streak.last===t)return;S.streak.count=(S.streak.last===addDays(t,-1))?S.streak.count+1:1;S.streak.last=t}
function daysLeft(){return Math.max(0,Math.ceil((EXAM-new Date())/86400000))}

/* ---------- メニュー作り ---------- */
function pickMcq(n,filter){
  const t=today();const pool=D.qs.filter(q=>q.kind==='mcq'&&(!filter||filter(q)));
  const score=q=>{const l=S.qlog[q.id];let s=Math.random();if(!l)s+=1;else{if(!l.ok)s+=2;if(l.last&&l.last>addDays(t,-5)&&l.ok)s-=3}
    if(q.nodes.some(id=>S.nodes[id]))s+=0.8;return s};
  return pool.map(q=>[score(q),q]).sort((a,b)=>b[0]-a[0]).slice(0,n).map(x=>x[1]);
}
function cardOf(id){return D.byId['c-'+id]}
function buildDaily(){
  const t=today(),st=S.settings;
  const due=D.nodes.filter(n=>S.nodes[n.id]&&S.nodes[n.id].due<=t).sort((a,b)=>S.nodes[a.id].due<S.nodes[b.id].due?-1:1).slice(0,30).map(n=>cardOf(n.id));
  const fresh=D.nodes.filter(n=>!S.nodes[n.id]).sort((a,b)=>b.pr-a.pr||Math.random()-.5);
  const nw=[];const decks={};for(const n of fresh){if(nw.length>=st.newPerDay)break;if((decks[n.deck]||0)>=2)continue;decks[n.deck]=(decks[n.deck]||0)+1;nw.push(cardOf(n.id))}
  const mA=pickMcq(Math.ceil(st.mcqPerDay*0.5),q=>!q.gen);
  const mC=pickMcq(Math.ceil(st.mcqPerDay*0.25),q=>q.gen==='chrono');
  const mT=pickMcq(Math.max(1,Math.floor(st.mcqPerDay*0.25)),q=>q.gen==='tz');
  const kj=D.qs.filter(q=>q.kind==='kijutsu').sort((a,b)=>(S.kijutsu[a.id]||'')<(S.kijutsu[b.id]||'')?-1:1)[0];
  const cards=shuffle(due.concat(nw)),mcq=shuffle(mA.concat(mC,mT));
  const out=[];let ci=0,mi=0;
  while(ci<cards.length||mi<mcq.length){for(let k=0;k<3&&ci<cards.length;k++)out.push(cards[ci++]);if(mi<mcq.length)out.push(mcq[mi++])}
  if(kj)out.push(kj);
  return out.filter(Boolean);
}
function buildDeck(deck){const ns=D.nodes.filter(n=>n.deck===deck);const ids=new Set(ns.map(n=>n.id));
  const cards=shuffle(ns.map(n=>cardOf(n.id)));const m=D.qs.filter(q=>q.kind==='mcq'&&!q.gen&&q.nodes.some(i=>ids.has(i)));
  const out=[];let mi=0;cards.forEach((c,i)=>{out.push(c);if(i%3===2&&mi<m.length)out.push(m[mi++])});while(mi<m.length)out.push(m[mi++]);return out.slice(0,30)}
function buildWeak(){const ids=Object.keys(S.nodes).filter(id=>D.nodeById[id]).sort((a,b)=>(S.nodes[b].lapses-S.nodes[a].lapses)||(S.nodes[a].int-S.nodes[b].int)).slice(0,20);
  const m=pickMcq(6,q=>q.nodes.some(i=>ids.includes(i))||(S.qlog[q.id]&&!S.qlog[q.id].ok));return shuffle(ids.map(cardOf).concat(m))}
function buildMock(){const a=pickMcq(9,q=>!q.gen),c=pickMcq(3,q=>q.gen==='chrono'),t=pickMcq(3,q=>q.gen==='tz');return shuffle(a.concat(c,t))}

/* ---------- 画面：ホーム ---------- */
function home(){
  clearInterval(TIMER);SES=null;
  const t=today();const dueN=D.nodes.filter(n=>S.nodes[n.id]&&S.nodes[n.id].due<=t).length;
  const seen=Object.keys(S.nodes).length,mast=D.nodes.filter(n=>isMastered(n.id)).length;
  const ds=deckStats().sort((a,b)=>L1S.indexOf(a.L1)-L1S.indexOf(b.L1));
  const decks=[...new Set(D.nodes.map(n=>n.deck))];
  app().innerHTML=`
  <div class="top"><div><h1>社会トレーニング</h1><div class="sub">慶應中等部 2027年度入試に向けて</div></div>
  <div class="count"><span>本番まで</span><b>${daysLeft()}</b><span>日</span></div></div>
  <div class="stats"><div class="stat"><b>${S.streak.count}</b><span>連続日数</span></div>
  <div class="stat"><b>${mast}</b><span>覚えた知識 / ${D.nodes.length}</span></div>
  <div class="stat"><b>${dueN}</b><span>今日の復習</span></div></div>
  <button class="btn" id="go-daily">今日のメニューを始める</button>
  <div class="grid">
   <button class="btn sec" id="go-mock">ミニ模試<small>10分・15問・50点換算</small></button>
   <button class="btn sec" id="go-weak">苦手だけ<small>まちがえた知識を集中</small></button>
   <button class="btn sec" id="go-tz">時差の練習<small>サマータイムも</small></button>
   <button class="btn sec" id="go-chrono">年代の並べ替え<small>○番目を答える</small></button>
   <button class="btn sec" id="go-jiji">2026年の時事<small>2027年入試の予想</small></button>
   <button class="btn sec" id="go-kj">記述の練習<small>20〜50字</small></button>
  </div>
  <h2>知識マップ（タップで練習）</h2>
  <div class="map">${ds.map(x=>`<button class="cell" data-deck="${esc(x.deck)}">${esc(x.deck)}<span class="sub"> ${x.seen}/${x.n}</span><i><u style="width:${Math.round(x.m*100)}%"></u></i></button>`).join('')}</div>
  <button class="btn ghost" id="go-parent">保護者の画面</button>
  <div class="note">学習の記録はこの端末の中だけに保存されます。</div>`;
  $('#go-daily').onclick=()=>start('今日のメニュー',buildDaily(),'daily');
  $('#go-mock').onclick=()=>start('ミニ模試',buildMock(),'mock');
  $('#go-weak').onclick=()=>{const w=buildWeak();w.length?start('苦手だけ',w,'weak'):alert('まだ苦手の記録がありません。まず今日のメニューをやってみよう。')};
  $('#go-tz').onclick=()=>start('時差の練習',pickMcq(10,q=>q.gen==='tz'),'tz');
  $('#go-chrono').onclick=()=>start('年代の並べ替え',pickMcq(10,q=>q.gen==='chrono'),'chrono');
  $('#go-jiji').onclick=()=>start('2026年の時事',buildDeck('時事').concat(pickMcq(6,q=>q.style==='T13時事')),'jiji');
  $('#go-kj').onclick=()=>start('記述の練習',shuffle(D.qs.filter(q=>q.kind==='kijutsu')).slice(0,3),'kj');
  $('#go-parent').onclick=parentGate;
  document.querySelectorAll('.cell').forEach(b=>b.onclick=()=>start(b.dataset.deck,buildDeck(b.dataset.deck),'deck'));
}

/* ---------- 学習セッション ---------- */
function start(title,items,mode){
  if(!items.length){alert('出せる問題がありません');return}
  SES={title,items:items.slice(),i:0,mode,ok:0,n:0,t0:0,res:[],grown:{},mockStart:Date.now(),inserted:new Set(items.map(q=>q.id))};
  if(mode==='mock'){clearInterval(TIMER);TIMER=setInterval(()=>{const r=600-Math.floor((Date.now()-SES.mockStart)/1000);const el=$('#mock-t');if(el)el.textContent=`残り ${Math.max(0,Math.floor(r/60))}:${String(Math.max(0,r%60)).padStart(2,'0')}`;if(r<=0){clearInterval(TIMER);finish()}},1000)}
  show();
}
function header(q){const p=Math.round(100*SES.i/SES.items.length);
  return `<div class="qhead"><button class="btn ghost" style="width:auto;margin:0;min-height:36px" id="quit">← やめる</button><span>${esc(SES.title)} ${SES.i+1}/${SES.items.length}</span><span id="mock-t"></span></div><div class="bar"><u style="width:${p}%"></u></div><span class="tag">${esc(q.L1||'')}</span><span class="tag">${esc(q.style)}</span>`}
function bindQuit(){$('#quit').onclick=()=>{if(confirm('やめますか？ここまでの記録は保存されます。')){save();home()}}}
function startTimer(sec){SES.t0=Date.now();clearInterval(SES.tm);SES.tm=setInterval(()=>{const el=$('.timer');if(!el)return;const e=(Date.now()-SES.t0)/1000;el.querySelector('u').style.width=Math.max(0,100-100*e/sec)+'%';if(e>sec)el.classList.add('over')},200)}
function elapsed(){return (Date.now()-SES.t0)/1000}
function show(){
  if(SES.i>=SES.items.length)return finish();
  const q=SES.items[SES.i];window.scrollTo(0,0);
  if(q.kind==='card')return showCard(q);if(q.kind==='mcq')return showMcq(q);return showKij(q);
}
function next(){clearInterval(SES.tm);SES.i++;save();show()}
function insertSoon(list){for(const q of list){if(!q||SES.inserted.has(q.id))continue;SES.inserted.add(q.id);SES.items.splice(Math.min(SES.items.length,SES.i+3),0,q)}}

function showCard(q){
  const n=D.nodeById[q.nodes[0]];
  app().innerHTML=header(q)+`<div class="qcard">${esc(q.stem)}<div class="timer"><u></u></div></div>
   <button class="btn" id="rev">答えを見る</button>`;bindQuit();startTimer(8);
  $('#rev').onclick=()=>{const sec=elapsed();clearInterval(SES.tm);
    app().innerHTML=header(q)+`<div class="qcard">${esc(q.stem)}<div class="answer">${esc(q.answer_text)}</div>
     <div class="exp">${esc(q.exp)}${q.mn?`<div class="mn">覚え方：${esc(q.mn)}</div>`:''}</div><div class="note">考えた時間 ${sec.toFixed(1)}秒（目標8秒）</div></div>
     <div class="rate"><button class="btn b0" data-g="0">わからない</button><button class="btn b1" data-g="1">あやしい</button><button class="btn b2" data-g="2">わかった</button></div>`;bindQuit();
    document.querySelectorAll('.rate .btn').forEach(b=>b.onclick=()=>{const g=+b.dataset.g;const fast=sec<=8;
      rateNode(n.id,g,fast);SES.n++;if(g===2)SES.ok++;S.kr.K[1]++;if(g===2)S.kr.K[0]++;S.intime[1]++;if(fast)S.intime[0]++;
      if(g===2&&fast)SES.grown[n.deck]=(SES.grown[n.deck]||0)+1;
      if(g===0){SES.items.splice(Math.min(SES.items.length,SES.i+5),0,q);insertSoon(n.set.slice(0,2).map(cardOf))}
      logDay(L=>{L.n++;if(g===2)L.ok++;L.sec+=sec});next()})}
}
function showMcq(q){
  const mock=SES.mode==='mock';
  app().innerHTML=header(q)+`<div class="qcard">${esc(q.stem)}<div class="timer"><u></u></div></div>
   ${q.choices.map((c,i)=>`<button class="choice" data-i="${i}"><b>${i+1}</b>${esc(c)}</button>`).join('')}`;bindQuit();startTimer(q.sec||40);
  document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{
    const sec=elapsed();clearInterval(SES.tm);const pick=+b.dataset.i,ok=pick===q.answer,fast=sec<=(q.sec||40);
    const isK=K_STYLES.includes(q.style);const kr=S.kr[isK?'K':'R'];kr[1]++;if(ok)kr[0]++;S.intime[1]++;if(ok&&fast)S.intime[0]++;
    const l=S.qlog[q.id]=S.qlog[q.id]||{n:0,c:0};l.n++;if(ok)l.c++;l.ok=ok;l.last=today();
    SES.n++;if(ok)SES.ok++;SES.res.push({q:q.id,ok,sec,L1:q.L1});
    for(const id of q.nodes){if(!ok)rateNode(id,0,false);else if(S.nodes[id]&&S.nodes[id].due<=today())rateNode(id,fast?2:1,fast)}
    logDay(L=>{L.n++;if(ok)L.ok++;L.sec+=sec});
    if(mock){save();return next()}
    document.querySelectorAll('.choice').forEach((x,i)=>{x.disabled=true;if(i===q.answer)x.classList.add('ok');else if(i===pick)x.classList.add('ng')});
    const trap=!ok&&q.traps&&q.traps[pick]&&q.traps[pick]!=='-'?`<div class="trap">${q.gen?'ポイント':'あなたが選んだ答え'}：${esc(q.traps[pick])}</div>`:'';
    const box=document.createElement('div');
    box.innerHTML=`<div class="exp"><b>${ok?(fast?'正解！':'正解（もう少し速く）'):'ざんねん'}</b> ${sec.toFixed(0)}秒／目標${q.sec}秒<br>${esc(q.exp)}${trap}</div>`+
     (ok?`<button class="btn" id="nx">次へ</button>`:`<div class="sub">まちがえた原因はどれ？</div><div class="cause">${CAUSES.map(c=>`<button class="btn" data-c="${c}">${c}</button>`).join('')}</div>`);
    app().appendChild(box);
    if(ok)$('#nx').onclick=next;
    else document.querySelectorAll('.cause .btn').forEach(x=>x.onclick=()=>{const c=x.dataset.c;S.causes[c]=(S.causes[c]||0)+1;followUp(q,c);next()});
  });
}
function followUp(q,c){
  const cards=q.nodes.map(cardOf);
  if(c==='知らなかった'||c==='忘れた'||c==='時間切れ'){insertSoon(cards);if(c!=='時間切れ')for(const id of q.nodes){const n=D.nodeById[id];if(n)insertSoon(n.set.slice(0,1).map(cardOf))}}
  else if(c==='ひっかけ'||c==='読み違えた'){const alt=pickMcq(1,x=>x.style===q.style&&!SES.inserted.has(x.id));insertSoon(alt.concat(cards.slice(0,1)));
    if(c==='読み違えた')alert('コツ：「正しくないもの」「すべて」「2番目と4番目」など、問いの言葉に○をつけてから選ぼう。')}
  else if(c==='計算ミス'){insertSoon(pickMcq(1,x=>x.gen===q.gen&&!SES.inserted.has(x.id)))}
}
function showKij(q){
  app().innerHTML=header(q)+`<div class="qcard">${esc(q.stem)}<div class="note">字数：${esc(q.limit)}</div></div>
   <textarea id="ta" placeholder="ここに書こう（紙に書いてもOK）"></textarea><div class="note" id="cnt">0字</div>
   <button class="btn" id="chk">模範解答と比べる</button>`;bindQuit();SES.t0=Date.now();
  const ta=$('#ta');ta.oninput=()=>{$('#cnt').textContent=ta.value.replace(/\s/g,'').length+'字'};
  $('#chk').onclick=()=>{const mine=ta.value;
    app().innerHTML=header(q)+`<div class="qcard">${esc(q.stem)}</div>${mine?`<div class="exp">あなたの答え：${esc(mine)}</div>`:''}
     <div class="exp"><b>模範解答</b><br>${esc(q.model)}</div><div class="sub">入っている要素にチェック</div>
     ${q.points.map((p,i)=>`<label class="chk"><input type="checkbox" data-i="${i}">${esc(p)}</label>`).join('')}
     <button class="btn" id="done">記録して次へ</button>`;bindQuit();
    $('#done').onclick=()=>{const got=document.querySelectorAll('.chk input:checked').length;const ok=got===q.points.length;
      S.kr.R[1]++;if(ok)S.kr.R[0]++;S.kijutsu[q.id]=today();SES.n++;if(ok)SES.ok++;
      if(!ok)for(const id of q.nodes)rateNode(id,1,false);logDay(L=>{L.n++;if(ok)L.ok++});next()}}
}
function finish(){
  clearInterval(TIMER);clearInterval(SES&&SES.tm);if(!SES)return home();
  bumpStreak();const est=estimate();logDay(()=>{});
  let mockHtml='';
  if(SES.mode==='mock'){const total=SES.items.length;const sc=Math.round(50*SES.ok/total);S.mocks.push({d:today(),sc,ok:SES.ok,n:total});
    mockHtml=`<div class="big">${sc}<span style="font-size:18px">点 / 50点</span></div><div class="sub">${SES.ok}/${total}問正解（${SES.n}問に解答）・本番の配点に換算（推定）</div>
     <h2>答え合わせ</h2>${SES.res.map((r,i)=>{const q=D.byId[r.q];return `<div class="exp">${r.ok?'○':'×'} ${i+1}. ${esc(q.stem.slice(0,60))}…<br><b>正解：${esc(q.choices[q.answer])}</b><br>${esc(q.exp)}</div>`}).join('')}`}
  const grown=Object.entries(SES.grown).sort((a,b)=>b[1]-a[1]).slice(0,4);
  save();
  app().innerHTML=`<div class="end"><h1>おつかれさま！</h1>${mockHtml||`<div class="big">${SES.ok}<span style="font-size:18px"> / ${SES.n}</span></div>`}
   <div class="sub">連続 ${S.streak.count}日 ・ 本番での推定点 ${est}点 / 50点</div>
   ${grown.length?`<h2>今日のびた分野</h2><div>${grown.map(([d,n])=>`<span class="tag">${esc(d)} +${n}</span>`).join('')}</div>`:''}</div>
   <button class="btn" id="hm">ホームへ</button>`;
  $('#hm').onclick=home;
}

/* ---------- 保護者の画面 ---------- */
function parentGate(){
  app().innerHTML=`<h1>保護者の画面</h1><p class="sub">パスコードを入れてください（はじめは 0000）</p>
   <input type="password" inputmode="numeric" id="pw" autocomplete="off"><button class="btn" id="ok">開く</button><button class="btn ghost" id="bk">戻る</button>`;
  $('#bk').onclick=home;$('#ok').onclick=()=>{$('#pw').value===S.settings.pass?parent():alert('ちがいます')};
}
function color(m,seen){if(!seen)return '#b9b4a8';const h=Math.round(5+m*130);return `hsl(${h},55%,${45-m*8}%)`}
function parent(){
  const ds=deckStats();const lm=l1Mastery();const est=estimate();
  const top=ds.slice().sort((a,b)=>b.w-a.w).slice(0,5);
  const days=Object.keys(S.log).sort().slice(-30);const ests=days.map(d=>S.log[d].est||0);
  const cz=CAUSES.map(c=>[c,S.causes[c]||0]);const czT=cz.reduce((a,b)=>a+b[1],0);
  const spark=ests.length>1?`<svg class="spark" viewBox="0 0 300 80" preserveAspectRatio="none"><polyline fill="none" stroke="#1f3a5f" stroke-width="2" points="${ests.map((v,i)=>`${(i/(ests.length-1))*300},${80-v/50*76}`).join(' ')}"/></svg><div class="note">${days[0]} 〜 ${days[days.length-1]}（縦軸 0〜50点）</div>`:'<div class="note">記録が2日分たまると表示されます</div>';
  app().innerHTML=`<h1>保護者の画面</h1>
  <div class="stats"><div class="stat"><b>${est}</b><span>本番の推定点/50</span></div><div class="stat"><b>${pct(S.kr.K[0],S.kr.K[1])}%</b><span>知識問題の正答率</span></div><div class="stat"><b>${pct(S.kr.R[0],S.kr.R[1])}%</b><span>思考問題の正答率</span></div></div>
  <div class="stats"><div class="stat"><b>${pct(S.intime[0],S.intime[1])}%</b><span>時間内に正解</span></div><div class="stat"><b>${Object.keys(S.nodes).length}</b><span>学習した知識</span></div><div class="stat"><b>${S.mocks.length?S.mocks[S.mocks.length-1].sc:'-'}</b><span>直近のミニ模試</span></div></div>
  <h2>推定点の推移</h2>${spark}
  <h2>分野ごとの習得度</h2><table>${L1S.map(l=>`<tr><td>${l}</td><td>${Math.round(lm[l]*100)}%</td><td class="note">配点比 ${(D.profile.L1_share||{})[l]||0}%</td></tr>`).join('')}</table>
  <h2>単元ヒートマップ</h2><div class="hm">${ds.map(x=>`<div style="background:${color(x.m,x.seen)}">${esc(x.deck)}<br>${Math.round(x.m*100)}%</div>`).join('')}</div>
  <h2>今週の優先単元トップ5</h2><table>${top.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.deck)}（${x.L1}）</td><td class="note">未習得×重要度 ${x.w.toFixed(1)}</td></tr>`).join('')}</table>
  <h2>まちがいの原因</h2><table>${cz.map(([c,n])=>`<tr><td>${c}</td><td>${n}回</td><td>${pct(n,czT)}%</td></tr>`).join('')}</table>
  <h2>ミニ模試の記録</h2><table>${S.mocks.slice(-8).reverse().map(m=>`<tr><td>${m.d}</td><td>${m.sc}点</td><td class="note">${m.ok}/${m.n}</td></tr>`).join('')||'<tr><td class="note">まだありません</td></tr>'}</table>
  <h2>設定</h2>
  <div class="row"><label>新しい知識/日<input type="number" id="s-new" value="${S.settings.newPerDay}" min="0" max="40"></label><label>問題/日<input type="number" id="s-mcq" value="${S.settings.mcqPerDay}" min="0" max="30"></label></div>
  <label>パスコードの変更<input type="text" inputmode="numeric" id="s-pass" value="${esc(S.settings.pass)}"></label>
  <button class="btn sec" id="s-save">設定を保存</button>
  <h2>バックアップ</h2><button class="btn sec" id="ex">記録を書き出す（JSON）</button>
  <label class="btn sec" style="text-align:center">記録を読みこむ<input type="file" id="im" accept="application/json" style="display:none"></label>
  <button class="btn ghost" id="rs" style="color:var(--bad)">記録をすべて消す</button>
  <div class="note">推定点＝分野ごとの習得度（重要度で重みづけ）を過去10年の配点比で合計し、最近の正答率と合わせて50点に換算したもの。試験時間25分・50点は推定。</div>
  <button class="btn" id="bk">ホームへ</button>`;
  $('#bk').onclick=home;
  $('#s-save').onclick=()=>{S.settings.newPerDay=Math.max(0,+$('#s-new').value||0);S.settings.mcqPerDay=Math.max(0,+$('#s-mcq').value||0);const p=$('#s-pass').value.trim();if(p)S.settings.pass=p;save();alert('保存しました')};
  $('#ex').onclick=()=>{const b=new Blob([JSON.stringify(S)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`shakai-record-${today()}.json`;document.body.appendChild(a);a.click();a.remove()};
  $('#im').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!o.nodes||!o.settings)throw 0;S=o;save();alert('読みこみました');parent()}catch(x){alert('このファイルは読みこめません')}};r.readAsText(f)};
  $('#rs').onclick=()=>{if(confirm('本当にすべての記録を消しますか？')&&confirm('元に戻せません。消しますか？')){S=blank();save();home()}};
}

/* ---------- 起動 ---------- */
async function boot(){
  load();
  try{
    const [k,q]=await Promise.all([fetch('./data/knowledge.json').then(r=>r.json()),fetch('./data/questions.json').then(r=>r.json())]);
    D.nodes=k.nodes;D.qs=q.questions;D.profile=q.profile;
    for(const n of D.nodes)D.nodeById[n.id]=n;for(const x of D.qs)D.byId[x.id]=x;
    home();
  }catch(e){app().innerHTML='<p>データを読みこめませんでした。通信できる場所で開き直してください。</p>'}
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
}
boot();
})();
