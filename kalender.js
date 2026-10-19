/* Kalender (19.10.2026): Kalenderwochen Mo–So am Stück, standardmäßig letzte, aktuelle und 4 kommende, Pfeile je eine Woche.
   Vergangenes kommt aus den Haken, Anderem Training und „＋ Lauf“, Kommendes aus projectPlan (Prognose mit 7-Tage-Regel).
   Punkte je Einheit (AM/PM): Key lime, Base sky, Support amber; ausgefüllt = erledigt, hell = geplant.
   Klammer = 7-Tage-Fenster einer Planwoche: Haken links am ersten, rechts am letzten Tag (gestrichelt: ältere Planwoche ohne festes Ende);
   in den Wochendetails, was in dieser Planwoche wegfällt / wegfiel. Alle Wochen starten zugeklappt.
   Antippen: Tag oder Zeile → Sheet (Tag ansehen, Geht nicht, Anderes Training), Wochenkopf → Details darunter.
   Gespeichert wird hier nichts; die Sheets speichern wie überall sonst. Route #cal, Umschalter „Kalender | Plan“.      */
(function () {
const T = () => dkey(today0());
const D = k => new Date(k + "T12:00:00");
const between = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const WDS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const NWEEKS = 6;
let OFF = 0, SEL = null;                                      // Verschiebung in Wochen, aufgeklappte Woche (Montag)
let RANGE = null, RN = "Urlaub", SUG = new Map();                              // Abwesend wählen: { s } (s = null: noch kein erster Tag), Name

const monday = k => { const d = D(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); };
const plus = (k, n) => dkey(addDays(D(k), n));
function kwOf(k) {
  const d = D(k); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const j = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7);
}
function span(a, b) {
  const x = D(a), y = D(b);
  return x.getMonth() === y.getMonth() ? `${x.getDate()}.–${fmtDay(y)}` : `${fmtDay(x)} – ${fmtDay(y)}`;
}
const realIdx = pd => pd.day.sessions.map((s, si) => si).filter(si => sessReal(pd.day.sessions[si]).length);
const stufe = (pd, si) => ((pd.day.sessions[si] || {}).fokus || {}).s || "";
const slot = (pd, si) => { if (window.FOKUS) return FOKUS.slotOf(pd, si); return realIdx(pd).length > 1 ? pvSlots(pd.day.sessions)[si] || "" : ""; };
const txt = (pd, si) => pvRank(pvSession(pd.day.sessions[si]), 2).join(" + ");
const pwName = pd => pd.part.name.replace(/^Part\s*/, "P") + " · " + pd.week.name.replace(/^Week\s*/, "W");
const pwShort = pd => (pd.part.opt ? "R" : "W") + (pd.wi + 1);
const isRun = i => !!WOCHE.RUNK[i.key] || /\b(run|jog)\b|lauf/i.test(i.sub || "");   // Plan-Läufe haben nicht immer einen key
const hm = m => { m = Math.round(m); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };

/* ---------- Daten ---------- */
function doneMap(days) {                                      // Datum → erledigte Einheiten { pd, si }
  const m = {};
  days.forEach(pd => pd.day.sessions.forEach((s, si) => {
    const ks = new Set(sessReal(s).map(i => S.checked[i.id]).filter(x => typeof x === "string").map(x => dkey(new Date(x))));
    ks.forEach(k => (m[k] = m[k] || []).push({ pd, si, done: true }));
  }));
  return m;
}
function projMap(lastK) {                                     // Datum → Eintrag aus projectPlan (nur heute und später)
  const out = {};
  if (lastK < T()) return out;
  projectPlan(Math.min(400, between(T(), lastK) + 1)).forEach(e => { out[e.k] = e; });
  return out;
}
/* Planwochen-Beginn: Datum → { w, pd, s, e, drops: [{ pd, sis, past }] } */
function pwStarts(days, pm) {
  const byW = {}, byKey = {}, out = {};
  days.forEach(pd => { const w = pd.pi + "." + pd.wi; if (!byW[w]) byW[w] = pd; byKey[pd.key] = pd; });
  const put = (k, w, o) => { if (!byW[w]) return; out[k] = Object.assign(out[k] || { w, pd: byW[w], s: k, e: null, drops: [] }, o || {}); };
  const first = {};
  days.forEach(pd => pd.items.forEach(i => {
    const c = S.checked[i.id]; if (typeof c !== "string") return;
    const k = dkey(new Date(c)), w = pd.pi + "." + pd.wi;
    if (!first[w] || k < first[w]) first[w] = k;
  }));
  Object.keys(first).forEach(w => put(first[w], w));
  const c = window.FOKUS ? FOKUS.compute() : { windows: {}, drops: [] };
  Object.keys(c.windows).forEach(w => put(c.windows[w].start, w, { e: c.windows[w].end }));
  const seen = new Set(Object.values(out).map(x => x.w));
  Object.keys(pm).sort().forEach(k => {                         // weitere Planwochen aus der Vorschau
    const e = pm[k]; if (e.kind !== "train" || !e.d) return;
    const w = e.d.pi + "." + e.d.wi; if (seen.has(w)) return;
    seen.add(w); put(k, w);
  });
  const at = w => Object.values(out).find(x => x.w === w);
  Object.keys((planState().fokusLog) || {}).forEach(w => {
    const L = planState().fokusLog[w], x = at(w) || (put(L.s, w), out[L.s]);
    if (!x) return;
    x.e = x.e || L.e;
    const per = {};
    (L.u || []).forEach(u => { const [dk, si] = u.split("/"); if (byKey[dk]) (per[dk] = per[dk] || []).push(+si); });
    Object.keys(per).forEach(dk => x.drops.push({ pd: byKey[dk], sis: per[dk], past: true }));
  });
  c.drops.forEach(dr => { const x = at(dr.d.pi + "." + dr.d.wi); if (x) x.drops.push({ pd: dr.d, sis: dr.sis, past: false }); });
  // Selbst weggelassen: nur ganze Plan-Tage hier; eine halbe bleibt in der Zeile ihres Tages (durchgestrichen)
  (c.skipped || []).filter(sk => !c.inQ.has(sk.d.key)).forEach(sk => { const x = at(sk.d.pi + "." + sk.d.wi); if (x) x.drops.push({ pd: sk.d, sis: [sk.si], skip: true }); });
  return out;
}
/* Ein Kalendertag: Einheiten (erledigt + geplant) und Markierungen */
function dayInfo(k, dm, pm) {
  const t = T(), p = planState(), o = (p.other || {})[k] || null;
  const races = (S.races || []).filter(r => r.date === k);
  const xr = (S.xruns || []).filter(x => x.d === k && !x.tp);   // Taper-Ergebnisse stehen beim Taper-Tag selbst
  const tw = window.WK && WK.tw ? WK.tw(k) : null;               // Taper-/Renntag als Einheit (19.10.)
  const units = (dm[k] || []).slice(), e = pm[k];
  let kind = k < t ? "past" : "free";
  if (k >= t && e) {
    if (e.kind === "train" && e.d) {
      const idx = e.part && e.part.length ? e.part : realIdx(e.d);
      idx.forEach(si => { if (!units.some(u => u.pd.key === e.d.key && u.si === si)) units.push({ pd: e.d, si, done: false }); });
      kind = "train";
    } else if (e.kind === "donetoday") kind = "train";
    else if (e.kind === "off") kind = o ? "other" : "off";
    else if (e.kind === "rest") kind = "rest";
  }
  if (k < t && o) kind = "other";
  const aw = window.FOKUS ? FOKUS.awayAt(k) : null;
  if (aw && (kind === "off" || kind === "past")) kind = k < t ? "past" : "away";
  return { k, units, kind, o, races, xr, e, aw, tw, sug: SUG.get(k) || 0 };
}
function runMin(info, rd) {                                    // gelaufen (bis heute) + geplant + Vorschlag, wie WOCHE.sugRuns
  if (info.k < T()) return (rd[info.k] || {}).min || 0;
  return (info.k === T() ? (rd[info.k] || {}).min || 0 : 0) + (info.e ? WOCHE.planMin(info.e) : 0) + (info.sug || 0);
}

/* ---------- Ansicht ---------- */
function seg(on) {
  return `<div class="kseg"><button class="${on === "cal" ? "on" : ""}" onclick="location.hash='#cal'">Kalender</button><button class="${on === "plan" ? "on" : ""}" onclick="location.hash='#weeks'">Plan</button></div>`;
}
/* 7-Tage-Fenster je Planwoche: [{ s, e, lbl, open }]; ältere Planwochen (vor fokusFrom) ohne festes Ende → bis zum letzten Tag */
function windows(starts, days, pm) {
  const last = {};
  days.forEach(pd => pd.items.forEach(i => {
    const c = S.checked[i.id]; if (typeof c !== "string") return;
    const k = dkey(new Date(c)), w = pd.pi + "." + pd.wi; if (!last[w] || k > last[w]) last[w] = k;
  }));
  Object.keys(pm).forEach(k => { const e = pm[k]; if (e.kind === "train" && e.d) { const w = e.d.pi + "." + e.d.wi; if (!last[w] || k > last[w]) last[w] = k; } });
  return Object.values(starts).map(x => ({ s: x.s, e: x.e || last[x.w] || x.s, lbl: pwShort(x.pd), open: !x.e }))
    .sort((a, b) => (a.s < b.s ? -1 : 1));
}
function bracket(k, wins) {                                   // Klassen für die Zelle: Haken links (bs) / rechts (be)
  return wins.filter(x => x.s === k || x.e === k)
    .map(x => (x.s === k ? " bs" : "") + (x.e === k ? " be" : "") + (x.open ? (x.s === k ? " bsd" : " bed") : "")).join("");
}
function cell(info, br) {
  const t = T(), dots = info.units.map(u => `<i class="kd k${stufe(u.pd, u.si) || "E"}${u.done ? " done" : ""}"></i>`).join("")
    + (info.tw ? `<i class="kd k${info.tw.s}${info.tw.o.done ? " done" : ""}"></i>` : "")
    + (info.o && !info.o.tp && !info.o.race ? `<i class="kd kO"></i>` : "") + info.xr.map(() => `<i class="kd kX"></i>`).join("")
    + (info.sug ? `<i class="kd kX"></i>` : "");
  let mk = "";
  if (info.races.length || (info.o && info.o.race)) mk = `<span class="km race">🏁</span>`;
  else if (info.o && info.o.tp) mk = `<span class="km tp">Taper</span>`;
  else if (info.aw) mk = `<span class="km aw">${esc(info.aw.n.slice(0, 7))}</span>`;
  else if (info.kind === "off") mk = `<span class="km">–</span>`;
  else if (info.kind === "rest") mk = `<span class="km">Ruhe</span>`;
  const sel = RANGE && RANGE.s === info.k;
  const cls = ["kc", info.k === t ? "now" : "", info.k < t ? "past" : "", info.kind === "off" || info.aw ? "off" : "", sel ? "rsel" : ""].join(" ") + (br || "");
  return `<button class="${cls}" onclick="KAL.day('${info.k}')"><span class="kn">${D(info.k).getDate()}</span><span class="kds">${dots}</span>${mk}</button>`;
}
function unitRow(u) {                                         // Antippen wie der ganze Tag: erst das Sheet
  const sl = slot(u.pd, u.si);
  return `<div class="kl${u.done ? " done" : ""}">
    <b class="ksl">${esc(sl)}</b>${window.FOKUS ? FOKUS.chipSess(u.pd, u.si) : ""}<span class="kt">${esc(u.pd.day.label)} · ${esc(txt(u.pd, u.si))}</span>${u.done ? `<span class="ok">✓</span>` : ""}</div>`;
}
function detail(mon, infos, starts) {
  const t = T();
  // Gehört der erste Tag mit Einheiten zu einer Planwoche, die früher begann: deren Namen oben zeigen
  let head = "";
  const fu = infos.find(x => x.units.length), fw = fu && fu.units[0].pd.pi + "." + fu.units[0].pd.wi;
  if (fw && !infos.some(x => x.k <= fu.k && starts[x.k] && starts[x.k].w === fw)) {
    const x = Object.values(starts).find(y => y.w === fw);
    head = `<div class="kpwsep cont"><span>Planwoche ${esc(pwName(fu.units[0].pd))}</span>${x ? ` · seit ${esc(fmtDay(D(x.s)))}` : ""} · läuft weiter</div>`;
  }
  return `<div class="kdet">${head}` + infos.map((info, i) => {
    const pw = starts[info.k];
    let h = "";
    if (pw) {
      h += `<div class="kpwsep"><span>Planwoche ${esc(pwName(pw.pd))}</span>${pw.e ? ` · ${esc(span(pw.s, pw.e))}` : ""}</div>`;
      h += pw.drops.map(dr => `<div class="fkdrop kdrop"><div class="inf"><div class="t">${esc(dr.pd.day.label)}${dr.sis.length === 1 && realIdx(dr.pd).length > 1 ? " · " + esc(slot(dr.pd, dr.sis[0])) : ""} ${dr.sis.map(si => `<span class="fkc fk${stufe(dr.pd, si) || "E"} sm">${FOKUS.NAME[stufe(dr.pd, si) || "E"]}</span>`).join("")}</div>
        <div class="s">${esc(dr.sis.map(si => txt(dr.pd, si)).join(" · "))} · ${dr.skip ? "von dir weggelassen" : dr.past ? "fiel weg" : "fällt weg"}</div></div>
        ${dr.past ? "" : dr.skip ? `<button class="fkback" onclick="event.stopPropagation();FOKUS.unskip('${dr.pd.key}/${dr.sis[0]}')">zurückholen</button>`
          : `<button class="fkback" onclick="event.stopPropagation();FOKUS.back('${dr.sis.map(si => dr.pd.key + "/" + si).join(",")}')">zurückholen</button>`}</div>`).join("");
    }
    const lines = info.units.map(u => ({ key: u.pd.key, si: u.si, h: unitRow(u) }));
    // weggelassene Hälfte eines Tages, dessen andere Hälfte hier ansteht: in derselben Zeile, durchgestrichen
    [...new Set(info.units.filter(u => !u.done).map(u => u.pd.key))].forEach(key => {
      const pd = info.units.find(u => u.pd.key === key).pd, o = FOKUS.origOf(pd);
      FOKUS.skippedOf(pd).forEach(si => { lines.push({ key, si, h: `<div class="kl gone"><b class="ksl">${esc(slot(o, si))}</b><span class="fkc fk${stufe(o, si) || "E"} sm">${FOKUS.NAME[stufe(o, si) || "E"]}</span><span class="kt">${esc(o.day.label)} · ${esc(txt(o, si))}</span> <i>weggelassen</i></div>` }); });
    });
    let body = lines.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.si - b.si)).map(x => x.h).join("");
    if (info.races.length) body += info.races.map(r => `<div class="kl race">🏁 ${esc(r.name || "Wettkampf")}${r.ort ? " · " + esc(r.ort) : ""}${r.time ? " · " + esc(r.time) : ""}</div>`).join("");
    if (info.tw && info.o.tp) body += `<div class="kl${info.tw.o.done ? " done" : ""}"><b class="ksl"></b><span class="fkc fk${info.tw.s} sm">${FOKUS.NAME[info.tw.s]}</span><span class="kt">${esc(WK.info(info.k).n.replace(/^Taper · /, "Taper · "))}${info.tw.opt ? " (optional)" : ""}</span>${info.tw.o.done ? `<span class="ok">✓</span>` : ""}</div>`;
    else if (info.o && !info.o.race) body += `<div class="kl ot">${info.o.tp ? esc(window.WK && WK.info(info.k) ? WK.info(info.k).n : "Taper") : esc(info.o.n)}</div>`;
    if (info.tw && info.tw.race && info.tw.o.done) body += `<div class="kl done"><b class="ksl"></b><span class="kt">Rennen gelaufen</span><span class="ok">✓</span></div>`;
    if (info.sug) body += `<div class="kl"><b class="ksl"></b><span class="kt">＋ ${info.sug} min locker laufen · für 3 h diese Woche</span></div>`;
    body += info.xr.map(x => `<div class="kl">＋ Lauf${x.km ? " " + String(x.km).replace(".", ",") + " km" : ""}${x.t ? " · " + Math.round(x.t) + " min" : ""}</div>`).join("");
    if (!body && info.aw) body = `<div class="kl mut"><b class="ksl"></b>${esc(info.aw.n)} · ${info.aw.pause ? "Pause, der Plan wartet" : "gekürzt"}</div>`;
    if (!body) body = `<div class="kl mut">${info.kind === "off" ? "Geht nicht" : info.kind === "rest" ? "Ruhetag" : info.k < t ? "–" : "frei"}</div>`;
    const d = D(info.k);
    h += `<div class="kdr${info.k === t ? " now" : ""}" onclick="KAL.day('${info.k}')"><div class="dt"><div class="wd">${WDS[i]}</div><div class="dn">${d.getDate()}.</div></div><div class="inf">${body}</div></div>`;
    return h;
  }).join("") + `</div>`;
}
function render() {
  backBtn.style.display = "none";
  titleEl.textContent = PLAN_TITLE;
  setNav("week");
  const t = T(), first = plus(monday(t), 7 * (OFF - 1)), last = plus(first, 7 * NWEEKS - 1);
  const days = planDays(), dm = doneMap(days), pm = projMap(last), starts = pwStarts(days, pm), wins = windows(starts, days, pm);
  const rd = WOCHE.runDays();
  const sug = WOCHE.sugRuns ? WOCHE.sugRuns(between(T(), last) + 1) : new Map();   // ＋ xx min locker fürs Wochenminimum
  SUG = sug;
  let h = seg("cal") + `<div class="khead"><button class="kar" onclick="KAL.go(-1)" aria-label="eine Woche früher">↑</button>
    <span>${OFF ? `<a onclick="KAL.today()">Heute</a> · ` : ""}<a onclick="KAL.rangeStart(null)">＋ Abwesend</a></span>
    ${RANGE ? `<div class="krange"><span>${RANGE.s ? `Abwesend ab ${esc(fmtDay(D(RANGE.s)))}: letzten Tag antippen` : "Abwesend: ersten Tag antippen"}</span><button onclick="KAL.rangeStart(false)">abbrechen</button></div>` : ""}
    <div class="kwdh">${WDS.map(w => `<span>${w}</span>`).join("")}</div></div>`;
  for (let wi = 0; wi < NWEEKS; wi++) {
    const mon = plus(first, 7 * wi), ks = [0, 1, 2, 3, 4, 5, 6].map(i => plus(mon, i));
    const infos = ks.map(k => dayInfo(k, dm, pm));
    const min = infos.reduce((a, x) => a + runMin(x, rd), 0);
    const nS = infos.reduce((a, x) => a + x.units.filter(u => stufe(u.pd, u.si) === "S").length + (x.tw && x.tw.s === "S" ? 1 : 0), 0);
    const nDrop = ks.reduce((a, k) => a + (starts[k] ? starts[k].drops.reduce((b, dr) => b + dr.sis.length, 0) : 0), 0);   // inkl. selbst weggelassen
    const cur = mon === monday(t), open = SEL === mon;
    h += `<div class="kw${cur ? " cur" : ""}${open ? " open" : ""}">
      <div class="kwh" onclick="KAL.sel('${mon}')"><span class="kwt"><b>KW ${kwOf(mon)}</b> · ${esc(span(mon, ks[6]))}</span>
        <span class="kws">${min ? `Lauf ${hm(min)} h` : ""}${nS ? `${min ? " · " : ""}${nS} Key` : ""}${nDrop ? ` · <em>${nDrop} ${ks[6] < t ? (nDrop > 1 ? "fielen" : "fiel") : (nDrop > 1 ? "fallen" : "fällt")} weg</em>` : ""}</span><span class="kchev">${open ? "▾" : "▸"}</span></div>
      <div class="kg">${infos.map(x => cell(x, bracket(x.k, wins))).join("")}</div>
      ${open ? detail(mon, infos, starts) : ""}
    </div>`;
  }
  h += `<button class="kar kdown" onclick="KAL.go(1)" aria-label="eine Woche später">↓</button>
    <div class="planhint"><div class="klg"><span><i class="kd kS done"></i>Key</span><span><i class="kd kB done"></i>Base</span><span><i class="kd kE done"></i>Support</span><span><i class="kd kO"></i>Anderes</span><span><i class="kd kX"></i>＋ Lauf</span><span>hell = geplant</span></div>
      Die Klammer (Haken links und rechts) zeigt die 7 Tage einer Planwoche. Passt nicht alles hinein, fällt zuerst <b class="cS">Support</b> weg, dann <b class="cB">Base</b> (vorher lieber „Nur 30 min“), zuletzt <b class="cK">Key</b>. Day 1 bleibt immer. Kommende Tage sind eine Vorschau.</div>`;
  main.innerHTML = h;
}

/* ---------- Antippen ---------- */
function sheet(title, body, btns) {
  const wrap = document.createElement("div");
  wrap.className = "sheetwrap";
  wrap.onclick = ev => { if (ev.target === wrap) closeSheet(); };
  wrap.innerHTML = `<div class="sheet"><h4>${title}</h4>${body}${btns}<button class="cancel" onclick="closeSheet()">Abbrechen</button></div>`;
  document.body.appendChild(wrap);
}
function day(k) {
  const t = T();
  if (RANGE) {                                                // Zeitraum wählen: erster, dann letzter Tag
    if (k < t) return;
    if (!RANGE.s) { RANGE.s = k; window.render(); return; }
    const s0 = RANGE.s; RANGE = null; window.render(); rangeSheet(s0, k); return;
  }
  const days = planDays(), info = dayInfo(k, doneMap(days), projMap(k)), e = info.e;
  const ttl = `${WD[D(k).getDay()]} ${esc(fmtDay(D(k)))}`;
  if (info.tw) { location.hash = "#tp/" + k; return; }        // Taper-/Renntag: direkt die Einheit
  if (info.aw) {
    const a = info.aw;
    sheet(ttl, `<p>${esc(a.n)} · ${esc(span(a.s, a.e))} · ${esc(FOKUS.awayRule(between(a.s, a.e) + 1))}</p>`,
      `<button onclick="KAL.rangeSheet('${a.s}','${a.e}')">Ändern<small>Name ändern.</small></button><button onclick="FOKUS.delAway('${a.id}')">Zeitraum aufheben<small>Alle ${between(a.s, a.e) + 1} Tage sind wieder Trainingstage.</small></button>`);
    return;
  }
  if (k >= t && e && e.kind === "train") { planSheet(k, true); return; }
  const look = info.units.map(u => `<button onclick="closeSheet();location.hash='#d/${u.pd.pi}/${u.pd.wi}/${u.pd.di}/${u.si}'">${esc(dayTitle(u.pd))}${slot(u.pd, u.si) ? " · " + esc(slot(u.pd, u.si)) : ""} ansehen<small>${esc(txt(u.pd, u.si))}${u.done ? " · erledigt ✓" : ""}</small></button>`).join("");
  const other = `<button onclick="WOCHE.otherSheet('${k}')">${info.o ? "Anderes Training ändern" : "Anderes Training"}<small>${k < t ? "Nachtragen, was du an dem Tag gemacht hast." : "Fitness, Zirkel, Tanzen, Wettkampf … Der Plan rutscht."}</small></button>`;
  if (k < t) { sheet(ttl, info.units.length || info.o ? "" : `<p>An dem Tag ist nichts eingetragen.</p>`, look + other); return; }
  let btns = look;
  if (info.kind === "off") btns += `<button onclick="planOffToggle('${k}')">Doch, geht<small>Der Tag ist wieder ein Trainingstag.</small></button>`;
  else if (info.kind === "rest") btns += `<button onclick="planForce('${k}')">Trotzdem trainieren<small>${MAX_STREAK} Tage am Stück, danach kommt der Ruhetag später.</small></button>`;
  if (info.kind !== "off" && info.kind !== "other" && !(info.o && info.o.tp)) btns += `<button onclick="planOffToggle('${k}')">Geht nicht<small>Der Tag fällt aus. Passt die Planwoche nicht mehr in 7 Tage, fällt zuerst Support weg.</small></button>`;
  btns += `<button onclick="KAL.rangeStart('${k}')">Mehrere Tage ab hier …<small>Urlaub, Reise: danach den letzten Tag antippen.</small></button>`;
  if (!(info.o && info.o.tp)) btns += other;
  const desc = info.o && info.o.tp ? `<p>Taper vor dem Wettkampf, noch ${info.o.tp.s} ${info.o.tp.s === 1 ? "Tag" : "Tage"}. Ändern über Einstellungen → Wettkämpfe.</p>`
    : info.kind === "rest" ? `<p>Ruhetag: ${MAX_STREAK} Trainingstage am Stück sind genug.</p>`
    : info.kind === "free" ? `<p>Hier steht nichts aus dem Plan an.</p>` : "";
  sheet(ttl, desc, btns);
}
/* Abwesend: Name und Art wählen */
function rangeSheet(s, e) {
  if (!s || !e) return;
  if (e < s) { const x = s; s = e; e = x; }
  closeSheet();
  const cur = (planState().away || []).find(a => a.s === s && a.e === e);
  if (cur && !rangeSheet.keep) RN = cur.n;
  rangeSheet.keep = false;
  const n = between(s, e) + 1;
  const names = ["Urlaub", "Reise", "Familie", "Krank"].concat((planState().away || []).map(a => a.n), [RN]).filter((x, i, a) => x && a.indexOf(x) === i);
  const wrap = document.createElement("div");
  wrap.className = "sheetwrap";
  wrap.onclick = ev => { if (ev.target === wrap) closeSheet(); };
  wrap.innerHTML = `<div class="sheet wsheet">
    <h4>Abwesend · ${esc(span(s, e))} · ${n} ${n === 1 ? "Tag" : "Tage"}</h4>
    <div class="wch">${names.map(x => `<button class="${RN === x ? "on" : ""}" onclick="KAL.rn(this.textContent,'${s}','${e}')">${esc(x)}</button>`).join("")}<button onclick="KAL.rnNew('${s}','${e}')">＋ neu</button></div>
    <p>${esc(FOKUS.awayRule(n))}</p>
    <button class="wsave" onclick="FOKUS.saveAway('${s}','${e}',KAL.RN())">${esc(RN)} eintragen</button>
    <button class="cancel" onclick="closeSheet()">Abbrechen</button>
  </div>`;
  document.body.appendChild(wrap);
}
window.KAL = {
  render, seg, day, rangeSheet,
  rangeStart: k => { closeSheet(); RANGE = k === false ? null : { s: k || null }; if (location.hash !== "#cal") location.hash = "#cal"; else window.render(); },
  rn: (n, s, e) => { RN = n; rangeSheet.keep = true; rangeSheet(s, e); },
  rnNew: (s, e) => { const n = (prompt("Name") || "").trim(); if (n) { RN = n; } rangeSheet.keep = true; rangeSheet(s, e); },
  RN: () => RN,
  go: n => { OFF += n; window.render(); },
  today: () => { OFF = 0; window.render(); },
  sel: mon => { SEL = SEL === mon ? null : mon; window.render(); },
};
})();
