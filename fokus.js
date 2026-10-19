/* Fokus: Key · Base · Support (intern S/B/E, bis 19.10. Schlüssel/Basis/Extra), 7-Tage-Planwoche, Rangfolge (Wochenmodell 18.10.2026, doku/WOCHENMODELL-2026-10-18.md)
   Einheit = eine Session eines Plan-Tags (AM oder PM, wie seit 11.10. in „Heute“). Alles hier gilt pro Einheit.
   Daten im Plan (plan-skripte/einordnung-einbauen.py): session.fokus = { s: "S" | "B" | "E", r: Rang 1–7, w: Begründung }
     Rang: 1 Day 1 (Schwelle + Kniebeuge) · 2 Long Run · 3 Banktag / zweite Qualität · 4 Kreuzhebetag · 6 Basis · 7 Extra
   Daten in S.plan (synchronisiert wie der Rest); Einheiten-Schlüssel "pi.wi.di/si":
     tpw       Trainingstage pro Woche (Standard 6, Marcs Maximum)
     fokusFrom "YYYY-MM-DD": ab hier gilt die 7-Tage-Regel; wird beim ersten Einsatz auf heute gesetzt
     fokusBack ["pi.wi.di/si"]: „zurückholen“, fällt nicht mehr automatisch weg
     fokusSkip ["pi.wi.di/si"]: von Marc weggelassen (nur Basis/Extra), z. B. nur das AM-Metcon eines Tages
     short     { "pi.wi.di/si": 1 }: lockerer Lauf dieser Einheit nur 30 min (wandert mit, wenn der Plan rutscht)
     fokusLog  { "pi.wi": { s, e, u: ["pi.wi.di/si", …] } }: was in einer abgelaufenen Planwoche weggefallen ist (19.10.).
               Wird festgeschrieben, sobald das 7-Tage-Fenster vorbei ist; diese Einheiten kommen nie zurück in den Plan.
               Grundlage für den Kalender (vergangene Wochen) und später die Analyse „ausgelassen wegen Zeit“.
     away      [{ id, s, e, n, pause, rs }]: Abwesenheit als Zeitraum (19.10.). Die Tage stehen zusätzlich in off (wie „Geht nicht“).
               Art automatisch nach Länge: 1–3 Tage kürzen (wie „Geht nicht“, die Woche bleibt bei 7 Tagen),
               ab 4 Tagen pause = true (zählen nicht zu den 7 Tagen, der Plan wartet).
               Rückkehr (Marc 19.10.): Liegt der letzte Day 1 dann 7+ Tage zurück, wird die angefangene Woche auf Day 1
               zurückgesetzt (wie „Woche nochmal von vorn“ vom 04.10.). rs = geprüft / "reset" = zurückgesetzt.
     dayMode   { "pi.wi.di": { m: "am" | "pm", k, keep, other, how: "later" | "skip", txt } }: Tag übergeordnet (19.10.),
               hängt am Plan-Tag und wandert mit (wie „Nur 30 min“); k = Datum, an dem es gewählt wurde (für later)
               „Nur AM“ / „Nur PM“: die wichtigere Einheit (Rang) in diesem Slot, die andere rutscht als Key auf morgen
               (über later) oder fällt als Base/Support weg (über fokusSkip). Beide Key: AM heute, PM morgen.
   Regel: Eine Planwoche hat 7 Kalendertage ab ihrer ersten Einheit. Passt nicht alles hinein (Geht nicht, Anderes Training,
   weniger Trainingstage, PM verschoben), fallen Kalender-Einträge weg, vom höchsten Rang zuerst: Extra, dann Basis, dann
   Schlüssel 4, 3, 2. Liegen AM und PM am selben Tag, fallen sie zusammen weg (sonst gewinnt man keinen Tag); liegt nur eine
   Hälfte allein an einem Tag (PM verschoben), fällt nur diese weg. Rang 1 (Day 1) fällt nie weg.
   Weggefallenes der laufenden und kommenden Planwochen wird bei jedem Rendern neu berechnet (wie der ganze Tagesplan),
   erst nach Ablauf des Fensters landet es in fokusLog.                                                              */
(function () {
const T = () => dkey(today0());
const D = k => new Date(k + "T12:00:00");
const P = () => {
  const p = planState();
  if (!Array.isArray(p.fokusBack)) p.fokusBack = [];
  if (!Array.isArray(p.fokusSkip)) p.fokusSkip = [];
  if (!p.short || typeof p.short !== "object" || Array.isArray(p.short)) p.short = {};
  if (!p.fokusLog || typeof p.fokusLog !== "object" || Array.isArray(p.fokusLog)) p.fokusLog = {};
  if (!Array.isArray(p.away)) p.away = [];
  if (!p.dayMode || typeof p.dayMode !== "object" || Array.isArray(p.dayMode)) p.dayMode = {};
  Object.keys(p.short).forEach(k => { if (/^\d{4}-/.test(k)) delete p.short[k]; });   // Mockup-Altstand (Datum statt Einheit)
  return p;
};
const TPW = () => { const v = +((S.plan || {}).tpw); return v >= 3 && v <= 7 ? v : 6; };
const FROM = () => { const p = P(); if (!p.fokusFrom) p.fokusFrom = T(); return p.fokusFrom; };
const NAME = { S: "Key", B: "Base", E: "Support" };   // Anzeige (19.10., Marc: englische Namen)
const wk = d => d.pi + "." + d.wi;
const uk = (d, si) => d.key + "/" + si;                       // Einheiten-Schlüssel
const fk = s => s && s.fokus;
const s2On = s => (s.items || []).some(i => i.opt === "schwelle2") && (typeof optShown !== "function" || optShown("schwelle2"));
const realIdx = d => d.day.sessions.map((s, si) => si).filter(si => sessReal(d.day.sessions[si]).length);
const partIdx = e => (e.part && e.part.length ? e.part : realIdx(e.d));
let OC = null;                                                // Plan-Tag im Original (Klone haben weggelassene Hälften geleert)
const origOf = d => { if (!OC) { OC = {}; planDays().forEach(x => { OC[x.key] = x; }); } return OC[d.key] || d; };
const slotOf = (d, si) => {
  const dms = Object.values(P().dayMode), uid = d.key + "/" + si;
  const ov = dms.find(x => x.keep === uid);                     // „Nur PM“: die behaltene Einheit heißt PM
  if (ov) return ov.m.toUpperCase();
  if (dms.some(x => x.other === uid && x.how === "skip")) return "";   // die dafür weggefallene: ohne Slot
  const o = origOf(d); return (realIdx(o).length > 1 ? pvSlots(o.day.sessions)[si] : null) || "";
};
function sessRank(s) {
  const r = (fk(s) || {}).r || 6;
  return s2On(s) ? Math.min(r, 3) : r;                         // Tag mit zweiter Schwelle zählt wie ein Banktag
}

/* ---------- Warteschlange: weggelassene Einheiten herausnehmen ---------- */
/* Fällt nur eine Hälfte weg, bleibt der Plan-Tag mit der anderen Hälfte (Session-Index bleibt gleich, Liste leer). */
function withoutUnits(q, gone) {
  const out = [];
  q.forEach(d => {
    const drop = realIdx(d).filter(si => gone.has(uk(d, si)));
    if (!drop.length) { out.push(d); return; }
    if (drop.length === realIdx(d).length) return;
    const sessions = d.day.sessions.map((s, si) => (drop.indexOf(si) >= 0 ? Object.assign({}, s, { items: [] }) : s));
    const day = Object.assign({}, d.day, { sessions });
    const c = Object.assign({}, d, { day, items: dayItems(day) });
    if (!dayDone(c)) out.push(c);
  });
  return out;
}

/* ---------- 7-Tage-Regel ---------- */
const orig = window.planQueue;
let CACHE = null, BUSY = false;
function compute() {
  if (CACHE) return CACHE;
  const p = P(), back = new Set(p.fokusBack), t = T(), from = FROM();
  if (backFromAway(p, t)) setTimeout(() => { markDirty(); render(); }, 0);
  const skip = new Set(p.fokusSkip.filter(k => !back.has(k)));
  const PAUSE = new Set();
  p.away.filter(a => a.pause).forEach(a => { for (let k = a.s; k <= a.e; k = dkey(addDays(D(k), 1))) PAUSE.add(k); });
  const logged = new Set([].concat(...Object.values(p.fokusLog).map(x => x.u || [])));
  const gone = new Set([...skip, ...logged]);
  let changed = false;
  let q = withoutUnits(orig(), gone);
  const drops = [], windows = {}, dbg = [];
  const weeks = [];
  q.forEach(d => { if (weeks.indexOf(wk(d)) < 0) weeks.push(wk(d)); });
  BUSY = true;
  try {
    for (const w of weeks.slice(0, 8)) {
      window.planQueue = () => q;
      const proj = projectPlan(70);
      // Fensterstart: erste erledigte Einheit dieser Planwoche, sonst ihr erster geplanter Tag
      let start = null;
      planDays().filter(d => wk(d) === w).forEach(d => d.items.forEach(i => {
        const c = S.checked[i.id];
        if (typeof c === "string") { const k = dkey(new Date(c)); if (!start || k < start) start = k; }
      }));
      if (!start) { const e = proj.find(x => x.kind === "train" && x.d && wk(x.d) === w); if (!e) break; start = e.k; }
      if (start < from) continue;                       // Altbestand: läuft wie bisher
      // 7 Tage ab Day 1; Pause-Tage (Urlaub) zählen nicht mit, das Fenster wird um sie länger
      let end = start;
      for (let n = PAUSE.has(start) ? 0 : 1; n < 7;) { end = dkey(addDays(D(end), 1)); if (!PAUSE.has(end)) n++; }
      windows[w] = { start, end };
      const trained = trainedDayKeys();
      let used = 0, slots = 0;
      for (let x = D(start); dkey(x) < t && dkey(x) <= end; x = addDays(x, 1)) if (trained.has(dkey(x))) used++;
      proj.forEach(e => {
        if (e.k < start || e.k > end) return;
        if (e.kind === "donetoday") used++;
        else if (e.kind === "train" || e.kind === "empty") slots++;
      });
      const cap = Math.max(0, Math.min(slots, TPW() - used));
      // Bedarf = Kalender-Einträge dieser Planwoche ab heute (AM+PM am selben Tag = 1, verschobenes PM = eigener Eintrag)
      const ents = proj.filter(e => e.kind === "train" && e.d && wk(e.d) === w);
      const busy = e => e.k === t && e.d.items.some(i => S.checked[i.id]);    // heute schon begonnen: bleibt
      let need = ents.length;
      dbg.push({ w, start, end, slots, used, cap, need, ents: ents.map(e => e.k + " " + e.d.key) });
      if (need <= cap) continue;
      const rankOf = e => Math.min.apply(null, partIdx(e).map(si => sessRank(e.d.day.sessions[si])));
      const cand = ents.filter(e => rankOf(e) > 1 && !busy(e) && !partIdx(e).some(si => back.has(uk(e.d, si))))
        .sort((a, b) => rankOf(b) - rankOf(a) || (b.k < a.k ? -1 : 1));
      while (need > cap && cand.length) {
        const e = cand.shift();
        partIdx(e).forEach(si => gone.add(uk(e.d, si)));
        drops.push({ d: e.d, sis: partIdx(e), r: rankOf(e), start, end, past: end < t });
        need--;
      }
      if (end < t) {                                    // Fenster vorbei: festschreiben
        const L = p.fokusLog[w] || (p.fokusLog[w] = { s: start, e: end, u: [] });
        drops.filter(x => x.past && wk(x.d) === w).forEach(x => x.sis.forEach(si => {
          const k = uk(x.d, si); if (L.u.indexOf(k) < 0) { L.u.push(k); changed = true; }
        }));
      }
      q = withoutUnits(orig(), gone);
    }
  } finally { window.planQueue = wrapped; BUSY = false; }
  const skipped = [];
  orig().forEach(d => realIdx(d).forEach(si => { if (skip.has(uk(d, si))) skipped.push({ d, si }); }));
  const inQ = new Set(q.map(d => d.key));                      // Plan-Tage, von denen noch etwas ansteht
  CACHE = { q, drops: drops.filter(x => !x.past), windows, skipped, dbg, inQ };
  if (changed) setTimeout(() => markDirty(), 0);       // fokusLog synchronisieren
  return CACHE;
}
function wrapped() { return BUSY ? orig() : compute().q.slice(); }
window.planQueue = wrapped;
/* Jede Änderung rendert neu → Berechnung verwerfen */
const r0 = window.render;
window.render = function () { CACHE = null; return r0.apply(this, arguments); };
const m0 = window.markDirty;
window.markDirty = function () { CACHE = null; return m0.apply(this, arguments); };

/* ---------- „Nur 30 min“ überall gleich rechnen (19.10.) ----------
   pvMinutes ist die Plan-Minute eines Items (Heute „≈ min“, Tagtyp und kcal im Essen, Laufwoche, Kalender).
   Steht eine Base-Einheit auf „Nur 30 min“, zählt ihr Lauf mit 30 min statt der Plan-Minuten. */
const pv0 = window.pvMinutes;
let RUNOF = null;                                              // Item-ID → Einheiten-Schlüssel (nur Läufe in Base-Einheiten)
window.pvMinutes = function (it) {
  const sh = (S.plan || {}).short;
  if (it && it.id && sh && Object.keys(sh).length) {
    if (!RUNOF) {
      RUNOF = {};
      planDays().forEach(d => d.day.sessions.forEach((s, si) => {
        if ((fk(s) || {}).s !== "B") return;
        sessReal(s).forEach(i => { if (/\b(run|jog)\b|lauf/i.test((i.sub || "") + " " + (i.title || "")) && !/warm.?up|cool.?down/i.test((i.sub || "") + (i.title || ""))) RUNOF[i.id] = uk(d, si); });
      }));
    }
    if (RUNOF[it.id] && sh[RUNOF[it.id]]) return Math.min(30, pv0(it));
  }
  return pv0(it);
};

/* ---------- Chips ---------- */
function chip(code, small) {
  return code ? `<span class="fkc fk${code}${small ? " sm" : ""}">${NAME[code]}</span>` : "";
}
/* Chips einer Einheit: Stufe, „30 min“, „+ Schwelle 2“ */
function chipsOf(d, si) {
  const s = d.day.sessions[si], f = fk(s);
  if (!f) return "";
  return chip(f.s, true)
    + (f.s === "B" && P().short[uk(d, si)] ? `<span class="fkc fkshort sm">30 min</span>` : "")
    + (s2On(s) ? `<span class="fkc fkS2 sm">+ Schwelle 2</span>` : "");
}
function chipSess(d, si) { return chipsOf(d, si); }
function chips(e) {
  if (!e || !e.d) return "";
  return `<span class="fkchips">${partIdx(e).map(si => chipsOf(e.d, si)).join("")}</span>`;
}
/* Untertitel einer Danach-Zeile: AM und PM als eigene Zeilen mit eigenen Chips, jede antippbar */
/* Weggelassene Hälfte eines Tages, dessen andere Hälfte noch ansteht: bleibt in der Zeile des Tages, durchgestrichen (19.10.) */
function skippedOf(d) { return compute().skipped.filter(x => x.d.key === d.key).map(x => x.si); }
function goneLine(d, si) {
  const o = origOf(d), f = fk(o.day.sessions[si]) || {};
  return `<div class="fkln gone"><b>${esc(slotOf(d, si))}</b> ${chip(f.s, true)}<s>${esc(pvRank(pvSession(o.day.sessions[si]), 2).join(" + "))}</s> · weggelassen</div>`;
}
function subHtml(e) {
  if (!e || !e.d) return "";
  const idx = partIdx(e), d = e.d, sk = skippedOf(d);
  if (idx.length < 2 && !sk.length) return chips(e) + esc(entSub(e));
  return idx.concat(sk).sort().map(si => sk.indexOf(si) >= 0 ? goneLine(d, si) : (() => {
    const txt = pvRank(pvSession(d.day.sessions[si]), 2).join(" + ");
    return `<div class="fkln" onclick="event.stopPropagation();location.hash='#d/${d.pi}/${d.wi}/${d.di}/${si}'"><b>${esc(slotOf(d, si))}</b> ${chipsOf(d, si)}${esc(txt)}</div>`;
  })()).join("");
}

/* ---------- „Fällt weg“ unter der Danach-Liste ---------- */
function unitLine(d, sis) {
  const lbl = sis.length === 1 && realIdx(d).length > 1 ? " · " + slotOf(d, sis[0]) : "";
  const txt = sis.map(si => pvRank(pvSession(d.day.sessions[si]), 2).join(" + ")).join(" · ");
  return { t: dayTitle(d) + lbl, s: txt, c: sis.map(si => chip((fk(d.day.sessions[si]) || {}).s, true)).join("") };
}
function dropped() {
  const c = compute();
  const skAlone = c.skipped.filter(x => !c.inQ.has(x.d.key));   // nur ganze Tage; halbe stehen in ihrer Zeile
  if (!c.drops.length && !skAlone.length) return "";
  const row = (x, btn) => `<div class="fkdrop"><div class="inf"><div class="t">${esc(x.t)} ${x.c}</div><div class="s">${esc(x.s)}</div></div>${btn}</div>`;
  let h = "";
  if (c.drops.length) {
    const w = c.drops[0];
    h += `<div class="fkh">Fällt weg · Planwoche ${esc(fmtDay(D(w.start)))}–${esc(fmtDay(D(w.end)))}</div>
      <div class="fks">Nicht alles passt in 7 Tage. Weg fällt zuerst Support, dann Base, dann Key nach Rang. Day 1 bleibt immer. Liegen AM und PM am selben Tag, fallen sie zusammen weg.</div>`
      + c.drops.map(x => row(unitLine(x.d, x.sis), `<button class="fkback" onclick="FOKUS.back('${x.sis.map(si => uk(x.d, si)).join(",")}')">zurückholen</button>`)).join("");
  }
  if (skAlone.length) {
    h += `<div class="fkh"${c.drops.length ? ' style="margin-top:12px"' : ""}>Von dir weggelassen</div>`
      + skAlone.map(x => row(unitLine(x.d, [x.si]), `<button class="fkback" onclick="FOKUS.unskip('${uk(x.d, x.si)}')">zurückholen</button>`)).join("");
  }
  return `<div class="fkbox">${h}</div>`;
}
function back(keys) {
  const p = P();
  String(keys).split(",").forEach(k => { if (p.fokusBack.indexOf(k) < 0) p.fokusBack.push(k); });
  markDirty(); render();
}
function unskip(k) {
  const p = P(), i = p.fokusSkip.indexOf(k);
  if (i >= 0) p.fokusSkip.splice(i, 1);
  markDirty(); render();
}

/* ---------- Sheet (⋯): je Einheit kürzen, weglassen oder Hinweis ---------- */
/* Was bleibt, was fällt weg? Reihenfolge: Support → Base → Key nach Rang, Day 1 nie */
function keepTxt(s) {
  const f = fk(s) || {}, r = sessRank(s);
  if (r <= 1) return "Bleibt immer.";
  if (f.s === "S") return "Fällt nur weg, wenn in der Planwoche weder Support noch Base übrig ist.";
  if (f.s === "B") return "Fällt nach Support weg. Vorher lieber „Nur 30 min“.";
  return "Fällt als Erstes weg, wenn die Planwoche nicht in 7 Tage passt.";
}
function why(e) {
  if (!e || !e.d) return "";
  return partIdx(e).map(si => {
    const f = fk(e.d.day.sessions[si]);
    const sl = slotOf(e.d, si);
    return f ? `<p class="fkwhy">${sl ? `<b>${esc(sl)}</b> ` : ""}${chip(f.s)} ${esc(f.w || "")}<br><i>${keepTxt(e.d.day.sessions[si])}</i></p>` : "";
  }).join("");
}
/* Tages-Sheet als Entwurf (19.10.): oben der Tag (Ganzer Tag · Nur AM · Nur PM · Gar nicht), darunter die Einheiten mit
   Umschalter (Base: Voll · 30 min · Weg, Support: Machen · Weg, Key ohne). Jede Wahl zeigt erst eine Vorschau bei den
   Einheiten (durchgestrichen, „→ nächster Tag“, AM/PM getauscht); umgesetzt wird erst mit „Speichern“.
   „Nur AM / Nur PM“: die wichtigere Einheit (Rang) im gewählten Slot; die andere fällt als Base/Support weg (fokusSkip)
   oder rutscht als Key auf den nächsten Tag (later). Beide Key: AM heute, PM morgen. */
let DR = null;                                                  // Entwurf { e, k, d, U, m, u: { uid: "full" | "short" | "skip" } }
function dmOf(e) {                                              // gilt eine gespeicherte Tages-Wahl für diesen Eintrag?
  const dm = e && e.d ? P().dayMode[e.d.key] : null;
  return dm && (dm.how === "skip" || dm.k === e.k) ? dm : null;
}
const oSlot = (d, si) => { const o = origOf(d); return (realIdx(o).length > 1 ? pvSlots(o.day.sessions)[si] : null) || ""; };
function dayPlan(d, U, m) {
  if ((m !== "am" && m !== "pm") || U.length !== 2) return null;
  const o = origOf(d), s0 = o.day.sessions[U[0]], s1 = o.day.sessions[U[1]];
  const both = (fk(s0) || {}).s === "S" && (fk(s1) || {}).s === "S";
  const keep = both ? U[0] : sessRank(s0) <= sessRank(s1) ? U[0] : U[1], other = keep === U[0] ? U[1] : U[0];
  const nm = si => `${pvRank(pvSession(o.day.sessions[si]), 2).join(" + ")} (${NAME[(fk(o.day.sessions[si]) || {}).s] || ""})`;
  const kept = pvRank(pvSession(o.day.sessions[keep]), 2).join(" + ");
  return both ? { keep, other, how: "later", txt: `Nur ${m.toUpperCase()}: ${kept}. ${nm(other)} rutscht auf den nächsten Tag.` }
              : { keep, other, how: "skip", txt: `Nur ${m.toUpperCase()}: ${kept}. ${nm(other)} fällt weg.` };
}
function draftBlock(e) {
  if (!e || !e.d) return "";
  const p = P(), d = e.d, dm = dmOf(e);
  const U = [...new Set(partIdx(e).concat(skippedOf(d), dm ? [+dm.other.split("/")[1]] : []))].sort();
  const u = {};
  U.forEach(si => { const id = uk(d, si); u[id] = dm && dm.other === id ? "full" : p.fokusSkip.indexOf(id) >= 0 ? "skip" : p.short[id] ? "short" : "full"; });
  DR = { e, k: e.k, d, U, m: dm ? dm.m : "full", u, u0: JSON.stringify(u), m0: dm ? dm.m : "full" };
  return `<div id="fkdraft">${draftHtml()}</div>`;
}
function draftHtml() {
  const { d, U, m, u } = DR, o = origOf(d), plan = dayPlan(d, U, m), two = U.length === 2;
  const b = (lbl, x) => `<button class="${m === x ? "on" : ""}" onclick="FOKUS.dd('${x}')">${lbl}</button>`;
  let h = `<div class="fkday">${b("Ganzer Tag", "full")}${two ? b("Nur AM", "am") + b("Nur PM", "pm") : ""}${b("Gar nicht", "off")}</div>`;
  const note = m === "off" ? "Der Tag fällt aus. Passt die Planwoche nicht mehr in 7 Tage, fällt zuerst Support weg." : plan ? plan.txt : "";
  if (note) h += `<p class="fkdayh">${esc(note)}</p>`;
  const rows = U.map(si => {
    const s = o.day.sessions[si], f = fk(s) || {}, id = uk(d, si);
    let sl = oSlot(d, si), gone = false, tag = "", seg = "";
    if (m === "off") { gone = true; tag = "fällt aus"; }
    else if (plan && si === plan.other) { if (plan.how === "skip") { gone = true; tag = "fällt weg"; sl = ""; } else tag = "→ nächster Tag"; }
    else {
      if (plan && si === plan.keep) sl = m.toUpperCase();
      const st = u[id], bb = (lbl, x) => `<button class="${st === x ? "on" : ""}" onclick="FOKUS.du('${id}','${x}')">${lbl}</button>`;
      seg = f.s === "B" ? bb("Voll", "full") + bb("30 min", "short") + bb("Weg", "skip") : f.s === "E" ? bb("Machen", "full") + bb("Weg", "skip") : "";
      if (st === "skip") gone = true;
    }
    return `<div class="fku${gone ? " gone" : ""}${tag && !gone ? " moved" : ""}">${sl ? `<b>${esc(sl)}</b>` : two ? "<b></b>" : ""}${chip(f.s, true)}<span class="t">${esc(pvRank(pvSession(s), 2).join(" + "))}${s2On(s) ? " + Schwelle 2" : ""}${tag ? ` <i>${tag}</i>` : ""}</span>${seg ? `<span class="fkseg">${seg}</span>` : ""}</div>`;
  }).join("");
  const dirty = m !== DR.m0 || JSON.stringify(u) !== DR.u0;
  h += `<div class="fkus">${rows}<details class="fkwhyd"><summary>Warum so eingeordnet?</summary>${why(DR.e)}</details></div>`;
  h += `<button class="fksave${dirty ? "" : " off"}" onclick="FOKUS.saveDraft()">${dirty ? "Speichern" : "Nichts geändert"}</button>`;
  return h;
}
function redraw() { const el = document.getElementById("fkdraft"); if (el && DR) el.innerHTML = draftHtml(); }
function dd(m) { DR.m = m; redraw(); }
function du(id, x) { DR.u[id] = x; redraw(); }
function saveDraft() {
  if (!DR) return;
  const p = P(), { e, k, d, U, m, u } = DR;
  if (m === DR.m0 && JSON.stringify(u) === DR.u0) { closeSheet(); return; }
  const dm = dmOf(e);
  if (dm) {                                                     // gespeicherte Tages-Wahl zurücknehmen
    if (dm.how === "later") { const i = p.later.indexOf(dm.k); if (i >= 0) p.later.splice(i, 1); }
    if (dm.how === "skip") { const i = p.fokusSkip.indexOf(dm.other); if (i >= 0) p.fokusSkip.splice(i, 1); }
    delete p.dayMode[d.key];
  }
  Object.keys(u).forEach(id => {                                // je Einheit
    const i = p.fokusSkip.indexOf(id);
    if (u[id] === "skip") { if (i < 0) p.fokusSkip.push(id); const j = p.fokusBack.indexOf(id); if (j >= 0) p.fokusBack.splice(j, 1); }
    else { if (i >= 0) p.fokusSkip.splice(i, 1); if (u[id] === "short") p.short[id] = 1; else delete p.short[id]; }
  });
  const plan = dayPlan(d, U, m);
  if (plan) {
    const oid = uk(d, plan.other);
    if (plan.how === "later") { if (p.later.indexOf(k) < 0) { p.later.push(k); p.later.sort(); } }
    else if (p.fokusSkip.indexOf(oid) < 0) p.fokusSkip.push(oid);
    p.dayMode[d.key] = { m, k, keep: uk(d, plan.keep), other: oid, how: plan.how, txt: plan.txt };
  }
  DR = null; CACHE = null;
  if (m === "off") { planOffToggle(k); return; }               // „Gar nicht“ = Geht nicht (schließt und rendert selbst)
  closeSheet(); markDirty(); render();
}

/* ---------- Tagesansicht: Kopf jeder Einheit ---------- */
function sessHead(pi, wi, di, si) {
  const d = planDays().find(x => x.pi === pi && x.wi === wi && x.di === di);
  if (!d) return "";
  const s = d.day.sessions[si], f = fk(s);
  if (!f || !sessReal(s).length) return "";
  const k = uk(d, si), on = f.s === "B" && !!P().short[k], sk = P().fokusSkip.indexOf(k) >= 0;
  const runIt = sessReal(s).find(i => /\brun\b|jog|lauf/i.test(i.sub || ""));
  const planMin = runIt ? (String(runIt.sub || "").match(/(\d+)(?:\s*-\s*\d+)?\s*min/i) || [])[1] : null;
  return `<div class="fkhead">${chipsOf(d, si)}<span class="fkhw"></span>
    ${f.s === "B" ? `<button class="fkmini" onclick="FOKUS.shortHere('${k}')">${on ? "wieder voll" : "Nur 30 min"}</button>` : ""}</div>
    ${on ? `<div class="fknote">Heute nur <b>30 min</b>${planMin ? ` statt ${esc(planMin)} min` : ""} · locker, HF unter 142. Zählt weiter für die Woche.</div>` : ""}
    ${sk ? `<div class="fknote">Diese Einheit hast du weggelassen. <a onclick="FOKUS.unskip('${k}')">zurückholen</a></div>` : ""}`;
}
function shortHere(k) {
  const p = P();
  if (p.short[k]) delete p.short[k]; else p.short[k] = 1;
  markDirty(); render();
}

/* ---------- Abwesenheit (19.10.): Zeitraum statt einzelner „Geht nicht“-Tage ---------- */
/* Rückkehr aus einer Pause: letzter Day 1 7+ Tage her → angefangene Woche ab Day 1 neu (Häkchen weg, Werte bleiben im Verlauf) */
function lastDay1() {
  let best = null;
  planDays().forEach(d => { if (d.di !== 0) return; d.items.forEach(i => { const c = S.checked[i.id]; if (typeof c === "string") { const k = dkey(new Date(c)); if (!best || k > best) best = k; } }); });
  return best;
}
function backFromAway(p, t) {
  let did = false;
  p.away.forEach(a => {
    if (!a.pause || a.rs || a.e >= t) return;
    const ret = dkey(addDays(D(a.e), 1)), l1 = lastDay1();
    a.rs = 1; did = true;
    const head = orig()[0];
    if (!l1 || !head || head.di === 0 || Math.round((D(ret) - D(l1)) / 864e5) < 7) return;
    const week = planDays().filter(d => d.pi === head.pi && d.wi === head.wi), ids = week.flatMap(d => d.items.map(i => i.id));
    const mine = k => ids.some(id => k === id || k.indexOf(id + "/") === 0);
    Object.keys(S.checked).forEach(k => { if (mine(k)) delete S.checked[k]; });
    Object.keys(S.resultsByItem).forEach(k => { if (mine(k)) delete S.resultsByItem[k]; });
    Object.values(S.results).forEach(arr => arr.forEach(e => { if (mine(e.itemId) && (e.run || 1) === (S.run || 1) && !e.rep) e.rep = 1; }));
    if (typeof logEv === "function") logEv("reset", ids[0], { week: head.pi + "." + head.wi, why: "nach " + a.n });
    a.rs = "reset";
  });
  return did;
}
/* Was passiert bei n Tagen? (für das Sheet und die Liste) */
const awayRule = n => n >= 4
  ? "Pause: Die Tage zählen nicht zur 7-Tage-Woche, nichts fällt weg. Liegt dein letzter Day 1 bei der Rückkehr 7+ Tage zurück, startet die angefangene Woche neu ab Day 1."
  : "Kürzen: Die Woche bleibt bei 7 Tagen, zuerst fällt Support weg, dann Base. Key bleibt.";
const awayAt = k => P().away.find(a => a.s <= k && k <= a.e) || null;
const daysOf = (s, e) => { const out = []; for (let k = s; k <= e; k = dkey(addDays(D(k), 1))) out.push(k); return out; };
function saveAway(s, e, n) {
  const p = P();
  if (e < s) { const x = s; s = e; e = x; }
  const pause = daysOf(s, e).length >= 4;                       // Art automatisch nach Länge (Marc 19.10.)
  p.away = p.away.filter(a => a.e < s || a.s > e);             // überlappende Zeiträume ersetzen
  p.away.push({ id: "a" + Date.now().toString(36), s, e, n: n || "Urlaub", pause: !!pause });
  p.away.sort((a, b) => (a.s < b.s ? -1 : 1));
  daysOf(s, e).forEach(k => {
    if (p.off.indexOf(k) < 0) p.off.push(k);
    const j = p.force.indexOf(k); if (j >= 0) p.force.splice(j, 1);
  });
  p.off.sort();
  closeSheet(); markDirty(); render();
}
function delAway(id) {
  const p = P(), a = p.away.find(x => x.id === id);
  if (!a) return;
  p.away = p.away.filter(x => x !== a);
  daysOf(a.s, a.e).forEach(k => { if (!(p.other || {})[k] && !awayAt(k)) { const i = p.off.indexOf(k); if (i >= 0) p.off.splice(i, 1); } });
  closeSheet(); markDirty(); render();
}
function awayList() {
  const t = T(), list = P().away.filter(a => a.e >= t);
  const fmt = a => a.s === a.e ? fmtDay(D(a.s)) : `${fmtDay(D(a.s))} – ${fmtDay(D(a.e))}`;
  return `<div class="fkaway">
    <div class="trsw"><span>Abwesend</span></div>
    ${list.map(a => `<div class="fkawr"><div><b>${esc(a.n)}</b> · ${esc(fmt(a))}<br><span>${a.pause ? "Pause, der Plan wartet" : "gekürzt, Woche bleibt 7 Tage"}${a.rs === "reset" ? " · Woche danach neu ab Day 1" : ""}</span></div>
      <button class="fkback" onclick="FOKUS.delAway('${a.id}')">entfernen</button></div>`).join("") || `<p class="hint">Nichts eingetragen.</p>`}
    <div class="fkawn"><input type="date" id="fkAs" value="${t}"><span>bis</span><input type="date" id="fkAe" value="${t}">
      <button class="fkback" onclick="KAL.rangeSheet(document.getElementById('fkAs').value, document.getElementById('fkAe').value)">＋ eintragen</button></div>
    <p class="hint">Oder im Kalender oben auf „＋ Abwesend“, dann ersten und letzten Tag antippen.</p>
  </div>`;
}

/* ---------- Einstellung: Trainingstage pro Woche ---------- */
function settings() {
  const n = TPW();
  return `<details class="setsec">
    <summary><svg class="secic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>Trainingswoche</summary>
    <div class="secbody">
      <p class="hint">Eine Planwoche hat 7 Tage. Passt nicht alles hinein, fällt zuerst Support weg, dann Base, dann Key nach Rang. Day 1 bleibt immer und kommt spätestens alle 7 Tage. AM und PM zählen als eigene Einheiten.</p>
      <div class="trsw"><span>Trainingstage pro Woche</span><div class="fkstep">
        <button onclick="FOKUS.tpw(-1)" aria-label="weniger">−</button><b>${n}</b><button onclick="FOKUS.tpw(1)" aria-label="mehr">＋</button></div></div>
      <p class="hint">6 = dein Maximum, damit passt Hunters Woche ganz. Einzelne Tage ohne Zeit markierst du wie bisher mit „Geht nicht“, einzelne Base- oder Support-Einheiten (z. B. nur das AM) über ⋯ → weglassen.</p>
      <div class="fklg">${chip("S")} Day 1, Banktag, Kreuzhebetag, Long Run, Qualitätsläufe · ${chip("B")} lockere Läufe, 10k Row/Ski · ${chip("E")} Metcons, Rad, einzelne Hyrox-Einheiten</div>
      ${awayList()}
    </div>
  </details>`;
}
function tpw(dlt) {
  const p = P();
  p.tpw = Math.max(3, Math.min(7, TPW() + dlt));
  markDirty(); render();
}

/* ---------- Wochenkarte (in der Laufwoche-Karte) ---------- */
function weekBlock() {
  const t = T(), now = D(t);
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = []; for (let i = 0; i < 7; i++) days.push(dkey(addDays(mon, i)));
  const inWk = iso => { if (typeof iso !== "string") return false; const k = dkey(new Date(iso)); return k >= days[0] && k <= days[6]; };
  const rd = WOCHE.runDays ? WOCHE.runDays() : {};
  const min = days.reduce((a, k) => a + ((rd[k] || {}).min || 0), 0);
  const lifts = { squat: 0, bench: 0, deadlift: 0 };
  let qual = 0, longrun = false;
  const qualKeys = { "tempo-8min": 1, "threshold-5min": 1, "road-test-30min": 1, "mile-tt": 1, "intervals-1000m": 1 };
  Object.keys(ITEM_INDEX).forEach(id => {
    const it = ITEM_INDEX[id];
    if (!inWk(S.checked[id])) return;
    (it.exercises || []).forEach(e => {
      if (e.rm === "squat" || e.rm === "backsquat") lifts.squat = 1;
      if (e.rm === "bench") lifts.bench = 1;
      if (e.rm === "deadlift") lifts.deadlift = 1;
    });
    if (qualKeys[it.key] || it.opt === "schwelle2") qual++;
    const lm = (it.sub || "").match(/(\d{2,3})(?:\s*-\s*\d+)?\s*minute/);
    if (it.key === "long-run" || (it.key === "endurance-run" && lm && +lm[1] >= 80)) longrun = true;
  });
  (S.xruns || []).forEach(x => {
    if (x.d < days[0] || x.d > days[6]) return;
    if (x.kind === "hart" || x.kind === "wettkampf") qual++;
    if ((x.t || 0) >= 75) longrun = true;
  });
  const goal = 240, minGoal = 180, pct = Math.min(1, min / goal);
  const ring = `<svg class="fkring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" class="bg"/>
    <circle cx="22" cy="22" r="18" class="fg${min >= minGoal ? " ok" : ""}" stroke-dasharray="${Math.round(113 * pct)} 113" transform="rotate(-90 22 22)"/></svg>`;
  const hm = m => Math.floor(m / 60) + ":" + String(Math.round(m % 60)).padStart(2, "0");
  const c = compute(), nDrop = c.drops.filter(x => x.start <= t && t <= x.end).length;   // nur die laufende Planwoche
  const item = (lbl, ok, txt) => `<span class="${ok ? "ok" : ""}">${ok ? "✓" : "○"} ${lbl}${txt ? " " + txt : ""}</span>`;
  return `<div class="fkweek">
    <div class="fkmin">${ring}<div><b>${hm(min)} h</b> gelaufen<br><span>Minimum 3 h · Ziel 4 h</span></div></div>
    <div class="fklist">
      ${item("Schwellen", qual >= 2, Math.min(qual, 2) + "/2")}${item("Long Run", longrun)}
      ${item("Kniebeuge", lifts.squat)}${item("Bank", lifts.bench)}${item("Kreuzheben", lifts.deadlift)}
      ${nDrop ? `<span class="drop">${nDrop} fällt weg</span>` : ""}
    </div>
  </div>`;
}

window.FOKUS = { chips, chipSess, subHtml, dropped, back, unskip, draftBlock, dd, du, saveDraft, why, sessHead, shortHere,
  settings, tpw, weekBlock, compute, NAME, keepTxt, awayAt, saveAway, delAway, skippedOf, origOf, slotOf, awayRule };
})();
