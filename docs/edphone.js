// SPDX-License-Identifier: GPL-3.0-only
// ettorebox web editor: the Sound section on a phone (a screen under 600 px wide: a phone held upright). One block a page,
// in the chain's order, swiped sideways; the preset's scenes on top, its level at the bottom, on every page. A block's
// settings are faders side by side that never jump: a drag moves the value from where it is (slowly, one step at a time),
// − and + step it (held, they repeat), and two quick taps on a value bring back the saved one. On a tablet or a computer
// the section is edsound.js' own; both edit the same sound, and turning the phone sideways shows that one.

import { app, $, h, on, emit, blk, typeOf, fill, blockIndex, say, choices } from "./edcore.js";
import { sendParam, setFocus, toggle, setType, paramChoices, optionOf, gtSplit, notesOn, setTempo, tapTempo, LVL_K, levelText } from "./edsound.js";
import { comparing } from "./edpresets.js";
import { scenesNow, sceneTitle, sceneShort, sceneMask, sceneKnown, recallScene, toggleScene, sceneForm } from "./edscenes.js";
import { TONES, PICKUPS, gtTone, gtPickup, gtPack, NOTES, syncTop, noteName } from "./pxedit.js";

export const PHONE = matchMedia("(max-width: 599px)");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const HINT_KEY = "ettorebox-phone-hint";
let box = null;              // the section's own part (#ph), under the preset's header
let sig = "";                // what the pages were built for (the chain, the types, the slots' names)
let paints = [];             // each control's way to show the sound again
let held = null;             // the control under a finger: left as it is while the pedal answers
let settleT = 0;
let placed = 0;              // when a page was put in view by the page itself (built, turned, resized): not a swipe
let current = null;          // the block whose page is meant to be in view (a hidden pager's scroll says nothing)

// ---- the pieces every control uses ----
const cur = (b, k) => app.st.preset.p[b][k];
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
// the saved preset's value of a setting (this slot, read in the background), when its block has the same type there
function savedValue(b, k) {
  const e = app.bank[app.st.slot], q = e && e.preset;
  return q && q.type[b] === app.st.preset.type[b] ? q.p[b][k] : null;
}
const text = (P, v) => (P.texts && P.texts[v]) || String(v);
function pencil() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "ic"); s.setAttribute("viewBox", "0 0 20 20"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", "M12.5 4.5l3 3L8 15l-4 1 1-4zM11 6l3 3");
  s.append(p);
  return s;
}

// a drag along `axis` changes the value by how far the finger moves, from where it was; slow movement is fine (one step
// per 9 px), fast is coarse. The first 6 px only decide: across the control, it is a swipe or a scroll, not a change
function dragger(el, axis, get, set, host) {
  el.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || comparing()) return;
    const sx = e.clientX, sy = e.clientY;
    let acc = 0, last = 0, lastT = e.timeStamp, decided = false;
    try { el.setPointerCapture(e.pointerId); } catch (_) { }
    const move = (ev) => {
      const pos = axis === "y" ? ev.clientY : ev.clientX;
      if (!decided) {
        const dx = Math.abs(ev.clientX - sx), dy = Math.abs(ev.clientY - sy);
        if (Math.max(dx, dy) < 6) return;
        decided = true;
        if (axis === "y" ? dx > dy : dy > dx) { end(); return; }
        acc = get(); last = pos; lastT = ev.timeStamp;
        held = host; host.classList.add("held");
        return;
      }
      const d = axis === "y" ? last - pos : pos - last, dt = Math.max(1, ev.timeStamp - lastT);
      last = pos; lastT = ev.timeStamp;
      const speed = Math.abs(d) / dt, per = speed < 0.25 ? 9 : speed < 0.8 ? 4.5 : 2;
      acc = Math.max(0, Math.min(100, acc + d / per));
      set(Math.round(acc));
      host.classList.toggle("fine", per >= 9);
    };
    const end = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      host.classList.remove("held", "fine");
      if (held === host) held = null;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  });
  el.addEventListener("keydown", (e) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d && !comparing()) { e.preventDefault(); set(clamp(get() + d)); }
  });
}
// − and +: a tap is one step; held, they go on stepping, faster after a second
function stepper(d, label, fn) {
  const btn = h("button", { type: "button", class: "ph-step", "aria-label": label, text: d < 0 ? "−" : "+" });
  let t1 = 0, t2 = 0;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  btn.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || comparing()) return;
    e.preventDefault();
    fn();
    let n = 0;
    t1 = setTimeout(() => { t2 = setInterval(() => { fn(); if (++n === 8) { clearInterval(t2); t2 = setInterval(fn, 45); } }, 110); }, 380);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) btn.addEventListener(ev, stop);
  btn.addEventListener("click", (e) => { if (e.detail === 0 && !comparing()) fn(); });     // (the keyboard)
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
  return btn;
}
// two quick taps on a value: back to the saved one
function backToSaved(el, b, k, set, name) {
  let lastUp = 0, x = 0, y = 0;
  el.addEventListener("pointerdown", (e) => { x = e.clientX; y = e.clientY; });
  el.addEventListener("pointerup", (e) => {
    if (Math.abs(e.clientX - x) + Math.abs(e.clientY - y) > 8) { lastUp = 0; return; }
    if (e.timeStamp - lastUp > 320) { lastUp = e.timeStamp; return; }
    lastUp = 0;
    const v = savedValue(b, k);
    if (v === null || comparing()) return;
    set(v);
    say(`${name}: the saved value again.`, "ok");
  });
}
// a setting changed here: sent (edsound.js sends the last value when the pedal is ready), and shown where it is shown
function change(b, k, v) {
  if (!app.ed || comparing() || cur(b, k) === v) return;
  sendParam(b, k, v);
  paint();
}

// ---- a setting as a fader (up and down) ----
function fader(b, k, P) {
  const t = app.st.preset.type[b];
  const val = h("div", { class: "ph-v" });
  const fill1 = h("i", { class: "ph-fill" }), mark = h("i", { class: "ph-mark" });
  const track = h("div", { class: "ph-track", role: "slider", tabIndex: 0, "aria-label": `${blk(b).name} ${P.name}`,
    "aria-valuemin": "0", "aria-valuemax": "100" }, fill1, mark, h("span", { class: "ph-fine", text: "FINE" }));
  const el = h("div", { class: "ph-fd" }, val, stepper(1, `${P.name} up one step`, () => set(clamp(Math.min(100, cur(b, k)) + 1))),
    track, stepper(-1, `${P.name} down one step`, () => set(clamp(Math.min(100, cur(b, k)) - 1))), h("div", { class: "ph-l", text: P.name }));
  const show = (raw) => {
    const note = k === 0 && notesOn(b, t) && raw > 100 && raw <= syncTop(b, t, 0);
    val.textContent = note ? noteName(raw) : text(P, raw);
    el.classList.toggle("synced", note);
    fill1.style.blockSize = `${note ? 100 : Math.min(100, raw)}%`;
    const s = savedValue(b, k);
    mark.hidden = s === null || s > 100;
    if (!mark.hidden) mark.style.insetBlockEnd = `${s}%`;
    track.setAttribute("aria-valuenow", String(Math.min(100, raw)));
    track.setAttribute("aria-valuetext", note ? `${noteName(raw)}, against the tempo` : val.textContent);
  };
  const set = (v) => { change(b, k, v); show(v); };
  dragger(track, "y", () => Math.min(100, cur(b, k)), set, el);
  backToSaved(val, b, k, set, P.name);
  paints.push(() => { if (held !== el) show(cur(b, k)); });
  return el;
}

// ---- a setting that is a choice: a few as buttons, more as a list ----
function choiceRow(b, k, P) {
  const t = app.st.preset.type[b], opts = paramChoices(b, t, k, P);
  let ctl;
  if (opts.length <= 4) {
    ctl = h("div", { class: "seg", role: "radiogroup", "aria-label": P.name }, opts.map((o) =>
      h("button", { type: "button", role: "radio", "data-v": o.value, text: o.label, onclick: () => change(b, k, o.value) })));
    paints.push(() => {
      const o = optionOf(choices(P) || opts, cur(b, k));
      for (const r of ctl.children) r.setAttribute("aria-checked", +r.dataset.v === o.value ? "true" : "false");
    });
  } else {
    ctl = h("select", { class: "choice", "aria-label": P.name, onchange: () => change(b, k, +ctl.value) });
    const groups = opts[0].index === undefined ? null
      : [["Factory", opts.filter((o) => o.slot < 0)], [opts[0].kind === "nam" ? "Your captures" : "Your IRs", opts.filter((o) => o.slot >= 0)]];
    const opt = (o) => h("option", { value: o.value, text: o.tag ? `${o.tag}  ${o.empty ? "empty" : o.label}` : o.label, disabled: !!o.empty });
    if (groups) for (const [name, list] of groups) { if (list.length) ctl.append(h("optgroup", { label: name }, list.map(opt))); }
    else ctl.append(...opts.map(opt));
    paints.push(() => { if (document.activeElement !== ctl) ctl.value = String(optionOf(paramChoices(b, t, k, P), cur(b, k)).value); });
  }
  return h("div", { class: "ph-row" }, h("span", { class: "ph-lab", text: P.name }), ctl);
}
// GT's 4th setting (protocol 8): the guitar's tone and its pickup, two lists as on the pedal
function gtRows(b, k) {
  const tone = h("select", { class: "choice", "aria-label": "Guitar tone", onchange: () => change(b, k, gtPack(+tone.value, +pick.value)) },
    h("option", { value: 0, text: "SETTINGS" }), TONES.map((n, i) => h("option", { value: i + 1, text: n })));
  const pick = h("select", { class: "choice", "aria-label": "Pickup", onchange: () => change(b, k, gtPack(+tone.value, +pick.value)) },
    h("option", { value: 0, text: "SETTINGS" }), PICKUPS.map((n, i) => h("option", { value: i + 1, text: n })));
  paints.push(() => { const v = cur(b, k); tone.value = String(gtTone(v)); pick.value = String(gtPickup(v)); });
  return [h("div", { class: "ph-row" }, h("span", { class: "ph-lab", text: "GTR TONE" }), tone),
    h("div", { class: "ph-row" }, h("span", { class: "ph-lab", text: "PICKUP" }), pick)];
}
// beta 55 (protocol 9): TIME / RATE free (its fader) or a note value against the tempo; the tempo, typed or tapped
function noteRow(b) {
  const t = app.st.preset.type[b], top = syncTop(b, t, 0);
  const note = h("select", { class: "choice", "aria-label": "Note value", title: "Free: the fader sets it. A note value follows the tempo",
    onchange: () => change(b, 0, +note.value || 50) },
    h("option", { value: 0, text: "Free" }), NOTES.slice(0, top - 100).map((n, i) => h("option", { value: 101 + i, text: n })));
  const bpm = h("input", { type: "number", class: "ph-bpm", min: 30, max: 300, step: 0.1, inputMode: "decimal", "aria-label": "Tempo in BPM",
    onchange: () => setTempo(+bpm.value, false) });
  paints.push(() => {
    const v = cur(b, 0);
    note.value = String(v > 100 && v <= top ? v : 0);
    if (document.activeElement !== bpm && app.st.tempo !== undefined) bpm.value = String(Math.round(app.st.tempo * 10) / 10);
  });
  return h("div", { class: "ph-row ph-sync" }, h("span", { class: "ph-lab", text: "NOTE" }), note, bpm,
    h("button", { type: "button", class: "btn small", text: "TAP", title: "Tap the beat: two taps set the tempo", onclick: tapTempo }));
}

// ---- a page: one block ----
function page(b, i, n) {
  const B = blk(b), p = app.st.preset, T = typeOf(p, b), t = p.type[b];
  const sw = h("button", { type: "button", class: "switch", role: "switch", onclick: () => toggle(b) }, h("i"), h("span"));
  const sel = h("select", { "aria-label": `${B.name} type`, onchange: () => setType(b, +sel.value) }, B.types.map((x, j) => h("option", { value: j, text: x.name })));
  const one = B.types.length < 2;
  sel.disabled = one;
  const inScenes = h("div", { class: "ph-in", role: "group", "aria-label": `${B.name} in the scenes` });
  const el = h("section", { class: "ph-page", "data-b": b, "aria-label": `${B.name}, ${i + 1} of ${n}` },
    h("div", { class: "ph-head" }, h("span", { class: "swatch", "aria-hidden": "true" }), h("h2", { class: "ph-name", text: B.name }),
      h("span", { class: "ph-pos", text: `${i + 1} of ${n}` }), sw),
    inScenes,
    h("div", { class: "type" },
      h("button", { type: "button", "aria-label": "Previous type", disabled: one, onclick: () => setType(b, p.type[b] - 1) }, "‹"), sel,
      h("button", { type: "button", "aria-label": "Next type", disabled: one, onclick: () => setType(b, p.type[b] + 1) }, "›")));
  const faders = [];
  T.params.forEach((P, k) => {
    if (gtSplit(b, k)) { el.append(...gtRows(b, k)); return; }
    const opts = paramChoices(b, t, k, P);
    if (opts) { el.append(choiceRow(b, k, P)); return; }
    faders.push(fader(b, k, P));
    if (k === 0 && notesOn(b, t)) el.append(noteRow(b));
  });
  if (faders.length) el.append(h("div", { class: "ph-faders" }, faders));
  if (!T.params.length) el.append(h("p", { class: "dim", text: "This type has no settings." }));
  paints.push(() => {
    const on1 = !!app.st.preset.on[b];
    el.style.setProperty("--c", on1 ? B.color : "var(--faint)");    // (its faders grey while it is off;
    el.style.setProperty("--bc", B.color);                            // its scenes keep its colour)
    sw.setAttribute("aria-checked", on1 ? "true" : "false");
    sw.setAttribute("aria-label", `${B.name} ${on1 ? "on" : "off"}`);
    sw.lastChild.textContent = on1 ? "On" : "Off";
    if (document.activeElement !== sel) sel.value = String(app.st.preset.type[b]);
    paintInScenes(inScenes, b);
  });
  return el;
}
// the scenes a block is on in; the scene playing (underlined) is the block's own On
const scKey = (sc) => `${sc.cur}|${[0, 1, 2, 3].map((n) => `${sceneShort(n)}:${sceneKnown(n) ? sceneMask(n) : "-"}`).join()}`;
function paintInScenes(row, b) {
  const sc = scenesNow();
  row.hidden = !sc;
  if (!sc) return;
  const key = scKey(sc);
  if (row.dataset.key === key) return;
  row.dataset.key = key;
  fill(row, h("span", { class: "ph-lab", text: "In scenes" }), [0, 1, 2, 3].map((n) =>
    h("button", { type: "button", class: n === sc.cur ? "now" : "", "aria-pressed": sceneKnown(n) && (sceneMask(n) >> b) & 1 ? "true" : "false",
      "aria-label": `${blk(b).name} in ${sceneTitle(n)}${n === sc.cur ? ", playing" : ""}`, text: sceneShort(n), onclick: () => toggleScene(n, b) })));
}

// ---- above and below the pages ----
function sceneBar() {
  const wrap = h("div", { class: "ph-scenes", role: "group", "aria-label": "Scenes" });
  paints.push(() => {
    const sc = scenesNow();
    wrap.hidden = !sc;
    if (!sc) return;
    const order = app.st.preset.order, key = scKey(sc);
    if (wrap.dataset.key === key) return;
    wrap.dataset.key = key;
    fill(wrap, [0, 1, 2, 3].map((n) => {
      const now = n === sc.cur, known = sceneKnown(n), m = sceneMask(n);
      return h("button", { type: "button", class: `ph-sc${now ? " on" : ""}${known ? "" : " empty"}`, "aria-pressed": now ? "true" : "false",
        "aria-label": `${sceneTitle(n)}${now ? ", playing" : known ? "" : ", not stored"}`, onclick: () => recallScene(n) },
        h("span", { class: "ph-scn", text: sceneTitle(n) }),
        h("span", { class: "ph-dots", "aria-hidden": "true" }, order.map((x) => h("i", { class: known && (m >> x) & 1 ? "on" : "", style: `--c:${blk(x).color}` }))));
    }), h("button", { type: "button", class: "ph-scedit", "aria-label": "Edit the scenes", title: "Edit the scenes", onclick: () => openScenes(sc.cur) }, pencil()));
  });
  return wrap;
}
function strip() {
  const order = app.st.preset.order;
  const el = h("div", { class: "ph-strip", role: "group", "aria-label": "The chain: a block's page" }, order.map((b, i) =>
    h("button", { type: "button", class: "ph-chip", "data-b": b, style: `--c:${blk(b).color}`, text: blk(b).label,
      "aria-label": `${blk(b).name}, ${i + 1} of ${order.length}`, onclick: () => goTo(b, true) })));
  paints.push(() => {
    for (const c of el.children) {
      const b = +c.dataset.b;
      c.classList.toggle("on", !!app.st.preset.on[b]);
      c.classList.toggle("cur", b === shown());
    }
  });
  return el;
}
// the preset's level (the GT block's PRESET LVL), at the bottom of every page
function dock() {
  const b = blockIndex("GT");
  if (b < 0) return null;
  const k = LVL_K, val = h("span", { class: "ph-v" });
  const fill1 = h("i", { class: "ph-fill" }), mark = h("i", { class: "ph-mark" });
  const track = h("div", { class: "ph-track", role: "slider", tabIndex: 0, "aria-label": "Preset level", "aria-valuemin": "0", "aria-valuemax": "100" },
    fill1, mark, h("span", { class: "ph-fine", text: "FINE" }));
  const show = (v) => {
    const s = savedValue(b, k);
    val.textContent = levelText(v);
    fill1.style.inlineSize = `${v}%`;
    mark.hidden = s === null;
    if (!mark.hidden) mark.style.insetInlineStart = `${s}%`;
    track.setAttribute("aria-valuenow", String(v));
    track.setAttribute("aria-valuetext", val.textContent);
  };
  const set = (v) => { change(b, k, v); show(v); };
  const el = h("div", { class: "ph-line" },
    h("div", { class: "ph-lv" }, h("span", { class: "ph-lab", text: "Level" }), val),
    stepper(-1, "Preset level down 0.3 dB", () => set(clamp(cur(b, k) - 1))), track,
    stepper(1, "Preset level up 0.3 dB", () => set(clamp(cur(b, k) + 1))));
  dragger(track, "x", () => cur(b, k), set, el);
  backToSaved(val, b, k, set, "Level");
  paints.push(() => { if (held !== el) show(cur(b, k)); });
  return h("div", { class: "ph-dock" }, el);
}

// ---- the pages, swiped ----
const pager = () => box && box.querySelector(".ph-pager");
function shown() {
  const pg = pager();
  if (!pg || !pg.clientWidth) return app.focus;
  const b = app.st.preset.order[Math.round(pg.scrollLeft / pg.clientWidth)];
  return b === undefined ? app.focus : b;
}
function goTo(b, smooth) {
  const pg = pager(), i = app.st.preset.order.indexOf(b);
  if (!pg || i < 0) return;
  current = b;
  pg.scrollTo({ left: i * pg.clientWidth, behavior: smooth && !reduce.matches ? "smooth" : "auto" });
  if (!smooth) settle();
}
// a block's page put in view at once: now, and again once the layout has settled (a phone turned upright, a new size)
function place(b) {
  const pg = pager(), i = app.st.preset.order.indexOf(b);
  if (!pg || i < 0) return;
  current = b;
  placed = Date.now();
  pg.scrollLeft = i * pg.clientWidth;
}
function placeSoon(b) { place(b); setTimeout(() => { if (app.st && b === current) place(b); }, 80); }
// a page that stays after a swipe: the block is the editor's (and the pedal's) block in focus
function settle() {
  if (!app.st) return;
  paint();
  if (Date.now() - placed < 400) return;
  const b = shown();
  current = b;
  if (b !== app.focus) setFocus(b);
}

// ---- building, showing ----
function signature() {
  const p = app.st.preset, ed = app.ed || {};
  const names = [app.nam ? app.nam.models.map((m) => `${m.name}${m.used ? "" : "-"}`).join("|") : "", app.irs ? app.irs.map((m) => `${m.name}${m.used ? "" : "-"}`).join("|") : ""];
  return [p.order.join(), p.type.join(), names.join("/"), !!ed.hasTempo, !!ed.hasInputPerPreset, !!scenesNow()].join(";");
}
function build() {
  if (!box) {
    box = h("div", { class: "ph", id: "ph" });
    $("view-sound").querySelector(".phead").after(box);
  }
  const keep = current !== null && app.st.preset.order.includes(current) ? current : app.focus;
  paints = []; held = null;
  const order = app.st.preset.order;
  const pg = h("div", { class: "ph-pager", "aria-label": "The blocks, one a page: swipe sideways" }, order.map((b, i) => page(b, i, order.length)));
  pg.addEventListener("scroll", () => { clearTimeout(settleT); settleT = setTimeout(settle, 120); }, { passive: true });
  fill(box, sceneBar(), strip(), pg, dock());
  sig = signature();
  placeSoon(keep);
  paint();
}
function paint() {
  if (!box || !app.st) return;
  for (const p of paints) p();
  box.inert = comparing();
}
function render(o = {}) {
  if (!PHONE.matches || !app.st || !app.cat || !(app.conn === "ready" || app.conn === "lost")) return;
  if (!box || o.force || signature() !== sig) build();
  else paint();
  // a block chosen on the pedal: its page
  if (o.push && app.focus !== shown()) goTo(app.focus, true);
}
function hintOnce() {
  let n = 0;
  try { n = +(localStorage.getItem(HINT_KEY) || 0); } catch (_) { }
  if (n >= 3) return;
  say("Swipe sideways for the next block. Drag a fader up or down; slowly for single steps.", "info");
  try { localStorage.setItem(HINT_KEY, String(n + 1)); } catch (_) { }
}

// ---- the scenes, one at a time, in a dialog ----
let dlg = null, dlgN = 0;
function openScenes(n) {
  dlgN = n;
  if (!dlg) {
    dlg = h("dialog", { class: "dlg ph-scdlg", "aria-label": "Scenes" });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
  }
  drawScenes();
  if (!dlg.open) dlg.showModal();
}
function drawScenes() {
  const sc = scenesNow();
  if (!dlg) return;
  if (!sc) { if (dlg.open) dlg.close(); return; }
  fill(dlg,
    h("div", { class: "ph-dh" }, h("h2", { text: "Scenes" }), h("button", { type: "button", class: "btn primary small", text: "Done", onclick: () => dlg.close() })),
    h("div", { class: "ph-sctabs", role: "tablist", "aria-label": "Scenes" }, [0, 1, 2, 3].map((n) =>
      h("button", { type: "button", role: "tab", class: n === sc.cur ? "now" : "", "aria-selected": n === dlgN ? "true" : "false",
        text: sceneTitle(n), onclick: () => { dlgN = n; drawScenes(); } }))),
    h("div", { class: "dlg-body" }, sceneForm(dlgN),
      h("p", { class: "dim small", text: "Save the preset to keep its scenes; playing a scene is not a change. A name of up to 3 characters shows on the pedal in place of SCENE n." })));
}

export function initPhone() {
  const apply = () => {
    document.body.classList.toggle("phone", PHONE.matches);
    current = app.focus;                                          // (the block in focus, whatever was swiped before)
    if (PHONE.matches) { render({ force: true }); if (app.conn === "ready") hintOnce(); }
    else if (app.st && app.conn === "ready") emit("state", {});     // (the wide section drawn again, with what changed here)
  };
  PHONE.addEventListener("change", apply);
  on("state", (o) => render(o || {}));
  on("compare", () => render({ force: true }));
  on("assets", () => render({ force: true }));
  on("bank", () => { if (PHONE.matches) paint(); });
  on("scenes", () => { if (PHONE.matches) { paint(); if (dlg && dlg.open) drawScenes(); } });
  on("conn", () => {
    sig = ""; current = null;
    if (app.conn !== "ready" && dlg && dlg.open) dlg.close();
    if (app.conn === "ready" && PHONE.matches) hintOnce();
  });
  // the Sound tab shown again, another size: the page in focus (the pages had no width, or another, meanwhile)
  on("view", () => { if (PHONE.matches && app.view === "sound" && box && app.st) placeSoon(app.focus); });
  addEventListener("resize", () => { if (PHONE.matches && box && app.st) placeSoon(app.focus); });
  document.body.classList.toggle("phone", PHONE.matches);
}
