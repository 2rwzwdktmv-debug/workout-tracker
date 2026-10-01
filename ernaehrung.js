/* =====================================================================
   Ernährung · Modul der Ultimate Engine App (Phase 1, 01.10.2026)
   Code ist öffentlich, Inhalte (Gerichte, Rezepte, Glossar) kommen aus
   nutrition.json im privaten Daten-Repo (geladen wie data.json → EN.load).
   Nutzt den Trainingsplan der App (projectPlan, dayMinutes, dayTitle …).
   Speichern: Mahlzeiten, Trinken, Energie, Einstellungen → S.food (progress.json);
   Haut, Ausnahmen, Heißhunger, Gewicht, Heilungsfenster → nur lokal (wt-health-v1).
   ===================================================================== */
(function () {
"use strict";
const EN = window.EN = {};

/* ---------- Grundwerte ---------- */
const TL=['Ruhetag','Aktiver Tag','Trainingstag','Harter Tag'];
const mk=(p,c,f)=>({p,c,f,kcal:Math.round(4*p+4*c+9*f)});
const MON=['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sep.','Okt.','Nov.','Dez.'];
const D_=k=>new Date(k+'T12:00:00');
const OKT=k=>{const d=typeof k==='string'?D_(k):k;return d.getDate()+'. '+MON[d.getMonth()];};
const addD=(k,n)=>dkey(addDays(D_(k),n));
const diff=(a,b)=>Math.round((D_(a)-D_(b))/864e5);
const BED='22:00', DINNER_BY='20:30';

/* ---------- Zustand ---------- */
/* Synchronisiert (progress.json): S.food = {days:{datum:{st,sw,extra,water,energy,meds,packed}}, set:{protein,fast}} */
function FS(){if(!S.food||typeof S.food!=='object')S.food={};if(!S.food.days)S.food.days={};if(!S.food.set)S.food.set={protein:'whey',fast:true};return S.food;}
/* Nur lokal auf diesem Gerät (Gesundheitsdaten): Haut, Ausnahmen, Heißhunger, Gewicht, Heilungsfenster */
const HKEY='wt-health-v1';
let H={days:{},HW:{active:false,start:'',len:7}};
try{const x=JSON.parse(localStorage.getItem(HKEY)||'null');if(x)H=Object.assign(H,x);}catch(e){}
const HF={exc:[],skin:0,crave:-1,weight:0}, SF={st:{},sw:{},extra:[],water:0,energy:0,energyAsked:false,meds:{},packed:false};
const cl=v=>typeof v==='object'?JSON.parse(JSON.stringify(v)):v;
/* Ein Tag als ein Objekt; jedes Feld liegt im passenden Speicher */
function NS(k){return new Proxy({},{
  get(_,p){const loc=p in HF?(H.days[k]||(H.days[k]={})):(FS().days[k]||(FS().days[k]={}));const def=p in HF?HF[p]:SF[p];
    if(loc[p]===undefined){if(def===undefined)return undefined;if(typeof def!=='object')return def;loc[p]=cl(def);}return loc[p];},
  set(_,p,v){const loc=p in HF?(H.days[k]||(H.days[k]={})):(FS().days[k]||(FS().days[k]={}));loc[p]=v;return true;},
  deleteProperty(_,p){const loc=p in HF?H.days[k]:FS().days[k];if(loc)delete loc[p];return true;}});}
/* leere Einträge nicht mitspeichern */
const isEmpty=v=>v==null||v===false||v===0||(Array.isArray(v)&&!v.length)||(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length);
function prune(days,defs){Object.keys(days).forEach(k=>{const d=days[k];Object.keys(d).forEach(p=>{if(isEmpty(d[p])||d[p]===defs[p])delete d[p];});if(!Object.keys(d).length)delete days[k];});}
const save=()=>{prune(H.days,HF);prune(FS().days,SF);try{localStorage.setItem(HKEY,JSON.stringify(H));}catch(e){}};
EN.save=save;
const ST={get protein(){return FS().set.protein;},set protein(v){FS().set.protein=v;},get fast(){return FS().set.fast!==false;},set fast(v){FS().set.fast=v;}};
let HW=H.HW;
const hwDay=k=>HW.active&&k>=HW.start&&diff(k,HW.start)<HW.len?diff(k,HW.start)+1:0;
const hwEnd=()=>addD(HW.start,HW.len-1);
const plantProt=k=>!!hwDay(k)||ST.protein==='plant';
const P_=(t,k)=>String(t).replace(/\{PROT\}/g,PROT(k));
const PROT=k=>plantProt(k)?'Erbsenprotein':'Whey';

/* ---------- Inhalte (aus nutrition.json) ---------- */
let hwLen=7;
let SUP={names:'',pack:null},PACK={food:[],other:[],training:null},SOS=[];
let C=null,TT={},V={},G={},ALT={},SL={},AT={},EXC=[],XTRA=[],BASIS=[],AB_ROT={},VMR={},GROUPS={},HWR={rules:[],defaultDays:7};
EN.ready=()=>!!C;
EN.load=function(json){try{C=json;TT=C.targets;SL=C.slots;AT=C.at;ALT=C.alt;BASIS=C.basis||[];GROUPS=C.groups||{};HWR=C.hw||HWR;
  AB_ROT=C.rotation.ab;VMR=C.rotation.vm;hwLen=HWR.defaultDays||7;
  V={};Object.keys(C.dishes).forEach(k=>{const X=C.dishes[k];V[k]=Object.assign({},X,{d:i=>X.d[i],ing:(i,kk)=>X.ing[i].map(r=>[P_(r[0],kk),r[1],r[2]]),steps:kk=>X.steps.map(t=>P_(t,kk))});});
  G={};Object.keys(C.glossary).forEach(k=>{G[k]={n:C.glossary[k].n,t:kk=>P_(C.glossary[k].t,kk)};});
  SUP=C.supplements||SUP;PACK=C.pack||PACK;SOS=C.sos||[];
  EXC=C.exceptions.map(e=>[e.n,e.c,e.s,mk(e.p,e.cc,e.f)]);XTRA=C.extras.map(e=>[e.n,mk(e.p,e.c,e.f)]);
}catch(e){C=null;console.error('nutrition.json',e);}};
const SIZE={klein:.6,normal:1,'groß':1.5};

/* ---------- Tage aus dem echten Trainingsplan ---------- */
/* Tagestyp: aus der Minuten-Schätzung der Plan-Einheit (dayMinutes). Vorlage: nach Wochentag. */
const WDL=['So','Mo','Di','Mi','Do','Fr','Sa'];
let PP=null;
EN.fresh=()=>{PP=null;};
function plan(){if(!PP){PP={};try{projectPlan(8).forEach(e=>{PP[e.k]=e;});}catch(e){}}return PP;}
const TODAY=()=>dkey(today0());
function dayOf(k){const e=plan()[k]||{kind:'empty'},w=D_(k).getDay();
  const isT=e.kind==='train'||e.kind==='donetoday',min=e.d?dayMinutes(e.d.day):0;
  const type=!isT?'rest':min>=120?'hard':min>=45?'train':'active';
  const D={k,wd:WDL[w],e,min,type,off:e.kind==='off',done:e.kind==='donetoday',train:isT?(e.d?dayTitle(e.d):'Training'):null,len:min?'≈ '+min+' min':''};
  const ab=AB_ROT[w],vm=VMR[w]||VMR.other;
  D.fast=!!ST.fast&&w>=1&&w<=5;   /* Werktags-Fasten: erste Mahlzeit mittags */
  const VM=D.fast?[]:[['vm',vm,'work']],RC=D.fast?['rc','recovShake','gym']:['rc','recov','gym'];
  if(w>=1&&w<=4){D.tpl='Werktag';D.work='7–17';D.slots=[...VM,['mi','oats','work'],['na','pre','work'],...(D.train?[['T'],RC]:[]),['ab',ab,'home']];}
  else if(w===5){D.tpl='Freitag';D.work='7–12';D.slots=[...VM,['mi','oats','home','zuhause'],['na','pre','home',D.train?'1–2 h vor dem Training':'wann es passt'],...(D.train?[['T'],...(D.fast?[RC]:[])]:[]),['ab',ab,'home']];}
  else if(D.train){D.tpl='Wochenende';D.slots=[['vor','preWE','home'],['T'],['fr','brunch','home'],['we','weLunch','home'],['wn','weSnack','home'],['ab',ab,'home','bis ~'+DINNER_BY]];}
  else{D.tpl='Wochenende';D.slots=[['br','brunch','home'],['we','weLunch','home'],['wn','weSnack','home'],['ab',ab,'home','bis ~'+DINNER_BY]];}
  return D;}
const ti=D=>TT[D.type].i;
const mac=(v,i)=>mk(V[v].P[i],V[v].C[i],V[v].F[i]);
const varOf=(D,id)=>{const s=D.slots.find(x=>x[0]===id);return NS(D.k).sw[id]||s[1];};
const shown=D=>D.slots.filter(s=>!(s[0]==='rc'&&ti(D)<3&&!D.fast));
/* Portion pro Mahlzeit: im Fasten-Fenster eine Stufe größer (Vormittag fällt weg) */
const pix=(D,id)=>D.fast&&['mi','na','ab'].includes(id)?Math.min(ti(D)+1,3):ti(D);
const slotWhen=(D,s)=>{if(s[3])return s[3];if(!D.train){if(s[0]==='na')return 'wann es passt';if(s[0]==='ab')return 'bis ~'+DINNER_BY;}return SL[s[0]][1];};
const mealIds=D=>shown(D).filter(s=>s[0]!=='T').map(s=>s[0]);
const mealDone=(D,id)=>!!NS(D.k).st[id]||!!NS(D.k).exc.find(e=>e.slot===id);
function nextMeal(D){const ids=mealIds(D);let last=-1;ids.forEach((id,n)=>{if(mealDone(D,id))last=n;});const n=ids.findIndex((id,j)=>j>last&&!mealDone(D,id));return n<0?null:ids[n];}
function addonSlot(D){const ids=mealIds(D);return ['mi','we','fr','br'].find(x=>ids.includes(x));}
function totals(D){const s=NS(D.k),i=ti(D);let t={kcal:0,p:0,c:0,f:0};const add=(m,f)=>{t.kcal+=m.kcal*f;t.p+=m.p*f;t.c+=m.c*f;t.f+=m.f*f;};
  for(const id of mealIds(D)){if(s.exc.find(e=>e.slot===id))continue;const m=mac(varOf(D,id),pix(D,id));if(s.st[id]==='eaten')add(m,1);if(s.st[id]==='half')add(m,.5);}
  s.exc.forEach(e=>add(e.m,SIZE[e.size]));s.extra.forEach(x=>add(x,1));return t;}
function basisOf(D){const s=NS(D.k),eb=new Set();mealIds(D).forEach(id=>{if(s.st[id]==='eaten'||s.st[id]==='half')(V[varOf(D,id)].basis||[]).forEach(b=>eb.add(b));});if(s.meds.fish)eb.add('Fisch');return eb;}
function nextWorkDay(D){const n=dayOf(addD(D.k,1));return n.work?n:null;}
function packData(N){const i=ti(N),prep=[],food=[],other=[];
  shown(N).forEach(sl=>{const id=sl[0];if(id==='T')return;const X=V[varOf(N,id)];
    if(sl[2]==='work'){food.push([`${SL[id][0]}: ${X.n}`,X.pack||X.d(pix(N,id))]);(X.prep||[]).forEach(p=>prep.push([p,`für ${SL[id][0]}`]));}
    if(sl[2]==='gym')other.push([X.pack,'direkt nach dem Training']);
    if(id==='ab'&&X.prepAb)prep.push([X.prepAb,`für ${N.wd} abends`]);});
  if(SUP.pack&&shown(N).some(s=>s[2]==='work'&&s[0]==='mi'))other.push(SUP.pack);
  PACK.food.forEach(x=>food.push(x));PACK.other.forEach(x=>other.push(x));
  if(N.train&&PACK.training)other.push(PACK.training);
  return {prep,food,other};}
const R=()=>{save();markDirty();render();};
EN.R=R;

/* ---------- kleine Bausteine ---------- */
const mini=(arr,val,fn,off)=>`<div class="mini">${arr.map((x,n)=>`<button class="${val===n+off?'on':''}" onclick="event.stopPropagation();${fn}(${n+off})">${x}</button>`).join('')}</div>`;
const ringSVG=(pct,big,small)=>{const r=42,C=2*Math.PI*r,p=Math.max(0,Math.min(1,pct));return `<div class="enring"><svg width="96" height="96" viewBox="0 0 96 96" style="transform:rotate(-90deg)"><circle cx="48" cy="48" r="${r}" stroke="#1c222e" stroke-width="8" fill="none"/>${p>0?`<circle cx="48" cy="48" r="${r}" stroke="${pct>1.08?'#f5c344':'#d7f651'}" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${C*p} ${C}"/>`:''}</svg><div class="mid"><b>${big}</b><span>${small}</span></div></div>`;};
const macHTML=(t,T)=>{const row=(n,a,b)=>`<div class="l"><span>${n} ${Math.round(a)} g</span><span>von ${b}</span></div><div class="mbar"><i style="width:${Math.min(100,a/b*100)}%"></i></div>`;return `<div class="mac">${row('Protein',t.p,T.p)+row('Kohlenhydrate',t.c,T.c)+row('Fett',t.f,T.f)}</div>`;};
function sheet(html){closeSheet();const w=document.createElement('div');w.className='sheetwrap';w.onclick=ev=>{if(ev.target===w)closeSheet();};w.innerHTML=`<div class="sheet en">${html}</div>`;document.body.appendChild(w);}
EN.close=()=>closeSheet();

/* =====================================================================
   ÜBERSICHT · Ergänzungen (die Original-Karten bleiben unverändert)
   ===================================================================== */
EN.hwStrip=function(){if(!C)return '';const k=TODAY(),h=hwDay(k);
  if(h)return `<div class="en"><div class="hwstrip" onclick="EN.openHw()"><span>Heilungsfenster · Tag ${h}/${HW.len}</span><span>Regeln ›</span></div></div>`;
  if(HW.active&&k<HW.start)return `<div class="en"><div class="hwstrip" onclick="EN.openHw()"><span>Heilungsfenster startet ${diff(HW.start,k)===1?'morgen':'am '+OKT(HW.start)}</span><span>Was ist das? ›</span></div></div>`;
  return '';};
/* In der Original-Karte „Heute“ nur, was sonst nirgends steht: Hinweis bei harter Einheit im Heilungsfenster */
EN.todayLine=function(first){if(!C)return '';const D=dayOf(first.k);
  return hwDay(D.k)&&D.type==='hard'?`<div class="en"><div class="tfood amb">Heilungsfenster: Ist die Rötung noch da, heute lieber locker.</div></div>`:'';};
/* in der Karte „erledigt“: Energie im Training (falls beim Abschließen übersprungen) */
EN.energyLine=function(){const s=NS(TODAY());
  return `<div class="en">${s.energy?`<div class="tfood">Energie <b>${s.energy}/5</b> · <span class="lk" onclick="EN.setEnergy(0)">ändern</span></div>`
    :`<div class="tfood ask"><b>Energie im Training?</b>${mini(['1','2','3','4','5'],0,'EN.setEnergy',1)}</div>`}</div>`;};
EN.setEnergy=v=>{NS(TODAY()).energy=v;R();};
EN.homeCards=function(){if(!C)return '';return `<div class="en">${foodCard(dayOf(TODAY()))}</div>`;};
EN.homeBottom=function(){if(!C)return '';return `<h2 class="section">Heute eintragen</h2><div class="en">${quickRow(dayOf(TODAY()))}</div>`;};

/* Zeitbezug nur, wo er eine Anweisung ist */
const cue=(D,id)=>{if(id==='na'&&D.train)return D.tpl==='Freitag'?'1–2 h vor dem Training':'1–3 h vor dem Training';if(id==='vor')return '30–60 min vorher';return '';};

function foodCard(D){const T=TT[D.type],t=totals(D),s=NS(D.k),cur=nextMeal(D),ids=mealIds(D),curN=cur?ids.indexOf(cur):ids.length,K=`'${D.k}'`;
  const rows=ids.map((id,n)=>{const X=V[varOf(D,id)],st=s.st[id]||'',exc=s.exc.find(e=>e.slot===id),done=mealDone(D,id),open=!done&&n<curN,c=cue(D,id);
    const add=SUP.names&&id===addonSlot(D)&&!done?`<span class="addon">+ ${SUP.names}</span>`:'';
    if(id===cur)return `<div class="fr cur"><div class="body" onclick="EN.openMeal(${K},'${id}')"><div class="when">${SL[id][0]}${c?` · <span>${c}</span>`:''}</div><div class="n">${X.n}</div><div class="d">${X.d(pix(D,id))}</div>${add}</div>
        <button class="st" onclick="EN.toggleMeal(${K},'${id}')"></button></div>`;
    return `<div class="fr ${done?'done':''}"><button class="st sm ${exc?'exc':st}" onclick="EN.toggleMeal(${K},'${id}')">${({eaten:'✓',half:'½',skip:'✕'})[st]||(exc?'!':'')}</button><div class="body" onclick="EN.openMeal(${K},'${id}')"><span class="l">${SL[id][0]}</span>${exc?'Ausnahme: '+exc.kind:X.n}${open?'<span class="openmark">● offen</span>':''}${add}</div></div>`;}).join('');
  const goal=Math.round((T.kcal+(T.i>=2?750:0))/250);
  return `<div class="ecard"><div class="between"><span class="k">Essen heute</span><span class="meta">${Math.round(t.kcal).toLocaleString('de-DE')} / ${T.kcal.toLocaleString('de-DE')} kcal</span></div>
    <div class="mbar" style="margin:8px 0 4px"><i style="width:${Math.min(100,t.kcal/T.kcal*100)}%"></i></div>${D.fast&&D.type==='hard'?`<div class="hint amb" style="margin:6px 0 4px">Harter Tag: rund 600 kcal extra einplanen.</div>`:''}${rows}
    <div class="frfoot"><span>💧 ${(s.water*.25).toFixed(2).replace('.',',')} / ${(goal*.25).toFixed(2).replace('.',',')} l</span><span class="row"><button class="btn sm ghost" onclick="EN.water(1)">+ Glas</button></span></div>
    <div class="links" style="margin-top:10px"><span onclick="EN.openOther()">+ Etwas anderes gegessen</span><span style="color:var(--amber)" onclick="EN.openSOS()">Lust auf Süßes?</span></div></div>`;}

/* Kleine Felder statt Checkliste: nichts ist Pflicht, eingetragene Werte stehen direkt im Feld */
const fmtKg=v=>v.toFixed(1).replace('.',',')+' kg';
function lastWeight(k){const ks=Object.keys(H.days).filter(x=>x<=k&&H.days[x].weight).sort();return ks.length?H.days[ks[ks.length-1]].weight:null;}
function quickRow(D){const s=NS(D.k),N=nextWorkDay(D);
  /* Rucksack immer sichtbar, wenn morgen gearbeitet wird; Label nennt, was heute Abend zu tun ist */
  const todo=N?['packen',...(packData(N).prep.some(p=>/TK|auftauen/i.test(p[0]))?['auftauen']:[]),...(packData(N).prep.some(p=>/Eier kochen/.test(p[0]))?['Eier kochen']:[])].join(' · '):'';
  const q=(on,label,fn)=>`<button class="q ${on?'on':''}" onclick="${fn}">${label}</button>`;
  return `<div class="qrow">
    ${q(s.weight,s.weight?'⚖️ '+fmtKg(s.weight):'⚖️ Gewicht','EN.openWeight()')}
    ${q(s.skin,s.skin?'Haut '+s.skin:'Haut','EN.openSkin()')}
    ${q(s.crave>=0,s.crave>=0?'Heißhunger: '+['nein','etwas','stark'][s.crave]:'Heißhunger','EN.openCrave()')}
    ${N?q(s.packed,s.packed?'🎒 Für '+N.wd+' erledigt':'🎒 Für '+N.wd+': '+todo,`location.hash='#food/pack'`):''}
  </div>`;}
let wv=0;
EN.openWeight=()=>{const k=TODAY();wv=NS(k).weight||lastWeight(k)||85;drawWeight();};
function drawWeight(){sheet(`<h3>Gewicht</h3><div class="sub">morgens, nüchtern, nach der Toilette</div>
  <div class="wrow"><button class="pill" onclick="EN.wAdj(-1)">−</button><b>${fmtKg(wv)}</b><button class="pill" onclick="EN.wAdj(1)">+</button></div>
  <button class="btn" onclick="EN.wSave()">Eintragen</button>${NS(TODAY()).weight?`<button class="cancel" onclick="EN.wSave(true)">Eintrag löschen</button>`:'<button class="cancel" onclick="closeSheet()">Abbrechen</button>'}`);}
EN.wAdj=n=>{wv=Math.round((wv+n*0.1)*10)/10;drawWeight();};
EN.wSave=del=>{const s=NS(TODAY());if(del)delete s.weight;else s.weight=wv;closeSheet();R();};
EN.openSkin=()=>{const s=NS(TODAY());sheet(`<h3>Haut</h3><div class="sub">1 = Schub · 5 = ruhig</div>${mini(['1','2','3','4','5'],s.skin,'EN.setSkin',1)}
  ${s.skin&&s.skin<=2&&!hwDay(TODAY())?`<button class="btn ghost" onclick="EN.openHwStart()">Schub? Heilungsfenster starten</button>`:''}<button class="cancel" onclick="closeSheet()">Fertig</button>`);};
EN.openCrave=()=>sheet(`<h3>Heißhunger heute?</h3>${mini(['nein','etwas','stark'],NS(TODAY()).crave,'EN.setCrave',0)}<button class="cancel" onclick="closeSheet()">Fertig</button>`);

EN.setSkin=v=>{NS(TODAY()).skin=v;R();EN.openSkin();};
EN.setCrave=v=>{NS(TODAY()).crave=v;closeSheet();R();};
EN.med=(k,m)=>{const s=NS(k);s.meds[m]=!s.meds[m];R();};
EN.flag=(k,f)=>{const s=NS(k);s[f]=!s[f];R();};
EN.water=n=>{const s=NS(TODAY());s.water=Math.max(0,s.water+n);R();};
EN.eat=(k,id)=>{const s=NS(k),D=dayOf(k);s.st[id]='eaten';if(id===addonSlot(D)){s.meds.fish=true;s.meds.crea=true;}closeSheet();R();};
EN.toggleMeal=(k,id)=>{const s=NS(k);if(s.st[id]){delete s.st[id];R();}else EN.eat(k,id);};
EN.setSt=(k,id,st)=>{NS(k).st[id]=st;closeSheet();R();};
EN.swap=(k,id,v)=>{NS(k).sw[id]=v;R();EN.openMeal(k,id);};

/* ---------- Training abschließen: Energie-Frage ----------
   Wird aufgerufen, nachdem in der Tagesansicht etwas abgehakt wurde. Ist damit der
   letzte Part des Tages erledigt (heute), kommt einmal das Sheet. */
EN.afterCheck=function(itemId){try{const loc=ITEM_LOC[itemId];if(!loc)return;const day=PROGRAM[loc.pi].weeks[loc.wi].days[loc.di];
  const items=dayItems(day);if(!items.length||!items.every(i=>S.checked[i.id]))return;
  const s=NS(TODAY());if(s.energy||s.energyAsked)return;s.energyAsked=true;save();
  EN.openEnergy(PROGRAM[loc.pi].weeks[loc.wi].name+' · '+day.label);}catch(e){}};
let finE=0,finT='';
EN.openEnergy=t=>{finT=t||finT;finE=NS(TODAY()).energy||0;drawEnergy();};
function drawEnergy(){sheet(`<div class="km">Alle Parts erledigt ✓</div><h3>${esc(finT)}</h3><div class="sub">Gespeichert ist schon alles. Eine Frage zum Schluss:</div>
  <div class="km sec">Energie im Training</div>${mini(['1','2','3','4','5'],finE,'EN.setFinE',1)}<div class="between scale"><span>leer, zäh</span><span>okay</span><span>voller Tank</span></div>
  <button class="btn" onclick="EN.saveEnergy()">${finE?'Fertig':'Ohne Angabe'}</button>`);}
EN.setFinE=v=>{finE=v;drawEnergy();};
EN.saveEnergy=()=>{NS(TODAY()).energy=finE;closeSheet();R();};

/* =====================================================================
   SHEETS: Mahlzeit / Rezept / Glossar / Ausnahme / Extra / SOS / Heilungsfenster
   ===================================================================== */
const ingHTML=(rows,k)=>`<table class="ing">${rows.map(([a,b,g])=>g&&G[g]?`<tr class="gl" onclick="this.nextElementSibling.classList.toggle('hid')"><td>${a} ⓘ</td><td>${b}</td></tr><tr class="glx hid"><td colspan="2">${G[g].t(k)}</td></tr>`:`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
function recipeHTML(v,i,k){const X=V[v],m=mac(v,i);
  return `<div class="row wrap" style="margin-top:8px"><span class="echip lime">${m.kcal} kcal</span><span class="echip">P ${m.p} g</span><span class="echip">KH ${m.c} g</span><span class="echip">F ${m.f} g</span>${X.time?`<span class="echip">⏱ ${X.time}</span>`:''}</div>
    <div class="km sec">Zutaten · ${TL[i]}</div>${ingHTML(X.ing(i,k),k)}<div class="sub" style="font-size:12px;margin-top:4px">Blau = Baustein, antippen für Details.${X.recipe?' Freundin isst mit: Zutaten ×1,7.':''}</div>
    <div class="km sec">Zubereitung</div><ol class="steps">${X.steps(k).map(x=>`<li>${x}</li>`).join('')}</ol>${X.tip?`<div class="hint amb">${X.tip}</div>`:''}`;}
EN.openMeal=function(k,id){const D=dayOf(k),i=pix(D,id),s=NS(k),v=varOf(D,id),X=V[v],sl=D.slots.find(x=>x[0]===id),at=sl[2],K=`'${k}'`;
  const alts=(ALT[id]||[]).filter(a=>a!==v&&(at!=='work'||V[a].at==='work'));
  sheet(`<div class="between"><div><div class="km">${D.wd} · ${SL[id][0]} · ${slotWhen(D,sl)}</div><h3>${X.n}</h3></div><span class="echip" style="${at==='work'?'color:var(--sky)':''}">${AT[at]}</span></div>
    <div class="sub">${X.d(i)}</div>${recipeHTML(v,i,k)}
    ${k===TODAY()||k<TODAY()?`<div class="km sec">Was ist passiert?</div><div class="acts">
      <button class="${s.st[id]==='eaten'?'on':''}" onclick="EN.eat(${K},'${id}')">✓ Gegessen<small>wie geplant</small></button>
      <button class="${s.st[id]==='half'?'on':''}" onclick="EN.setSt(${K},'${id}','half')">½ Halb gegessen<small>zählt zur Hälfte</small></button>
      <button class="${s.st[id]==='skip'?'on':''}" onclick="EN.setSt(${K},'${id}','skip')">✕ Nicht gegessen<small>ausgelassen</small></button>
      <button onclick="EN.openExc(${K},'${id}')">! Anders gegessen<small>als Ausnahme erfassen</small></button></div>`:''}
    ${alts.length?`<div class="km sec">Stattdessen</div>${at==='work'?'<div class="sub" style="font-size:13px">🎒 Arbeit: nur Kaltes und Mitnehmbares.</div>':''}<div class="egrid">${alts.map(a=>`<button class="opt" onclick="EN.swap(${K},'${id}','${a}')">${V[a].n}<small>${V[a].time||''}</small></button>`).join('')}</div>`:''}
    <button class="cancel" onclick="closeSheet()">Schließen</button>`);};
let recI=2;
EN.openRecipe=function(v,ii){if(ii!=null)recI=ii;const X=V[v],k=TODAY();
  sheet(`<div class="between"><h3>${X.n}</h3><span class="echip" style="${X.at==='work'?'color:var(--sky)':''}">${AT[X.at]}</span></div>
    <div class="row" style="margin-top:10px">${TL.map((l,n)=>`<button class="pill ${n===recI?'on':''}" onclick="EN.openRecipe('${v}',${n})">${l.replace(' Tag','')}</button>`).join('')}</div>
    <div class="sub" style="margin-top:8px">${X.d(recI)}</div>${recipeHTML(v,recI,k)}<button class="cancel" onclick="closeSheet()">Schließen</button>`);};
EN.openGl=g=>sheet(`<div class="km">Baustein</div><h3>${G[g].n}</h3><div class="ink2" style="margin-top:8px">${G[g].t(TODAY())}</div><button class="cancel" onclick="closeSheet()">Schließen</button>`);

let exSel=null,exSize='normal',exSlot=null,exK=null;
EN.openExc=(k,slot)=>{exK=k||TODAY();exSel=null;exSize='normal';exSlot=slot||null;drawExc();};
function drawExc(){const D=dayOf(exK),h=hwDay(exK);
  sheet(`<h3>Ausnahme</h3><div class="sub">Kein Abwiegen: Was war es, und ungefähr wie viel?</div>
   <div class="egrid">${EXC.map(([n,c,s],j)=>`<button class="opt ${exSel===j?'on':''}" onclick="EN.exS('sel',${j})"><span class="dot ${c}"></span>${n}<small>${s}</small></button>`).join('')}</div>
   <div class="km sec">Größe</div><div class="row">${['klein','normal','groß'].map(z=>`<button class="pill ${z===exSize?'on':''}" onclick="EN.exS('size','${z}')">${z}</button>`).join('')}</div>
   <div class="km sec">Statt welcher Mahlzeit?</div><div class="egrid">${mealIds(D).map(id=>`<button class="opt ${exSlot===id?'on':''}" onclick="EN.exS('slot','${id}')">${SL[id][0]}<small>${V[varOf(D,id)].n}</small></button>`).join('')}<button class="opt ${exSlot==='extra'?'on':''}" onclick="EN.exS('slot','extra')">zusätzlich<small>keine Mahlzeit ersetzt</small></button></div>
   ${exSel!==null?`<div class="hint">≈ ${Math.round(EXC[exSel][3].kcal*SIZE[exSize])} kcal (grob) · ${EXC[exSel][1]==='r'&&h?'<b style="color:var(--red)">Trigger im Heilungsfenster</b> · wird im Hautprotokoll markiert':'wird im Hautprotokoll vermerkt'}</div>`:''}
   <button class="btn" onclick="EN.saveExc()">Eintragen</button><button class="cancel" onclick="closeSheet()">Abbrechen</button>`);}
EN.exS=(f,v)=>{if(f==='sel')exSel=v;if(f==='size')exSize=v;if(f==='slot')exSlot=v;drawExc();};
EN.saveExc=()=>{if(exSel===null)return;const [n,,,m]=EXC[exSel];NS(exK).exc.push({kind:n,size:exSize,slot:exSlot||'extra',m});closeSheet();R();};
EN.openOther=()=>sheet(`<h3>Etwas anderes gegessen</h3><div class="km sec">Zusätzlich (ein Tipp)</div><div class="egrid">${XTRA.map(([n,m],j)=>`<button class="opt" onclick="EN.addExtra(${j})">${n}<small>${m.kcal} kcal</small></button>`).join('')}</div>
  <button class="btn ghost" onclick="EN.openExc()">Statt einer Mahlzeit oder Ausnahme (Pizza, Bestellt …) ›</button><button class="cancel" onclick="closeSheet()">Abbrechen</button>`);
EN.openExtra=()=>sheet(`<h3>Extra</h3><div class="sub">Grob, kein Abwiegen. Ein Tipp genügt.</div><div class="egrid">${XTRA.map(([n,m],j)=>`<button class="opt" onclick="EN.addExtra(${j})">${n}<small>${m.kcal} kcal</small></button>`).join('')}</div><button class="cancel" onclick="closeSheet()">Abbrechen</button>`);
EN.addExtra=j=>{const [n,m]=XTRA[j];NS(TODAY()).extra.push({...m,n});closeSheet();R();};
EN.openSOS=()=>{const D=dayOf(TODAY()),T=TT[D.type],open=Math.round(T.kcal-totals(D).kcal);
  sheet(`<h3>Lust auf Süßes?</h3><div class="hint">${open>400?`<b>Dir fehlen heute noch ${open} kcal.</b> Heißhunger ist oft einfach Hunger. Iss zuerst die nächste Mahlzeit, dann schau, ob die Lust noch da ist.`:`<b>Du hast heute genug gegessen.</b> Ein Glas Wasser, 10 Minuten warten, oder eine Alternative.`}</div>
    <div class="km sec">Alternativen</div><div class="egrid">${SOS.map(([n,c,x])=>`<button class="opt"><span class="dot ${c}"></span>${n}<small>${x}</small></button>`).join('')}</div>
    <button class="btn ghost" onclick="EN.openExc()">Trotzdem → als Ausnahme eintragen</button><button class="cancel" onclick="closeSheet()">Schließen</button>`);};

let hwConfirm=false;
EN.openHw=function(){const k=TODAY(),h=hwDay(k);
  if(hwConfirm)return sheet(`<h3>Heilungsfenster beenden?</h3><div class="sub" style="margin-top:6px">Danach gilt wieder Stufe 1 (hinzufügen statt weglassen). Milch und Süßes sind dann wieder normale Ausnahmen, die die App nur sichtbar macht.</div>
    <div class="hint amb"><b>Faustregel:</b> erst beenden, wenn die Haut an 3 Tagen in Folge bei 4 oder 5 liegt und die Rötung deutlich abgeklungen ist.</div>
    <button class="btn warn" onclick="EN.hwEnd()">Ja, heute beenden</button><button class="cancel" onclick="EN.hwC(false)">Abbrechen</button>`);
  sheet(`<div class="km" style="color:var(--amber)">Heilungsfenster · ${h?`Tag ${h}/${HW.len}`:HW.active?'ab '+OKT(HW.start):'aus'}</div><h3>Was ist das?</h3>
    <div class="ink2" style="margin-top:6px">Ein <b>befristeter Schutzmodus für einen akuten Schub</b>. ${HW.len} Tage lang gelten strengere Regeln, damit die Entzündung schneller abklingt. Danach geht es automatisch mit Stufe 1 weiter.</div>
    <div class="km sec">Regeln</div><ul class="rules">${HWR.rules.map(r=>`<li>${r}</li>`).join('')}</ul>
    <div class="km sec">Was die App dann anders macht</div><ul class="rules"><li>Streifen „Heilungsfenster · Tag x/14“ auf der Übersicht.</li><li>🔴-Ausnahmen werden als Trigger markiert.</li><li>Mengen nie unter dem Ruhetag.</li><li>Harte Einheiten bekommen in der Karte „Heute“ den Hinweis „lieber locker“.</li><li>Shake und Power-Hafer automatisch mit Erbsenprotein statt Whey.</li></ul>
    <div class="km sec">Wie es endet</div><div class="ink2">${HW.active?`<b>Automatisch am ${OKT(hwEnd())}</b>, mit kurzem Rückblick (Haut am Anfang und am Ende, Ausnahmen, Heißhunger).`:'Es läuft gerade nicht.'} Verwalten auch unter <b>Einstellungen → Ernährung</b>.</div>
    ${HW.active?`<div class="row" style="margin-top:12px"><button class="btn ghost" onclick="EN.hwExt()">+ 7 Tage</button><button class="btn warn" onclick="EN.hwC(true)">Vorzeitig beenden</button></div>`:`<button class="btn" onclick="EN.openHwStart()">Starten …</button>`}
    <button class="cancel" onclick="closeSheet()">Schließen</button>`);};
EN.hwC=v=>{hwConfirm=v;EN.openHw();};
EN.hwEnd=()=>{HW.active=false;hwConfirm=false;closeSheet();R();};
EN.hwExt=()=>{HW.len+=7;R();EN.openHw();};
EN.openHwStart=function(){const k=TODAY();
  sheet(`<div class="km" style="color:var(--amber)">Phase starten</div><h3>Heilungsfenster</h3><div class="sub">Für einen akuten Schub: strengere Regeln auf Zeit, endet automatisch.</div>
    <div class="km sec">Dauer</div><div class="row">${[7,14,21].map(n=>`<button class="pill ${n===hwLen?'on':''}" onclick="EN.hwL(${n})">${n} Tage</button>`).join('')}</div>
    <div class="hint">Start <b>heute, ${OKT(k)}</b> · endet automatisch am <b>${OKT(addD(k,hwLen-1))}</b></div>
    <button class="btn" onclick="EN.hwStart()">Heilungsfenster starten</button><button class="cancel" onclick="EN.openHw()">Was ist das genau?</button>`);};
EN.hwL=n=>{hwLen=n;EN.openHwStart();};
EN.hwStart=()=>{const k=TODAY();HW=H.HW={active:true,start:k,len:hwLen};closeSheet();R();};
EN.fastToggle=()=>{ST.fast=!ST.fast;R();};
EN.protToggle=()=>{ST.protein=ST.protein==='plant'?'whey':'plant';R();};

/* =====================================================================
   SEITE „ERNÄHRUNG“ (Planung): Tage · Woche · Rezepte · Einkauf · Vorrat · Packliste
   ===================================================================== */
let selK=null;
EN.render=function(main,sub){EN.fresh();if(!C){main.innerHTML='<div class="en"><div class="ecard"><span class="k">Ernährung</span><div class="sub" style="margin-top:6px">Keine Inhalte gefunden: <b>nutrition.json</b> fehlt im Daten-Repo.</div></div></div>';return;}sub=sub||'tage';const tabs=[['tage','Tage'],['woche','Woche'],['rezepte','Rezepte']];
  let h=`<div class="en">${sub==='pack'?'':`<div class="seg">${tabs.map(([k,l])=>`<button class="${k===sub?'on':''}" onclick="location.hash='#food/${k}'">${l}</button>`).join('')}</div>`}`;
  h+=({tage:pTage,woche:pWoche,rezepte:pRezepte,pack:pPack}[sub]||pTage)();
  main.innerHTML=h+'</div>';};
const days7=()=>Array.from({length:7},(_,n)=>addD(TODAY(),n));
EN.sel=k=>{selK=k;render();};
function pTage(){const ks=days7();if(!selK||!ks.includes(selK))selK=ks[0];const D=dayOf(selK),T=TT[D.type],t=totals(D),i=T.i,K=`'${D.k}'`;
  let h=`<div class="daychips">${ks.map(k=>{const d=dayOf(k);return `<button class="${k===selK?'on':''}" onclick="EN.sel('${k}')"><b>${d.wd}</b>${D_(k).getDate()}.<i class="ty-${d.type}"></i></button>`;}).join('')}</div>`;
  h+=`<div class="ecard"><div class="between"><span class="k">${selK===TODAY()?'Heute · ':''}${D.wd} ${OKT(D.k)}</span><span class="echip lime">${T.l}</span></div><div class="sub" style="margin-top:2px">${D.train?esc(D.train)+(D.len?' · '+D.len:''):D.off?'Geht nicht':'kein Training'}</div>
    <div class="bil">${ringSVG(t.kcal/T.kcal,Math.round(t.kcal),'von '+T.kcal)}${macHTML(t,T)}</div></div>`;
  h+=`<div class="ecard"><span class="km">Tagesablauf</span>`;
  shown(D).forEach(sl=>{const id=sl[0];if(id==='T'){h+=`<div class="trainline">🏃 Training</div>`;return;}
    const v=varOf(D,id),X=V[v],pi=pix(D,id),m=mac(v,pi),st=NS(D.k).st[id];
    h+=`<div class="slot" onclick="EN.openMeal(${K},'${id}')"><div class="body"><div class="when">${SL[id][0]}${cue(D,id)?` · <span>${cue(D,id)}</span>`:''}${sl[2]==='work'?' · <span>🎒</span>':''}</div><div class="n">${X.n}${st==='eaten'?' ✓':''}</div><div class="d">${X.d(pi)} · ${m.kcal} kcal</div></div><span class="go">›</span></div>`;});
  const eb=basisOf(D);h+=`</div><div class="ecard"><div class="between"><span class="km">Pyramiden-Basis</span><span class="meta">${eb.size} / 7</span></div><div class="basis">${BASIS.map(b=>`<span class="${eb.has(b)?'on':''}">${eb.has(b)?'✓ ':''}${b}</span>`).join('')}</div></div>`;
  const N=nextWorkDay(D);if(N)h+=`<button class="btn ghost" onclick="location.hash='#food/pack'">🎒 Packliste für ${N.wd} ${OKT(N.k)}</button>`;
  return h;}
function pWoche(){const ab=days7().map(k=>varOf(dayOf(k),'ab')),cnt=g=>ab.filter(v=>(GROUPS[g]||[]).includes(v)).length;
  const goals=[['Fisch abends',cnt('fish')+' / 3',cnt('fish')>=3?'ok':'warn'],['Rotes Fleisch',cnt('red')+' / max. 3',cnt('red')<=3?'ok':'warn']];
  let h=`<div class="ecard"><span class="km">Wochenziele</span>${goals.map(([a,b,c])=>`<div class="goal"><span>${a}</span><b class="${c}">${b}</b></div>`).join('')}</div><div class="ecard">`;
  days7().forEach(k=>{const D=dayOf(k),T=TT[D.type];h+=`<div class="wd" onclick="EN.sel('${k}');location.hash='#food/tage'"><div class="between"><b>${D.wd} ${OKT(k)}</b><span class="echip ${D.type==='rest'?'':'lime'}">${T.l} · ${T.kcal}</span></div>${D.train?`<div class="ln"><span style="color:var(--lime)">Training</span><span style="color:var(--lime)">${esc(D.train)}</span></div>`:''}${mealIds(D).map(id=>`<div class="ln"><span>${SL[id][0]}${D.slots.find(x=>x[0]===id)[2]==='work'?' 🎒':''}</span><span>${V[varOf(D,id)].n}</span></div>`).join('')}</div>`;});
  return h+'</div>';}
function pRezepte(){const it=v=>`<div class="it" onclick="EN.openRecipe('${v}')"><div>${V[v].n}<small>${V[v].time||''}${V[v].recipe?' · Rezept':''}</small></div><span class="go">›</span></div>`;
  return `<div class="ecard"><span class="k">🎒 Arbeit · kalt &amp; mitnehmbar</span><div class="sub" style="margin-top:4px">Kein Kochen, kein Aufwärmen, kein Teller.</div><div class="list">${Object.keys(V).filter(v=>V[v].at!=='home').map(it).join('')}</div></div>
    <div class="ecard"><span class="k">Zuhause</span><div class="list">${Object.keys(V).filter(v=>V[v].at==='home').map(it).join('')}</div></div>
    <div class="ecard"><span class="k">Bausteine (Glossar)</span><div class="list">${Object.keys(G).map(g=>`<div class="it" onclick="EN.openGl('${g}')"><div>${G[g].n}</div><span class="go">›</span></div>`).join('')}</div></div>`;}
function pPack(){const N=nextWorkDay(dayOf(TODAY()))||dayOf(addD(TODAY(),1));const p=packData(N),C=a=>a.length?a.map(([x,s])=>`<div class="check" onclick="this.querySelector('.ecb').classList.toggle('on')"><span class="ecb"></span><div>${x}<small>${s||''}</small></div></div>`).join(''):'<div class="sub">Nichts vorzubereiten.</div>';
  return `<div class="ecard"><div class="between"><span class="k">Packliste · ${N.wd} ${OKT(N.k)}</span>${N.work?`<span class="echip">Arbeit ${N.work}</span>`:''}</div><div class="sub" style="margin-top:6px">Nur Kaltes und Mitnehmbares. Erstellt aus den 🎒-Mahlzeiten von morgen.</div></div>
    <div class="ecard"><span class="km">Heute Abend vorbereiten</span>${C(p.prep)}</div><div class="ecard"><span class="km">Rucksack · Essen</span>${C(p.food)}</div><div class="ecard"><span class="km">Rucksack · Sonstiges</span>${C(p.other)}</div>
    <button class="btn" onclick="EN.flag('${TODAY()}','packed');history.back()">✓ Gepackt</button>`;}

/* ---------- Einstellungen: neuer Abschnitt „Ernährung“ ---------- */
EN.exportHealth=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(H,null,1)],{type:'application/json'}));a.download='gesundheit-'+TODAY()+'.json';a.click();};
EN.settings=function(main){const set=main.querySelector('.set');if(!set||!C)return;const k=TODAY(),h=hwDay(k);
  const el=document.createElement('div');el.className='en';
  el.innerHTML=`<details class="setsec" open><summary>Ernährung</summary><div class="secbody">
    <div class="km">Phasen</div>
    <div class="srow"><div><b>Heilungsfenster</b><small>${HW.active?(h?`läuft · Tag ${h}/${HW.len}`:'geplant')+` · ${OKT(HW.start)}–${OKT(hwEnd())} · endet automatisch`:'aus · für einen akuten Schub'}</small></div><button class="btn sm ghost" onclick="${HW.active?'EN.openHw()':'EN.openHwStart()'}">${HW.active?'verwalten':'starten'}</button></div>
    <div class="km" style="margin-top:14px">Grundeinstellungen</div>
    <div class="srow"><div>Werktags fasten<small>erste Mahlzeit mittags · Vormittag entfällt, Mengen wandern auf Mittag, Snack und Abend</small></div><button class="btn sm ghost" onclick="EN.fastToggle()">${ST.fast?'an':'aus'}</button></div>
    <div class="srow"><div>Proteinpulver<small>im Heilungsfenster immer Erbsenprotein</small></div><button class="btn sm ghost" onclick="EN.protToggle()">${ST.protein==='plant'?'Erbsenprotein':'Whey'}</button></div>
    <div class="srow"><div>Supplements<small>hängen am Mittag und werden mit abgehakt</small></div><button class="btn sm ghost">${SUP.names||'keine'}</button></div>
    <div class="srow"><div>Schlafenszeit<small>Abendessen bis 1,5 h vorher, keine Spätmahlzeit</small></div><button class="btn sm ghost">${BED}</button></div>
    <div class="srow"><div>Arbeit Mo–Do / Fr<small>🎒-Mahlzeiten: nur Kaltes und Mitnehmbares</small></div><button class="btn sm ghost">7–17 / 7–12</button></div>
    <div class="flow">${ST.fast?'':'<span>Vormittag 🎒</span><i>›</i>'}<span>Mittag 🎒 ~12</span><i>›</i><span>Nachmittag 🎒</span><i>›</i><span class="t">Training</span><i>›</i><span>Abend</span></div>
    <div class="km" style="margin-top:14px">Daten</div>
    <div class="srow"><div>Gewicht, Haut, Ausnahmen, Energie<small>nur auf diesem iPhone (Datenschutz-Entscheidung offen)</small></div><button class="btn sm ghost" onclick="EN.exportHealth()">Export</button></div>
  </div></details>`;
  set.insertBefore(el,set.firstChild);};
})();
