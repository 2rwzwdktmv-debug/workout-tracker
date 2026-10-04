/* Lauf-Fortschritt
   Läufe bekommen statt des freien Textfelds feste Felder. Gespeichert wird weiter
   ein Text in results/resultsByItem — alte Einträge bleiben lesbar.
     Dauerlauf:  "1:25:06 · 14,07 km · HF 158"
     Tempo:      "1720 m @ 165 · 1700 m @ 168"
   Vergleichszahl Dauerlauf: Meter pro Herzschlag = (m/min) / Ø-HF, nur innerhalb
   der Gruppe (locker = HF-Deckel 142, lang = Long Runs + HF 155–160).
   Vergleichszahl Tempo: Ø-Meter je 8-min-Intervall (die Anzahl wechselt).
   Tests: Bestwert wie beim 1RM.
     Road Test:  "6,51 km"        Meile: "6:58" (alt: "Pace 4:20" = min/km)
     1000 m:     "4:02 · 3:59 · 4:05"                                          */
(function () {
const DAUER = ["endurance-run", "long-run"];
const TEMPO = "tempo-8min";
const TEMPO_MIN = 8;
const TESTS = { "road-test-30min": "road", "mile-tt": "mile", "intervals-1000m": "k1000" };
const TKEY = { road: "road-test-30min", mile: "mile-tt", k1000: "intervals-1000m" };
const isTest = g => !!TKEY[g];
const MILE = 1.609344;
const GNAME = { locker: "Lockere Läufe", lang: "Lange Läufe", tempo: "8-min-Intervalle",
                road: "Road Test 30 min", mile: "Meilen-Test", k1000: "1000-m-Intervalle" };
const TWAS = {
  road: "Maximale Strecke in 30 Minuten – der 1RM fürs Laufen.",
  mile: "Zeit für eine Meile (1,61 km) bei etwa 90 %.",
  k1000: "Ø-Zeit je 1000 m. Gleichmäßig zählt mit: der letzte so schnell wie der erste.",
};
const GWER = {
  locker: "Verglichen wird nur mit anderen lockeren Läufen (HF max. 142).",
  lang: "Verglichen wird nur mit Long Runs und den Läufen mit HF 155–160.",
};

function group(id) {
  const it = ITEM_INDEX[id];
  if (!it) return null;
  if (it.key === TEMPO) return "tempo";
  if (TESTS[it.key]) return TESTS[it.key];
  if (it.key === "long-run") return "lang";
  if (it.key === "endurance-run") return /155/.test(it.own || "") ? "lang" : "locker";
  return null;
}
const dec = (v, n) => v.toFixed(n).replace(".", ",");
const num = s => { const v = parseFloat(String(s || "").trim().replace(",", ".")); return isFinite(v) ? v : null; };
const thou = m => Math.round(m).toLocaleString("de-DE");
const dShort = iso => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

/* "1:25:06" → 85,1 min · "52:30" → 52,5 · "1:25" → 85 (unter 4 vorne = Stunden) · "52" → 52 */
function parseTime(s) {
  s = String(s || "").trim();
  if (!s) return null;
  const p = s.split(":").map(x => parseFloat(x.replace(",", ".")));
  if (p.some(x => !isFinite(x))) return null;
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2) return p[0] < 4 ? p[0] * 60 + p[1] : p[0] + p[1] / 60;
  return p[0];
}
function fmtPace(minPerKm) {
  let m = Math.floor(minPerKm), s = Math.round((minPerKm - m) * 60);
  if (s === 60) { m++; s = 0; }
  return m + ":" + String(s).padStart(2, "0");
}

/* Dauerlauf-Text → {ts, t, km, hf}. Liest auch den alten Freitext "1:25:06 | 14,07 | 158 | 6:03". */
function parseD(v) {
  const r = { ts: "", t: null, km: null, hf: null };
  String(v || "").split(/[|·]/).map(x => x.trim()).filter(Boolean).forEach(tok => {
    if (/hf/i.test(tok)) { r.hf = parseInt(tok.replace(/\D/g, ""), 10) || null; return; }
    if (tok.indexOf(":") >= 0) { if (!r.ts) { r.ts = tok; r.t = parseTime(tok); } return; }   // zweite Zeitangabe = Pace
    if (/km|[.,]\d/.test(tok)) { if (r.km == null) r.km = num(tok.replace(/km/i, "")); return; }
    const n = parseInt(tok, 10);
    if (n >= 80 && n <= 220 && r.hf == null) r.hf = n;
  });
  return r;
}
function mps(p) { return p.t && p.km && p.hf ? (p.km * 1000 / p.t) / p.hf : null; }

/* Tempo-Text → [{m, hf}] */
function parseT(v) {
  return String(v || "").split("·").map(x => x.trim()).filter(Boolean).map(tok => {
    const m = tok.match(/^([\d.]+)\s*m?\s*(?:@\s*(\d+))?/);
    return m ? { m: parseFloat(m[1].replace(/\./g, "")), hf: m[2] ? parseInt(m[2], 10) : null } : null;
  }).filter(x => x && x.m > 0);
}
function tempoSum(rows) {
  if (!rows.length) return null;
  const avg = rows.reduce((a, r) => a + r.m, 0) / rows.length;
  const hfs = rows.filter(r => r.hf);
  return { n: rows.length, avg, pace: TEMPO_MIN / (avg / 1000),
           hf: hfs.length ? Math.round(hfs.reduce((a, r) => a + r.hf, 0) / hfs.length) : null };
}

/* "4:20" → 4,33 min (immer m:ss, nie h:mm) */
function mmss(s) {
  const p = String(s || "").trim().split(":").map(x => parseFloat(x.replace(",", ".")));
  if (!p.length || p.some(x => !isFinite(x))) return null;
  return p.length === 2 ? p[0] + p[1] / 60 : p.length === 1 ? p[0] : null;
}
/* Test-Text → {val, …}; val ist die Vergleichszahl (Road: km, mehr = besser; Meile/1000 m: min, weniger = besser) */
function parseX(g, v) {
  v = String(v || "").trim();
  if (!v) return null;
  if (g === "road") { const km = num(v.replace(/km/i, "")); return km ? { val: km, km } : null; }
  if (g === "mile") {
    const t = /pace/i.test(v) ? (mmss(v.replace(/pace/i, "")) || 0) * MILE : mmss(v);
    return t ? { val: t, t } : null;
  }
  const ts = v.split("·").map(mmss).filter(x => x > 0);
  return ts.length ? { val: ts.reduce((a, b) => a + b, 0) / ts.length, ts } : null;
}
const lowerBetter = g => g !== "road";
function fmtX(g, v) { return g === "road" ? dec(v, 2) + " km" : g === "mile" ? fmtPace(v) : fmtPace(v) + "/km"; }
const TCOL = { road: "blue", mile: "yellow", k1000: "teal" };
function fmtXu(g, v) {
  return g === "road" ? dec(v, 2) + `<span class="u">KM</span>` : g === "mile" ? fmtPace(v) : fmtPace(v) + `<span class="u">/KM</span>`;
}
function detailX(g, x) {
  return g === "road" ? fmtPace(30 / x.km) + "/km" : g === "mile" ? fmtPace(x.t / MILE) + "/km" : x.ts.length + " ×";
}

/* Alle Einträge einer Gruppe, alt → neu, mit Vergleichszahl */
function entries(g) {
  const keys = g === "tempo" ? [TEMPO] : isTest(g) ? [TKEY[g]] : DAUER;
  const out = [];
  keys.forEach(k => (S.results[k] || []).forEach(e => {
    if (group(e.itemId) !== g) return;
    if (isTest(g)) { const x = parseX(g, e.value); if (x) out.push({ e, x, val: x.val }); }
    else if (g === "tempo") { const s = tempoSum(parseT(e.value)); if (s) out.push({ e, s, val: s.avg }); }
    else { const p = parseD(e.value), v = mps(p); if (v) out.push({ e, p, val: v }); }
  }));
  return out.sort((a, b) => a.e.date < b.e.date ? -1 : 1);
}
function mine(item) {
  return (S.results[item.key] || []).find(x => x.itemId === item.id && (x.run || 1) === (S.run || 1));
}
/* Alles, was VOR diesem Lauf liegt (beim Nachtragen zählt das Datum, nicht die Reihenfolge) */
function before(item, g) {
  const own = mine(item);
  return entries(g).filter(x => x.e !== own && (!own || x.e.date < own.date));
}
function arrow(cur, ref, tol) {
  if (cur > ref * (1 + tol)) return `<span class="up">↑</span>`;
  if (cur < ref * (1 - tol)) return `<span class="dn">↓</span>`;
  return `<span class="dn">=</span>`;
}

/* ---------- Zeile unter den Feldern ---------- */
function lineD(item) {
  const g = group(item.id), p = parseD(S.resultsByItem[item.id]), v = mps(p);
  const prev = before(item, g), ref = prev.slice(-3);
  const avg = ref.length ? ref.reduce((a, x) => a + x.val, 0) / ref.length : null;
  const refTxt = ref.length === 1 ? "vorher" : "vorher Ø";
  let html = "";
  if (v) {
    html = `<span class="teal">${fmtPace(p.t / p.km)}/km</span> · <b>${dec(v, 2)} m/Schlag</b>`
      + (avg ? ` ${arrow(v, avg, 0.005)} <span class="ref">${refTxt} ${dec(avg, 2)}</span>` : "");
  } else if (p.t && p.km) {
    html = `${fmtPace(p.t / p.km)}/km · <span class="ref">Ø-HF fehlt für den Vergleich</span>`;
  } else if (avg) {
    html = `<span class="ref">${GNAME[g]} bisher${ref.length > 1 ? " Ø" : ""}</span> <b>${dec(avg, 2)} m/Schlag</b>`;
  }
  return html ? `<button class="ls" id="ls-${item.id}" onclick="LAUF.sheet('${g}')">${html}<span class="chev">›</span></button>`
              : `<div id="ls-${item.id}"></div>`;
}
function lineT(item) {
  const s = tempoSum(parseT(S.resultsByItem[item.id]));
  const last = before(item, "tempo").slice(-1)[0];
  let html = "";
  if (s) {
    html = `<b class="blue">Ø ${thou(s.avg)} m</b> · <span class="teal">${fmtPace(s.pace)}/km</span>${s.hf ? ` · HF ${s.hf}` : ""}`;
    if (last) {
      const d = Math.round(s.avg - last.val);
      html += ` ${arrow(s.avg, last.val, 0.002)} <span class="ref">${d > 0 ? "+" : ""}${d} m</span>`;
    }
  } else if (last) {
    html = `<span class="ref">zuletzt</span> <b>Ø ${thou(last.val)} m</b> · ${fmtPace(last.s.pace)}/km`;
  }
  return html ? `<button class="ls" id="ls-${item.id}" onclick="LAUF.sheet('tempo')">${html}<span class="chev">›</span></button>`
              : `<div id="ls-${item.id}"></div>`;
}

function lineX(item) {
  const g = group(item.id), cur = parseX(g, S.resultsByItem[item.id]), lb = lowerBetter(g);
  const prev = before(item, g);
  const best = prev.reduce((b, x) => !b || (lb ? x.val < b.val : x.val > b.val) ? x : b, null);
  let html = "";
  if (cur) {
    html = `<b>${g === "k1000" ? "Ø " : ""}${fmtX(g, cur.val)}</b> · ${detailX(g, cur)}`;
    if (best) {
      const better = lb ? cur.val < best.val - 1e-6 : cur.val > best.val + 1e-6;
      html += better ? ` <span class="up">↑</span> <span class="ref">Bestwert bisher ${fmtX(g, best.val)}</span>`
                     : ` <span class="ref">Bestwert ${fmtX(g, best.val)}</span>`;
    }
  } else if (best) {
    html = `<span class="ref">Bestwert</span> <b>${fmtX(g, best.val)}</b> · <span class="ref">${dShort(best.e.date)}</span>`;
  }
  return html ? `<button class="ls" id="ls-${item.id}" onclick="LAUF.sheet('${g}')">${html}<span class="chev">›</span></button>`
              : `<div id="ls-${item.id}"></div>`;
}
function lineFor(item) {
  const g = group(item.id);
  return g === "tempo" ? lineT(item) : isTest(g) ? lineX(item) : lineD(item);
}

/* ---------- Felder ---------- */
function fieldsX(item) {
  const g = group(item.id), id = item.id, x = parseX(g, S.resultsByItem[item.id]);
  if (g === "road") return `<div class="lf"><label>km<input id="xr-${id}" inputmode="decimal" placeholder="6,50"
      value="${x ? dec(x.km, 2) : ""}" onchange="LAUF.saveX('${id}')"></label></div>`;
  if (g === "mile") return `<div class="lf"><label>Zeit<input id="xm-${id}" inputmode="numeric" placeholder="6:50"
      value="${x ? fmtPace(x.t) : ""}" onchange="LAUF.saveX('${id}')"></label></div>`;
  const n = parseInt((String(item.sub || "").match(/(\d+)\s*[×x]/) || [])[1], 10) || 6;
  let h = `<div class="kh">Zeit je 1000 m</div><div class="kf">`;
  for (let i = 0; i < n; i++) h += `<label>${i + 1}<input id="xk-${id}-${i}" inputmode="numeric"
      value="${x && x.ts[i] ? fmtPace(x.ts[i]) : ""}" onchange="LAUF.saveX('${id}')"></label>`;
  return h + `</div>`;
}
function fieldsD(item) {
  const p = parseD(S.resultsByItem[item.id]), id = item.id;
  const on = `onchange="LAUF.saveD('${id}')"`;
  return `<div class="lf">
    <label>Zeit<input id="lt-${id}" inputmode="numeric" placeholder="1:05:00" value="${esc(p.ts)}" ${on}></label>
    <label>km<input id="lk-${id}" inputmode="decimal" placeholder="10,2" value="${p.km != null ? esc(dec(p.km, 2)) : ""}" ${on}></label>
    <label>Ø-HF<input id="lh-${id}" inputmode="numeric" placeholder="140" value="${p.hf || ""}" ${on}></label>
  </div>`;
}
function rowT(id, i, r) {
  return `<div class="tr"><span class="nr">${i + 1}</span>
    <input id="tm-${id}-${i}" inputmode="numeric" value="${r && r.m ? r.m : ""}" onchange="LAUF.saveT('${id}')">
    <input id="th-${id}-${i}" inputmode="numeric" value="${r && r.hf ? r.hf : ""}" onchange="LAUF.saveT('${id}')"></div>`;
}
const T_MAX = 4;
function fieldsT(item) {
  const rows = parseT(S.resultsByItem[item.id]);
  const n = Math.min(T_MAX, Math.max(2, rows.length + 1));   // immer eine leere Zeile mehr, bis 4
  let h = `<div class="tf" id="tf-${item.id}"><div class="tr th"><span></span><span>Meter in 8 min</span><span>Ø-HF</span></div>`;
  for (let i = 0; i < n; i++) h += rowT(item.id, i, rows[i]);
  return h + `</div>`;
}

/* ---------- Speichern: ohne Neuaufbau, damit der Fokus im nächsten Feld bleibt ---------- */
function commit(id, value) {
  const item = ITEM_INDEX[id];
  setResult(id, item.key, value, true);
  const e = mine(item);
  if (e && typeof S.checked[id] === "string" && e.date !== S.checked[id]) { e.date = S.checked[id]; markDirty(); }   // Nachtragen: Datum der Einheit
  const el = document.getElementById("ls-" + id);
  if (el) el.outerHTML = lineFor(item);
}
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
const LAUF = window.LAUF = {
  handles: item => !!group(item.id),
  render(item) {
    const g = group(item.id);
    return `<div class="res lauf">${g === "tempo" ? fieldsT(item) : isTest(g) ? fieldsX(item) : fieldsD(item)}${lineFor(item)}</div>`;
  },
  saveX(id) {
    const g = group(id);
    let v = "";
    if (g === "road") { const km = num(val("xr-" + id)); v = km ? dec(km, 2) + " km" : ""; }
    else if (g === "mile") { const t = mmss(val("xm-" + id)); v = t ? fmtPace(t) : ""; }
    else {
      const ts = [];
      for (let i = 0; document.getElementById(`xk-${id}-${i}`); i++) { const t = mmss(val(`xk-${id}-${i}`)); if (t) ts.push(fmtPace(t)); }
      v = ts.join(" · ");
    }
    commit(id, v);
  },
  saveD(id) {
    const ts = val("lt-" + id), km = num(val("lk-" + id)), hf = parseInt(val("lh-" + id), 10);
    const parts = [];
    if (ts) parts.push(ts);
    if (km != null) parts.push(dec(km, 2) + " km");
    if (hf) parts.push("HF " + hf);
    commit(id, parts.join(" · "));
  },
  saveT(id) {
    const rows = [];
    for (let i = 0; i < T_MAX; i++) {
      const m = parseInt(val(`tm-${id}-${i}`).replace(/\./g, ""), 10), hf = parseInt(val(`th-${id}-${i}`), 10);
      if (m > 0) rows.push(m + " m" + (hf ? " @ " + hf : ""));
    }
    commit(id, rows.join(" · "));
    const box = document.getElementById("tf-" + id), have = box ? box.querySelectorAll(".tr:not(.th)").length : 0;
    if (box && rows.length >= have && have < T_MAX) box.insertAdjacentHTML("beforeend", rowT(id, have, null));
  },
  sheet(g) {
    const list = entries(g), last = list.slice(-8).reverse();
    const fmtV = x => g === "tempo" ? thou(x.val) + " m" : isTest(g) ? fmtX(g, x.val) : dec(x.val, 2);
    const rows = last.map(x => isTest(g)
      ? `<div class="lr"><span>${dShort(x.e.date)}</span><span>${detailX(g, x.x)}</span><span></span><b>${fmtV(x)}</b></div>`
      : g === "tempo"
      ? `<div class="lr"><span>${dShort(x.e.date)}</span><span>${x.s.n} × · ${fmtPace(x.s.pace)}/km</span><span>${x.s.hf ? "HF " + x.s.hf : ""}</span><b>${fmtV(x)}</b></div>`
      : `<div class="lr"><span>${dShort(x.e.date)}</span><span>${dec(x.p.km, 1)} km · ${fmtPace(x.p.t / x.p.km)}/km</span><span>HF ${x.p.hf}</span><b>${fmtV(x)}</b></div>`).join("");
    const what = isTest(g) ? TWAS[g] : g === "tempo"
      ? "Verglichen wird die Ø-Strecke pro Intervall, nicht die Summe – die Zahl der Intervalle wechselt. Mehr Meter bei gleichem Gefühl heißt: schneller geworden."
      : `Tempo geteilt durch Ø-HF: wie viel Strecke du pro Herzschlag schaffst. Steigt die Zahl, bist du ausdauernder geworden. ${GWER[g]} Einzelne Läufe (Punkte) schwanken mit Hitze, Schlaf und Hügeln – es zählt die Linie, der Schnitt der letzten 3.`;
    const wrap = document.createElement("div");
    wrap.className = "sheetwrap";
    wrap.onclick = ev => { if (ev.target === wrap) closeSheet(); };
    wrap.innerHTML = `<div class="sheet lsheet">
      <h4>${GNAME[g]}${g === "locker" || g === "lang" ? " · Meter pro Herzschlag" : ""}</h4>
      <p>${what}</p>
      ${list.length >= 2 && !isTest(g) ? spark(list) : ""}
      ${rows ? `<div class="ll">${rows}</div>` : `<p>Noch keine Einträge.</p>`}
      <button class="cancel" onclick="closeSheet()">Schließen</button>
    </div>`;
    document.body.appendChild(wrap);
  },
};

/* ---------- Analyse: Abschnitt „Laufen“ ---------- */
const roll = vs => vs.map((_, i) => { const w = vs.slice(Math.max(0, i - 2), i + 1); return w.reduce((a, b) => a + b, 0) / w.length; });
function niceStep(range, ticks) {
  const raw = range / ticks, p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw);
}
/* X = Datum (Lücken bleiben sichtbar), Punkte = Läufe, Linie = Schnitt der letzten 3 */
function chartAx(list, fmtTick) {
  if (list.length < 2) return `<div class="sparkempty">noch zu wenig Daten</div>`;
  const W = 320, H = 150, L = 38, R = 10, T = 12, B = 22;
  const vs = list.map(x => x.val), av = roll(vs);
  const lo0 = Math.min(...vs), hi0 = Math.max(...vs);
  const st = niceStep((hi0 - lo0) || Math.abs(hi0) * 0.05 || 1, 4);
  let lo = Math.floor(lo0 / st) * st, hi = Math.ceil(hi0 / st) * st;
  if (hi - lo < st) hi = lo + st;
  const ts = list.map(x => Date.parse(x.e.date)), t0 = ts[0], t1 = ts[ts.length - 1];
  const X = t => L + (t - t0) * (W - L - R) / ((t1 - t0) || 1);
  const Y = v => T + (hi - v) * (H - T - B) / (hi - lo);
  let g = "";
  for (let v = lo; v <= hi + st / 2; v += st) {
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`
      + `<text x="${L - 5}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${fmtTick(v)}</text>`;
  }
  let lastX = Infinity;
  for (let i = list.length - 1; i >= 0; i--) {
    const xi = X(ts[i]);
    if (lastX - xi < 42 && i !== list.length - 1) continue;
    g += `<text x="${xi.toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === list.length - 1 ? "end" : "middle"}" font-size="10" fill="var(--muted)">${dShort(list[i].e.date)}</text>`;
    lastX = xi;
  }
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Verlauf">
    ${g}
    <polyline points="${av.map((v, i) => X(ts[i]).toFixed(1) + "," + Y(v).toFixed(1)).join(" ")}" fill="none" stroke="var(--lime)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${vs.map((v, i) => `<circle cx="${X(ts[i]).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="var(--muted)"/>`).join("")}
  </svg>`;
}
function statCard(g, title, fmtBig, fmtTick, cls) {
  const list = entries(g);
  if (!list.length) return "";
  const vs = list.map(x => x.val), n = vs.length;
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const cur = mean(vs.slice(-3));
  let chip = "";
  if (n >= 4) {
    const d = (cur / mean(vs.slice(0, 3)) - 1) * 100, r = Math.round(d);
    // Läufe schwanken um ±5 % — unter 3 % ist es kein Trend, also grau statt rot/grün
    chip = `<span class="chip ${Math.abs(d) < 3 ? "flat" : d > 0 ? "up" : "down"}">${r === 0 ? "±0" : (r > 0 ? "+" : "−") + Math.abs(r)} % seit Start</span>`;
  }
  return `<div class="chartcard lstat ${cls || ""}" onclick="LAUF.sheet('${g}')"><h3>${title}</h3>
    <div class="lhd"><div><div class="lv ${cls || ""}">${fmtBig(cur)}</div>
      <div class="lsub">Ø der letzten ${Math.min(3, n)} · ${n} ${g === "tempo" ? "Einheiten" : "Läufe"}</div></div>${chip}</div>
    ${chartAx(list, fmtTick)}</div>`;
}
function testCard() {
  const rows = ["road", "mile", "k1000"].map(g => {
    const list = entries(g);
    if (!list.length) return `<div class="ts"><span>${GNAME[g]}</span><span class="ref">—</span></div>`;
    const lb = lowerBetter(g), best = list.reduce((b, x) => (lb ? x.val < b.val : x.val > b.val) ? x : b);
    return `<div class="ts" onclick="LAUF.sheet('${g}')"><span>${GNAME[g]}</span><span><span class="${TCOL[g]}">${fmtXu(g, best.val)}</span> <span class="ref">· ${dShort(best.e.date)}</span></span></div>`;
  }).join("");
  return `<div class="chartcard lstat"><h3>Tests · Bestwerte</h3>${rows}</div>`;
}
LAUF.stats = function () {
  const mps = v => dec(v, 2) + `<span class="u">M/SCHLAG</span>`;
  const cards = statCard("locker", "Lockere Läufe", mps, v => dec(v, 2), "teal")
    + statCard("lang", "Lange Läufe", mps, v => dec(v, 2), "teal")
    + statCard("tempo", "8-min-Intervalle · je Intervall", v => thou(v) + `<span class="u">M</span>`, v => thou(v), "blue");
  return `<h2 class="section">Laufentwicklung · <em>Ausdauer</em></h2>${cards}${testCard()}`;
};

/* Punkte = einzelne Läufe, Linie = Schnitt der letzten 3 */
function spark(list) {
  const W = 300, H = 74, P = 8, vs = list.map(x => x.val);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const X = i => P + (list.length === 1 ? 0 : i * (W - 2 * P) / (list.length - 1));
  const Y = v => H - P - (v - lo) * (H - 2 * P) / (hi - lo);
  const avg = vs.map((_, i) => { const w = vs.slice(Math.max(0, i - 2), i + 1); return w.reduce((a, b) => a + b, 0) / w.length; });
  return `<svg class="lspark" viewBox="0 0 ${W} ${H}">
    <polyline points="${avg.map((v, i) => X(i) + "," + Y(v)).join(" ")}" fill="none" stroke="var(--lime)" stroke-width="2"/>
    ${vs.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="var(--muted)"/>`).join("")}
  </svg>`;
}
})();
