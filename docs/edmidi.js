// SPDX-License-Identifier: GPL-3.0-only
// OpenPocket web editor: the MIDI section. What is connected; the pedal's own Control Change numbers, named for the
// current preset; controls learned from another MIDI device (a foot controller on this computer), which this page
// passes on to the pedal as editor commands while it is open; and a monitor of what arrives. docs/MIDI.md, docs/pxmidi.js.

import { app, $, h, icon, on, emit, blk, typeOf, slotName, say, confirmDialog, fwLabel } from "./edcore.js";
import { sendParam, setOn, setType, tapTempo } from "./edsound.js";
import { selectPreset, stepPreset, refreshState } from "./edpresets.js";
import { decode, ccParam, ccOn, ccToggle, ccType, ccTarget, resolve, action, learn, cleanMappings, sameTgt, NPAR,
  pedalDst, pedalTarget, pedalLearn, PEDAL_MAP_N, MAP_PRESS, MAP_EACH, MAP_VALUE, SCENES, presetEntry,
  PL_DUAL, plKind, dualOk, dualDefault, MAP_HOLD, isHold, holdDst, switchJobs, pressMode } from "./pxmidi.js";

const KEY = "openpocket-midi-v1";
let cfg = { mappings: [], pc: true };
let learning = null;                  // the target waiting for a control: { kind, b, k, step, mode }
let learnt = "";                      // what the last learning ended with, said where the waiting was said
let scope = "all";                    // new controls work in every preset ("all") or only in the current one ("preset")
const log = [];                       // the monitor's lines, newest first
const heard = new Map();              // controller input id -> its name
// test build 39 (editor protocol 5, the Bluetooth audio image): controls learned ON THE PEDAL, kept in it with the presets,
// for a footswitch linked to the pedal over Bluetooth (or a controller on its USB port), which this page never hears itself:
// the pedal tells it what such a controller sends (MIDI_IN), and learning then writes the pedal's own table
let pmap = null;                      // { each, entries } as the pedal has it; null: this pedal has none
let catching = null;                  // a control being learned through the pedal: { tgt, src, values, timer, slot }
// editor protocol 6 (test builds 46 to 49): the current preset's OWN controls learned on the pedal (px_midi.h mid_pl), which
// its rows answer to before the ones above: { slot, used, places, entries }; null: this pedal has none
let plist = null;

function loadCfg() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || "{}"); cfg = { mappings: cleanMappings(j.mappings), pc: j.pc !== false }; } catch (_) { }
}
function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) { } }

// ---- names ----
function tgtName(t) {
  if (t.kind === "preset") return t.step > 0 ? "Next preset" : "Previous preset";
  if (t.kind === "tap") return "Tap tempo";
  if (t.kind === "scene") return `Scene ${t.n + 1}`;
  const B = blk(t.b);
  if (t.kind === "on") return `${B.label} on / off`;
  if (t.kind === "type") return `${B.label} type`;
  const p = app.st ? typeOf(app.st.preset, t.b).params[t.k] : null;
  return `${B.label} · ${p ? p.name : `setting ${t.k + 1}`}`;
}
const srcName = (s) => `CC ${s.cc} · ch ${s.ch}`;
// ettorebox beta 54: the pedal's own footswitches, learned on it for STOMP (px_midi.h PXM_CC_FSL / FSR, never a controller's)
const FOOT = { 126: "Left footswitch", 127: "Right footswitch" };
const plSrc = (s) => FOOT[s] || `CC ${s}`;
function pedalName(e) {                 // what a learned entry does, from the pedal's own number it is read as
  const t = pedalTarget(e.dst);
  if (!t) return `CC ${e.dst}`;
  if (t.kind === "next") return "Next preset";
  if (t.kind === "prev") return "Previous preset";
  if (t.kind === "pad") return "SYN PAD: catch the chord";
  if (t.kind === "tap") return "Tap tempo";
  if (t.kind === "exp") return "Expression pedal";
  if (t.kind === "scene") return `Scene ${t.n + 1}`;
  if (t.kind === "master") return "MASTER volume";
  if (t.kind === "toggle") return `${blk(t.b).label} on / off`;
  return tgtName(t);
}
const MODE_TEXT = ["flips on the press (the switch sends 127, then 0 when let go)", "flips at each message (the switch alternates 127 and 0)", "follows the value",
  "acts when the switch is held 0.6 s (a short press does the switch's other job, when let go)"];
// what a refusal means (hold: the request had a hold in it, which a pedal before beta 55 refuses)
function refusal(r, hold) {
  if (r.rc === 2) return "The pedal could not save it (flash): try again.";
  if (r.rc === 3) return `The pedal keeps ${r.places} controls learned for single presets, all presets together: forget one first.`;
  return hold ? "The pedal refused the hold: this firmware has no HOLD yet. Nothing changed." : "The pedal refused it.";
}
const hasHoldIn = (entries) => entries.some((e) => e && isHold(e.mode));
// (beta 55) a firmware before it, put back on the pedal, forgets a preset's holds alone, but every preset's table whole when it
// has one: said where a hold goes into every preset (edlive.js too)
export const DOWNGRADE = "Going back to a firmware before beta 55 forgets all controls learned for every preset when one of them is a hold.";
// what a message means to the pedal itself (its fixed map), in this preset's words
function pedalMeaning(m) {
  if (m.type === "pc") return m.program < app.slots.length ? `preset ${slotName(m.program)} ${app.slots[m.program].name}` : "no such preset";
  if (m.type !== "cc") return "";
  const t = ccTarget(m.cc);
  if (!t) { const q = pmap && pedalTarget(m.cc); return q ? pedalName({ dst: m.cc }) : "not in the pedal's map"; }
  if (t.kind === "master") return "MASTER volume";
  if (t.kind === "toggle") return `${blk(t.b).label} flips (on value 0)`;
  return tgtName(t);
}

// ---- the other devices ----
const isPedal = (input) => app.ed && app.ed.link && input === app.ed.link.input;
function listen() {
  heard.clear();
  // only once the pedal is known: while it is being looked for, its own port must keep the handler the search gave it
  if (!app.access || app.conn !== "ready") return;
  for (const input of app.access.inputs.values()) {
    if (isPedal(input) || input.state === "disconnected") continue;
    heard.set(input.id || input.name, input.name || "MIDI device");
    input.onmidimessage = (ev) => fromController(input, ev.data);
    if (input.open) Promise.resolve(input.open()).catch(() => { });
  }
}
function note(from, m, meaning, kind = "") {
  const what = m.type === "cc" ? `CC ${m.cc} = ${m.value}` : m.type === "pc" ? `Program ${m.program}` : m.type;
  log.unshift({ t: new Date(), from, what, ch: m.ch, meaning, kind });
  if (log.length > 60) log.pop();
  if (app.view === "midi") renderMonitor();
}
function fromController(input, data) {
  const m = decode(data);
  if (!m || m.type === "clock" || app.conn !== "ready") return;
  const from = input.name || "Controller";
  if (m.type === "cc" && learning) { bind(m, from); return; }
  if (m.type === "pc") {
    if (cfg.pc && m.program < app.slots.length) { note(from, m, `→ preset ${slotName(m.program)}`, "hit"); selectPreset(m.program, { ask: false }); }
    else note(from, m, cfg.pc ? "no such preset" : "Program Change is switched off below");
    return;
  }
  if (m.type !== "cc") { note(from, m, "not used"); return; }
  const hits = resolve(cfg.mappings, m, app.st.slot);
  if (!hits.length) { note(from, m, "not learned: click a control below, then move this one"); return; }
  for (const map of hits) {
    const a = action(map, m.value, { on: (b) => app.st.preset.on[b], ntypes: (b) => blk(b).types.length });
    note(from, m, a ? `→ ${tgtName(map.tgt)}${a.do === "param" ? ` ${a.v}` : a.do === "on" ? (a.v ? ": on" : ": off") : ""}` : `${tgtName(map.tgt)}: the switch released, nothing to do`, a ? "hit" : "");
    if (!a) continue;
    if (a.do === "param") { sendParam(a.b, a.k, a.v); redrawSoon(); }
    else if (a.do === "on") setOn(a.b, a.v);
    else if (a.do === "type") { if (a.t !== app.st.preset.type[a.b]) setType(a.b, a.t); }
    else if (a.do === "preset") stepPreset(a.step, { ask: false });
    else if (a.do === "scene" && app.ed && app.ed.hasScenes) app.ed.sceneRecall(a.n).then(() => refreshState()).catch(() => { });
    else if (a.do === "tap" && app.ed && app.ed.hasTempo) tapTempo();
  }
}
// ---- what a controller sent the pedal (protocol 5: MIDI_IN, pushed while watched) ----
function fromPedalIn(x) {
  if (app.conn !== "ready") return;
  const m = x.type === "pc" ? { type: "pc", program: x.n1 } : { type: "cc", cc: x.n1, value: x.n2 };
  emit("midiin", m);                                   // (the phone's LIVE page: the button just pressed, the pedal moved)
  if (catching) {
    if (m.type === "cc" && m.cc === catching.src) {
      catching.values.push(m.value); catching.times.push(performance.now());
      if (catching.waiting && m.value < 64) finishCatch();   // (beta 55: a switch held past the window, let go now)
    }
    return;
  }
  if (m.type === "cc" && learning && pmap) { startCatch(m); return; }
  // (beta 55) a switch's press and its hold, each the preset's own, else the pedal's for every preset (pxmidi.js switchJobs)
  const j = m.type === "cc" ? switchJobs(m.cc, plist && plist.entries, pmap && pmap.entries) : null;
  if (!j || !j.learned) { note("Controller on the pedal", m, pedalMeaning(m), "pedal"); return; }
  const does = [j.press ? `→ ${pedalName(j.press)}${j.press.mode & PL_DUAL ? " +VOL" : ""}` : `a press: ${pedalMeaning(m)}`, j.hold && `held: ${pedalName(j.hold)}`];
  note("Controller on the pedal", m, `${does.filter(Boolean).join("; ")} (learned on the pedal${j.own ? `, in ${slotName(plist.slot)}` : ""})`, "hit");
}
function startCatch(m) {
  const tgt = learning, d = pedalDst(tgt);
  learning = null;
  // (protocol 6: "only in this preset" is the preset's own table on the pedal; a step to another preset works in every one)
  const slot = scope === "preset" && tgt.kind !== "preset" && plist && app.ed.hasPresetLearn ? app.st.slot : null;
  catching = { tgt, src: m.cc, values: [m.value], times: [performance.now()], timer: 0, slot, waiting: false };
  if (!d || d.value) { finishCatch(); return; }   // a knob or a pedal: its value counts, nothing to wait for
  learnt = `Heard CC ${m.cc} from the controller on the pedal: let go of the switch…`;
  renderMap();
  catching.timer = setTimeout(windowEnds, 1200);    // a release in this time: a switch that sends 127, then 0
}
// (beta 55, as the pedal's own learn) the window over with the switch still down: it may be held for a hold, its release is
// waited for up to 3 s from the press; none: it latches
function windowEnds() {
  const c = catching;
  if (!c) return;
  if (c.values[0] >= 64 && !c.values.slice(1).some((v) => v < 64)) {
    c.waiting = true;
    learnt = `Heard CC ${c.src}: still held… let it go for a hold (0.6 s and more).`;
    renderMap();
    c.timer = setTimeout(finishCatch, 1800);
    return;
  }
  finishCatch();
}
// how the caught switch was pressed: a hold only where a hold can act (pxmidi.js holdDst; a value is a value)
function caughtMode(c) {
  const m = pressMode(c.values, c.times), d = pedalDst(c.tgt);
  return m === MAP_HOLD && !(d && !d.value && holdDst(d.dst)) ? MAP_PRESS : m;
}
async function finishCatch() {
  const c = catching;
  if (!c) return;
  clearTimeout(c.timer);
  c.hold = caughtMode(c) === MAP_HOLD;
  if (c.slot !== null) { await finishCatchHere(c); return; }
  const next = pmap && pedalLearn(pmap.entries, c.src, c.tgt, caughtMode(c));
  if (!next) {
    catching = null;
    learnt = pmap ? `The pedal keeps ${PEDAL_MAP_N} learned controls: forget one below first.` : "This pedal cannot learn controls.";
    renderMap();
    return;
  }
  try {
    const r = await app.ed.setPedalMap(pmap.each, next, pmap.inputDb, pmap.tails, pmap.btPower, pmap.outMode);
    if (r.rc === 0) {
      pmap = r;
      const e = r.entries.find((y) => y && y.src === c.src && isHold(y.mode) === c.hold);
      learnt = `${tgtName(c.tgt)} now follows CC ${c.src} of the controller on the pedal, in every preset: it ${MODE_TEXT[e ? e.mode : 0]}. The pedal keeps it, with no page open.` +
        (c.hold ? ` ${DOWNGRADE}` : "");
      note("Controller on the pedal", { type: "cc", cc: c.src, value: c.values[0] }, `learned on the pedal: ${tgtName(c.tgt)}${c.hold ? ", held" : ""}`, "hit");
    } else learnt = refusal(r, c.hold);
  } catch (e) { learnt = `Not learned: ${e.message}`; }
  catching = null;
  changed();
}
// (protocol 6) a control learned for the current preset only: into its own table on the pedal
async function finishCatchHere(c) {
  const next = presetEntry(c.src, c.tgt, caughtMode(c));
  if (!next) { catching = null; learnt = "This cannot be learned for one preset."; renderMap(); return; }
  // (protocol 7) a pedal on a WAH's PEDAL, an AUTO WAH's CENTER or a WHAMMY's PEDAL begins with two jobs, as the pedal's own learn
  const two = app.ed.hasTwoJobs && c.tgt.kind === "param" && dualOk(next) && dualDefault(c.tgt.b, typeOf(app.st.preset, c.tgt.b).name, c.tgt.k);
  if (two) next.mode |= PL_DUAL;
  try {
    const r = await app.ed.presetPut(c.slot, next);
    if (r.rc === 0) {
      plist = r;
      const e = r.entries.find((y) => y.src === c.src && isHold(y.mode) === c.hold);
      learnt = `${tgtName(c.tgt)} now follows CC ${c.src} of the controller on the pedal, only in preset ${slotName(c.slot)}: it ${MODE_TEXT[e ? plKind(e.mode) : 0]}.` +
        `${e && e.mode & PL_DUAL ? ` While ${blk(c.tgt.b).label} is off, it is the volume instead (untick "or VOLUME" below to keep it on the setting only).` : ""} The pedal keeps it with that preset.`;
      note("Controller on the pedal", { type: "cc", cc: c.src, value: c.values[0] }, `learned on the pedal for ${slotName(c.slot)}: ${tgtName(c.tgt)}${c.hold ? ", held" : ""}`, "hit");
    } else learnt = refusal(r, c.hold);
  } catch (e) { learnt = `Not learned: ${e.message}`; }
  catching = null;
  changed();
}
// the tables changed: the phone's LIVE page hears it (edlive.js), the MIDI section is drawn again
function changed() { emit("learned"); renderMap(); }
async function savePmap(entries, each = pmap.each, inputDb = pmap.inputDb, tails = pmap.tails, btPower = pmap.btPower, outMode = pmap.outMode,
  usb = pmap.usb, more = pmap.more, eq = pmap.eq) {
  try {
    const r = await app.ed.setPedalMap(each, entries, inputDb, tails, btPower, outMode, usb, more, eq);
    if (r.rc === 0) pmap = r; else say(refusal(r, hasHoldIn(entries)), "err");
  } catch (e) { say(`Not changed: ${e.message}`, "err"); }
  changed();
}
const setMore = (k, v) => savePmap(pmap.entries, pmap.each, pmap.inputDb, pmap.tails, pmap.btPower, pmap.outMode, pmap.usb, { ...pmap.more, [k]: v });
// (protocol 8, ettorebox beta 53) SETTINGS' EQ: the mid's frequencies and widths as the pedal steps them (firmware/px_midi.h)
const EQ_HZ = [160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000];
const EQ_WIDTH = ["Very wide", "Wide", "Medium", "Narrow", "Very narrow"];
const EQ_DB = Array.from({ length: 25 }, (_, i) => [i - 12, i === 12 ? "0 dB (flat)" : `${i > 12 ? "+" : ""}${i - 12} dB`]);
const setEq = (k, v) => savePmap(pmap.entries, pmap.each, pmap.inputDb, pmap.tails, pmap.btPower, pmap.outMode, pmap.usb, pmap.more, { ...pmap.eq, [k]: v });
async function loadPmap() {
  pmap = null;
  if (app.conn !== "ready" || !app.ed || !app.ed.hasPedalLearn) return;
  try { pmap = await app.ed.pedalMap(); } catch (_) { pmap = null; }
  await loadPlist();
  if (app.view === "midi") { renderConn(); renderMap(); }
}
// (protocol 6) the current preset's own controls, read again when the preset changes
async function loadPlist() {
  if (app.conn !== "ready" || !app.ed || !app.ed.hasPresetLearn || !app.st) { plist = null; emit("learned"); return; }
  try { plist = await app.ed.presetMap(app.st.slot); } catch (_) { plist = null; }
  emit("learned");
}
async function savePlist(run, hold = false) {
  if (!plist) return;
  try {
    const r = await run(plist.slot);
    if (r.rc === 0) plist = r; else say(refusal(r, hold), "err");
  } catch (e) { say(`Not changed: ${e.message}`, "err"); }
  changed();
}

// ---- for the phone's LIVE page (edlive.js): the pedal's tables as they are, and a change written at once ----
// -> "" done, or what went wrong, in words
export const learnTables = () => ({ pmap, plist });
// read again (LIVE shown: something may have been learned on the pedal itself meanwhile), the ones there kept meanwhile
export async function refreshTables() {
  if (app.conn !== "ready" || !app.ed || !app.ed.hasPedalLearn || catching) return;
  try { const r = await app.ed.pedalMap(); if (r.rc === 0) pmap = r; } catch (_) { }
  await loadPlist();
  if (app.view === "midi") renderMap();
}
export async function writeMap(entries) {
  if (!pmap || app.conn !== "ready") return "This pedal cannot learn controls.";
  try {
    const r = await app.ed.setPedalMap(pmap.each, entries, pmap.inputDb, pmap.tails, pmap.btPower, pmap.outMode, pmap.usb, pmap.more, pmap.eq);
    if (r.rc !== 0) return refusal(r, hasHoldIn(entries));
    pmap = r;
    return "";
  } catch (e) { return `Not changed: ${e.message}`; }
  finally { changed(); }
}
export async function writePl(slot, e) {
  if (!plist || app.conn !== "ready") return "This pedal cannot learn controls for one preset.";
  try {
    const r = await app.ed.presetPut(slot, e);
    if (r.rc !== 0) return refusal(r, isHold(e.mode));
    if (r.slot === app.st.slot) plist = r;
    return "";
  } catch (x) { return `Not changed: ${x.message}`; }
  finally { changed(); }
}
// hold: true / false forgets only src's hold / its other entry (beta 55's fourth byte), left out both; a number with only one
// entry is forgotten whole, the way a pedal before beta 55 understands
export async function forgetPl(slot, src, hold) {
  if (!plist || app.conn !== "ready") return "This pedal cannot learn controls for one preset.";
  const mine = plist.slot === slot ? plist.entries.filter((e) => e.src === src) : [];
  const both = mine.some((e) => isHold(e.mode)) && mine.some((e) => !isHold(e.mode));
  try {
    const r = await app.ed.presetForget(slot, src, both ? hold : undefined);
    if (r.rc !== 0) return refusal(r, false);
    if (r.slot === app.st.slot) plist = r;
    return "";
  } catch (x) { return `Not changed: ${x.message}`; }
  finally { changed(); }
}

// a knob turned on the controller sends a stream: the sections redraw once per frame
let redraw = 0;
function redrawSoon() { if (!redraw) redraw = requestAnimationFrame(() => { redraw = 0; if (app.st) emit("state", { push: true }); }); }
// a musical message the pedal sent itself (SEND is on): a setting turned on the pedal names its own number
function fromPedal(data) {
  const m = decode(data);
  if (!m || m.type === "clock") return;
  note("Pedal", m, pedalMeaning(m), "pedal");
  if (m.type === "cc" && app.view === "midi") {
    const t = ccTarget(m.cc);
    const cell = t && t.b !== undefined && document.querySelector(`.cc-cell[data-t="${t.kind === "toggle" ? "on" : t.kind}:${t.b}:${t.k ?? 0}"]`);
    if (cell) { cell.classList.remove("flash"); void cell.offsetWidth; cell.classList.add("flash"); }
  }
}

// ---- learning ----
function startLearn(tgt) {
  learning = learning && sameTgt(learning, tgt) ? null : tgt;
  learnt = "";
  renderMap();
}
function bind(m, from) {
  // a step to the next preset has to work in every preset
  const tgt = learning, slot = scope === "preset" && tgt.kind !== "preset" ? app.st.slot : null;
  learning = null;
  cfg.mappings = learn(cfg.mappings, m, tgt, slot, `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  saveCfg();
  note(from, m, `learned: ${tgtName(tgt)}`, "hit");
  learnt = `${tgtName(tgt)} now follows ${srcName(m)} of ${from}, ${slot === null ? "in every preset" : `only in preset ${slotName(slot)}`}.`;
  renderMap();
}
function forget(id) { cfg.mappings = cfg.mappings.filter((m) => m.id !== id); saveCfg(); renderMap(); }

// ---- v42: USB audio (pull request #25; editor protocol 4, docs/USB-AUDIO.md) ----
// The setting is on the pedal (MIDI page, USB AUDIO) and here. A change takes the pedal off USB for a second: it comes
// back as the other USB device, and the editor connects again by itself (editor.js, "reconnect").
let ua = null, uaBusy = false;
async function loadUa() {
  ua = null;
  if (app.conn !== "ready" || !app.ed || !app.ed.hasUsbAudio) return;
  try { const r = await app.ed.usbAudio(); ua = r.rc === 1 ? null : r; } catch (_) { ua = null; }   // (rc 1: no USB audio in this firmware)
  if (app.view === "midi") renderConn();
}
const uaText = (u) => !u.on ? "Off" : u.recording && u.playing ? "On: the computer records and plays"
  : u.recording ? "On: the computer records" : u.playing ? "On: the computer plays" : "On";
async function uaToggle() {
  if (!ua || uaBusy || !app.ed) return;
  const turnOn = !ua.on;
  if (!await confirmDialog({ title: `Turn USB audio ${turnOn ? "on" : "off"}?`,
    body: "The sound stops for a moment while the pedal saves the setting, then the pedal leaves USB for a second and the editor connects again.",
    confirm: turnOn ? "Turn on" : "Turn off" })) return;
  uaBusy = true;
  try {
    const r = await app.ed.usbAudio(turnOn);
    if (r.rc) { say("The pedal could not save the setting.", "err"); return; }
    say(`USB audio is ${turnOn ? "on" : "off"}. The pedal leaves USB for a second; the editor connects again by itself.`, "ok");
    emit("reconnect");
  } catch (e) { say(`Not changed: ${e.message}`, "err"); }
  finally { uaBusy = false; }
}

// ---- the connection ----
function renderConn() {
  const el = $("midiconn");
  el.textContent = "";
  if (app.conn !== "ready") return;
  const info = app.info, others = [...heard.values()];
  el.append(
    h("div", { class: "card-head" }, h("h2", { id: "midiconn-h", text: "Connection" })),
    h("dl", { class: "facts" },
      h("dt", { text: "Pedal" }), h("dd", { text: `${info.identity.replace(/_9?\d+$/, "")} · ${fwLabel(info.version)}` }),
      h("dt", { text: "USB MIDI port" }), h("dd", { text: info.port }),
      h("dt", { text: "Editor protocol" }), h("dd", { text: `version ${info.proto}` }),
      h("dt", { text: "Controllers" }), h("dd", { id: "midictl" }, others.length ? others.map((n) => h("span", { class: "chip ok", text: n })) : h("span", { class: "dim", text: "None. Plug a MIDI controller into this computer and it shows up here." })),
      ua && h("dt", { text: "USB audio" }),
      ua && h("dd", { id: "uarow" }, h("span", { id: "uastate", text: uaText(ua) }), " ",
        h("button", { type: "button", class: "btn small", id: "uabtn", text: ua.on ? "Turn off" : "Turn on", onclick: uaToggle }))),
    ua && h("p", { class: "dim", id: "uanote", text: "With USB audio on, the pedal is also a USB sound card, with no driver to install (stereo, 16 bit, 44.1 kHz). The computer records the pedal's sound, and what the computer plays comes out of the pedal's output." }),
    h("p", { class: "dim" }, "The pedal's own MIDI settings are on the pedal: ", h("b", { text: "hold FX for 0.8 s" }),
      pmap ? ` (SETTINGS) for CHANNEL (OMNI or 1 to 16), SEND and CLOCK > ${app.ed.hasTempo ? "TEMPO" : "DELAY"}. SWITCH, INPUT, TAILS, BT POWER, OUTPUT${pmap.more ? `, GUITAR TONE, PICKUP, PLAY VIEW${app.ed.hasTwoJobs ? ", the two scene rows and VOL PEDAL" : " and the two scene rows"}` : ""} are also under Controls below; the editor cannot read or change the first three. `
        : " for CHANNEL (OMNI or 1 to 16), SEND and CLOCK > DELAY. The editor cannot read or change them. ",
      h("a", { href: "https://github.com/isod89/openpocket/blob/main/docs/MIDI.md", target: "_blank", rel: "noopener" }, "The MIDI reference ", icon("ext"))));
}

// ---- the map ----
const learnedFor = (tgt) => cfg.mappings.filter((m) => sameTgt(m.tgt, tgt) && (m.slot === null || m.slot === app.st.slot));
function cell(tgt, title, cc, extra) {
  const key = `${tgt.kind}:${tgt.b}:${tgt.k ?? 0}`, on_ = learning && sameTgt(learning, tgt), got = learnedFor(tgt);
  return h("button", { type: "button", class: `cc-cell${on_ ? " learning" : ""}${got.length ? " has" : ""}`, "data-t": key, "aria-pressed": on_ ? "true" : "false",
    title: on_ ? "Waiting for a control. Click again to stop." : `Click, then ${pmap ? "press a switch of the footswitch linked to the pedal, or " : ""}move a control on your controller: it will drive ${tgtName(tgt)}.`, onclick: () => startLearn(tgt) },
    h("span", { class: "cc-n", text: title }),
    h("span", { class: "cc-c", text: on_ ? "Move a control…" : `CC ${cc}${extra ? ` · ${extra}` : ""}` }),
    got.map((m) => h("span", { class: "cc-l", text: `← ${srcName(m.src)}` })));
}
function renderMap() {
  const el = $("midimap");
  el.textContent = "";
  if (app.conn !== "ready" || !app.st) return;
  const p = app.st.preset, cur = `${slotName(app.st.slot)} ${p.name}`;
  const sc = h("select", { id: "midiscope", "aria-label": "Where a learned control works", onchange: () => { scope = sc.value; } },
    h("option", { value: "all", text: "in every preset" }), h("option", { value: "preset", text: `only in ${cur}` }));
  sc.value = scope;
  // (beta 55) a switch the pedal learns, held 0.6 s and let go, learns its hold, as on the pedal (a scene, a block, a preset
  // step, a tap: pxmidi.js holdDst)
  const holdable = (tgt) => { const d = pmap && pedalDst(tgt); return !!d && !d.value && holdDst(d.dst); };
  const pc = h("input", { type: "checkbox", id: "midipc", checked: cfg.pc, onchange: () => { cfg.pc = pc.checked; saveCfg(); } });
  const stepBtn = (step) => {
    const tgt = { kind: "preset", step }, on_ = learning && sameTgt(learning, tgt), got = learnedFor(tgt);
    return h("button", { type: "button", class: `btn small${on_ ? " learning" : ""}`, "data-t": `preset:${step}`, "aria-pressed": on_ ? "true" : "false", onclick: () => startLearn(tgt) },
      on_ ? "Press a switch…" : `${step > 0 ? "Next" : "Previous"} preset${got.length ? `: ${got.map((m) => srcName(m.src)).join(", ")}` : ""}`);
  };
  // (protocol 9, ettorebox beta 55) a switch to tap the tempo
  const tapBtn = () => {
    const tgt = { kind: "tap" }, on_ = learning && sameTgt(learning, tgt), got = learnedFor(tgt);
    return h("button", { type: "button", class: `btn small${on_ ? " learning" : ""}`, "data-t": "tap", "aria-pressed": on_ ? "true" : "false", onclick: () => startLearn(tgt) },
      on_ ? "Press a switch…" : `Tap tempo${got.length ? `: ${got.map((m) => srcName(m.src)).join(", ")}` : ""}`);
  };
  // (protocol 6, test build 49) a switch to recall one of the preset's scenes
  const sceneBtn = (n) => {
    const tgt = { kind: "scene", n }, on_ = learning && sameTgt(learning, tgt), got = learnedFor(tgt);
    return h("button", { type: "button", class: `btn small${on_ ? " learning" : ""}`, "data-t": `scene:${n}`, "aria-pressed": on_ ? "true" : "false", onclick: () => startLearn(tgt) },
      on_ ? "Press a switch…" : `Scene ${n + 1}${got.length ? `: ${got.map((m) => srcName(m.src)).join(", ")}` : ""}`);
  };
  const rows = app.cat.blocks.map((B, b) => {
    const T = typeOf(p, b);
    return h("tr", { style: `--c:${B.color}` },
      h("th", { scope: "row" }, h("i", { class: `led${p.on[b] ? " on" : ""}` }), h("span", { text: B.label }), h("small", { text: T.name })),
      h("td", {}, cell({ kind: "on", b, mode: "toggle" }, "On / off", ccOn(b), `flip ${ccToggle(b)}`)),
      h("td", {}, cell({ kind: "type", b }, "Type", ccType(b))),
      Array.from({ length: NPAR }, (_, k) => {
        // (test build 53, protocol 8: the GT block's GTR TONE + PICKUP and INPUT are set on the pedal or here, by no controller)
        const setUp = T.params[k] && B.label === "GT" && k >= 3 && !!(app.ed && app.ed.hasInputPerPreset);
        return h("td", {}, T.params[k] && !setUp ? cell({ kind: "param", b, k }, T.params[k].name, ccParam(b, k))
          : h("span", { class: "cc-cell none", title: setUp ? `${T.params[k].name}: set on the pedal or in the Sound section, never by a controller (CC ${ccParam(b, k)} does nothing).`
            : `${T.name} has no setting ${k + 1}: the pedal stores CC ${ccParam(b, k)} and ignores it.` }, h("span", { class: "cc-n", text: "–" }), h("span", { class: "cc-c", text: `CC ${ccParam(b, k)}` })));
      }));
  });
  const learned = cfg.mappings;
  el.append(
    h("div", { class: "card-head" }, h("h2", { id: "midimap-h", text: "Controls" })),
    h("div", { class: "ways" },
      h("p", {}, h("b", { text: "Straight to the pedal. " }), "A DAW or a controller that reaches the pedal's USB port uses the CC numbers below: they are fixed in the firmware. The names are this preset's: a setting's meaning follows the block's type."),
      pmap && h("p", {}, h("b", { text: "Learned by the pedal. " }), "For the footswitch linked to the pedal over Bluetooth, or a controller on the pedal's USB port: click a control below, then press the switch. The pedal keeps it with the presets and it works with no page open, in every preset",
        plist ? `, or only in ${cur} when "A control I teach works" says so (a pedal on a setting goes from 0 at the heel to 100 at the toe; change both below).` : "."),
      h("p", {}, h("b", { text: "Through this page. " }), "For a controller plugged into this computer: click a control below, then move a knob or press a switch on the controller. The page passes it on while it is open.")),
    h("div", { class: "learnbar" },
      h("label", {}, "A control I teach works ", sc),
      h("span", { class: "grow" }),
      stepBtn(-1), stepBtn(1),
      app.ed.hasScenes && Array.from({ length: SCENES }, (_, n) => sceneBtn(n)),
      app.ed.hasTempo && tapBtn(),
      h("label", { class: "check" }, pc, " Program Change loads presets")),
    h("p", { class: `learnstate${learning || catching ? " on" : ""}`, id: "learnstate", role: "status", text: learning
      ? `Waiting for a control for ${tgtName(learning)}: ${pmap ? `press a switch of the footswitch linked to the pedal${holdable(learning) ? " (held 0.6 s and let go: its hold; it must be momentary)" : ""}, or ` : ""}move a knob or press a switch on your controller${heard.size || pmap ? "" : " (none is connected yet)"}. Esc stops.` : learnt }),
    h("div", { class: "cc-wrap" }, h("table", { class: "cc" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Block" }), h("th", { scope: "col", text: "Switch" }), h("th", { scope: "col", text: "Type" }), h("th", { scope: "col", colSpan: NPAR, text: `Settings in ${cur}` }))),
      h("tbody", {}, rows))),
    h("p", { class: "dim small", text: "CC 7 is the MASTER volume. Values: a setting is 0 to 127 for 0 to 100; a switch is on from 64; a flip number acts on value 0, so a footswitch that sends 127 then 0 flips once." }),
    pmap && h("h3", { text: "Learned by the pedal" }),
    pmap && renderPmap(),
    plist && h("h3", { text: `Learned by the pedal, only in ${cur}` }),
    plist && renderPlist(),
    h("h3", { text: pmap ? "Learned by this page" : "Learned controls" }),
    learned.length ? h("div", { class: "learned", id: "learned" }, learned.map((m) => {
      const where = h("select", { "aria-label": `Where ${srcName(m.src)} works`, onchange: () => { m.slot = where.value === "all" ? null : +where.value; saveCfg(); renderMap(); } },
        h("option", { value: "all", text: "Every preset" }),
        m.slot !== null && m.slot !== app.st.slot && h("option", { value: m.slot, text: `Only ${slotName(m.slot)} ${app.slots[m.slot] ? app.slots[m.slot].name : ""}` }),
        h("option", { value: app.st.slot, text: `Only ${cur}` }));
      where.value = m.slot === null ? "all" : String(m.slot);
      const mode = m.tgt.kind === "on" && h("select", { "aria-label": "How the switch acts", onchange: () => { m.tgt.mode = mode.value; saveCfg(); } },
        h("option", { value: "toggle", text: "Each press flips it" }), h("option", { value: "follow", text: "On while the value is 64 or more" }));
      if (mode) mode.value = m.tgt.mode;
      return h("div", { class: "lrow" }, h("span", { class: "chip", text: srcName(m.src) }), h("span", { class: "arrow", "aria-hidden": "true", text: "→" }), h("b", { text: tgtName(m.tgt) }), h("span", { class: "grow" }), mode, where,
        h("button", { type: "button", class: "btn icon small", "aria-label": `Forget ${srcName(m.src)} for ${tgtName(m.tgt)}`, onclick: () => forget(m.id) }, icon("x")));
    })) : h("p", { class: "dim empty-note", text: "None yet. A learned control is kept in this browser and works while this page is open and connected." }));
}

function renderPmap() {
  const sw = h("select", { id: "pmapeach", "aria-label": "How the flip numbers 8 to 19 act", onchange: () => savePmap(pmap.entries, sw.value === "1") },
    h("option", { value: "0", text: "when the switch is let go (it sends 127, then 0)" }),
    h("option", { value: "1", text: "at each message (it alternates 127 and 0)" }));
  sw.value = pmap.each ? "1" : "0";
  const inp = h("select", { id: "pmapinput", "aria-label": "The guitar's input level", onchange: () => savePmap(pmap.entries, pmap.each, +inp.value) },
    Array.from({ length: 21 }, (_, i) => i - 10).map((d) => h("option", { value: String(d), text: `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d)} dB` })));
  inp.value = String(pmap.inputDb);
  const tl = h("input", { type: "checkbox", id: "pmaptails", checked: pmap.tails, onchange: () => savePmap(pmap.entries, pmap.each, pmap.inputDb, tl.checked) });
  const bp = h("select", { id: "pmapbt", "aria-label": "The radio's transmit power", onchange: () => savePmap(pmap.entries, pmap.each, pmap.inputDb, pmap.tails, +bp.value) },
    h("option", { value: "0", text: "High (as before)" }), h("option", { value: "1", text: "Medium" }), h("option", { value: "2", text: "Low" }));
  bp.value = String(pmap.btPower);
  const bo = h("select", { id: "pmapout", "aria-label": "The output", onchange: () => savePmap(pmap.entries, pmap.each, pmap.inputDb, pmap.tails, pmap.btPower, +bo.value) },
    h("option", { value: "0", text: "Mono (as before)" }), h("option", { value: "1", text: "Stereo" }),
    h("option", { value: "2", text: "Guitar left, LOW OCTAVE's bass right" }));
  bo.value = String(pmap.outMode || 0);
  // test build 43: USB audio's routing (SETTINGS' USB SEND, USB RETURN, GUITAR), from a pedal that has it
  const u = pmap.usb, setUsb = (k, v) => savePmap(pmap.entries, pmap.each, pmap.inputDb, pmap.tails, pmap.btPower, pmap.outMode, { ...pmap.usb, [k]: v });
  const us = u && h("select", { id: "pmapusend", "aria-label": "What the computer records", onchange: () => setUsb("send", +us.value) },
    h("option", { value: "0", text: "The pedal's sound (as before)" }), h("option", { value: "1", text: "DI: the guitar before any block" }),
    h("option", { value: "2", text: "DI left, the pedal's sound right" }));
  if (us) us.value = String(u.send);
  const ur = u && h("select", { id: "pmapuret", "aria-label": "Where the computer's sound comes in", onchange: () => setUsb("ret", +ur.value) },
    h("option", { value: "0", text: "At the output (as before)" }), h("option", { value: "1", text: "At the input: through the whole chain" }),
    app.cat.blocks.map((B, b) => h("option", { value: String(2 + b), text: `Before ${B.name || B.label}` })));
  if (ur) ur.value = String(u.ret);
  const ug = u && h("select", { id: "pmapugtr", "aria-label": "The guitar where the computer's sound comes in", onchange: () => setUsb("cut", ug.value === "1") },
    h("option", { value: "0", text: "Mixed with the computer's sound" }), h("option", { value: "1", text: "Cut while the computer plays" }));
  if (ug) ug.value = u.cut ? "1" : "0";
  // protocol 6 (test builds 46 to 49): GUITAR TONE and PICKUP, PLAY VIEW and the two scene rows
  const mo = pmap.more, sel = (id, label, k, opts) => {
    const e = h("select", { id, "aria-label": label, onchange: () => setMore(k, k === "sceneWins" || k === "feetPresets" ? e.value === "1" : +e.value) },
      opts.map(([v, t]) => h("option", { value: String(v), text: t })));
    e.value = String(typeof mo[k] === "boolean" ? (mo[k] ? 1 : 0) : mo[k]);
    return e;
  };
  const moreRows = mo && [
    h("div", { class: "lrow" }, h("span", { text: "Guitar tone" }),
      sel("pmaptone", "The guitar's tone, as a lower input load would make it", "tone", [[8, "Bright (a buffer at the guitar)"], [0, "Natural (as it is)"], [1, "Smooth"], [2, "Warm"], [3, "Warmer"], [4, "Punchy"], [5, "Dark"], [6, "Darker"], [7, "Muddy"]]),
      sel("pmappickup", "The pickup it assumes", "pickup", [[0, "Single coil"], [1, "Humbucker"], [2, "P90"]]),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, GUITAR TONE and PICKUP: heard at once, in every preset)" })),
    h("div", { class: "lrow" }, h("span", { text: "Play view" }),
      sel("pmapview", "What the pedal's PLAY page shows", "view", [[0, "The chain"], [1, "The switches: the blocks they turn on and off"], [2, "The scenes"]]),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, PLAY VIEW; on the pedal, hold CAB turns it round)" })),
    h("div", { class: "lrow" }, h("span", { text: "A block with its own switch, in a scene" }),
      sel("pmapscrule", "Scenes and a block's own switch", "sceneWins", [[0, "Stays with its switch"], [1, "Follows the scene too"]]),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, SCENE+SWITCH)" })),
    h("div", { class: "lrow" }, h("span", { text: "The footswitches in the scenes view" }),
      sel("pmapscfeet", "What the footswitches do in the scenes view", "feetPresets", [[0, "Step through the scenes"], [1, "Stay on the presets"]]),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, SCENE FOOTSW)" })),
    // (protocol 7, test build 51) where the expression pedal's volume acts: CC 117's, and a two-job pedal's while its block is off
    app.ed.hasTwoJobs && h("div", { class: "lrow" }, h("span", { text: "Volume pedal" }),
      sel("pmapvolat", "Where the expression pedal's volume acts", "volAt", [[0, "At the input, as the guitar's volume knob (AT INPUT)"], [1, "Before the delay and the reverb, the tone kept (BEFORE DLY)"]]),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, VOL PEDAL: CC 117's volume, and a two-job pedal's while its effect is off; the tails ring on)" })),
  ];
  // (protocol 8, ettorebox beta 53) SETTINGS' EQ, over the whole guitar at the output, in every preset
  const eqSel = (id, label, k, opts) => {
    const e = h("select", { id, "aria-label": label, onchange: () => setEq(k, +e.value) }, opts.map(([v, t]) => h("option", { value: String(v), text: t })));
    e.value = String(pmap.eq[k]);
    return e;
  };
  const eqRows = pmap.eq && pmap.usb && mo && [
    h("div", { class: "lrow" }, h("span", { text: "General EQ: bass and treble" }),
      eqSel("pmapeqb", "General EQ bass, a shelf at 100 Hz", "bass", EQ_DB), eqSel("pmapeqt", "General EQ treble, a shelf at 3.5 kHz", "treble", EQ_DB),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, EQ BASS and EQ TREBLE: shelves at 100 Hz and 3.5 kHz, over the whole guitar at the output, every preset; heard at once)" })),
    h("div", { class: "lrow" }, h("span", { text: "General EQ: mid" }),
      eqSel("pmapeqm", "General EQ mid", "mid", EQ_DB), eqSel("pmapeqf", "General EQ mid frequency", "freq", EQ_HZ.map((f, i) => [i, `at ${f} Hz`])),
      eqSel("pmapeqw", "General EQ mid width", "width", EQ_WIDTH.map((t, i) => [i, t])),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, EQ MID, EQ MID FREQ and EQ MID WIDTH: a peak or a dip where the room or the speaker needs it)" })),
  ];
  const used = pmap.entries.map((e, i) => [e, i]).filter(([e]) => e);
  return h("div", { class: "learned", id: "pmap" },
    h("div", { class: "lrow" }, h("span", { text: "The flip numbers, CC 8 to 19, act" }), sw, h("span", { class: "grow" }),
      h("span", { class: "dim small", text: "(on the pedal: SETTINGS, SWITCH)" })),
    h("div", { class: "lrow" }, h("span", { text: "The guitar's input level" }), inp, h("span", { class: "grow" }),
      h("span", { class: "dim small", text: "(on the pedal: SETTINGS, INPUT)" })),
    h("div", { class: "lrow" }, h("label", { class: "tick" }, tl, " Tails"),
      h("span", { class: "grow" }), h("span", { class: "dim small", text: "(SETTINGS, TAILS: the delay and the reverb ring out when they go off and across a preset change)" })),
    h("div", { class: "lrow" }, h("span", { text: "Bluetooth transmit power" }), bp, h("span", { class: "grow" }),
      h("span", { class: "dim small", text: "(SETTINGS, BT POWER: lower it if the guitar ticks while the radio works)" })),
    h("div", { class: "lrow" }, h("span", { text: "Output" }), bo, h("span", { class: "grow" }),
      h("span", { class: "dim small", text: "(SETTINGS, OUTPUT: stereo spreads the delay, the reverb and the modulations, the two channels summed are the mono sound; a mono cable then carries only the left)" })),
    u && h("div", { class: "lrow" }, h("span", { text: "USB audio: the computer records" }), us, h("span", { class: "grow" }),
      h("span", { class: "dim small", text: "(SETTINGS, USB SEND: the DI is what a guitar-to-MIDI program tracks best)" })),
    u && h("div", { class: "lrow" }, h("span", { text: "USB audio: the computer's sound comes in" }), ur, h("span", { class: "grow" }),
      h("span", { class: "dim small", text: "(SETTINGS, USB RETURN: before a block, wherever this preset puts it, so the blocks after it play on the computer's sound)" })),
    u && h("div", { class: "lrow" }, h("span", { text: "USB audio: the guitar there" }), ug, h("span", { class: "grow" }),
      h("span", { class: "dim small", text: "(SETTINGS, GUITAR: cut, only the computer's sound goes on from there; the guitar comes back when the computer stops playing)" })),
    moreRows,
    eqRows,
    used.length ? used.map(([e, i]) => {
      const t = pedalTarget(e.dst), isValue = e.mode === MAP_VALUE || (t && (t.kind === "param" || t.kind === "type" || t.kind === "exp" || t.kind === "master"));
      const mode = !isValue && switchModeSelect(e, pmap.entries, `How CC ${e.src} acts`,
        (v) => savePmap(pmap.entries.map((x, j) => (j === i ? { ...x, mode: v } : x))));
      return h("div", { class: "lrow" }, h("span", { class: "chip", text: `CC ${e.src}` }), h("span", { class: "arrow", "aria-hidden": "true", text: "→" }),
        h("b", { text: pedalName(e) }), h("span", { class: "grow" }), mode,
        h("button", { type: "button", class: "btn icon small", "aria-label": `Forget CC ${e.src}${isHold(e.mode) ? " held" : ""} on the pedal`,
          onclick: () => savePmap(pmap.entries.map((x, j) => (j === i ? null : x))) }, icon("x")));
    }) : h("p", { class: "dim empty-note", text: `None yet. The pedal keeps up to ${PEDAL_MAP_N}.` }),
    hasHoldIn(pmap.entries) && h("p", { class: "dim small", id: "pmapdown", text: DOWNGRADE }));
}

// how a learned switch acts, as a list: on a press (127, then 0), at each message, or (after beta 55) when held 0.6 s, where
// its number has room for it (one hold and one other entry a number); others: the table it is in
function switchModeSelect(e, others, label, pick) {
  const hold = isHold(e.mode), mine = others.filter((x) => x && x !== e && x.src === e.src);
  const holdTaken = mine.some((x) => isHold(x.mode)), otherTaken = mine.some((x) => !isHold(x.mode));
  const s = h("select", { "aria-label": label, onchange: () => pick(+s.value) },
    h("option", { value: String(MAP_PRESS), text: "Press: 127, then 0 when let go", disabled: hold && otherTaken }),
    h("option", { value: String(MAP_EACH), text: "Each message is a press", disabled: hold && otherTaken }),
    holdDst(e.dst) && h("option", { value: String(MAP_HOLD), text: "Held 0.6 s (a momentary switch)", disabled: !hold && holdTaken }));
  s.value = String(hold ? MAP_HOLD : plKind(e.mode) === MAP_EACH ? MAP_EACH : MAP_PRESS);
  return s;
}
// (protocol 6) the current preset's own controls on the pedal: what each drives, how a switch acts, a pedal's heel and toe
const valText = (param, v) => (param && param.texts && param.texts[v]) || String(v);
function renderPlist() {
  const p = app.st.preset;
  const rows = plist.entries.map((e, i) => {
    const t = pedalTarget(e.dst), param = t && t.kind === "param" ? typeOf(p, t.b).params[t.k] : null;
    const put = (patch) => savePlist((slot) => app.ed.presetPut(slot, { ...e, ...patch }), isHold(patch.mode ?? e.mode));
    // (beta 55) forgetting one of a number's two (its press, its hold) keeps the other: the fourth byte says which. A number
    // with one entry, and a footswitch of the pedal's own (it forgets all it switches), are forgotten whole, as before
    const both = !FOOT[e.src] && plist.entries.some((x) => x !== e && x.src === e.src && isHold(x.mode) !== isHold(e.mode));
    const forgetIt = () => savePlist((slot) => app.ed.presetForget(slot, e.src, both ? isHold(e.mode) : undefined));
    const kind = plKind(e.mode), two = !!(e.mode & PL_DUAL);
    let how = null;
    if (param && kind === MAP_VALUE) {
      const end = (k, label) => {
        const s = h("select", { "aria-label": `${tgtName(t)} ${label}`, onchange: () => put({ [k]: +s.value }) },
          Array.from({ length: 101 }, (_, v) => h("option", { value: String(v), text: valText(param, v) })));
        s.value = String(e[k]);
        return s;
      };
      // (protocol 7) a pedal on a block's setting, not the GATE's: the volume too, while that block is off (one a preset)
      const vol = app.ed.hasTwoJobs && dualOk(e) && h("input", { type: "checkbox", checked: two,
        "aria-label": `CC ${e.src}: the volume while ${blk(t.b).label} is off`, onchange: (ev) => put({ mode: MAP_VALUE | (ev.target.checked ? PL_DUAL : 0) }) });
      how = [h("span", { class: "dim small", text: "heel" }), end("lo", "at the heel"), h("span", { class: "dim small", text: "toe" }), end("hi", "at the toe"),
        (e.clo !== e.chi && (e.clo !== 0 || e.chi !== 127)) && h("span", { class: "dim small", title: "Where the pedal was at the heel and at the toe while it was learned", text: `(CC ${e.clo} to ${e.chi})` }),
        vol && h("label", { class: "tick", title: "As a multi-effect's expression pedal with a toe switch: whatever turns the block on and off changes the pedal's job. Where the volume acts: Volume pedal, above." },
          vol, ` or VOLUME when ${blk(t.b).label} is off`)];
    } else if (kind !== MAP_VALUE && !FOOT[e.src]) {   // (beta 54: a footswitch of the pedal's own has nothing to choose)
      how = switchModeSelect(e, plist.entries, `How CC ${e.src} acts`, (v) => put({ mode: v }));
    }
    const foot = FOOT[e.src] ? "The pedal's own footswitch, in STOMP (both footswitches change the mode). Forgetting it forgets all it switches in this preset." : null;
    return h("div", { class: "lrow" }, h("span", { class: "chip", text: plSrc(e.src), title: foot }), h("span", { class: "arrow", "aria-hidden": "true", text: "→" }),
      h("b", { text: `${pedalName(e)}${two ? " +VOL" : ""}` }), h("span", { class: "grow" }), how,
      h("button", { type: "button", class: "btn icon small", "aria-label": `Forget ${plSrc(e.src)}${isHold(e.mode) ? " held" : ""} in this preset`,
        onclick: forgetIt }, icon("x")));
  });
  return h("div", { class: "learned", id: "plist" },
    rows.length ? rows : h("p", { class: "dim empty-note", text: "None in this preset. Choose \"only in\" this preset above and learn one, or on the pedal: a block's row, hold FX." }),
    h("p", { class: "dim small", text: `${plist.used} of the pedal's ${plist.places} places for single presets in use, all presets together. A preset saved into another slot takes its own along.` }));
}

function renderMonitor() {
  const el = $("midimon");
  el.textContent = "";
  if (app.conn !== "ready") return;
  el.append(
    h("div", { class: "card-head" }, h("h2", { id: "midimon-h", text: "Monitor" }), h("span", { class: "grow" }),
      log.length ? h("button", { type: "button", class: "btn small", text: "Clear", onclick: () => { log.length = 0; renderMonitor(); } }) : null),
    log.length ? h("ol", { class: "mon", id: "monlist", reversed: true }, log.slice(0, 40).map((l) =>
      h("li", { class: l.kind }, h("span", { class: "mon-w", text: `${l.what}${l.ch ? ` · ch ${l.ch}` : ""}` }), h("span", { class: "mon-m", text: l.meaning }),
        h("span", { class: "mon-s" }, h("time", { text: l.t.toLocaleTimeString([], { hour12: false }) }), ` · ${l.from}`))))
      : h("p", { class: "dim empty-note", text: "Nothing received yet. Messages from a controller show here, and the pedal's own when a setting is changed on it (with SEND on)." }));
}
const renderAll = () => { renderConn(); renderMap(); renderMonitor(); };

export function initMidi() {
  loadCfg();
  on("conn", () => {
    learning = null; catching = null;
    if (app.conn === "ready") { listen(); app.ed.onMidi = fromPedal; app.ed.onMidiIn = fromPedalIn; loadUa(); loadPmap(); } else { ua = null; pmap = null; plist = null; }
    renderAll();
  });
  on("ports", () => { listen(); if (app.view === "midi") { renderConn(); renderMap(); } });
  // (protocol 6: another preset, or a change made on the pedal, which may have learned there: its own controls read again)
  on("state", (o) => {
    if (!app.st) return;
    if (plist && (plist.slot !== app.st.slot || (o && o.push && app.view === "midi"))) loadPlist().then(() => { if (app.view === "midi") renderMap(); });
    else if (app.view === "midi") renderMap();
  });
  on("view", () => { if (app.view === "midi") renderAll(); else { learning = null; learnt = ""; } });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && (learning || catching)) { learning = null; if (catching) { clearTimeout(catching.timer); catching = null; learnt = ""; } renderMap(); } });
}
