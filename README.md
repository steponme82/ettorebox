# ettorebox

Guitar firmware for the M-VAVE BlackBox, built on [OpenPocket](https://github.com/isod89/openpocket).


I've been working on my own firmware for the BlackBox for the last few weeks. It's called ettorebox. 

A tribute to my grandfather, which i never met. He used to live with a guitar in his hands. 

And to my first son, the toughest 11yr old badass this world has ever met.

I work for commercial entities. But when i'm proud of something, i give it the name of my sons. This is my first project, so Ettorebox!

BEWARE: for Blackbox with version 20 or below. I am seeking for bricked blackbox to fix, so contact me if you wanna try to restore this with Ettorebox

ettorebox started as OpenPocket's Bluetooth test image and grew into a firmware of its own: the phone's music through the
pedal, a Bluetooth footswitch, the web editor over Bluetooth, scenes, a two-job expression pedal and effects of its own.
It is free software under the GPL-3.0, like OpenPocket.

Not affiliated with M-VAVE, Donner or the OpenPocket maintainers. Install at your own risk.

## Status

Beta. The latest is beta 52, test build 52 (see Releases): at start-up the pedal reads `ETTOREBOX`, a phone and the
computer list it as `ettorebox`. Build 50 runs on its author's BlackBox, and build 38 is the one played
longest, about two hours of music on stage. [docs/BT-AUDIO-TEST.md](docs/BT-AUDIO-TEST.md) has every test build's notes
and what to check on each.

## Before you install

- **Not on a BlackBox with M-VAVE's firmware V22 or later.** V22 moved the app area of the flash from `0x4000` to `0x6000`,
  behind a bigger boot loader. Writing the old layout over it overwrites that boot loader and the pedal stays dark
  ([isod89/openpocket#31](https://github.com/isod89/openpocket/issues/31), [#33](https://github.com/isod89/openpocket/issues/33)).
  The installer page and the update loader refuse such pedals before writing anything
  ([isod89/openpocket#35](https://github.com/isod89/openpocket/pull/35)). A pedal that already went dark this way can be
  brought back: [docs/RESCUE.md](docs/RESCUE.md), "After OpenPocket over M-VAVE's V22 or later".
- Keep a way back: M-VAVE's own firmware file, downloaded from M-VAVE, and the rescue route in
  [docs/RESCUE.md](docs/RESCUE.md).
- The Donner Pocket X has the same chip and its package is built too, but ettorebox has not been tried on one.

## What it does

1. Music from the phone over Bluetooth (A2DP), mixed with the guitar. The pairing is kept, and the last phone is called back
   at power-on.
2. A Bluetooth MIDI footswitch: the regular M-VAVE Chocolate links to the pedal directly, with the pedal as its central.
   The Chocolate by USB cable works too (the pedal as its USB MIDI host, through an OTG adapter with a charging input).
3. The web editor over Bluetooth (MIDIWeb on an iPhone), beside the footswitch and the music.
4. Controls learned on the pedal itself, each a preset's own: hold FX on a setting or a block's ON row, then a switch or a
   pedal, with the heel and the toe set on a guided page.
5. Scenes, like Helix's snapshots: four a preset, with names, recalled from the Chocolate (CC 65 to 68 or a learned switch)
   or with the footswitches. Hold CAB to turn PLAY's view between the chain, the switches and the scenes.
6. An expression pedal with two jobs: the volume while an effect is off, that effect's setting while it is on (a wah's
   sweep, a whammy, any setting). A green or red line at the screen's edge says which. The volume sits at the input or
   before the delay (SETTINGS, VOL PEDAL), and the trails ring on in both.
7. PRESET LVL down to silence, so a learned pedal can be a volume pedal.
8. Effects of its own: LOW OCTAVE (a polyphonic octave down, as an OC-3), SYN PAD (a chord held on a footswitch), TREBLE
   BOOST, WAH, TAPE FLUTE. SHIMMER in tune, BARITONE sooner, MONO SYNTH's tracker, SITAR and STRINGS rebuilt, 12-STRING
   steady.
9. GUITAR TONE: the input loads the pickup as a real amp's would, named by its sound (BRIGHT to MUDDY).
10. Stereo output (the delay, the reverb and the modulations spread, or the guitar left and LOW OCTAVE's bass right), and
    USB audio with its own routing (record the DI or the pedal, send the computer's sound back anywhere in the chain).
11. Tap tempo (CC 116), next and previous preset (CC 118 and 119), the expression pedal (CC 117), and a SETTINGS page
    (input gain, tails, Bluetooth power, output, the scene rules).

The details: [docs/MIDI.md](docs/MIDI.md) (controls, scenes, the two-job pedal, settings), [docs/OWN-FX.md](docs/OWN-FX.md)
(the effects), [docs/BT-AUDIO-TEST.md](docs/BT-AUDIO-TEST.md) (Bluetooth and each test build).

## What it leaves out

To fit the Bluetooth stack, compared with OpenPocket:

- 8 of the 12 factory NAM models. It keeps TWIN, AC15, JCM900 and MARK IV, and the 16 user slots are all there.
- Delay times over 780 ms (REVERSE stops at 390 ms).
- Lowercase letters on the pedal's screen.

Every model both have plays as OpenPocket's, sample for sample (`tests/ownfx_equiv.sh`).

## Install

Open the installer page, **https://steponme82.github.io/ettorebox/**, in Chrome or Edge on a computer. Plug the pedal in
over USB with a data cable, press **Connect**, then **Install**. The web editor is at
**https://steponme82.github.io/ettorebox/editor.html** (over USB, or over Bluetooth from MIDIWeb on an iPhone).

From the command line instead, with this repository cloned:

```
gh release download beta-52 -R steponme82/ettorebox -D build/bt --clobber
make serve-bt
```

Then open the address it prints and do the same.

## Build and test

`make bt` builds the image and its packages in the pinned container (Docker and Node 18+), `make test` runs every test
without a pedal. [docs/BUILDING.md](docs/BUILDING.md) has the details, [docs/SIMULATOR.md](docs/SIMULATOR.md) the simulated
pedal.

## Thanks

ettorebox is OpenPocket's code first, and it would not exist without the people who wrote it:

- **isod89**, who created OpenPocket: the engine, the pedal's screen and controls, the installer and the web editor, NAM
  on the pedal, and the reading of the stock firmware much of this work stands on.
- **Vince Speelman ([VinSpee](https://github.com/VinSpee))**: Bluetooth MIDI and the radio's first steps, the simulator's
  engine, the command-line flasher, the two-core NAM work, v42's web editor, the pedal's reworked controls and USB audio.
- **Ivan Shevchuk ([Testing7B](https://github.com/Testing7B))**: the BlackBox V21 factory sounds.
- **Leo Kuroshita / Hügelton Instruments**: [felucca-bsp](https://github.com/hugelton/felucca-bsp) and
  [Felucca](https://github.com/hugelton/Felucca), the chip support, the update protocol and its loader.
- Everyone who tested and reported on [isod89/openpocket](https://github.com/isod89/openpocket).

Fixes that help every OpenPocket pedal go back to OpenPocket too (the V22 guard: isod89/openpocket#35).

## Licence

GPL-3.0-only, as OpenPocket. Parts keep their own licences: [NOTICE.md](NOTICE.md). Product names are trademarks of their
owners, used only to describe the sound or the hardware.
