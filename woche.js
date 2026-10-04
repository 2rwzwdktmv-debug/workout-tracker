/* Laufwoche · Anderes Training · 2-Tage-Regel · Neue Woche starten
   Daten (alles in S, synchronisiert wie der Rest):
     S.plan.other  = { "YYYY-MM-DD": { n: "Fitness für Männer", lv: "mittel" } }   (der Tag steht zusätzlich in S.plan.off → Plan rutscht)
     S.xruns       = [ { d: "YYYY-MM-DD", kind: "warmup" | "locker" | "hart" | "wettkampf", t: Minuten, km, hf } ]
     S.plan.nwSkip = "pi.wi"   („Woche erst fertig machen“ für diese Planwoche)
   Regeln (mit Marc am 04.10.2026 abgestimmt):
     Laufwoche   = Kalenderwoche Mo–So; ein Lauf zählt ab 30 min, km zählen immer (auch Warm-up)
     2-Tage      = nach 2 laufreien Tagen am dritten mind. 30 min locker
     Neue Woche  = 10 Tage nach dem letzten Day 1: 1–2 offene Tage → springen (Long Run bleibt), 3+ → Woche zurücksetzen;
                   mind. 2 Tage Abstand zur letzten HARTEN LAUFEINHEIT (Day 1, Lauftest, Wettkampf, „＋ Lauf“ Hart/Wettkampf).
                   WICHTIG: nur Laufeinheiten. Harte Nicht-Laufeinheiten (Zirkel, EMOM, Kraft …) zählen hier nie —
                   die sind nur fürs Essen relevant (Stärke beim Anderen Training).      */
(function () {
const RUNK = { "endurance-run": 1, "long-run": 1, "tempo-8min": 1, "road-test-30min": 1, "mile-tt": 1, "intervals-1000m": 1 };
const HARDK = { "tempo-8min": 1, "road-test-30min": 1, "mile-tt": 1, "intervals-1000m": 1 };
const KINDS = ["Fitness für Männer", "Zirkel / Kurs", "Tanzen", "Wettkampf"];
const LVS = ["locker", "mittel", "hart"];
const WDS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const T = () => dkey(today0());
const D = k => new Date(k + "T12:00:00");
const between = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const num = s => { const v = parseFloat(String(s || "").trim().replace(",", ".")); return isFinite(v) ? v : null; };
const dec1 = v => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
const P = () => { const p = planState(); if (!p.other || typeof p.other !== "object") p.other = {}; return p; };
const XR = () => (S.xruns = S.xruns || []);
const DEMO = () => "";   // Demo nur im Mockup
const demoOff = () => {};

/* „1:05:00“ / „52:30“ / „45“ → Minuten */
function mins(s) {
  const p = String(s || "").trim().split(":").map(x => parseFloat(x.replace(",", ".")));
  if (!p.length || p.some(x => !isFinite(x))) return null;
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2) return p[0] < 4 ? p[0] * 60 + p[1] : p[0] + p[1] / 60;
  return p[0];
}
/* km eines Plan-Laufs aus dem Ergebnis (grob, für die Wochensumme) */
function kmOf(it) {
  const v = String(S.resultsByItem[it.id] || "");
  if (!v) return 0;
  if (it.key === "tempo-8min") return v.split("·").reduce((a, tok) => {
    const m = tok.match(/^\s*([\d.]+)\s*m?[^(]*(?:\(P\s*(\d+)\))?/);
    return a + (m ? +m[1].replace(/\./g, "") + (m[2] ? +m[2] : 0) : 0);
  }, 0) / 1000;
  if (it.key === "mile-tt") return 1.61;
  if (it.key === "intervals-1000m") return v.split("·").filter(x => x.trim()).length * 1.4;   // 1000 m + 400 m Traben
  const tok = v.split(/[|·]/).map(x => x.trim()).find(x => /km/i.test(x) || /^\d+[.,]\d+$/.test(x));
  return tok ? num(tok.replace(/km/i, "")) || 0 : 0;
}
/* Datum eines Plan-Laufs: das eingetragene Ergebnis (Watch-Datum) vor dem Häkchen */
function runDate(it) {
  const e = (S.results[it.key] || []).find(x => x.itemId === it.id && (x.run || 1) === (S.run || 1));
  const iso = e ? e.date : S.checked[it.id];
  return typeof iso === "string" ? dkey(new Date(iso)) : null;
}
/* Pro Kalendertag: km und ob ein „Bakken-Lauf“ (≥ 30 min) dabei war */
function runDays() {
  const out = {};
  const at = k => (out[k] = out[k] || { km: 0, full: false, any: false });
  Object.keys(ITEM_INDEX).forEach(id => {
    const it = ITEM_INDEX[id];
    if (!RUNK[it.key] || !S.checked[id]) return;
    const k = runDate(it); if (!k) return;
    const r = at(k); r.km += kmOf(it); r.full = r.any = true;
  });
  XR().forEach(x => { const r = at(x.d); r.km += x.km || 0; r.any = true; if ((x.t || 0) >= 30) r.full = true; });
  return out;
}
const planRunToday = e => e && e.kind === "train" && e.d.items.some(i => RUNK[i.key]);

/* ---------- Karte „Laufwoche“ (Übersicht, unter „Heute“) ---------- */
function card(days) {
  const t = T(), rd = runDays(), now = D(t);
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = WDS.map((w, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return dkey(d); });
  const nFull = week.filter(k => rd[k] && rd[k].full).length;
  const km = week.reduce((a, k) => a + (rd[k] ? rd[k].km : 0), 0);
  const planned = {};
  days.forEach(e => { if (planRunToday(e)) planned[e.k] = 1; });
  const dots = week.map((k, i) => {
    const r = rd[k], cls = r && r.full ? "on" : r && r.any ? "half" : k > t && planned[k] ? "plan" : "";
    return `<span class="${cls}${k === t ? " now" : ""}"><i></i>${WDS[i]}</span>`;
  }).join("");
  // 2-Tage-Regel
  let last = null;
  for (let i = 0; i <= 14 && !last; i++) { const d = new Date(now); d.setDate(now.getDate() - i); const k = dkey(d); if (rd[k] && rd[k].full) last = k; }
  const gap = last ? between(last, t) - 1 : 99;        // volle laufreie Tage vor heute
  let hint = "";
  if (last === t) hint = `<div class="lwh ok">Heute gelaufen ✓</div>`;
  else if (gap >= 2) hint = planRunToday(days[0])
    ? `<div class="lwh">Seit ${gap > 14 ? "über 2 Wochen" : gap + " Tagen"} kein Lauf · heute läufst du mit ${esc(dayTitle(days[0].d))}</div>`
    : `<div class="lwh due">Heute mind. 30 min locker laufen · seit ${gap > 14 ? "über 2 Wochen" : gap + " Tagen"} kein Lauf</div>`;
  else if (gap === 1 && !planRunToday(days[0])) hint = `<div class="lwh">Spätestens morgen wieder 30 min laufen</div>`;
  const kw = (() => { const d = new Date(now); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const j = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); })();
  return `<div class="lwoche">
    <div class="lwt"><span>Laufwoche <span class="kw">· KW ${kw}</span></span><span class="lwadd" onclick="WOCHE.runSheet()">＋ Lauf</span></div>
    <div class="lwr"><div class="lwv"><b>${nFull}</b> ${nFull === 1 ? "Lauf" : "Läufe"}<br><b class="blue">${dec1(km)}</b><span class="u">KM</span></div>
      <div class="lwd">${dots}</div></div>
    ${hint}
  </div>`;
}

/* ---------- Lauf eintragen (Warm-up oder lockerer Lauf) ---------- */
let RK = "warmup", RD = 0;
function runSheet() {
  closeSheet();
  const d0 = new Date(today0()); d0.setDate(d0.getDate() - RD);
  const wrap = document.createElement("div");
  wrap.className = "sheetwrap";
  wrap.onclick = ev => { if (ev.target === wrap) closeSheet(); };
  wrap.innerHTML = `<div class="sheet wsheet">
    <h4>Lauf eintragen</h4>
    <p>Werte aus der Watch. Ab 30 min zählt er als Lauf für die 2-Tage-Regel, die km zählen immer. Hart und Wettkampf zählen als harte Laufeinheit.</p>
    <div class="wch">${[["warmup", "Warm-up"], ["locker", "Locker"], ["hart", "Hart"], ["wettkampf", "Wettkampf"]].map(([k, l]) =>
      `<button class="${RK === k ? "on" : ""}" onclick="WOCHE.rk('${k}')">${l}</button>`).join("")}</div>
    <div class="wch">${[0, 1, 2].map(i => { const d = new Date(today0()); d.setDate(d.getDate() - i);
      return `<button class="${RD === i ? "on" : ""}" onclick="WOCHE.rd(${i})">${i === 0 ? "heute" : i === 1 ? "gestern" : WD[d.getDay()] + " " + fmtDay(d)}</button>`; }).join("")}</div>
    <div class="res lauf"><div class="lf">
      <label>Zeit<input id="xr-t" inputmode="numeric" placeholder="${RK === "warmup" ? "15:00" : RK === "wettkampf" ? "45:00" : "35:00"}"></label>
      <label>km<input id="xr-km" inputmode="decimal" placeholder="${RK === "warmup" ? "2,4" : RK === "wettkampf" ? "10,0" : "5,2"}"></label>
      <label>Ø-HF<input id="xr-hf" inputmode="numeric" placeholder="135"></label></div></div>
    <button class="wsave" onclick="WOCHE.saveRun()">Eintragen · ${WD[d0.getDay()]} ${esc(fmtDay(d0))}</button>
    <button class="cancel" onclick="closeSheet()">Abbrechen</button>
  </div>`;
  document.body.appendChild(wrap);
}
function saveRun() {
  const t = mins(document.getElementById("xr-t").value), km = num(document.getElementById("xr-km").value);
  const hf = parseInt(document.getElementById("xr-hf").value, 10) || null;
  if (!t && !km) { closeSheet(); return; }
  const d = new Date(today0()); d.setDate(d.getDate() - RD);
  XR().push({ d: dkey(d), kind: RK, t: t ? Math.round(t * 10) / 10 : 0, km: km || 0, hf });
  closeSheet(); markDirty(); render();
}

/* ---------- Anderes Training ---------- */
let ON = KINDS[0], OL = "mittel";
function otherSheet(k) {
  closeSheet();
  const e = projectPlan(14).find(x => x.k === k);
  const cur = P().other[k];
  if (cur) { ON = cur.n; OL = cur.lv; }
  const names = KINDS.concat(Object.values(P().other).map(o => o.n)).filter((n, i, a) => a.indexOf(n) === i);
  const wrap = document.createElement("div");
  wrap.className = "sheetwrap";
  wrap.onclick = ev => { if (ev.target === wrap) closeSheet(); };
  wrap.innerHTML = `<div class="sheet wsheet">
    <h4>Anderes Training · ${WD[D(k).getDay()]} ${esc(fmtDay(D(k)))}</h4>
    <p>${e && e.d ? "Statt " + esc(dayTitle(e.d)) + ". " : ""}Der Plan rutscht wie bei „Geht nicht“. Die Stärke gilt nur fürs Essen: „hart“ zählt dort wie ein Trainingstag.</p>
    <div class="wch">${names.map(n => `<button class="${ON === n ? "on" : ""}" onclick="WOCHE.on(this.textContent)">${esc(n)}</button>`).join("")}<button onclick="WOCHE.onNew()">＋ neu</button></div>
    <div class="wch lv">${LVS.map(l => `<button class="${OL === l ? "on" : ""}" onclick="WOCHE.ol('${l}')">${l}</button>`).join("")}</div>
    <button class="wsave" onclick="WOCHE.saveOther('${k}')">${esc(ON)} · ${OL} eintragen</button>
    ${cur ? `<button onclick="WOCHE.delOther('${k}')">Wieder Plan-Training<small>Der Plan kehrt an diesen Tag zurück.</small></button>` : ""}
    <button class="cancel" onclick="closeSheet()">Abbrechen</button>
  </div>`;
  document.body.appendChild(wrap);
  OK = k;
}
let OK = null;
function saveOther(k) {
  const p = P();
  p.other[k] = { n: ON, lv: OL };
  if (p.off.indexOf(k) < 0) { p.off.push(k); p.off.sort(); }
  const j = p.force.indexOf(k); if (j >= 0) p.force.splice(j, 1);
  closeSheet(); markDirty(); render();
}
function delOther(k) {
  const p = P(); delete p.other[k];
  const i = p.off.indexOf(k); if (i >= 0) p.off.splice(i, 1);
  closeSheet(); markDirty(); render();
}
/* Anzeige eines „off“-Tags: Anderes Training statt „Geht nicht“ */
function offInf(e) {
  const o = P().other[e.k];
  return o ? `<div class="inf"><div class="t ot">${esc(o.n)}</div><div class="s">${o.lv} · anderes Training, der Plan rutscht</div></div>`
           : `<div class="inf"><div class="t">Geht nicht</div><div class="s">antippen zum Zurücknehmen</div></div>`;
}
function offClick(e) { return P().other[e.k] ? `WOCHE.otherSheet('${e.k}')` : `planOffToggle('${e.k}')`; }
function todayOff(first) {
  const o = P().other[first.k];
  return o ? { n: o.n, d: `${o.lv} · anderes Training statt Plan, der Plan rutscht`, lk: `WOCHE.otherSheet('${first.k}')`, lt: "ändern ›" } : null;
}

/* ---------- Neue Woche starten ---------- */
const isLong = d => d.items.some(i => i.key === "long-run" || (i.key === "endurance-run" && /155/.test(i.own || "")));
const lastIso = d => d.items.map(i => S.checked[i.id]).filter(x => typeof x === "string").sort().pop();
function lastDay1() {
  let best = null;
  planDays().forEach(d => { if (d.di === 0 && d.items.some(i => S.checked[i.id])) { const t = lastIso(d); if (t && (!best || t > best)) best = t; } });
  return best ? dkey(new Date(best)) : null;
}
function lastHardRun() {
  let best = lastDay1();
  Object.keys(ITEM_INDEX).forEach(id => { const it = ITEM_INDEX[id]; if (HARDK[it.key] && S.checked[id]) { const k = runDate(it); if (k && (!best || k > best)) best = k; } });
  Object.keys(P().other).forEach(k => { if (P().other[k].n === "Wettkampf" && k <= T() && (!best || k > best)) best = k; });
  XR().forEach(x => { if ((x.kind === "hart" || x.kind === "wettkampf") && x.d <= T() && (!best || x.d > best)) best = x.d; });
  return best;
}
/* Welche Woche, was ist offen, was ist erledigt — und welcher Fall gilt?
   Fall „springen“:      10 Tage seit Day 1, 1–2 offene Tage (ohne Long Run) → offene Tage fallen weg, Long Run bleibt
   Fall „zurücksetzen“:  10 Tage seit Day 1, 3+ offene Tage → die ganze Woche nochmal ab Day 1 (Erledigtes wird wieder offen)
   Beide nur mit mind. 2 Tagen Abstand zur letzten harten Laufeinheit; sonst „frühestens …“.                                     */
function nwState() {
  const q = planQueue();
  if (!q.length) return null;
  const demo = DEMO();
  let head = q[0];
  if (demo === "4" && !planDays().some(d => d.pi === head.pi && d.wi === head.wi && d.items.some(i => S.checked[i.id]))) {
    const lastDone = planDays().filter(d => d.items.some(i => S.checked[i.id])).pop();   // Demo: letzte Woche mit Erledigtem
    if (lastDone) head = lastDone;
  }
  const wk = head.pi + "." + head.wi;
  if (!demo && (head.di === 0 || P().nwSkip === wk)) return null;
  const week = planDays().filter(d => d.pi === head.pi && d.wi === head.wi);
  const open = q.filter(d => d.pi === head.pi && d.wi === head.wi);
  const done = week.filter(d => d.items.some(i => S.checked[i.id]));
  const l1 = lastDay1();
  let since = l1 ? between(l1, T()) : 0, mode = open.length >= 3 ? "reset" : "jump";
  let drop = open.filter(d => !isLong(d)), keep = open.filter(isLong);
  let openN = open.length, doneShow = done;
  if (demo) { since = Math.max(since, 10); mode = demo === "4" ? "reset" : "jump";
    if (demo === "3") { drop = drop.slice(-1); keep = keep.slice(-1); }
    else { openN = Math.max(3, open.length); doneShow = week.slice(0, Math.max(0, week.length - openN)); } }   // Demo: so tun, als wären die letzten 3 Tage offen
  else if (since < 10 || (mode === "jump" && !drop.length)) return null;
  return { head, wk, week, open, done: doneShow, openN, drop, keep, since, mode };
}
function nwCard() {
  const st = nwState();
  if (!st) return "";
  const lh = lastHardRun(), gapHard = lh ? between(lh, T()) : 99;
  const wait = gapHard < 2 ? `<div class="s">Frühestens ${gapHard === 1 ? "übermorgen" : "in 2 Tagen"}: mind. 2 Tage Abstand zur letzten harten Laufeinheit.</div>` : "";
  const P0 = PROGRAM[st.head.pi], W0 = P0.weeks[st.head.wi];
  const tag = DEMO() ? " · Demo" : "";
  if (st.mode === "reset") return `<div class="today nw">
    <div class="k">Woche nochmal von vorn?${tag}</div>
    <div class="v">${esc(P0.name)} · ${esc(W0.name)} ab Day 1</div>
    <div class="s">Letzte 4×8 vor ${st.since} Tagen, ${st.openN} Tage sind noch offen. ${st.done.map(d => esc(d.day.label)).join(", ")} ${st.done.length === 1 ? "wird" : "werden"} wieder offen, deine Werte bleiben im Verlauf.</div>
    ${wait}
    <button class="cta" onclick="WOCHE.nwReset()">Woche auf Day 1 zurücksetzen</button>
    <button class="cta ghost" onclick="WOCHE.nwLater('${st.wk}')">Woche weiter machen</button>
  </div>`;
  const nx = P0.weeks[st.head.wi + 1] ? P0.weeks[st.head.wi + 1].name : (PROGRAM[st.head.pi + 1] ? PROGRAM[st.head.pi + 1].name + " · Week 1" : "");
  return `<div class="today nw">
    <div class="k">Neue Woche starten?${tag}</div>
    <div class="v">${esc(nx)} · Day 1</div>
    <div class="s">Letzte 4×8 vor ${st.since} Tagen. Übersprungen wird: ${st.drop.map(d => esc(d.day.label + " · " + daySub(d).split("\n")[0])).join(", ")}${st.keep.length ? `\nDer Long Run (${esc(st.keep[0].day.label)}) bleibt und kommt noch davor.` : ""}</div>
    ${wait}
    <button class="cta" onclick="WOCHE.nwStart()">Neue Woche mit Day 1 starten</button>
    <button class="cta ghost" onclick="WOCHE.nwLater('${st.wk}')">Woche weiter machen</button>
  </div>`;
}
function nwStart() {
  const st = nwState(), p = P();
  if (!st) return;
  st.drop.forEach(d => { if (p.dropped.indexOf(d.key) < 0) { p.dropped.push(d.key); logEv("drop", d.items[0].id, { why: "neue Woche" }); } });
  demoOff(); markDirty(); render();
}
/* Zurücksetzen: Häkchen der Woche weg, Ergebnisse bleiben als frühere Versuche (rep) im Verlauf */
function nwReset() {
  const st = nwState();
  if (!st) return;
  const ids = st.week.flatMap(d => d.items.map(i => i.id));
  const mineK = k => ids.some(id => k === id || k.indexOf(id + "/") === 0);
  Object.keys(S.checked).forEach(k => { if (mineK(k)) delete S.checked[k]; });
  Object.keys(S.resultsByItem).forEach(k => { if (mineK(k)) delete S.resultsByItem[k]; });
  Object.values(S.results).forEach(arr => arr.forEach(e => { if (mineK(e.itemId) && (e.run || 1) === (S.run || 1) && !e.rep) e.rep = 1; }));
  logEv("reset", ids[0], { week: st.wk });
  demoOff(); markDirty(); render();
}
function nwLater(wk) { P().nwSkip = wk; demoOff(); markDirty(); render(); }

/* ---------- Felder an Plan-Läufen ohne eigenes Ergebnis ----------
   Warm-up, Cool-down, Easy Run, Recovery Run … stehen im Plan ohne key, hatten also kein Feld.
   Jetzt: Warm-up/Cool-down → Zeit + km; Easy/Recovery → Zeit + km + Ø-HF (zählt ab 30 min auch
   bei den lockeren Läufen in der Analyse). Gespeichert als S.xruns-Eintrag mit item = Plan-ID,
   Datum = Tag des Häkchens (sonst heute). Zählt in der Laufwoche.                              */
const WARM_RX = /warm.?up|cool.?down/i;
const RUN_RX = /\b(run|jog|lauf)/i;
const runKind = it => { if (it.key || it.rest) return null; const t = (it.title || "") + " " + (it.sub || ""); return !RUN_RX.test(t) ? null : WARM_RX.test(t) ? "warmup" : "locker"; };
const fmtMin = t => { const m = Math.floor(t), sec = Math.round((t - m) * 60); return sec === 60 ? (m + 1) + ":00" : m + ":" + String(sec).padStart(2, "0"); };
const dec2 = v => String(Math.round(v * 100) / 100).replace(".", ",");
function runField(item) {
  const kind = runKind(item);
  if (!kind) return "";
  const x = XR().find(r => r.item === item.id) || {}, id = item.id, on = `onchange="WOCHE.saveField('${id}')"`;
  return `<div class="res lauf"><div class="lf">
    <label>Zeit<input id="wu-t-${id}" inputmode="numeric" placeholder="${kind === "warmup" ? "10:00" : "45:00"}" value="${x.t ? fmtMin(x.t) : ""}" ${on}></label>
    <label>km<input id="wu-k-${id}" inputmode="decimal" placeholder="${kind === "warmup" ? "1,6" : "6,5"}" value="${x.km ? dec2(x.km) : ""}" ${on}></label>
    ${kind === "locker" ? `<label>Ø-HF<input id="wu-h-${id}" inputmode="numeric" placeholder="135" value="${x.hf || ""}" ${on}></label>` : ""}
  </div></div>`;
}
function saveField(id) {
  const it = ITEM_INDEX[id], kind = runKind(it);
  const g = s => { const el = document.getElementById(s + id); return el ? el.value : ""; };
  const t = mins(g("wu-t-")), km = num(g("wu-k-")), hf = parseInt(g("wu-h-"), 10) || null;
  const list = XR(), i = list.findIndex(r => r.item === id);
  if (i >= 0) list.splice(i, 1);
  if (t || km) {
    const c = S.checked[id], d = typeof c === "string" ? dkey(new Date(c)) : T();
    list.push({ d, kind, t: t ? Math.round(t * 10) / 10 : 0, km: km || 0, hf, item: id });
  }
  markDirty();   // kein Neuaufbau: der Fokus bleibt im nächsten Feld
}

window.WOCHE = {
  runField, saveField,
  card, nwCard, runSheet, saveRun, otherSheet, saveOther, delOther, offInf, offClick, todayOff,
  rk: k => { RK = k; runSheet(); }, rd: i => { RD = i; runSheet(); },
  on: n => { ON = n; if (n === "Wettkampf") OL = "hart"; otherSheet(OK); }, ol: l => { OL = l; otherSheet(OK); },
  onNew: () => { const n = (prompt("Name des Trainings") || "").trim(); if (n) { ON = n; otherSheet(OK); } },
  nwStart, nwReset, nwLater,
  /* Ernährung: Tagestyp für ein Anderes Training */
  type: k => { const o = (planState().other || {})[k]; return o ? (o.lv === "hart" ? "train" : "active") : null; },
};
})();
