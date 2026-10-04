/* Rennblock (Part 4) mit Countdown
     S.race       = { name, date }                       Einstellungen → Wettkampf (selbst eingetragen)
     S.plan.race  = { d, at, drop: ["pi.wi.di", …] }     zum Rennblock gewechselt, für das Rennen am Tag d
     S.plan.raceNo = { d, at }                           „Normal weitermachen“: Frage ruht bis 3 Trainingstage nach at
   Part 4 steht im Plan mit opt: "race" und ist nur sichtbar, solange gewechselt ist.
   Die Rennwoche ist an den Renntag gebunden: Tage mit "at" (Tage relativ zum Rennen) stehen fest
   im Kalender, alles andere läuft wie gewohnt davor und endet spätestens am Tag vor der Rennwoche.
   Ab wann gefragt wird, hängt am eigenen Tempo: Abstand der letzten Day-1-Starts (Ø, sonst 10 Tage)
   × Wochen im Rennblock + Rennwoche.                                                              */
(function () {
const T = () => dkey(today0());
const D = k => new Date(k + "T12:00:00");
const between = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const P = () => planState();
const raceDef = () => (S.race && S.race.date ? S.race : null);
const racePi = () => (PROGRAM_ALL || []).findIndex(p => p.opt === "race");
const raceName = () => (raceDef() && raceDef().name) || "Wettkampf";

function active() {
  const r = raceDef(), p = S.plan && S.plan.race;
  return !!(r && p && p.d === r.date && racePi() >= 0);
}
/* Tage einer Planwoche im echten Leben: Ø-Abstand der letzten Day-1-Starts, 7–14, sonst 10 */
function weekLen() {
  const starts = [];
  (PROGRAM_ALL || []).forEach(p => { if (p.opt) return; p.weeks.forEach(w => {
    const ts = w.days[0].sessions.flatMap(s => s.items).map(i => S.checked[i.id]).filter(x => typeof x === "string").sort();
    if (ts.length) starts.push(dkey(new Date(ts[0])));
  }); });
  starts.sort();
  const l = starts.slice(-4);
  if (l.length < 2) return 10;
  return Math.min(14, Math.max(7, Math.round(between(l[0], l[l.length - 1]) / (l.length - 1))));
}
function shape() {
  const part = (PROGRAM_ALL || [])[racePi()];
  if (!part) return null;
  const fixed = [].concat(...part.weeks.map(w => w.days.filter(d => d.at != null)));
  const build = part.weeks.filter(w => !w.days.some(d => d.at != null)).length;
  const minAt = Math.min(0, ...fixed.map(d => d.at));
  return { build, minAt };
}
function leadDays() { const s = shape(); return s ? s.build * weekLen() + (-s.minAt) + 1 : 0; }
function startBy() { const r = raceDef(); return r ? dkey(addDays(D(r.date), -leadDays())) : null; }
/* Kalendertag → fester Rennwochen-Tag (für projectPlan) */
function fixedDays() {
  if (!active()) return null;
  const r = D(raceDef().date), out = {};
  planDays().forEach(pd => { if (pd.day.at != null && !dayDone(pd)) out[dkey(addDays(r, pd.day.at))] = pd; });
  return out;
}
function weekStart() { const s = shape(); return active() && s ? dkey(addDays(D(raceDef().date), s.minAt)) : null; }

const REMIND = 3;   // „Normal weitermachen“ → nach so vielen Trainingstagen nochmal fragen
function snoozed(r) {
  const no = P().raceNo;
  if (!no || no.d !== r.date) return false;
  return [...trainedDayKeys()].filter(k => k > no.at).length < REMIND;
}
function card() {
  const r = raceDef();
  if (!r || active() || racePi() < 0 || snoozed(r)) return "";
  const left = between(T(), r.date);
  if (left < 0) return "";
  const q = planQueue(), lead = leadDays();
  if (left > lead && q.length) return "";
  const wl = weekLen(), head = q[0];
  const tight = left < lead ? `\nEs wird knapp: Was aus Woche 1–3 nicht mehr passt, entfällt. Die Rennwoche hat Vorrang.` : "";
  return `<div class="today nw race">
    <div class="k">Rennblock starten?</div>
    <div class="v">${esc(raceName())} in ${left} Tagen</div>
    <div class="s">Part 4: 3 Wochen Rennblock aus der HYROX Master Class, dann die Rennwoche bis zum Renntag. Bei deinem Tempo (etwa ${wl} Tage pro Planwoche) braucht das rund ${lead} Tage.${q.length ? `\n${q.length} offene Tage ab ${esc(head.part.name + " · " + head.week.name)} werden dafür übersprungen.` : ""}${tight}</div>
    <button class="cta" onclick="RENNEN.start()">Zum Rennblock (Part 4) wechseln</button>
    <button class="cta ghost" onclick="RENNEN.later()">Normal weitermachen · in 3 Trainings nochmal fragen</button>
  </div>`;
}
function start() {
  const r = raceDef(); if (!r) return;
  const p = P(), drop = planQueue().map(d => d.key).filter(k => p.dropped.indexOf(k) < 0);
  drop.forEach(k => p.dropped.push(k));
  p.race = { d: r.date, at: T(), drop };
  delete p.raceNo;
  markDirty(); finishBoot();
}
function stop() {
  const p = P(), drop = (p.race && p.race.drop) || [];
  p.dropped = p.dropped.filter(k => drop.indexOf(k) < 0);
  delete p.race;
  markDirty(); finishBoot();
}
function later() { const r = raceDef(); if (!r) return; P().raceNo = { d: r.date, at: T() }; markDirty(); render(); }
function setRace(field, v) {
  S.race = Object.assign({}, S.race || {});
  v = String(v || "").trim();
  if (v) S.race[field] = v; else delete S.race[field];
  if (!S.race.date) { if (S.plan && S.plan.race) stop(); S.race = S.race.name ? S.race : null; }
  markDirty(); renderSettingsAll();
}
function settings() {
  if (racePi() < 0) return "";
  const r = S.race || {}, on = active();
  let st = "";
  if (on) st = `<p class="hint">Rennblock läuft seit dem ${fmtDM(S.plan.race.at)} · Rennwoche ab ${fmtDM(weekStart())}</p>
      <button class="cta ghost" onclick="if(confirm('Rennblock beenden? Part 4 verschwindet, die übersprungenen Tage aus Part 1–3 sind wieder offen.'))RENNEN.stop()">Rennblock beenden</button>`;
  else if (r.date && between(T(), r.date) >= 0) st = `<p class="hint">Gefragt wird ab ${fmtDM(startBy())}, also ${leadDays()} Tage vorher (bei etwa ${weekLen()} Tagen pro Planwoche).</p>
      <button class="cta ghost" onclick="RENNEN.start()">Jetzt zum Rennblock wechseln</button>`;
  return `<details class="setsec">
    <summary><svg class="secic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>Wettkampf</summary>
    <div class="secbody">
      <p class="hint">Mit eingetragenem Wettkampf bietet die App rechtzeitig den Rennblock an (Part 4): 3 Wochen aus der HYROX Master Class, dann die Rennwoche, die am Renntag endet.</p>
      <div class="rmgrid">
        <div class="rmcell"><span>Name</span><input type="text" value="${esc(r.name || "")}" placeholder="HYROX Frankfurt" onchange="RENNEN.setRace('name', this.value)"></div>
        <div class="rmcell"><span>Datum</span><input type="date" value="${esc(r.date || "")}" onchange="RENNEN.setRace('date', this.value)"></div>
      </div>
      ${st}
    </div>
  </details>`;
}
window.RENNEN = { active, card, start, stop, later, setRace, settings, fixedDays, weekStart, leadDays, weekLen };
})();
