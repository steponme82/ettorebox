# ettorebox manual

ettorebox is guitar firmware for the M-VAVE BlackBox, built on [OpenPocket](https://github.com/isod89/openpocket). This
manual covers beta 54: installing it, every control and page of the pedal, the sounds, presets and scenes, controllers,
Bluetooth, USB, the web editor, and what is inside. Up to beta 51 the pedal showed OpenPocket's name (start-up screen,
Bluetooth, USB); beta 53 made the GT page the preset's input ([4](#the-presets-input-the-gt-page)), with an input check that
tells you, and sets, the level your guitar needs ([4](#the-input-check)); beta 54 gave the two footswitches three modes
([The footswitches' three modes](#the-footswitches-three-modes)) and steadied LOW OCTAVE's high notes.

It is a beta. Keep M-VAVE's own firmware file at hand, and read [Before you install](#before-you-install) first.

**Contents**

1. [Getting started](#1-getting-started)
2. [The controls](#2-the-controls)
3. [The screens](#3-the-screens)
4. [Sounds](#4-sounds)
5. [Presets and scenes](#5-presets-and-scenes)
6. [Controllers: the Chocolate and MIDI](#6-controllers-the-chocolate-and-midi)
7. [Bluetooth](#7-bluetooth)
8. [USB](#8-usb)
9. [The web editor](#9-the-web-editor)
10. [SETTINGS, row by row](#10-settings-row-by-row)
11. [Troubleshooting](#11-troubleshooting)
12. [Inside ettorebox](#12-inside-ettorebox)
13. [What it leaves out](#13-what-it-leaves-out)

## 1. Getting started

### Before you install

- **Not on a BlackBox with M-VAVE's firmware V22 or later.** V22 moved the app area of the flash from `0x4000` to
  `0x6000`, behind a bigger boot loader. Writing the old layout over it overwrites that boot loader and the pedal stays
  dark. The installer page refuses a pedal that reports V22 or later, and the pedal's update loader checks the flash
  itself and refuses before writing anything. A pedal that went dark this way after OpenPocket can be brought back:
  [RESCUE.md](RESCUE.md), "After OpenPocket over M-VAVE's V22 or later".
- **Keep a way back:** M-VAVE's firmware file for your pedal, downloaded from M-VAVE.
- **BlackBox only for now.** The Donner Pocket X has the same chip, but ettorebox has not been tried on one.
- Your saved sounds, NAM captures and cabinet IRs survive installs and updates: an update writes the app area only.

### Install

1. Open **https://steponme82.github.io/ettorebox/** in Chrome or Edge on a computer (Windows, macOS, Linux or
   ChromeOS: the page needs Web MIDI).
2. Switch the pedal on and plug it in with a **data** USB cable. Close any other program that uses it (M-EFCS, a DAW,
   another tab).
3. Press **Connect** and allow MIDI access. The page finds the pedal and says what it runs (M-VAVE's firmware, OpenPocket
   or ettorebox).
4. Press **Install**. It takes one to two minutes: do not unplug or switch the pedal off, keep the tab open. The steps
   light up as they go: start, check, loader, write, restart, done. Nothing is written before the pedal has checked the
   whole package.
5. The pedal restarts. Its start-up screen reads **`ETTOREBOX`** and **`BETA 53  OPENPOCKET V42`** (the OpenPocket
   version it is built on).

From the command line instead, with the repository cloned:

```bash
gh release download beta-53 -R steponme82/ettorebox -D build/bt --clobber
```

```bash
make serve-bt
```

Then the same steps on the address it prints.

### Update, and go back

- **Update:** the same page, **Install** again. Presets and models stay.
- **Back to M-VAVE's firmware:** the page's step 3, "Back to the official firmware": pick M-VAVE's `.fwsc` file. It is
  checked in your browser and sent to no server.
- **An install cut short** (the pedal stays in update mode): plug it in again, **Connect**, and press **Resume the
  update**.
- **A pedal that restarts in a loop:** the page's rescue mode ("Rescue and advanced options": tick it, Connect, then plug
  the pedal in). If that cannot finish: [RESCUE.md](RESCUE.md) restores it from a Mac or Linux computer through the chip's
  own USB recovery mode.

## 2. The controls

The BlackBox has two footswitches, the PARA knob (turn it, and press it: PUSH), the MASTER knob, and seven buttons:
HOME, FX, AMP, CAB, MOD, DLY and REV.

PUSH, HOME, FX and CAB act when you **let go**, because they also have a **hold**. The other buttons and the footswitches
act as soon as you press them.

| Control | Press | Hold |
| --- | --- | --- |
| **PARA knob** | Turn: pick a block on PLAY, a row on a block's page, change the value you are editing (turn fast: steps of 5) | |
| **PUSH** (press the knob) | PLAY: open the selected block's page. On a row: edit it (on ON: switch the block on or off). While editing: done. **Press twice quickly** on PLAY: MOVE the block | **0.8 s: SAVE** |
| **HOME** | Back to PLAY. On PLAY: the preset list | **0.7 s: the tuner**; keep holding (1.4 s): **diagnostics** |
| **FX** | The next block of FX's group (DRV, SFX, SYN, PIT, CMP, GT, EQ), in the preset's order | **0.8 s**: on PLAY, **SETTINGS**. On a block's row: **learn a controller** on it, or clear the one it has. On MODEL: the preset's MIDI table. On GT's INPUT (or SETTINGS' INPUT): the **input check**. In SCENES' view: learn (or clear) the selected scene's switch |
| **AMP, MOD, DLY, REV** | Open the block's page; press again: switch it on or off | |
| **CAB** | Open the CAB page; press again: on or off | **0.8 s: PLAY's next view** (CHAIN, SWITCHES, SCENES) |
| **Right / left footswitch** | Next / previous preset (from a block's page it also goes back to PLAY). In SCENES' view: the next / previous scene. In STOMP (SWITCHES' view): what it is learned on in this preset, else the next / previous preset. On SETTINGS: the next / previous row | |
| **Both footswitches** | Let go at once: **the footswitches' next mode**, PRESETS, STOMP, SCENES ([5](#the-footswitches-three-modes)). The second within 0.15 s of the first; the first one's step is taken back | **0.7 s: the tuner** |
| **Left footswitch, a SYN PAD on** | Catch the chord you are playing (it no longer goes to the previous preset) | **0.7 s: the pad fades out** |
| **MASTER** | The output volume (`VOL` on PLAY) | |

Coming back to a preset you edited without saving gives your edit back (one edit is kept).

### The button lights

| Light | Lit while |
| --- | --- |
| FX | any block of FX's group is on (drive, SFX, synth, pitch, comp, gate, EQ) |
| AMP, MOD, DLY, REV, CAB | that block is on |
| HOME | it blinks while the tuner is open |

### Keys held at power-on

Hold one while switching the pedal on, until the start-up screen has gone. It counts for that start only.

| Key | That start |
| --- | --- |
| **CAB** | One core: the effects run on the main core only (the way out if a start on two cores ever fails) |
| **DLY** | No footswitch search: the pedal does not look for the Chocolate |
| **REV** | Bluetooth off: to compare the sound with and without the radio |

## 3. The screens

### PLAY

The main screen.

- **The top bar:** `VOL` (the MASTER knob's volume) on the left; the battery in the middle (green; amber at 30 % and
  below, red at 15 % and below; `USB` on the 5 V supply); on the right, Bluetooth's state and the DSP load, `BT PLAY 42%`.
  Bluetooth's state: `BT START` (starting), `BT VISIBLE` (a phone can find it), `BT LINK` (a phone is linked), `BT PLAY`
  (music is playing). The load turns amber above 80 %, red with `!` when a block ran late.
- **The preset:** its number, big; beside it the amp (a NAM amp shows its model; `NO AMP` when off) and the cabinet
  (`NO CAB` when off). Beside the cabinet: **`EDITED`** when the sound differs from its saved slot (the footer then reads
  `HOLD: SAVE`); else, in a preset with scenes, the scene playing (its name, or `SCENE 2`). The preset's name below.
- **The chain:** a tile for each block, in the preset's order, filled when on, dark when off; the selected block's name
  and model under them.
- **The right edge:** in a preset with a two-job expression pedal, a line says its job: **green** the volume, **red** the
  effect's setting ([6.4](#64-the-two-job-expression-pedal)). It shows on the block pages too.
- **The footer:** what PUSH and the holds do here.

**Overload guard:** if the DSP ever runs over the safety limit, the effects are bypassed until the next change. A red bar
says `OVERLOAD: SOUND BYPASSED`, and the footer says `TURN A BLOCK OFF`.

**Hold CAB** to turn PLAY's view round. Both footswitches turn it too, and with it what the footswitches do
([The footswitches' three modes](#the-footswitches-three-modes)):

- **CHAIN:** as above.
- **SWITCHES:** what each controller switch does in this preset, in big tiles: a block (lit when on) or a scene (lit while
  it plays), the pedal's own footswitches first (`FOOT L`, `FOOT R`), then the switches' order. Turning the knob shows the
  chain for 5 seconds.
- **SCENES:** the preset's four scenes, the one playing lit, the knob's in a ring, each with its switch's number. The knob
  picks one, PUSH recalls it, hold FX learns its switch. Here holding FX does not open SETTINGS: hold CAB back to CHAIN
  first.

The view is kept with the settings at the next save.

### A block's page

The block's band on its colour (with the preset's number), then its rows: **ON**, **MODEL**, and up to five settings, each
with its value and a bar. Values show in real units where a bare number would mean little (`450 MS`, `+5TH`, `+1.5 DB`).
A setting that has a controller learned on it shows its number after its name (`GAIN CC4`). The DSP load sits at the
bottom right. While a NAM model loads, MODEL reads `LOADING`. The GT page has six rows, a little shorter: the gate's, then
the preset's input ([4](#the-presets-input-the-gt-page)).

### The preset list

HOME on PLAY. The knob browses the presets by name without loading them, PUSH loads the one in the middle, HOME goes back.
The playing preset's number is amber.

### MOVE

Press PUSH twice quickly on PLAY: the selected block is grabbed. The knob moves it along the chain, PUSH drops it, HOME puts
it back. Each preset keeps its own order.

### SAVE

Hold PUSH. The knob picks the slot (1 to 52; it starts on the current one, and names the sound a slot holds, which saving
there replaces), PUSH saves, HOME cancels. A sound saved into another slot keeps its name (`NAME STAYS: RENAME IN THE
EDITOR`). Past slot 52, **RESTORE FACTORY** puts the current slot back to its factory sound (on a slot that already holds
it, PUSH does nothing). The sound mutes for about 0.1 s while it saves. The pedal starts on the slot saved last.

### Tuner and diagnostics

Hold HOME (or hold both footswitches 0.7 s): the tuner. The note, how far off in cents, and an arrow towards in tune. Your
guitar is muted; the phone's music keeps playing. Any button or footswitch leaves.

Keep holding HOME (or hold it again on the tuner): **diagnostics**, the two pages a bug report asks for a photo of. The
knob turns between them, any button leaves, the sound plays.

- **Page 1, the DSP:** the load against the safety limit, the peak, which cores ran, blocks that ran late or clipped, the
  four costliest blocks.
- **Page 2, input and power:** a meter for each input channel with its clip zone, the output's clip marker, the battery in
  volts and percent.

Bluetooth's own figures are read over USB instead (`make log`, [11](#11-troubleshooting)).

### SETTINGS

Hold FX on PLAY. The knob changes the selected row, PUSH goes to the next row (after the last it leaves), the footswitches
walk the rows (right down, left up), HOME leaves. A change is heard at once and saved when you leave, only if something
changed. The page shows 8 rows at a time and scrolls with the one selected. Under them: the USB line (what is connected)
and the last MIDI message received (`LAST: CC 25 = 127`), the first thing to look at when a controller does nothing. Every
row: [10. SETTINGS, row by row](#10-settings-row-by-row).

## 4. Sounds

### The chain

Twelve blocks. Default order: `GT CMP PIT SFX SYN DRV AMP CAB EQ MOD DLY REV`; each preset keeps its own (MOVE). Each
block has a model, ON or OFF, and up to five settings (0 to 100). Switching a block or a preset, or turning a knob, glides:
no clicks.

| Block | Models |
| --- | --- |
| GT | NOISE GATE: THRESH and RELEASE, then the preset's own: **PRESET LVL** (its level: `-INF` at 0, 0 dB at 50, +15 dB at 100), **GTR TONE**, **PICKUP** and **INPUT** (below) |
| CMP | SQUASH, STUDIO, OPTO LA-2, SLOW SWELL |
| PIT | OCTAVER, POLY OCTAVE, WHAMMY (swept by its PEDAL row or the expression pedal), HARMONIZER, DETUNE, **LOW OCTAVE** (a polyphonic octave down on the low strings, as an OC-3) |
| SFX | ENVELOPE WAH, AUTO WAH, RING MOD, BITCRUSHER, SLICER, LO-FI RADIO, SQUARE SYNTH, **WAH** (a wah pedal, on the expression pedal or its PEDAL row) |
| SYN | Synths, keyboards and other guitars from your guitar, with no MIDI pickup: ORGAN, CHURCH ORGAN, STRINGS, CHOIR, MONO SYNTH, PWM SYNTH, BASS SYNTH, 12-STRING, ACOUSTIC, SITAR, BARITONE, **PAD** (SYN PAD: a chord caught on the left footswitch), **TAPE FLUTE** |
| DRV | TS9, KLON, M77 OD, SWEDE HM-2 (fitted to captures of the pedals), **TREBLE BOOST** (a germanium treble booster) |
| AMP | Eight fitted amps (TWIN, AC15 TB, JCM900, JCM2000, MARK IV, SHIRLEY, PRO MOD, 5150) and NAM, neural amp models: TWIN, AC15, JCM900, MARK IV, plus 16 slots for your own captures |
| CAB | 1x12 US OPEN, 2x12 BLUE, 4x12 GREEN, 4x12 T75, 4x12 V30, 1x12 CREAM, DI (NO CAB), USER IR (your own impulse responses, 8 slots) |
| EQ | 5 BAND, GRAPHIC 5, PARAMETRIC |
| MOD | CE CHORUS, DIMENSION, FLANGER, PHASE 90, SMALL STONE, UNI-VIBE, OPTO TREMOLO, BIAS TREMOLO, HARMONIC TREM, ROTARY, VIBRATO |
| DLY | DIGITAL, ANALOG BBD, MEMORY MAN, TAPE EP-3, SPACE ECHO, REVERSE, LO-FI, DUAL TAP. TIME up to 780 ms (REVERSE 390 ms) |
| REV | ROOM, HALL, CATHEDRAL, PLATE, SPRING, SHIMMER (in tune), GATED, AMBIENT |

The names refer to the gear each sound is inspired by; they are digital models, not copies. Every model and setting in
detail: [SOUNDS-AND-CONTROLS.md](SOUNDS-AND-CONTROLS.md); ettorebox's own effects and what it changed:
[OWN-FX.md](OWN-FX.md); NAM: [NAM.md](NAM.md).

- **The analog and tape delays** (ANALOG BBD, MEMORY MAN, TAPE EP-3, SPACE ECHO, LO-FI) self-oscillate above FDBK about
  90, like the real ones: lower FDBK to stop it.
- **TAILS** (SETTINGS): the delay and the reverb ring out when they go off, and across a preset change.
- **LOW OCTAVE** follows the note you play: from beta 54 the high notes keep their own octave, steady, even over a single
  coil's hum, and COMP no longer adds an octave to the notes above RANGE ([OWN-FX.md](OWN-FX.md), "The top notes").
- **Levels:** every amp plays at the same loudness with GAIN at noon, and a block switched on with its knobs at noon keeps
  the loudness. PRESET LVL balances your presets. The output ends in a soft limiter, not a hard clip.
- **GUITAR TONE and PICKUP** (SETTINGS): the input loads your pickup as a real amp's input would, named by the sound
  (BRIGHT, NATURAL, SMOOTH, WARM, WARMER, PUNCHY, DARK, DARKER, MUDDY).

### The preset's input: the GT page

Everything that happens before the chain belongs to the preset, on its GT page: after the gate's THRESH and RELEASE and the
preset's PRESET LVL come three rows, each **SETTINGS** (the SETTINGS page's own row) or a value of this preset's:

- **GTR TONE**: BRIGHT, NATURAL, SMOOTH, WARM, WARMER, PUNCHY, DARK, DARKER, MUDDY: how the input loads your pickup, by
  its sound;
- **PICKUP**: SINGLE, HUMBUCK, P90, the pickup GTR TONE assumes;
- **INPUT**: -10 to +10 dB, the guitar's level into the chain (more for a weak pickup or a piezo, less for hot humbuckers).

The knob steps one item a detent and stops at the ends. A preset per guitar, a brighter preset for some songs: set them
here. A scene can have its own tone and its own INPUT step over the preset's ([5](#scenes)): a piezo scene on NATURAL and
+9 dB in a preset on MUDDY. Which wins: the scene's tone, then the preset's, then SETTINGS'. Changes glide in 24 ms, with no
click. Every factory preset says SETTINGS in all three, so nothing changes until you set one; they act whether the gate is
on or off. GTR TONE and PICKUP take no controller (`NOT FOR A CONTROLLER`): scenes switch the tone.

### The input check

The amps and drives were voiced for one level: a guitar played hard reaching about -16 dB into the chain (a sixth of full
scale). The pedal listens to your guitar and tells you how far you are from it:

- **Select GT's INPUT row and play hard.** The bottom line says `LOW +6 DB`, `GOOD`, `HOT -3 DB`, or `CLIPS: GUITAR DOWN`
  (the guitar clips the converter before INPUT: only the guitar's volume can help). After the verdict, the blocks of this
  preset that react to the level: `LOW +6 DB: AMP DRV`; `CLEAN` where none does, and there INPUT is just volume (balance
  with PRESET LVL). A preset with MONO SYNTH, PWM SYNTH, BASS SYNTH or TAPE FLUTE aims 4 dB higher: their note follower
  likes a strong signal. While you turn INPUT, the line follows.
- **Hold FX on INPUT: the pedal sets it.** The INPUT CHECK page says `PLAY HARD`, listens for 4 seconds from your first note,
  then shows what it found and what it will set. PUSH sets it, HOME leaves things as they were. While a scene plays, the
  knob picks where it goes: **THE PATCH** (the GT page's INPUT) or **THIS SCENE** (its INPUT step). SAVE keeps it.
- **SETTINGS' INPUT row** has the same check and the same hold of FX: it sets your guitar's level for every preset left on
  SETTINGS.

Gain staging, the easy way: one input check on SETTINGS for your main guitar; then, only where it's needed, one on a
preset (another guitar, a synth sound) or a scene (a piezo).

### The general EQ: every preset at once

A room, a PA, a small speaker or a pair of headphones each colour the sound. SETTINGS' general EQ makes up for it in every preset
at once, so you don't touch the presets themselves. It sits at the very end, after the whole chain and before the volume.
Five rows on SETTINGS, after PICKUP:

- **EQ BASS:** -12 DB to +12 DB, a shelf at 100 Hz (the boom of a room, a speaker's missing lows).
- **EQ MID:** -12 DB to +12 DB, a peak or a dip at **EQ MID FREQ** (160 HZ to 5000 HZ), as wide as **EQ MID WIDTH** says
  (VERY WIDE, WIDE, MEDIUM, NARROW, VERY NARROW). A narrow dip takes out one resonance; a wide one a whole region.
- **EQ TREBLE:** -12 DB to +12 DB, a shelf at 3.5 kHz (a dull PA, harsh headphones).

All three at 0 DB is off: nothing is done to the sound. The EQ shapes the guitar only: the phone's music goes around it,
and so does GTR+BASS's bass on the right. In STEREO both sides get it. Cut rather than boost where you can: a boost also
raises the level, which reaches the output's limit sooner. A change is heard at once and kept when you leave SETTINGS; the
editor has the same rows.

### Factory presets

1 to 24 are factory sounds (clean, crunch, lead, high gain, effects). 25 to 52 are USER slots to build your own, each a
clean NAM TWIN, a 1x12 and a little room to start from.

## 5. Presets and scenes

### Presets

52 slots. Load them with the footswitches, the preset list, Program Change 0 to 51, or CC 118 / 119. Save with a long
PUSH. Rename them in the web editor. A sound saved into another slot takes its learned controls, its scenes and their
names along; a slot restored to its factory sound loses them.

### Scenes

Like Helix's snapshots: four scenes a preset, each a set of blocks on and off. Recalling one switches the blocks at once
(each fades, as by hand).

- **Recall:** CC 65 to 68 (any value) from a controller; a Chocolate switch learned on a scene; the footswitches in SCENES'
  view; or the knob and PUSH there.
- **What a scene keeps:** the scene playing keeps what you switch while it plays: go to another scene and back, it is as
  you left it. A scene never stored begins as things are when you first recall it. **SAVE** writes the preset with its
  scenes, and it opens in the scene it was saved in. Recalling a scene is not an edit; switching a block in it is
  (`EDITED` until SAVE).
- **Names:** up to 3 letters each (`VRS`, `CHS`, `SOL`), typed in the web editor; shown on the tiles and on PLAY. A name
  typed makes the preset `EDITED`: SAVE keeps it.
- **Scenes and switches:** a block can have its own switch and be in the scenes too. SETTINGS' **SCENE+SWITCH** decides:
  **SWITCH WINS** (the default: the switch owns that block, scenes set the others) or **SCENE WINS** (scenes set it too;
  the switch's change lasts until the next scene).
- **The footswitches in SCENES' view:** SETTINGS' **SCENE FOOTSW**: **SCENES** (the default) or **PRESETS**. In a preset
  with no scene yet they step the presets: make the first with the knob and PUSH (or in the web editor).
- **Tone and input:** each scene can have a guitar tone of its own (the web editor's scenes grid, TONE: **Preset**, or one
  of the nine), over the preset's GTR TONE, and an INPUT step over the preset's INPUT (INPUT: **Patch**, or -6, -3, +3, +6,
  +9, +12, +15 dB; or the input check while the scene plays). SAVE keeps them with the scene.

A good start with a Chocolate's four switches: two scenes and two blocks.

### The footswitches' three modes

Press both footswitches and let go: they go to their next mode, and PLAY's view with them. The footer says which
(`FOOTSW: STOMP`). Hold both 0.7 s instead for the tuner.

| Mode | PLAY's view | The footswitches |
| --- | --- | --- |
| **PRESETS** | CHAIN | the next / previous preset |
| **STOMP** | SWITCHES | each one switches what it is learned on in this preset; one with nothing learned steps the presets |
| **SCENES** | SCENES | the next / previous scene; in a preset with no scene yet, the presets |

- **Always the three in turn**, in every preset. One the preset has nothing for (no footswitch learned, no scene yet) says
  so in amber, `FOOTSW: STOMP (EMPTY)`, and there the footswitches step the presets.
- **A footswitch for STOMP:** learn it as a controller's switch ([6.3](#63-learning-a-control-on-the-pedal)). On a block's
  page select ON, hold FX, PUSH, and press the footswitch (`LEARNED: FOOT L`). Learn the same footswitch on more blocks and
  they go together: all on if the first is off, else all off. For example a 12-STRING and a chorus on the left, a boost on
  the right.
- **A scene on a footswitch:** in SCENES' view hold FX on the scene's tile and press the footswitch. In STOMP a press goes to
  that scene, the next one back to the scene before.
- **Scenes leave a footswitch's blocks to it**, as any switch's (SETTINGS' SCENE+SWITCH, [Scenes](#scenes)).
- **Each preset has its own**, kept with its learned controls (64 for all the presets together): `FOOT L` and `FOOT R` in
  its MIDI table (hold FX on MODEL) and in the web editor. Holding FX on a block's ON row clears that row only.
- **The mode** is kept with the settings at the next save, as PLAY's view is.
- Pressing both, the first footswitch acts for an instant before it is taken back: a block switched that long may be heard.

## 6. Controllers: the Chocolate and MIDI

### 6.1 The M-VAVE Chocolate over Bluetooth

The regular Chocolate is a Bluetooth peripheral only, so the pedal is its central: switch both on, and within a few
seconds the pedal finds it, links and listens to it, with no phone in between. Nothing to pair by hand.

- The Chocolate must be in a MIDI mode, the kind in which a phone lists it as "FootCtrl Bluetooth". In CubeSuite's
  "Manufacturer" mode (`CU` on its display) it is a keyboard, not a MIDI device, and the pedal skips it.
- Its switches do what they send: Program Change loads presets; Control Change is for learning, on the pedal (6.3) or in
  the editor.
- The first Chocolate the pedal links after power-on is the only one it takes until the next power-off (another player's
  Chocolate on stage is never taken).
- A Chocolate connected to a phone's app does not advertise, so the pedal cannot find it: close the app.
- Holding DLY at power-on skips the search for that start.

### 6.2 The Chocolate by USB cable

**A Chocolate Plus with its switch on H** is a USB host itself (the way it runs a Valeton GP-5): a USB-A to USB-C cable
from its HOST port to the pedal's USB-C, and the pedal stays on USB PORT **COMPUTER**, as at every power-on. The pedal reads
its switches as a computer's MIDI, so everything learned works as over Bluetooth. PLAY's battery reads `USB` while the
Chocolate gives the cable its 5 V. Checked on a pedal with the Chocolate's own USB-C powered; on its battery alone, not
yet. If a press acts twice (the Chocolate linked by Bluetooth as well), tell us.

**A footswitch that is only a USB device** (a Chocolate on U): SETTINGS' **USB PORT** on **FOOTSW** makes the pedal's USB-C port the USB MIDI host of a footswitch by cable. The pedal gives
no 5 V on its port, so an OTG adapter with a charging input goes between them, with a charger or a power bank in it (it
charges the pedal too). The setting is never saved: every power-on is the normal USB device again. While the cable's
footswitch is connected, Bluetooth MIDI is not read (no double presses). This one is new: checked on a computer, not yet
confirmed on a pedal. Details: [BT-AUDIO-TEST.md](BT-AUDIO-TEST.md), "Test build 41".

### 6.3 Learning a control on the pedal

Each preset has its own learned controls (up to 64 for all the presets together). On a block's page, select the row
(ON or a setting), then **hold FX**. A guided page walks you through it, one step at a time, with what to do in big
letters and the footer saying which control does it:

1. **PEDAL OR SWITCH:** the knob picks (a setting starts on PEDAL, ON on SWITCH), PUSH goes on.
2. **MOVE THE PEDAL** (or **PRESS THE SWITCH**): the pedal is taken at its first message; a switch is told apart in 1.2 s
   (momentary, or one message a press). The page waits as long as it takes. On ON, that is all.
3. **PEDAL AT THE HEEL** (a switch: **SWITCH OFF**): put the pedal at its heel, turn the knob to the value you want there
   (you hear it), PUSH.
4. **PEDAL AT THE TOE** (a switch: **SWITCH ON**): the same at its toe; it starts from the preset's own value, so PUSH alone
   keeps that. The pedal's own travel is kept: a pedal that sends 3 to 120 still covers the whole range. A bar above the
   footer shows where the pedal is.
5. **WHEN SFX IS OFF** (with the block's name: `WHEN PIT IS OFF` for a whammy; only for a pedal on a block's setting, not
   on GT): **VOLUME** makes it a two-job pedal (6.4), **NOTHING** keeps it on the setting only.

HOME cancels at any step (`LEARN: CANCELLED`), and nothing else acts on the page. `LEARNED: CC 7` in green says it is in;
it is written at once (an unsaved sound stays unsaved).

- On **ON**, a switch flips the block (a momentary switch on its press; one that sends a message a press, on each one), a
  pedal switches it (on at 64 and up).
- A row has one control and a control one row in a preset: learning another replaces it. The pedal's own footswitches are
  the exception: one can have several rows ([The footswitches' three modes](#the-footswitches-three-modes)).
- **The pedal's footswitches** are switches too, on ON and on a scene: pressed at PRESS THE SWITCH they are learned for STOMP
  (`FOOT L`, `FOOT R`). Not on a setting: there they do nothing.
- A selected row that has one says so (`CC 30  HOLD FX: CLEAR`): **hold FX on it to clear it.**
- **Hold FX on MODEL:** the preset's MIDI table, every control of this preset (`CC 7  SFX PEDAL +VOL`), then the editor's
  in grey (`ALL: ...`: they work in every preset). The knob picks, hold FX clears, HOME goes back.
- A preset's own control comes before the editor's, which come before the pedal's own numbers (6.5).
- Not on GT's GTR TONE and PICKUP: `NOT FOR A CONTROLLER` (a preset's set-up; a scene switches the tone). On GT's INPUT,
  holding FX opens the input check instead.

### 6.4 The two-job expression pedal

As a multi-effect's pedal with its toe switch: the volume while an effect is off, that effect's setting while it is on.
Whatever turns the effect on and off changes the pedal's job: its button, its learned switch, a scene.

- **Set it:** learn the pedal on the effect's setting (6.3); at step 5 choose **VOLUME**. It begins on VOLUME for a WAH's
  PEDAL, an AUTO WAH's CENTER and a WHAMMY's PEDAL, on NOTHING elsewhere. One a preset.
- **The effect on:** the pedal is its setting, between the heel's and the toe's values, and the volume stays at unity. A
  wah's or a whammy's sweep follows the pedal smoothly, sample by sample.
- **The effect off:** the pedal is the volume: the heel silent, the toe at unity, -18 dB half way. Turned off with the pedal
  anywhere, the volume stays at unity until the pedal moves (a wah left at the heel does not silence the next song).
- **The line** at the screen's right edge: **green** the volume, **red** the effect.
- **Where the volume acts:** SETTINGS' **VOL PEDAL**. **AT INPUT** (the default) works like your guitar's volume knob: a
  drive cleans up as you pull back, and the level drops mostly near the heel. **BEFORE DLY** keeps the tone: half way is
  18 dB down at any gain. The delay's repeats and the reverb's tail ring on in both.
- A preset without one does what its pedal learned, for example PRESET LVL from `-INF` to `+4.2 DB` (a volume pedal at the
  chain's end, which takes the tails down with it).

### 6.5 The pedal's own MIDI numbers

From any controller, over Bluetooth or USB, on SETTINGS' CHANNEL (OMNI by default):

| Message | Does |
| --- | --- |
| Program Change 0 to 51 | load preset 1 to 52 |
| CC 7 | MASTER volume |
| CC 8 to 19 | flip a block on or off (SETTINGS' SWITCH: MOMENT or LATCH) |
| CC 20 to 31 | a block on (64 and up) or off |
| CC 52 to 63 | a block's model |
| each setting's own number | that setting, 0 to 127 as 0 to 100 (the table: [MIDI.md](MIDI.md)); not GT's GTR TONE + PICKUP and INPUT: CC 36 and 37 do nothing |
| CC 64 (64 and up) | a SYN PAD catches the chord |
| CC 65 to 68 (any value) | recall scene 1 to 4 |
| CC 116 (64 and up) | a tap of the delay's tempo |
| CC 117 | the expression pedal: a WHAMMY when on, else a WAH or AUTO WAH when on, else the volume |
| CC 118 / 119 (64 and up) | next / previous preset |

With SETTINGS' SEND on, the pedal sends Program Change and Control Change for what you do on it. With CLOCK > DELAY on,
a computer's MIDI clock sets the delay's time.

## 7. Bluetooth

### Music from your phone

1. On the phone, **Settings > Bluetooth**: **ettorebox** appears under other devices. Tap it: it pairs with no PIN.
2. Play music: it comes out of the pedal's output, mixed with your guitar, after the MASTER volume. The phone's own volume
   sets its level. It keeps playing in the tuner.
3. The pairing is kept across power-offs, and at power-on the pedal calls the last phone back (once the Chocolate has
   linked, or after 20 s).

The music is mono, unless SETTINGS' **OUTPUT** is on STEREO. **BT POWER** (HIGH, MID, LOW) sets the radio's transmit power.
Holding REV at power-on starts without Bluetooth. There is no play or pause from the pedal: use the phone.

If you paired the pedal under its old name (OpenPocket, up to beta 51), the phone reconnects by itself but may keep the old
name until it reads it again: forget the pedal and pair again if you want the new name.

### The editor over Bluetooth

The web editor also reaches the pedal over Bluetooth MIDI, beside the Chocolate and the music:

- **iPhone, iPad:** Safari has no Web MIDI. Open the editor in a Web MIDI browser such as **MIDIWeb**, connect
  **ettorebox** from its Bluetooth MIDI panel, then press **Connect** on the page.
- **Android:** the editor in Chrome, **Connect**. If it does not find the pedal, connect **ettorebox** with a BLE MIDI app
  first, leave it connected, and press Connect again.
- **Mac:** unplug the pedal's USB cable, then **Audio MIDI Setup**, **Window > Show MIDI Studio**, the Bluetooth button:
  **ettorebox**, **Connect**. Then the editor in Chrome.

The first connection reads the pedal's catalogue: about 20 s over Bluetooth, then the browser keeps it.

### What runs at once

One phone for music (A2DP), the Chocolate (the pedal as its central) and the editor (a second Bluetooth LE link), together.

## 8. USB

- **MIDI over USB:** the pedal is a USB MIDI device named **ettorebox**. Everything in 6.5 works over it.
- **USB audio:** SETTINGS' **USB AUDIO** on makes the pedal a USB sound card too (2 channels, 16 bit, 44.1 kHz, no driver
  on macOS, Windows, iOS and iPadOS). It is applied when you leave SETTINGS, and the pedal leaves USB for a second.
  - **USB SEND**, what the computer records: OUTPUT (the pedal's sound), DI (your guitar as it enters the chain), or
    DI + OUT (the DI left, the pedal right).
  - **USB RETURN**, where the computer's sound comes in: OUTPUT, INPUT (through the whole chain), or right before a block
    of the preset (the knob walks the chain).
  - **GUITAR**: MIX, or CUT (only the computer's sound goes on from the return's place, while the computer plays).
  - Guitar to MIDI: the DI to the computer, its synth back before the pedal's delay and reverb, the guitar cut.
  - Reamping: record a DI take, then play it back with USB RETURN on INPUT and GUITAR on CUT, and record OUTPUT.

  Details: [USB-AUDIO.md](USB-AUDIO.md) and [BT-AUDIO-TEST.md](BT-AUDIO-TEST.md), "Test build 43".

## 9. The web editor

**https://steponme82.github.io/ettorebox/editor.html**, over USB (Chrome or Edge on a computer) or over Bluetooth (7). Press
**Connect**: it finds the pedal by its name.

- **Presets:** the list (search, All, Yours, Factory), **Import**, **Back up all**.
- **Sound:** the preset on the pedal: its name (rename it here), its chain (drag a block to move it; arrow keys choose, Space
  switches, Alt + arrows move), each block's model and settings (the GT block's GTR TONE, PICKUP and INPUT as lists), the
  four scenes under the chain (a tap recalls one, a grid sets their blocks, TONE and INPUT, a field names them), its
  **Level** (PRESET LVL), **Compare**, **Revert**, **Save**, **Save as…**.
- **Models and cabinets:** the 16 NAM capture slots and the 8 IR slots: amp captures from TONE3000 or your files, cabinet
  IRs from your WAV files, which presets use a slot, rename, move, remove.
- **MIDI:** what is connected and what it sends, the pedal's map named for the current preset, the controls learned in the
  editor (up to 8, kept in the pedal, in every preset), the preset's own (their heel and toe, and the box **or VOLUME when
  SFX is off**), and these settings: SWITCH, INPUT, TAILS, BT POWER, OUTPUT, USB SEND, USB RETURN, GUITAR, GUITAR TONE,
  PICKUP, PLAY VIEW, the two scene rows, **Volume pedal** and the **general EQ**. CHANNEL, SEND, CLOCK > DELAY, USB AUDIO and USB PORT
  are set on the pedal.

Keys: `/` searches the presets, `[` and `]` step to the previous and next one, Ctrl or ⌘ + S saves, F2 renames the preset
chosen in the list. The connection's details (click the pill at the top right) name the firmware: `ettorebox (OpenPocket
v42 FX8)`.

The protocol: [EDITOR-PROTOCOL.md](EDITOR-PROTOCOL.md) (protocol 8 for this firmware).

## 10. SETTINGS, row by row

| Row | Values | Default | What it does |
| --- | --- | --- | --- |
| CHANNEL | OMNI, 1 to 16 | OMNI | the MIDI channel the pedal listens and sends on |
| SEND | ON, OFF | ON | the pedal sends Program and Control Change for what you do on it |
| CLOCK > DELAY | ON, OFF | OFF | a computer's MIDI clock sets the delay's time |
| SWITCH | MOMENT, LATCH | MOMENT | how CC 8 to 19 flip a block: MOMENT for a switch that sends 127 then 0 when let go, LATCH for one that sends one message a press |
| PLAY VIEW | CHAIN, SWITCHES, SCENES | CHAIN | PLAY's view, and so the footswitches' mode (also: hold CAB, or both footswitches) |
| SCENE+SWITCH | SWITCH WINS, SCENE WINS | SWITCH WINS | whether scenes set a block that has its own switch |
| SCENE FOOTSW | SCENES, PRESETS | SCENES | what the footswitches do in SCENES' view |
| VOL PEDAL | AT INPUT, BEFORE DLY | AT INPUT | where the expression pedal's volume acts |
| INPUT | -10 DB to +10 DB | 0 DB | the guitar's level into the chain (where a preset's GT page says SETTINGS); its bottom line is the input check, hold FX sets it |
| GUITAR TONE | BRIGHT, NATURAL, SMOOTH, WARM, WARMER, PUNCHY, DARK, DARKER, MUDDY | NATURAL | the pickup's load, by its sound (where the scene and the preset say nothing) |
| PICKUP | SINGLE, HUMBUCK, P90 | SINGLE | the pickup GUITAR TONE assumes (where the preset says SETTINGS) |
| EQ BASS | -12 DB to +12 DB | 0 DB | a shelf at 100 Hz over the whole guitar, every preset ([The general EQ](#the-general-eq-every-preset-at-once)) |
| EQ MID | -12 DB to +12 DB | 0 DB | a peak or a dip at EQ MID FREQ |
| EQ MID FREQ | 160 HZ to 5000 HZ | 800 HZ | where EQ MID acts |
| EQ MID WIDTH | VERY WIDE, WIDE, MEDIUM, NARROW, VERY NARROW | MEDIUM | how wide EQ MID acts |
| EQ TREBLE | -12 DB to +12 DB | 0 DB | a shelf at 3.5 kHz |
| TAILS | OFF, ON | OFF | the delay and the reverb ring out when they go off and across presets |
| BT POWER | HIGH, MID, LOW | HIGH | the radio's transmit power |
| OUTPUT | MONO, STEREO, GTR+BASS | MONO | STEREO: the delay, the reverb, the modulations and the phone's music spread; GTR+BASS: the guitar left, LOW OCTAVE's bass right |
| USB PORT | COMPUTER, FOOTSW | COMPUTER | FOOTSW: the USB-C port hosts a footswitch by cable (never saved) |
| USB AUDIO | OFF, ON | OFF | the pedal as a USB sound card (applied on leaving) |
| USB SEND | OUTPUT, DI, DI + OUT | OUTPUT | what the computer records |
| USB RETURN | OUTPUT, INPUT, BEFORE (a block) | OUTPUT | where the computer's sound comes in |
| GUITAR | MIX, CUT | MIX | CUT: the guitar cut at the return's place while the computer plays |

## 11. Troubleshooting

| Problem | Try |
| --- | --- |
| The page does not find the pedal | A data cable (not a charge-only one); close M-EFCS, DAWs and other tabs that hold the MIDI port; Chrome or Edge |
| The page refuses the pedal: V22 or later | As it should: ettorebox cannot be installed on it yet ([1](#before-you-install)) |
| The phone does not list the pedal | Wait for `BT VISIBLE`; check REV was not held at power-on; switch the pedal off (USB out too), wait 10 s, on again |
| The Chocolate does not link | Both on, the Chocolate in a MIDI mode and not connected to a phone's app; DLY not held at power-on; one Chocolate per power-on |
| A controller does nothing | SETTINGS: `LAST:` shows what arrived; check CHANNEL; a control learned in one preset works only there |
| Crackles, or `DSP` red | A lighter preset (heavy: drives, high-gain amps, organs, the big reverbs); the diagnostics' costliest blocks |
| MONO SYNTH misses notes, starts late | The input check on that preset's INPUT (GT page, hold FX): its note follower listens through a gate of fixed level and wants a strong signal. Single notes, the neck pickup, other strings muted |
| A sound is too clean or too dirty with your guitar | The input check: the amps and drives were voiced for one input level |
| `LAST START FAILED` at start-up | The start before crashed, so the effects are off for this start (`SAFE` before the load). Switch off and on again; if it comes back, report it with a photo of that screen |
| It restarts in a loop | The installer page's rescue mode; then [RESCUE.md](RESCUE.md) |
| A bug to report | An issue at https://github.com/steponme82/ettorebox: what you did and saw, the M-VAVE firmware the pedal had before, photos of the two diagnostics pages, and the log: with the repository cloned and the pedal on USB, `make log` (the start-up report, the last start's record and Bluetooth's counters, each explained) |

## 12. Inside ettorebox

For the curious, and for anyone who wants to help. Each topic links the document that goes further.

- **The chip:** a JieLi AC791N: two cores of JieLi's own instruction set, 1 MiB of SPI flash, 512 KB of SRAM (96 KB for
  the program's variables, 248 KB for the effects' buffers, 88 KB for code copied there at start-up), plus 28 KB of data
  cache turned into RAM. An external converter on I2S, 24 bit at 44.1 kHz. [HARDWARE-HANDBOOK.md](HARDWARE-HANDBOOK.md)
  and [STOCK-FIRMWARE.md](STOCK-FIRMWARE.md) (what M-VAVE's firmware does).
- **The audio path:** blocks of 2.9 ms; the audio code runs from RAM. Without a NAM amp the whole chain runs on the second
  core. With one, the two cores work as a pipeline: the main core runs the blocks before the amp and the network's first
  layers, the second core the rest of the network and the blocks after the amp (one block more latency). The network's
  sums run on the chip's FFT block, used as a vector unit. `engine/px_dsp.c`, [NAM.md](NAM.md).
- **Bluetooth:** JieLi's own classic and LE Bluetooth libraries from its AC79 SDK (Apache-2.0, published as LLVM bitcode),
  folded at build time to fit, with Android's SBC decoder for the music: the A2DP sink, one LE link where the pedal is the
  Chocolate's central, another where it is the editor's peripheral. The second core never touches the radio's memory.
  [BT-AUDIO-TEST.md](BT-AUDIO-TEST.md) tells how it was made to work, build by build.
- **The flash:**

  | Range | Holds |
  | --- | --- |
  | `0x00000`–`0x04000` | the boot loader and its config (never written) |
  | `0x04000`–`0xA3000` | the app (what an install writes) |
  | `0xC0000`–`0xE0000` | your 16 NAM captures |
  | `0xE0000` | the update loader, staged during an update |
  | `0xEE000`–`0xF0000` | the Bluetooth pairing, two sectors |
  | `0xF0000`–`0xF4000` | the presets in two copies, with the learned controls, the scenes and their names |
  | `0xF4000`–`0xFC000` | your 8 cabinet IRs |
  | near `0xFF000` | the chip's key and address |

  A power cut during a save leaves the previous copy, never a damaged one.
- **Updates:** the page speaks M-VAVE's update protocol. The running firmware stages the package's loader and restarts
  into it; the loader checks the whole package and the pedal's own flash layout before it erases anything, then writes the
  app area sector by sector, reading each one back (and leaving alone those already right). `loader/`, [RESCUE.md](RESCUE.md).
- **Building:** `make bt` builds the image and its packages in a pinned container (Docker and Node 18 or newer); `make test`
  runs the tests with no pedal: the engine against reference signals, the screen drawn into pictures, the preset store
  through simulated power cuts, the installer and the editor against simulated pedals. [BUILDING.md](BUILDING.md).
- **The simulator:** `make sim` runs the pedal's own screen, editor and preset code on your computer, with a front panel
  you can click, and the sound through bundled guitar loops. [SIMULATOR.md](SIMULATOR.md).
- **The room left** in beta 54: 4,176 bytes of the app's 644,928 in the flash, 928 bytes of main RAM and 296 bytes of the RAM
  code window, and 4 bytes of the preset store. Every new feature has to pay for itself.

## 13. What it leaves out

To fit the Bluetooth stack, compared with OpenPocket:

- 8 of the 12 factory NAM models: TWIN, AC15, JCM900 and MARK IV stay, a preset that used another plays one of these, and
  the 16 slots for your own are all there;
- delay times over 780 ms (REVERSE stops at 390 ms);
- lowercase letters on the screen (it draws them as capitals).

Every model it did not change plays as OpenPocket's, sample for sample (`tests/ownfx_equiv.sh`). The ones it changed are
in [OWN-FX.md](OWN-FX.md).

---

ettorebox is GPL-3.0 software built on OpenPocket. Thanks to everyone who made it possible: [README](../README.md#thanks).
Not affiliated with M-VAVE, Donner or OpenPocket's maintainers. Install at your own risk.
