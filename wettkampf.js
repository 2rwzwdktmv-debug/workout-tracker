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
     Bis 10 km (3 Taper-Tage): T−3 30 min locker + 4 Steigerungen · T−2 Ruhe oder 20 min locker ·
     T−1 Ruhe oder 15 min + 3 Steigerungen.
     Halbmarathon (18.10.2026, Bakken-Abgleich, 4 Taper-Tage): T−4 3 × 2 km Renntempo · T−3 Ruhe oder
     20–30 min locker · T−2 20 min locker + 4–5 Steigerungen · T−1 Ruhe oder 10 min traben.
     Marathon: Regeln legen wir noch fest.
     Ernährung: T−1 Tagtyp „Trainingstag“ (Kohlenhydrate), beim Halbmarathon auch T−2; Renntag „Trainingstag“;
     Badge „Taper-Ernährung“; Vorabend helle Nudeln/Reis, wenig Rohkost; Renntag Essenszeiten nach der Startzeit.
   Distanz (18.10.): Auswahl 10 km · Halbmarathon (21,1) · Marathon (42,2) · Andere (freie km).
   Liste: nach Datum, Datum zuerst, Countdown; vergangene unter „Abgeschlossen“.                 */
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
/* Distanzen: feste Auswahl, sonst frei (km) */
const DIST = [["10", 10, "10 km"], ["hm", 21.1, "Halbmarathon"], ["m", 42.2, "Marathon"]];
const cat = r => !r.km ? "" : r.km === 10 ? "10" : Math.abs(r.km - 21.1) < 0.15 ? "hm" : Math.abs(r.km - 42.2) < 0.3 ? "m" : "frei";
const isHM = r => r.art === "lauf" && cat(r) === "hm";
const len = r => isHM(r) ? 4 : 3;                                       // Taper-Tage vor dem Rennen
const canTaper = r => r.art === "lauf" && r.km && (r.km <= 10 || isHM(r));   // Marathon: Regeln folgen
const kind = r => r.art === "hyrox" ? "HYROX" : cat(r) === "hm" ? "Halbmarathon" : cat(r) === "m" ? "Marathon" : "Lauf" + (r.km ? " · " + dec(r.km) + " km" : "");
const title = r => r.name || (r.art === "hyrox" ? "HYROX" : cat(r) === "hm" ? "Halbmarathon" : cat(r) === "m" ? "Marathon" : "Lauf");
const until = k => { const n = between(T(), k); return n === 0 ? "heute" : n === 1 ? "morgen" : n === -1 ? "gestern" : n > 1 ? `in ${n} Tagen` : `vor ${-n} Tagen`; };
const dShort = k => { const d = D(k), y = d.getFullYear() !== today0().getFullYear() ? String(d.getFullYear()).slice(2) : ""; return `${d.getDate()}.${d.getMonth() + 1}.${y}`; };
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
  const n = between(T(), r.date), from = add(r.date, -Math.min(len(r), n));
  const ab = from <= T() ? "Ab heute" : `Ab ${WD[D(from).getDay()]} ${fmtDay(D(from))}`;
  return `<div class="today nw">
    <div class="k">In ${n === 1 ? "1 Tag" : n + " Tagen"}: ${esc(title(r))}</div>
    <div class="v">${esc(kind(r))} · ${WD[D(r.date).getDay()]} ${esc(fmtDay(D(r.date)))}${r.time ? " · " + esc(r.time) + " Uhr" : ""}</div>
    <div class="s">Taper starten? ${ab} rutschen die Plan-Einheiten hinter das Rennen, dafür kommen ${isHM(r) ? "ein Lauf im Renntempo, lockere Tage" : "lockere Läufe"} und Taper-Ernährung.${r.ort ? "\n" + esc(r.ort) : ""}</div>
    <button class="cta" onclick="WK.start('${r.id}')">Taper starten</button>
    <button class="cta ghost" onclick="WK.no('${r.id}')">Normal weiter</button>
  </div>`;
}
function start(id) {
  const r = raceOf(id), p = P();
  if (!r) return;
  const from = Math.min(len(r), Math.max(1, between(T(), r.date)));
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
/* Halbmarathon (18.10.): Renntempo üben statt schneller laufen, danach fast nichts, nur die Beine wach halten */
const TXT_HM = {
  4: ["Taper · 3 × 2 km Renntempo", "10 min ein · 3 × 2 km im geplanten Renntempo, 2 min traben · 10 min aus · Fühlt es sich schwer an: abbrechen"],
  3: ["Taper · Ruhe", "Ruhetag oder 20–30 min ganz locker (HF < 142)"],
  2: ["Taper · 20 min locker", "20 min locker (HF < 142) + 4–5 Steigerungen über 80–100 m · Fühlt es sich schwer an: abbrechen"],
  1: ["Taper · Ruhe", "Ruhetag oder 10 min traben"],
};
const txtOf = (r, s) => (r && isHM(r) ? TXT_HM : TXT)[s] || TXT[1];
function info(k) {
  const o = (P().other || {})[k];
  if (!o) return null;
  if (o.tp) {
    const r = raceOf(o.tp.id), [n, d] = txtOf(r, o.tp.s);
    const food = o.tp.s === 1 ? " · Abends helle Nudeln oder Reis statt Vollkorn, wenig Rohkost, bis 20 Uhr essen." : "";
    return { n, d: `${d}${r ? ` · noch ${o.tp.s === 1 ? "1 Tag" : o.tp.s + " Tage"} bis ${esc(title(r))}` : ""}${food}` };
  }
  if (o.race) {
    const r = raceOf(o.race);
    if (!r) return null;
    const t = r.time;
    const plan = t ? ` · Hauptmahlzeit bis ${hhmm(t, 180)} · Snack ${hhmm(t, 60)}–${hhmm(t, 45)} · Einlaufen ab ${hhmm(t, 30)}` : "";
    const dl = !r.km ? "" : cat(r) === "hm" ? "Halbmarathon" : cat(r) === "m" ? "Marathon" : dec(r.km) + " km";
    return { n: `${title(r)}${dl && dl !== title(r) ? " · " + dl : ""}`, d: `${t ? "Start " + esc(t) + " Uhr" : "Renntag"}${r.ort ? " · " + esc(r.ort) : ""}${plan}` };
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
  /* Start vor etwa 13 Uhr (18.10.): Das Frühstück ist die Hauptmahlzeit, keine zwei Mahlzeiten am Morgen */
  const early = t && hhmm(t, 180) < "10:00";
  const plan = o.race ? [
    ...(early ? [] : [["morgens", "Frühstück wie gewohnt, nichts Neues ausprobieren"]]),
    early ? [t ? "bis " + hhmm(t, 180) : "3 h vorher", "Frühstück als Hauptmahlzeit, am besten Porridge statt des geplanten Frühstücks: 100 g Hafer mit Wasser, Shake, 1 Banane, 1 EL Honig, Zimt, ohne Beeren. Viel Kohlenhydrate, wenig Fett und Ballaststoffe. Nichts Neues ausprobieren."]
      : [t ? "bis " + hhmm(t, 180) : "3 h vorher", "Hauptmahlzeit, am besten Porridge (Mittag → Tauschen): 100 g Hafer mit Wasser, Shake, 1 Banane, 1 EL Honig, Zimt, ohne Beeren. Viel Kohlenhydrate, wenig Fett und Ballaststoffe. Die App zeigt mehr Hafer, einfach trotzdem abhaken."],
    [t ? "bis " + hhmm(t, 120) : "2 h vorher", "0,5 l Wasser trinken, danach nur noch schluckweise, letzte Schlucke 20 min vor dem Start"],
    [t ? hhmm(t, 60) + "–" + hhmm(t, 45) : "45–60 min vorher", "Nur bei Hunger: ½ Banane oder 1 Reiswaffel mit Honig"],
    [t ? "ab " + hhmm(t, 30) : "30 min vorher", "Einlaufen: 10–15 min locker, dazu 3–4 Steigerungen"],
    ["im Rennen", short ? "Nichts nötig, kein Gel: Das Rennen ist kürzer als 60 min"
      : "Wasser an den Verpflegungsstellen. Ein Gel um km 10–12 nur, wenn du es im Training schon vertragen hast"],
    ["danach", "Shake und Banane (Nachmittag), abends normal essen, gut trinken"]] : null;
  const what = o.race ? []
    : s === 2 && isHM(r || {}) ? ["Kohlenhydrate wie an einem Trainingstag, die Portionen stellt die App selbst um", "Normale Gerichte, nichts Neues ausprobieren", "Über den Tag gut trinken"]
    : s === 1 ? ["Abends helle Nudeln oder Reis statt Vollkorn", "Gemüse halbe Menge, wenig Rohkost", "Spätestens um 20 Uhr essen, nichts Neues ausprobieren", "Kein Alkohol, über den Tag gut trinken"]
    : ["Normal essen, nur etwas mehr Kohlenhydrate, damit die Speicher bis zum Rennen voll sind"];
  closeSheet();
  const wrap = document.createElement("div");
  wrap.className = "sheetwrap";
  wrap.onclick = ev => { if (ev.target === wrap) closeSheet(); };
  wrap.innerHTML = `<div class="sheet tpsheet">
    <h4>Taper-Ernährung · ${WD[D(k).getDay()]} ${esc(fmtDay(D(k)))}</h4>
    ${plan ? `<p><b>Ablauf heute</b>${r ? " · " + esc(title(r)) + (t ? ", Start " + esc(t) + " Uhr" : "") : ""}</p><div class="tpplan">${plan.map(([a, b]) => `<div class="tpt"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join("")}</div>` : ""}
    <p>${o.race ? "Renntag" : s === 1 ? "Tag vor dem Rennen" : "Taper-Tag"}${r ? " · " + esc(title(r)) : ""}: <b>${esc(now.l)}</b> statt Ruhetag.</p>
    ${row("Kalorien", base.kcal, now.kcal, "kcal")}${row("Kohlenhydrate", base.c, now.c, "g")}${row("Protein", base.p, now.p, "g")}${row("Fett", base.f, now.f, "g")}
    ${what.length ? `<div class="tpw">${what.map(x => `<div>· ${esc(x)}</div>`).join("")}</div>` : ""}
    <p class="tpn">Warum: Weniger Training und etwas mehr Kohlenhydrate füllen die Speicher bis zum Start. ${r && isHM(r) ? "Ab dem Halbmarathon lohnt sich ein kleines Carb-Loading: die letzten zwei Tage Kohlenhydrate wie an einem Trainingstag, am Vorabend helle Nudeln oder Reis." : "Für Läufe bis 10 km reicht das, richtiges Carb-Loading lohnt sich erst ab dem Halbmarathon."} Die Portionen (Reis, Nudeln, Kartoffeln) passt die App über den Tagtyp selbst an.</p>
    <button class="cta ghost" onclick="closeSheet();location.hash='#settings'">Wettkampf bearbeiten ›</button>
    <button class="cancel" onclick="closeSheet()">Schließen</button>
  </div>`;
  document.body.appendChild(wrap);
}
/* ---------- Taper- und Renntag als eigene Einheit (19.10.) ----------
   Unsere eigenen Einheiten (nicht Hunter): Teile zum Abhaken, Ergebnis (Zeit, km, Ø-HF), „Einheit abschließen“.
   Gespeichert: other[k].ck = [true, …] (Teile), other[k].done = ISO; Ergebnis als S.xruns-Eintrag mit tp = Datum,
   damit es in Laufwoche, Wochenkarte (3 × 2 km Renntempo = „hart“ = Schwelle) und 2-Tage-Regel zählt.
   s = Stufe für Chips und Kalender (S = Key, B = Base), opt = Ruhetag ist genauso gut, min = Plan-Minuten. */
const TW_HM = {
  4: { s: "S", kind: "hart", min: 45, parts: [["Einlaufen", "10 min locker"], ["3 × 2 km Renntempo", "im geplanten Renntempo, dazwischen 2 min traben"], ["Auslaufen", "10 min locker"]], tip: "Fühlt es sich schwer an: abbrechen." },
  3: { s: "B", kind: "locker", min: 25, opt: 1, parts: [["Ganz locker", "20–30 min, HF unter 142"]], tip: "Ruhetag ist genauso gut." },
  2: { s: "B", kind: "locker", min: 25, parts: [["Locker", "20 min, HF unter 142"], ["Steigerungen", "4–5 × 80–100 m"]], tip: "Fühlt es sich schwer an: abbrechen." },
  1: { s: "B", kind: "locker", min: 10, opt: 1, parts: [["Traben", "10 min"]], tip: "Ruhetag ist genauso gut." },
};
const TW_K = {
  3: { s: "B", kind: "locker", min: 35, parts: [["Locker", "30 min, HF unter 142"], ["Steigerungen", "4 × 15–20 s"]] },
  2: { s: "B", kind: "locker", min: 20, opt: 1, parts: [["Ganz locker", "20 min"]], tip: "Ruhetag ist genauso gut." },
  1: { s: "B", kind: "locker", min: 20, opt: 1, parts: [["Locker", "15 min"], ["Steigerungen", "3 ×"]], tip: "Ruhetag ist genauso gut." },
};
function tw(k) {
  const o = (P().other || {})[k];
  if (!o) return null;
  if (o.tp) { const r = raceOf(o.tp.id); return Object.assign({ k, o, r }, (r && isHM(r) ? TW_HM : TW_K)[o.tp.s] || TW_K[1]); }
  if (o.race) {
    const r = raceOf(o.race); if (!r || r.art !== "lauf") return null;
    const dl = cat(r) === "hm" ? "Halbmarathon" : cat(r) === "m" ? "Marathon" : r.km ? dec(r.km) + " km" : "";
    return { k, o, r, s: "S", kind: "wettkampf", race: 1, min: 0, parts: [["Einlaufen", "10–15 min locker, 3–4 Steigerungen"], [title(r), [dl, r.time ? "Start " + r.time + " Uhr" : ""].filter(Boolean).join(" · ")]] };
  }
  return null;
}
const XRS = () => (S.xruns = S.xruns || []);
const minsOf = v => { const p = String(v || "").trim().split(":").map(Number); if (!p[0] && p[0] !== 0 || p.some(isNaN)) return 0; return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p.length === 2 ? p[0] + p[1] / 60 : p[0]; };
const fmtM = t => { if (!t) return ""; const h = Math.floor(t / 60), m = Math.floor(t % 60), s = Math.round((t % 1) * 60); return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };
function renderTaper(k) {
  const w = tw(k);
  if (!w) { location.hash = ""; return; }
  backBtn.style.display = ""; titleEl.textContent = w.race ? "Wettkampf" : "Taper"; setNav("home");
  const o = w.o, ck = o.ck || [], x = XRS().find(r => r.tp === k) || {}, i = info(k) || { n: "" };
  const left = w.r ? Math.round((D(w.r.date) - D(k)) / 864e5) : null;
  let h = `<div class="tphead"><div class="k">${WD[D(k).getDay()]} ${esc(fmtDay(D(k)))}${badge(k)}</div>
    <h2>${esc(w.race ? i.n : i.n.replace(/^Taper · /, ""))}</h2>
    <div class="s"><span class="fkc fk${w.s} sm">${w.s === "S" ? "Key" : "Base"}</span>${w.race ? "Renntag" : `Taper · noch ${left} ${left === 1 ? "Tag" : "Tage"} bis ${esc(title(w.r || {}))}`}${o.done ? " · erledigt ✓" : ""}</div></div>`;
  if (w.opt) h += `<div class="planhint">Optional: ${esc(w.tip)}</div>`;
  h += w.parts.map((p, n) => `<div class="card item ${ck[n] ? "checked" : ""}"><div class="head"><button class="cb" onclick="WK.tpCk('${k}',${n})" aria-label="abhaken">✓</button>
    <div><div class="tt">${esc(p[0])}</div><div class="st">${esc(p[1])}</div></div></div></div>`).join("");
  if (w.tip && !w.opt) h += `<div class="planhint">${esc(w.tip)}</div>`;
  h += `<div class="card item tpres"><div class="tt">Ergebnis</div><div class="res lauf"><div class="lf">
      <label>Zeit<input id="tp-t" inputmode="numeric" placeholder="${w.race ? "1:40:00" : w.min + ":00"}" value="${esc(fmtM(x.est ? 0 : x.t))}"></label>
      <label>km<input id="tp-k" inputmode="decimal" placeholder="${w.race && w.r.km ? dec(w.r.km) : "5,0"}" value="${x.km ? dec(x.km) : ""}"></label>
      <label>Ø-HF<input id="tp-h" inputmode="numeric" placeholder="${w.kind === "locker" ? "135" : "170"}" value="${x.hf || ""}"></label></div></div></div>
    <button class="tsave" onclick="WK.tpDone('${k}')">${o.done ? "Ergebnis aktualisieren" : "Einheit abschließen"}</button>
    ${o.done ? `<div class="lk tlk" style="margin-top:12px" onclick="WK.tpUndo('${k}')">Doch nicht gemacht ›</div>` : ""}
    <div class="lk tlk" style="margin-top:12px" onclick="WK.explain('${k}')">${w.race ? "Ablauf und Essen" : "Taper-Ernährung"} ›</div>`;
  main.innerHTML = h;
}
function tpCk(k, n) { const o = P().other[k]; if (!o) return; o.ck = o.ck || []; o.ck[n] = !o.ck[n]; markDirty(); render(); }
function tpDone(k) {
  const w = tw(k); if (!w) return;
  const g = id => (document.getElementById(id) || {}).value || "";
  const t = minsOf(g("tp-t")), km = parseFloat(g("tp-k").replace(",", ".")) || 0, hf = parseInt(g("tp-h"), 10) || null;
  const list = XRS(), j = list.findIndex(r => r.tp === k); if (j >= 0) list.splice(j, 1);
  list.push({ d: k, kind: w.kind, t: t ? Math.round(t * 10) / 10 : w.min, km, hf, tp: k, ...(t ? {} : { est: 1 }) });
  w.o.done = new Date().toISOString(); w.o.ck = w.parts.map(() => true);
  markDirty(); render();
}
function tpUndo(k) {
  const o = P().other[k]; if (!o) return;
  delete o.done; delete o.ck;
  const list = XRS(), j = list.findIndex(r => r.tp === k); if (j >= 0) list.splice(j, 1);
  markDirty(); render();
}
/* Play-Button: heute ein offener Taper- oder Renntag → dorthin */
function goToday() { const k = T(), w = tw(k); if (!w || w.o.done) return false; location.hash = "#tp/" + k; return true; }

/* Ernährung: Vortag und Renntag mit Kohlenhydraten wie an einem Trainingstag */
function type(k) {
  const o = (P().other || {})[k];
  if (!o) return null;
  if (o.tp) return o.tp.s === 1 || (o.tp.s === 2 && isHM(raceOf(o.tp.id) || {})) ? "train" : "active";
  if (o.race) return "train";
  return null;
}

/* ---------- Einstellungen → Wettkampf: Liste nach Datum (Datum zuerst, Countdown), Vergangenes eingeklappt ---------- */
function row(r) {
  const id = r.id, on = (f, v) => `onchange="WK.set('${id}','${f}',${v})"`, t = T();
  const past = r.date && r.date < t, free = r.art === "lauf" && (cat(r) === "frei" || FREE.has(id));
  const hint = past ? ""
    : r.art === "hyrox"
      ? (window.RENNEN && RENNEN.active() && S.race && S.race.date === r.date ? "Rennblock läuft." : `Rennblock-Frage etwa ${window.RENNEN ? RENNEN.leadDays() : "–"} Tage vorher.`)
    : canTaper(r) ? (r.taper ? `Taper läuft · <a onclick="WK.stop('${id}')">beenden</a>`
        : lead(r) === len(r) ? `Taper-Frage ${lead(r)} Tage vorher.` : `Taper-Frage ${lead(r)} Tage vorher, Taper die letzten ${len(r)} Tage.`)
    : cat(r) === "m" ? "Taper-Regeln für den Marathon legen wir noch fest."
    : r.km ? "Für diese Distanz gibt es noch keine Taper-Regeln."
    : "Distanz wählen, dann fragt die App rechtzeitig nach dem Taper.";
  const k = r.art === "lauf" && !r.km ? "Distanz fehlt" : kind(r) === title(r) ? "" : kind(r);
  const sub = [k, r.ort && esc(r.ort), r.time && esc(r.time) + " Uhr"].filter(Boolean).join(" · ");
  const n = r.date ? between(t, r.date) : null;
  const cd = r.date ? (past ? "✓ " : "") + until(r.date) : "Datum fehlt";
  return `<details class="wkr${past ? " done" : ""}" ${OPEN.has(id) || !r.date ? "open" : ""} ontoggle="WK.tog('${id}', this.open)">
      <summary><span class="wkdt">${r.date ? `<small>${WD[D(r.date).getDay()]}</small><b>${dShort(r.date)}</b>` : "<b>–</b>"}</span>
        <span class="wkmid"><b>${esc(title(r))}</b><small>${sub}</small></span>
        <span class="wkcd${n !== null && n >= 0 && n <= 7 ? " soon" : ""}">${cd}</span></summary>
      <div class="wkart">${["hyrox", "lauf"].map(a => `<button class="${r.art === a ? "on" : ""}" onclick="WK.set('${id}','art','${a}');render()">${a === "hyrox" ? "HYROX" : "Lauf"}</button>`).join("")}
        <button class="wkdel" onclick="if(confirm('Wettkampf löschen?'))WK.del('${id}')">Löschen</button></div>
      ${r.art === "lauf" ? `<div class="wkart wkdist">${DIST.map(([c, km, l]) => `<button class="${!free && cat(r) === c ? "on" : ""}" onclick="WK.dist('${id}',${km})">${l}</button>`).join("")}
        <button class="${free ? "on" : ""}" onclick="WK.dist('${id}',0)">Andere</button></div>` : ""}
      <div class="rmgrid">
        <div class="rmcell"><span>Name</span><input type="text" value="${esc(r.name || "")}" placeholder="${r.art === "hyrox" ? "HYROX Frankfurt" : esc(title(r))}" ${on("name", "this.value")}></div>
        <div class="rmcell"><span>Ort</span><input type="text" value="${esc(r.ort || "")}" placeholder="Frankfurt" ${on("ort", "this.value")}></div>
        <div class="rmcell"><span>Datum</span><input type="date" value="${esc(r.date || "")}" ${on("date", "this.value")}></div>
        <div class="rmcell"><span>Start</span><input type="time" value="${esc(r.time || "")}" ${on("time", "this.value")}></div>
        ${free ? `<div class="rmcell"><span>Distanz (km)</span><input inputmode="decimal" value="${r.km ? dec(r.km) : ""}" placeholder="15" ${on("km", "this.value")}></div>` : ""}
      </div>
      ${hint ? `<p class="hint">${hint}</p>` : ""}
      <button class="wkbtn" onclick="WK.done('${id}')">Fertig</button>
    </details>`;
}
function settings() {
  const t = T(), all = races();
  const next = all.filter(r => !r.date || r.date >= t).sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
  const past = all.filter(r => r.date && r.date < t).sort((a, b) => a.date < b.date ? 1 : -1);
  return `<details class="setsec">
    <summary><svg class="secic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>Wettkampf</summary>
    <div class="secbody">
      <p class="hint">HYROX startet rechtzeitig den Rennblock (Part 4). Läufe bis 10 km bekommen die letzten 3 Tage einen Taper, der Halbmarathon die letzten 4, jeweils mit Taper-Ernährung.</p>
      ${next.map(row).join("")}
      <button class="wkbtn" onclick="WK.add()">＋ Wettkampf</button>
      ${past.length ? `<details class="wkpast"><summary>Abgeschlossen · ${past.length}</summary>${past.map(row).join("")}</details>` : ""}
    </div>
  </details>`;
}
/* Für die Gruppe „Wettkämpfe“: der nächste Wettkampf als Untertitel */
function nextLine() {
  const r = races().filter(x => x.date && x.date >= T()).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  return r ? `${title(r)} · ${WD[D(r.date).getDay()]} ${dShort(r.date)} · ${until(r.date)}` : "";
}
function dist(id, km) {
  const r = raceOf(id); if (!r) return;
  if (km) { r.km = km; FREE.delete(id); } else FREE.add(id);
  syncRace(); markDirty(); render();
}
const FREE = new Set();   // „Andere“ gewählt, km noch offen (bis zum Neuladen)
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

window.WK = { races, card, start, stop, no, info, badge, type, settings, set, add: addRace, del, explain, dist, nextLine,
  tw, renderTaper, tpCk, tpDone, tpUndo, goToday,
  tog: (id, on) => { if (on) OPEN.add(id); else OPEN.delete(id); }, done: id => { OPEN.delete(id); render(); } };

/* In woche.js einhängen: Taper-Tage und Renntag zeigen ihre eigenen Texte, Ernährung den eigenen Tagtyp */
const W = window.WOCHE;
if (W) {
  const t0 = W.todayOff, o0 = W.offInf, ty0 = W.type;
  // Taper-/Renntag als Einheit (19.10.): „Training starten“ unter Heute, Danach-Zeile öffnet die Einheit
  const shortD = (k, i) => { const o = (P().other || {})[k], r = o && o.tp ? raceOf(o.tp.id) : null;   // kurz (19.10.): Details stehen in der Einheit
    return o && o.tp ? `noch ${o.tp.s === 1 ? "1 Tag" : o.tp.s + " Tage"}${r ? " bis " + esc(title(r)) : ""}` : i.d; };
  W.todayOff = first => { const i = info(first.k), w = tw(first.k); return i ? { n: i.n, d: w ? shortD(first.k, i) : i.d, lk: `WK.explain('${first.k}')`, lt: "Ablauf und Essen ›",
    btn: w ? `<button class="cta${w.o.done ? " ghost" : ""}" onclick="location.hash='#tp/${first.k}'">${w.o.done ? "Erledigt ✓ · ansehen" : w.race ? "Zum Rennen" : "Training starten"}</button>` : "" } : t0(first); };
  W.offInf = e => { const i = info(e.k), w = tw(e.k); return i ? `<div class="inf"><div class="t ot">${w ? `<span class="fkc fk${w.s} sm">${w.s === "S" ? "Key" : "Base"}</span>` : ""}${esc(i.n)}${w && w.o.done ? " ✓" : ""}</div><div class="s">${w ? shortD(e.k, i) : i.d}</div></div>` : o0(e); };
  W.type = k => type(k) || ty0(k);
  const c0 = W.offClick;
  W.offClick = e => tw(e.k) ? `location.hash='#tp/${e.k}'` : info(e.k) ? `WK.explain('${e.k}')` : c0(e);
}
})();
