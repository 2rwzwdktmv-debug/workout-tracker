/* Wettkämpfe (mehrere) · Taper für Läufe
   Daten:
     S.races = [ { id, art: "hyrox" | "lauf", name, date, time, ort, km, taper?, no? } ]
     S.race  = { name, date }   ← bleibt die Quelle für den Rennblock (rennen.js) und wird hier
                                   automatisch auf den nächsten HYROX-Wettkampf gesetzt
     Taper legt Einträge in S.plan.other / S.plan.off an (der Plan rutscht wie bei „Geht nicht“):
       Taper-Tage  { n: "Taper", lv: "locker", tp: { id, s } }    s = Tage bis zum Rennen (3, 2, 1)
       Renntag     { n: "Wettkampf", lv: "hart", race: id }        zählt als harte Laufeinheit
   Regeln (mit Marc am 15.10.2026 abgestimmt):
     Taper-Frage: bis 10 km 3 Tage, Halbmarathon 6, Marathon 10 Tage vorher.
     Inhalt bisher nur bis 10 km: T−3 30 min locker + 4 Steigerungen · T−2 Ruhe oder 20 min locker ·
     T−1 Ruhe oder 15 min + 3 Steigerungen. Halbmarathon und länger: Regeln legen wir noch fest.
     Ernährung: T−1 Tagtyp „Trainingstag“ (Kohlenhydrate), Renntag „Trainingstag“; Badge „Taper-Ernährung“;
     Vorabend helle Nudeln/Reis, wenig Rohkost; Renntag Essenszeiten nach der Startzeit.          */
(function () {
const T = () => dkey(today0());
const D = k => new Date(k + "T12:00:00");
const between = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const add = (k, n) => dkey(addDays(D(k), n));
const P = () => { const p = planState(); if (!p.other || typeof p.other !== "object") p.other = {}; return p; };
const num = s => { const v = parseFloat(String(s || "").trim().replace(",", ".")); return isFinite(v) ? v : null; };
const dec = v => String(v).replace(".", ",");

/* Liste mit Übernahme des alten Einzel-Wettkampfs */
function races() {
  if (!Array.isArray(S.races)) S.races = [];
  // Alter Einzel-Wettkampf (S.race) wird übernommen, auch wenn die Liste schon existiert (selbstheilend)
  if (S.race && S.race.date && !S.races.some(r => r.art === "hyrox" && r.date === S.race.date))
    S.races.push({ id: "r" + Date.now().toString(36), art: "hyrox", name: S.race.name || "HYROX", date: S.race.date });
  return S.races;
}
/* Rennblock liest S.race: nächster HYROX ab heute, sonst der zuletzt vergangene */
function syncRace() {
  const hy = races().filter(r => r.art === "hyrox" && r.date).sort((a, b) => a.date < b.date ? -1 : 1);
  const r = hy.find(x => x.date >= T()) || hy[hy.length - 1];
  S.race = r ? { name: r.name || "HYROX", date: r.date } : null;
}
const lead = r => !r.km ? 3 : r.km <= 10 ? 3 : r.km <= 21.2 ? 6 : 10;
const canTaper = r => r.art === "lauf" && r.km && r.km <= 10;          // längere: Regeln folgen
const raceOf = id => races().find(r => r.id === id);
const hhmm = (t, min) => { const m = /^(\d{1,2}):?(\d{2})$/.exec(t || ""); if (!m) return null; let v = +m[1] * 60 + +m[2] - min; return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); };

/* ---------- Karte über „Heute“: Taper starten? ---------- */
function due() {
  const t = T();
  return races().filter(r => canTaper(r) && r.date > t && between(t, r.date) <= lead(r) && !r.taper && r.no !== r.date)
    .sort((a, b) => a.date < b.date ? -1 : 1)[0];
}
function card() {
  const r = due();
  if (!r) return "";
  const n = between(T(), r.date);
  return `<div class="today nw">
    <div class="k">In ${n === 1 ? "1 Tag" : n + " Tagen"}: ${esc(r.name || "Lauf")}</div>
    <div class="v">${dec(r.km)} km · ${WD[D(r.date).getDay()]} ${esc(fmtDay(D(r.date)))}${r.time ? " · " + esc(r.time) + " Uhr" : ""}</div>
    <div class="s">Taper starten? Die Plan-Einheiten bis zum Rennen rutschen dahinter, dafür kommen lockere Läufe und Taper-Ernährung.${r.ort ? "\n" + esc(r.ort) : ""}</div>
    <button class="cta" onclick="WK.start('${r.id}')">Taper starten</button>
    <button class="cta ghost" onclick="WK.no('${r.id}')">Normal weiter</button>
  </div>`;
}
function start(id) {
  const r = raceOf(id), p = P();
  if (!r) return;
  const from = Math.min(lead(r), Math.max(1, between(T(), r.date)));
  for (let s = from; s >= 1; s--) {
    const k = add(r.date, -s);
    if (k < T()) continue;
    p.other[k] = { n: "Taper", lv: "locker", tp: { id, s } };
    if (p.off.indexOf(k) < 0) p.off.push(k);
  }
  p.other[r.date] = { n: "Wettkampf", lv: "hart", race: id };
  if (p.off.indexOf(r.date) < 0) p.off.push(r.date);
  p.off.sort();
  r.taper = T();
  markDirty(); render();
}
function stop(id) {
  const r = raceOf(id), p = P();
  if (!r) return;
  Object.keys(p.other).forEach(k => {
    const o = p.other[k];
    if ((o.tp && o.tp.id === id) || o.race === id) { delete p.other[k]; const i = p.off.indexOf(k); if (i >= 0) p.off.splice(i, 1); }
  });
  delete r.taper;
  markDirty(); render();
}
function no(id) { const r = raceOf(id); if (r) { r.no = r.date; markDirty(); render(); } }

/* ---------- Anzeige der Taper-Tage (über die Hooks aus woche.js) ---------- */
const TXT = {
  3: ["Taper · 30 min locker", "30 min locker (HF < 142) + 4 × 15–20 s Steigerungen"],
  2: ["Taper · Ruhe", "Ruhetag oder 20 min ganz locker"],
  1: ["Taper · Ruhe", "Ruhetag oder 15 min locker + 3 Steigerungen"],
};
function info(k) {
  const o = (P().other || {})[k];
  if (!o) return null;
  if (o.tp) {
    const r = raceOf(o.tp.id), [n, d] = TXT[o.tp.s] || TXT[1];
    const food = o.tp.s === 1 ? " · Abends helle Nudeln oder Reis statt Vollkorn, wenig Rohkost, bis 20 Uhr essen." : "";
    return { n, d: `${d}${r ? ` · noch ${o.tp.s === 1 ? "1 Tag" : o.tp.s + " Tage"} bis ${esc(r.name || "Rennen")}` : ""}${food}` };
  }
  if (o.race) {
    const r = raceOf(o.race);
    if (!r) return null;
    const t = r.time;
    const plan = t ? ` · Hauptmahlzeit bis ${hhmm(t, 180)} · Snack ${hhmm(t, 60)}–${hhmm(t, 45)} · Einlaufen ab ${hhmm(t, 30)}` : "";
    return { n: `${r.name || "Wettkampf"}${r.km ? " · " + dec(r.km) + " km" : ""}`, d: `${t ? "Start " + esc(t) + " Uhr" : "Renntag"}${r.ort ? " · " + esc(r.ort) : ""}${plan}` };
  }
  return null;
}
const TAPER_ON = k => { const o = (P().other || {})[k]; return !!(o && (o.tp || (o.race && raceOf(o.race) && raceOf(o.race).art === "lauf"))); };
function badge(k) { return TAPER_ON(k) ? ` <span class="tpb" onclick="event.stopPropagation();WK.explain('${k}')">Taper-Ernährung ⓘ</span>` : ""; }
/* Ziele je Tagtyp aus nutrition.json (EN.load wird beim Start aufgerufen, hier mitgelesen) */
let TGT = null;
if (window.EN && EN.load) { const l0 = EN.load; EN.load = j => { try { TGT = j && j.targets; } catch (e) {} return l0(j); }; }
const de = n => Math.round(n).toLocaleString("de-DE");
function explain(k) {
  const o = (P().other || {})[k], ty = type(k), base = TGT && TGT.rest, now = TGT && TGT[ty];
  if (!o || !now || !base) return;
  const row = (l, a, b, u) => { const d = b - a, pc = a ? Math.round(d / a * 100) : 0;
    return `<div class="tpr"><span>${l}</span><span>${de(a)} → <b>${de(b)}</b> ${u}</span><span class="${d > 0 ? "up" : ""}">${d ? (d > 0 ? "+" : "−") + de(Math.abs(d)) + " " + u + " · " + (d > 0 ? "+" : "−") + Math.abs(pc) + " %" : "gleich"}</span></div>`; };
  const r = o.tp ? raceOf(o.tp.id) : raceOf(o.race), s = o.tp ? o.tp.s : 0;
  /* Renntag (17.10.): Ablauf nach der Startzeit, oben im Sheet. Gilt für jeden Lauf, Zeiten rechnet die App aus „Start“. */
  const t = r && r.time, short = r && r.km && r.km <= 10;
  const plan = o.race ? [
    ["morgens", "Frühstück wie gewohnt, nichts Neues ausprobieren"],
    [t ? "bis " + hhmm(t, 180) : "3 h vorher", "Hauptmahlzeit, am besten Porridge (Mittag → Tauschen): 100 g Hafer mit Wasser, Shake, 1 Banane, 1 EL Honig, Zimt, ohne Beeren. Viel Kohlenhydrate, wenig Fett und Ballaststoffe. Die App zeigt mehr Hafer, einfach trotzdem abhaken."],
    [t ? "bis " + hhmm(t, 120) : "2 h vorher", "0,5 l Wasser trinken, danach nur noch schluckweise, letzte Schlucke 20 min vor dem Start"],
    [t ? hhmm(t, 60) + "–" + hhmm(t, 45) : "45–60 min vorher", "Nur bei Hunger: ½ Banane oder 1 Reiswaffel mit Honig"],
    [t ? "ab " + hhmm(t, 30) : "30 min vorher", "Einlaufen: 10–15 min locker, dazu 3–4 Steigerungen"],
    ...(short ? [["im Rennen", "Nichts nötig, kein Gel: Das Rennen ist kürzer als 60 min"]] : []),
    ["danach", "Shake und Banane (Nachmittag), abends normal essen, gut trinken"]] : null;
  const what = o.race ? []
    : s === 1 ? ["Abends helle Nudeln oder Reis statt Vollkorn", "Gemüse halbe Menge, wenig Rohkost", "Spätestens um 20 Uhr essen, nichts Neues ausprobieren", "Kein Alkohol, über den Tag gut trinken"]
    : ["Normal essen, nur etwas mehr Kohlenhydrate, damit die Speicher bis zum Rennen voll sind"];
  closeSheet();
  const wrap = document.createElement("div");
  wrap.className = "sheetwrap";
  wrap.onclick = ev => { if (ev.target === wrap) closeSheet(); };
  wrap.innerHTML = `<div class="sheet tpsheet">
    <h4>Taper-Ernährung · ${WD[D(k).getDay()]} ${esc(fmtDay(D(k)))}</h4>
    ${plan ? `<p><b>Ablauf heute</b>${r ? " · " + esc(r.name || "Rennen") + (t ? ", Start " + esc(t) + " Uhr" : "") : ""}</p><div class="tpplan">${plan.map(([a, b]) => `<div class="tpt"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join("")}</div>` : ""}
    <p>${o.race ? "Renntag" : s === 1 ? "Tag vor dem Rennen" : "Taper-Tag"}${r ? " · " + esc(r.name || "Rennen") : ""}: <b>${esc(now.l)}</b> statt Ruhetag, obwohl kein Plan-Training ansteht.</p>
    ${row("Kalorien", base.kcal, now.kcal, "kcal")}${row("Kohlenhydrate", base.c, now.c, "g")}${row("Protein", base.p, now.p, "g")}${row("Fett", base.f, now.f, "g")}
    ${what.length ? `<div class="tpw">${what.map(x => `<div>· ${esc(x)}</div>`).join("")}</div>` : ""}
    <p class="tpn">Warum: Weniger Training und etwas mehr Kohlenhydrate füllen die Speicher bis zum Start. Für Läufe bis 10 km reicht das, richtiges Carb-Loading lohnt sich erst ab dem Halbmarathon. Die Portionen (Reis, Nudeln, Kartoffeln) passt die App über den Tagtyp selbst an.</p>
    <button class="cta ghost" onclick="closeSheet();location.hash='#settings'">Wettkampf bearbeiten ›</button>
    <button class="cancel" onclick="closeSheet()">Schließen</button>
  </div>`;
  document.body.appendChild(wrap);
}
/* Ernährung: Vortag und Renntag mit Kohlenhydraten wie an einem Trainingstag */
function type(k) {
  const o = (P().other || {})[k];
  if (!o) return null;
  if (o.tp) return o.tp.s === 1 ? "train" : "active";
  if (o.race) return "train";
  return null;
}

/* ---------- Einstellungen → Wettkampf: mehrere, mit Art, Distanz, Ort, Datum, Start ---------- */
function settings() {
  const list = races().slice().sort((a, b) => (a.date || "9") < (b.date || "9") ? -1 : 1);
  const rows = list.map(r => {
    const id = r.id, on = (f, v) => `onchange="WK.set('${id}','${f}',${v})"`;
    const hint = r.art === "hyrox"
      ? (window.RENNEN && RENNEN.active() && S.race && S.race.date === r.date ? "Rennblock läuft." : `Rennblock-Frage etwa ${window.RENNEN ? RENNEN.leadDays() : "–"} Tage vorher.`)
      : canTaper(r) ? (r.taper ? `Taper läuft · <a onclick="WK.stop('${id}')">beenden</a>` : "Taper-Frage 3 Tage vorher.")
      : r.km ? "Taper-Regeln für längere Läufe legen wir noch fest." : "Distanz eintragen, dann fragt die App rechtzeitig nach dem Taper.";
    const sum = `${esc(r.name || (r.art === "hyrox" ? "HYROX" : "Lauf"))}<small>${r.art === "hyrox" ? "HYROX" : "Lauf" + (r.km ? " · " + dec(r.km) + " km" : "")}${r.date ? " · " + WD[D(r.date).getDay()] + " " + esc(fmtDay(D(r.date))) : ""}${r.time ? " · " + esc(r.time) : ""}${r.ort ? " · " + esc(r.ort) : ""}</small>`;
    return `<details class="wkr" ${OPEN.has(id) || !r.date ? "open" : ""} ontoggle="WK.tog('${id}', this.open)">
      <summary>${sum}</summary>
      <div class="wkart">${["hyrox", "lauf"].map(a => `<button class="${r.art === a ? "on" : ""}" onclick="WK.set('${id}','art','${a}');render()">${a === "hyrox" ? "HYROX" : "Lauf"}</button>`).join("")}
        <button class="wkdel" onclick="if(confirm('Wettkampf löschen?'))WK.del('${id}')">Löschen</button></div>
      <div class="rmgrid">
        <div class="rmcell"><span>Name</span><input type="text" value="${esc(r.name || "")}" placeholder="${r.art === "hyrox" ? "HYROX Frankfurt" : "Crosslauf"}" ${on("name", "this.value")}></div>
        <div class="rmcell"><span>Ort</span><input type="text" value="${esc(r.ort || "")}" placeholder="Frankfurt" ${on("ort", "this.value")}></div>
        <div class="rmcell"><span>Datum</span><input type="date" value="${esc(r.date || "")}" ${on("date", "this.value")}></div>
        <div class="rmcell"><span>Start</span><input type="time" value="${esc(r.time || "")}" ${on("time", "this.value")}></div>
        ${r.art === "lauf" ? `<div class="rmcell"><span>Distanz (km)</span><input inputmode="decimal" value="${r.km ? dec(r.km) : ""}" placeholder="21,1" ${on("km", "this.value")}></div>` : ""}
      </div>
      <p class="hint">${hint}</p>
      <button class="wkbtn" onclick="WK.done('${id}')">Fertig</button>
    </details>`;
  }).join("");
  return `<details class="setsec">
    <summary><svg class="secic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>Wettkampf</summary>
    <div class="secbody">
      <p class="hint">HYROX startet rechtzeitig den Rennblock (Part 4). Läufe bis 10 km bekommen 3 Tage vorher einen Taper mit Taper-Ernährung.</p>
      ${rows || ""}
      <button class="wkbtn" onclick="WK.add()">＋ Wettkampf</button>
    </div>
  </details>`;
}
function set(id, f, v) {
  const r = raceOf(id); if (!r) return;
  if (f === "km") { const k = num(v); if (k) r.km = k; else delete r.km; }
  else if (v) r[f] = v; else delete r[f];
  if (f === "date") { delete r.taper; delete r.no; }
  syncRace(); markDirty();
}
const OPEN = new Set();   // aufgeklappte Wettkämpfe (bis zum Neuladen)
function addRace() { const id = "r" + Date.now().toString(36); races().push({ id, art: "lauf" }); OPEN.add(id); markDirty(); render(); }
function del(id) { stop(id); S.races = races().filter(r => r.id !== id); syncRace(); markDirty(); render(); }

window.WK = { races, card, start, stop, no, info, badge, type, settings, set, add: addRace, del, explain,
  tog: (id, on) => { if (on) OPEN.add(id); else OPEN.delete(id); }, done: id => { OPEN.delete(id); render(); } };

/* In woche.js einhängen: Taper-Tage und Renntag zeigen ihre eigenen Texte, Ernährung den eigenen Tagtyp */
const W = window.WOCHE;
if (W) {
  const t0 = W.todayOff, o0 = W.offInf, ty0 = W.type;
  W.todayOff = first => { const i = info(first.k); return i ? { n: i.n, d: i.d, lk: `WK.explain('${first.k}')`, lt: "Ablauf und Essen ›" } : t0(first); };
  W.offInf = e => { const i = info(e.k); return i ? `<div class="inf"><div class="t ot">${esc(i.n)}</div><div class="s">${i.d}</div></div>` : o0(e); };
  W.type = k => type(k) || ty0(k);
  const c0 = W.offClick;
  W.offClick = e => info(e.k) ? `WK.explain('${e.k}')` : c0(e);
}
})();
