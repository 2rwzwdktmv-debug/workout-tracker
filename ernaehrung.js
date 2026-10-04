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
/* Einstellungen: Schlafenszeit, Arbeit, freie Mahlzeiten, Supplements (alles in S.food.set) */
const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const BEDM=()=>FS().set.bed??1320, BED=()=>hm(BEDM()), DINNER_BY=()=>hm(BEDM()-90);
const WO=[1,2,3,4,5,6,0], WM=['voll','halb','frei'], WML=['ganztags','bis mittags','frei'];
const WDEF={1:'voll',2:'voll',3:'voll',4:'voll',5:'halb',6:'frei',0:'frei'};
const workMode=w=>(FS().set.work||{})[w]||WDEF[w];
const workTime=m=>(FS().set.wt||{})[m]||(m==='voll'?[7,17]:[7,12]);
const workLbl=m=>m==='frei'?'':workTime(m).join('–');
/* Freie Mahlzeiten nach Rolle, unabhängig davon, ob der Tag Werktag oder frei ist */
const ROLE={vm:'vm',br:'fr',fr:'fr',mi:'mi',we:'mi',na:'na',wn:'na',ab:'ab'};
const RN={vm:'Vormittag',fr:'Frühstück',mi:'Mittag',na:'Nachmittag',ab:'Abend'};
const freeOf=w=>((FS().set.free||{})[w]||[]).map(x=>ROLE[x]||x);
const supList=()=>FS().set.sup||(C&&C.supplements&&C.supplements.list)||[];
const supOn=()=>supList().filter(x=>x.on!==false);
const supNames=()=>supOn().map(x=>x.n).join(', ');
/* Wochentage zusammenfassen: [1,2,3,4] → "Mo–Do" */
const dayRanges=ws=>{const out=[];let a=-1,b=-1;const flush=()=>{if(a<0)return;const n=WO.indexOf(b)-WO.indexOf(a);out.push(n===0?WDL[a]:WDL[a]+(n>1?'–':', ')+WDL[b]);a=-1;};
  WO.forEach(w=>{if(ws.includes(w)){if(a<0)a=w;b=w;}else flush();});flush();return out.join(', ');};

/* ---------- Zustand ---------- */
/* Synchronisiert (progress.json): S.food = {days:{datum:{st,sw,extra,water,energy,meds,packed}}, set:{protein,fast}} */
function FS(){if(!S.food||typeof S.food!=='object')S.food={};if(!S.food.days)S.food.days={};if(!S.food.set)S.food.set={protein:'whey',fast:true};if(!S.food.stock)S.food.stock={};if(!S.food.cart)S.food.cart={};if(!S.food.have)S.food.have={};if(!S.food.subst)S.food.subst={};if(!S.food.pantry)S.food.pantry={};if(!S.food.set.free)S.food.set.free={};if(!S.food.set.freeV2){if(JSON.stringify(S.food.set.free)==='{"0":["we"]}')S.food.set.free={};S.food.set.freeV2=1;}   /* Standard: jede Mahlzeit im Plan; früheres „So Mittag frei“ einmalig zurück */if(!S.food.tt)S.food.tt={};return S.food;}
/* Nur lokal auf diesem Gerät (Gesundheitsdaten): Haut, Ausnahmen, Heißhunger, Gewicht, Heilungsfenster */
const HKEY='wt-health-v1';
let H={days:{},HW:{active:false,start:'',len:7}};
try{const x=JSON.parse(localStorage.getItem(HKEY)||'null');if(x)H=Object.assign(H,x);}catch(e){}
const HF={exc:[],skin:0,haut:0,skinAt:[],crave:-1,weight:0,waist:0}, SF={st:{},sw:{},extra:[],water:0,energy:0,energyAsked:false,meds:{},packed:false,used:{},guests:{},ing:{}};
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
const save=()=>{prune(H.days,HF);prune(FS().days,SF);Object.keys(FS().stock).forEach(it=>{if(it!=='bolotk'||!(FS().stock[it]>0))delete FS().stock[it];});Object.keys(FS().have).forEach(id=>{const at=id.split('@')[1],h=FS().have[id];if(at?at<TODAY():diff(TODAY(),h)>=7)delete FS().have[id];});try{localStorage.setItem(HKEY,JSON.stringify(H));}catch(e){}};
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
  V={};Object.keys(C.dishes).forEach(k=>{const X=C.dishes[k];V[k]=Object.assign({},X,{d:i=>B_(X.d[i]),ing:(i,kk)=>X.ing[i].map(r=>bRow([P_(r[0],kk),r[1],r[2],r[3]])),steps:kk=>X.steps.map(t=>B_(P_(t,kk)))});});
  G={};Object.keys(C.glossary).forEach(k=>{G[k]={n:C.glossary[k].n,t:kk=>P_(C.glossary[k].t,kk)};});
  SUP=C.supplements||SUP;PACK=C.pack||PACK;SOS=(C.sos||[]).map(x=>Array.isArray(x)?{n:x[0],c:x[1],s:x[2],items:[]}:x);
  EXC=C.exceptions.map(e=>[e.n,e.c,e.s,mk(e.p,e.cc,e.f)]);XTRA=C.extras.map(e=>[e.n,mk(e.p,e.c,e.f)]);
}catch(e){C=null;console.error('nutrition.json',e);}};
const SIZE={klein:.6,normal:1,'groß':1.5};
/* Brot nach Einstellung: Vollkorntoast (Standard) oder Roggenbrot. Rezepte rechnen in Scheiben Roggenbrot,
   bei Toast wird umgerechnet (breadFactor in nutrition.json, 1 Scheibe Roggenbrot ≈ 1,7 Scheiben Toast). */
const toastOn=()=>(FS().set.bread||'toast')==='toast'&&!!(C&&C.items&&C.items.toast);
const bN=n=>Math.max(1,Math.round(n*((C&&C.breadFactor)||1.7)));
const qB=(it0,v)=>it0==='brot'&&toastOn()&&v?bN(v):v;
const B_=t=>!toastOn()||typeof t!=='string'?t:t.replace(/(\d+) Scheiben (?:Vollkorn-)?Roggenbrot/g,(m,n)=>bN(+n)+' Scheiben Vollkorntoast').replace(/(?:Vollkorn-)?Roggenbrot/g,'Vollkorntoast');
const bRow=r=>!toastOn()||r[3]!=='brot'?r:[B_(r[0]),String(r[1]).replace(/^(\d+)/,m=>bN(+m)),r[2]==='brot'?'toast':r[2],'toast'];

/* ---------- Tage aus dem echten Trainingsplan ---------- */
/* Tagestyp: aus der Minuten-Schätzung der Plan-Einheit (dayMinutes). Vorlage: nach Wochentag. */
const WDL=['So','Mo','Di','Mi','Do','Fr','Sa'];
let PP=null;
EN.fresh=()=>{PP=null;DC={};};
function plan(){if(!PP){PP={};try{projectPlan(8).forEach(e=>{PP[e.k]=e;});}catch(e){}}return PP;}
const TODAY=()=>dkey(today0());
let DC={};
function dayOf(k){return DC[k]||(DC[k]=dayOf0(k));}
/* Vergangene Tage (für „Nach Plan“): trainiert laut Log, sonst Ausfall- oder Ruhetag */
function pastEntry(k){if(k>=TODAY())return null;try{const d=dayWorkedOn(k);if(d)return {kind:'donetoday',d};if(planState().off.includes(k))return {kind:'off'};}catch(e){}return null;}
function dayOf0(k){const e=plan()[k]||pastEntry(k)||{kind:'empty'},w=D_(k).getDay();
  const isT=e.kind==='train'||e.kind==='donetoday',min=e.d?dayMinutes(e.d.day):0;
  const type=!isT?'rest':min>=120?'hard':min>=45?'train':'active';
  const D={k,wd:WDL[w],e,min,type,off:e.kind==='off',done:e.kind==='donetoday',train:isT?(e.d?dayTitle(e.d):'Training'):null,len:min?'≈ '+min+' min':''};
  let ab=AB_ROT[w];const vm=VMR[w]||VMR.other;
  if(ab==='boloTK'&&k>=TODAY()&&tkLeft(k)<1)ab='bolo';   /* TK leer → frisch kochen (×4) */
  else if(ab==='bolo'&&k>TODAY()&&tkLeft(k)>=2)ab='frosta';   /* noch genug im TK → nicht schon wieder vorkochen */
  const md=workMode(w);D.work=workLbl(md);D.md=md;
  D.fast=!!ST.fast&&md!=='frei';   /* Werktags-Fasten: erste Mahlzeit mittags */
  const VM=D.fast?[]:[['vm',vm,'work']],RC=D.fast?['rc','recovShake','gym']:['rc','recov','gym'];
  if(md==='voll'){D.tpl='Werktag';D.slots=[...VM,['mi','oats','work'],['na','pre','work'],['ab',ab,'home']];}
  else if(md==='halb'){D.tpl='halb';D.slots=[...VM,['mi','oats','home','zuhause'],['na','pre','home'],['ab',ab,'home']];}
  else{D.tpl='Wochenende';D.slots=[['br','brunch','home'],['we','weLunch','home'],['wn','weSnack','home'],['ab',ab,'home']];}
  /* Lange Ausdauer (ein durchgehender Block ab 75 min, z. B. langer Lauf): Zeile „Unterwegs“ nach dem Training, Menge nach Dauer.
     Krafteinheiten kommen mit Pausen auch auf 80–90 min, brauchen aber nichts unterwegs. */
  let sm=0;try{(e.d&&e.d.day&&e.d.day.sessions||[]).forEach(se=>(se.items||[]).forEach(it=>{if(!it.rest&&!it.opt)sm=Math.max(sm,pvMinutes(it));}));}catch(x){}
  D.uwI=!V.gel||!SL.uw?-1:sm>=180?2:sm>=120?1:sm>=75?0:-1;   /* ältere nutrition.json ohne Gel: nichts anzeigen */
  D.cue={};if(D.train)placeTraining(D,RC);   /* vor dem Filtern: eine freie Mahlzeit wird trotzdem gegessen */
  const fr=freeOf(w);if(fr.length)D.slots=D.slots.filter(sl=>!fr.includes(ROLE[sl[0]]));   /* freie Mahlzeiten (Einstellung) */
  return D;}
/* ---------- Trainingszeit: Standard aus der Vorlage, pro Tag änderbar (heute oder im Voraus) ----------
   Das Training wird nach Uhrzeit zwischen die Mahlzeiten gesetzt. Liegt die letzte Mahlzeit davor
   mehr als 3 h zurück, kommt ein kleiner Snack dazu. Danach: Shake (Arbeitstage) bzw. die nächste Mahlzeit. */
const TZ=['frueh','mittag','nachm','abend'],TZL={frueh:'früh',mittag:'mittags',nachm:'nachmittags',abend:'abends'};
const tzDef=md=>md==='frei'?'frueh':'nachm';
const tzOf=(k,md)=>FS().tt[k]||tzDef(md);
function tMin(tz,md){const [a,b]=md==='frei'?[0,0]:workTime(md);
  if(tz==='frueh')return md==='frei'?480:a*60-90;
  if(tz==='mittag')return md==='halb'?b*60+30:720;
  if(tz==='nachm')return md==='voll'?b*60+30:930;
  return Math.max(1110,md==='voll'?b*60+90:0);}
const MT={vm:570,br:570,mi:720,we:780,na:900,wn:960};
function placeTraining(D,RC){const md=D.md,tz=D.tz=tzOf(D.k,md),t=tMin(tz,md),M=D.slots;
  const mt=s=>s[0]==='ab'?Math.max(1140,t+1):md==='halb'&&s[0]==='mi'?750:md==='halb'&&s[0]==='na'?870:MT[s[0]];
  let pos=M.findIndex(s=>mt(s)>=t);if(pos<0)pos=M.length;
  const pre=M[pos-1],gap=pre?t-mt(pre):999,ins=[];
  if(gap>180){const atWork=md==='voll'&&t>=workTime(md)[0]*60&&t<workTime(md)[1]*60;ins.push(['vor','preWE',atWork?'work':'home']);D.cue.vor='30–60 min vorher';}
  else D.cue[pre[0]]='Pre-Workout · '+(['na','wn','vm'].includes(pre[0])?(md==='halb'?'1–2 h':'1–3 h'):'2–3 h')+' vorher';
  ins.push(['T']);if(D.uwI>=0)ins.push(['uw','gel','gym']);
  if(md==='voll'||(md==='halb'&&(D.fast||tz==='frueh'||tz==='mittag')))ins.push(RC);
  M.splice(pos,0,...ins);
  const nx=M[pos+ins.length];
  if(nx&&nx[0]==='br')nx[0]='fr';   /* Frühstück nach dem Training */
  if(nx&&md==='frei'&&nx[0]!=='ab')D.cue[nx[0]]='Post-Workout';
  const ai=M.findIndex(s=>s[0]==='ab');D.abAfter=ai>0&&M[ai-1][0]==='T';}   /* nach dem Shake ist das Abendessen kein Post-Workout mehr */
const ti=D=>TT[D.type].i;
const mac=(v,i)=>mk(V[v].P[i],V[v].C[i],V[v].F[i]);
const varOf=(D,id)=>{const s=D.slots.find(x=>x[0]===id);return NS(D.k).sw[id]||s[1];};
const shown=D=>D.slots.filter(s=>!(s[0]==='rc'&&ti(D)<3&&!D.fast));
/* Portion pro Mahlzeit: im Fasten-Fenster eine Stufe größer (Vormittag fällt weg) */
const pix=(D,id)=>id==='uw'?Math.max(D.uwI,0):D.fast&&['mi','na','ab'].includes(id)?Math.min(ti(D)+1,3):ti(D);
const slotWhen=(D,s)=>{const c=D.cue[s[0]];if(c)return c;if(s[3])return s[3];if(['na','wn','vm'].includes(s[0]))return 'wann es passt';
  if(s[0]==='ab')return (D.abAfter?'Post-Workout · ':'')+'bis ~'+DINNER_BY();return SL[s[0]][1];};
const mealIds=D=>shown(D).filter(s=>s[0]!=='T').map(s=>s[0]);
const mealDone=(D,id)=>!!NS(D.k).st[id]||!!NS(D.k).exc.find(e=>e.slot===id);
function nextMeal(D){const ids=mealIds(D);let last=-1;ids.forEach((id,n)=>{if(mealDone(D,id))last=n;});const n=ids.findIndex((id,j)=>j>last&&!mealDone(D,id));return n<0?null:ids[n];}
function addonSlot(D){const ids=mealIds(D);return ['mi','we','fr','br'].find(x=>ids.includes(x));}
function totals(D){const s=NS(D.k),i=ti(D);let t={kcal:0,p:0,c:0,f:0};const add=(m,f)=>{t.kcal+=m.kcal*f;t.p+=m.p*f;t.c+=m.c*f;t.f+=m.f*f;};
  for(const id of mealIds(D)){if(s.exc.find(e=>e.slot===id))continue;const m=mac(varOf(D,id),pix(D,id));if(s.st[id]==='eaten')add(m,1);if(s.st[id]==='half')add(m,.5);}
  s.exc.forEach(e=>add(e.m,SIZE[e.size]));s.extra.forEach(x=>add(x,1));return t;}
function basisOf(D){const s=NS(D.k),eb=new Set();mealIds(D).forEach(id=>{if(s.st[id]==='eaten'||s.st[id]==='half')(V[varOf(D,id)].basis||[]).forEach(b=>eb.add(b));});if(s.meds.fish||Object.keys(s.meds).some(n=>s.meds[n]&&/fisch|omega/i.test(n)))eb.add('Fisch');Object.keys(s.ing||{}).forEach(it=>{const b=(IT()[it]||{}).basis;if(b)eb.add(b);});return eb;}
/* Welche Basis-Lebensmittel stehen heute im Plan (Gerichte, Zutaten, Fischöl als Supplement)? */
function planBasis(D){const pb=new Set();mealIds(D).forEach(id=>(V[varOf(D,id)].basis||[]).forEach(b=>pb.add(b)));
  Object.keys(dayIngredients(D)).forEach(it=>{const b=(IT()[it]||{}).basis;if(b)pb.add(b);});
  if(supOn().some(x=>/fisch|omega/i.test(x.n)))pb.add('Fisch');return pb;}
function nextWorkDay(D){const n=dayOf(addD(D.k,1));return n.work?n:null;}
function packData(N){const i=ti(N),prep=[],food=[],other=[];
  shown(N).forEach(sl=>{const id=sl[0];if(id==='T')return;const X=V[varOf(N,id)];
    if(sl[2]==='work'){food.push([`${SL[id][0]}: ${X.n}`,B_(X.pack)||X.d(pix(N,id))]);(X.prep||[]).forEach(p=>prep.push([p,`für ${SL[id][0]}`]));}
    if(sl[2]==='gym')other.push([B_(X.pack),'direkt nach dem Training']);
    if(id==='ab'&&X.prepAb)prep.push([X.prepAb,`für ${N.wd} abends`]);});
  if(supOn().length&&shown(N).some(s=>s[2]==='work'&&s[0]==='mi'))other.push(['Supplements fürs Mittag',supOn().map(x=>x.n+(x.d?' '+x.d:'')).join(' · ')]);
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
/* Oben auf der Übersicht: Heilungsfenster (wenn aktiv) · Nach Plan · fällige Messung */
EN.hwStrip=function(){if(!C)return '';const k=TODAY(),h=hwDay(k);let x='';
  if(h)x+=`<div class="hwstrip" onclick="EN.openHw()"><span>Heilungsfenster · Tag ${h}/${HW.len}</span><span>Regeln ›</span></div>`;
  else if(HW.active&&k<HW.start)x+=`<div class="hwstrip" onclick="EN.openHw()"><span>Heilungsfenster startet ${diff(HW.start,k)===1?'morgen':'am '+OKT(HW.start)}</span><span>Was ist das? ›</span></div>`;
  return x?`<div class="en">${x}</div>`:'';};

/* ---------- Nach Plan: abgehakte Zutaten / geplante Zutaten (dieselbe Liste wie Ernährung → Tage) ----------
   Ganze Mahlzeit gegessen oder halb = alle ihre Zutaten. Einzeln abgehakt (z. B. nur Heidelbeeren) zählt auch.
   Woche und Monat: nur abgeschlossene Tage ab dem ersten Eintrag; Tage ganz ohne Eintrag zählen nicht mit. */
const logged=k=>{const d=FS().days[k];return !!d&&(Object.keys(d.st||{}).length>0||Object.keys(d.ing||{}).length>0);};
function dayScore(k){const D=dayOf(k),ids=tickIds(D);if(!ids.length)return null;const g=(FS().days[k]||{}).ing||{};
  return {nd:ids.filter(it=>!!ateVia(D,it)||!!g[it]).length,n:ids.length};}
const startDay=()=>Object.keys(FS().days).filter(logged).sort()[0]||null;
function periodScore(from){const st=startDay(),y=addD(TODAY(),-1);let a=0,b=0,n=0;if(!st)return null;
  for(let k=from<st?st:from;k<=y;k=addD(k,1)){if(!logged(k))continue;const s=dayScore(k);if(!s)continue;a+=s.nd;b+=s.n;n++;}
  return b?{p:Math.round(100*a/b),n}:null;}
const pct=s=>s?s.p+' %':'–';
/* Übersicht: Ernährung nach Plan · heute · letzte 7 · letzte 30 Tage (abgeschlossene Tage, ohne heute) */
EN.topFood=function(){if(!C)return '';const k=TODAY(),t=dayScore(k),tp=t?Math.round(100*t.nd/t.n)+' %':'–',st=startDay();
  /* erst anzeigen, wenn seit dem Start so viele Tage vergangen sind */
  const per=n=>st&&diff(k,st)>=n?`<b>${pct(periodScore(addD(k,-n)))}</b>`:`<i>${st?'ab '+D_(addD(st,n)).getDate()+'.'+(D_(addD(st,n)).getMonth()+1)+'.':'–'}</i>`;
  const due=['weight','waist'].filter(f=>showMeasure(f,k)&&!NS(k)[f]);
  return `<div class="tc-sec" onclick="EN.openScore()"><div class="tc-h"><span>Ernährung nach Plan</span><span class="tc-l">›</span></div>
    <div class="tc-g g3"><span>heute</span><b class="ok">${tp}</b><span>7 Tage</span>${per(7)}<span>30 Tage</span>${per(30)}</div></div>
    ${due.length?`<div class="tc-due" onclick="EN.openMeasure('${due[0]}')"><span>Heute messen: ${due.map(f=>f==='weight'?'Gewicht':'Taille').join(' und ')}</span><span>›</span></div>`:''}`;};
EN.openScore=()=>{const st=startDay(),ws=addD(TODAY(),-7);
  const rows=Array.from({length:8},(_,n)=>addD(ws,n)).filter(k=>!st||k>=st).reverse().map(k=>{const s=k>=(st||k)&&(logged(k)||k===TODAY())?dayScore(k):null,p=s?Math.round(100*s.nd/s.n):null;
    return `<div class="it"><div style="flex:1">${dayOf(k).wd} ${OKT(k)}${k===TODAY()?' · heute':''}<small>${s?s.nd+' von '+s.n+' Zutaten':st&&k<st?'vor dem Start':'nichts eingetragen, zählt nicht'}</small></div><span class="meta">${p===null?'–':p+' %'}</span></div>`;}).join('');
  sheet(`<h3>Nach Plan</h3><div class="sub">Wie viele Zutaten aus deinem Plan du gegessen hast.</div>
    <div class="list" style="margin-top:10px">${rows}</div>
    <div class="hint">Eine ganze Mahlzeit abhaken zählt alle ihre Zutaten. Isst du nur einen Teil, etwa nur die Heidelbeeren, hakst du sie unter <b>Ernährung → Tage → Zutaten für heute</b> einzeln ab. 7 und 30 Tage zählen nur abgeschlossene Tage (ohne heute)${st?' seit deinem Start ('+OKT(st)+')':''}. Tage ganz ohne Eintrag zählen nicht mit.</div>
    <button class="btn" onclick="closeSheet();selK=null;location.hash='#food/tage'">Zutaten für heute ›</button><button class="cancel" onclick="closeSheet()">Fertig</button>`);};
/* In der Original-Karte „Heute“ nur, was sonst nirgends steht: Hinweis bei harter Einheit im Heilungsfenster */
EN.todayLine=function(first){if(!C)return '';const D=dayOf(first.k);
  return (hwDay(D.k)&&D.type==='hard'?`<div class="en"><div class="tfood amb">Heilungsfenster: Ist die Rötung noch da, heute lieber locker.</div></div>`:'')+intraLine(D);};
/* Intra-Workout als eine Zeile: in der Trainingszeile der Übersicht und in der Trainingsansicht beim langen Block.
   Heute mit Kreis zum Abhaken (zählt wie eine Mahlzeit), sonst nur zur Info. */
function intraLine(D){if(!D||D.uwI<0||!D.slots.some(s=>s[0]==='uw'))return '';const v=varOf(D,'uw'),i=pix(D,'uw'),st=NS(D.k).st.uw||'',K=`'${D.k}'`,can=D.k<=TODAY();
  return `<div class="en"><div class="intra ${st?'done':''}" onclick="event.stopPropagation();EN.openMeal(${K},'uw')"><span><i class="ic">🧃</i><b>Intra-Workout</b> · ${V[v].d(i)}</span>${can?`<button class="st ${st}" onclick="event.stopPropagation();EN.toggleMeal(${K},'uw')">${({eaten:'✓',half:'½',skip:'✕'})[st]||''}</button>`:''}</div></div>`;}
/* Trainingsansicht (▶): beim langen Block; gehört der Plan-Tag zu einem der nächsten Tage, gilt dessen Zeile */
EN.intraFor=function(item,pi,wi,di){if(!C||!V.gel||!item||item.rest||pvMinutes(item)<75)return '';
  /* nur beim längsten Block des Tages, sonst stünde es bei zwei langen Blöcken doppelt */
  let top=null;try{PROGRAM[pi].weeks[wi].days[di].sessions.forEach(se=>se.items.forEach(it=>{if(!it.rest&&!it.opt&&(!top||pvMinutes(it)>pvMinutes(top)))top=it;}));}catch(x){}
  if(top&&top.id!==item.id)return '';
  const k=Object.keys(plan()).find(x=>{const d=plan()[x].d;return d&&+d.pi===+pi&&+d.wi===+wi&&+d.di===+di;});
  if(k)return intraLine(dayOf(k));
  const m=pvMinutes(item),i=m>=180?2:m>=120?1:0;return `<div class="en"><div class="intra"><span><i class="ic">🧃</i><b>Intra-Workout</b> · ${V.gel.d(i)}</span></div></div>`;};
/* in der Karte „erledigt“: Energie im Training (falls beim Abschließen übersprungen) */
EN.energyLine=function(){const s=NS(TODAY());
  return `<div class="en">${s.energy?`<div class="tfood">Energie <b>${s.energy}/5</b> · <span class="lk" onclick="EN.setEnergy(0)">ändern</span></div>`
    :`<div class="tfood ask"><b>Energie im Training?</b>${mini(['1','2','3','4','5'],0,'EN.setEnergy',1)}</div>`}</div>`;};
EN.setEnergy=v=>{NS(TODAY()).energy=v;R();};
EN.homeBottom=function(){if(!C)return '';return `<h2 class="section">Heute eintragen</h2><div class="en">${quickRow(dayOf(TODAY()))}</div>`;};

/* Zeitbezug nur, wo er eine Anweisung ist */
const cue=(D,id)=>D.cue[id]||'';
/* Symbole nach Tageszeit und Training, vor der Bezeichnung jeder Zeile im Tagesablauf */
const IC={br:'🌅',fr:'🌅',vm:'☕',mi:'☀️',we:'☀️',na:'🍎',wn:'🍎',vor:'⚡',uw:'🧃',rc:'🥤',ab:'🌙'};
/* Snacks haben keinen eigenen Namen („Nachmittags-Snack“, „Kleiner Snack vorher“): dort ist der Inhalt der Titel */
const SNACK=['na','wn','vor','uw','rc'];
const titleOf=(D,id)=>{const X=V[varOf(D,id)];return SNACK.includes(id)?X.d(pix(D,id)):X.n;};
const lab=id=>(IC[id]?`<i class="ic">${IC[id]}</i>`:'')+SL[id][0];

/* ---------- Karte „Heute“ = Tagesablauf auf einer Zeitleiste: Mahlzeiten und Training als gleichrangige Zeilen ----------
   index.html baut die Trainingszeile; davor (EN.dayPre) und danach (EN.dayPost) stehen die Mahlzeiten, darunter EN.dayFoot.
   Dieselben Zeilen zeigt die Tagesvorschau (EN.openDay) aus „Danach“. */
function mealsOf(D,part){const sl=shown(D),i=sl.findIndex(s=>s[0]==='T');
  return (i<0?(part==='pre'?[]:sl):part==='pre'?sl.slice(0,i):sl.slice(i+1)).filter(s=>s[0]!=='T');}
/* Nächster offener Schritt des Tages (Mahlzeit oder Training): nur er bekommt den gelben Ring */
function nextStep(D){if(D.k!==TODAY())return null;const ids=shown(D).map(s=>s[0]).filter(id=>id!=='uw'),dn=id=>id==='T'?D.done:mealDone(D,id);let last=-1;ids.forEach((id,n)=>{if(dn(id))last=n;});
  const n=ids.findIndex((id,j)=>j>last&&!dn(id));return n<0?null:ids[n];}
EN.isNext=e=>!!C&&nextStep(dayOf(e.k))==='T';
/* Eine Zeile im Ablauf (überall gleich: Übersicht, Ernährung → Tage, Vorschau): Bezeichnung, Gericht, Inhalt;
   rechts heute der Kreis zum Abhaken (gelber Ring = als Nächstes dran), an anderen Tagen ›. Gegessenes schrumpft auf eine Zeile. */
function mealRow(D,sl,fn){const id=sl[0],v=varOf(D,id),X=V[v],s=NS(D.k),st=s.st[id]||'',exc=s.exc.find(e=>e.slot===id),done=mealDone(D,id),i=pix(D,id),K=`'${D.k}'`,c=cue(D,id);
  const open=`${fn||'EN.openMeal'}(${K},'${id}')`;
  const right=D.k<=TODAY()?`<button class="st ${done?(exc?'exc':st):nextStep(D)===id?'nx':''}" onclick="event.stopPropagation();EN.toggleMeal(${K},'${id}')">${({eaten:'✓',half:'½',skip:'✕'})[st]||(exc?'!':'')}</button>`:'<span class="go">›</span>';
  if(done)return `<div class="slot done" onclick="${open}"><div class="body"><span class="l">${lab(id)}</span>${exc?'Ausnahme: '+exc.kind:titleOf(D,id)}</div>${right}</div>`;
  const add=supOn().length&&id===addonSlot(D)?`<div class="addon">+ ${supNames()}</div>`:'';
  return `<div class="slot" onclick="${open}"><div class="body"><div class="when">${lab(id)}${c?` · <span>${c}</span>`:''}${sl[2]==='work'?' · <span>🎒</span>':''}</div>${SNACK.includes(id)?`<div class="n">${X.d(i)}</div><div class="d">${mac(v,i).kcal} kcal</div>`:`<div class="n">${X.n}</div><div class="d">${X.d(i)} · ${mac(v,i).kcal} kcal</div>`}${add}</div>${right}</div>`;}
const mealList=(D,part,fn)=>mealsOf(D,part).map(sl=>mealRow(D,sl,fn)).join('');
EN.dayPre=e=>C?mealList(dayOf(e.k),'pre'):'';
/* Übersicht: Intra-Workout steht nicht als eigene Zeile, sondern leise in der Trainingszeile (EN.todayLine) */
EN.dayPost=e=>{if(!C)return '';const D=dayOf(e.k);return mealsOf(D,'post').filter(s=>s[0]!=='uw').map(sl=>mealRow(D,sl)).join('');};
EN.dayFoot=e=>C?`<div class="en">${dayFoot(dayOf(e.k))}</div>`:'';
EN.tzChip=e=>{if(!C)return '';const D=dayOf(e.k);return D.train?`<span class="tzc" onclick="event.stopPropagation();EN.openTime('${D.k}')">${TZL[D.tz]} ⌄</span>`:'';};
function dayFoot(D){const T=TT[D.type],t=totals(D),s=NS(D.k),goal=Math.round((T.kcal+(T.i>=2?750:0))/250);
  return `${D.fast&&D.type==='hard'?`<div class="hint amb">Harter Tag: rund 600 kcal extra einplanen.</div>`:''}
    <div class="frfoot"><span>${Math.round(t.kcal).toLocaleString('de-DE')} / ${T.kcal.toLocaleString('de-DE')} kcal</span><span class="row">💧 ${(s.water*.25).toFixed(2).replace('.',',')} / ${(goal*.25).toFixed(2).replace('.',',')} l<button class="btn sm ghost" onclick="EN.water(1)">+ Glas</button></span></div>
    <div class="mbar" style="margin-top:6px"><i style="width:${Math.min(100,t.kcal/T.kcal*100)}%"></i></div>
    <div class="links" style="margin-top:10px"><span onclick="EN.openOther()">+ Etwas anderes gegessen</span><span style="color:var(--amber)" onclick="EN.openSOS()">Lust auf Süßes?</span></div>`;}
/* Trainingszeit ändern (heute oder im Voraus); aus der Vorschau geht es danach dorthin zurück */
let tzBack=false;
const hmShort=m=>hm(m).replace(/^0/,'');
EN.openTime=(k,back)=>{tzBack=!!back;const D=dayOf(k),def=tzDef(D.md);
  sheet(`<div class="km">${k===TODAY()?'Heute':D.wd+' '+OKT(k)} · ${esc(D.train)}</div><h3>Wann trainierst du?</h3>
    <div class="egrid">${TZ.map(z=>`<button class="opt ${D.tz===z?'on':''}" onclick="EN.setTime('${k}','${z}')">${TZL[z][0].toUpperCase()+TZL[z].slice(1)}<small>ca. ${hmShort(tMin(z,D.md))} Uhr${z===def?' · Standard':''}</small></button>`).join('')}</div>
    <div class="sub" style="margin-top:10px;font-size:13px">Snack davor, Shake danach und die Mahlzeiten passen sich an.</div>
    <button class="cancel" onclick="${tzBack?`EN.openDay('${k}')`:'closeSheet()'}">${tzBack?'Zurück':'Abbrechen'}</button>`);};
EN.setTime=(k,z)=>{const D=dayOf(k);if(z===tzDef(D.md))delete FS().tt[k];else FS().tt[k]=z;RS();if(tzBack)EN.openDay(k);else closeSheet();};
/* Tagesvorschau aus „Danach“: derselbe Ablauf, Mahlzeiten ohne Abhaken */
EN.openDay=k=>{const D=dayOf(k),T=TT[D.type],e=D.e;
  const tr=D.train?`<div class="slot train"><div class="body"><div class="when"><i class="ic">🏋️</i>Training · <span class="tzc" onclick="EN.openTime('${k}',1)">${TZL[D.tz]} ⌄</span>${D.len?` · <span>${D.len}</span>`:''}</div>
      <div class="n">${esc(D.train)}</div>${e.d?`<div class="d">${esc(daySub(e.d))}</div><div class="lk" style="margin-top:4px;font-size:13.5px" onclick="closeSheet();location.hash='#d/${e.d.pi}/${e.d.wi}/${e.d.di}'">Einheit ansehen ›</div>`:''}</div></div>`
    :`<div class="slot train"><div class="body"><div class="when"><i class="ic">🏋️</i>Training</div><div class="n">${D.off?'Geht nicht':'Ruhetag'}</div></div></div>`;
  sheet(`<div class="between"><span class="km">${D.wd} ${OKT(k)}</span><span class="echip lime">${T.l} · ${T.kcal.toLocaleString('de-DE')} kcal</span></div>
    <div class="en tl">${D.train?mealList(D,'pre','EN.openMealB')+tr:tr}${mealList(D,'post','EN.openMealB')}</div>
    <button class="cancel" onclick="closeSheet()">Schließen</button>`);};

/* Kleine Felder statt Checkliste: nichts ist Pflicht, eingetragene Werte stehen direkt im Feld */
const fmtKg=v=>v.toFixed(1).replace('.',',')+' kg';
const fmtCm=v=>v.toFixed(1).replace('.',',')+' cm';
function lastOf(f,k){const ks=Object.keys(H.days).filter(x=>x<=k&&H.days[x][f]).sort();return ks.length?H.days[ks[ks.length-1]][f]:null;}
/* Messwerte erscheinen erst wieder nach n Tagen und bleiben, bis etwas eingetragen ist: Gewicht alle 3, Taille alle 6 Tage */
const MEASURE={weight:3,waist:6};
function sinceLast(f,k){const ks=Object.keys(H.days).filter(x=>x<k&&H.days[x][f]).sort();return ks.length?diff(k,ks[ks.length-1]):999;}
const showMeasure=(f,k)=>!!NS(k)[f]||sinceLast(f,k)>=MEASURE[f];
function quickRow(D){const s=NS(D.k),N=nextWorkDay(D);
  /* Rucksack immer sichtbar, wenn morgen gearbeitet wird; Label nennt, was heute Abend zu tun ist */
  const todo=N?['packen',...(packData(N).prep.some(p=>/TK|auftauen/i.test(p[0]))?['auftauen']:[]),...(packData(N).prep.some(p=>/Eier kochen/.test(p[0]))?['Eier kochen']:[])].join(' · '):'';
  const q=(on,label,fn,due)=>`<button class="q ${on?'on':''}${due?' due':''}" onclick="${fn}">${label}</button>`;
  return `<div class="qrow">
    ${showMeasure('weight',D.k)?q(s.weight,s.weight?'⚖️ '+fmtKg(s.weight):'⚖️ Gewicht','EN.openMeasure(\'weight\')',!s.weight):''}
    ${showMeasure('waist',D.k)?q(s.waist,s.waist?'📏 '+fmtCm(s.waist):'📏 Taille','EN.openMeasure(\'waist\')',!s.waist):''}
    ${q(s.haut,s.haut?'Haut '+s.haut:'Haut','EN.openSkin()')}
    ${q(s.crave>=0,s.crave>=0?'Heißhunger: '+['nein','etwas','stark'][s.crave]:'Heißhunger','EN.openCrave()')}
    ${N?q(s.packed,s.packed?'🎒 Für '+N.wd+' erledigt':'🎒 Für '+N.wd+': '+todo,`location.hash='#food/pack'`):''}
    ${(()=>{const hw=homewayToday();return hw.length?q(false,'🛒 Heimweg: '+hw.map(r=>nameOf(r.it)).join(', '),`EN.shopMode('shop');location.hash='#food/einkauf'`):'';})()}
  </div>`;}
/* Gewicht und Taille: Zahl direkt eintippen oder mit − / + anpassen */
const MS={weight:{t:'Gewicht',sub:'morgens, nüchtern, nach der Toilette',step:.1,def:85,fmt:fmtKg,u:'kg'},
  waist:{t:'Taille',sub:'morgens, nüchtern · Nabelhöhe, Bauch locker, normal ausatmen · 3× messen, Mittelwert',step:.5,def:90,fmt:fmtCm,u:'cm'}};
let mf='weight',mv=0;
EN.openMeasure=f=>{mf=f;const k=TODAY();mv=NS(k)[f]||lastOf(f,k)||MS[f].def;drawMeasure();};
EN.openWeight=()=>EN.openMeasure('weight');
function drawMeasure(){const M=MS[mf];sheet(`<h3>${M.t}</h3><div class="sub">${M.sub}</div>
  <div class="wrow"><button class="pill" onclick="EN.mAdj(-1)">−</button><span class="numw"><input id="mIn" class="numin" inputmode="decimal" value="${mv.toFixed(1).replace('.',',')}" onfocus="this.select()"><i>${M.u}</i></span><button class="pill" onclick="EN.mAdj(1)">+</button></div>
  <button class="btn" onclick="EN.mSave()">Eintragen</button>${NS(TODAY())[mf]?`<button class="cancel" onclick="EN.mSave(true)">Eintrag löschen</button>`:'<button class="cancel" onclick="closeSheet()">Abbrechen</button>'}`);}
const mRead=()=>{const x=parseFloat(String((document.getElementById('mIn')||{}).value||'').replace(',','.'));if(x>0)mv=x;};
EN.mAdj=n=>{mRead();mv=Math.round((mv+n*MS[mf].step)*10)/10;drawMeasure();};
EN.mSave=del=>{const s=NS(TODAY());if(del)delete s[mf];else{mRead();s[mf]=Math.round(mv*10)/10;}closeSheet();R();};
/* Haut 1–5: höher = schlimmer. Bewertet wird der ganze Körper, die schlimmste Stelle setzt die Stufe. */
const SKIN=[['Ruhig','nichts Entzündetes · höchstens ein winziger Pickel'],
  ['Leicht','ein paar normale Pickel, egal wo'],
  ['Deutlich','viele normale Pickel oder ein tiefer, entzündeter Knoten'],
  ['Stark','großer, schmerzhafter Knoten oder Abszess, oder mehrere Knoten'],
  ['Schub','breitet sich aus oder schwillt an · sehr schmerzhaft · Arzt nötig']];
const SKAT=['Gesicht','Hals/Nacken','Schulter/Rücken','Brust','Achsel','Leiste/Po','andere'];
EN.openSkin=()=>{const s=NS(TODAY()),at=s.skinAt;sheet(`<h3>Haut</h3><div class="sub">Ganzer Körper · die schlimmste Stelle zählt</div>
  <div class="list skl">${SKIN.map(([n,t],i)=>`<div class="it ${s.haut===i+1?'got':''}" onclick="EN.setSkin(${i+1})"><span class="skn">${i+1}</span><div style="flex:1;min-width:0">${n}<small>${t}</small></div></div>`).join('')}</div>
  ${s.haut>=2?`<div class="km sec">Wo? <span class="meta">optional</span></div><div class="chips">${SKAT.map(x=>`<button class="${at.includes(x)?'on':''}" onclick="EN.skinAt('${x}')">${x}</button>`).join('')}</div>`:''}
  <div class="hint"><b>Pickel:</b> klein, oberflächlich, oft mit weißem Kopf, weg nach ein paar Tagen. <b>Knoten:</b> tief unter der Haut, fühlt sich an wie eine Erbse, tut weh, kommt gern an derselben Stelle wieder. Mehrere Knoten gleichzeitig: eine Stufe höher.</div>
  ${s.haut>=4&&!hwDay(TODAY())?`<button class="btn ghost" onclick="EN.openHwStart()">Schub? Heilungsfenster starten</button>`:''}<button class="cancel" onclick="closeSheet()">Fertig</button>`);};
EN.skinAt=x=>{const a=NS(TODAY()).skinAt,i=a.indexOf(x);if(i<0)a.push(x);else a.splice(i,1);R();EN.openSkin();};
EN.openCrave=()=>sheet(`<h3>Heißhunger heute?</h3>${mini(['nein','etwas','stark'],NS(TODAY()).crave,'EN.setCrave',0)}<button class="cancel" onclick="closeSheet()">Fertig</button>`);

EN.setSkin=v=>{NS(TODAY()).haut=v;R();EN.openSkin();};
EN.setCrave=v=>{NS(TODAY()).crave=v;closeSheet();R();};
EN.med=(k,m)=>{const s=NS(k);s.meds[m]=!s.meds[m];R();};
EN.flag=(k,f)=>{const s=NS(k);s[f]=!s[f];R();};
EN.water=n=>{const s=NS(TODAY());s.water=Math.max(0,s.water+n);R();};
EN.eat=(k,id)=>{const s=NS(k),D=dayOf(k);s.st[id]='eaten';applyUse(k,id,1);if(id===addonSlot(D))supOn().forEach(x=>{s.meds[x.n]=true;});closeSheet();R();};
EN.toggleMeal=(k,id)=>{const s=NS(k);if(s.st[id]){delete s.st[id];applyUse(k,id,0);R();}else EN.eat(k,id);};
EN.setSt=(k,id,st)=>{NS(k).st[id]=st;applyUse(k,id,st==='eaten'?1:st==='half'?.5:0);closeSheet();R();};
EN.swap=(k,id,v)=>{NS(k).sw[id]=v;R();EN.openMeal(k,id,mealBack);};

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
/* Zu zweit: Faktor aus den Einstellungen (Start 1,7 = deine 1,5 Buchportionen + 1 Portion für die zweite Person) */
const GK={protein:'Fisch, Fleisch, Eier',beilage:'Beilagen (Kartoffeln, Reis, Nudeln, Brot)',other:'Gemüse und Rest'};
const gF=kd=>{const own=(FS().set.guest||{})[kd];if(own!=null)return own;const c=(C&&C.guest)||{};return c[kd]!=null?c[kd]:(c.other||1.7);};
const kindOf=it=>{const I=IT()[it];return I&&I.kind==='protein'?'protein':I&&I.kind==='beilage'?'beilage':'other';};
const gFit=it=>gF(it?kindOf(it):'other');
const gLabel=()=>`Fisch/Fleisch ×${String(gF('protein')).replace('.',',')} · Beilage ×${String(gF('beilage')).replace('.',',')} · Rest ×${String(gF('other')).replace('.',',')}`;
const isGuest=(k,id)=>!!(k&&id&&NS(k).guests[id]);
const fmtN=n=>{if(n>=50)return String(Math.round(n/10)*10);const h=Math.round(n*2)/2,w=Math.floor(h);return h%1?(w?w+'½':'½'):String(h);};
const scaleAmt=(t,f)=>f===1||!t?t:String(t).replace(/(\d+(?:[.,]\d+)?|½|¼)(\s*(?:–|-)\s*(\d+(?:[.,]\d+)?))?/g,(m,a,r,b)=>{const v=x=>x==='½'?.5:x==='¼'?.25:parseFloat(String(x).replace(',','.'));return fmtN(v(a)*f)+(b?'–'+fmtN(v(b)*f):'');});
/* bei Batch-Gerichten (×4) wird nur „deine Portion“ hochgerechnet, dafür eine Portion weniger für den TK */
const scaleRow=(X,label)=>!X.yields||/nur deine Portion/.test(label);
/* Detailansicht schlank: Nährwerte als eine Zeile, Status als Leiste, Tauschen als eine Zeile, Zubereitung zugeklappt */
const macLine=(v,i)=>{const m=mac(v,i),X=V[v];return `<div class="mline">${m.kcal} kcal · P ${m.p} · KH ${m.c} · F ${m.f}${X.time?' · ⏱ '+X.time:''}</div>`;};
/* Zutaten gruppiert: Gericht · Beilage · Öl & Gewürze. Nur bei Gerichten mit Eiweißquelle; Snacks und Boxen (· Unterzeilen)
   bleiben eine Liste. noSide in nutrition.json: Beilage gehört zum Gericht (Kartoffel-Ei-Pfanne, Wrap). */
const BASIC_RE=/öl\b|öl über|salz|pfeffer|oregano|paprikapulver|zimt|ingwer|knoblauch|marinade|zitrone/i;
function ingGroups(X,rows,k){const I=IT();
  if(rows.some(r=>/^·/.test(r[0]))||!rows.some(r=>r[3]&&I[r[3]]&&I[r[3]].kind==='protein'))return ingHTML(rows,k);
  const grp=r=>/^Ingwer, frisch/.test(r[0])?(X.noSide?'main':'side'):BASIC_RE.test(r[0])?'basic':!X.noSide&&((r[3]&&I[r[3]]&&I[r[3]].kind==='beilage')||/^(Obst|Apfel|Banane)/.test(r[0]))?'side':'main';   /* ein Stück Ingwer isst man, es ist kein Gewürz */
  const by={main:[],side:[],basic:[]};rows.forEach(r=>by[grp(r)].push(r));
  return ingHTML(by.main,k)+[['side','Beilage'],['basic','Öl & Gewürze']].filter(([g])=>by[g].length).map(([g,l])=>`<div class="km ing-sec">${l}</div>${ingHTML(by[g],k)}`).join('');}
function ingBlock(v,i,k,g,lbl,gBtn){const X=V[v];
  const rows=X.ing(i,k).map(r=>{const sb=r[3]&&subOf(r[3]);if(sb)r=[r[0].replace(IT()[r[3]].n,IT()[sb].n),r[1],r[2],sb];return g&&scaleRow(X,r[0])?[r[0],scaleAmt(r[1],gFit(r[3])),r[2]]:r;});
  return `<div class="between sec2"><span class="km">Zutaten${lbl?' · '+lbl:''}</span>${gBtn||''}</div>${ingGroups(X,rows,k)}
    ${g?`<div class="sub" style="font-size:12px;margin-top:4px">Zu zweit: ${gLabel()}${X.yields?` · ${X.yields.bolotk-1} statt ${X.yields.bolotk} Portionen für den TK`:''}</div>`:''}`;}
function stepsBlock(v,k,open){const X=V[v],st=X.steps(k);if(!st.length&&!X.tip)return '';
  return `<details class="stp2" ${open?'open':''}><summary><span class="km">Zubereitung</span><span class="meta">${st.length} ${st.length===1?'Schritt':'Schritte'} ›</span></summary><ol class="steps">${st.map(x=>`<li>${x}</li>`).join('')}</ol>${X.tip?`<div class="hint amb">${X.tip}</div>`:''}</details>`;}
let mealBack=false;
EN.guest=(k,id)=>{const g=NS(k).guests;if(g[id])delete g[id];else g[id]=true;R();EN.openMeal(k,id,mealBack);};
EN.openMealB=(k,id)=>EN.openMeal(k,id,true);
EN.openMeal=function(k,id,back){mealBack=!!back;const D=dayOf(k),i=pix(D,id),s=NS(k),v=varOf(D,id),X=V[v],sl=D.slots.find(x=>x[0]===id),at=sl[2],K=`'${k}'`;
  const alts=(ALT[id]||[]).filter(a=>a!==v&&(at!=='work'||V[a].at==='work')),st=s.st[id]||'',exc=s.exc.find(e=>e.slot===id);
  const gBtn=at==='home'?`<button class="gbtn ${isGuest(k,id)?'on':''}" onclick="EN.guest(${K},'${id}')">👥 zu zweit${isGuest(k,id)?' ✓':''}</button>`:'';
  sheet(`<div class="km">${k===TODAY()?'Heute':D.wd} · ${SL[id][0]} · ${slotWhen(D,sl)}${at!=='home'?' · '+AT[at]:''}</div>
    ${SNACK.includes(id)?`<h3>${X.d(i)}</h3>`:`<h3>${X.n}</h3><div class="sub">${X.d(i)}</div>`}${macLine(v,i)}
    ${k<=TODAY()?`<div class="stbar"><button class="${st==='eaten'?'on':''}" onclick="EN.eat(${K},'${id}')">✓ Gegessen</button><button class="${st==='half'?'on':''}" onclick="EN.setSt(${K},'${id}','half')">½ Halb</button><button class="${st==='skip'?'on':''}" onclick="EN.setSt(${K},'${id}','skip')">✕ Nicht</button><button class="${exc?'on':''}" onclick="EN.openExc(${K},'${id}')">! Anders</button></div>`:''}
    ${alts.length?`<div class="it2" onclick="EN.openSwap(${K},'${id}')"><span>Tauschen</span><span class="meta">${alts.length} ${alts.length===1?'Alternative':'Alternativen'} ›</span></div>`:''}
    ${ingBlock(v,i,k,isGuest(k,id),'',gBtn)}${stepsBlock(v,k,false)}
    <button class="cancel" onclick="${mealBack?`EN.openDay('${k}')`:'closeSheet()'}">${mealBack?'Zurück':'Schließen'}</button>`);};
EN.openSwap=(k,id)=>{const D=dayOf(k),v=varOf(D,id),at=D.slots.find(x=>x[0]===id)[2],i=pix(D,id);
  const alts=[v,...(ALT[id]||[]).filter(a=>a!==v&&(at!=='work'||V[a].at==='work'))];
  sheet(`<div class="km">${D.k===TODAY()?'Heute':D.wd} · ${SL[id][0]}</div><h3>Stattdessen</h3>${at==='work'?'<div class="sub">🎒 nur Kaltes und Mitnehmbares</div>':''}
    <div class="list">${alts.map(a=>`<div class="it" onclick="EN.swap('${k}','${id}','${a}')"><div style="flex:1;min-width:0">${V[a].n}<small>${V[a].d(i)}</small></div><span class="meta">${a===v?'aktuell':mac(a,i).kcal+' kcal'}</span></div>`).join('')}</div>
    <button class="cancel" onclick="EN.openMeal('${k}','${id}',${mealBack})">Zurück</button>`);};
let recI=2;
EN.openRecipe=function(v,ii){if(ii!=null)recI=ii;const X=V[v],k=TODAY();
  sheet(`<div class="between"><h3>${X.n}</h3><span class="echip" style="${X.at==='work'?'color:var(--sky)':''}">${AT[X.at]}</span></div>
    <div class="row" style="margin-top:10px">${TL.map((l,n)=>`<button class="pill ${n===recI?'on':''}" onclick="EN.openRecipe('${v}',${n})">${l.replace(' Tag','')}</button>`).join('')}</div>
    <div class="sub" style="margin-top:8px">${X.d(recI)}</div>${macLine(v,recI)}${ingBlock(v,recI,k,false,TL[recI])}${stepsBlock(v,k,true)}<button class="cancel" onclick="closeSheet()">Schließen</button>`);};
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
EN.saveExc=()=>{if(exSel===null)return;const [n,,,m]=EXC[exSel];NS(exK).exc.push({kind:n,size:exSize,slot:exSlot||'extra',m});if(exSlot&&exSlot!=='extra')applyUse(exK,exSlot,0);closeSheet();R();};
EN.openOther=()=>sheet(`<h3>Etwas anderes gegessen</h3><div class="km sec">Zusätzlich (ein Tipp)</div><div class="egrid">${XTRA.map(([n,m],j)=>`<button class="opt" onclick="EN.addExtra(${j})">${n}<small>${m.kcal} kcal</small></button>`).join('')}</div>
  <button class="btn ghost" onclick="EN.openExc()">Statt einer Mahlzeit oder Ausnahme (Pizza, Bestellt …) ›</button><button class="cancel" onclick="closeSheet()">Abbrechen</button>`);
EN.openExtra=()=>sheet(`<h3>Extra</h3><div class="sub">Grob, kein Abwiegen. Ein Tipp genügt.</div><div class="egrid">${XTRA.map(([n,m],j)=>`<button class="opt" onclick="EN.addExtra(${j})">${n}<small>${m.kcal} kcal</small></button>`).join('')}</div><button class="cancel" onclick="closeSheet()">Abbrechen</button>`);
EN.addExtra=j=>{const [n,m]=XTRA[j];NS(TODAY()).extra.push({...m,n});closeSheet();R();};
EN.openSOS=()=>{const D=dayOf(TODAY()),T=TT[D.type],open=Math.round(T.kcal-totals(D).kcal);
  sheet(`<h3>Lust auf Süßes?</h3><div class="hint">${open>400?`<b>Dir fehlen heute noch ${open} kcal.</b> Heißhunger ist oft einfach Hunger. Iss zuerst die nächste Mahlzeit, dann schau, ob die Lust noch da ist.`:`<b>Du hast heute genug gegessen.</b> Ein Glas Wasser, 10 Minuten warten, oder eine Alternative.`}</div>
    <div class="km sec">Alternativen</div><div class="egrid">${SOS.filter(o=>!(o.hw===false&&hwDay(TODAY()))).map(o=>{const miss=(o.items||[]).filter(it=>!hasNow(it)).map(nameOf);
      return `<button class="opt ${miss.length?'miss':''}"><span class="dot ${o.c}"></span>${o.n}<small>${String(o.s).replace('{SEASON}',season())}${miss.length?`<br>fehlt: ${miss.join(', ')}`:''}</small></button>`;}).join('')}</div>
    <button class="btn ghost" onclick="EN.openExc()">Trotzdem → als Ausnahme eintragen</button><button class="cancel" onclick="closeSheet()">Schließen</button>`);};

let hwConfirm=false;
EN.openHw=function(){const k=TODAY(),h=hwDay(k);
  if(hwConfirm)return sheet(`<h3>Heilungsfenster beenden?</h3><div class="sub" style="margin-top:6px">Danach gilt wieder Stufe 1 (hinzufügen statt weglassen). Milch und Süßes sind dann wieder normale Ausnahmen, die die App nur sichtbar macht.</div>
    <div class="hint amb"><b>Faustregel:</b> erst beenden, wenn die Haut an 3 Tagen in Folge bei 1 oder 2 liegt und die Rötung deutlich abgeklungen ist.</div>
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
EN.gf=(kd,dir)=>{const g=FS().set.guest||(FS().set.guest={});g[kd]=Math.max(1,Math.min(3,Math.round((gF(kd)+dir*.1)*10)/10));R();EN.openGuest();};
EN.openGuest=()=>sheet(`<h3>Zu zweit</h3><div class="sub">Wie viel mehr ihr zu zweit braucht als du allein, je nach Art der Zutat.</div>
  ${Object.keys(GK).map(kd=>`<div class="km sec">${GK[kd]}</div><div class="wrow"><button class="pill" onclick="EN.gf('${kd}',-1)">−</button><b>×${String(gF(kd)).replace('.',',')}</b><button class="pill" onclick="EN.gf('${kd}',1)">+</button></div>`).join('')}
  <button class="cancel" onclick="closeSheet()">Fertig</button>`);
EN.fastToggle=()=>{ST.fast=!ST.fast;R();};
const RS=()=>{EN.fresh();R();};
/* Schlafenszeit */
EN.openBed=()=>sheet(`<h3>Schlafenszeit</h3><div class="sub">Unter der Woche. Das Abendessen liegt 1,5 h davor, eine Spätmahlzeit gibt es nicht.</div>
  <div class="wrow"><button class="pill" onclick="EN.bedAdj(-1)">−</button><b>${BED()}</b><button class="pill" onclick="EN.bedAdj(1)">+</button></div>
  <div class="hint" style="text-align:center">Abendessen bis <b>${DINNER_BY()}</b></div><button class="cancel" onclick="closeSheet()">Fertig</button>`);
EN.bedAdj=n=>{FS().set.bed=Math.max(1200,Math.min(1470,BEDM()+n*15));RS();EN.openBed();};
/* Arbeit */
const step=(fn,v)=>`<span class="stp"><button class="pill" onclick="${fn}(-1)">−</button><b>${v}</b><button class="pill" onclick="${fn}(1)">+</button></span>`;
EN.openWork=()=>sheet(`<h3>Arbeit</h3><div class="sub">Ganztags: Mittag und Nachmittag zum Mitnehmen (🎒). Bis mittags: Mittag zuhause. Frei: wie am Wochenende, ohne Fasten.</div>
  ${WO.map(w=>`<div class="drow"><b>${WDL[w]}</b>${mini(WML,WM.indexOf(workMode(w)),`((m)=>EN.wMode(${w},m))`,0)}</div>`).join('')}
  <div class="km sec">Zeiten</div>
  ${['voll','halb'].map((m,j)=>`<div class="drow t"><span>${WML[j]}</span>${step(`((n)=>EN.wT('${m}',0,n))`,workTime(m)[0])}<i>bis</i>${step(`((n)=>EN.wT('${m}',1,n))`,workTime(m)[1])}</div>`).join('')}
  <button class="cancel" onclick="closeSheet()">Fertig</button>`);
EN.wMode=(w,m)=>{const o=FS().set.work||(FS().set.work={});o[w]=WM[m];RS();EN.openWork();};
EN.wT=(m,i,n)=>{const o=FS().set.wt||(FS().set.wt={}),t=workTime(m).slice();t[i]=Math.max(4,Math.min(22,t[i]+n));if(t[0]<t[1]){o[m]=t;RS();}EN.openWork();};
/* Freie Mahlzeiten */
const rolesOf=w=>workMode(w)==='frei'?['fr','mi','na','ab']:[...(ST.fast?[]:['vm']),'mi','na','ab'];
EN.openFree=()=>sheet(`<h3>Freie Mahlzeiten</h3><div class="sub">Ohne Plan, z. B. Essen mit Freunden. Sie zählen nicht in Einkauf und Vorrat.</div>
  ${WO.map(w=>`<div class="drow"><b>${WDL[w]}</b><div class="mini">${rolesOf(w).map(r=>`<button class="${freeOf(w).includes(r)?'on':''}" onclick="EN.freeT(${w},'${r}')">${RN[r]}</button>`).join('')}</div></div>`).join('')}
  <button class="cancel" onclick="closeSheet()">Fertig</button>`);
EN.freeT=(w,r)=>{const f=FS().set.free||(FS().set.free={}),l=freeOf(w);f[w]=l.includes(r)?l.filter(x=>x!==r):[...l,r];if(!f[w].length)delete f[w];RS();EN.openFree();};
/* Supplements */
const supEdit=()=>FS().set.sup||(FS().set.sup=cl(supList()));
EN.openSup=()=>sheet(`<h3>Supplements</h3><div class="sub">Hängen am Mittag und werden mit ihm abgehakt. Ist das Mittag 🎒, stehen sie auf der Packliste.</div>
  ${supList().map((x,i)=>`<div class="srow"><div>${esc(x.n)}<small>${esc(x.d||'')}</small></div><span class="row"><button class="btn sm ghost" onclick="EN.supT(${i})">${x.on===false?'aus':'an'}</button><button class="btn sm ghost" onclick="EN.supDel(${i})" aria-label="entfernen">✕</button></span></div>`).join('')||'<div class="hint">Keine Supplements eingetragen.</div>'}
  <div class="km sec">Hinzufügen</div><div class="addrow"><input id="supN" class="tx" placeholder="Name"><input id="supD" class="tx sm" placeholder="Menge"></div>
  <button class="btn" onclick="EN.supAdd()">Hinzufügen</button><button class="cancel" onclick="closeSheet()">Fertig</button>`);
EN.supT=i=>{const l=supEdit();l[i].on=l[i].on===false;if(l[i].on)delete l[i].on;R();EN.openSup();};
EN.supDel=i=>{supEdit().splice(i,1);R();EN.openSup();};
EN.supAdd=()=>{const n=document.getElementById('supN').value.trim(),d=document.getElementById('supD').value.trim();if(!n)return;supEdit().push(d?{n,d}:{n});R();EN.openSup();};
EN.protToggle=()=>{ST.protein=ST.protein==='plant'?'whey':'plant';R();};
EN.breadToggle=()=>{FS().set.bread=toastOn()?'roggen':'toast';RS();};

/* =====================================================================
   SEITE „ERNÄHRUNG“ (Planung): Tage · Woche · Rezepte · Einkauf · Vorrat · Packliste
   ===================================================================== */
let selK=null;const ingOpen={};
const isIngOpen=k=>k in ingOpen?ingOpen[k]:k===TODAY();   /* heute offen, andere Tage eingeklappt */
EN.togIng=()=>{ingOpen[selK]=!isIngOpen(selK);render();};
EN.ingTick=(k,it)=>{const g=NS(k).ing;if(g[it])delete g[it];else g[it]=true;R();};
/* Über welche gegessene Mahlzeit ist eine Zutat schon abgedeckt? */
function ateVia(D,it){const s=NS(D.k);for(const id of mealIds(D)){if(!(s.st[id]==='eaten'||s.st[id]==='half'))continue;const X=C.dishes[varOf(D,id)];if(!X||!X.use)continue;const i=pix(D,id);
  if(Object.entries(X.use).some(([it0,q])=>itemFor(it0,D.k)===it&&(q[i]||IT()[it].unit==='basic')))return SL[id][0];}return '';}
/* Zum Abhaken und Zählen: ohne Öl, Salz, Gewürze (die isst niemand einzeln, sie kommen mit der Mahlzeit) */
const tickIds=D=>Object.keys(dayIngredients(D)).filter(it=>(IT()[it]||{}).unit!=='basic');
/* alle Zutaten eines Tages (mit „zu zweit“), it → Menge */
function dayIngredients(D){const tot={};mealIds(D).forEach(id=>{const X=C.dishes[varOf(D,id)];if(!X||!X.use)return;const i=pix(D,id),g=isGuest(D.k,id);
  Object.entries(X.use).forEach(([it0,q])=>{const it=itemFor(it0,D.k),I=IT()[it];if(!I)return;const f=g&&(!X.yields||kindOf(it)==='beilage')?gFit(it):1;
    if(I.unit!=='basic'&&!q[i])return;tot[it]=(tot[it]||0)+(I.unit==='basic'?0:qB(it0,q[i])*f);});});return tot;}
EN.render=function(main,sub){EN.fresh();if(!C){main.innerHTML='<div class="en"><div class="ecard"><span class="k">Ernährung</span><div class="sub" style="margin-top:6px">Keine Inhalte gefunden: <b>nutrition.json</b> fehlt im Daten-Repo.</div></div></div>';return;}sub=sub||'tage';const tabs=[['tage','Tage'],['woche','Woche'],['einkauf','Einkauf'],['vorrat','Vorrat'],['rezepte','Rezepte']];
  let h=`<div class="en">${sub==='pack'?'':`<div class="seg">${tabs.map(([k,l])=>`<button class="${k===sub?'on':''}" onclick="location.hash='#food/${k}'">${l}</button>`).join('')}</div>`}`;
  h+=({tage:pTage,woche:pWoche,einkauf:pEinkauf,vorrat:pVorrat,rezepte:pRezepte,pack:pPack}[sub]||pTage)();
  main.innerHTML=h+'</div>';};
const days7=()=>Array.from({length:7},(_,n)=>addD(TODAY(),n));
EN.sel=k=>{selK=k;render();};
function pTage(){const ks=days7();if(!selK||!ks.includes(selK))selK=ks[0];const D=dayOf(selK),T=TT[D.type],t=totals(D),i=T.i,K=`'${D.k}'`;
  let h=`<div class="daychips">${ks.map(k=>{const d=dayOf(k);return `<button class="${k===selK?'on':''}" onclick="EN.sel('${k}')"><b>${d.wd}</b>${D_(k).getDate()}.<i class="ty-${d.type}"></i></button>`;}).join('')}</div>`;
  h+=`<div class="ecard"><div class="between"><span class="k">${selK===TODAY()?'Heute · ':''}${D.wd} ${OKT(D.k)}</span><span class="echip lime">${T.l}</span></div><div class="sub" style="margin-top:2px">${D.train?esc(D.train)+(D.len?' · '+D.len:''):D.off?'Geht nicht':'kein Training'}</div>
    <div class="bil">${ringSVG(t.kcal/T.kcal,Math.round(t.kcal),'von '+T.kcal)}${macHTML(t,T)}</div></div>`;
  h+=`<div class="ecard"><span class="km">Tagesablauf</span>`;
  h+=`<div class="en tl">${mealList(D,'pre')}${D.train?`<div class="trainline" onclick="EN.openTime('${D.k}')"><i class="ic">🏋️</i>Training <span class="tzc">${TZL[D.tz]} ⌄</span></div>`:''}${mealList(D,'post')}</div>`;
  const eb=basisOf(D),pb=planBasis(D),pn=BASIS.filter(b=>pb.has(b)),got=BASIS.filter(b=>eb.has(b));
  h+=`</div><div class="ecard"><div class="between"><span class="km">Pyramiden-Basis</span><span class="meta">${pn.filter(b=>eb.has(b)).length} / ${pn.length} geplant${got.length>pn.filter(b=>eb.has(b)).length?' · +'+(got.length-pn.filter(b=>eb.has(b)).length)+' extra':''}</span></div>
    <div class="basis">${BASIS.map(b=>`<span class="${eb.has(b)?'on':pb.has(b)?'':'np'}">${eb.has(b)?'✓ ':''}${b}</span>`).join('')}</div>
    ${BASIS.some(b=>!pb.has(b)&&!eb.has(b))?`<div class="sub" style="font-size:12px;margin-top:6px">Blass = heute nicht im Plan.</div>`:''}</div>`;
  /* Zutaten des Tages, nach Wichtigkeit; heute und vergangene Tage einzeln abhakbar */
  const tot=dayIngredients(D),ids=tickIds(D),can=D.k<=TODAY(),s0=NS(D.k);
  if(ids.length){const isDone=it=>!!ateVia(D,it)||!!s0.ing[it],nd=ids.filter(isDone).length,open=isIngOpen(D.k);
    h+=`<div class="ecard"><div class="between" style="cursor:pointer" onclick="EN.togIng()"><span class="km">Zutaten für ${D.k===TODAY()?'heute':D.wd} (${can?nd+' / ':''}${ids.length})</span><span class="meta">${open?'ausblenden':'anzeigen ›'}</span></div>`;
    if(open){if(can)h+=`<div class="sub" style="font-size:12px;margin-top:4px">Abhaken, was du gegessen hast, auch ohne die ganze Mahlzeit. Zählt für die Pyramiden-Basis.</div>`;
      const P=(C.prios)||{must:'Must-have',protein:'Protein',veg:'Gemüse & Obst',rest:'Rest'};
      Object.keys(P).forEach(pr=>{const xs=ids.filter(it=>(IT()[it].prio||'rest')===pr);if(!xs.length)return;
        h+=`<div class="km hl" style="margin-top:12px">${P[pr]}</div><div class="list">${xs.map(it=>{const via=ateVia(D,it),on=!!via||!!s0.ing[it],
          q=fmtQ(it,['Stück','Dose','Scheiben','Packung','Portion'].includes(IT()[it].unit)?Math.ceil(tot[it]-1e-9):tot[it])||'',b=IT()[it].basis;
          return `<div class="it ${on&&can?'got':''}" onclick="${can&&!via?`EN.ingTick('${D.k}','${it}')`:`EN.openItem('${it}')`}">${can?`<span class="ecb ${on?'on':''}"></span>`:''}<div style="flex:1;min-width:0">${nameOf(it)}<small>${[b?'Basis: '+b:'',via?'über '+via:''].filter(Boolean).join(' · ')}</small></div><span class="meta">${q}</span>${infoBtn(it)}</div>`;}).join('')}</div>`;});}
    h+=`</div>`;}
  const N=nextWorkDay(D);if(N)h+=`<button class="btn ghost" onclick="location.hash='#food/pack'">🎒 Packliste für ${N.wd} ${OKT(N.k)}</button>`;
  return h;}
function pWoche(){const ab=days7().map(k=>varOf(dayOf(k),'ab')),cnt=g=>ab.filter(v=>(GROUPS[g]||[]).includes(v)).length;
  const goals=[['Fisch abends',cnt('fish')+' / 3',cnt('fish')>=3?'ok':'warn'],['Rotes Fleisch',cnt('red')+' / max. 3',cnt('red')<=3?'ok':'warn']];
  let h=`<div class="ecard"><span class="km">Wochenziele</span>${goals.map(([a,b,c])=>`<div class="goal"><span>${a}</span><b class="${c}">${b}</b></div>`).join('')}</div><div class="ecard">`;
  days7().forEach(k=>{const D=dayOf(k),T=TT[D.type];h+=`<div class="wd" onclick="EN.sel('${k}');location.hash='#food/tage'"><div class="between"><b>${D.wd} ${OKT(k)}</b><span class="echip ${D.type==='rest'?'':'lime'}">${T.l} · ${T.kcal}</span></div>${D.train?`<div class="ln"><span style="color:var(--lime)">Training</span><span style="color:var(--lime)">${esc(D.train)}</span></div>`:''}${mealIds(D).map(id=>`<div class="ln"><span>${SL[id][0]}${D.slots.find(x=>x[0]===id)[2]==='work'?' 🎒':''}</span><span>${V[varOf(D,id)].n}</span></div>`).join('')}</div>`;});
  return h+'</div>';}
/* =====================================================================
   EINKAUF + VORRAT (einfach, 01.10. abends nach Marcs Vorschlag)
   Einkauf = „Stell sicher, dass das die nächsten 7 Tage da ist“, mit Tag.
     Frisches steht pro Tag, an dem es gebraucht wird (Heimweg am Vortag).
     Zuhause: „hab ich“ antippen (gilt 7 Tage) · Im Laden: abhaken, „Einkauf abschließen“.
   Vorrat = Grundvorrat (alles Haltbare): da / knapp / leer. Knapp und leer stehen auf der Liste.
   Keine Grammbuchhaltung. Gezählt werden nur selbst gekochte Bolognese-Portionen.
   ===================================================================== */
const IT=()=>C.items||{};
const STK=()=>FS().stock;
/* "protein" im Rezept = das Pulver, das an diesem Tag gilt (Heilungsfenster/Einstellung) */
const subOf=it=>{const sb=FS().subst[it];return sb&&IT()[sb]&&hasNow(sb)?sb:null;};
const itemFor=(it,k)=>it==='protein'?(plantProt(k)?'erbsenprotein':'whey'):it==='brot'&&toastOn()?'toast':(subOf(it)||it);
/* Grundvorrat: haltbare Artikel des Standardplans (min in nutrition.json) und Gewürze/Öl */
const season=()=>((C&&C.season)||{})[String(new Date().getMonth()+1)]||'';
const nameOf=it=>{const I=IT()[it];if(!I)return it;return it==='saisonobst'&&season()?`${I.n} (${season()})`:I.n;};
const isPantry=it=>{const I=IT()[it];return !!I&&it!=='bolotk'&&(I.unit==='basic'||I.pantry===true||(I.keep==='lang'&&(I.min||0)>0));};
const pState=it=>FS().pantry[it]||'';   /* '' = noch nicht geprüft */
/* Bolognese-Portionen im TK, die vor Tag k übrig sind (ab morgen die geplanten Abende) */
function tkLeft(k){let a=STK().bolotk||0;for(let d=addD(TODAY(),1);d<k;d=addD(d,1)){const D=dayOf(d);if(!mealIds(D).includes('ab')||NS(d).used.ab)continue;
  const v=varOf(D,'ab');if(v==='bolo')a+=isGuest(d,'ab')?2:3;if(v==='boloTK')a-=1;}return a;}
/* Beim Abhaken: nur Bolognese-Portionen zählen (gekocht +3, aufgetaut −1) und das Gericht festhalten */
function applyUse(k,id,f){if(!C)return;const D=dayOf(k),s=NS(k),X=C.dishes[varOf(D,id)];if(!X)return;
  const old=s.used[id]||0;if(f===old)return;const on=f>=1?1:0,was=old>=1?1:0,st=STK();
  if(f&&!s.sw[id])s.sw[id]=varOf(D,id);
  if(on!==was){const sg=on-was;
    if(X.use&&X.use.bolotk)st.bolotk=Math.max(0,(st.bolotk||0)-sg);
    if(X.yields&&X.yields.bolotk)st.bolotk=Math.max(0,(st.bolotk||0)+sg*(X.yields.bolotk-(isGuest(k,id)?1:0)));}
  if(f)s.used[id]=f;else delete s.used[id];}
const SHOPN=7,SOON=2;
/* Ist ein Artikel gerade da? Grundvorrat: Zustand da/knapp; sonst „hab ich“ diese Woche */
const hasNow=it=>isPantry(it)?['da','knapp'].includes(pState(it)):covered(it);
/* Wann wird was gebraucht? it → [{k,q}] für die nächsten 7 Tage ab morgen */
function occ(){const start=addD(TODAY(),1),o={};
  for(let n=0;n<SHOPN;n++){const k=addD(start,n),D=dayOf(k);
    mealIds(D).forEach(id=>{const X=C.dishes[varOf(D,id)];if(!X||!X.use)return;const i=pix(D,id),g=isGuest(k,id);
      Object.entries(X.use).forEach(([it0,q])=>{const it=itemFor(it0,k),I=IT()[it];if(!I)return;const f=g&&(!X.yields||kindOf(it)==='beilage')?gFit(it):1,v=I.unit==='basic'?0:qB(it0,q[i]||0)*f;
        if(!v&&I.unit!=='basic')return;(o[it]=o[it]||[]).push({k,q:v});});});}
  ((C&&C.always)||[]).forEach(a=>{if(IT()[a.it]&&!(a.hw===false&&hwDay(start)))(o[a.it]=o[a.it]||[]).push({k:start,q:a.q,why:a.why});});   /* immer da haben (Lust auf Süßes); Schokolade nicht im Heilungsfenster */
  return {o,start,end:addD(start,SHOPN-1)};}
const covered=id=>{const h=FS().have[id];if(!h)return false;const at=id.includes('@')?id.split('@')[1]:null;return at?at>=TODAY():diff(TODAY(),h)<7;};
/* Liste: Zeilen {id,it,q,k(ab/bis),later,pantry,state} */
function shopModel(){const {o,start,end}=occ(),rows=[];
  Object.keys(o).forEach(it=>{const I=IT()[it];if(!I||it==='bolotk'||isPantry(it))return;const xs=o[it];
    if(I.keep==='frisch'){const by={};xs.forEach(x=>{by[x.k]=(by[x.k]||0)+x.q;});
      Object.keys(by).sort().forEach(k=>rows.push({id:it+'@'+k,it,q:by[k],k,fresh:true,later:diff(k,start)>=SOON}));}
    else rows.push({id:it,it,q:xs.reduce((a,x)=>a+x.q,0),k:xs.map(x=>x.k).sort()[0],later:false});});
  Object.keys(IT()).filter(isPantry).forEach(it=>{const st=pState(it);if(st==='da'||IT()[it].noRestock)return;const xs=o[it]||[];
    if(!xs.length&&!st)return;   /* nicht geprüft und diese Woche nicht gebraucht: nicht stören */
    rows.push({id:it,it,q:xs.reduce((a,x)=>a+x.q,0),k:xs.length?xs.map(x=>x.k).sort()[0]:null,pantry:true,state:st});});
  return {rows,start,end};}
const fmtQ=(it,q)=>{const I=IT()[it];if(!I||I.unit==='basic'||!q)return '';
  if(I.unit==='g')return q>=1000?(q/1000).toFixed(1).replace('.',',')+' kg':Math.round(q)+' g';
  if(I.unit==='ml')return q>=1000?(q/1000).toFixed(1).replace('.',',')+' l':Math.round(q)+' ml';
  const n=Math.round(q*10)/10,u=I.unit==='Dose'&&n!==1?'Dosen':I.unit==='Packung'&&n!==1?'Packungen':I.unit==='Portion'&&n!==1?'Portionen':I.unit;
  return n.toString().replace('.',',')+' '+u;};
const byCat=list=>{const cats=C.shopCats||[],g={};list.forEach(x=>{const c=IT()[x.it].cat;(g[c]=g[c]||[]).push(x);});
  return Object.keys(g).sort((a,b)=>(cats.indexOf(a)+99)%99-(cats.indexOf(b)+99)%99).map(c=>[c,g[c]]);};
const dayTag=(r)=>!r.k?'':r.fresh?`bis ${dayOf(r.k).wd}`:`ab ${dayOf(r.k).wd}`;
let shopMode='home';
EN.shopMode=m=>{shopMode=m;render();};
EN.have=id=>{const h=FS().have;if(h[id])delete h[id];else h[id]=TODAY();R();};
EN.pset=(it,st)=>{FS().pantry[it]=st;R();};
EN.cart=id=>{const c=FS().cart;if(c[id])delete c[id];else c[id]=1;R();};
EN.checkout=()=>{const c=FS().cart;Object.keys(c).forEach(id=>{const it=id.split('@')[0];if(isPantry(it))FS().pantry[it]='da';else FS().have[id]=TODAY();});FS().cart={};R();};
EN.subst=(it,sb)=>{if(sb)FS().subst[it]=sb;else delete FS().subst[it];R();EN.openItem(it);};
EN.tk=dir=>{const st=STK();st.bolotk=Math.max(0,(st.bolotk||0)+dir);R();};
const infoBtn=it=>`<button class="btn sm ghost" onclick="event.stopPropagation();EN.openItem('${it}')" aria-label="Details">ⓘ</button>`;
const staleNote=()=>`<div class="ecard"><div class="sub">Die Artikelliste fehlt in den geladenen Inhalten (veralteter Stand von <b>nutrition.json</b>). Bitte die Seite neu laden.</div><button class="btn ghost" onclick="location.reload()">Neu laden</button></div>`;
function rowHTML(r,mode){const I=IT()[r.it],cnt=['Stück','Dose','Scheiben','Packung','Portion'].includes(I.unit),q=fmtQ(r.it,cnt?Math.ceil(r.q-1e-9):r.q),tag=dayTag(r);   /* Stückzahlen zum Einkaufen aufrunden */
  const on=mode==='home'?(r.pantry?false:covered(r.id)):!!FS().cart[r.id];
  const sub=r.pantry?(r.state==='knapp'?'knapp':r.state==='leer'?'leer':'prüfen')+(q?` · diese Woche ${q}`:''):q;
  const click=mode==='home'?(r.pantry?`EN.pset('${r.it}','da')`:`EN.have('${r.id}')`):`EN.cart('${r.id}')`;
  return `<div class="it ${on?'got':''}" onclick="${click}"><span class="ecb ${on?'on':''}"></span><div style="flex:1;min-width:0">${nameOf(r.it)}<small>${sub}</small></div>${tag?`<span class="dtag ${r.later?'late':''}">${tag}</span>`:''}${I.unit==='basic'?'':infoBtn(r.it)}</div>`;}
function pEinkauf(){if(!Object.keys(IT()).length)return `<div class="ecard"><span class="k">Einkauf</span></div>`+staleNote();
  const M=shopModel(),home=shopMode==='home',open=M.rows.filter(r=>!(r.pantry?false:covered(r.id)));
  const now=open.filter(r=>!r.later&&!r.pantry),pan=open.filter(r=>r.pantry),later=open.filter(r=>r.later);
  let h=`<div class="ecard"><div class="between"><span class="k">Einkauf</span><span class="meta">${dayOf(M.start).wd} ${OKT(M.start)} – ${dayOf(M.end).wd} ${OKT(M.end)}</span></div>
    <div class="sub" style="margin-top:4px;font-size:13px">Stell sicher, dass das in den nächsten 7 Tagen da ist.</div>
    <div class="seg" style="margin:10px 0 0"><button class="${home?'on':''}" onclick="EN.shopMode('home')">Zuhause: was ist da?</button><button class="${home?'':'on'}" onclick="EN.shopMode('shop')">Im Laden (${now.length+pan.length})</button></div></div>`;
  if(home){
    const all=M.rows.filter(r=>!r.later&&!r.pantry);
    h+=`<div class="sub" style="margin:0 4px 8px;font-size:13px">Antippen, was du schon hast. Es verschwindet für diese Woche von der Einkaufsliste.</div>`;
    byCat(all).forEach(([c,xs])=>{h+=`<div class="ecard"><span class="km hl">${c}</span><div class="list">${xs.map(r=>rowHTML(r,'home')).join('')}</div></div>`;});
    if(pan.length)h+=`<div class="ecard"><span class="km hl">Grundvorrat prüfen</span><div class="sub" style="font-size:12px;margin-top:2px">Antippen = ist da. Knapp oder leer stellst du unter <b>Vorrat</b> ein.</div><div class="list">${pan.map(r=>rowHTML(r,'home')).join('')}</div></div>`;
    if(later.length)h+=`<div class="ecard"><span class="km hl">Später, frisch</span><div class="list">${later.map(r=>rowHTML(r,'home')).join('')}</div></div>`;}
  else{if(!now.length&&!pan.length&&!later.length)h+=`<div class="ecard"><div class="sub">Alles da für die nächsten 7 Tage.</div></div>`;
    byCat(now.concat(pan)).forEach(([c,xs])=>{h+=`<div class="ecard"><span class="km hl">${c}</span><div class="list">${xs.map(r=>rowHTML(r,'shop')).join('')}</div></div>`;});
    if(later.length)h+=`<div class="ecard"><span class="km hl">Später, frisch</span><div class="sub" style="font-size:12px;margin-top:2px">Erst kurz vorher kaufen, am besten auf dem Heimweg am Vortag.</div><div class="list">${later.map(r=>rowHTML(r,'shop')).join('')}</div></div>`;
    const n=Object.keys(FS().cart).length;if(n)h+=`<button class="btn" onclick="EN.checkout()">Einkauf abschließen · ${n} abgehakt</button>`;}
  const bolo=[];for(let n=0;n<SHOPN;n++){const k=addD(M.start,n),D=dayOf(k);if(mealIds(D).includes('ab')&&varOf(D,'ab')==='bolo')bolo.push(D.wd);}
  if(bolo.length)h+=`<div class="hint">Bolognese ×4 kochen am <b>${bolo.join(', ')}</b>, danach liegen 3 Portionen im TK.</div>`;
  return h;}
/* Vorrat = Grundvorrat: da / knapp / leer, dazu die selbst gekochten Portionen */
function pVorrat(){if(!Object.keys(IT()).length)return `<div class="ecard"><span class="k">Vorrat</span></div>`+staleNote();
  const items=Object.keys(IT()).filter(isPantry).map(it=>({it})),tk=STK().bolotk||0;
  let h=`<div class="ecard"><span class="k">Vorrat</span><div class="sub" style="margin-top:6px;font-size:13px">Was immer da sein sollte. Knapp und leer kommen automatisch auf die Einkaufsliste.</div></div>
    <div class="ecard"><span class="km hl">Selbst gekocht</span><div class="list"><div class="it"><div style="flex:1;min-width:0">Bolognese-Portionen im TK<small>${tk} ${tk===1?'Portion':'Portionen'} · zählt sich beim Kochen und Essen selbst</small></div><span class="row"><button class="btn sm ghost" onclick="EN.tk(-1)">−</button><button class="btn sm ghost" onclick="EN.tk(1)">+</button></span></div></div></div>`;
  byCat(items).forEach(([c,xs])=>{h+=`<div class="ecard"><span class="km hl">${c}</span><div class="list">${xs.map(({it})=>{const st=pState(it);
    return `<div class="it ${st==='leer'?'low':st==='knapp'?'low':''}" onclick="EN.openItem('${it}')"><div style="flex:1;min-width:0">${nameOf(it)}<small>${st||'noch nicht geprüft'}</small></div><span class="tri" onclick="event.stopPropagation()">${['da','knapp','leer'].map(x=>`<button class="${st===x?'on '+x:''}" onclick="EN.pset('${it}','${x}')">${x}</button>`).join('')}</span></div>`;}).join('')}</div></div>`;});
  return h;}
/* Artikel-Details: wann und wofür gebraucht, beim Grundvorrat der Zustand */
function usage(it){const start=addD(TODAY(),1),out=[];
  for(let n=0;n<SHOPN;n++){const k=addD(start,n),D=dayOf(k);
    mealIds(D).forEach(id=>{const v=varOf(D,id),X=C.dishes[v];if(!X||!X.use)return;const i=pix(D,id);
      Object.entries(X.use).forEach(([it0,q])=>{if(itemFor(it0,k)===it&&q[i])out.push({k,wd:D.wd,slot:SL[id][0],dish:V[v].n,q:qB(it0,q[i])});});
      if(X.yields&&X.yields[it])out.push({k,wd:D.wd,slot:SL[id][0],dish:V[v].n,q:-X.yields[it]});});}
  ((C&&C.always)||[]).filter(a=>a.it===it&&!(a.hw===false&&hwDay(start))).forEach(a=>out.unshift({k:start,wd:'Immer',slot:'da haben',dish:a.why,q:a.q,always:true}));
  return out;}
EN.openItem=it=>{const I=IT()[it],u=usage(it),sum=u.reduce((a,x)=>a+Math.max(0,x.q),0),st=pState(it);
  sheet(`<div class="km">${I.cat}</div><h3>${nameOf(it)}</h3>${I.packLabel?`<div class="sub">Packung: ${I.packLabel}</div>`:''}
    ${isPantry(it)?`<div class="km sec">Zuhause</div><div class="tri big">${['da','knapp','leer'].map(x=>`<button class="${st===x?'on '+x:''}" onclick="EN.pset('${it}','${x}');EN.openItem('${it}')">${x}</button>`).join('')}</div>`:''}
    ${(I.subs||[]).length?`<div class="km sec">Ersatz, solange da</div><div class="sub" style="font-size:13px">Ist der Ersatz im Vorrat auf da oder knapp, steht er in den Rezepten statt ${I.n}. Bei leer gilt wieder ${I.n}.</div><div class="tri big">${['',...I.subs].map(sb=>`<button class="${(FS().subst[it]||'')===sb?'on da':''}" onclick="EN.subst('${it}','${sb}')">${sb?IT()[sb].n:'kein Ersatz'}</button>`).join('')}</div>${FS().subst[it]&&!subOf(it)?`<div class="sub" style="font-size:12px;margin-top:4px;color:var(--amber)">${IT()[FS().subst[it]].n} steht im Vorrat nicht auf da, deshalb gilt gerade ${I.n}.</div>`:''}`:''}
    <div class="km sec">Gebraucht in den nächsten 7 Tagen</div>
    ${u.length?`<div class="list">${u.map(x=>`<div class="it"><div style="flex:1;min-width:0">${x.always?'Immer da haben':x.wd+' '+OKT(x.k)+' · '+x.slot}<small>${x.dish}</small></div><span class="meta">${x.q<0?'+'+fmtQ(it,-x.q):fmtQ(it,x.q)}</span></div>`).join('')}</div><div class="between" style="margin-top:6px;font-size:14px"><b>Summe</b><b>${fmtQ(it,sum)}</b></div>`:`<div class="sub">nicht eingeplant</div>`}
    <button class="cancel" onclick="closeSheet()">Fertig</button>`);};
EN._dbg={dayOf:k=>dayOf(k),varOf:(D,id)=>varOf(D,id),IT:()=>IT(),C:()=>C,shopModel:()=>shopModel()};   /* Diagnose (Konsole) */
/* Heimweg: frische Zutat, die morgen gebraucht wird und noch nicht da ist */
function homewayToday(){if(!C)return [];return shopModel().rows.filter(r=>r.fresh&&r.k===addD(TODAY(),1)&&!covered(r.id));}
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
    <div class="srow" onclick="EN.openFree()" style="cursor:pointer"><div>Freie Mahlzeiten<small>${WO.flatMap(w=>freeOf(w).map(r=>WDL[w]+' '+RN[r])).join(', ')||'keine'} · ohne Plan, nicht in Einkauf und Vorrat</small></div><span class="v">ändern ›</span></div>
    <div class="srow" onclick="EN.openGuest()" style="cursor:pointer"><div>Zu zweit<small>${gLabel()}</small></div><span class="v">ändern ›</span></div>
    <div class="srow"><div>Proteinpulver<small>im Heilungsfenster immer Erbsenprotein</small></div><button class="btn sm ghost" onclick="EN.protToggle()">${ST.protein==='plant'?'Erbsenprotein':'Whey'}</button></div>
    <div class="srow"><div>Brot<small>Scheiben werden umgerechnet</small></div><button class="btn sm ghost" onclick="EN.breadToggle()">${toastOn()?'Vollkorntoast':'Roggenbrot'}</button></div>
    <div class="srow" onclick="EN.openSup()" style="cursor:pointer"><div>Supplements<small>${supNames()||'keine'} · hängen am Mittag</small></div><span class="v">ändern ›</span></div>
    <div class="srow" onclick="EN.openBed()" style="cursor:pointer"><div>Schlafenszeit<small>${BED()} · Abendessen bis ${DINNER_BY()}</small></div><span class="v">ändern ›</span></div>
    <div class="srow" onclick="EN.openWork()" style="cursor:pointer"><div>Arbeit<small>${['voll','halb'].map(m=>{const ws=WO.filter(w=>workMode(w)===m);return ws.length?dayRanges(ws)+' '+workLbl(m):'';}).filter(Boolean).join(' · ')||'keine Arbeitstage'} · 🎒 nur Kaltes</small></div><span class="v">ändern ›</span></div>
    <div class="flow">${ST.fast?'':'<span>Vormittag 🎒</span><i>›</i>'}<span>Mittag 🎒 ~12</span><i>›</i><span>Nachmittag 🎒</span><i>›</i><span class="t">Training</span><i>›</i><span>Abend</span></div>
    <div class="km" style="margin-top:14px">Daten</div>
    <div class="srow"><div>Gewicht, Haut, Ausnahmen, Energie<small>nur auf diesem iPhone (Datenschutz-Entscheidung offen)</small></div><button class="btn sm ghost" onclick="EN.exportHealth()">Export</button></div>
  </div></details>`;
  set.insertBefore(el,set.firstChild);};
})();
