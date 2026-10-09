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
/* Synchronisiert (progress.json): S.food = {days:{datum:{st,sw,extra,water (alt, nicht mehr genutzt),energy,meds,packed}}, set:{protein,fast}} */
function FS(){if(!S.food||typeof S.food!=='object')S.food={};if(!S.food.days)S.food.days={};if(!S.food.set)S.food.set={protein:'whey',fast:true};if(!S.food.stock)S.food.stock={};if(!S.food.cart)S.food.cart={};if(!S.food.have)S.food.have={};if(!S.food.got)S.food.got={};if(!S.food.subst)S.food.subst={};if(!S.food.pantry)S.food.pantry={};if(!S.food.set.free)S.food.set.free={};if(!S.food.set.freeV2){if(JSON.stringify(S.food.set.free)==='{"0":["we"]}')S.food.set.free={};S.food.set.freeV2=1;}   /* Standard: jede Mahlzeit im Plan; früheres „So Mittag frei“ einmalig zurück */if(!S.food.tt)S.food.tt={};return S.food;}
/* Nur lokal auf diesem Gerät (Gesundheitsdaten): Haut, Ausnahmen, Heißhunger, Gewicht, Heilungsfenster */
const HKEY='wt-health-v1';
let H={days:{},HW:{active:false,start:'',len:7}};
try{const x=JSON.parse(localStorage.getItem(HKEY)||'null');if(x)H=Object.assign(H,x);}catch(e){}
const HF={exc:[],skin:0,haut:0,skinAt:[],crave:-1,weight:0,waist:0,arm:0,thigh:0,chest:0,shoulder:0,photo:0}, SF={st:{},sw:{},extra:[],water:0,energy:0,energyAsked:false,meds:{},packed:false,pk:{},used:{},guests:{},ing:{},part:{},batch:{}};
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
const save=()=>{prune(H.days,HF);prune(FS().days,SF);Object.keys(FS().stock).forEach(it=>{if(it!=='bolotk'||!(FS().stock[it]>0))delete FS().stock[it];});Object.keys(FS().have).forEach(id=>{const at=id.split('@')[1],h=FS().have[id];if(at?at<TODAY():diff(TODAY(),h)>=7)delete FS().have[id];});Object.keys(FS().got).forEach(id=>{if(FS().got[id]<TODAY())delete FS().got[id];});try{localStorage.setItem(HKEY,JSON.stringify(H));}catch(e){}};
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
  D0=JSON.parse(JSON.stringify(C.dishes));pApplied=null;buildDishes();
  G={};Object.keys(C.glossary).forEach(k=>{G[k]={n:C.glossary[k].n,t:kk=>P_(C.glossary[k].t,kk)};});
  SUP=C.supplements||SUP;PACK=C.pack||PACK;SOS=(C.sos||[]).map(x=>Array.isArray(x)?{n:x[0],c:x[1],s:x[2],items:[]}:x);
  EXC=C.exceptions.map(e=>[e.n,e.c,e.s,mk(e.p,e.cc,e.f)]);XTRA=C.extras.map(e=>[e.n,mk(e.p,e.c,e.f)]);
}catch(e){C=null;console.error('nutrition.json',e);}};
/* ---------- Portionen am Abend (07.10.) ----------
   Einstellung S.food.set.portion = −3 … +3 Stufen. Eine Stufe ändert die Beilage der Abendgerichte (alt.ab) um
   items[b].pstep = [Gramm, g Kohlenhydrate], etwa ±200 kcal pro Tag. Angewendet direkt auf die Gerichtsdaten (Kopie D0),
   damit Beschreibung, Zutaten, kcal, Bedarf, Packliste und „Nach Plan“ von selbst stimmen. Protein bleibt gleich.
   Gerichte ohne Zutatenzeile für die Beilage (Frosta) bleiben unverändert. */
let D0=null,pApplied=null;
const PSTEP=()=>{const v=+((S.food&&S.food.set&&S.food.set.portion)||0);return Math.max(-3,Math.min(3,v||0));};
function buildDishes(){if(!C||!D0)return;const st=PSTEP();if(pApplied===st)return;pApplied=st;const I=C.items||{};
  C.dishes=JSON.parse(JSON.stringify(D0));
  if(st)(ALT.ab||[]).forEach(v=>{const X=C.dishes[v];if(!X||!X.use)return;
    Object.keys(X.use).forEach(b=>{const ps=(I[b]||{}).pstep;if(!ps)return;
      X.use[b]=X.use[b].map((q,i)=>{const rows=X.ing[i].filter(r=>r[3]===b);if(!rows.length)return q;
        const nq=Math.max(Math.min(q,ps[0]),q+st*ps[0]),dq=nq-q;if(!dq)return q;   /* nie unter eine Stufe (50 g Reis/Nudeln, 250 g Kartoffeln) */
        X.C[i]=Math.max(0,Math.round(X.C[i]+dq/ps[0]*ps[1]));
        rows.forEach(r=>{r[1]=String(r[1]).replace(new RegExp('^'+q+'\\s*g'),nq+' g');});
        X.d[i]=X.d[i].split(' · ').map(seg=>/Kartoffel|Reis|Nudel/.test(seg)?seg.replace(new RegExp('\\b'+q+' g'),nq+' g'):seg).join(' · ');
        return nq;});});});
  V={};Object.keys(C.dishes).forEach(k=>{const X=C.dishes[k];V[k]=Object.assign({},X,{d:i=>B_(X.d[i]),ing:(i,kk)=>X.ing[i].map(r=>bRow([P_(r[0],kk),r[1],r[2],r[3]])),steps:kk=>X.steps.map(t=>B_(P_(t,kk)))});});}
const pDesc=st=>st?`${st>0?'+':'−'}${Math.abs(st)} ${Math.abs(st)===1?'Stufe':'Stufen'} · ≈ ${st>0?'+':'−'}${Math.abs(st)*200} kcal pro Tag`:'normal';
EN.setPortion=st=>{st=Math.max(-3,Math.min(3,st));FS().set.portion=st;FS().set.portionAt=TODAY();buildDishes();RS();};
const SIZE={klein:.6,normal:1,'groß':1.5};
/* Brot nach Einstellung: Vollkorntoast (Standard) oder Roggenbrot. Rezepte rechnen in Scheiben Roggenbrot,
   bei Toast wird umgerechnet (breadFactor in nutrition.json, 1 Scheibe Roggenbrot ≈ 1,7 Scheiben Toast). */
const toastOn=()=>(FS().set.bread||'toast')==='toast'&&!!(C&&C.items&&C.items.toast);
const bN=n=>Math.max(1,Math.round(n*((C&&C.breadFactor)||1.7)));
const qB=(it0,v)=>it0==='brot'&&toastOn()&&v?bN(v):v;
const B_=t=>!toastOn()||typeof t!=='string'?t:t.replace(/(\d+)(?:–(\d+))? Scheiben (?:Vollkorn-)?Roggenbrot/g,(m,n,n2)=>bN(+n)+(n2?'–'+bN(+n2):'')+' Scheiben Vollkorntoast').replace(/(?:Vollkorn-)?Roggenbrot/g,'Vollkorntoast');
const bRow=r=>!toastOn()||r[3]!=='brot'?r:[B_(r[0]),String(r[1]).replace(/^(\d+)(?:–(\d+))?/,(m,n,n2)=>bN(+n)+(n2?'–'+bN(+n2):'')),r[2]==='brot'?'toast':r[2],'toast'];

/* ---------- Tage aus dem echten Trainingsplan ---------- */
/* Tagestyp: aus der Minuten-Schätzung der Plan-Einheit (dayMinutes). Vorlage: nach Wochentag. */
const WDL=['So','Mo','Di','Mi','Do','Fr','Sa'];
let PP=null;
EN.fresh=()=>{PP=null;DC={};buildDishes();};
function plan(){if(!PP){PP={};try{projectPlan(8).forEach(e=>{PP[e.k]=e;});}catch(e){}}return PP;}
const TODAY=()=>dkey(today0());
let DC={};
function dayOf(k){return DC[k]||(DC[k]=dayOf0(k));}
/* Vergangene Tage (für „Nach Plan“): trainiert laut Log, sonst Ausfall- oder Ruhetag */
function pastEntry(k){if(k>=TODAY())return null;try{const d=dayWorkedOn(k);if(d)return {kind:'donetoday',d};if(planState().off.includes(k))return {kind:'off'};}catch(e){}return null;}
function dayOf0(k){const e=plan()[k]||pastEntry(k)||{kind:'empty'},w=D_(k).getDay();
  const isT=e.kind==='train'||e.kind==='donetoday',min=e.d?dayMinutes(e.d.day):0;
  const type=!isT?((window.WOCHE&&WOCHE.type(k))||'rest'):min>=120?'hard':min>=45?'train':'active';
  const D={k,wd:WDL[w],e,min,type,off:e.kind==='off',done:e.kind==='donetoday',train:isT?(e.d?dayTitle(e.d):'Training'):null,len:min?'≈ '+min+' min':''};
  let ab=AB_ROT[w];const vm=VMR[w]||VMR.other;
  const md=workMode(w);D.work=workLbl(md);D.md=md;
  D.fast=!!ST.fast&&md!=='frei';   /* Werktags-Fasten: erste Mahlzeit mittags */
  const VM=D.fast?[]:[['vm',vm,'work']],RC=D.fast?['rc','recovShake','gym']:['rc','recov','gym'];
  if(md==='voll'){D.tpl='Werktag';D.slots=[...VM,['mi','oats','work'],['na','pre','work'],['ab',ab,'home']];}
  else if(md==='halb'){D.tpl='halb';D.slots=[...VM,['mi','oats','home','zuhause'],['na','pre','home'],['ab',ab,'home']];}
  else{D.tpl='Wochenende';D.slots=[['br','brunch','home'],['we',(C.defaults&&C.defaults.we&&V[C.defaults.we])?C.defaults.we:'weLunch','home'],['wn','weSnack','home'],['ab',ab,'home']];}
  /* Lange Ausdauer (ein durchgehender Block ab 75 min, z. B. langer Lauf): Zeile „Unterwegs“ nach dem Training, Menge nach Dauer.
     Krafteinheiten kommen mit Pausen auch auf 80–90 min, brauchen aber nichts unterwegs. */
  let sm=0;try{(e.d&&e.d.day&&e.d.day.sessions||[]).forEach(se=>(se.items||[]).forEach(it=>{if(!it.rest&&!it.opt)sm=Math.max(sm,pvMinutes(it));}));}catch(x){}
  D.uwI=!V.gel||!SL.uw?-1:sm>=180?2:sm>=120?1:sm>=75?0:-1;   /* ältere nutrition.json ohne Gel: nichts anzeigen */
  /* Anderes Training (woche.js): steht als Trainingszeile im Ablauf, Zeit wählbar wie beim Plan (05.10.) */
  const oth=e.kind==='off'&&((planState().other||{})[k]);if(oth){D.train=oth.n;D.other=true;}
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
function basisOf(D){const s=NS(D.k),eb=new Set();mealIds(D).forEach(id=>{if(s.st[id]==='eaten'||s.st[id]==='half')(V[varOf(D,id)].basis||[]).forEach(b=>eb.add(b));});if(s.meds.fish||Object.keys(s.meds).some(n=>s.meds[n]&&/fisch|omega/i.test(n)))eb.add('Fisch');Object.keys(s.ing||{}).concat(...Object.values(s.part||{}).map(o=>Object.keys(o))).forEach(it=>{const b=(IT()[it]||{}).basis;if(b)eb.add(b);});return eb;}
/* Welche Basis-Lebensmittel stehen heute im Plan (Gerichte, Zutaten, Fischöl als Supplement)? */
function planBasis(D){const pb=new Set();mealIds(D).forEach(id=>(V[varOf(D,id)].basis||[]).forEach(b=>pb.add(b)));
  Object.keys(dayIngredients(D)).forEach(it=>{const b=(IT()[it]||{}).basis;if(b)pb.add(b);});
  if(supOn().some(x=>/fisch|omega/i.test(x.n)))pb.add('Fisch');return pb;}
function nextWorkDay(D){const n=dayOf(addD(D.k,1));return n.work?n:null;}
/* Packliste (04.10.): was morgen mit zur Arbeit / ins Gym muss.
   Lebensmittel als Gesamtliste mit Mengen (aus den 🎒-Mahlzeiten, egal für welche Mahlzeit), ein Lebensmittel pro Zeile;
   Dinge (Trinkflasche, Sporttasche, Shaker) getrennt; Aufgaben für heute Abend (ansetzen, auftauen) vorneweg. */
function packModel(N){const tasks=[],food={},res={},things=[],add=(it,q,rs)=>{food[it]=(food[it]||0)+q;if(rs)res[it]=(res[it]||0)+q;};
  shown(N).forEach(sl=>{const id=sl[0];if(id==='T')return;const v=varOf(N,id),X=V[v],R0=C.dishes[v],i=pix(N,id);
    if(id==='ab'&&X.prepAb)tasks.push(['t:'+X.prepAb,X.prepAb,`für ${N.wd} abends`]);
    if(sl[2]!=='work'&&sl[2]!=='gym')return;
    (X.prep||[]).forEach(p=>tasks.push(['t:'+p,p,`für ${SL[id][0]}`]));
    if(R0&&R0.use)Object.entries(R0.use).forEach(([it0,q])=>{const it=itemFor(it0,N.k),I=IT()[it];if(!I||I.unit==='basic'||!q[i])return;add(it,qB(it0,q[i]));});
    if(R0&&R0.shaker&&((R0.use||{}).protein||[])[i])things.push('Shaker');
    if(sl[2]==='gym')things.push(PACK.training?PACK.training[0]:'Sporttasche');});
  (PACK.foodItems||[]).forEach(x=>{if(IT()[x.it])add(x.it,x.q,true);});
  const sup=shown(N).some(s=>s[2]==='work'&&s[0]==='mi')?supOn().filter(x=>!(/fisch|omega/i.test(x.n)&&food.fischoel)):[];
  PACK.other.forEach(x=>things.push(x[0]));if(N.train&&PACK.training)things.push(PACK.training[0]);
  const cnt=it=>['Stück','Dose','Scheiben','Packung','Portion'].includes(IT()[it].unit),G={};
  const where=it=>({'Kühlregal':'Aus Kühlschrank & TK','Tiefkühl':'Aus Kühlschrank & TK','Obst & Gemüse':'Obst','Drogerie':'Pulver & Supplements'})[IT()[it].cat]||'Aus dem Schrank';
  Object.keys(food).sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).forEach(it=>(G[where(it)]=G[where(it)]||[]).push(['f:'+it,nameOf(it),res[it]?(res[it]>=food[it]-1e-9?'Reserve':'inkl. '+qS(fmtQ(it,res[it]))+' Reserve'):'',fmtQ(it,cnt(it)?Math.ceil(food[it]-1e-9):food[it])]));
  sup.forEach(x=>(G['Pulver & Supplements']=G['Pulver & Supplements']||[]).push(['s:'+x.n,x.n,'',x.d||'']));
  return [['Heute Abend erledigen',tasks.map(x=>[x[0],x[1],x[2]])],
    ...['Aus dem Schrank','Obst','Pulver & Supplements','Aus Kühlschrank & TK'].filter(g=>G[g]).map(g=>[g,G[g],'food']),
    ['Sachen',[...new Set(things)].map(x=>['d:'+x,x,'',''])]].filter(g=>g[1].length);}
const R=()=>{save();markDirty();render();};
EN.R=R;

/* ---------- kleine Bausteine ---------- */
const mini=(arr,val,fn,off)=>`<div class="mini">${arr.map((x,n)=>`<button class="${val===n+off?'on':''}" onclick="event.stopPropagation();${fn}(${n+off})">${x}</button>`).join('')}</div>`;
const ringSVG=(pct,big,small)=>{const r=42,C=2*Math.PI*r,p=Math.max(0,Math.min(1,pct));return `<div class="enring"><svg width="96" height="96" viewBox="0 0 96 96" style="transform:rotate(-90deg)"><circle cx="48" cy="48" r="${r}" stroke="#2c2c2e" stroke-width="8" fill="none"/>${p>0?`<circle cx="48" cy="48" r="${r}" stroke="${pct>1.08?'#ffe620':'#d7f651'}" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${C*p} ${C}"/>`:''}</svg><div class="mid"><b>${big}</b><span>${small}</span></div></div>`;};
const macHTML=(t,T)=>{const row=(n,a,b)=>`<div class="l"><span>${n} ${Math.round(a)} g</span><span>von ${b}</span></div><div class="mbar"><i style="width:${Math.min(100,a/b*100)}%"></i></div>`;return `<div class="mac">${row('Protein',t.p,T.p)+row('Kohlenhydrate',t.c,T.c)+row('Fett',t.f,T.f)}</div>`;};
/* Ein offenes Ernährungs-Sheet wird an Ort und Stelle ausgetauscht (kein erneutes Hereingleiten, Scroll bleibt),
   z. B. beim Abhaken einer Zutat; sonst gleitet ein neues Sheet herein (09.10.) */
function sheet(html){const old=document.querySelector('.sheetwrap:not(.closing)'),os=old&&old.querySelector(':scope > .sheet.en');
  if(os){const y=os.scrollTop;old.classList.add('swap');os.innerHTML=html;os.scrollTop=y;return;}
  closeSheet();const w=document.createElement('div');w.className='sheetwrap';w.onclick=ev=>{if(ev.target===w)closeSheet();};w.innerHTML=`<div class="sheet en">${html}</div>`;document.body.appendChild(w);}
EN.close=()=>closeSheet();

/* =====================================================================
   ÜBERSICHT · Ergänzungen (die Original-Karten bleiben unverändert)
   ===================================================================== */
/* Oben auf der Übersicht: Heilungsfenster (wenn aktiv) · Nach Plan · fällige Messung */
EN.hwStrip=function(){if(!C)return '';const k=TODAY(),h=hwDay(k);let x='';
  if(h)x+=`<div class="hwstrip" onclick="EN.openHw()"><span>Heilungsfenster · Tag ${h}/${HW.len}</span><span>Regeln ›</span></div>`;
  else if(HW.active&&k<HW.start)x+=`<div class="hwstrip" onclick="EN.openHw()"><span>Heilungsfenster startet ${diff(HW.start,k)===1?'morgen':'am '+OKT(HW.start)}</span><span>Was ist das? ›</span></div>`;
  return x?`<div class="en">${x}</div>`:'';};

/* ---------- Nach Plan (neu 07.10.): Mahlzeiten statt Zutaten ----------
   Jede geplante Mahlzeit zählt als Ganzes, Hauptmahlzeiten doppelt, Snacks einfach. Gegessen = 1, halb = ½,
   übersprungen oder Ausnahme (Burger King statt Abend) = 0. Sonst zählt der Anteil ihrer einzeln abgehakten Zutaten,
   so zählt auch Gemüse: Lachs und Kartoffeln ohne Brokkoli = ¾ Abendessen.
   Vorher (03.10.) wurden Zutaten des ganzen Tages gezählt; geteilte Zutaten (Banane) zählten nur einmal und
   ein fehlendes Abendessen kostete kaum etwas (Marc, 07.10.: 73 % ohne Snack und Abend).
   Woche und Monat: nur abgeschlossene Tage ab dem ersten Eintrag; Tage ganz ohne Eintrag zählen nicht mit. */
const logged=k=>{const d=FS().days[k];return !!d&&(Object.keys(d.st||{}).length>0||Object.keys(d.ing||{}).length>0||Object.keys(d.part||{}).length>0);};
function dayScore(k){const D=dayOf(k);let nd=0,n=0,m=0,mn=0,pt=0;
  mealIds(D).forEach(id=>{const f=mealFrac(D,id);if(f===null)return;const w=SNACK.includes(id)?1:2;
    n+=w;nd+=w*f;mn++;if(f>=.99)m++;else if(f>0)pt++;});
  return n?{nd,n,m,mn,pt}:null;}
const startDay=()=>Object.keys(FS().days).filter(logged).sort()[0]||null;
function periodScore(from){const st=startDay(),y=addD(TODAY(),-1);let a=0,b=0,n=0;if(!st)return null;
  for(let k=from<st?st:from;k<=y;k=addD(k,1)){if(!logged(k))continue;const s=dayScore(k);if(!s)continue;a+=s.nd;b+=s.n;n++;}
  return b?{p:Math.round(100*a/b),n}:null;}
const pct=s=>s?s.p+' %':'–';
/* Übersicht: Ernährung nach Plan · heute · letzte 7 · letzte 30 Tage (abgeschlossene Tage, ohne heute) */
EN.topFood=function(){if(!C)return '';const k=TODAY(),t=dayScore(k),tp=t?Math.round(100*t.nd/t.n)+' %':'–',st=startDay();
  /* erst anzeigen, wenn seit dem Start so viele Tage vergangen sind */
  const per=n=>st&&diff(k,st)>=n?`<b>${pct(periodScore(addD(k,-n)))}</b>`:`<i>${st?'ab '+D_(addD(st,n)).getDate()+'.'+(D_(addD(st,n)).getMonth()+1)+'.':'–'}</i>`;
  const due=['weight','waist'].filter(f=>showMeasure(f,k)&&!NS(k)[f]).concat(monthDue(k)?['month']:[]);
  return `<div class="tc-sec" onclick="EN.openScore()"><div class="tc-h"><span>Ernährung nach Plan</span><span class="tc-l">›</span></div>
    <div class="tc-g g3"><span>heute</span><b class="ok">${tp}</b><span>7 Tage</span>${per(7)}<span>30 Tage</span>${per(30)}</div></div>
    ${due.length?`<div class="tc-due" onclick="${due[0]==='month'?'EN.openMonth()':`EN.openMeasure('${due[0]}')`}"><span>Heute messen: ${due.map(f=>f==='month'?'Monatsmessung':MLAB[f]).join(', ').replace(/, ([^,]*)$/,' und $1')}</span><span>›</span></div>`:''}`;};
EN.openScore=()=>{const st=startDay(),ws=addD(TODAY(),-7);
  const rows=Array.from({length:8},(_,n)=>addD(ws,n)).filter(k=>!st||k>=st).reverse().map(k=>{const s=k>=(st||k)&&(logged(k)||k===TODAY())?dayScore(k):null,p=s?Math.round(100*s.nd/s.n):null;
    return `<div class="it"><div style="flex:1">${dayOf(k).wd} ${OKT(k)}${k===TODAY()?' · heute':''}<small>${s?s.m+' von '+s.mn+' Mahlzeiten'+(s.pt?' · '+s.pt+' teilweise':''):st&&k<st?'vor dem Start':'nichts eingetragen, zählt nicht'}</small></div><span class="meta">${p===null?'–':p+' %'}</span></div>`;}).join('');
  sheet(`<h3>Nach Plan</h3><div class="sub">Wie viel von deinen geplanten Mahlzeiten du gegessen hast.</div>
    <div class="list" style="margin-top:10px">${rows}</div>
    <div class="hint">Frühstück, Mittag und Abend zählen doppelt, Snacks einfach. Halb gegessen zählt halb, eine Ausnahme statt der Mahlzeit zählt nicht. Isst du nur einen Teil, etwa Lachs und Kartoffeln ohne Brokkoli, hakst du die Zutaten unter <b>Ernährung → Tage → Zutaten für heute</b> einzeln ab, dann zählt der Teil. 7 und 30 Tage zählen nur abgeschlossene Tage (ohne heute)${st?' seit deinem Start ('+OKT(st)+')':''}. Tage ganz ohne Eintrag zählen nicht mit.</div>
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
const SNACK=['na','wn','vor','uw','rc'];
/* Name eines Gerichts auf seiner Stufe (09.10.): Titel ist immer der Name, auch bei Snacks; nl = Name je Stufe (nutrition.json) */
const dname=(v,i)=>{const X=V[v];return (X.nl&&X.nl[i])||X.n;};
const titleOf=(D,id)=>dname(varOf(D,id),pix(D,id));
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
/* Eine Zeile im Ablauf (überall gleich: Übersicht, Ernährung → Tage, Vorschau): Zeit, Name, Inhalt · kcal (seit 09.10. auch bei Snacks);
   rechts heute der Kreis zum Abhaken (gelber Ring = als Nächstes dran), an anderen Tagen ›. Gegessenes schrumpft auf eine Zeile. */
function mealRow(D,sl,fn){const id=sl[0],v=varOf(D,id),X=V[v],s=NS(D.k),st=s.st[id]||'',exc=s.exc.find(e=>e.slot===id),done=mealDone(D,id),i=pix(D,id),K=`'${D.k}'`,c=cue(D,id);
  const pf=D.k<=TODAY()&&openMeal(D,id)?mealFrac(D,id)||0:0,pnames=pf>0?Object.keys(realIng(D,id)).filter(it=>ateIn(D,id,it)>0).map(it=>ingName(D,id,it)).join(', '):'';
  const open=`${fn||'EN.openMeal'}(${K},'${id}')`;
  const right=D.k<=TODAY()?`<button class="st ${done?(exc?'exc':st):nextStep(D)===id?'nx':''}${!done&&pf>0?' pt':''}${POPM===D.k+id?' pop':''}" onclick="event.stopPropagation();EN.toggleMeal(${K},'${id}')">${({eaten:'✓',half:'½',skip:'✕'})[st]||(exc?'!':'')}</button>`:'<span class="go">›</span>';
  if(done)return `<div class="slot done" onclick="${open}"><div class="body"><span class="l">${lab(id)}</span>${exc?'Ausnahme: '+exc.kind:titleOf(D,id)}</div>${right}</div>`;
  const add=supOn().length&&id===addonSlot(D)?`<div class="addon">+ ${supNames()}</div>`:'';
  return `<div class="slot" onclick="${open}"><div class="body"><div class="when">${lab(id)}${c?` · <span>${c}</span>`:''}${sl[2]==='work'?' · <span>🎒</span>':''}${canBatch(D,id)?batchOf(D.k,id)>1?` · <span>🍲 ×${batchOf(D.k,id)} kochen</span>`:coverOf(D.k,id)?' · <span>🧊 vorgekocht</span>':'':''}</div><div class="n">${dname(v,i)}</div><div class="d">${X.d(i)} · ${mac(v,i).kcal} kcal</div>${pnames?`<div class="addon" style="color:var(--lime)">teilweise: ${pnames}</div>`:''}${add}</div>${right}</div>`;}
const mealList=(D,part,fn)=>mealsOf(D,part).map(sl=>mealRow(D,sl,fn)).join('');
EN.dayPre=e=>C?mealList(dayOf(e.k),'pre'):'';
/* Übersicht: Intra-Workout steht nicht als eigene Zeile, sondern leise in der Trainingszeile (EN.todayLine) */
EN.dayPost=e=>{if(!C)return '';const D=dayOf(e.k);return mealsOf(D,'post').filter(s=>s[0]!=='uw').map(sl=>mealRow(D,sl)).join('')+packRow(D);};
/* ---------- Packen für morgen (04.10.): letzte Zeile im Tagesablauf, Liste im Sheet ----------
   Steht nur heute und nur, wenn morgen gearbeitet wird. Abgehakt wird pro Punkt (S.food.days[heute].pk),
   „gepackt“ ist der Tag, wenn alles abgehakt ist oder „Alles gepackt“ gedrückt wurde. */
function packRow(D){if(D.k!==TODAY())return '';const N=nextWorkDay(D);if(!N)return '';const s=NS(D.k),gs=packModel(N),all=[].concat(...gs.map(g=>g[1])),nd=all.filter(x=>s.pk[x[0]]).length;
  if(s.packed)return `<div class="slot done" onclick="EN.openPack()"><div class="body"><span class="l"><i class="ic">🎒</i>Für ${N.wd}</span>gepackt</div><button class="st eaten" onclick="event.stopPropagation();EN.openPack()">✓</button></div>`;
  const nf=gs.filter(g=>g[2]==='food').reduce((a,g)=>a+g[1].length,0),th=(gs.find(g=>g[0]==='Sachen')||[0,[]])[1].map(x=>x[1]),tk=(gs.find(g=>g[0]==='Heute Abend erledigen')||[0,[]])[1].length;
  const what=[nf?nf+' Lebensmittel':'',...th,tk?tk+(tk===1?' Aufgabe':' Aufgaben'):''].filter(Boolean).join(' · ');
  return `<div class="slot" onclick="EN.openPack()"><div class="body"><div class="when"><i class="ic">🎒</i>Heute Abend · <span>für ${N.wd} packen</span></div><div class="n">${nd?nd+' von '+all.length+' erledigt':all.length+' zu packen'}</div><div class="d">${what}</div></div><span class="go">›</span></div>`;}
/* k = Arbeitstag, für den gepackt wird (Standard: morgen). Abgehakt wird am Abend davor (NS(k−1)),
   deshalb sieht „Packliste heute“ morgens dieselben Haken wie gestern Abend. */
const packFor=k=>{const N=k?dayOf(k):nextWorkDay(dayOf(TODAY()));return N&&N.work?N:null;};
EN.openPack=k=>{const N=packFor(k);if(!N)return;const s=NS(addD(N.k,-1)),gs=packModel(N),K=`'${N.k}'`;
  sheet(`<div class="between"><span class="km">🎒 Für ${N.wd} ${OKT(N.k)}</span>${N.work?`<span class="echip">Arbeit ${N.work}</span>`:''}</div><h3>Packen</h3>
    ${gs.map(([t,xs])=>`<div class="km sec">${t}</div>${xs.map(x=>{const on=!!s.pk[x[0]];return `<div class="check" onclick="EN.pk('${x[0].replace(/'/g,"\\'")}',${K})"><span class="ecb ${on?'on':''}"></span><div style="flex:1;min-width:0">${x[3]?`<b class="qty">${qS(x[3])}</b> `:''}${x[1]}${x[2]?`<small>${x[2]}</small>`:''}</div></div>`;}).join('')}`).join('')}
    <button class="btn" onclick="EN.packAll(${K})">${s.packed?'✓ Gepackt':'Alles gepackt'}</button>
    <button class="cancel" onclick="closeSheet()">Schließen</button>`);};
EN.pk=(key,k)=>{const N=packFor(k);if(!N)return;const s=NS(addD(N.k,-1)),all=[].concat(...packModel(N).map(g=>g[1]));
  if(s.pk[key])delete s.pk[key];else s.pk[key]=1;s.packed=all.every(x=>s.pk[x[0]]);save();markDirty();render();EN.openPack(N.k);};
EN.packAll=k=>{const N=packFor(k);if(!N)return;const s=NS(addD(N.k,-1));s.packed=!s.packed;if(!s.packed)s.pk={};save();markDirty();closeSheet();render();};
EN.dayFoot=e=>C?`<div class="en">${dayFoot(dayOf(e.k))}</div>`:'';
EN.tzChip=e=>{if(!C)return '';const D=dayOf(e.k);return D.train?`<span class="tzc" onclick="event.stopPropagation();EN.openTime('${D.k}')">${TZL[D.tz]} ⌄</span>`:'';};
/* Fuß der Übersicht (07.10.): nur noch die zwei Abkürzungen. kcal stehen unter Ernährung → Tage, Wasser gibt es nicht mehr. */
function dayFoot(D){
  return `${D.fast&&D.type==='hard'?`<div class="hint amb">Harter Tag: rund 600 kcal extra einplanen.</div>`:''}
    <div class="links" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><span onclick="EN.openOther()">+ Etwas anderes gegessen</span><span style="color:var(--amber)" onclick="EN.openSOS()">Lust auf Süßes?</span></div>`;}
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
/* Messwerte erscheinen erst wieder nach n Tagen und bleiben, bis etwas eingetragen ist: Gewicht alle 3, Taille alle 6 Tage,
   Oberarm und Oberschenkel alle 28 Tage (07.10.). Noch nie gemessen = fällig (Startwert). */
const MEASURE={weight:3,waist:6,arm:28,thigh:28,chest:28,shoulder:28,photo:28};
const MLAB={weight:'Gewicht',waist:'Taille',arm:'Oberarm',thigh:'Oberschenkel',chest:'Brust',shoulder:'Schultern',photo:'Fotos'};
/* Monatsmessung (07.10.): alles, was alle 4 Wochen dran ist, hinter einem Knopf. Fällig, wenn seit der letzten
   Monatsmessung (egal welcher Wert) 28 Tage vergangen sind oder noch nie gemessen wurde. */
const MONTH=['arm','thigh','chest','shoulder','photo'],MIC={arm:'💪',thigh:'🦵',chest:'📏',shoulder:'🤝',photo:'📷'};
const monthToday=k=>MONTH.filter(f=>NS(k)[f]);
const monthDue=k=>!monthToday(k).length&&Math.min(...MONTH.map(f=>sinceLast(f,k)))>=28;
function sinceLast(f,k){const ks=Object.keys(H.days).filter(x=>x<k&&H.days[x][f]).sort();return ks.length?diff(k,ks[ks.length-1]):999;}
const showMeasure=(f,k)=>!!NS(k)[f]||sinceLast(f,k)>=MEASURE[f];
function quickRow(D){const s=NS(D.k);
  const q=(on,label,fn,due)=>`<button class="q ${on?'on':''}${due?' due':''}" onclick="${fn}">${label}</button>`;
  return `<div class="qrow">
    ${q(s.weight,s.weight?'⚖️ '+fmtKg(s.weight):'⚖️ Gewicht','EN.openMeasure(\'weight\')',!s.weight&&showMeasure('weight',D.k))}
    ${q(s.waist,s.waist?'📏 '+fmtCm(s.waist):'📏 Taille','EN.openMeasure(\'waist\')',!s.waist&&showMeasure('waist',D.k))}
    ${(()=>{const n=monthToday(D.k).length;return q(n,'📐 Monatsmessung'+(n?' '+n+'/'+MONTH.length:''),'EN.openMonth()',monthDue(D.k));})()}
    ${q(s.haut,s.haut?'Haut '+s.haut:'Haut','EN.openSkin()')}
    ${q(s.crave>=0,s.crave>=0?'Heißhunger: '+['nein','etwas','stark'][s.crave]:'Heißhunger','EN.openCrave()')}
    ${D.work&&D.k===TODAY()?q(NS(addD(D.k,-1)).packed,(NS(addD(D.k,-1)).packed?'🎒 Packliste heute ✓':'🎒 Packliste heute'),`EN.openPack('${D.k}')`):''}
    ${(()=>{const hw=homewayToday();return hw.length?q(false,'🛒 Heimweg: '+hw.map(r=>nameOf(r.it)).join(', '),`location.hash='#food/einkauf'`):'';})()}
  </div>`;}
/* Gewicht und Taille: Zahl direkt eintippen oder mit − / + anpassen */
/* Messanleitung als Handgriffe (07.10.): „locker lassen“ ist schwer greifbar, deshalb konkrete Schritte */
const MS={weight:{t:'Gewicht',step:.1,def:85,fmt:fmtKg,u:'kg',how:['Morgens, nüchtern, nach der Toilette']},
  waist:{t:'Taille',step:.5,def:90,fmt:fmtCm,u:'cm',how:['Morgens, nüchtern, nach der Toilette','<b>Geradeaus in den Spiegel schauen</b>, nicht nach unten: das schiebt den Bauch zusammen','Maßband auf Nabelhöhe, waagrecht (im Spiegel prüfen), anliegend, nicht einschneidend','<b>Normal ausatmen und am Ende ablesen</b>, bevor du wieder einatmest. Nicht einziehen, nicht rausdrücken: Bauch wie beim Fernsehen','3× messen, den mittleren Wert eintragen']},
  arm:{t:'Oberarm',step:.5,def:36,fmt:fmtCm,u:'cm',how:['Morgens, vor dem Training (der Pump verfälscht)','Rechter Arm, <b>Faust zur Schulter, voll anspannen</b>','Dickste Stelle des Bizeps, Maßband waagrecht','2× messen, den höheren Wert eintragen']},
  thigh:{t:'Oberschenkel',step:.5,def:58,fmt:fmtCm,u:'cm',how:['Morgens, vor dem Training','Fester Punkt: <b>15 cm über der Oberkante der Kniescheibe</b> (einmal abmessen, gern mit Kuli markieren)','Gerade hinstellen, Gewicht auf beiden Beinen, <b>Knie durchdrücken</b>: dann spannt der Oberschenkel von selbst an, jedes Mal gleich','Rechtes Bein, Maßband waagrecht, anliegend','2× messen, Mittelwert']},
  chest:{t:'Brust',step:.5,def:100,fmt:fmtCm,u:'cm',how:['Morgens, vor dem Training','Arme hängen locker, normal stehen','Maßband unter den Achseln, vorne über die Brustwarzen, hinten über die Schulterblätter, waagrecht','Normal ausatmen, am Ende ablesen','2× messen, Mittelwert']},
  shoulder:{t:'Schultern',step:.5,def:120,fmt:fmtCm,u:'cm',how:['<b>Mit Hilfe messen</b>, allein trifft man es nicht','Morgens, vor dem Training','Arme hängen locker, Schultern nicht hochziehen','Maßband um die breiteste Stelle: außen über die Schultermuskeln, waagrecht','Am Ende des normalen Ausatmens ablesen, 2× messen, Mittelwert']}};
const PHOTO_HOW=['Gleicher Ort, gleiches Licht, morgens vor dem Frühstück','Vorne, Seite, hinten · normal stehen, Arme hängen, nicht anspannen. Gern zusätzlich je eins angespannt','Gleicher Abstand und gleiche Höhe (Spiegel oder Selbstauslöser auf fester Stelle)','Die Fotos bleiben im iPhone-Album „Form“. Die App merkt sich nur, dass du sie gemacht hast'];
const howList=xs=>`<ol class="steps how">${xs.map(t=>`<li>${t}</li>`).join('')}</ol>`;
let mf='weight',mv=0,mBack=false;
EN.openMeasure=(f,back)=>{mf=f;mBack=!!back;const k=TODAY();mv=NS(k)[f]||lastOf(f,k)||MS[f].def;drawMeasure();};
EN.openWeight=()=>EN.openMeasure('weight');
function drawMeasure(){const M=MS[mf];sheet(`<h3>${M.t}</h3>${howList(M.how)}
  <div class="wrow"><button class="pill" onclick="EN.mAdj(-1)">−</button><span class="numw"><input id="mIn" class="numin" inputmode="decimal" value="${mv.toFixed(1).replace('.',',')}" onfocus="this.select()"><i>${M.u}</i></span><button class="pill" onclick="EN.mAdj(1)">+</button></div>
  <button class="btn" onclick="EN.mSave()">Eintragen</button>${NS(TODAY())[mf]?`<button class="cancel" onclick="EN.mSave(true)">Eintrag löschen</button>`:`<button class="cancel" onclick="${mBack?'EN.openMonth()':'closeSheet()'}">${mBack?'Zurück':'Abbrechen'}</button>`}`);}
const mRead=()=>{const x=parseFloat(String((document.getElementById('mIn')||{}).value||'').replace(',','.'));if(x>0)mv=x;};
EN.mAdj=n=>{mRead();mv=Math.round((mv+n*MS[mf].step)*10)/10;drawMeasure();};
EN.mSave=del=>{const s=NS(TODAY());if(del)delete s[mf];else{mRead();s[mf]=Math.round(mv*10)/10;}closeSheet();R();if(mBack)EN.openMonth();};
/* Monatsmessung: Liste der fünf Punkte, jeder öffnet sein Sheet; Fotos nur abhaken */
EN.openMonth=()=>{const k=TODAY(),s=NS(k);
  sheet(`<h3>Monatsmessung</h3><div class="sub">Alle 4 Wochen, morgens vor dem Training. Was heute nicht geht, lässt du weg.</div>
    <div class="list" style="margin-top:8px">${MONTH.map(f=>{const v=s[f],l=lastOf(f,addD(k,-1));
      return `<div class="it" onclick="${f==='photo'?'EN.openPhoto()':`EN.openMeasure('${f}',1)`}"><span class="ecb ${v?'on':''}"></span><div style="flex:1;min-width:0">${MIC[f]} ${MLAB[f]}<small>${f==='photo'?(v?'heute gemacht':'vorne, Seite, hinten'):(v?'heute '+fmtCm(v):l?'zuletzt '+fmtCm(l):'noch nie gemessen')+(f==='shoulder'?' · mit Hilfe':'')}</small></div><span class="go">›</span></div>`;}).join('')}</div>
    <button class="cancel" onclick="closeSheet()">Fertig</button>`);};
EN.openPhoto=()=>{const s=NS(TODAY());sheet(`<h3>📷 Fotos</h3>${howList(PHOTO_HOW)}
  <button class="btn" onclick="EN.photoSet(${s.photo?0:1})">${s.photo?'✓ Gemacht · zurücknehmen':'Fotos gemacht'}</button><button class="cancel" onclick="EN.openMonth()">Zurück</button>`);};
EN.photoSet=v=>{const s=NS(TODAY());if(v)s.photo=1;else delete s.photo;R();EN.openMonth();};
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
EN.eat=(k,id)=>{const s=NS(k),D=dayOf(k);s.st[id]='eaten';POPM=k+id;setTimeout(()=>{POPM='';},400);delete s.part[id];applyUse(k,id,1);if(id===addonSlot(D))supOn().forEach(x=>{s.meds[x.n]=true;});closeSheet();R();};
let POPM='';   /* gerade abgehakte Mahlzeit: ihr Kreis springt einmal (wie bei den Trainings-Haken) */
EN.toggleMeal=(k,id)=>{const s=NS(k);if(s.st[id]){delete s.st[id];applyUse(k,id,0);R();}else EN.eat(k,id);};
EN.setSt=(k,id,st)=>{NS(k).st[id]=st;delete NS(k).part[id];applyUse(k,id,st==='eaten'?1:st==='half'?.5:0);closeSheet();R();};
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
/* TCX = {D,id}, solange das Mahlzeit-Sheet einer offenen Mahlzeit von heute/früher gebaut wird: dann tragen Zeilen,
   die zu echten Zutaten gehören (r[4]), ein Kästchen zum Abhaken, Stückzahlen − / + (09.10., ersetzt „Nur einen Teil gegessen?“) */
let TCX=null;
function tickCell(r){if(!TCX||!r[4]||!r[4].length)return '';const {D,id}=TCX,K=`'${D.k}'`,its=r[4],ing=realIng(D,id);
  const f=its.reduce((a,it)=>a+Math.min(1,ateIn(D,id,it)/ing[it]),0)/its.length;
  return `<span class="ecb ${f>=.999?'on':f>0?'pt':''}" onclick="event.stopPropagation();EN.rowTog(${K},'${id}','${its.join(',')}')"></span>`;}
function qtyCell(r,b){if(!TCX||!r[4]||r[4].length!==1)return b;const {D,id}=TCX,it=r[4][0],q=realIng(D,id)[it];if(!isCnt(it)||Math.round(q)<2)return b;const K=`'${D.k}'`,c=ateIn(D,id,it);
  return `<span class="stp" onclick="event.stopPropagation()"><button onclick="EN.partStep(${K},'${id}','${it}',-1)">−</button><b>${fmtN(c)}/${fmtN(q)}</b><button onclick="EN.partStep(${K},'${id}','${it}',1)">+</button></span>`;}
const ingHTML=(rows,k)=>`<table class="ing">${rows.map(r=>{const [a,b,g]=r,tc=tickCell(r),done=tc.includes('ecb on');
  const tap=tc?`onclick="EN.rowTog('${TCX.D.k}','${TCX.id}','${r[4].join(',')}')"`:'';
  return g&&G[g]?`<tr class="gl${done?' got':''}"><td>${tc}<span onclick="event.stopPropagation();this.closest('tr').nextElementSibling.classList.toggle('hid')">${a} ⓘ</span></td><td>${qtyCell(r,b)}</td></tr><tr class="glx hid"><td colspan="2">${G[g].t(k)}</td></tr>`
    :`<tr class="${tc?'tickrow':''}${done?' got':''}" ${tap}><td>${tc}${a}</td><td>${qtyCell(r,b)}</td></tr>`;}).join('')}</table>`;
/* Welche echten Zutaten (realIng) gehört zu welcher Rezeptzeile? Erst die Item-ID, dann Shake/Pulver, dann der Name.
   Jede Zutat gehört nur zur ersten passenden Zeile; was keine Zeile findet, steht unten als eigene Zeile. */
const stem=t=>String(t).toLowerCase().replace(/<[^>]+>/g,' ').replace(/^tk-|\btk-/g,' ').split(/[^a-zäöüß]+/).filter(w=>w.length>=4).map(w=>w.slice(0,5));
function claimRows(D,id,rows){const ing=realIng(D,id),left=new Set(Object.keys(ing)),P=itemFor('protein',D.k);
  rows.forEach(r=>{r[4]=[];});const take=(r,it)=>{if(left.has(it)){left.delete(it);r[4].push(it);}};
  rows.forEach(r=>{if(r[3])take(r,itemFor(r[3],D.k));});
  rows.forEach(r=>{if(r[2]==='shake'||r[2]==='protein'||/\{PROT\}|Whey|Erbsenprotein|Proteinpulver/.test(r[0]))take(r,P);});
  rows.forEach(r=>{if(r[4].length||r[3])return;const ws=stem(r[0]);[...left].forEach(it=>{if(stem(nameOf(it)).concat(stem(it)).some(w=>ws.includes(w)))take(r,it);});});
  return [...left].map(it=>[nameOf(it),fmtQ(it,ing[it])||'',null,it,[it]]);}
EN.rowTog=(k,id,list)=>{const D=dayOf(k),its=list.split(','),ing=realIng(D,id);its.forEach(it=>unLegacy(D,it));
  const full=its.every(it=>ateIn(D,id,it)>=ing[it]-1e-9);its.forEach(it=>partSet(D,id,it,full?0:ing[it]));R();EN.openMeal(k,id,mealBack);};
/* Zu zweit: Faktor aus den Einstellungen (Start 1,7 = deine 1,5 Buchportionen + 1 Portion für die zweite Person) */
const GK={protein:'Fisch, Fleisch, Eier',beilage:'Beilagen (Kartoffeln, Reis, Nudeln, Brot)',other:'Gemüse und Rest'};
const gF=kd=>{const own=(FS().set.guest||{})[kd];if(own!=null)return own;const c=(C&&C.guest)||{};return c[kd]!=null?c[kd]:(c.other||1.7);};
const kindOf=it=>{const I=IT()[it];return I&&I.kind==='protein'?'protein':I&&I.kind==='beilage'?'beilage':'other';};
const gFit=it=>gF(it?kindOf(it):'other');
const gLabel=()=>`Fisch/Fleisch ×${String(gF('protein')).replace('.',',')} · Beilage ×${String(gF('beilage')).replace('.',',')} · Rest ×${String(gF('other')).replace('.',',')}`;
const isGuest=(k,id)=>!!(k&&id&&NS(k).guests[id]);
const fmtN=n=>{if(n>=50)return String(Math.round(n/10)*10);const h=Math.round(n*2)/2,w=Math.floor(h);return h%1?(w?w+'½':'½'):String(h);};
const scaleAmt=(t,f)=>f===1||!t?t:String(t).replace(/(\d+(?:[.,]\d+)?|½|¼|¾)(\s*(?:–|-)\s*(\d+(?:[.,]\d+)?))?/g,(m,a,r,b)=>{const v=x=>x==='½'?.5:x==='¼'?.25:x==='¾'?.75:parseFloat(String(x).replace(',','.'));return fmtN(v(a)*f)+(b?'–'+fmtN(v(b)*f):'');});
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
  const rows=X.ing(i,k).map(r=>{const sb=r[3]&&subOf(r[3]);if(sb)r=[r[0].replace(IT()[r[3]].n,IT()[sb].n),r[1],r[2],sb];return g&&scaleRow(X,r[0])?[r[0],scaleAmt(r[1],gFit(r[3])),r[2],r[3]]:r;});
  const extra=TCX?claimRows(TCX.D,TCX.id,rows):[];
  return `<div class="between sec2"><span class="km">Zutaten${lbl?' · '+lbl:''}</span>${gBtn||''}</div>${ingGroups(X,rows,k)}${extra.length?ingHTML(extra,k):''}
    ${g?`<div class="sub" style="font-size:12px;margin-top:4px">Zu zweit: ${gLabel()}${X.yields?` · ${X.yields.bolotk-1} statt ${X.yields.bolotk} Portionen für den TK`:''}</div>`:''}`;}
function stepsBlock(v,k,open){const X=V[v],st=X.steps(k);if(!st.length&&!X.tip)return '';
  return `<details class="stp2" ${open?'open':''}><summary><span class="km">Zubereitung</span><span class="meta">${st.length} ${st.length===1?'Schritt':'Schritte'} ›</span></summary><ol class="steps">${st.map(x=>`<li>${x}</li>`).join('')}</ol>${X.tip?`<div class="hint amb">${X.tip}</div>`:''}</details>`;}
let mealBack=false;
EN.guest=(k,id)=>{const g=NS(k).guests;if(g[id])delete g[id];else g[id]=true;R();EN.openMeal(k,id,mealBack);};
EN.openMealB=(k,id)=>EN.openMeal(k,id,true);
EN.openMeal=function(k,id,back){mealBack=!!back;const D=dayOf(k),i=pix(D,id),s=NS(k),v=varOf(D,id),X=V[v],sl=D.slots.find(x=>x[0]===id),at=sl[2],K=`'${k}'`;
  const alts=(ALT[id]||[]).filter(a=>a!==v&&(at!=='work'||V[a].at==='work')),st=s.st[id]||'',exc=s.exc.find(e=>e.slot===id);
  const gBtn=at==='home'?`<button class="gbtn ${isGuest(k,id)?'on':''}" onclick="EN.guest(${K},'${id}')">👥 zu zweit${isGuest(k,id)?' ✓':''}</button>`:'';
  sheet(`<div class="km">${k===TODAY()?'Heute':D.wd} · ${SL[id][0]} · ${slotWhen(D,sl)}${at!=='home'&&!/Sporttasche/.test(slotWhen(D,sl))?' · '+AT[at]:''}</div>
    <h3>${dname(v,i)}</h3><div class="sub">${X.d(i)}</div>${macLine(v,i)}
    ${k<=TODAY()?`<div class="stbar"><button class="${st==='eaten'?'on':''}" onclick="EN.eat(${K},'${id}')">✓ Gegessen</button><button class="${st==='half'?'on':''}" onclick="EN.setSt(${K},'${id}','half')">½ Halb</button><button class="${st==='skip'?'on':''}" onclick="EN.setSt(${K},'${id}','skip')">✕ Nicht</button><button class="${exc?'on':''}" onclick="EN.openExc(${K},'${id}')">! Anders</button></div>`:''}
    ${batchBlock(D,id)}
    ${alts.length?`<div class="it2" onclick="EN.openSwap(${K},'${id}')"><span>Tauschen</span><span class="meta">${alts.length} ${alts.length===1?'Alternative':'Alternativen'} ›</span></div>`:''}
    ${(()=>{TCX=k<=TODAY()&&openMeal(D,id)&&Object.keys(realIng(D,id)).length>1?{D,id}:null;const h=ingBlock(v,i,k,isGuest(k,id),'',gBtn);TCX=null;return h;})()}${stepsBlock(v,k,false)}
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
    <div class="km sec">Was die App dann anders macht</div><ul class="rules"><li>Streifen „Heilungsfenster · Tag x/14“ auf der Übersicht.</li><li>🔴-Ausnahmen werden als Trigger markiert.</li><li>Mengen nie unter dem Ruhetag.</li><li>Harte Einheiten bekommen in der Karte „Heute“ den Hinweis „lieber locker“.</li><li>Shake und Porridge automatisch mit Erbsenprotein statt Whey.</li></ul>
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
EN.openFree=()=>sheet(`<h3>Freie Mahlzeiten</h3><div class="sub">Ohne Plan, z. B. Essen mit Freunden. Sie zählen nicht in Bedarf und Vorrat.</div>
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
/* Über welche gegessene Mahlzeit ist eine Zutat schon abgedeckt? */
function ateVia(D,it){const s=NS(D.k);for(const id of mealIds(D)){if(!(s.st[id]==='eaten'||s.st[id]==='half'))continue;const X=C.dishes[varOf(D,id)];if(!X||!X.use)continue;const i=pix(D,id);
  if(Object.entries(X.use).some(([it0,q])=>itemFor(it0,D.k)===it&&(q[i]||IT()[it].unit==='basic')))return SL[id][0];}return '';}
/* Zum Abhaken und Zählen: ohne Öl, Salz, Gewürze (die isst niemand einzeln, sie kommen mit der Mahlzeit) */
const tickIds=D=>Object.keys(dayIngredients(D)).filter(it=>(IT()[it]||{}).unit!=='basic');
/* alle Zutaten eines Tages (mit „zu zweit“), it → Menge */
/* Was du an dem Tag isst. Beim Vorkochen (Bolognese ×4) nur deine Portion, nicht die ganze Menge im Topf;
   der Einkauf rechnet weiter mit der ganzen Menge. */
function mealIng(D,id){const tot={},X=C.dishes[varOf(D,id)];if(!X||!X.use)return tot;const i=pix(D,id),g=isGuest(D.k,id);
  const n=X.yields&&X.yields.bolotk?X.yields.bolotk+1:1,batch=n>1?new Set(X.ing[i].filter(r=>r[3]&&!/nur deine Portion/.test(r[0])).map(r=>r[3])):null;
  Object.entries(X.use).forEach(([it0,q])=>{const it=itemFor(it0,D.k),I=IT()[it];if(!I)return;const f=(g&&(!X.yields||kindOf(it)==='beilage')?gFit(it):1)/(batch&&batch.has(it0)?n:1);
    if(I.unit!=='basic'&&!q[i])return;tot[it]=(tot[it]||0)+(I.unit==='basic'?0:qB(it0,q[i])*f);});return tot;}
function dayIngredients(D){const tot={};mealIds(D).forEach(id=>Object.entries(mealIng(D,id)).forEach(([it,q])=>{tot[it]=(tot[it]||0)+q;}));return tot;}
/* ---------- Vorkochen (09.10.) ----------
   S.food.days[k].batch[Mahlzeit] = n (2–4): an diesem Tag n Portionen kochen. Einkauf: n-fach, außer Zutaten in X.fresh
   (bei Bolognese die Nudeln). Die nächsten n−1 Male dasselbe Gericht im Plan gelten als vorgekocht: kein Einkauf
   für die vorgekochten Zutaten, nur das Frische. Kein TK-Zählen, was wann aufgetaut wird, entscheidet Marc. */
const canBatch=(D,id)=>{const X=C.dishes[varOf(D,id)];return !!X&&X.at==='home'&&!X.nobatch&&!SNACK.includes(id);};
const batchOf=(k,id)=>+((FS().days[k]||{}).batch||{})[id]||1;
/* Von welchem Kochtag ist diese Mahlzeit vorgekocht? → Datum oder null */
function coverOf(k,id){const v=varOf(dayOf(k),id);let seen=0;
  for(let d=addD(k,-1),n=0;n<21;d=addD(d,-1),n++){const D=dayOf(d),ids=mealIds(D).filter(x=>varOf(D,x)===v);
    for(const x of ids){const b=batchOf(d,x);if(b>1)return seen<b-1?d:null;}
    seen+=ids.length;}
  return null;}
/* Faktor je Zutat für den Einkauf: Kochtag n, vorgekochte Mahlzeit 0, Frisches immer 1 */
function shopFactor(k,id,it0){const X=C.dishes[varOf(dayOf(k),id)];if(X&&(X.fresh||[]).includes(it0))return 1;const b=batchOf(k,id);if(b>1)return b;return coverOf(k,id)?0:1;}
EN.setBatch=(k,id,n)=>{const s=NS(k);if(n>1)s.batch[id]=n;else delete s.batch[id];RS();EN.openMeal(k,id,mealBack);};
function batchBlock(D,id){if(D.k<TODAY()||!canBatch(D,id))return '';const k=D.k,K=`'${k}'`,cv=coverOf(k,id),X=V[varOf(D,id)],i=pix(D,id);
  if(cv)return `<div class="hint">🧊 <b>Vorgekocht</b> am ${dayOf(cv).wd} ${OKT(cv)}: nur aufwärmen${(X.fresh||[]).length?', '+X.fresh.map(f=>nameOf(itemFor(f,k))).join(', ')+' frisch':''}.</div>`;
  const n=batchOf(k,id);
  const sel=`<div class="it2" style="cursor:default"><span>🍲 Vorkochen</span><span class="vk">${[1,2,3,4].map(m=>`<button class="${m===n?'on':''}" onclick="EN.setBatch(${K},'${id}',${m})">×${m}</button>`).join('')}</span></div>`;
  if(n<2)return sel;
  const rows=X.ing(i,k).map(r=>{const fr=r[3]&&(X.fresh||[]).includes(r[3]);return [r[0]+(fr?' <span class="meta">nur deine Portion</span>':''),fr?r[1]:scaleAmt(r[1],n),r[2],r[3]];});
  return sel+`<div class="km sec">Zum Kochen · ${n} Portionen</div>${ingHTML(rows,k)}<div class="sub" style="font-size:12.5px;margin-top:4px">Die nächsten ${n-1}× ${X.n} im Plan gelten als vorgekocht: kein Einkauf dafür${(X.fresh||[]).length?', außer '+X.fresh.map(f=>nameOf(itemFor(f,k))).join(', '):''}.</div>`;}
/* ---------- Teilweise gegessen (07.10.) ----------
   S.food.days[k].part = {Mahlzeit: {Zutat: Menge}}. Geschrieben aus dem Mahlzeit-Sheet („Nur einen Teil gegessen?“)
   und aus „Zutaten für heute“ (− / + bei Stückzahlen: „noch eine Banane“ geht in die nächste offene Mahlzeit damit).
   Alt (bis 07.10.): S.food.days[k].ing[Zutat] = true heißt „alles Übrige davon“; wird beim ersten Antippen umgerechnet. */
const CNT=['Stück','Dose','Scheiben','Packung','Portion'],isCnt=it=>CNT.includes((IT()[it]||{}).unit);
const realIng=(D,id)=>Object.fromEntries(Object.entries(mealIng(D,id)).filter(([it,q])=>q>0&&(IT()[it]||{}).unit!=='basic'));
const openMeal=(D,id)=>{const s=NS(D.k);return !s.st[id]&&!s.exc.find(e=>e.slot===id);};
/* gegessene Menge einer Zutat in einer Mahlzeit */
function ateIn(D,id,it){const s=NS(D.k),q=realIng(D,id)[it]||0;if(!q)return 0;const st=s.st[id];
  if(st==='eaten')return q;if(st==='half')return q/2;if(!openMeal(D,id))return 0;if(s.ing[it]===true)return q;return Math.min(q,((s.part[id]||{})[it])||0);}
/* Anteil einer Mahlzeit nach Plan: gegessen 1, halb ½, Ausnahme/nicht 0, sonst Mittel über ihre Zutaten */
function mealFrac(D,id){const s=NS(D.k),st=s.st[id],its=realIng(D,id),ks=Object.keys(its);if(!ks.length)return null;
  if(st==='eaten')return 1;if(st==='half')return .5;if(!openMeal(D,id))return 0;return ks.reduce((a,it)=>a+ateIn(D,id,it)/its[it],0)/ks.length;}
const itemAte=(D,it)=>mealIds(D).reduce((a,id)=>a+ateIn(D,id,it),0);
/* Alt-Haken in Teilmengen umrechnen, bevor neu gezählt wird */
function unLegacy(D,it){const s=NS(D.k);if(s.ing[it]!==true)return;delete s.ing[it];mealIds(D).forEach(id=>{const q=realIng(D,id)[it];if(q&&openMeal(D,id))(s.part[id]||(s.part[id]={}))[it]=q;});}
function partSet(D,id,it,v){const s=NS(D.k),pp=s.part[id]||(s.part[id]={});if(v>0)pp[it]=v;else delete pp[it];if(!Object.keys(pp).length)delete s.part[id];}
/* Zutaten für heute: alles Übrige an / alles Offene aus */
EN.ingAll=(k,it)=>{const D=dayOf(k),tot=dayIngredients(D)[it]||0;unLegacy(D,it);const full=itemAte(D,it)>=tot-1e-9;
  mealIds(D).forEach(id=>{const q=realIng(D,id)[it];if(q&&openMeal(D,id))partSet(D,id,it,full?0:q);});R();};
/* Zutaten für heute: ±1 Stück, + füllt die erste offene Mahlzeit mit Platz, − nimmt aus der letzten */
EN.ingStep=(k,it,n)=>{const D=dayOf(k),s=NS(k);unLegacy(D,it);const ids=mealIds(D).filter(id=>realIng(D,id)[it]&&openMeal(D,id));
  if(n>0){const id=ids.find(x=>((s.part[x]||{})[it]||0)<realIng(D,x)[it]-1e-9);if(id){const q=realIng(D,id)[it],c=(s.part[id]||{})[it]||0;partSet(D,id,it,Math.min(q,c+1));}}
  else{const id=ids.slice().reverse().find(x=>((s.part[x]||{})[it]||0)>0);if(id){const c=s.part[id][it];partSet(D,id,it,Math.max(0,c-1));}}R();};
/* Mahlzeit-Sheet: eine Zutat dieser Mahlzeit ±1 (an/aus: EN.rowTog) */
EN.partStep=(k,id,it,n)=>{const D=dayOf(k);unLegacy(D,it);const q=realIng(D,id)[it],c=(NS(k).part[id]||{})[it]||0;partSet(D,id,it,Math.max(0,Math.min(q,c+n)));R();EN.openMeal(k,id,mealBack);};
/* Name wie in der Zutatenliste der Mahlzeit („Shake“ statt „Whey“) */
function ingName(D,id,it){const rows=V[varOf(D,id)].ing(pix(D,id),D.k);if(it===itemFor('protein',D.k)&&rows.some(r=>r[2]==='shake'))return 'Shake';
  const r=rows.find(r=>r[3]&&itemFor(r[3],D.k)===it);return r?String(r[0]).replace(/<[^>]+>/g,'').replace(/^·\s*/,'').replace(/\s*\(.*\)$/,''):nameOf(it);}
EN.render=function(main,sub){EN.fresh();if(!C){main.innerHTML='<div class="en"><div class="ecard"><span class="k">Ernährung</span><div class="sub" style="margin-top:6px">Keine Inhalte gefunden: <b>nutrition.json</b> fehlt im Daten-Repo.</div></div></div>';return;}sub=sub||'tage';const tabs=[['tage','Tage'],['woche','Woche'],['einkauf','Bedarf'],['rezepte','Rezepte']];   /* Vorrat ausgeblendet (Marc, 09.10.); #food/vorrat geht weiter */
  if(sub==='pack'){sub='tage';setTimeout(EN.openPack,0);}   /* alte Adresse #food/pack: Packen ist jetzt ein Sheet */
  let h=`<div class="en">${`<div class="seg">${tabs.map(([k,l])=>`<button class="${k===sub?'on':''}" onclick="location.hash='#food/${k}'">${l}</button>`).join('')}</div>`}`;
  h+=({tage:pTage,woche:pWoche,einkauf:pEinkauf,vorrat:pVorrat,rezepte:pRezepte}[sub]||pTage)();
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
  if(ids.length){const isDone=it=>itemAte(D,it)>=tot[it]-1e-9,nd=ids.filter(isDone).length,open=isIngOpen(D.k);
    h+=`<div class="ecard"><div class="between" style="cursor:pointer" onclick="EN.togIng()"><span class="km">Zutaten für ${D.k===TODAY()?'heute':D.wd} (${can?nd+' / ':''}${ids.length})</span><span class="meta">${open?'ausblenden':'anzeigen ›'}</span></div>`;
    if(open){if(can)h+=`<div class="sub" style="font-size:12px;margin-top:4px">Abhaken, was du gegessen hast, auch ohne die ganze Mahlzeit. Bei Stückzahlen mit − / +, zum Beispiel nur eine Banane. Zählt für „Nach Plan“ und die Pyramiden-Basis.</div>`;
      const P=(C.prios)||{must:'Must-have',protein:'Protein',veg:'Gemüse & Obst',rest:'Rest'};
      Object.keys(P).forEach(pr=>{const xs=ids.filter(it=>(IT()[it].prio||'rest')===pr);if(!xs.length)return;
        h+=`<div class="km hl" style="margin-top:12px">${P[pr]}</div><div class="list">${xs.map(it=>{const via=ateVia(D,it),a=itemAte(D,it),T=tot[it],on=a>=T-1e-9,K=`'${D.k}'`,
          q=fmtQ(it,isCnt(it)?Math.ceil(T-1e-9):T)||'',b=IT()[it].basis,tap=can&&mealIds(D).some(id=>realIng(D,id)[it]&&openMeal(D,id)),stp=tap&&isCnt(it)&&Math.round(T)>1;
          return `<div class="it ${on&&can?'got':''}" onclick="${tap?`EN.ingAll(${K},'${it}')`:`EN.openItem('${it}')`}">${can?`<span class="ecb ${on?'on':a>0?'pt':''}"></span>`:''}<div style="flex:1;min-width:0">${nameOf(it)}<small>${[b?'Basis: '+b:'',via?'über '+via:''].filter(Boolean).join(' · ')}</small></div>${stp?`<span class="stp" onclick="event.stopPropagation()"><button onclick="EN.ingStep(${K},'${it}',-1)">−</button><b>${fmtN(a)}/${fmtN(Math.ceil(T-1e-9))}</b><button onclick="EN.ingStep(${K},'${it}',1)">+</button></span>`:`<span class="meta">${q}</span>`}${infoBtn(it)}</div>`;}).join('')}</div>`;});}
    h+=`</div>`;}
  const N=nextWorkDay(D);if(N&&D.k===TODAY())h+=`<button class="btn ghost" onclick="EN.openPack()">🎒 Packen für ${N.wd} ${OKT(N.k)}</button>`;
  return h;}
function pWoche(){const ab=days7().map(k=>varOf(dayOf(k),'ab')),cnt=g=>ab.filter(v=>(GROUPS[g]||[]).includes(v)).length;
  const goals=[['Fisch abends',cnt('fish')+' / 3',cnt('fish')>=3?'ok':'warn'],['Rotes Fleisch',cnt('red')+' / max. 3',cnt('red')<=3?'ok':'warn']];
  let h=`<div class="ecard"><span class="km">Wochenziele</span>${goals.map(([a,b,c])=>`<div class="goal"><span>${a}</span><b class="${c}">${b}</b></div>`).join('')}</div><div class="ecard">`;
  days7().forEach(k=>{const D=dayOf(k),T=TT[D.type];h+=`<div class="wd" onclick="EN.sel('${k}');location.hash='#food/tage'"><div class="between"><b>${D.wd} ${OKT(k)}</b><span class="echip ${D.type==='rest'?'':'lime'}">${T.l} · ${T.kcal}</span></div>${D.train?`<div class="ln"><span style="color:var(--lime)">Training</span><span style="color:var(--lime)">${esc(D.train)}</span></div>`:''}${mealIds(D).map(id=>`<div class="ln"><span>${SL[id][0]}${D.slots.find(x=>x[0]===id)[2]==='work'?' 🎒':''}</span><span>${titleOf(D,id)}</span></div>`).join('')}</div>`;});
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
const covered=id=>{const g=FS().got[id];return !!g&&g>=TODAY();};
const fmtQ=(it,q)=>{const I=IT()[it];if(!I||I.unit==='basic'||!q)return '';
  if(I.unit==='g')return q>=1000?(q/1000).toFixed(1).replace('.',',')+' kg':Math.round(q)+' g';
  if(I.unit==='ml')return q>=1000?(q/1000).toFixed(1).replace('.',',')+' l':Math.round(q)+' ml';
  const n=Math.round(q*10)/10,u=I.unit==='Dose'&&n!==1?'Dosen':I.unit==='Packung'&&n!==1?'Packungen':I.unit==='Portion'&&n!==1?'Portionen':I.unit;
  return n.toString().replace('.',',')+' '+u;};
const byCat=list=>{const cats=C.shopCats||[],g={};list.forEach(x=>{const c=IT()[x.it].cat;(g[c]=g[c]||[]).push(x);});
  return Object.keys(g).sort((a,b)=>(cats.indexOf(a)+99)%99-(cats.indexOf(b)+99)%99).map(c=>[c,g[c]]);};
const dayTag=(r)=>!r.k?'':r.fresh?`bis ${dayOf(r.k).wd}`:`ab ${dayOf(r.k).wd}`;
/* Zeitraum der Liste: 3 oder 7 Tage ab morgen (pro Gerät gemerkt) */
let shopDays=(()=>{try{return +localStorage.getItem('wt-shopdays-v1')===7?7:3;}catch(e){return 3;}})(),doneOpen=false;
EN.shopDays=n=>{shopDays=n;try{localStorage.setItem('wt-shopdays-v1',String(n));}catch(e){}render();};
EN.doneTog=()=>{doneOpen=!doneOpen;render();};
/* „Ist da“ gilt bis zum letzten Tag, für den der Artikel gerade gebraucht wird (S.food.got[id] = Datum).
   Kommt später ein weiterer Bedarf dazu, steht er wieder auf der Liste. */
EN.have=(id,until)=>{const g=FS().got;if(g[id]&&g[id]>=until)delete g[id];else g[id]=until;R();};
EN.pset=(it,st)=>{FS().pantry[it]=st;R();};
EN.subst=(it,sb)=>{if(sb)FS().subst[it]=sb;else delete FS().subst[it];R();EN.openItem(it);};
EN.tk=dir=>{const st=STK();st.bolotk=Math.max(0,(st.bolotk||0)+dir);R();};

const infoBtn=it=>`<button class="btn sm ghost" onclick="event.stopPropagation();EN.openItem('${it}')" aria-label="Details">ⓘ</button>`;
const staleNote=()=>`<div class="ecard"><div class="sub">Die Artikelliste fehlt in den geladenen Inhalten (veralteter Stand von <b>nutrition.json</b>). Bitte die Seite neu laden.</div><button class="btn ghost" onclick="location.reload()">Neu laden</button></div>`;
/* Immer ausreichend da (Marc 04.10.): Obst, Snacks/Ersatz (always in nutrition.json), Öl und Gewürze.
   Ohne Abhaken, mit Richtmenge für eine Woche; alles andere steht mit konkreter Menge auf der Liste. */
const ALW=()=>{const s=new Set(((C&&C.always)||[]).filter(a=>!(a.hw===false&&hwDay(addD(TODAY(),1)))).map(a=>a.it));Object.keys(IT()).forEach(it=>{if(IT()[it].unit==='basic')s.add(it);});return s;};
/* Bedarf der nächsten n Tage ab morgen: it → [{k,q}] */
function needs(n){const start=addD(TODAY(),1),o={};
  for(let d=0;d<n;d++){const k=addD(start,d),D=dayOf(k);
    mealIds(D).forEach(id=>{const X=C.dishes[varOf(D,id)];if(!X||!X.use)return;const i=pix(D,id),g=isGuest(k,id);
      Object.entries(X.use).forEach(([it0,q])=>{const it=itemFor(it0,k),I=IT()[it];if(!I)return;const f=(g&&(!X.yields||kindOf(it)==='beilage')?gFit(it):1)*shopFactor(k,id,it0),v=I.unit==='basic'?0:qB(it0,q[i]||0)*f;
        if(!v&&I.unit!=='basic')return;(o[it]=o[it]||[]).push({k,q:v});});});}
  return {o,start,end:addD(start,n-1)};}
function shopList(n){const {o,start,end}=needs(n),A=ALW(),rows=[];
  Object.keys(o).forEach(it=>{const I=IT()[it];if(!I||it==='bolotk'||A.has(it))return;const xs=o[it];
    if(I.keep==='frisch'){const by={};xs.forEach(x=>{by[x.k]=(by[x.k]||0)+x.q;});
      Object.keys(by).sort().forEach(k=>rows.push({id:it+'@'+k,it,q:by[k],k,until:k,days:[k],fresh:true,later:diff(k,start)>=SOON}));}
    else rows.push({id:it,it,q:xs.reduce((a,x)=>a+x.q,0),until:xs.map(x=>x.k).sort().pop(),days:[...new Set(xs.map(x=>x.k))]});});
  Object.keys(IT()).filter(isPantry).forEach(it=>{const st=pState(it);if((st==='knapp'||st==='leer')&&!A.has(it)&&!rows.some(r=>r.it===it))rows.push({id:it,it,q:0,until:end,state:st});});
  return {rows,start,end};}
const isGot=r=>{const g=FS().got[r.id];return !!g&&g>=r.until;};
const qS=s=>String(s).replace(/^(\S+) Stück$/,'$1×');
/* Tage als feste Spalten (Mo Di Mi …): gebraucht = Etikett, sonst Lücke an derselben Stelle */
const dSlots=(r,ks)=>`<span class="dslots">${ks.map(k=>(r.days||[]).includes(k)?`<b class="${r.later?'late':''}">${dayOf(k).wd}</b>`:'<i></i>').join('')}</span>`;
function rowHTML(r,done,ks){const I=IT()[r.it],cnt=['Stück','Dose','Scheiben','Packung','Portion'].includes(I.unit),q=fmtQ(r.it,cnt?Math.ceil(r.q-1e-9):r.q);   /* Stückzahlen zum Einkaufen aufrunden */
  return `<div class="it ${done?'got':''}" onclick="EN.have('${r.id}','${r.until}')"><span class="ecb ${done?'on':''}"></span><div style="flex:1;min-width:0">${q?`<b class="qty">${qS(q)}</b> `:''}${nameOf(r.it)}${r.state?`<small>Vorrat: ${r.state}</small>`:''}</div>${done?'':dSlots(r,ks)}</div>`;}
/* Einkauf (04.10.): oben was konkret für die nächsten 3 bzw. 7 Tage gebraucht wird (Gesamtmenge, abhaken = ist da),
   dann frisch, dann „immer ausreichend da“ ohne Abhaken. Abgehaktes wandert nach „Erledigt“. */
function pEinkauf(){if(!Object.keys(IT()).length)return `<div class="ecard"><span class="k">Bedarf</span></div>`+staleNote();
  const M=shopList(shopDays),ks=Array.from({length:shopDays},(_,n)=>addD(M.start,n)),done=M.rows.filter(isGot),open=M.rows.filter(r=>!isGot(r)),now=open.filter(r=>!r.later),later=open.filter(r=>r.later);
  let h=`<div class="ecard"><div class="between"><span class="k">Bedarf</span><span class="meta">${open.length?open.length+' offen':'alles da'}</span></div>
    <div class="sub" style="margin-top:4px;font-size:13px">Was bis ${dayOf(M.end).wd} ${OKT(M.end)} da sein muss. Antippen, wenn du es hast oder gekauft hast.</div>
    <div class="seg" style="margin:10px 0 0">${[3,7].map(n=>`<button class="${shopDays===n?'on':''}" onclick="EN.shopDays(${n})">${n} Tage</button>`).join('')}</div></div>`;
  if(!open.length)h+=`<div class="ecard"><div class="sub">Alles da bis ${dayOf(M.end).wd}.</div></div>`;
  byCat(now).forEach(([c,xs])=>{h+=`<div class="ecard"><span class="km hl">${c}</span><div class="list">${xs.map(r=>rowHTML(r,false,ks)).join('')}</div></div>`;});
  if(later.length)h+=`<div class="ecard"><span class="km hl">Frisch, erst kurz vorher kaufen</span><div class="sub" style="font-size:12px;margin-top:2px">Am besten auf dem Heimweg am Vortag.</div><div class="list">${later.map(r=>rowHTML(r,false,ks)).join('')}</div></div>`;
  const A=[...ALW()].filter(it=>IT()[it]),w=needs(7).o,al=((C&&C.always)||[]),tgt=it=>{const a=al.find(x=>x.it===it),q=(a&&a.q)||(w[it]||[]).reduce((s,x)=>s+x.q,0),I=IT()[it];
    return I.unit==='basic'||!q?'':fmtQ(it,['Stück','Dose','Scheiben','Packung','Portion','Tafel'].includes(I.unit)?Math.ceil(q-1e-9):q);};
  if(A.length){const by={};A.forEach(it=>{const c=IT()[it].unit==='basic'?'Öl & Gewürze':'Obst & Snacks';(by[c]=by[c]||[]).push(it);});
    h+=`<div class="ecard"><span class="km hl">Immer ausreichend da</span><div class="sub" style="font-size:12px;margin-top:2px">Kein Abhaken. Richtmenge für eine Woche, nachkaufen, wenn es knapp wird.</div>${['Obst & Snacks','Öl & Gewürze'].filter(c=>by[c]).map(c=>`<div class="km" style="margin-top:10px">${c}</div><div class="list">${by[c].map(it=>{const a=al.find(x=>x.it===it);return `<div class="it" onclick="EN.openItem('${it}')"><div style="flex:1;min-width:0">${tgt(it)?`<b class="qty">${qS(tgt(it))}</b> `:''}${nameOf(it)}${a&&a.why?`<small>${a.why}</small>`:''}</div></div>`;}).join('')}</div>`).join('')}</div>`;}
  if(done.length)h+=`<div class="ecard"><div class="between" style="cursor:pointer" onclick="EN.doneTog()"><span class="km">Erledigt (${done.length})</span><span class="meta">${doneOpen?'ausblenden':'anzeigen ›'}</span></div>${doneOpen?`<div class="sub" style="font-size:12px;margin-top:2px">Antippen holt es zurück auf die Liste.</div><div class="list">${done.map(r=>rowHTML(r,true,ks)).join('')}</div>`:''}</div>`;
  const bolo=[];for(let n=0;n<shopDays;n++){const k=addD(M.start,n),D=dayOf(k);if(mealIds(D).includes('ab')&&varOf(D,'ab')==='bolo')bolo.push(D.wd);}
  if(bolo.length)h+=`<div class="hint">Bolognese ×4 kochen am <b>${bolo.join(', ')}</b>, danach liegen 3 Portionen im TK.</div>`;
  return h;}
/* Vorrat = Grundvorrat: da / knapp / leer, dazu die selbst gekochten Portionen */
function pVorrat(){if(!Object.keys(IT()).length)return `<div class="ecard"><span class="k">Vorrat</span></div>`+staleNote();
  const items=Object.keys(IT()).filter(isPantry).map(it=>({it})),tk=STK().bolotk||0;
  let h=`<div class="ecard"><span class="k">Vorrat</span><div class="sub" style="margin-top:6px;font-size:13px">Was immer da sein sollte. Knapp und leer kommen automatisch unter Bedarf.</div></div>
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
EN._dbg={dayOf:k=>dayOf(k),varOf:(D,id)=>varOf(D,id),IT:()=>IT(),C:()=>C,shopList:n=>shopList(n)};   /* Diagnose (Konsole) */
/* Heimweg: frische Zutat, die morgen gebraucht wird und noch nicht da ist */
function homewayToday(){if(!C)return [];return shopList(1).rows.filter(r=>r.fresh&&r.k===addD(TODAY(),1)&&!isGot(r));}
/* Rezepte (07.10.): Gerichte | Snacks statt Arbeit | Zuhause. Snack = Gericht, das nur in Snack-Slots vorkommt (aus alt abgeleitet).
   „Zum Ausprobieren“ = tryout aus nutrition.json (Buchrezepte), nur zum Ansehen, nicht im Plan, nicht in Bedarf und Vorrat. */
let recTab='meal';
EN.recTab=k=>{recTab=k;render();};
const isSnackDish=v=>{if(V[v].at==='gym')return true;const sl=Object.keys(ALT).filter(s=>ALT[s].includes(v));return sl.length>0&&sl.every(s=>SNACK.includes(s));};   /* Sporttasche = immer Snack */
const TRY=()=>(C&&C.tryout&&C.tryout.items)||[];
function pRezepte(){const sn=recTab==='snack';
  const it=v=>`<div class="it" onclick="EN.openRecipe('${v}')"><div>${V[v].n}<small>${[V[v].time,V[v].at==='work'?'🎒 mitnehmbar':''].filter(Boolean).join(' · ')}</small></div><span class="go">›</span></div>`;
  const tr=TRY().filter(x=>(x.kind==='snack')===sn);
  return `<div class="row" style="margin-bottom:12px">${[['meal','Gerichte'],['snack','Snacks']].map(([k,l])=>`<button class="pill ${recTab===k?'on':''}" onclick="EN.recTab('${k}')">${l}</button>`).join('')}</div>
    <div class="ecard"><span class="k">Im Plan</span><div class="list">${Object.keys(V).filter(v=>!V[v].hidden&&isSnackDish(v)===sn).map(it).join('')}</div></div>
    ${tr.length?`<div class="ecard"><span class="k">Zum Ausprobieren</span><div class="sub" style="margin-top:4px">Aus der Anti-Entzündungs-Diät, milchfrei angepasst. Nicht im Plan.</div>
      <div class="list">${tr.map(x=>`<div class="it" onclick="EN.openTry('${x.id}')"><div>${esc(x.n)}<small>${esc(x.time)} · ≈ ${x.kcal} kcal · ${x.P} g Protein</small></div><span class="go">›</span></div>`).join('')}</div></div>`:''}
    <div class="ecard"><span class="k">Bausteine (Glossar)</span><div class="list">${Object.keys(G).map(g=>`<div class="it" onclick="EN.openGl('${g}')"><div>${G[g].n}</div><span class="go">›</span></div>`).join('')}</div></div>`;}
EN.openTry=id=>{const x=TRY().find(y=>y.id===id);if(!x)return;
  sheet(`<div class="between"><h3>${esc(x.n)}</h3><span class="echip">${x.kind==='snack'?'Snack':'Gericht'}</span></div>
    <div class="mline">≈ ${x.kcal} kcal · P ${x.P} g · ⏱ ${esc(x.time)}</div>
    ${(x.basis||[]).length?`<div class="basis">${x.basis.map(b=>`<span class="on">${esc(b)}</span>`).join('')}</div>`:''}
    ${x.swap?`<div class="hint">${esc(x.swap)}</div>`:''}
    <div class="km sec">Zutaten · ${x.kind==='snack'?'1 Portion':'deine Portion'}</div>
    <table class="ing">${x.ing.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>
    ${x.side?`<div class="sub" style="font-size:13px;margin-top:6px">${esc(x.side)}</div>`:''}
    <div class="km sec">Zubereitung</div><ol class="steps">${x.steps.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>
    <div class="sub" style="font-size:12px;margin-top:10px">Buch ${esc(x.src)}</div>
    <button class="cancel" onclick="closeSheet()">Schließen</button>`);};

/* ---------- Analyse: „Wirkt es?“ (07.10.) ----------
   Zeigt zurück, was ohnehin eingetragen wird: Körper (Gewicht, Taille, Oberarm, Oberschenkel), Haut gegen Ausnahmen,
   Energie im Training gegen „nach Plan gegessen“. Bewertung nach KONZEPT.md: Aufbau = Gewicht +0,25–0,5 kg/Monat bei stabiler Taille.
   Nichts wird gespeichert, alles wird bei jedem Aufruf aus H.days und S.food.days abgeleitet. */
const series=f=>Object.keys(H.days).filter(k=>H.days[k][f]).sort().map(k=>[k,H.days[k][f]]);
/* Steigung pro 30 Tage (lineare Regression) über die letzten n Tage; null bei zu wenig Daten */
function perMonth(f,n,minPts){const xs=series(f).filter(([k])=>diff(TODAY(),k)<=n);if(xs.length<minPts||diff(xs[xs.length-1][0],xs[0][0])<14)return null;
  const X=xs.map(([k])=>diff(k,xs[0][0])),Y=xs.map(x=>x[1]),mx=X.reduce((a,b)=>a+b)/X.length,my=Y.reduce((a,b)=>a+b)/Y.length;
  let nu=0,de=0;X.forEach((x,i)=>{nu+=(x-mx)*(Y[i]-my);de+=(x-mx)*(x-mx);});return de?nu/de*30:null;}
const sgn=(v,d)=>(v>0?'+':v<0?'−':'±')+Math.abs(v).toFixed(d).replace('.',',');
/* Monats-Check (07.10.): Korridor Gewicht +0,25 … +1 kg/Monat bei Taille ≤ +0,5 cm/Monat (KONZEPT.md).
   Bremsen: erst ab ~80 % „Nach Plan“ in 4 Wochen, höchstens eine Anpassung alle 28 Tage. Liefert [Klasse, Text, Vorschlag ±1|0]. */
function bodyVerdict(){const w=perMonth('weight',42,4),t=perMonth('waist',42,3);
  if(w===null||t===null)return ['flat','Noch zu wenig Messungen. Die Bewertung startet, sobald Gewicht und Taille über 2 Wochen eingetragen sind.',0];
  const W=sgn(w,1)+' kg',T=sgn(t,1)+' cm',np=periodScore(addD(TODAY(),-28)),at=FS().set.portionAt,wait=at&&diff(TODAY(),at)<28;
  let r;
  if(t>0.5)r=['amb',`Taille steigt (${T} pro Monat), Gewicht ${W}. Ein Teil geht in den Bauch.`,-1];
  else if(w<0.25)r=['amb',`Gewicht ${W} pro Monat, Taille ${T}. Für Aufbau ist das zu wenig.`,1];
  else if(w>1.2)r=['amb',`Gewicht steigt sehr schnell (${W} pro Monat), die Taille hält noch (${T}). Weiter beobachten.`,0];
  else return ['ok',`Passt: Gewicht ${W} pro Monat, Taille ${T}. Du baust auf, ohne Bauch. So weiter.`,0];
  if(!r[2])return r;
  if(np&&np.p<80)return [r[0],r[1]+` Erst den Plan essen: „Nach Plan“ liegt bei ${np.p} %. Anpassen lohnt sich ab etwa 80 %.`,0];
  if(wait)return [r[0],r[1]+` Zuletzt angepasst am ${OKT(at)}, nächster Check ab ${OKT(addD(at,28))}.`,0];
  return r;}
function bodyTile(f){const xs=series(f);if(!xs.length)return `<div class="lift"><div class="ln">${MLAB[f]}</div><div class="lv">—</div><span class="chip flat">${MONTH.includes(f)?'Monatsmessung':'noch nicht gemessen'}</span></div>`;
  const v=xs[xs.length-1][1],d=v-xs[0][1],u=f==='weight'?'KG':'CM',good=f==='waist'?d<=-1:d>0;   /* Taille: unter 1 cm ist Messrauschen */
  const chip=xs.length<2?`<span class="chip flat">seit ${OKT(xs[0][0])}</span>`:Math.abs(d)<0.05?`<span class="chip flat">±0 seit ${OKT(xs[0][0])}</span>`
    :`<span class="chip ${good?'up':f==='waist'&&d>=1?'down':'flat'}">${sgn(d,1)} seit ${OKT(xs[0][0])}</span>`;
  return `<div class="lift"><div class="ln">${MLAB[f]}</div><div class="lv">${v.toFixed(1).replace('.',',')}<span class="u">${u}</span></div>${chip}${xs.length>=2?spark(xs.map(x=>x[1])):''}</div>`;}
/* Schultern ÷ Taille: zu jeder Schultermessung die Taille vom selben Tag oder die letzte davor (höchstens 14 Tage alt) */
function ratioSeries(){const wa=series('waist');return series('shoulder').map(([k,v])=>{const w=wa.filter(([x])=>x<=k&&diff(k,x)<=14).pop()||wa.find(([x])=>x>k&&diff(x,k)<=7);return w?[k,v/w[1]]:null;}).filter(Boolean);}
function ratioTile(){const xs=ratioSeries(),f2=v=>v.toFixed(2).replace('.',',');
  if(!xs.length)return `<div class="lift wide"><div class="ln">Schultern ÷ Taille</div><div class="lv">—</div><span class="chip flat">ab der ersten Schultermessung</span></div>`;
  const v=xs[xs.length-1][1],d=v-xs[0][1];
  return `<div class="lift wide"><div class="between2"><div><div class="ln">Schultern ÷ Taille</div><div class="lv">${f2(v)}</div></div><div class="rnote">V-Form ab ≈ 1,6</div></div>
    ${xs.length<2?`<span class="chip flat">seit ${OKT(xs[0][0])}</span>`:`<span class="chip ${d>=0.005?'up':d<=-0.005?'down':'flat'}">${d>=0?'+':'−'}${Math.abs(d).toFixed(2).replace('.',',')} seit ${OKT(xs[0][0])}</span>`}${xs.length>=2?spark(xs.map(x=>x[1]),300,34):''}</div>`;}
const TRIG=()=>EXC.filter(e=>e[1]==='r').map(e=>e[0]);
/* Haut der letzten 8 Wochen als Linie, Ausnahmen mit Trigger (rot in der Ausnahmen-Liste) als rote Striche */
function skinChart(){const N=56,W=320,Hh=78,L=16,R=6,T=8,B=16,x=i=>L+i*(W-L-R)/(N-1),y=v=>T+(5-v)*(Hh-T-B)/4;let pts=[],tr='',g='';
  for(let v=1;v<=5;v+=2)g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-5}" y="${y(v)+3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
  for(let i=0;i<N;i++){const k=addD(TODAY(),i-N+1),d=H.days[k]||{};if(d.haut)pts.push([x(i),y(d.haut)]);
    if((d.exc||[]).some(e=>TRIG().includes(e.kind)))tr+=`<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${Hh-B}" stroke="var(--red)" stroke-width="2" opacity=".7"/>`;}
  const lab=[0,28,55].map(i=>`<text x="${x(i)}" y="${Hh-3}" text-anchor="${i?i===55?'end':'middle':'start'}" font-size="10" fill="var(--muted)">${OKT(addD(TODAY(),i-N+1))}</text>`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Haut der letzten 8 Wochen">${g}${tr}${lab}
    ${pts.length>1?`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round"/>`:''}
    ${pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.2" fill="var(--amber)"/>`).join('')}</svg>`;}
/* Eigener Test: Haut in den 3 Tagen nach einer Trigger-Ausnahme gegen alle anderen Tage */
function skinTest(){const ks=Object.keys(H.days).filter(k=>diff(TODAY(),k)<=56).sort(),tk=ks.filter(k=>(H.days[k].exc||[]).some(e=>TRIG().includes(e.kind)));
  const after=k=>tk.some(t=>diff(k,t)>=1&&diff(k,t)<=3),hv=ks.filter(k=>H.days[k].haut),a=hv.filter(after),b=hv.filter(k=>!after(k));
  const avg=xs=>xs.reduce((s,k)=>s+H.days[k].haut,0)/xs.length,f=v=>v.toFixed(1).replace('.',',');
  if(tk.length<3||a.length<3||b.length<5)return `Noch zu wenig für einen Vergleich: ${hv.length} Hauteinträge, ${tk.length} Ausnahmen mit Trigger in 8 Wochen. Aussagekräftig ab etwa 3 Ausnahmen und 10 Einträgen.`;
  const d=avg(a)-avg(b);
  return `Haut 1–3 Tage nach Pizza, Süßem, Käse: <b>Ø ${f(avg(a))}</b> · sonst <b>Ø ${f(avg(b))}</b>. ${d>=0.5?'Bei dir scheint es einen Zusammenhang zu geben.':d<=0.2?'Bisher kein klarer Zusammenhang.':'Leichter Unterschied, weiter beobachten.'}`;}
/* Energie im Training (1–5) an Tagen „nach Plan“ (≥ 80 % der Zutaten) gegen die übrigen */
function energyTest(){const ks=Object.keys(FS().days).filter(k=>FS().days[k].energy&&k<=TODAY()).sort();if(!ks.length)return '';
  const sc=k=>{const s=dayScore(k);return s?s.nd/s.n:0;},a=ks.filter(k=>sc(k)>=0.8),b=ks.filter(k=>sc(k)<0.8),avg=xs=>(xs.reduce((s,k)=>s+FS().days[k].energy,0)/xs.length).toFixed(1).replace('.',',');
  const txt=a.length>=4&&b.length>=4?`Nach Plan gegessen: <b>Ø ${avg(a)}</b> · sonst <b>Ø ${avg(b)}</b> (${a.length} gegen ${b.length} Trainings)`
    :`Noch zu wenig für einen Vergleich: ${ks.length} Trainings mit Energie-Wert. Aussagekräftig ab je 4 Trainings mit und ohne Plan.`;
  return `<div class="chartcard" style="margin-top:12px"><h3>Energie im Training</h3><div class="wsub">${txt}</div></div>`;}
EN.bodyStats=function(){if(!C)return '';const [cls,txt,stp]=bodyVerdict(),cur=PSTEP();
  return `<h2 class="section">Wirkt es?<button class="ibtn" onclick="EN.openWirkt()" aria-label="Erklärung">i</button></h2>
    <div class="verdict ${cls}">${txt}${stp?`<button class="vbtn" onclick="EN.setPortion(${cur+stp})">Portionen am Abend eine Stufe ${stp>0?'höher':'niedriger'}<small>${stp>0?'+50 g Reis/Nudeln oder +250 g Kartoffeln':'−50 g Reis/Nudeln oder −250 g Kartoffeln'} · ≈ ${stp>0?'+':'−'}200 kcal pro Tag</small></button>`:''}${cur?`<div class="vnow">Portionen am Abend: ${pDesc(cur)}${FS().set.portionAt?' seit '+OKT(FS().set.portionAt):''}</div>`:''}</div>
    <div class="liftgrid">${['weight','waist'].map(bodyTile).join('')}${ratioTile()}${['shoulder','chest','arm','thigh'].map(bodyTile).join('')}</div>
    <div class="chartcard" style="margin-top:12px"><h3>Haut · letzte 8 Wochen</h3>${skinChart()}<div class="wsub"><span class="key amb"></span>Haut 1–5 <span class="key red"></span>Pizza, Süßes, Käse</div><div class="wsub">${skinTest()}</div></div>
    ${energyTest()}`;};
EN.openWirkt=()=>sheet(`<h3>Wirkt es?</h3><div class="ink2" style="margin-top:8px">
  <p><b>Körper:</b> Ziel ist Aufbau. Gewicht steigt +0,25 bis +1 kg pro Monat, die Taille höchstens +0,5 cm. Bewertet werden die letzten 6 Wochen als Trend, einzelne Tage schwanken um 1–2 kg. Im ersten Monat mit mehr Kohlenhydraten kommen 0,5–1 kg gefüllte Speicher dazu, das ist kein Fett.</p>
  <p><b>Anpassen</b> geht einmal im Monat, eine Stufe Portionen am Abend (≈ ±200 kcal pro Tag), Protein bleibt gleich. Erst wenn du im Schnitt etwa 80 % nach Plan isst: sonst misst die Waage nicht den Plan, sondern die Ausnahmen.</p>
  <p><b>Schultern, Brust, Oberarm, Oberschenkel</b> zeigen, ob das Gewicht dort ankommt, wo du es willst. Muskeln wachsen langsam: 0,5–1 cm in ein paar Monaten ist gut.</p>
  <p><b>Schultern ÷ Taille</b> ist „athletisch aussehen“ als Zahl: wird größer, wenn die Schultern wachsen oder die Taille schmaler wird. Um 1,6 gilt als klassische V-Form. Das ist eine Orientierung aus der Fitnesswelt, kein wissenschaftlicher Grenzwert.</p>
  <p><b>Fotos</b> zeigen, was keine Zahl kann. Vergleiche Monat gegen Monat, nicht Tag gegen Tag.</p>
  <p><b>Haut:</b> Ob Milch und Zucker Akne inversa verschlimmern, ist in Studien nur schwach belegt. Dein eigener Verlauf ist für dich aussagekräftiger. Gut belegt ist dagegen: weniger Bauchfett hängt mit weniger Schüben zusammen, deshalb zählt die Taille.</p>
  <p><b>Energie:</b> Genug Kohlenhydrate rund ums Training sind für Ausdauerleistung gut belegt. Der Vergleich zeigt, ob du es selbst merkst.</p>
  <p>Kraft und Laufen stehen direkt darunter. Zusammen ist das die Antwort.</p></div>
  <button class="cancel" onclick="closeSheet()">Schließen</button>`);

/* ---------- Einstellungen: neuer Abschnitt „Ernährung“ ---------- */
EN.exportHealth=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(H,null,1)],{type:'application/json'}));a.download='gesundheit-'+TODAY()+'.json';a.click();};
EN.settings=function(main){const set=main.querySelector('.set');if(!set||!C)return;const k=TODAY(),h=hwDay(k);
  const el=document.createElement('div');el.className='en';
  el.innerHTML=`<details class="setsec"><summary>Ernährung</summary><div class="secbody">
    <div class="km">Phasen</div>
    <div class="srow"><div><b>Heilungsfenster</b><small>${HW.active?(h?`läuft · Tag ${h}/${HW.len}`:'geplant')+` · ${OKT(HW.start)}–${OKT(hwEnd())} · endet automatisch`:'aus · für einen akuten Schub'}</small></div><button class="btn sm ghost" onclick="${HW.active?'EN.openHw()':'EN.openHwStart()'}">${HW.active?'verwalten':'starten'}</button></div>
    <div class="km" style="margin-top:14px">Grundeinstellungen</div>
    <div class="srow"><div>Portionen am Abend<small>${pDesc(PSTEP())} · eine Stufe = 50 g Reis/Nudeln oder 250 g Kartoffeln · ändern nach dem Monats-Check in Analyse → Wirkt es?</small></div><span class="stp"><button onclick="EN.setPortion(${PSTEP()-1})">−</button><b>${PSTEP()>0?'+':''}${PSTEP()}</b><button onclick="EN.setPortion(${PSTEP()+1})">+</button></span></div>
    <div class="srow"><div>Werktags fasten<small>erste Mahlzeit mittags · Vormittag entfällt, Mengen wandern auf Mittag, Snack und Abend</small></div><button class="btn sm ghost" onclick="EN.fastToggle()">${ST.fast?'an':'aus'}</button></div>
    <div class="srow" onclick="EN.openFree()" style="cursor:pointer"><div>Freie Mahlzeiten<small>${WO.flatMap(w=>freeOf(w).map(r=>WDL[w]+' '+RN[r])).join(', ')||'keine'} · ohne Plan, nicht in Bedarf und Vorrat</small></div><span class="v">ändern ›</span></div>
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
