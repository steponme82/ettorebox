// SPDX-License-Identifier: GPL-3.0-only
// ettorebox web editor: LIVE, the first page of the phone's Sound section (edphone.js), swiped to as a block's page is.
// What plays now, big enough to read from a stand: the scene and the tempo (the preset's number and name are the header's,
// above every page), each block on or off with its model, what the expression pedal moves, and the four buttons of the foot
// controller linked to the pedal (an M-VAVE Chocolate in its CC mode, A to D): what a press does and what a hold does. A
// pedal that learns no controls shows the blocks only. It follows the pedal: its STATE pushes, and MIDI_IN (what the
// controller sends the pedal) lights the button just pressed and moves the expression pedal's line. A button's tile, or
// the pedal's, opens what it does, changed on the pedal at once: in this preset only (its own controls, PL) or in every
// preset (MAP). A button's number is named by pressing it once, kept in this browser (until then: the numbers the pedal
// has learned for switches, lowest first). docs/pxmidi.js has the rules (switchJobs, expJob), edmidi.js the tables.

import { app, h, fill, on, blk, typeOf, slotName, say } from "./edcore.js";
import { scenesNow, sceneShort } from "./edscenes.js";
import { learnTables, writeMap, writePl, forgetPl, DOWNGRADE } from "./edmidi.js";
import { pedalTarget, pedalLearn, pedalForget, presetEntry, switchJobs, entryTgt, expJob, switchMode,
  MAP_HOLD, MAP_PRESS, MAP_EACH, MAP_VALUE, PL_DUAL, plKind, dualOk, dualDefault, CC_EXP, SCENES, HOLD_MS, B_SFX } from "./pxmidi.js";

const KEY = "ettorebox-live-v1";
const LETTERS = ["A", "B", "C", "D"];
let named = { feet: [null, null, null, null], exp: null };   // a button: { cc, mom } (mom: momentary, null not known)
let naming = null;              // a button being named: { what (0..3, or "exp"), all (A to D in turn), cc, values, timer }
const downAt = new Map();       // a button's number -> its hold's timer, while it is down
const downs = new Set(), helds = new Set();   // the numbers down now, and held past HOLD_MS (kept across a redraw)
let expPos = -1;                // where the expression pedal was last (0..127; -1 not heard yet)

function loadNamed() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "{}");
    const cc = (v) => Number.isInteger(v) && v >= 0 && v < 126;
    if (Array.isArray(j.feet)) named.feet = [0, 1, 2, 3].map((i) => (j.feet[i] && cc(j.feet[i].cc) ? { cc: j.feet[i].cc, mom: typeof j.feet[i].mom === "boolean" ? j.feet[i].mom : null } : null));
    if (cc(j.exp)) named.exp = j.exp;
  } catch (_) { }
}
function saveNamed() { try { localStorage.setItem(KEY, JSON.stringify(named)); } catch (_) { } }

// ---- which numbers ----
const tables = () => { const { pmap, plist } = learnTables(); return { map: pmap ? pmap.entries : null, pl: plist ? plist.entries : null, pmap, plist }; };
// the expression pedal's number: named, else a pedal the preset has learned (its two-job pedal first), else one learned for
// every preset, else CC 117 (the pedal's own expression number, a Chocolate Plus's jack)
function expCc() {
  if (named.exp !== null) return named.exp;
  const { pl, map } = tables(), feetCc = new Set(named.feet.filter(Boolean).map((f) => f.cc));
  const value = (list) => (list || []).filter((e) => e && plKind(e.mode) === MAP_VALUE && e.src < 126 && !feetCc.has(e.src));
  const own = value(pl), every = value(map), e = own.find((x) => x.mode & PL_DUAL) || own[0] || every[0];
  return e ? e.src : CC_EXP;
}
// the four buttons: { cc, mom, named } or null (not known yet)
function feet() {
  const { pl, map } = tables(), ex = expCc(), taken = new Set(named.feet.filter(Boolean).map((f) => f.cc));
  const guess = [...new Set([...(pl || []), ...(map || [])].filter((e) => e && e.src < 126 && plKind(e.mode) !== MAP_VALUE && e.src !== ex && !taken.has(e.src))
    .map((e) => e.src))].sort((a, b) => a - b);
  return named.feet.map((f) => (f ? { ...f, named: true } : guess.length ? { cc: guess.shift(), mom: null, named: false } : null));
}

// ---- words ----
const scName = (n) => { const s = sceneShort(n); return s === String(n + 1) ? "" : s; };
const scShort = (n) => scName(n) || `SC ${n + 1}`;
const scLong = (n) => `Scene ${n + 1}${scName(n) ? ` (${scName(n)})` : ""}`;
// a target (pxmidi.js entryTgt's) in words: short for a tile, long for a list
function words(t) {
  if (!t) return { short: "—", long: "Nothing" };
  const B = t.b !== undefined ? blk(t.b) : null;
  if (t.kind === "on") return { short: B.label, long: `${B.name} on / off` };
  if (t.kind === "scene") return { short: scShort(t.n), long: scLong(t.n) };
  if (t.kind === "preset") return t.step > 0 ? { short: "NEXT", long: "Next preset" } : { short: "PREV", long: "Previous preset" };
  if (t.kind === "tap") return { short: "TAP", long: "Tap tempo" };
  if (t.kind === "pad") return { short: "PAD", long: "SYN PAD: catch the chord" };
  if (t.kind === "exp") return { short: "EXP", long: "The expression pedal's job (CC 117)" };
  if (t.kind === "master") return { short: "MASTER", long: "MASTER volume" };
  if (t.kind === "type") return { short: `${B.label} TYPE`, long: `${B.name} type` };
  if (t.kind === "param") { const P = typeOf(app.st.preset, t.b).params[t.k]; return { short: `${B.label} ${P ? P.name : ""}`, long: `${B.name} · ${P ? P.name : `setting ${t.k + 1}`}` }; }
  return { short: "?", long: "?" };
}
// lit: a block that is on, the scene playing
function lit(t) {
  if (!t || !app.st) return false;
  if (t.kind === "on") return !!app.st.preset.on[t.b];
  const sc = scenesNow();
  return t.kind === "scene" && !!sc && sc.cur === t.n;
}
// what a press of number cc does when nothing is learned for it: the pedal's own map (t null: nothing)
function fixedWords(cc) {
  const t = pedalTarget(cc);
  if (!t) return { short: "—", long: `nothing (CC ${cc} is none of the pedal's numbers)`, t: null };
  if (t.kind === "on") return { short: blk(t.b).label, long: `${blk(t.b).name} on while the value is 64 or more (a momentary button: only while held)`, t };
  const w = words(entryTgt({ dst: cc }));
  return { short: w.short, long: `${w.long} (CC ${cc}, the pedal's own number)`, t: entryTgt({ dst: cc }) };
}
// a button: what its press and its hold do now, each the preset's own or every preset's (switchJobs); a press with neither,
// the pedal's own number (fixed)
function jobsOf(f) {
  const { pl, map } = tables(), j = switchJobs(f.cc, pl, map);
  const press = j.press ? { t: entryTgt(j.press), e: j.press, own: j.pressOwn } : { ...fixedWords(f.cc), fixed: true };
  return { j, press, hold: j.hold ? { t: entryTgt(j.hold), e: j.hold, own: j.holdOwn } : null };
}
// the expression pedal now: { job, line ("fx" | "vol" | ""), what, sub, note }
function expNow() {
  const { pl, map } = tables(), p = app.st.preset, src = expCc();
  const x = expJob(src, pl, map, (b) => !!p.on[b], (b) => typeOf(p, b).name);
  const T = (b) => typeOf(p, b), P = (b, k) => T(b).params[k];
  // (ettorebox beta 55) a WAH with AUTO OFF set (its "AUTO OFF" setting): heard only while the pedal moves
  const autoOff = (b) => { const k = T(b).name === "WAH" ? T(b).params.findIndex((q) => q.name === "AUTO OFF") : -1; return k >= 0 && p.p[b][k] > 0; };
  const where = x.from === "own" ? "this preset's own" : x.from === "every" ? "learned for every preset" : src === CC_EXP ? "the pedal's own" : "";
  let what = "Nothing", sub = "", line = "", note = "";
  if (x.job === "whammy") { what = `${blk(x.b).label} WHAMMY`; sub = "the WHAMMY that is on: heel the note, toe its SHIFT"; line = "fx"; }
  else if (x.job === "wah") { what = `${blk(x.b).label} ${T(x.b).name}`; sub = "the wah that is on: its sweep, heel to toe"; line = "fx"; if (autoOff(x.b)) note = "AUTO OFF: heard only while the pedal moves"; }
  else if (x.job === "volume") {
    what = "VOLUME"; line = "vol";
    sub = x.dual ? `${blk(x.b).label} is off: ${blk(x.b).label} · ${P(x.b, x.k) ? P(x.b, x.k).name : ""} while it is on` : "no WHAMMY or wah on: heel silent, toe at unity";
  } else if (x.job === "param") {
    what = `${blk(x.b).label} · ${P(x.b, x.k) ? P(x.b, x.k).name : `setting ${x.k + 1}`}`; line = "fx";
    sub = x.dual ? `or VOLUME while ${blk(x.b).label} is off` : x.e && (x.e.lo !== 0 || x.e.hi !== 100) ? `heel ${valText(P(x.b, x.k), x.e.lo)}, toe ${valText(P(x.b, x.k), x.e.hi)}` : "heel to toe, its whole range";
    if (x.b === B_SFX && x.k === 0 && autoOff(x.b) && p.on[x.b]) note = "AUTO OFF: heard only while the pedal moves";
  } else if (x.job === "master") { what = "MASTER volume"; line = "vol"; }
  else if (x.job === "type") { what = `${blk(x.b).label} type`; sub = "its models along the travel"; }
  else if (x.job === "switch") { what = words(x.tgt).long; sub = "a switch's number: on at 64 and up"; }
  else if (x.from === "pedal") sub = `nothing learned for CC ${src}: tap to give it a job`;
  return { x, src, where, what, sub, line, note };
}
const valText = (P, v) => (P && P.texts && P.texts[v]) || String(v);

// ---- the page ----
let page = null;     // { el, parts } of the page shown (built again with the phone's pages)
let key = "";
export function livePage(paints, goTo) {
  const top = h("div", { class: "lv-top" }), blocks = h("div", { class: "lv-blocks", role: "group", "aria-label": "The blocks, on and off" });
  const exp = h("button", { type: "button", class: "lv-exp", onclick: () => openDlg("exp") });
  const feetEl = h("div", { class: "lv-feet", role: "group", "aria-label": "The foot controller's buttons" });
  const nameAll = h("button", { type: "button", class: "btn small lv-nameall", onclick: () => (naming ? stopNaming() : startNaming(0, true)) });
  const say1 = h("p", { class: "lv-say", role: "status" });
  const expH = h("div", { class: "lv-h" }, h("span", { class: "ph-lab", text: "Expression pedal" }));
  const feetH = h("div", { class: "lv-h" }, h("span", { class: "ph-lab", text: "Foot controller" }), h("span", { class: "grow" }), nameAll);
  const el = h("section", { class: "ph-page ph-live", "data-b": "live", "aria-label": "Live: what plays now" },
    top, blocks, expH, exp, feetH, feetEl, say1);
  page = { el, top, blocks, exp, feetEl, nameAll, say1, goTo, ctl: [expH, exp, feetH, feetEl] };
  key = "";
  paints.push(paintLive);
  return el;
}
function liveKey() {
  const st = app.st, p = st.preset, sc = scenesNow(), { pmap, plist } = tables();
  return JSON.stringify([st.slot, p.name, st.dirty, Math.round((st.tempo || 0) * 10), p.on, p.type, p.order, p.p[3], sc && [sc.cur, sc.names],
    pmap && pmap.entries, plist && [plist.slot, plist.entries], named, naming && [naming.what, naming.cc]]);
}
function paintLive() {
  if (!page || !app.st) return;
  const k = liveKey();
  if (k === key) return;
  key = k;
  const st = app.st, p = st.preset, sc = scenesNow(), { pmap } = tables();
  // (the preset's number and name, and EDITED, are the header's, right above on this page too)
  page.el.setAttribute("aria-label", `Live: what plays now in ${slotName(st.slot)} ${p.name}`);
  fill(page.top,
    sc && h("span", { class: "lv-scene", text: `SCENE ${sc.cur + 1}${scName(sc.cur) ? ` · ${scName(sc.cur)}` : ""}` }),
    app.ed && app.ed.hasTempo && st.tempo ? h("span", { class: "lv-tempo", text: `${Math.round(st.tempo * 10) / 10} BPM` }) : null);
  page.top.hidden = !page.top.childNodes.length;
  // a pedal that learns no controls (OpenPocket, ettorebox before its Bluetooth image): no MIDI_IN either, the blocks only
  for (const el of page.ctl) el.hidden = !pmap;
  fill(page.blocks, p.order.map((b) => {
    const B = blk(b), on1 = !!p.on[b], T = typeOf(p, b);
    return h("button", { type: "button", class: `lv-b${on1 ? " on" : ""}`, style: `--c:${B.color}`, "aria-label": `${B.name}, ${T.name}, ${on1 ? "on" : "off"}: its page`,
      onclick: () => page.goTo(b) }, h("b", { text: B.label }), h("small", { text: T.name }));
  }));
  // the expression pedal
  const ex = expNow();
  page.exp.className = `lv-exp${ex.line ? ` ${ex.line}` : ""}`;
  page.exp.setAttribute("aria-label", `Expression pedal, CC ${ex.src}: ${ex.what}. Change it`);
  fill(page.exp,
    h("span", { class: "lv-k" }, h("b", { text: "EXP" }), ` CC ${ex.src}`, ex.where && h("span", { class: "lv-where", text: ex.where })),
    h("span", { class: "lv-what", text: ex.what }),
    ex.sub && h("span", { class: "lv-sub2", text: ex.sub }),
    ex.note && h("span", { class: "lv-note2", text: ex.note }),
    h("i", { class: "lv-pos", "aria-hidden": "true", style: expPos < 0 ? null : `inline-size:${Math.round(expPos * 100 / 127)}%` }));
  // the buttons
  const F = feet();
  fill(page.feetEl, F.map((f, i) => {
    const L = LETTERS[i], nowNaming = naming && naming.what === i;
    if (!f) return h("button", { type: "button", class: `lv-ft none${nowNaming ? " naming" : ""}`, "aria-label": `Button ${L}: not named yet`, onclick: () => openDlg(i) },
      h("span", { class: "lv-l", text: L }), h("span", { class: "lv-p", text: nowNaming ? "Press it…" : "Tap to name" }));
    const { press, hold } = jobsOf(f);
    const pw = press ? (press.fixed ? press : words(press.t)) : { short: "—" };
    const hw = hold ? words(hold.t) : null;
    const pl = press && lit(press.t), hl = hold && lit(hold.t);
    const pc = press && press.t && press.t.b !== undefined ? blk(press.t.b).color : "var(--acc)";
    const hc = hold && hold.t && hold.t.b !== undefined ? blk(hold.t.b).color : "var(--acc)";
    return h("button", { type: "button", class: `lv-ft${nowNaming ? " naming" : ""}${downs.has(f.cc) ? " down" : ""}${helds.has(f.cc) ? " held" : ""}`, "data-cc": f.cc,
      "aria-label": `Button ${L}, CC ${f.cc}: a press, ${press ? (press.fixed ? press.long : words(press.t).long) : "nothing"}; held, ${hw ? hw.long : "nothing"}. Change it`,
      onclick: () => openDlg(i) },
      h("span", { class: "lv-l" }, L, h("small", { text: `CC ${f.cc}${f.named ? "" : "?"}` })),
      h("span", { class: `lv-p${pl ? " lit" : ""}`, style: `--c:${pc}`, text: nowNaming ? "Press it…" : pw.short }),
      f.mom === false ? h("span", { class: "lv-hd no", title: "It latches: no hold", text: "LATCHES" })
        : h("span", { class: `lv-hd${hl ? " lit" : ""}`, style: `--c:${hc}` }, h("small", { text: "HOLD " }), hw ? hw.short : "—"));
  }));
  page.nameAll.textContent = naming && naming.all ? "Stop" : "Name A–D";
  page.say1.textContent = naming ? (naming.what === "exp" ? "Move the expression pedal…" : `Press button ${LETTERS[naming.what]} on the foot controller…`)
    : !pmap ? "This pedal's firmware learns no controls, so a foot controller does what the pedal's own numbers say (ettorebox's Bluetooth image learns them, and this page then shows and changes them)."
    : "Tap a button or the pedal to change what it does.";
  if (dlg && dlg.open) drawDlg();
}

// ---- what the controller sends the pedal: the button just pressed, held; the pedal's position; a button being named ----
const tilesOf = (cc) => document.querySelectorAll(`.lv-ft[data-cc="${cc}"]`);
function heard(m) {
  if (m.type !== "cc") return;
  for (const el of tilesOf(m.cc)) { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }
  if (m.cc === expCc()) {
    expPos = m.value;
    const bar = document.querySelector(".lv-exp .lv-pos");
    if (bar) bar.style.inlineSize = `${Math.round(m.value * 100 / 127)}%`;
  } else if (!named.feet.some((f) => f && f.cc === m.cc && f.mom === false)) {
    // a button down (64 and up), held past HOLD_MS, let go (as the pedal times a hold; MIDI_IN comes at most every 40 ms).
    // Not a button that latches: its 127 stays until the next press
    clearTimeout(downAt.get(m.cc));
    if (m.value >= 64) {
      downs.add(m.cc); helds.delete(m.cc);
      downAt.set(m.cc, setTimeout(() => { helds.add(m.cc); for (const el of tilesOf(m.cc)) el.classList.add("held"); }, HOLD_MS));
    } else {
      downAt.delete(m.cc); downs.delete(m.cc);
      setTimeout(() => { if (!downs.has(m.cc)) { helds.delete(m.cc); for (const el of tilesOf(m.cc)) el.classList.remove("held"); } }, 500);
    }
    for (const el of tilesOf(m.cc)) el.classList.toggle("down", downs.has(m.cc));
  }
  if (naming) nameFrom(m);
}
function startNaming(what, all = false) {
  if (naming) clearTimeout(naming.timer);
  naming = { what, all, cc: null, values: [], timer: 0 };
  status = what === "exp" ? "Move the expression pedal…" : `Press button ${LETTERS[what]} once…`;
  paintLive();
}
function stopNaming() { if (naming) clearTimeout(naming.timer); naming = null; status = ""; paintLive(); }
function nameFrom(m) {
  if (naming.what === "exp") {
    if (m.value <= 0 || m.value >= 127 || named.feet.some((f) => f && f.cc === m.cc)) return;   // (a pedal on its way, not a button)
    named.exp = m.cc;
    saveNamed();
    naming = null;
    status = `The expression pedal is CC ${m.cc}.`;
    paintLive();
    return;
  }
  if (naming.cc === null) {
    if (named.exp !== null && m.cc === named.exp) return;                  // (the pedal moved meanwhile)
    naming.cc = m.cc; naming.values = [m.value];
    naming.timer = setTimeout(nameWindow, 1200);                           // its release in this time: a momentary button
  } else if (m.cc === naming.cc) {
    naming.values.push(m.value);
    if (naming.waiting && m.value < 64) { clearTimeout(naming.timer); namedNow(); }
  }
}
// (as the pedal's own learn) still held when the window ends: its release is waited for, up to 3 s from the press
function nameWindow() {
  const n = naming;
  if (!n) return;
  if (n.values[0] >= 64 && !n.values.slice(1).some((v) => v < 64)) { n.waiting = true; n.timer = setTimeout(namedNow, 1800); return; }
  namedNow();
}
function namedNow() {
  const n = naming;
  if (!n) return;
  clearTimeout(n.timer);
  const mom = switchMode(n.values) === MAP_PRESS;
  named.feet = named.feet.map((f, i) => (i !== n.what && f && f.cc === n.cc ? null : f));   // (a number is one button's)
  named.feet[n.what] = { cc: n.cc, mom };
  if (named.exp === n.cc) named.exp = null;
  saveNamed();
  naming = null;
  status = `${LETTERS[n.what]} is CC ${n.cc}.${mom ? "" : " It sent one message for the press: it latches, so it cannot hold. Set it to momentary (127 when pressed, 0 when let go) and press it again here."}`;
  if (n.all && n.what < 3) { startNaming(n.what + 1, true); status = `${LETTERS[n.what]} is CC ${n.cc}. Now ${LETTERS[n.what + 1]}…`; paintLive(); return; }
  paintLive();
}

// ---- changing what a button or the pedal does, on the pedal at once ----
// dest: where a change made in the dialog is written, this preset's own ("own", PL) or every preset's ("every", MAP); it
// starts where the jobs shown are kept. The pedal looks each kind up apart (switchJobs): a press or a hold of this preset's own
// wins over every preset's, so one written for every preset takes the place of this preset's own of the same kind
let dlg = null, dlgWhat = null, busy = false, status = "", dest = "every";
const canOwn = () => !!tables().plist && !!app.ed && app.ed.hasPresetLearn;
function openDlg(what) {
  if (!app.st) return;
  dlgWhat = what;
  if (!dlg) {
    dlg = h("dialog", { class: "dlg ph-livedlg", "aria-label": "What it does" });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { if (naming && !naming.all) stopNaming(); });
    document.body.append(dlg);
  }
  status = "";
  const f = what === "exp" ? null : feet()[what];
  if (what !== "exp" && !f && tables().pmap) startNaming(what);   // (not known: pressed now, it is named)
  const src = what === "exp" ? expCc() : f && f.cc, { pl, map } = tables();
  const j = src === null || src === undefined ? null : switchJobs(src, pl, map);
  dest = j && (what === "exp" ? j.pressOwn : j.own) && canOwn() ? "own" : "every";
  drawDlg();
  if (!dlg.open) dlg.showModal();
}
// where a job shown comes from, in words: this preset's own, every preset's, or the pedal's own number (nothing learned)
function fromWords(job) {
  if (!job) return "";
  if (job.fixed) return job.t ? `the pedal's own number: ${job.long}` : "";
  return job.own ? "this preset's own" : "every preset's";
}
function drawDlg() {
  if (!dlg || !app.st) return;
  const { pmap } = tables();
  const isExp = dlgWhat === "exp", f = isExp ? null : feet()[dlgWhat];
  const src = isExp ? expCc() : f && f.cc;
  const title = isExp ? "Expression pedal" : `Button ${LETTERS[dlgWhat]}`;
  const head = h("div", { class: "ph-dh" }, h("h2", { text: title }), h("button", { type: "button", class: "btn primary small", text: "Done", onclick: () => dlg.close() }));
  if (!pmap) {
    fill(dlg, head, h("div", { class: "dlg-body" }, h("p", { class: "dim", text: "This pedal's firmware learns no controls (ettorebox's does): the controller does what the pedal's own numbers say." })));
    return;
  }
  const naming1 = naming && naming.what === dlgWhat;
  const numRow = h("div", { class: "sc-row" }, h("span", { text: "Its number" }),
    h("div", { class: "lv-numrow" },
      h("b", { text: src === null || src === undefined ? "not named" : `CC ${src}${!isExp && f && !f.named ? " (guessed)" : ""}` }),
      h("button", { type: "button", class: "btn small", text: naming1 ? "Listening…" : isExp ? "Move it to name it" : `Press ${LETTERS[dlgWhat]} to name it`,
        "aria-pressed": naming1 ? "true" : "false", onclick: () => (naming1 ? stopNaming() : startNaming(dlgWhat)) })));
  const body = h("div", { class: "dlg-body" }, numRow);
  if (src !== null && src !== undefined) {
    if (!canOwn()) dest = "every";
    const cur = `${slotName(app.st.slot)} ${app.st.preset.name}`, pick = (d) => { dest = d; status = ""; drawDlg(); };
    const scope = canOwn() && h("div", { class: "seg lv-scope", role: "radiogroup", "aria-label": "Where a change works" },
      h("button", { type: "button", role: "radio", "aria-checked": dest === "own" ? "true" : "false", disabled: busy, text: `Only in ${cur}`, onclick: () => pick("own") }),
      h("button", { type: "button", role: "radio", "aria-checked": dest === "every" ? "true" : "false", disabled: busy, text: "Every preset", onclick: () => pick("every") }));
    if (scope) body.append(h("div", { class: "sc-row" }, h("span", { text: "A change works" }), scope));
    if (isExp) expRows(body, src); else footRows(body, f);
  }
  add(body,
    !isExp && h("p", { class: "dim small", text: "A hold needs a momentary button: 127 when pressed, 0 when let go (set so in the Chocolate's CC mode; one that latches never holds). With a hold set, a short press acts when the button is let go." }),
    !isExp && dest === "every" && h("p", { class: "dim small", text: DOWNGRADE }),
    isExp && h("p", { class: "dim small", text: "Where the volume acts (at the input, or before the delay): SETTINGS' VOL PEDAL, on the pedal or in the MIDI section." }),
    h("p", { class: `lv-status${/refused|could not|Not changed|keeps/.test(status) ? " err" : ""}`, role: "status", text: busy ? "Writing to the pedal…" : status }));
  fill(dlg, head, body);
}
// children onto an element there, as h() takes them (null, undefined and false left out)
const add = (el, ...kids) => el.append(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
// a button's press and hold, as lists, each with where its job comes from
function footRows(body, f) {
  const { press, hold } = jobsOf(f), hasScenes = !!scenesNow(), tempo = !!(app.ed && app.ed.hasTempo);
  const opts = () => {
    const order = app.st.preset.order;
    return [
      h("option", { value: "none", text: dest === "own" ? "Nothing of its own" : "Nothing" }),
      h("optgroup", { label: "A block on / off" }, order.map((b) => h("option", { value: `on:${b}`, text: `${blk(b).name} on / off` }))),
      hasScenes && h("optgroup", { label: "A scene" }, Array.from({ length: SCENES }, (_, n) => h("option", { value: `scene:${n}`, text: scLong(n) }))),
      h("optgroup", { label: "Presets" }, h("option", { value: "preset:1", text: "Next preset" }), h("option", { value: "preset:-1", text: "Previous preset" })),
      tempo && h("option", { value: "tap", text: "Tap tempo" })];
  };
  const keyOf = (t) => (!t ? "none" : t.kind === "on" ? `on:${t.b}` : t.kind === "scene" ? `scene:${t.n}` : t.kind === "preset" ? `preset:${t.step}` : t.kind === "tap" ? "tap" : "other");
  const row = (label, isHoldRow, cur) => {
    const s = h("select", { "aria-label": `Button ${LETTERS[dlgWhat]} ${isHoldRow ? "held" : "pressed"}`, disabled: busy,
      onchange: () => setJob(f, isHoldRow, s.value === "none" ? null : tgtOf(s.value)) }, opts());
    const k = cur && !cur.fixed ? keyOf(cur.t) : "none";
    if (k === "other") s.prepend(h("option", { value: "other", text: words(cur.t).long, disabled: true }));
    s.value = k;
    const from = fromWords(cur);
    return h("div", { class: "sc-row" }, h("span", { text: label }), h("div", { class: "lv-pick" }, s, from && h("small", { class: "lv-from", text: from })));
  };
  add(body,
    row("A press", false, press),
    row("Held 0.6 s", true, hold),
    f.mom === false && h("p", { class: "lv-warn", text: "This button latches (one message a press): it cannot hold. Set it to momentary on the Chocolate, then name it again." }));
}
function tgtOf(v) {
  const [k, a] = v.split(":");
  if (k === "on") return { kind: "on", b: +a };
  if (k === "scene") return { kind: "scene", n: +a };
  if (k === "preset") return { kind: "preset", step: +a };
  if (k === "tap") return { kind: "tap" };
  if (k === "exp") return { kind: "exp" };
  if (k === "master") return { kind: "master" };
  if (k === "param") { const [, b, kk] = v.split(":"); return { kind: "param", b: +b, k: +kk }; }
  return null;
}
// the expression pedal: what it moves (with where it comes from), its two jobs and its heel and toe (a preset's own only)
function expRows(body, src) {
  const { pl, map } = tables(), j = switchJobs(src, pl, map), e = j.press, p = app.st.preset, own = j.pressOwn;
  const t = e ? entryTgt(e) : null;
  const curKey = !t ? "none" : t.kind === "exp" ? "exp" : t.kind === "master" ? "master" : t.kind === "param" ? `param:${t.b}:${t.k}` : "other";
  const gtUp = (b, k) => blk(b).label === "GT" && k >= 3 && !!(app.ed && app.ed.hasInputPerPreset);   // (set on the pedal, by no controller)
  const fixed = !e && pedalTarget(src);   // (nothing learned: the pedal reads src as its own number)
  const from = e ? (own ? "this preset's own" : "every preset's")
    : fixed ? `the pedal's own number: ${fixed.kind === "exp" ? "WHAMMY, else WAH, else VOLUME" : words(entryTgt({ dst: src })).long}` : "";
  const s = h("select", { "aria-label": "What the expression pedal moves", disabled: busy, onchange: () => setExp(src, s.value) },
    h("option", { value: "none", text: dest === "own" ? "Nothing of its own" : "Nothing learned" }),
    h("option", { value: "exp", text: "WHAMMY, else WAH, else VOLUME (CC 117's job)" }),
    h("option", { value: "master", text: "MASTER volume" }),
    p.order.map((b) => {
      const T = typeOf(p, b), ks = T.params.map((P, k) => [P, k]).filter(([, k]) => !gtUp(b, k));
      return ks.length && h("optgroup", { label: `${blk(b).name} (${T.name})` }, ks.map(([P, k]) => h("option", { value: `param:${b}:${k}`, text: `${blk(b).label} · ${P.name}` })));
    }));
  if (curKey === "other") s.prepend(h("option", { value: "other", text: words(t).long, disabled: true }));
  s.value = curKey;
  body.append(h("div", { class: "sc-row" }, h("span", { text: "It moves" }), h("div", { class: "lv-pick" }, s, from && h("small", { class: "lv-from", text: from }))));
  if (!e || !t || t.kind !== "param") return;
  const P = typeOf(p, t.b).params[t.k], two = !!(e.mode & PL_DUAL);
  if (app.ed.hasTwoJobs && dualOk({ dst: e.dst, mode: MAP_VALUE })) {
    const box = h("input", { type: "checkbox", checked: two, disabled: busy || !own,
      onchange: () => putExp(src, { ...e, mode: MAP_VALUE | (box.checked ? PL_DUAL : 0) }) });
    body.append(h("label", { class: "tick lv-two" }, box, ` or VOLUME while ${blk(t.b).label} is off`,
      !own && h("small", { class: "dim", text: " (a preset's own only: choose it again with \"Only in\")" })));
  }
  if (!own) return;
  const end = (k, label) => {
    const x = h("select", { "aria-label": `${P ? P.name : "The setting"} ${label}`, disabled: busy, onchange: () => putExp(src, { ...e, [k]: +x.value }) },
      Array.from({ length: 101 }, (_, v) => h("option", { value: String(v), text: valText(P, v) })));
    x.value = String(e[k]);
    return x;
  };
  body.append(h("div", { class: "sc-row" }, h("span", { text: "Heel, toe" }), h("div", { class: "lv-ends" }, end("lo", "at the heel"), end("hi", "at the toe"))));
}

// ---- the writes ----
async function run(fn) {
  if (busy) return;
  busy = true; status = ""; drawDlg();
  try { status = (await fn()) || status; } finally { busy = false; }
  if (/refused|could not|Not changed|keeps|cannot/.test(status)) say(status, "err");
  paintLive();
  drawDlg();
}
// what a preset's own table lost to a write (a row has one control in a preset): in words
function lostTo(before, src) {
  const after = tables().pl || [];
  const gone = before.filter((x) => x.src !== src && !after.some((y) => y.src === x.src && y.dst === x.dst && y.mode === x.mode));
  return gone.length ? ` In this preset, ${gone.map((x) => `CC ${x.src}`).join(", ")} gave ${gone.length > 1 ? "their" : "its"} place (a row has one control in a preset).` : "";
}
const FULL = (n) => `The pedal keeps ${n} controls for every preset: forget one first (the MIDI section, on a computer), or choose "Only in" this preset.`;
// a button's press (hold false) or hold (true) is tgt (null: nothing), written where dest says. For every preset, this
// preset's own of the same kind gives way (it would win here: switchJobs); for this preset, every preset's stays as it is
function setJob(f, hold, tgt) {
  return run(async () => {
    const { pl, map } = tables(), src = f.cc, slot = app.st.slot, j = switchJobs(src, pl, map);
    if (!map) return "This pedal cannot learn controls.";
    const was = j.press && plKind(j.press.mode) === MAP_EACH ? MAP_EACH : MAP_PRESS;
    const mode = hold ? MAP_HOLD : f.mom === false ? MAP_EACH : f.mom === true ? MAP_PRESS : was;
    const what = `${LETTERS[dlgWhat]} ${hold ? "held" : "pressed"}`, mine = hold ? j.holdOwn : j.pressOwn, before = (pl || []).slice();
    if (dest === "own") {
      const e = tgt && presetEntry(src, tgt, mode);
      if (tgt && !e) return "A hold cannot do that.";
      const err = e ? await writePl(slot, e) : mine ? await forgetPl(slot, src, hold) : "";
      if (err) return err;
      const now = switchJobs(src, tables().pl, tables().map), job = hold ? now.hold : now.press;
      return `${what}: ${tgt ? words(tgt).long : "nothing of its own"} in this preset${!tgt && job ? ` (every preset's: ${words(entryTgt(job)).long})` : ""}.${lostTo(before, src)}`;
    }
    const next = tgt ? pedalLearn(map, src, tgt, mode) : pedalForget(map, src, hold);
    if (!next) return FULL(map.length);
    let err = await writeMap(next);
    if (!err && tgt && mine) err = await forgetPl(slot, src, hold);
    return err || `${what}: ${tgt ? words(tgt).long : "nothing"}, in every preset.${tgt && mine ? " This preset's own gave way." : !tgt && mine ? " This preset keeps its own." : ""}`;
  });
}
// the expression pedal on v (a list's value), written where dest says (as setJob)
function setExp(src, v) {
  return run(async () => {
    const { pl, map } = tables(), slot = app.st.slot, tgt = v === "none" ? null : tgtOf(v), j = switchJobs(src, pl, map);
    if (!map) return "This pedal cannot learn controls.";
    const before = (pl || []).slice();
    if (dest === "own") {
      if (!tgt) return (j.pressOwn ? await forgetPl(slot, src, false) : "") || "The expression pedal: nothing of its own in this preset.";
      const e = presetEntry(src, tgt, MAP_VALUE);
      // (protocol 7) on a WAH's PEDAL, an AUTO WAH's CENTER or a WHAMMY's PEDAL: two jobs to begin with, as the pedal's own learn
      if (tgt.kind === "param" && app.ed.hasTwoJobs && dualOk(e) && dualDefault(tgt.b, typeOf(app.st.preset, tgt.b).name, tgt.k)) e.mode |= PL_DUAL;
      const err = await writePl(slot, e);
      return err || `The expression pedal: ${words(tgt).long}${e.mode & PL_DUAL ? `, or VOLUME while ${blk(tgt.b).label} is off` : ""}, only in this preset.${lostTo(before, src)}`;
    }
    const next = tgt ? pedalLearn(map, src, tgt, MAP_VALUE) : pedalForget(map, src, false);
    if (!next) return FULL(map.length);
    let err = await writeMap(next);
    if (!err && tgt && j.pressOwn) err = await forgetPl(slot, src, false);
    return err || `The expression pedal: ${tgt ? words(tgt).long : "nothing learned"}, in every preset.${tgt && j.pressOwn ? " This preset's own gave way." : ""}`;
  });
}
const putExp = (src, e) => run(async () => (await writePl(app.st.slot, e)) || "Changed in this preset.");

export function initLive() {
  loadNamed();
  on("midiin", heard);
  on("learned", () => { if (page) paintLive(); });
  on("conn", () => { if (app.conn !== "ready") { stopNaming(); if (dlg && dlg.open) dlg.close(); } });
}
