#!/usr/bin/env python3
"""Generate rig site v0.3.1: collapsible sections, map hierarchy, diagrams, layout fix."""

import json, os, shutil, datetime, textwrap
import practice as practice_mod
import grooves as grooves_mod

DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # rig/
VERSION = "0.7.0"
DATE = "2026-11-12"

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,500;125,700;125,900&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">'

def head(title, extra=""):
    return f'''<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Rig</title>
{FONTS}
<link rel="stylesheet" href="shared.css">
{extra}</head>'''

def page_shell(page_id, title, body_html):
    """Wrap body content in the standard subpage shell."""
    return f'''{head(title)}
<body data-page="{page_id}">
<main class="pg">
{body_html}
</main>
<script src="version.js"></script>
<script src="shared.js"></script>
</body></html>'''

def hero(title, thesis="", accent_word=None, meta=""):
    t = title
    if accent_word:
        t = title.replace(accent_word, f'<i>{accent_word}</i>')
    parts = [f'<div class="hero"><h1>{t}</h1>']
    if thesis:
        parts.append(f'<p class="thesis">{thesis}</p>')
    if meta:
        parts.append(f'<div class="meta">{meta}</div>')
    parts.append('</div>')
    return '\n'.join(parts)

def detail(title, body, tag=""):
    """Collapsible <details> block with +/- toggle."""
    tag_html = f'<span class="dtag">{tag}</span>' if tag else ''
    return f'''<details>
<summary>{title}{tag_html}</summary>
<div class="dbody">{body}</div>
</details>'''

def creature(name, subtitle, feel, build_items):
    """Creature card: feel is open, build is collapsible."""
    items = ''.join(f'<li>{b}</li>' for b in build_items)
    return f'''<div class="creature">
<h3>{name}<span>{subtitle}</span></h3>
<div class="feel"><span class="k">What it feels like</span>
{feel}
</div>
<details>
<summary>How to build it<span class="dtag">Ableton + Max for Live</span></summary>
<div class="dbody"><ul>{items}</ul></div>
</details>
</div>'''

# ── Page content generators ─────────────────────────────

def concept():
    return hero("Concept", "A musical environment to play in, respond to, and be responded to by — three live voices played solo, with a generative layer that listens.") + '''
<div class="row"><div class="b8">
<p class="lg">The three voices are electronic percussion (Sensory Percussion 2 on a compact mesh-head kit), bass guitar, and the Arturia MiniFreak. Ableton Live is the backbone for recording, looping, routing and the "intelligence" layer, but it is driven from hardware so the computer stays out of the way during performance.</p>
</div><div class="b4 p9">
<p class="sm">The reference is the Arthur Hnatek&nbsp;/ Jojo Mayer (Nerve, Me/Machine) model: a system that reads dynamics, hit patterns and timing and responds. The vocabulary here leans melodic techno — a smaller and faster language to become fluent in, and which the simplified kit suits well.</p>
</div></div>

<div class="row"><h2>Principles</h2>
<div class="b6">
<p class="xl">Ableton is the brain. Hardware is the hands.</p>
<p class="sm">Anything touched mid-performance is a knob, pad or pedal.</p>
</div>
<div class="b6">
<p class="xl">Fewer voices, more expression per voice.</p>
<p class="sm">A snare with four trained zones beats eight pads with one each.</p>
</div>
</div>

<div class="row">
<div class="b6">
<p class="xl">Commit tone early in the analogue chain.</p>
<p class="sm">Keep Live's effects for what is looped, modulated or automated live.</p>
</div>
<div class="b6">
<p class="xl">Buy toward a problem that has been hit.</p>
<p class="sm">The MiniFreak's own sequencer and arpeggiator come first; a hardware step sequencer only if they run out.</p>
</div>
</div>'''


def percussion():
    return hero("Percussion", "Sensory Percussion 2 on five mesh-head drums arranged around the seat, plus a kick pedal and a hi-hat pedal at the feet. Expression comes from zones and technique, not from pad count.") + '''
<div class="row"><h2>What the sensor reads</h2>
<div class="b8">
<p>It does not read acoustic timbre. What the software calls "timbre" is derived from where and how the head is struck — position and strike classification — not from spectral analysis. The raw axes are <strong>position/zone</strong>, <strong>velocity</strong>, and <strong>speed</strong> (hit rate). Everything else in the expression list is computed from those three.</p>
''' + detail("Zone training", '''<p>Each sensor can be trained with up to <strong>ten zones per drum</strong>: centre, edge, rimshot-centre, rimshot-edge, rim tip, rim shoulder, cross-stick, damped, shell, and a "void" zone for things to ignore. Most players train four to six that they can strike reliably and distinctly; zones can be blended so they flow into each other proportionally rather than switching hard.</p>
<p>Built-in controller types: Timbre, Velocity, Speed and LFO — each mappable to any parameter or sent out as MIDI CC.</p>''', "SP2") + '''
</div></div>

<div class="row"><h2>The kit</h2>
<div class="b8">
<p>No separate kick drum or hi-hat cymbal. Five mesh-head drums carry all the struck zones — two of them standing in for hi-hat and ride — plus a dedicated kick pedal and hi-hat pedal underfoot. See <a href="arrangement.html">Arrangement</a> for how they sit around the seat.</p>
<table>
<thead><tr><th>Drum / control</th><th>Position</th><th>Diameter</th><th>Note</th></tr></thead>
<tbody>
<tr><td>Snare</td><td>Centre</td><td>12–13"</td><td>Compact, still a real rim for rimshots and cross-stick</td></tr>
<tr><td>Tom → hi-hat</td><td>Left</td><td>8–10"</td><td>Struck surface standing in for a hi-hat; open/close colour comes from the hi-hat pedal, not a physical cymbal</td></tr>
<tr><td>Tom → ride</td><td>Right</td><td>10–12"</td><td>Struck surface standing in for a ride; zone training (edge/bell-equivalent) carries the voicing</td></tr>
<tr><td>Tom 1</td><td>Top-left</td><td>8"</td><td>Smallest common rack tom; mesh heads easy to find</td></tr>
<tr><td>Tom 2</td><td>Top-right</td><td>10"</td><td></td></tr>
<tr><td>Kick pedal</td><td>Feet</td><td>—</td><td>Compact pad played with a standard bass-drum pedal beater, SP2 sensor — not a full-size kick drum</td></tr>
<tr><td>Hi-hat pedal</td><td>Feet</td><td>—</td><td>Continuous foot controller; open/close position sent as CC. Portal's pedal input is unconfirmed — may route via the Morningstar's spare expression input instead</td></tr>
</tbody>
</table>
<p class="sm">Since the sensor reads position and dynamics rather than resonance, diameter affects stick feel, not what can be triggered. Shallower shells (100–130 mm) save more space than dropping a diameter and change playability less.</p>
</div></div>'''


def bass():
    return hero("Bass", "The true third voice — not accompaniment but a musical starting point. Get a groove on, loop it, hand it to the synth, and let it evolve.") + '''
<div class="row"><h2>Where the bass fits in</h2>
<div class="b12">
''' + creature("The understudy", "gets a groove going, then the synth takes it and runs",
    "You pick up the bass and noodle until something locks in — a line, a riff, a groove. You loop it. Then you tell Ableton to convert it into MIDI, and on the next turnaround, the synth picks up the line. But it does not play it the same way. It adds notes, in key, generatively — a little fill, a passing tone, a syncopated ghost. It shifts notes or leaves them out. It has learned the general groove and is playing with it musically. You can go back to the bass and play alongside this new version, or you can leave it and pick up the sticks.",
    [
        '<strong>Bass-to-MIDI in real time</strong> using <a href="https://www.jamorigin.com">Jam Origin MIDI Bass</a> — a VST/AU plugin that converts monophonic bass audio to MIDI with low latency.',
        '<strong>Handoff:</strong> on a turnaround (or a trigger), route the MIDI loop to the MiniFreak track. Crossfade the audio bass loop out and the synth voice in.',
        '<strong>Generative variation:</strong> Live\'s Scale MIDI effect keeps added notes in key. A Max for Live note-chance device drops, shifts or adds notes at probability thresholds.',
        '<strong>Groove learning</strong> — the same principle as the Mimic character: a model of the rhythmic shape biases what gets added and where.',
    ]) + '''
</div></div>

<div class="row"><h2>Signal chain</h2>
<div class="b8">
<p class="lg">Bass → compressor → SansAmp Bass Driver DI → Portal input A (inst/Hi-Z) → Live.</p>
<p>Character goes in the analogue chain before the interface, where it is zero-latency and under a hand or foot. The <strong>SansAmp</strong> provides amp-style saturation and a DI in one analogue box. A <strong>compressor</strong> (MXR Bass Compressor or similar) before it evens dynamics and keeps loop levels consistent.</p>
''' + detail("DI and digital alternatives", '''<p><strong>No DI box needed</strong> if the interface has a Hi-Z input — the Portal's input A has an inst/line switch. Reserve Live's effects on the bass track for things that are looped or modulated live.</p>
<p><strong>Digital alternatives</strong> are good now (Neural DSP Darkglass is the bass benchmark). Plugin latency ~3–8 ms at 64–128 samples. The argument for pedals is tactility, not sound quality.</p>''') + '''
</div></div>'''


def synth():
    return hero("Synth", "The MiniFreak is the right synth for this. It is a step sequencer question that is really a generative-system question.") + '''
<div class="row">
<div class="b8">
<p class="lg">Six-voice true polyphony (pads and chords work), two oscillator engines per voice across wavetable, FM, harmonic and other types, a modulation matrix, built-in effects, and Spice &amp; Dice randomisation aimed at exploratory sound design.</p>
<p>Pads, plucks, bass, stabs, washes and chords all come from one unit. It is hybrid (digital oscillators, analogue-modelled filter), so vintage analogue grit would be a second-synth conversation later, not now.</p>
<p class="sm">MiniFreak audio → Portal inputs C/D (line level). USB-MIDI to laptop for parameter control from Live.</p>
</div></div>

<div class="row"><h2>Patterns</h2>
<div class="b8">
<p>A fixed-grid step sequencer is deterministic; the brief is generative. The MiniFreak already has a polyphonic sequencer and arpeggiator with modulation lanes, both reachable by Spice &amp; Dice.</p>
<p>The "responds to what is played" layer lives in Live: probability MIDI effects, Max for Live generative devices, and parameters modulated from Sensory Percussion data. Start there; add a dedicated hardware sequencer only against a limitation actually hit.</p>
<div class="rule"><h3>First experiment</h3>
<p class="sm">Hi-hat speed → MiniFreak filter cutoff via Expression Control. Snare velocity → reverb send on the synth. One continuous, one per-hit, both from stock devices.</p>
</div>
</div></div>'''


def midi():
    return hero("MIDI Controllers", "The hands-free layer: footswitches, an expression pedal, and the pads already on the desk. Everything that fires a loop, nudges an effect, or steps a scene without touching the laptop.") + '''
<div class="row"><h2>What's in hand</h2>
<div class="b8">
<p>Five controllers, two of them already owned, cover looping transport, continuous expression, and scene control. See <a href="hookup.html">Hook-up</a> for how they wire into the powered USB hub, and <a href="gear.html?phase=4">Gear → Phase 4</a> for the foot-control purchases.</p>
<table>
<thead><tr><th>Controller</th><th>Role</th><th>Status</th><th>Note</th></tr></thead>
<tbody>
<tr><td>Ableton Push 1</td><td>Clips, scenes</td><td>Owned</td><td>Session View looping with Fixed Length mode; the closest-to-hand pad surface, a reach from the kit</td></tr>
<tr><td>Morningstar MC6 Pro</td><td>Loop transport, FX</td><td>Needed — $560</td><td>6 footswitches, deeply programmable per press/hold/double-tap/release; speaks MIDI natively</td></tr>
<tr><td>Moog EP-3 expression pedal</td><td>Continuous control</td><td>Needed — $90</td><td>Filter sweeps, volume fades, effect depth — plugs into the MC6's expression input</td></tr>
<tr><td>Hi-hat pedal</td><td>Continuous control</td><td>Needed — $90</td><td>Open/close position as CC, blending the hi-hat tom's sample layers; also covered on <a href="percussion.html">Percussion</a> as part of the kit</td></tr>
<tr><td>Modular MIDI controller</td><td>FX knobs</td><td>Deferred</td><td>Intech Grid or Monogram-style grid; knobs that follow whichever track is selected, rather than fixed per-effect mappings</td></tr>
</tbody>
</table>
</div></div>

<div class="row"><h2>Why footswitches, not just Push</h2>
<div class="b8">
<p class="lg">Push 1 already does clips and scenes, but it is a reach from the kit and needs a hand. The Morningstar and the expression pedal move loop transport and continuous control to the feet, freeing both hands for the instrument in front of you.</p>
<p>The hi-hat pedal is a controller as much as it is percussion: its continuous position is read as a CC, the same signalling a footswitch uses, just analogue instead of binary.</p>
</div></div>

<div class="row"><h2>Open: where loop-length control lives</h2>
<div class="b8">
<p>Loop lengths of 4, 8 and 16 bars are still an open design question — see <a href="looping.html">Looping</a>. The two shapes under consideration both want pads, not a footswitch: either three dedicated length buttons, or one record button plus a length selector. Push's pads are the natural home, with the modular FX-knob controller (once it arrives) as the other hand-reach option.</p>
''' + detail("The deferred modular controller", '''<p>An Intech Grid or Monogram-style device: a grid of knobs/pads whose assignment follows the selected track in Live, rather than being hard-wired to one effect. Deferred until the core rig (drums, bass, synth, foot transport) is in and the effects worth dedicating knobs to are known.</p>
<p>Natural jobs once it arrives: the loop-length selector above, and direct hands-on access to whichever Expression mapping (<a href="expression.html">Expression</a>) is live in a given scene — filter cutoff, reverb send, randomisation amount — without diving into Live's screen.</p>''') + '''
</div></div>'''


def hookup():
    return hero("Hook-up", "How everything plugs in. The EVANS Portal is at the centre for audio and sensors; a powered USB hub now gathers every MIDI controller before the laptop.") + '''
<div class="row">
<div class="b12">
<figure>
<svg class="sv" viewBox="0 0 900 720" role="img" aria-label="Wiring diagram: drums, bass, synth and MIDI controllers feed the EVANS Portal and a powered USB hub, both into the laptop, out to speakers and headphones. Drum, bass, synth and controller boxes link to their pages">
<defs>
<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
</defs>
<!-- Drums top row -->
<a href="percussion.html" aria-label="Percussion page">
<rect class="bx" x="20" y="20" width="110" height="45"/><text x="75" y="38" text-anchor="middle" font-weight="600" font-size="12">Kick pedal</text><text class="q" x="75" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="140" y="20" width="110" height="45"/><text x="195" y="38" text-anchor="middle" font-weight="600" font-size="12">Snare</text><text class="q" x="195" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="260" y="20" width="110" height="45"/><text x="315" y="38" text-anchor="middle" font-weight="600" font-size="11">Tom → hi-hat</text><text class="q" x="315" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="380" y="20" width="90" height="45"/><text x="425" y="38" text-anchor="middle" font-weight="600" font-size="11">Tom → ride</text><text class="q" x="425" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="480" y="20" width="90" height="45"/><text x="525" y="38" text-anchor="middle" font-weight="600" font-size="12">Tom 1</text><text class="q" x="525" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="580" y="20" width="90" height="45"/><text x="625" y="38" text-anchor="middle" font-weight="600" font-size="12">Tom 2</text><text class="q" x="625" y="55" text-anchor="middle" font-size="10">sensor</text>
<!-- HH pedal, moved clear of the hi-hat tom's sensor line at x=315 -->
<rect class="bxd" x="200" y="80" width="100" height="35"/><text class="q" x="250" y="99" text-anchor="middle" font-size="10" font-weight="600">Hi-hat pedal</text><text class="q" x="250" y="112" text-anchor="middle" font-size="9">routing TBC</text>
</a>
<!-- sensor cables to Portal -->
<g class="thin" style="color:var(--line)">
<line x1="75" y1="65" x2="75" y2="170"/><line x1="195" y1="65" x2="195" y2="170"/>
<line x1="315" y1="65" x2="315" y2="170"/><line x1="425" y1="65" x2="425" y2="170"/>
<line x1="525" y1="65" x2="505" y2="170"/><line x1="625" y1="65" x2="575" y2="170"/>
</g>
<line class="lnq" x1="250" y1="115" x2="250" y2="170" marker-end="url(#arr)"/>
<!-- Portal -->
<rect class="hi" x="40" y="170" width="540" height="80"/>
<text x="310" y="196" text-anchor="middle" font-weight="700" font-size="14">EVANS Portal</text>
<text class="q" x="310" y="214" text-anchor="middle" font-size="10">7 sensor in · combo A/B (inst/line, +48V) · line C/D</text>
<text class="q" x="310" y="230" text-anchor="middle" font-size="10">main out L/R · aux 5–8 · phones · ADAT · MIDI DIN · USB-C</text>
<!-- Bass chain, shifted right clear of Tom 2 -->
<a href="bass.html" aria-label="Bass page">
<rect class="bx" x="700" y="20" width="170" height="45"/><text x="785" y="38" text-anchor="middle" font-weight="600" font-size="12">Bass guitar</text><text class="q" x="785" y="55" text-anchor="middle" font-size="10">passive</text>
<rect class="bx" x="700" y="85" width="80" height="40"/><text x="740" y="101" text-anchor="middle" font-size="11">Compressor</text>
<rect class="bx" x="790" y="85" width="80" height="40"/><text x="830" y="101" text-anchor="middle" font-size="11">SansAmp</text>
</a>
<g class="ln" style="color:var(--line)">
<path d="M785 65L785 72L740 72L740 85" marker-end="url(#arr)"/>
<path d="M780 105L790 105" marker-end="url(#arr)"/>
<path d="M830 125L830 155L555 155L555 170" marker-end="url(#arr)"/>
</g>
<text class="q" x="600" y="152" font-size="9">input A (inst)</text>
<!-- Synth -->
<a href="synth.html" aria-label="Synth page">
<rect class="bx" x="700" y="180" width="170" height="50"/><text x="785" y="200" text-anchor="middle" font-weight="600" font-size="12">MiniFreak</text><text class="q" x="785" y="218" text-anchor="middle" font-size="10">audio + USB-MIDI</text>
</a>
<g class="ln" style="color:var(--line)"><path d="M700 200L580 200" marker-end="url(#arr)"/></g>
<text class="q" x="640" y="195" font-size="9">C/D line</text>
<!-- MIDI controllers feeding the hub -->
<a href="midi.html" aria-label="MIDI Controllers page">
<rect class="bx" x="20" y="260" width="120" height="35"/><text x="80" y="278" text-anchor="middle" font-weight="600" font-size="11">Push 1</text><text class="q" x="80" y="291" text-anchor="middle" font-size="9">clips, scenes</text>
<rect class="bx" x="20" y="305" width="120" height="35"/><text x="80" y="323" text-anchor="middle" font-size="11">Loop controller</text><text class="q" x="80" y="336" text-anchor="middle" font-size="9">foot MIDI</text>
<rect class="bx" x="20" y="350" width="120" height="35"/><text x="80" y="368" text-anchor="middle" font-size="11">FX knobs</text><text class="q" x="80" y="381" text-anchor="middle" font-size="9">deferred modular controller</text>
</a>
<g class="usb">
<path d="M140 277L170 277" marker-end="url(#arr)"/>
<path d="M140 322L170 322" marker-end="url(#arr)"/>
<path d="M140 367L170 367" marker-end="url(#arr)"/>
</g>
<!-- Powered USB hub: Portal, Push 1, Loop controller, FX knobs and MiniFreak USB-MIDI all plug in; one USB-C out to the laptop -->
<rect class="hi" x="170" y="255" width="360" height="130"/>
<text x="350" y="310" text-anchor="middle" font-weight="700" font-size="13">Powered USB hub</text>
<text class="q" x="350" y="328" text-anchor="middle" font-size="9">needs its own test under load — see open questions</text>
<line class="usb" x1="310" y1="250" x2="310" y2="255" marker-end="url(#arr)"/>
<text class="q" x="318" y="247" font-size="9">USB-C</text>
<path class="usb" d="M785 230L785 245L530 245L530 255" style="stroke-dasharray:6 4" marker-end="url(#arr)"/>
<text class="q" x="640" y="240" font-size="9">USB-MIDI</text>
<!-- One USB-C from the hub to the laptop -->
<line class="usb" x1="350" y1="385" x2="350" y2="400" marker-end="url(#arr)"/>
<text class="q" x="358" y="396" font-size="9">USB-C</text>
<!-- Laptop -->
<rect class="hi" x="140" y="400" width="620" height="70"/>
<text x="450" y="425" text-anchor="middle" font-weight="700" font-size="14">Laptop</text>
<text class="q" x="450" y="445" text-anchor="middle" font-size="11">Sensory Percussion 2 → MIDI/CC → Ableton Live (+ Max for Live) → Jam Origin MIDI Bass</text>
<!-- Outputs, routed around the hub and the laptop rather than through them -->
<g class="ln" style="color:var(--line)">
<path d="M40 235L15 235L15 522L260 522" marker-end="url(#arr)"/>
<path d="M40 220L8 220L8 590L260 590" marker-end="url(#arr)"/>
</g>
<rect class="bx" x="260" y="500" width="180" height="45"/><text x="350" y="518" text-anchor="middle" font-weight="600" font-size="12">Speakers</text><text class="q" x="350" y="535" text-anchor="middle" font-size="10">Portal main out L/R</text>
<rect class="bx" x="260" y="568" width="180" height="45"/><text x="350" y="586" text-anchor="middle" font-weight="600" font-size="12">Headphones</text><text class="q" x="350" y="603" text-anchor="middle" font-size="10">Portal phones (3.5mm + ¼")</text>
<!-- Fallback interface -->
<rect class="bxd" x="520" y="500" width="200" height="50"/><text class="q" x="620" y="522" text-anchor="middle" font-size="11">Separate audio interface</text><text class="q" x="620" y="538" text-anchor="middle" font-size="9">fallback if Portal can't serve as sole I/O</text>
<!-- Legend -->
<g transform="translate(40 660)">
<line class="ln" x1="0" y1="8" x2="30" y2="8" style="color:var(--line)"/><text x="36" y="12" font-size="10">Audio</text>
<line class="usb" x1="100" y1="8" x2="130" y2="8"/><text x="136" y="12" font-size="10">USB / MIDI</text>
<line class="thin" x1="210" y1="8" x2="240" y2="8" style="color:var(--line)"/><text x="246" y="12" font-size="10">Sensor cable</text>
<line class="lnq" x1="330" y1="8" x2="360" y2="8"/><text x="366" y="12" font-size="10">Unconfirmed</text>
<rect class="bxd" x="440" y="0" width="16" height="16"/><text x="462" y="12" font-size="10">Fallback / optional</text>
</g>
</svg>
<figcaption>Wiring diagram. Drums, bass chain, synth and MIDI controllers are clickable through to their own pages. The Portal handles sensor inputs and audio I/O; a powered USB hub gathers every MIDI device — Portal, Push 1, loop controller, FX knobs and the MiniFreak's USB-MIDI — before a single USB-C run to the laptop.</figcaption>
</figure>
</div></div>

<div class="row"><h2>Open questions</h2>
<div class="b7">
<ul>
<li><strong>Portal as sole interface?</strong> Bass into input A (inst), MiniFreak into C/D, speakers on Main Out, headphones on phones. If it works, no separate audio interface is needed.</li>
<li><strong>Hi-hat pedal:</strong> the Portal has 7 sensor inputs (3.5 mm TRS) plus combo inputs A/B, but a hi-hat pedal/controller connection is not documented.</li>
<li><strong>USB hub under load:</strong> needs testing with everything plugged in at once — Portal, Push 1, loop controller, FX knobs and the MiniFreak's USB-MIDI all sharing one hub and one USB-C run to the laptop. Bus power and enumeration order are both unverified.</li>
<li><strong>Push 1 power:</strong> Push 1 needs its own power supply — it cannot be bus-powered off the hub alongside everything else.</li>
</ul>
</div></div>'''


def arrangement():
    return hero("Arrangement", "Percussion in the centre, synth and bass either side — a turn of the head, not a move of the chair. The MIDI foot controllers sit between the player and the laptop.") + '''
<div class="row"><h2>Room plan</h2>
<div class="b8">
<figure>
<svg class="sv" viewBox="0 0 800 460" role="img" aria-label="Room plan: bass to the left, percussion centred on the seat, synth to the right, MIDI controllers between the player and the laptop. Bass, percussion, synth and MIDI controller boxes link to their pages">
<!-- back row: bass / percussion / synth -->
<a href="bass.html" aria-label="Bass page">
<rect class="bx" x="20" y="20" width="200" height="140"/>
<text x="120" y="80" text-anchor="middle" font-weight="600">Bass</text>
<text class="q" x="120" y="100" text-anchor="middle" font-size="12">guitar on a stand,</text>
<text class="q" x="120" y="116" text-anchor="middle" font-size="12">pedals on the floor</text>
</a>

<a href="percussion.html" aria-label="Percussion page">
<rect class="bx hi" x="260" y="20" width="280" height="200"/>
<text x="400" y="50" text-anchor="middle" font-weight="700">Percussion</text>
<text class="q" x="400" y="70" text-anchor="middle" font-size="12">centred on the seat — see kit layout below</text>
</a>

<a href="synth.html" aria-label="Synth page">
<rect class="bx" x="580" y="20" width="200" height="140"/>
<text x="680" y="80" text-anchor="middle" font-weight="600">Synth</text>
<text class="q" x="680" y="100" text-anchor="middle" font-size="12">MiniFreak on a stand,</text>
<text class="q" x="680" y="116" text-anchor="middle" font-size="12">within reach of the seat</text>
</a>

<!-- seat, nested inside the percussion zone -->
<circle class="bx" cx="400" cy="160" r="28"/>
<text x="400" y="165" text-anchor="middle" font-weight="600" font-size="12">Seat</text>

<!-- MIDI controllers band: between the player and the laptop -->
<a href="midi.html" aria-label="MIDI Controllers page">
<rect class="bx hi" x="160" y="280" width="480" height="70"/>
<text x="400" y="308" text-anchor="middle" font-weight="700">MIDI foot controllers</text>
<text class="q" x="400" y="328" text-anchor="middle" font-size="12">Morningstar loop/FX footswitches + expression + hi-hat pedal — underfoot, between the kit and the laptop</text>
</a>

<!-- laptop + push, furthest out front -->
<rect class="bx" x="220" y="390" width="360" height="55"/>
<text x="400" y="413" text-anchor="middle" font-weight="600">Laptop + Push 1</text>
<text class="q" x="400" y="431" text-anchor="middle" font-size="11">Ableton Live — out front, glanced at, not reached for</text>

<!-- connecting lines -->
<g class="thin" style="color:var(--line)">
<line x1="120" y1="160" x2="260" y2="160"/>
<line x1="540" y1="160" x2="680" y2="160"/>
<line x1="400" y1="188" x2="400" y2="280"/>
<line x1="400" y1="350" x2="400" y2="390"/>
</g>
</svg>
<figcaption>Plan view, looking down. Bass and synth flank the seat so swapping instruments is a turn of the head. The foot controllers sit on the floor between the kit and the laptop — reachable without leaning forward.</figcaption>
</figure>
</div>
<div class="b4 p9">
<p class="sm">Which side bass sits on versus synth is still open — reach and cable runs from the seat will decide it once the gear is in the room. What is fixed is percussion in the middle: it is the busiest voice and the one the seat is built around.</p>
</div>
</div>

<div class="row"><h2>Jump to a station</h2>
<div class="b12">
<div class="grid4">
<a class="card" href="bass.html"><h3>Bass</h3><p class="sm">Guitar on a stand, pedals on the floor.</p></a>
<a class="card" href="percussion.html"><h3>Percussion</h3><p class="sm">Centred on the seat — the busiest voice in the room.</p></a>
<a class="card" href="synth.html"><h3>Synth</h3><p class="sm">MiniFreak on a stand, within reach of the seat.</p></a>
<a class="card" href="midi.html"><h3>MIDI Controllers</h3><p class="sm">Footswitches, expression pedal and pads underfoot and in hand.</p></a>
</div>
</div></div>

<div class="row"><h2>Kit layout</h2>
<div class="b8">
<figure>
<svg class="sv" viewBox="0 0 600 440" role="img" aria-label="Drum kit plan: snare centre, tom as hi-hat on the left, tom as ride on the right, two further toms top-left and top-right, kick pedal and hi-hat pedal at the feet">
<!-- outer toms -->
<circle class="bx" cx="190" cy="140" r="52"/>
<text x="190" y="135" text-anchor="middle" font-weight="600" font-size="13">Tom 1</text>
<text class="q" x="190" y="152" text-anchor="middle" font-size="11">top-left</text>

<circle class="bx" cx="410" cy="140" r="52"/>
<text x="410" y="135" text-anchor="middle" font-weight="600" font-size="13">Tom 2</text>
<text class="q" x="410" y="152" text-anchor="middle" font-size="11">top-right</text>

<!-- inner toms standing in for hi-hat / ride -->
<circle class="bx hi" cx="170" cy="250" r="48"/>
<text x="170" y="245" text-anchor="middle" font-weight="600" font-size="12">Tom →</text>
<text x="170" y="261" text-anchor="middle" font-weight="600" font-size="12">hi-hat</text>
<text class="q" x="170" y="278" text-anchor="middle" font-size="10">left</text>

<circle class="bx hi" cx="430" cy="250" r="48"/>
<text x="430" y="245" text-anchor="middle" font-weight="600" font-size="12">Tom →</text>
<text x="430" y="261" text-anchor="middle" font-weight="600" font-size="12">ride</text>
<text class="q" x="430" y="278" text-anchor="middle" font-size="10">right</text>

<!-- snare, centre -->
<circle class="bx" cx="300" cy="260" r="54"/>
<text x="300" y="255" text-anchor="middle" font-weight="700" font-size="14">Snare</text>
<text class="q" x="300" y="273" text-anchor="middle" font-size="11">centre</text>

<!-- pedals at the feet -->
<rect class="bx" x="235" y="350" width="60" height="34" rx="4"/>
<text x="265" y="369" text-anchor="middle" font-size="10" font-weight="600">Hi-hat</text>
<text class="q" x="265" y="381" text-anchor="middle" font-size="9">pedal</text>

<rect class="bx" x="305" y="350" width="60" height="34" rx="4"/>
<text x="335" y="369" text-anchor="middle" font-size="10" font-weight="600">Kick</text>
<text class="q" x="335" y="381" text-anchor="middle" font-size="9">pedal</text>

<!-- seat -->
<circle class="bxd" cx="300" cy="410" r="20"/>
<text class="q" x="300" y="414" text-anchor="middle" font-size="9">seat</text>
</svg>
<figcaption>Five struck surfaces plus two foot pedals, all reading through SP2 sensors. No separate kick drum or hi-hat cymbal — a tom stands in for each, and the pedals are dedicated triggers/controllers rather than a full acoustic hi-hat stand.</figcaption>
</figure>
</div>
<div class="b4 p9">
<p class="sm">Reusing toms as hi-hat and ride keeps the footprint small: five mesh-head drums instead of a full kit, arranged in the arc a seated player can reach without standing. See <a href="percussion.html">Percussion</a> for the zone-training detail and <a href="gear.html?phase=5">Gear → Phase 5</a> for sensor counts and cost.</p>
</div>
</div>'''


def routing():
    return hero("Routing", "Two parallel paths: audio and control. Audio is sound; control is MIDI, CC, and automation.") + '''
<div class="row"><h2>Audio path</h2>
<div class="b8">
<figure>
<svg class="sv" viewBox="0 0 760 340" role="img" aria-label="Audio signal flow: drums, synth and bass into Portal, then Ableton, then monitors">
<defs><marker id="sa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g class="ln" style="color:var(--line)">
<path d="M130 70L310 130" marker-end="url(#sa)"/><path d="M380 70L380 130" marker-end="url(#sa)"/><path d="M630 70L460 130" marker-end="url(#sa)"/>
<path d="M380 190L380 230" marker-end="url(#sa)"/><path d="M380 290L380 310" marker-end="url(#sa)"/>
</g>
<rect class="bx" x="40" y="20" width="180" height="50"/><text x="130" y="42" text-anchor="middle" font-weight="600">Drums</text><text class="q" x="130" y="58" text-anchor="middle" font-size="11">sensor → Portal audio render</text>
<rect class="bx" x="290" y="20" width="180" height="50"/><text x="380" y="42" text-anchor="middle" font-weight="600">MiniFreak</text><text class="q" x="380" y="58" text-anchor="middle" font-size="11">stereo line → Portal C/D</text>
<rect class="bx" x="540" y="20" width="180" height="50"/><text x="630" y="42" text-anchor="middle" font-weight="600">Bass</text><text class="q" x="630" y="58" text-anchor="middle" font-size="11">pedals → Portal A (inst)</text>
<rect class="hi" x="250" y="130" width="260" height="60"/><text x="380" y="156" text-anchor="middle" font-weight="700">Portal (audio interface)</text>
<rect class="bx" x="250" y="230" width="260" height="60"/><text x="380" y="256" text-anchor="middle" font-weight="600">Ableton Live</text><text class="q" x="380" y="275" text-anchor="middle" font-size="11">record, loop, route, effects</text>
<text x="380" y="328" text-anchor="middle" font-size="12">Monitors / headphones</text>
</svg>
</figure>
</div></div>

<div class="row"><h2>Control path</h2>
<div class="b8">
<figure>
<svg class="sv" viewBox="0 0 760 250" role="img" aria-label="Control flow: percussion, Push, FX, loop controller all feed Ableton">
<defs><marker id="sc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g class="usb">
<path d="M100 70L280 130" marker-end="url(#sc)"/><path d="M320 70L350 130" marker-end="url(#sc)"/>
<path d="M530 70L430 130" marker-end="url(#sc)"/><path d="M680 70L460 130" marker-end="url(#sc)"/>
</g>
<rect class="bx" x="20" y="20" width="160" height="50"/><text x="100" y="42" text-anchor="middle" font-weight="600" font-size="12">Percussion</text><text class="q" x="100" y="58" text-anchor="middle" font-size="10">MIDI notes + CC per zone</text>
<rect class="bx" x="250" y="20" width="140" height="50"/><text x="320" y="42" text-anchor="middle" font-weight="600" font-size="12">Push 1</text><text class="q" x="320" y="58" text-anchor="middle" font-size="10">clips, scenes, fixed-length</text>
<rect class="bx" x="460" y="20" width="140" height="50"/><text x="530" y="42" text-anchor="middle" font-weight="600" font-size="12">Loop controller</text><text class="q" x="530" y="58" text-anchor="middle" font-size="10">foot MIDI</text>
<rect class="bx" x="610" y="20" width="140" height="50"/><text x="680" y="42" text-anchor="middle" font-weight="600" font-size="12">FX knobs</text><text class="q" x="680" y="58" text-anchor="middle" font-size="10">follows selected track</text>
<rect class="hi" x="220" y="130" width="320" height="60"/><text x="380" y="156" text-anchor="middle" font-weight="700">Ableton Live — control layer</text><text class="q" x="380" y="175" text-anchor="middle" font-size="11">Max for Live · MIDI effects · mapping</text>
</svg>
</figure>
<p class="sm">The effects controller does not need a hardware switch between instruments. Live's "map to selected track" behaviour retargets the same knobs to whichever track is selected. Selecting the track can be a pad on Push or a footswitch.</p>
</div></div>'''


def looping():
    return hero("Looping", "How to loop drums, bass, and synth layers so you can play other instruments and build up a piece.") + '''
<div class="row"><h2>Method: Session View clip recording</h2>
<div class="b8">
<p class="lg">Ableton's Session View is the looper. Fixed-length recording captures a clip of exactly N bars and starts looping it without stopping playback.</p>
<p>Every voice can be looped independently. Audio loops of the drums and bass free your hands for the synth. Audio loops of the MiniFreak free it for new layers — the synth can be re-patched while its last phrase keeps playing. Drums can also be looped as MIDI (the raw zone/velocity data) and re-routed to a different character or voice.</p>
<div class="rule"><h3>Why loops need the grid</h3>
<p class="sm">Loops lock to a fixed-length grid, not to each other directly — see <a href="clock.html">Clock</a> for when that grid is set. Without it, independently-played layers drift apart bar by bar: a 4-bar drum loop and a 4-bar bass loop recorded a few milliseconds apart from true tempo will slowly fall out of phase over a long set. Locking every <code>Fixed Length</code> recording to the same frozen grid is what keeps them stacking cleanly instead of smearing.</p>
</div>
</div></div>

<div class="row"><h2>How to control loops</h2>
<div class="b8">
<p>Hands are on the instrument. Loop control has to come from somewhere else.</p>
<figure>
<svg class="sv" viewBox="0 0 580 260" role="img" aria-label="Loop control button map: foot controller with four main switches and alternative trigger methods">
<defs><marker id="la" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<!-- Foot controller box -->
<rect style="fill:var(--panel);stroke:var(--line);stroke-width:2" x="30" y="20" width="340" height="140" rx="6"/>
<text x="200" y="48" text-anchor="middle" font-size="11" font-weight="600" style="fill:var(--ink-3)">MIDI foot controller (e.g. Morningstar MC6)</text>
<!-- 4 switches -->
<g style="fill:var(--accent);stroke:var(--accent);stroke-width:1.5">
<rect x="55" y="70" width="60" height="40" rx="4" fill-opacity=".15"/><text x="85" y="95" text-anchor="middle" font-size="10" font-weight="600" style="fill:var(--accent)">REC</text>
<rect x="130" y="70" width="60" height="40" rx="4" fill-opacity=".15"/><text x="160" y="95" text-anchor="middle" font-size="10" font-weight="600" style="fill:var(--accent)">STOP</text>
<rect x="205" y="70" width="60" height="40" rx="4" fill-opacity=".15"/><text x="235" y="95" text-anchor="middle" font-size="10" font-weight="600" style="fill:var(--accent)">SCENE</text>
<rect x="280" y="70" width="60" height="40" rx="4" fill-opacity=".15"/><text x="310" y="95" text-anchor="middle" font-size="10" font-weight="600" style="fill:var(--accent)">UNDO</text>
</g>
<text x="85" y="128" text-anchor="middle" font-size="8" style="fill:var(--ink-3)">long-press: clear</text>
<!-- Alternative: drum trigger -->
<rect style="fill:var(--panel);stroke:var(--line);stroke-width:1.5;stroke-dasharray:4 3" x="420" y="40" width="140" height="80" rx="4"/>
<text x="490" y="65" text-anchor="middle" font-size="10" font-weight="600" style="fill:var(--ink)">SP2 zone</text>
<text x="490" y="82" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">rim tap → MIDI</text>
<text x="490" y="96" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">→ Live record</text>
<!-- Arrows to Live -->
<rect style="fill:var(--panel);stroke:var(--accent);stroke-width:2" x="190" y="200" width="200" height="40" rx="4"/>
<text x="290" y="225" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--accent)">Ableton Live</text>
<line x1="200" y1="160" x2="250" y2="200" style="stroke:var(--ink-3);stroke-width:1.5" marker-end="url(#la)"/>
<line x1="490" y1="120" x2="350" y2="200" style="stroke:var(--ink-3);stroke-width:1.5" marker-end="url(#la)"/>
</svg>
<figcaption>Two paths: a dedicated foot controller for reliability, or trained drum zones for zero footprint.</figcaption>
</figure>
</div></div>

<div class="row">
<div class="b8">
''' + detail("Controller options", '''<ul>
<li><strong>Push 1, first:</strong> already owned, already has Fixed Length mode. Clunky for looping because it is a reach from the drums, but free and familiar.</li>
<li><strong>Compact MIDI foot controller:</strong> Morningstar MC6 (6 switches, programmable), Keith McMillen SoftStep 2 (10 pads, pressure-sensitive), or a simpler 2–4 button unit.</li>
<li><strong>Trained SP2 zone as a loop trigger:</strong> zero footprint — train a Sensory Percussion zone (e.g. a rim tap or shell hit on a specific drum) to send a MIDI note mapped to Live's record action. The drum <em>is</em> the controller.</li>
<li><strong>Small grid controller:</strong> Launchpad Mini, APC mini. More visual (LED clip status) but one more thing on the desk.</li>
</ul>
<p class="sm"><strong>Note:</strong> The Roland Octapad (SPD-30) is a percussion pad instrument, not a loop controller. It plays sounds, not clips.</p>''') + '''
</div></div>

<div class="row"><h2>Minimal vocabulary</h2>
<div class="b8">
<table>
<thead><tr><th>Action</th><th>What it does</th><th>Suggested mapping</th></tr></thead>
<tbody>
<tr><td>Record / overdub</td><td>Start recording into the selected clip slot; press again to overdub</td><td>Foot switch 1 or Push Fixed Length</td></tr>
<tr><td>Stop clip</td><td>Stop the currently playing clip on the selected track</td><td>Foot switch 2</td></tr>
<tr><td>Next scene</td><td>Move to the next scene row, preparing a new section</td><td>Foot switch 3 or Push</td></tr>
<tr><td>Undo</td><td>Remove the last overdub layer</td><td>Foot switch 4 or Ctrl+Z on Push</td></tr>
<tr><td>Clear loop</td><td>Delete the clip and start over</td><td>Long-press on foot switch 1 (programmable)</td></tr>
</tbody>
</table>
</div></div>

<div class="row"><h2>Example workflow</h2>
<div class="b8">
<ol class="lg">
<li>Set Fixed Length to 4 bars.</li>
<li>Lay down a drum groove. It captures, loops, frees your hands.</li>
<li>Pick up the bass, noodle into a riff. Record a 4-bar bass loop.</li>
<li>Reach for the MiniFreak, play a pad over the top. Record that too.</li>
<li>Now all three are looping. Pick up the sticks again and play live over the bed.</li>
<li>On the turnaround, trigger the next scene — the drum loop evolves, the bass hands off to the synth, the characters wake up.</li>
</ol>
</div></div>

<div class="row"><h2>Open: how loop length is chosen</h2>
<div class="b8">
<p>Loop lengths of 4, 8 and 16 bars cover most of what this rig needs, but which one is live for a given recording is still an open design question. Two shapes are on the table:</p>
<ul>
<li><strong>Three length buttons</strong> — dedicated 4/8/16 triggers, one press picks the length and arms the record.</li>
<li><strong>One record button plus a length selector</strong> — a single transport action, with the length set separately (a knob position, a pad, a mode toggle) before you commit.</li>
</ul>
<p>Either shape wants pads or knobs within easy hand-reach — Push 1's grid or the modular FX-knob controller (see <a href="midi.html">MIDI Controllers</a>) — rather than a footswitch, which has too few discrete positions to spare for this on top of record/stop/scene/undo.</p>
</div></div>'''


def clock():
    return hero("Clock", "Tempo follows your playing until the first loop closes — then it freezes as the grid.") + '''
<div class="row">
<div class="b8">
<p class="lg">The rule: tempo follows your playing until the first loop closes, then it freezes as the grid. Before that first close, there is no grid to drift against — Live's Tempo Follower (or BeatSeeker, the earlier Max for Live device, on older Live versions) tracks a rhythmic audio signal and moves Live's tempo to match it. The moment a loop locks, that tempo becomes the fixed grid for everything recorded afterward — see <a href="looping.html">Looping</a> for why layered loops need that grid to stay together.</p>
<p>Switching between following and fixed modes can be mapped to a footswitch, for the rare case you want to re-anchor tempo mid-set rather than wait for the next loop to close.</p>
<p><strong>What tempo-following tolerates:</strong> subtle fluctuation, ordinary push-and-pull. <strong>What it struggles with:</strong> sustained drift — speeding up or slowing down over several bars — where it can latch onto an early tempo and let the grid slip away. This is exactly why the freeze-at-first-loop rule exists: it gives the follower a narrow, forgiving window rather than asking it to track a whole performance.</p>
<div class="rule"><h3>Clock master</h3>
<p class="sm">If the MiniFreak's sequencer is synced to Live, the freeze moves everything together. If it runs free, loops recorded into Live are quantised to the frozen grid but the MiniFreak's own sequencer is not, and the feel is looser.</p>
</div>
</div></div>'''


def expression():
    return hero("Expression", "What the playing can do to the synth and effects — from simple and legible to poetic.") + '''
<div class="row">
<div class="b12">
<figure>
<svg class="sv" viewBox="0 0 700 330" role="img" aria-label="Expression mapping diagram: eight playing dynamics on the left connected to four effect targets on the right, with first experiments and suggested next mappings highlighted">
<defs>
<marker id="ea" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
<marker id="eah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--accent)"/></marker>
<marker id="ean" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--ink-3)"/></marker>
</defs>
<text x="10" y="14" font-size="10" font-weight="700" style="fill:var(--ink-3)">PLAYING DYNAMICS</text>
<text x="690" y="14" text-anchor="end" font-size="10" font-weight="700" style="fill:var(--ink-3)">WHAT IT AFFECTS</text>
<g class="bx">
<rect x="10" y="20" width="170" height="30"/><rect x="10" y="56" width="170" height="30"/>
<rect x="10" y="92" width="170" height="30"/><rect x="10" y="128" width="170" height="30"/>
<rect x="10" y="164" width="170" height="30"/><rect x="10" y="200" width="170" height="30"/>
<rect x="10" y="236" width="170" height="30"/><rect x="10" y="272" width="170" height="30"/>
</g>
<g font-size="11" font-weight="600" style="fill:var(--ink)">
<text x="95" y="39" text-anchor="middle">Velocity</text>
<text x="95" y="75" text-anchor="middle">Consistency</text>
<text x="95" y="111" text-anchor="middle">Play area</text>
<text x="95" y="147" text-anchor="middle">Timing (ahead/behind)</text>
<text x="95" y="183" text-anchor="middle">Speed</text>
<text x="95" y="219" text-anchor="middle">Energy</text>
<text x="95" y="255" text-anchor="middle">Strike type</text>
<text x="95" y="291" text-anchor="middle">Silence</text>
</g>
<g class="bx">
<rect x="520" y="15" width="170" height="60"/><rect x="520" y="95" width="170" height="60"/>
<rect x="520" y="175" width="170" height="60"/><rect x="520" y="255" width="170" height="60"/>
</g>
<g font-size="12" font-weight="600" style="fill:var(--ink)">
<text x="605" y="49" text-anchor="middle">Synth parameters</text>
<text x="605" y="129" text-anchor="middle">Effects</text>
<text x="605" y="209" text-anchor="middle">Generative controls</text>
<text x="605" y="289" text-anchor="middle">Drum sounds</text>
</g>
<g style="stroke:var(--ink-3);stroke-width:1.3;fill:none">
<path d="M180 35L520 45" marker-end="url(#ean)"/>
<path d="M180 143L520 125" marker-end="url(#ean)"/>
<path d="M180 179L520 125" marker-end="url(#ean)"/>
<path d="M180 219L520 209" marker-end="url(#ean)"/>
<path d="M180 255L520 289" marker-end="url(#ean)"/>
<path d="M180 287L520 209" marker-end="url(#ean)"/>
</g>
<g style="stroke:var(--accent);stroke-width:2.2;fill:none">
<path d="M180 35L520 125" marker-end="url(#eah)"/>
<path d="M180 179L520 45" marker-end="url(#eah)"/>
</g>
<g style="stroke:var(--accent);stroke-width:2.2;stroke-dasharray:6 4;fill:none">
<path d="M180 111L520 45" marker-end="url(#eah)"/>
<path d="M180 71L520 209" marker-end="url(#eah)"/>
</g>
<g font-size="9" style="fill:var(--ink-3)">
<text x="350" y="30">volume, amplitude</text>
<text x="350" y="245">voicing</text>
<text x="350" y="268">growth</text>
</g>
<g font-size="9" font-weight="700" style="fill:var(--accent)">
<text x="190" y="28">reverb send — first experiment</text>
<text x="190" y="90">randomisation — suggested next</text>
<text x="190" y="130">timbre blend — suggested next</text>
<text x="190" y="172">filter cutoff — first experiment</text>
</g>
</svg>
<figcaption>Solid accent lines are the first experiments already running (hi-hat speed → filter cutoff, snare velocity → reverb send). Dashed accent lines are the suggested next mappings (play area → timbre blend, consistency → randomisation). Grey lines are mapped but not yet prioritised.</figcaption>
</figure>
</div></div>

<div class="row"><h2>Tier 1 — Direct, one to one</h2>
<div class="b8">
<p class="lg"><strong>Velocity → amplitude</strong> of the synth voice · <strong>Velocity → filter cutoff</strong>: harder is brighter · <strong>Zone → patch or layer</strong>: edge is a pluck, centre a pad, rim a stab · <strong>Speed → cutoff or resonance</strong>, continuously · <strong>Strike type → separate voice</strong>: rimshot stabs, open hits swell</p>
</div></div>

<div class="row"><h2>Tier 2 — Shaping rather than switching</h2>
<div class="b8">
<p><strong>Velocity → envelope attack/release:</strong> hard is snappy, soft is slow · <strong>Position → pan,</strong> mirroring where the stick lands · <strong>Speed → delay feedback:</strong> busy playing builds wash · <strong>Speed → LFO rate</strong> on a pad's tremolo · <strong>Velocity → reverb send:</strong> loud blooms, soft stays dry</p>
</div></div>

<div class="row"><h2>Tier 3 — Derived and relational</h2>
<div class="b8">
''' + detail("Mapping details", '''<ul>
<li><strong>Micro-timing</strong> (ahead/behind the grid) → delay time or LFO phase, so rushing or dragging destabilises the texture</li>
<li><strong>Dynamic variance → randomisation amount</strong> on the generative sequencer: erratic playing makes the system wilder, steady playing calms it</li>
<li><strong>Rolling average velocity → intensity macro</strong> that blends in unison or extra oscillator layers as energy builds</li>
<li><strong>Position drift across a phrase → wavetable blend</strong>, giving a phrase an arc rather than a per-hit reaction</li>
</ul>''', "Max for Live") + '''
</div></div>

<div class="row"><h2>Tier 4 — The system has a personality</h2>
<div class="b8">
''' + detail("Mapping details", '''<ul>
<li><strong>Silence → growth:</strong> an ambient layer swells during rests and recedes on re-entry; stopping becomes a compositional act</li>
<li><strong>Call and response:</strong> sample the last phrase and answer it a bar later, decayed or reharmonised</li>
<li><strong>Fatigue:</strong> cumulative density over the set slowly darkens or saturates the tone, giving the whole performance a long arc</li>
<li><strong>Decaying influence:</strong> each hit nudges a parameter and the nudge decays over seconds, leaving a trail like ripples</li>
<li><strong>Surprise threshold:</strong> unusually steady playing triggers a rare one-off event — a key change, a drop-out, a new voice</li>
<li><strong>Cross-modulation between limbs:</strong> the time gap between hat and snare hits drives something neither does alone</li>
<li><strong>Harmonic memory:</strong> recent choices bias what the sequencer may play next, so the piece remembers where it has been</li>
</ul>''', "Max for Live") + '''
</div></div>

<div class="row">
<div class="b8">
<p class="sm"><strong>Suggested order</strong> after the first experiment: position → timbre blend (expression independent of volume), then dynamic variance → randomisation amount (the first mapping that feels alive rather than reactive).</p>
</div></div>'''


def chemistry():
    return hero("Chemistry", "The synth sounds are not patches — they are characters, each with its own feel, living in the environment the drums create.") + '''
<div class="row">
<div class="b8">
<p class="lg">Each character has two halves: what it feels like to play with, and how to build it. Click the build section to expand it. Their voices are all MiniFreak presets — one synth holds several at once, or one character per scene.</p>
</div></div>

<div class="row">
<div class="b12">
''' + creature("The turnaround", "form-aware — knows where it is in the bar count",
    "The environment counts along with you. In 4/4 it knows a four- or eight-bar phrase is coming to its turnaround and, as you approach it, the characters brace — a pad holds its breath, a pluck leans in. On the downbeat of the new phrase something happens: the key shifts under you, or everything drops out for a bar and comes back changed, or a new character wakes up.",
    [
        'Live\'s transport is the form clock: a Max for Live device reads <code>live.set</code> current bar and counts within an 8-bar phrase.',
        'Bars 7–8 raise a "turnaround" signal mapped to tension parameters: pad filter down, delay feedback up, arp rate halving.',
        'On bar 1: weighted chance picks an event — <em>transpose</em>, <em>silence</em> (mute one bar), or <em>wake</em> (launch the next clip).',
        'Chance weights modulated by playing: high density favours <em>wake</em>, low favours <em>silence</em>.',
    ]) + '''
</div></div>

<div class="row">
<div class="b12">
''' + creature("The surface", "position-pitched — the head is a keyboard",
    "The drumhead is no longer one note. Centre is low and dark, moving outward the note climbs and the tone opens. A roll that drifts from the middle to the rim becomes a rising, brightening phrase. The pad under the sticks becomes a melodic instrument you play by where, not just when.",
    [
        'Blended zones (Centre ↔ Edge): Timbre outputs a continuous 0–1 position per hit.',
        'Max for Live quantises the CC into a scale (5–8 steps) and rewrites the note pitch.',
        'Unquantised CC maps to filter cutoff so brightness tracks position.',
        'Start with one tom as the surface; expand once the scale feels right.',
    ]) + '''
</div></div>

<div class="row">
<div class="b12">
''' + creature("The mimic", "listens, learns the groove, carries it on — and decays without attention",
    "You lay down a rhythm and the mimic starts to shadow it — first exactly, then in its own way, keeping the shape but choosing variations. Stop and it keeps going. But leave it too long and it gets thinner. Hits go missing, the timing loosens, the pitch drifts. It is still your idea, but it is forgetting it. Come back in and it brightens. It is a character you have to keep feeding.",
    [
        '<strong>Capture:</strong> Max for Live records incoming drum MIDI into a rolling buffer (last 2–4 bars), storing beat position, velocity, zone and micro-timing.',
        '<strong>Model:</strong> per-step hit probabilities and a velocity profile (first-order Markov chain, weighted by recency).',
        '<strong>Life meter:</strong> 0–1, rises with each real hit (fast attack), decays exponentially when none arrive.',
        '<strong>Decay behaviours</strong> driven by (1 − life): probability drops, timing jitters, pitch drifts, tone degrades. At life ≈ 0, silence.',
    ]) + '''
</div></div>

<div class="row">
<div class="b12">
''' + creature("The understudy", "bass-to-synth handoff — the groove transfers and mutates",
    "The bass groove you looped hands off to the synth and it starts to make it its own. It adds notes, leaves some out, finds syncopated bits you did not play. The groove you laid down is still there underneath, but the synth is riffing on it, learning the general feel and playing with it musically.",
    [
        'Bass audio → Jam Origin MIDI Bass (real-time) → MIDI recorded alongside the audio loop.',
        'On turnaround, MIDI routes to MiniFreak; audio crossfades out.',
        'Scale MIDI effect keeps additions in key. Note-chance device drops/shifts/adds at probability thresholds.',
        'Same groove-learning principle as the mimic: the longer it plays, the further it drifts.',
    ]) + '''
</div></div>

<div class="row"><h2>Voice routing</h2>
<div class="b8">
<p class="lg">Each character can be set to listen to any other character's output — its notes, its dynamics, its life signal. When two characters listen to each other, they start forming feedback loops.</p>
<figure>
<svg class="sv net" viewBox="0 0 440 280" role="img" aria-label="Voice routing diagram: four characters connected by directional arrows">
<defs><marker id="ra" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g class="node" transform="translate(100 60)"><circle r="30" style="fill:var(--panel)"/><text text-anchor="middle" y="4" font-size="11" font-weight="600">Turnaround</text></g>
<g class="node" transform="translate(340 60)"><circle r="30" style="fill:var(--panel)"/><text text-anchor="middle" y="4" font-size="11" font-weight="600">Surface</text></g>
<g class="node" transform="translate(100 220)"><circle r="30" style="fill:var(--panel)"/><text text-anchor="middle" y="4" font-size="11" font-weight="600">Mimic</text></g>
<g class="node" transform="translate(340 220)"><circle r="30" style="fill:var(--panel)"/><text text-anchor="middle" y="4" font-size="11" font-weight="600">Understudy</text></g>
<g style="color:var(--accent)">
<path class="edge strong" d="M135 60L305 60" marker-end="url(#ra)"/>
<path class="edge strong" d="M305 65L135 65" marker-end="url(#ra)"/>
<path class="edge strong" d="M100 95L100 185" marker-end="url(#ra)"/>
<path class="edge strong" d="M340 185L340 95" marker-end="url(#ra)"/>
<path class="edge" d="M130 85L310 195" marker-end="url(#ra)" style="stroke:var(--ink-3)"/>
<path class="edge" d="M310 200L130 90" marker-end="url(#ra)" style="stroke:var(--ink-3)"/>
</g>
<text x="220" y="50" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">notes, velocity</text>
<text x="220" y="78" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">rhythm echo</text>
<text x="60" y="145" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">life signal</text>
<text x="385" y="145" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">groove data</text>
</svg>
<figcaption>Routing matrix: accent arrows are active connections, grey are potential. Any character can listen to any other.</figcaption>
</figure>
</div></div>

<div class="row">
<div class="b12">
''' + detail("Routing architecture", '''
<ul>
<li><strong>Routing matrix:</strong> a Max for Live device or a simple send/receive bus where each character's output signals (notes fired, velocity profile, life meter, density) are published, and each character subscribes to whichever others it wants to hear.</li>
<li><strong>Response rules:</strong> when character A hears character B fire a note, it might echo it (transposed), answer it (a complementary rhythm), or go quiet (make space). These rules go both ways — B also reacts to A.</li>
<li><strong>Locking in:</strong> two characters listening and responding to each other will eventually converge — their patterns interlock and a repeating figure emerges from what started as generative drift. This is the payoff: emergent structure from simple rules.</li>
<li><strong>Spiralling out:</strong> or they do not converge. The feedback amplifies differences instead of smoothing them — density escalates, timing scatters, the texture grows chaotic. A life-meter decay or a turnaround event can reset the spiral, or you can let it ride and play into the chaos.</li>
<li><strong>Manual routing:</strong> switching which voices listen to which could be a performance gesture — a knob or a Push pad that rewires the connections mid-set, changing which characters are in conversation.</li>
</ul>''', "Max for Live") + '''
</div></div>

<div class="row"><h2>Where this leads</h2>
<div class="b8">
<p>The characters are not just listening to the drummer — they are listening to each other. One Max for Live device per character, with a shared bus of a few signals (life, turnaround, density, position), is enough architecture. The music makes itself.</p>
</div></div>'''


# --- Shared gear data (used by both roadmap gear links and gear page) ---
GEAR = [
    # Phase 1 — already owned
    {"item":"Arturia MiniFreak",           "role":"Synth",    "phase":1, "status":"Owned",   "cost":0,   "cables":"", "notes":"Onboard sequencer and arp first"},
    {"item":"Ableton Live Suite",          "role":"Hub",      "phase":1, "status":"Owned",   "cost":0,   "cables":"", "notes":"Max for Live required"},
    {"item":"Ableton Push 1",              "role":"Control",  "phase":1, "status":"Owned",   "cost":0,   "cables":"", "notes":"Session view looping, Fixed Length first"},
    # Phase 2 — audio path. The EVANS Portal is bought here as the SP2
    # Starter Pack bundle — it is both the audio interface and the sensor
    # hub, and the bundle price includes the first drum sensor as a bonus,
    # so there is no separate Portal purchase in Phase 5.
    {"item":"EVANS Portal — SP2 Starter Pack (interface + 1 sensor)", "role":"Audio I/O","phase":2, "status":"Needed",  "cost":1240,"cables":"USB-C cable 3m ($25)", "notes":"One purchase, two jobs: 16-ch audio interface (dedicated headphone out, ADAT expansion) and the SP2 sensor hub. Comes with the first drum sensor — goes on the snare (centre) — ready for Phase 5."},
    {"item":"Audio-Technica ATH-M50x",     "role":"Output",   "phase":2, "status":"Needed",  "cost":250, "cables":"6.35mm → 3.5mm adapter (included)", "notes":"Closed-back for low-volume cue monitoring"},
    {"item":"6.35mm TRS cable 3m (×2)",    "role":"Cable",    "phase":2, "status":"Needed",  "cost":40,  "cables":"", "notes":"Portal main out → monitors/amp"},
    {"item":"3.5mm TRS cable 1m",          "role":"Cable",    "phase":2, "status":"Needed",  "cost":15,  "cables":"", "notes":"MiniFreak audio out → Portal input"},
    # Phase 3 — no new gear
    # Phase 4 — foot control
    {"item":"Morningstar MC6 Pro",         "role":"Control",  "phase":4, "status":"Needed",  "cost":560, "cables":"USB-C cable 3m ($25); TRS MIDI cable 1.5m ($15)", "notes":"6 footswitches, deeply programmable MIDI"},
    {"item":"Moog EP-3 expression pedal",  "role":"Control",  "phase":4, "status":"Needed",  "cost":90,  "cables":"TRS cable 2m ($15) to MC6 expression input", "notes":"Continuous control — filter, volume, FX depth"},
    {"item":"TRS cables for MC6",          "role":"Cable",    "phase":4, "status":"Needed",  "cost":40,  "cables":"", "notes":"USB-C ($25) + TRS MIDI ($15)"},
    # Phase 5 — drums: snare (centre), tom-as-hi-hat (left), tom-as-ride (right),
    # tom 1 (top-left), tom 2 (top-right), kick pedal, hi-hat pedal — 5 struck
    # surfaces + 2 foot pedals, all reading through SP2 sensors. The Portal
    # and the snare's sensor were already bought in Phase 2 (see above) —
    # this phase is just the four remaining sensors plus the pedals and shells.
    {"item":"SP2 Drum Sensor Expansion (×4)", "role":"Percussion","phase":5,"status":"Needed",  "cost":920, "cables":"Sensor cables ×4 (included)", "notes":"One sensor each for: tom acting as hi-hat (left), tom acting as ride (right), tom 1 (top-left), tom 2 (top-right)"},
    {"item":"Kick pedal (trigger pad + SP2 sensor)", "role":"Percussion","phase":5,"status":"Needed", "cost":290, "cables":"Sensor cable (included)", "notes":"Compact pad played with a standard bass-drum pedal beater — not a full-size kick drum"},
    {"item":"Hi-hat pedal (foot controller)", "role":"Percussion","phase":5,"status":"Needed", "cost":90, "cables":"TRS cable to Portal or Morningstar expression in ($15)", "notes":"Continuous pedal — open/close position sent as CC to blend the hi-hat tom's sample layers; Portal's pedal input is unconfirmed, may route via the Morningstar's spare expression input instead"},
    {"item":"Low-volume shells + mesh heads (snare + 4 toms)","role":"Percussion","phase":5,"status":"Needed","cost":850,"cables":"", "notes":"5 drums total, arranged around the seat: snare centre, 2 toms repurposed as hi-hat/ride either side, 2 further toms top-left/top-right"},
    # Phase 6 — bass
    {"item":"Bass guitar",                 "role":"Bass",     "phase":6, "status":"Needed",   "cost":2000,   "cables":"", "notes":"Not yet owned — budget earmarked, model TBC"},
    {"item":"SansAmp Bass Driver DI V2",   "role":"Bass",     "phase":6, "status":"Needed",  "cost":520, "cables":"Instrument cable 3m ($25) bass → DI; XLR cable 3m ($25) DI → Portal", "notes":"Preamp + DI in one pedal"},
    {"item":"MXR Bass Compressor",         "role":"Bass",     "phase":6, "status":"Needed",  "cost":390, "cables":"Patch cable ($15) DI → compressor", "notes":"Tames dynamics for consistent loop levels"},
    {"item":"Jam Origin MIDI Bass (plugin)","role":"Bass → MIDI","phase":6,"status":"Needed","cost":0,   "cables":"", "notes":"Free — real-time bass-to-MIDI conversion"},
    {"item":"Bass cables",                 "role":"Cable",    "phase":6, "status":"Needed",  "cost":65,  "cables":"", "notes":"Instrument cable 3m ($25) + XLR 3m ($25) + patch ($15)"},
    # Deferred
    {"item":"Hardware step sequencer",     "role":"Synth",    "phase":0, "status":"Deferred","cost":0,   "cables":"", "notes":"Only if MiniFreak + Live runs out"},
    {"item":"Separate audio interface",    "role":"Audio I/O","phase":0, "status":"Deferred","cost":0,   "cables":"", "notes":"Fallback if Portal can't handle all I/O"},
    {"item":"Modular MIDI controller",     "role":"Control",  "phase":0, "status":"Deferred","cost":0,   "cables":"", "notes":"Intech Grid / Monogram; follows selected track"},
]


def phase_cost(n):
    """Sum of needed-item costs for a given phase, derived from GEAR so the
    roadmap and gear pages can never drift apart."""
    return sum(g["cost"] for g in GEAR if g["phase"] == n and g["status"] == "Needed")


def roadmap():
    # Costs are derived from GEAR (phase_cost), not hand-entered, so editing
    # the gear list is the single source of truth for both pages.
    phases = [
        {"n":1, "title":"Play what you have", "sub":"Learn Ableton looping",
         "body":"""<p>Learn Ableton's looping workflow before spending money. Record MiniFreak into Ableton, loop clips with Push 1, chain effects, get comfortable with scenes and arrangement.</p>
<p>Push 1's session view is already a decent looping surface — learn what it can and can't do from your lap before you decide what foot control you need.</p>
<p>The MiniFreak's audio goes straight into your computer's built-in audio interface. Latency will be noticeable but workable for practice. You're not performing — you're getting your hands on the workflow.</p>""",
         "gate":"You can record a loop, layer a second part over it, and switch scenes without fumbling."},
        {"n":2, "title":"Get the audio path right", "sub":"Cue monitoring, low latency",
         "body":"""<p>Buy the EVANS Portal here, as the Sensory Percussion 2 Starter Pack — one purchase that does two jobs: it is both the audio interface for this phase and the sensor hub the drums will plug into in Phase 5. The bundle includes the first drum sensor (destined for the snare), so there is nothing left to buy for the Portal later.</p>
<p>It gives you 16 channels of I/O, a dedicated headphone output with its own volume knob, ultra-low latency, and ADAT expansion for later.</p>
<p>Set up Ableton's cue/solo system: Main Out → Portal Main L/R (speakers), Cue Out → Portal Headphone L/R. Click the headphone icon on any track to preview it in your ears while the audience hears only the master mix — the "silent jamming" workflow.</p>
<p>The Portal's low latency means the MiniFreak will feel much tighter through Ableton's effects chain. This is when playing through the computer stops feeling like a compromise.</p>""",
         "gate":"Portal is patched in, cue monitoring works, and the MiniFreak's round-trip latency feels invisible."},
        {"n":3, "title":"Build sonic environments", "sub":"Worlds for the drums to land in",
         "body":"""<p>With the Portal providing clean audio and cue monitoring, build the worlds the drums and bass will eventually live in. Create Ableton sessions with ambient pads and textures from the MiniFreak, effects chains (reverb, delay, granular processing), rhythmic patterns, and multiple scenes — each a different mood or energy level.</p>
<p>Think of each session as an environment you'll walk into with drumsticks later. When the SP2 arrives, you want to hit a drum and immediately hear it inside a world that responds — not a blank project.</p>
<p>This is also when to start exploring Max for Live. The expression mapping and character behaviours all run through M4L later.</p>""",
         "gate":"You have a few sessions that feel like places — environments you enjoy playing inside, with layered textures and effects."},
        {"n":4, "title":"Get your hands off the computer", "sub":"Foot-controlled looping + FX",
         "body":"""<p>The minimum gear to make the rig performable. Right now everything runs through Push 1 and the mouse — fine for building, but you can't loop and play at the same time if your hands are on the keys.</p>
<p>The foot controller gives you record/stop, scene launch, undo, and effects toggle — all by foot. The expression pedal adds continuous control: filter sweeps, volume fades, effect depth.</p>
<p>Morningstar controllers speak MIDI natively and are deeply programmable — each switch can send different messages per press, hold, double-tap, and release.</p>""",
         "gate":"You can play the MiniFreak, loop a part, layer a second part, and control at least one effect parameter — all without touching the laptop."},
        {"n":5, "title":"Add drums", "sub":"SP2 plugs into your environments",
         "body":"""<p>The drums are the rig's primary instrument and its richest control surface. SP2 turns each drum into dozens of zones — centre, edge, rim, cross-stick, press, dampen — and each zone can trigger samples, synths, effects, or MIDI.</p>
<p>The Portal and the snare's sensor are already in hand from Phase 2 — this phase is the four remaining sensors (for the hi-hat tom, ride tom, and two more toms), the kick pedal, the hi-hat pedal, and the shells and mesh heads to put them on.</p>
<p>The kit itself is deliberately compact: snare centre, a tom either side standing in for hi-hat and ride, two more toms top-left and top-right, plus a kick pedal and a hi-hat pedal at your feet. Five struck surfaces, two pedals — everything reachable without standing up.</p>
<p>Because you built environments in Phase 3, the drums plug into something alive on day one. The SP2 zones also become expression controllers: pressing a head can swell a reverb, a rimshot can trigger a scene change.</p>
<p>This is when the characters come alive — turnaround, surface, mimic.</p>""",
         "gate":"You can play drums inside your environments, loop drum parts with the foot controller, and trigger at least one character behaviour from the kit."},
        {"n":6, "title":"Add bass", "sub":"Understudy character online",
         "body":"""<p>Bass completes the trio — drums, synth, bass — and brings the understudy character online. Unlike the other two instruments, the bass itself still needs buying; $2,000 is earmarked for it, model still open.</p>
<p>The understudy is powered by Jam Origin MIDI Bass (free), converting bass audio into MIDI in real time. One instrument, two outputs: the bass sound and the MIDI translation running in parallel.</p>
<p>The SansAmp Bass Driver DI gives you character and a clean DI signal. A compressor tames dynamics for consistent loop levels.</p>
<p>With bass in, the full rig is operational. From here it's about depth — refining the characters, building more environments, developing a performance practice.</p>""",
         "gate":"You can play all three instruments, loop any of them, preview silently in headphones, control effects from your feet, and the characters respond to how you play."},
    ]

    for p in phases:
        p["cost"] = phase_cost(p["n"])
        p["buy"] = p["cost"] > 0

    total = sum(p["cost"] for p in phases)

    # Build SVG map — compact, clickable phases
    svg = '''<svg class="sv rm-map" viewBox="0 0 340 520" role="img" aria-label="Six phases from MiniFreak to full rig">
<style>
.rm-box{rx:8;fill:none;stroke:var(--fg,.35);stroke-width:1.25;cursor:pointer;transition:stroke .2s}
.rm-buy{rx:8;fill:var(--accent,.08);stroke:var(--accent);stroke-width:2;cursor:pointer;transition:fill .2s}
.rm-box:hover,.rm-buy:hover{stroke-width:2.5}
.rm-box.active{stroke:var(--accent);stroke-width:2.5;fill:var(--accent,.06)}
.rm-buy.active{fill:var(--accent,.2);stroke-width:3}
.rm-conn{fill:none;stroke:var(--fg,.3);stroke-width:1.25}
.rm-name{font-size:13px;font-weight:600;text-anchor:middle;pointer-events:none}
.rm-sub{font-size:10.5px;text-anchor:middle;opacity:.6;pointer-events:none}
.rm-cost{font-size:11px;font-weight:600;text-anchor:end;pointer-events:none;fill:var(--accent)}
.rm-nocost{font-size:10.5px;text-anchor:end;opacity:.45;pointer-events:none}
.rm-end{rx:8;fill:var(--accent,.08);stroke:var(--accent,.4);stroke-width:1.25}
</style>
'''
    y = 10
    h_box = 52
    gap = 14
    for i, p in enumerate(phases):
        cls = "rm-buy" if p["buy"] else "rm-box"
        svg += f'<g class="rm-phase" data-phase="{p["n"]}">\n'
        svg += f'<rect class="{cls}" x="10" y="{y}" width="220" height="{h_box}"/>\n'
        svg += f'<text class="rm-name" x="120" y="{y+22}">{p["n"]}. {p["title"]}</text>\n'
        svg += f'<text class="rm-sub" x="120" y="{y+38}">{p["sub"]}</text>\n'
        if p["cost"] > 0:
            svg += f'<text class="rm-cost" x="326" y="{y+30}">~${p["cost"]:,}</text>\n'
        else:
            svg += f'<text class="rm-nocost" x="326" y="{y+30}">$0</text>\n'
        svg += '</g>\n'
        if i < len(phases)-1:
            mid = y + h_box
            svg += f'<line class="rm-conn" x1="120" y1="{mid}" x2="120" y2="{mid+gap}"/>\n'
        y += h_box + gap

    svg += f'''<rect class="rm-end" x="10" y="{y+4}" width="320" height="30"/>
<text x="170" y="{y+24}" style="font-size:12px;font-weight:600;text-anchor:middle">Total new gear: ~${total:,} AUD</text>
</svg>'''

    # Build phase detail panels (hidden by default, shown by JS)
    panels = ''
    running = 0
    for p in phases:
        running += p["cost"]
        cost_html = f'<span class="phase-cost">~${p["cost"]:,} AUD</span>' if p["cost"]>0 else '<span class="phase-cost zero">$0 — time, not money</span>'
        running_html = f'<span class="phase-running">Running total: ~${running:,}</span>' if running > 0 else ''
        panels += f'''<div class="rm-panel" id="rmp{p["n"]}" hidden>
<h2><span class="pnum">{p["n"]}</span> {p["title"]}</h2>
<div class="phase-costs">{cost_html}{running_html}</div>
{p["body"]}
<p class="meta gate"><strong>Ready for next phase when:</strong> {p["gate"]}</p>
<p class="rm-gear-link"><a href="gear.html?phase={p["n"]}">View Phase {p["n"]} gear →</a></p>
</div>
'''

    return hero("Build roadmap",
                "Six phases from what you have to the full rig. Build environments first, add instruments into something alive."
                ) + f'''
<div class="row">
<div class="b5 rm-left">
{svg}
<p class="rm-hint">Click a phase to see details</p>
</div>
<div class="b7 rm-right" id="rmRight">
<div class="rm-panel rm-welcome" id="rmpWelcome">
<p class="rm-welcome-text">Four purchases across six phases. The first three phases get you performing with the MiniFreak alone; drums and bass join a rig that's already alive.</p>
<p>Click a phase on the left to see what's involved.</p>
</div>
{panels}
</div>
</div>

<script>
(function(){{
  const panels = document.querySelectorAll('.rm-panel');
  const phases = document.querySelectorAll('.rm-phase');
  const welcome = document.getElementById('rmpWelcome');
  let active = null;

  function show(n) {{
    panels.forEach(p => p.hidden = true);
    phases.forEach(g => {{
      const r = g.querySelector('rect');
      if (r) r.classList.remove('active');
    }});
    if (n === active) {{ welcome.hidden = false; active = null; return; }}
    const panel = document.getElementById('rmp' + n);
    if (panel) panel.hidden = false;
    phases.forEach(g => {{
      if (g.dataset.phase == n) {{
        const r = g.querySelector('rect');
        if (r) r.classList.add('active');
      }}
    }});
    active = n;
  }}

  phases.forEach(g => {{
    g.addEventListener('click', () => show(g.dataset.phase));
  }});

  // Deep-link: ?phase=N
  const u = new URLSearchParams(location.search);
  if (u.has('phase')) show(u.get('phase'));
}})();
</script>'''


def gear():
    # Build rows from GEAR data
    rows = ''
    for g in GEAR:
        ph = f'Phase {g["phase"]}' if g["phase"] > 0 else '—'
        st_cls = ''
        if g["status"] == 'Needed': st_cls = ' class="st need"'
        elif g["status"] == 'Deferred': st_cls = ' class="st defer"'
        cost_str = f'${g["cost"]:,}' if g["cost"] > 0 else ('Free' if g["status"]=='Needed' and 'plugin' in g["item"].lower() else '—')
        cables = g["cables"] if g["cables"] else '—'
        rows += f'<tr data-phase="{g["phase"]}" data-role="{g["role"]}">'
        rows += f'<td>{g["role"]}</td><td>{g["item"]}</td><td{st_cls}>{g["status"]}</td>'
        rows += f'<td>{ph}</td><td class="cost">{cost_str}</td>'
        rows += f'<td class="cables">{cables}</td><td class="notes">{g["notes"]}</td></tr>\n'

    # Phase subtotals
    phase_totals = {}
    for g in GEAR:
        if g["phase"] > 0:
            phase_totals.setdefault(g["phase"], 0)
            phase_totals[g["phase"]] += g["cost"]
    total = sum(g["cost"] for g in GEAR)
    needed_total = sum(g["cost"] for g in GEAR if g["status"]=="Needed")

    subtotals_rows = ''
    running = 0
    for pn in sorted(phase_totals.keys()):
        running += phase_totals[pn]
        subtotals_rows += f'<tr><td>Phase {pn}</td><td class="cost">${phase_totals[pn]:,}</td><td class="cost">${running:,}</td></tr>\n'

    return hero("Gear List", "Everything the rig needs — what's owned, what to buy, and what it costs.") + f'''
<div class="row">
<div class="b12">
<div class="gear-controls">
<label>Sort by:</label>
<button class="gear-sort active" data-sort="phase">Phase</button>
<button class="gear-sort" data-sort="role">Role</button>
<button class="gear-sort" data-sort="status">Status</button>
<button class="gear-sort" data-sort="cost">Cost</button>
<label style="margin-left:1.5rem">Filter:</label>
<select id="gearFilter">
<option value="all">All items</option>
<option value="1">Phase 1</option>
<option value="2">Phase 2</option>
<option value="3">Phase 3</option>
<option value="4">Phase 4</option>
<option value="5">Phase 5</option>
<option value="6">Phase 6</option>
<option value="needed">Needed only</option>
<option value="owned">Owned only</option>
</select>
</div>
<table class="gear-table" id="gearTable">
<thead><tr>
<th data-col="role">Role</th><th data-col="item">Item</th><th data-col="status">Status</th>
<th data-col="phase">Phase</th><th data-col="cost">Est. cost</th>
<th>Cables needed</th><th>Notes</th>
</tr></thead>
<tbody>
{rows}</tbody>
</table>
</div></div>

<div class="row">
<div class="b6">
<h3>Cost by phase</h3>
<table class="subtotals">
<thead><tr><th>Phase</th><th>Phase cost</th><th>Running total</th></tr></thead>
<tbody>{subtotals_rows}</tbody>
<tfoot><tr><td><strong>Total (new gear)</strong></td><td class="cost"><strong>${needed_total:,}</strong></td><td></td></tr></tfoot>
</table>
<p class="sm" style="margin-top:.8rem">All prices are AUD estimates as of Nov 2026. Actual prices will vary.</p>
</div>
<div class="b6">
<p><a href="roadmap.html">← Back to Build Roadmap</a></p>
</div>
</div>

<script>
(function(){{
  const table = document.getElementById('gearTable');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const filter = document.getElementById('gearFilter');
  const sortBtns = document.querySelectorAll('.gear-sort');

  // Parse from URL
  const u = new URLSearchParams(location.search);
  if (u.has('phase')) filter.value = u.get('phase');

  function getVal(row, key) {{
    if (key === 'phase') return parseInt(row.dataset.phase) || 99;
    if (key === 'role') return row.dataset.role.toLowerCase();
    if (key === 'status') {{
      const s = row.children[2].textContent;
      return s === 'Owned' ? 0 : s === 'Needed' ? 1 : 2;
    }}
    if (key === 'cost') {{
      const t = row.children[4].textContent.replace(/[$,—Free]/g,'');
      return parseFloat(t) || 0;
    }}
    return row.children[1].textContent.toLowerCase();
  }}

  let currentSort = 'phase';
  function doSort(key) {{
    currentSort = key;
    rows.sort((a,b) => {{
      const av = getVal(a, key), bv = getVal(b, key);
      if (typeof av === 'number') return av - bv;
      return av < bv ? -1 : av > bv ? 1 : 0;
    }});
    rows.forEach(r => tbody.appendChild(r));
    sortBtns.forEach(b => b.classList.toggle('active', b.dataset.sort === key));
  }}

  function doFilter() {{
    const v = filter.value;
    rows.forEach(r => {{
      if (v === 'all') {{ r.hidden = false; return; }}
      if (v === 'needed') {{ r.hidden = r.children[2].textContent !== 'Needed'; return; }}
      if (v === 'owned') {{ r.hidden = r.children[2].textContent !== 'Owned'; return; }}
      r.hidden = r.dataset.phase !== v;
    }});
  }}

  sortBtns.forEach(b => b.addEventListener('click', () => doSort(b.dataset.sort)));
  filter.addEventListener('change', doFilter);

  doSort(currentSort);
  doFilter();
}})();
</script>'''


def decisions():
    return hero("Open Decisions", "Things to decide or test before buying.") + '''
<div class="row">
<div class="b8">
<ul class="tasks">
<li><input type="checkbox" id="d1"><label for="d1">Portal as sole audio interface, or separate interface needed?</label></li>
<li><input type="checkbox" id="d2"><label for="d2">Hi-hat pedal: how does it connect to the Portal?</label></li>
<li><input type="checkbox" id="d3"><label for="d3">Loop controller: foot pedal, trained SP2 zone, or Push alone?</label></li>
<li><input type="checkbox" id="d4"><label for="d4">Bass-to-MIDI route: Jam Origin real-time vs Live offline convert</label></li>
<li><input type="checkbox" id="d5"><label for="d5">Pick the effects controller and confirm per-track mapping</label></li>
<li><input type="checkbox" id="d6"><label for="d6">Clock master: MiniFreak synced to Live, or free-running?</label></li>
<li><input type="checkbox" id="d7"><label for="d7">Drums as rendered SP2 audio only, or also mic'd mesh heads?</label></li>
<li><input type="checkbox" id="d8"><label for="d8">Two toms or three; 12" or 13" snare</label></li>
<li><input type="checkbox" id="d9"><label for="d9">Monitors vs headphones vs PA</label></li>
<li><input type="checkbox" id="d10"><label for="d10">Test Tempo Follower with real playing: how much drift it tracks</label></li>
<li><input type="checkbox" id="d11"><label for="d11">Which side each instrument sits on, by reach from the seat</label></li>
<li><input type="checkbox" id="d12"><label for="d12">Exactly when tempo locks: the first loop's end, a manual tap, or a dedicated button — Clock currently assumes first loop end</label></li>
<li><input type="checkbox" id="d13"><label for="d13">Loop-length control: three length buttons, or one record button plus a length selector</label></li>
<li><input type="checkbox" id="d14"><label for="d14">USB hub load test with everything plugged in at once; Push 1 needs its own power supply, not bus power from the hub</label></li>
</ul>
</div></div>'''


def research():
    return hero("Research", "Areas not yet covered that will shape the build.") + '''
<div class="row">
<div class="b4"><div class="rule"><h3>Latency budget</h3><p class="sm">End-to-end: sensor → Portal → Live → synth → interface → ears. Target under ~10 ms felt; measure each link.</p></div></div>
<div class="b4"><div class="rule"><h3>MIDI routing and clock</h3><p class="sm">Who sends clock, who receives, and how Portal, MiniFreak, Push and the controller share one USB host.</p></div></div>
<div class="b4"><div class="rule"><h3>Max for Live devices</h3><p class="sm">Expression Control, Envelope Follower, LFO, Shaper, probability tools; which cover tiers 3–4 before writing patches.</p></div></div>
</div>

<div class="row">
<div class="b4"><div class="rule"><h3>Set structure</h3><p class="sm">How a performance is organised in session view: scenes as sections, how a loop is committed or cleared.</p></div></div>
<div class="b4"><div class="rule"><h3>Monitoring and room</h3><p class="sm">Low-volume practice: headphone mix, mesh-head noise, neighbours. Whether a small PA is needed.</p></div></div>
<div class="b4"><div class="rule"><h3>Capturing sessions</h3><p class="sm">Record every session multitrack by default; how to tag and revisit exploratory playing.</p></div></div>
</div>

<div class="row">
<div class="b4"><div class="rule"><h3>Drumming vocabulary</h3><p class="sm">A melodic-techno drumming language for snare and toms: patterns, fills, dynamics; a learning path independent of jazz.</p></div></div>
<div class="b4"><div class="rule"><h3>Bass role in techno</h3><p class="sm">Sub vs mid bass, octave and filter pedals, sharing low end with the synth.</p></div></div>
<div class="b4"><div class="rule"><h3>Power and cabling</h3><p class="sm">One power strip, cable runs that do not cross the seat, USB hub reliability.</p></div></div>
</div>

<div class="row">
<div class="b4"><div class="rule"><h3>Visual feedback</h3><p class="sm">What needs to be seen without a screen: a small display, Push's LEDs, or nothing.</p></div></div>
<div class="b4"><div class="rule"><h3>Voice routing architecture</h3><p class="sm">Max for Live send/receive bus design for character-to-character signals. How to make routing switchable mid-performance.</p></div></div>
</div>'''


def influences():
    # Keep the static SVG network and table from the original
    return hero("Influences", "Mapped by what they share stylistically. The accented lines mark the closest fit to this project.") + '''
<div class="row">
<div class="b12">
<figure>
<svg class="sv net" viewBox="0 0 760 560" role="img" aria-label="Network map of influences clustered by style">
<rect class="zone" x="20" y="60" width="330" height="200" rx="6"/><text class="zlab" x="36" y="84">Drummer-led electronic</text>
<rect class="zone" x="410" y="60" width="330" height="200" rx="6"/><text class="zlab" x="426" y="84">Melodic / live techno</text>
<rect class="zone" x="20" y="320" width="330" height="200" rx="6"/><text class="zlab" x="36" y="344">Generative and ambient</text>
<rect class="zone" x="410" y="320" width="330" height="200" rx="6"/><text class="zlab" x="426" y="344">Band + machine hybrids</text>
<g class="edges">
<path class="edge strong" d="M380 290L110 150"/><path class="edge strong" d="M380 290L250 230"/>
<path class="edge strong" d="M380 290L520 150"/><path class="edge strong" d="M380 290L640 230"/>
<path class="edge strong" d="M380 290L160 440"/>
<path class="edge" d="M110 150L250 230"/><path class="edge" d="M250 230L310 130"/><path class="edge" d="M110 150L200 110"/>
<path class="edge" d="M310 130L200 110"/><path class="edge" d="M110 150L90 230"/><path class="edge" d="M250 230L310 200"/>
<path class="edge" d="M520 150L640 230"/><path class="edge" d="M520 150L640 120"/><path class="edge" d="M640 120L700 180"/>
<path class="edge" d="M640 230L560 240"/><path class="edge" d="M520 150L460 240"/>
<path class="edge" d="M160 440L80 400"/><path class="edge" d="M160 440L270 400"/><path class="edge" d="M160 440L220 490"/>
<path class="edge" d="M270 400L460 240"/>
<path class="edge" d="M480 410L600 390"/><path class="edge" d="M600 390L680 460"/><path class="edge" d="M480 410L520 490"/>
<path class="edge" d="M250 230L480 410"/><path class="edge" d="M640 230L600 390"/>
</g>
<g class="node me" transform="translate(380 290)"><circle r="18"/><text x="26" y="4" text-anchor="start">This rig</text></g>
<g class="node" transform="translate(110 150)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">Arthur Hnatek</text></g>
<g class="node" transform="translate(250 230)"><circle r="8"/><text x="-14" y="4" text-anchor="end">Jojo Mayer / Nerve</text></g>
<g class="node" transform="translate(310 130)"><circle r="8"/><text x="14" y="4" text-anchor="start">Mark Guiliana</text></g>
<g class="node" transform="translate(200 110)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">Deantoni Parks</text></g>
<g class="node" transform="translate(90 230)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Richard Spaven</text></g>
<g class="node" transform="translate(310 200)"><circle r="8"/><text x="14" y="4" text-anchor="start">Shawn Crowder</text></g>
<g class="node" transform="translate(520 150)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">Max Cooper</text></g>
<g class="node" transform="translate(640 230)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Stephan Bodzin</text></g>
<g class="node" transform="translate(640 120)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">Jon Hopkins</text></g>
<g class="node" transform="translate(700 180)"><circle r="8"/><text x="0" y="24" text-anchor="middle">KiNK</text></g>
<g class="node" transform="translate(560 240)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Kiasmos</text></g>
<g class="node" transform="translate(460 240)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Rival Consoles</text></g>
<g class="node" transform="translate(160 440)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Tipper</text></g>
<g class="node" transform="translate(80 400)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">Brian Eno</text></g>
<g class="node" transform="translate(270 400)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">Floating Points</text></g>
<g class="node" transform="translate(220 490)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Nils Frahm</text></g>
<g class="node" transform="translate(480 410)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">LCD Soundsystem</text></g>
<g class="node" transform="translate(600 390)"><circle r="8"/><text x="0" y="-14" text-anchor="middle">Caribou</text></g>
<g class="node" transform="translate(680 460)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Tame Impala</text></g>
<g class="node" transform="translate(520 490)"><circle r="8"/><text x="0" y="24" text-anchor="middle">Nicolas Jaar</text></g>
</svg>
<figcaption>Grey lines: stylistic kinship. Accent lines: closest to this project's aims.</figcaption>
</figure>
<div style="display:flex;flex-wrap:wrap;gap:1rem;font-size:.85rem;color:var(--ink-2);margin-top:.6rem"><span style="display:inline-flex;align-items:center;gap:.4em"><span style="width:.8em;height:.8em;background:var(--accent);display:inline-block"></span>Closest fit</span><span style="display:inline-flex;align-items:center;gap:.4em"><span style="width:.8em;height:.8em;border:2px solid var(--line);display:inline-block"></span>Related</span></div>
</div></div>

<div class="row"><h2>Why each is here</h2>
<div class="b12">
<table>
<thead><tr><th>Artist</th><th>What to take from them</th></tr></thead>
<tbody>
<tr><td>Arthur Hnatek</td><td>Drums as controller; generative patches steered by playing. The direct model.</td></tr>
<tr><td>Jojo Mayer / Nerve</td><td>Live reproduction of programmed music; Me/Machine as human–algorithm duet.</td></tr>
<tr><td>Mark Guiliana</td><td>Beat Music: acoustic kit driving electronic textures; restraint and space.</td></tr>
<tr><td>Deantoni Parks</td><td>One-man drums-and-sampler performance; everything triggered by hand.</td></tr>
<tr><td>Richard Spaven</td><td>Broken-beat and electronic drumming vocabulary that is not jazz.</td></tr>
<tr><td>Shawn Crowder</td><td>Sensory Percussion specialist; practical reference for zone-based playing.</td></tr>
<tr><td>Max Cooper</td><td>Melodic techno with generative structure and visual systems thinking.</td></tr>
<tr><td>Stephan Bodzin</td><td>Melodic techno played live on hardware; the register this rig leans toward.</td></tr>
<tr><td>Jon Hopkins</td><td>Evolving textures, dynamics as the main compositional device.</td></tr>
<tr><td>KiNK</td><td>Hardware improvisation on stage; fun and risk as part of the set.</td></tr>
<tr><td>Kiasmos</td><td>Minimal melodic techno with acoustic-feeling material.</td></tr>
<tr><td>Rival Consoles</td><td>Modular-led melodic electronic with physical performance.</td></tr>
<tr><td>Tipper</td><td>Sound design depth; already a listening reference.</td></tr>
<tr><td>Brian Eno</td><td>Generative music as a philosophy: set up a system, then listen.</td></tr>
<tr><td>Floating Points</td><td>Musician-producer bridging live playing and electronic structure.</td></tr>
<tr><td>Nils Frahm</td><td>Solo multi-instrument performance, moving between stations.</td></tr>
<tr><td>LCD Soundsystem</td><td>Live band playing programmed material; real bass and drums with sequenced synths.</td></tr>
<tr><td>Caribou</td><td>Producer whose live show is a band; drums at the centre.</td></tr>
<tr><td>Tame Impala</td><td>Psychedelic production sensibility; already a listening reference.</td></tr>
<tr><td>Nicolas Jaar</td><td>Loose, exploratory live sets built on loops and improvisation.</td></tr>
</tbody>
</table>
</div></div>'''


def name():
    return hero("Name?", "Working titles. Pick a front-runner or add your own.") + '''
<div class="row">
<div class="b8">
<ul class="names" id="names"></ul>
<form id="nameForm" style="display:flex;gap:.6rem;margin-top:1.4rem;align-items:center">
<input type="text" id="nameIn" placeholder="Add a name" style="font:inherit;padding:.5rem .8rem;border:2px solid var(--line);background:var(--bg);color:var(--ink);flex:1;border-radius:var(--radius)">
<button type="submit" style="font:inherit;font-weight:600;padding:.5rem 1rem;border:2px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;border-radius:var(--radius)">Add</button>
</form>
<p id="nameMsg" class="sm" style="margin-top:.5rem;color:var(--accent)"></p>
</div></div>'''


def sources():
    return hero("Sources", "Reference links and documentation.") + '''
<div class="row">
<div class="b8">
<ul>
<li><a href="https://help.sunhou.se/v2/software-overview/hardware-panel/hardware-inputs/drum-training/">Sunhouse — Drum training (zones, void, sensitivity)</a></li>
<li><a href="https://sunhou.se/blog/training-sensory-pads">Sunhouse — How to train your drums</a></li>
<li><a href="https://help.sunhou.se/v2/software-overview/modules/controllers/drum-pads/">Sunhouse — Drum pads and blends</a></li>
<li><a href="https://www.musicradar.com/news/evanss-hybrid-sensory-percussion-system-will-take-hybrid-drums-to-a-whole-new-level">MusicRadar — Evans Hybrid Sensory Percussion system</a></li>
<li><a href="https://www.ableton.com/packs/beatseeker/">Ableton — BeatSeeker</a></li>
<li><a href="https://vier.live/act/ableton-live-live-tempo-following">Vier — Live tempo following in Ableton Live 11</a></li>
<li><a href="https://synthtopia.com/?p=65453">Synthtopia — BeatSeeker (user reports)</a></li>
<li><a href="https://help.sunhou.se/portal/io-overview">EVANS Portal — I/O overview</a></li>
<li><a href="https://www.jamorigin.com">Jam Origin — MIDI Bass</a></li>
<li><a href="https://drolez.com/blog/music/best-free-ableton-max-for-live.html">drolez — Free Max for Live devices (Fixed Length Recording)</a></li>
</ul>
</div></div>'''


def settings():
    return hero("Settings", "Tune the site's appearance. Settings are saved in this browser.") + '''
<div class="row">
<div class="b9">

<div class="set"><div class="t">Theme<small>Black on white, or white on black.</small></div>
<div class="ctl seg" id="themeSeg"><button data-v="light" aria-pressed="true">Light</button><button data-v="dark" aria-pressed="false">Dark</button></div></div>

<div class="set"><div class="t">Accent colour<small>Used for links, highlights, and the orange dot.</small></div>
<div class="ctl"><input type="color" id="accent" value="#ff4d00" aria-label="Accent colour">
<div class="sw" aria-label="Presets">
<button data-c="#ff4d00" style="background:#ff4d00" aria-label="Orange"></button>
<button data-c="#e6001a" style="background:#e6001a" aria-label="Red"></button>
<button data-c="#0055ff" style="background:#0055ff" aria-label="Blue"></button>
<button data-c="#00b37a" style="background:#00b37a" aria-label="Green"></button>
<button data-c="#ffd500" style="background:#ffd500" aria-label="Yellow"></button>
<button data-c="#b200ff" style="background:#b200ff" aria-label="Violet"></button>
<button data-c="#00c2d1" style="background:#00c2d1" aria-label="Cyan"></button>
</div><span class="mono" id="accentHex">#ff4d00</span></div></div>

<div class="set"><div class="t">Heading font</div>
<div class="ctl"><select id="fontHead">
<option value="'Archivo',system-ui,sans-serif">Archivo (wide)</option>
<option value="'Space Grotesk',system-ui,sans-serif">Space Grotesk</option>
<option value="'Inter',system-ui,sans-serif">Inter</option>
<option value="'IBM Plex Mono',ui-monospace,monospace">IBM Plex Mono</option>
<option value="system-ui,sans-serif">System</option>
</select></div></div>

<div class="set"><div class="t">Body font</div>
<div class="ctl"><select id="fontBody">
<option value="'IBM Plex Sans',system-ui,sans-serif">IBM Plex Sans</option>
<option value="'Inter',system-ui,sans-serif">Inter</option>
<option value="'Space Grotesk',system-ui,sans-serif">Space Grotesk</option>
<option value="'IBM Plex Mono',ui-monospace,monospace">IBM Plex Mono</option>
<option value="system-ui,sans-serif">System</option>
</select></div></div>

<div class="set"><div class="t">Text size<small>Everything scales from this.</small></div>
<div class="ctl"><input type="range" id="fs" min="13" max="22" step="1" value="16"><span class="mono" id="fsVal">16px</span></div></div>

<div class="set"><div class="t">Corners<small>0 is square, like the Roland mark.</small></div>
<div class="ctl"><input type="range" id="radius" min="0" max="12" step="1" value="0"><span class="mono" id="radiusVal">0px</span></div></div>

<div class="set"><div class="t">Version</div>
<div class="ctl" style="flex-direction:column;align-items:flex-start;gap:.5rem">
<span class="ver" id="verNum">—</span>
<span class="status" id="verDate"></span>
<div class="ctl"><button id="checkBtn">Check for updates</button><button id="refreshBtn">Hard refresh</button></div>
<span class="status" id="verStatus" aria-live="polite"></span>
</div></div>

<div class="set"><div class="t">Reset</div>
<div class="ctl"><button id="resetBtn">Restore defaults</button></div></div>

<div class="set"><div class="t">Builds<small>Every version is archived here.</small></div>
<ul class="builds" id="builds"><li>Loading…</li></ul></div>

</div></div>'''


def template():
    return hero("Set Template", "One Live Set, one scene per environment. The controls never move; the chains behind them do.",
        meta='<div><b>Status</b>Draft, pre-kit prototype</div><div><b>Needs</b>Live 11 Suite and the MiniFreak</div><div><b>Roadmap</b><a href="roadmap.html">Phase 3, build sonic environments</a></div>') + '''
<div class="row"><h2>The set at a glance</h2>
<div class="b12">
<p class="lg">Session View as it will look. Select a scene to see what it does, or a track name to see what it is for.</p>
<div class="lv" role="group" aria-label="Mock of Ableton Live Session View">
<div class="lv-bar"><b>Environment Set</b><span>BPM <b id="lvBpm">85.00</b></span><span>4/4</span><span>Quantise 1 Bar</span></div>
<div class="lv-scroll"><div class="lvg" id="lvGrid"></div></div>
</div>
<p class="sm" id="lvNote"></p>
<div class="lvd" id="lvDetail" aria-live="polite"></div>
<p class="xs">Scene content is example data until the first real environment is chosen.</p>
</div></div>

<div class="row"><h2>Signals</h2>
<div class="b8">
<p class="lg">Four generic signals. Everything downstream reads these, never the raw source, so swapping the stand-in for the SP2 changes one input and rebuilds nothing.</p>
<div class="tw"><table>
<thead><tr><th>Signal</th><th>Prototype source</th><th>SP2 later</th><th>Lands on</th><th>CC</th></tr></thead>
<tbody>
<tr><td>Zone</td><td>MIDI note per drum voice</td><td>Zone note from the notes generator</td><td>Drum Rack chains</td><td class="st">note</td></tr>
<tr><td>Velocity</td><td>Note velocity</td><td>Same</td><td>Level and filter, through a Velocity MIDI effect</td><td class="st">note</td></tr>
<tr><td>Speed</td><td>Envelope Follower on the drum audio</td><td>SP2 Speed controller, sent as CC</td><td>Space send, filter</td><td class="st need">TBD</td></tr>
<tr><td>Timbre</td><td>CC lane in a clip, standing in for head position</td><td>SP2 Timbre controller, sent as CC</td><td>Macro 1 of every rack</td><td class="st need">TBD</td></tr>
</tbody></table></div>
<p class="sm">CC numbers are left open on purpose and get assigned in the next pass. Notes and CCs travel together over one virtual MIDI bus.</p>
</div>
<div class="b12">
<figure>
<svg class="sv" viewBox="0 0 760 290" role="img" aria-label="Signal flow: the stand-in kit and, later, the SP2 both send notes and CCs over a virtual MIDI bus into Live, where they land on Drum Rack chains and on rack Macros">
<defs><marker id="tsa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g class="usb"><path d="M180 55L240 80" marker-end="url(#tsa)"/><path d="M180 135L240 110" marker-end="url(#tsa)"/><path d="M390 95L450 95" marker-end="url(#tsa)"/></g>
<g class="ln" style="color:var(--line)"><path d="M520 140L520 190" marker-end="url(#tsa)"/><path d="M670 140L670 190" marker-end="url(#tsa)"/></g>
<rect class="bx" x="20" y="30" width="160" height="50"/><text x="100" y="52" text-anchor="middle" font-weight="600" font-size="12">Stand-in kit</text><text class="q" x="100" y="68" text-anchor="middle" font-size="10">clips: notes + CC lane</text>
<rect class="bxd" x="20" y="110" width="160" height="50"/><text x="100" y="132" text-anchor="middle" font-weight="600" font-size="12">SP2 (later)</text><text class="q" x="100" y="148" text-anchor="middle" font-size="10">notes + CC generators</text>
<rect class="hi" x="240" y="60" width="150" height="70"/><text x="315" y="90" text-anchor="middle" font-weight="700" font-size="13">IAC Bus 1</text><text class="q" x="315" y="108" text-anchor="middle" font-size="10">virtual MIDI bus</text>
<rect class="bx" x="450" y="50" width="290" height="90"/><text x="595" y="85" text-anchor="middle" font-weight="700" font-size="13">Ableton Live</text><text class="q" x="595" y="105" text-anchor="middle" font-size="10">MIDI input, Remote on</text><text class="q" x="595" y="121" text-anchor="middle" font-size="10">Map Mode targets</text>
<rect class="bx" x="450" y="190" width="140" height="60"/><text x="520" y="215" text-anchor="middle" font-weight="600" font-size="12">Zone, Velocity</text><text class="q" x="520" y="232" text-anchor="middle" font-size="10">Drum Rack chains</text>
<rect class="bx" x="600" y="190" width="140" height="60"/><text x="670" y="215" text-anchor="middle" font-weight="600" font-size="12">Timbre, Speed</text><text class="q" x="670" y="232" text-anchor="middle" font-size="10">Macros and sends</text>
<rect class="bxd" x="20" y="190" width="300" height="60"/><text x="170" y="214" text-anchor="middle" font-weight="600" font-size="12">Prototype only: Envelope Follower</text><text class="q" x="170" y="232" text-anchor="middle" font-size="10">reads the drum audio and stands in for the Speed CC</text>
<path class="lnq" d="M320 220L450 220" marker-end="url(#tsa)"/>
<g transform="translate(20 272)"><line class="usb" x1="0" y1="0" x2="26" y2="0"/><text x="32" y="4" font-size="10">MIDI</text><line class="ln" x1="90" y1="0" x2="116" y2="0" style="color:var(--line)"/><text x="122" y="4" font-size="10">Inside Live</text><line class="lnq" x1="210" y1="0" x2="236" y2="0"/><text x="242" y="4" font-size="10">Stand-in path</text></g>
</svg>
<figcaption>The SP2 slot stays empty and muted until the kit arrives. Its notes and CCs enter on the same bus, so every mapping downstream stays as built.</figcaption>
</figure>
</div>
<div class="b8">
''' + detail("Why a virtual bus", '''<p>Ableton sums all MIDI coming out of the SP2 plugin onto a single channel, and CCs from the plugin cannot directly drive Live's own knobs. Sunhouse's own examples send MIDI out of Sensory Percussion over the IAC Bus Driver and back into Live. Building the stand-in the same way means the real kit is a re-point, not a rewrite.</p>
<p>The SP2 plugin also needs Live 11.3 or later. See <a href="percussion.html">Percussion</a> for the controller types.</p>''', "IAC") + detail("MiniFreak CCs for Timbre targets", '''<p class="mono">VCO 1 Timbre 15 · VCO 2 Timbre 19 · Filter Cutoff 74 · Resonance 71 · FX1/2/3 Amount 25 / 28 / 31 · Macros M1 117, M2 118</p>
<p class="sm">From Arturia's MIDI implementation chart. The chart I fetched listed macros M1 and M2 only; check the manual for the rest.</p>''', "Arturia") + '''
</div></div>

<div class="row"><h2>Tracks</h2>
<div class="b8">
<p class="lg">Three synth slots named by position, not by role. The scene decides whether a slot plays bass, keys, pad or stabs.</p>
<div class="tw"><table>
<thead><tr><th>Track</th><th>Holds</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Slot 1</td><td>MiniFreak through External Instrument</td><td>One physical patch at a time. Each scene recalls its own patch, see MiniFreak recall below.</td></tr>
<tr><td>Slot 2</td><td>Wavetable, Operator, Drift or Meld</td><td>Second voice, usually the low end or the keys.</td></tr>
<tr><td>Slot 3</td><td>A second soft synth, or empty</td><td>Empty in scenes that do not need it.</td></tr>
<tr><td>Stand-in kit, SP2</td><td>Source tracks</td><td>Send notes and CCs to IAC Bus 1. The SP2 track stays muted and empty until the kit exists.</td></tr>
<tr><td>Loop 1, Loop 2</td><td>Audio tracks</td><td>Record from the Play bus, see Looping below.</td></tr>
</tbody></table></div>
<p class="sm">Each slot is an Instrument Rack with one chain per environment. In the prototype phase the MiniFreak's audio comes in through its own USB interface; later it goes through the Portal. See <a href="synth.html">Synth</a>.</p>
</div></div>

<div class="row"><h2>Chains</h2>
<div class="b8">
<p class="lg">Live mappings belong to the whole set, so a scene cannot have its own. Instead Macro 1 always carries Timbre, and each chain maps Macro 1 to something different. Only the active chain responds.</p>
<div class="tw"><table>
<thead><tr><th>Control</th><th>Chain 1</th><th>Chain 2</th><th>Chain 3</th></tr></thead>
<tbody>
<tr><td>Macro 1, Timbre</td><td>Filter cutoff</td><td>FM amount</td><td>Reverb size</td></tr>
<tr><td>Macro 2, Tone</td><td>Resonance</td><td>Operator ratio</td><td>Chorus depth</td></tr>
<tr><td>Macro 3, Space</td><td>Send A</td><td>Send A</td><td>Send B</td></tr>
<tr><td>Macro 4, Level</td><td>Chain gain</td><td>Chain gain</td><td>Chain gain</td></tr>
</tbody></table></div>
<p class="xs">Example mappings. The meanings of the four Macros stay fixed; the targets are per chain.</p>
''' + detail("Switching chains per scene", '''<p>Put a clip in the scene on that slot, with a clip envelope on the rack's Chain Selector. Launching the scene moves the selector. If that does not work in Live 11, the fallback is a mapped button or a Push 1 control.</p>''', "Live 11") + detail("Turning unused chains fully off", '''<p>Yes, with some setup. Ableton says racks already conserve CPU in inactive chains. Its method for going further is to map each device's on/off to the Chain Selector, so only the selected chain has an active device.</p>
<ul>
<li>Wrap each chain's contents in one nested rack, so there is one on/off per chain instead of one per device.</li>
<li>Map that wrapper's on/off to the Chain Selector range for its chain.</li>
<li>Watch Live's CPU meter before and after. Stock devices are cheap, so the saving may be small; heavy plugins gain most.</li>
</ul>
<p class="sm">Turning a device off also cuts its tail. The MiniFreak chain costs no computer CPU either way, because it is hardware.</p>''', "CPU") + '''
</div></div>

<div class="row"><h2>Effects</h2>
<div class="b8">
<p class="lg">Both, with one rule: anything the hands rely on never moves, and anything with character lives inside a chain.</p>
<div class="tw"><table>
<thead><tr><th>Layer</th><th>Where it lives</th><th>Changes per scene</th></tr></thead>
<tbody>
<tr><td>Character</td><td>Inserts inside each slot's chains</td><td>Yes, it switches with the chain</td></tr>
<tr><td>Space and throw</td><td>Return A reverb, Return B delay</td><td>No, neutral in Live 11</td></tr>
<tr><td>Performance FX</td><td>Group with four Macros: filter sweep, wash, stutter, drive</td><td>No, always on and mapped the same way</td></tr>
<tr><td>Safety</td><td>Limiter on master</td><td>No</td></tr>
</tbody></table></div>
<p class="sm">Live 13's Envelope Clips would let the returns vary per scene, but nothing here depends on that.</p>
</div></div>

<div class="row"><h2>Looping</h2>
<div class="b8">
<p class="lg">Drums and synths sum into a Play bus. Loop 1 and Loop 2 record from it, before the returns, so a loop captures what was played and not the room around it.</p>
<p>A scene with no clip on a loop track leaves that track alone, so its loop carries over. A scene with a clip or a stop button replaces it. Push 1 handles record, overdub and undo for now; see <a href="looping.html">Looping</a> for the controller plan.</p>
<div class="rule"><h3>Tempo and carried loops</h3>
<p class="sm">A scene that carries a loop has to keep the tempo, or the warped loop retimes. In the prototype, tempo is typed per scene. With the real kit, the rule on <a href="clock.html">Clock</a> applies instead: follow the playing, then freeze at the first loop.</p>
</div>
</div></div>

<div class="row"><h2>MiniFreak recall</h2>
<div class="b8">
<p class="lg">Each scene's MiniFreak clip carries a Bank and a Program, so launching the scene recalls the patch. Arturia's chart gives this layout.</p>
<div class="tw"><table>
<thead><tr><th>Presets</th><th>Bank</th><th>Program change</th></tr></thead>
<tbody>
<tr><td>1 to 128</td><td>Bank 1</td><td class="st">0 to 127</td></tr>
<tr><td>129 to 256</td><td>Bank 2</td><td class="st">0 to 127</td></tr>
<tr><td>257 and above</td><td>Bank 3</td><td class="st">0 to 127</td></tr>
</tbody></table></div>
<p class="sm">Keep the environment patches together in one bank so recall is predictable, for example environments 1 to 4 as presets 1 to 4.</p>
<div class="rule"><h3>Not yet confirmed</h3>
<p class="sm">Which bank-select message the MiniFreak listens to. A user report says Bank 2 is value 1 and Bank 3 is value 2, but that is not the manual. Arturia's forum points to page 110 of the hardware manual. Test by launching a clip with a Bank and Program and watching the MiniFreak display, and check for an off-by-one, since Live may number programs from 1.</p>
</div>
</div></div>

<div class="row"><h2>Build order</h2>
<div class="b8">
<p>Each step ends with something finished. This is a real sequence, so the numbers mean something. The last step is the signal to move on to <a href="roadmap.html">the drums</a>.</p>
<ol class="lg">
<li><strong>Wiring check.</strong> The stand-in kit sends one CC over IAC Bus 1 and one mapped knob moves. Nothing else.</li>
<li><strong>One environment.</strong> A MiniFreak patch, one chain, one effect chain, the drum loop playing. Bounce it.</li>
<li><strong>One clean loop.</strong> One layer and one overdub that hold together. Bounce it.</li>
<li><strong>One reactive environment.</strong> The Timbre lane moving a destination. Bounce it.</li>
<li><strong>Three or four environments as scenes,</strong> each bounced and named.</li>
</ol>
</div></div>

<div class="row"><h2>Verify in Live 11</h2>
<div class="b8">
<p>Things I am fairly sure of but have not seen in your version. Tick them off as you test.</p>
<ul class="tasks">
<li><input type="checkbox" id="tp1"><label for="tp1">Map Mode learns CCs arriving from IAC Bus 1 with Remote on.</label></li>
<li><input type="checkbox" id="tp2"><label for="tp2">A clip envelope can move a rack's Chain Selector when a scene launches.</label></li>
<li><input type="checkbox" id="tp3"><label for="tp3">An empty clip slot leaves a playing loop alone on scene launch.</label></li>
<li><input type="checkbox" id="tp4"><label for="tp4">Bank and Program in a clip recall a MiniFreak patch.<small>Check which bank message it reads, and the off-by-one.</small></label></li>
<li><input type="checkbox" id="tp5"><label for="tp5">Mapping a nested rack's on/off to the Chain Selector saves measurable CPU.</label></li>
<li><input type="checkbox" id="tp6"><label for="tp6">Live is 11.3 or later, which the SP2 plugin needs.</label></li>
<li><input type="checkbox" id="tp7"><label for="tp7">The SP2 manual confirms Speed and Timbre can each be sent as CC.<small>The Sunhouse pages I read cover the notes and CC generators; the controller types come from the Percussion page.</small></label></li>
</ul>
</div></div>

<div class="row"><h2>Sources</h2>
<div class="b8">
<p class="xs"><a href="https://support.arturia.com/hc/en-us/articles/6316523876764-MiniFreak-MIDI-Implementation-Chart">Arturia, MiniFreak MIDI chart</a> · <a href="https://help.ableton.com/hc/en-us/articles/360000727359-Using-the-chain-selector-in-a-Rack">Ableton, chain selector in a Rack</a> · <a href="https://help.sunhou.se/v2/how-to/ableton-plugin/">Sunhouse, SP2 Ableton plugin</a> · <a href="https://help.sunhou.se/v2/software-overview/modules/generators/midi-output/">Sunhouse, SP2 MIDI output</a> · <a href="https://forum.morningstar.io/t/minifreak-bank-preset-select/12190">Morningstar forum, MiniFreak banks</a></p>
</div></div>

<script>
(function(){
  var tracks=[
    {n:"Stand-in kit",g:"Source",io:"MIDI out to IAC 1",note:"Stands in for the SP2. Holds drum loops (voice is the note, velocity is hit strength) and CC clips carrying the Timbre lane. Output goes to IAC Bus 1, the same bus the real kit will use."},
    {n:"SP2 (later)",g:"Source",muted:true,io:"MIDI in from IAC 1",note:"Empty and muted until the kit arrives. It sends notes and CCs over the same bus, so nothing downstream changes."},
    {n:"Slot 1 MiniFreak",g:"Synth",io:"Ext. Instrument, USB",note:"MIDI out over USB, audio back from the MiniFreak interface. One patch at a time, recalled per scene with Bank and Program."},
    {n:"Slot 2 Soft synth",g:"Synth",io:"Instrument Rack",note:"One chain per environment (Wavetable, Operator, Drift, Meld). The scene decides whether it plays bass, keys or chords."},
    {n:"Slot 3 Soft synth",g:"Synth",io:"Instrument Rack",note:"Optional third voice. Leave it empty in scenes that do not need it."},
    {n:"Loop 1",g:"Loop",io:"Audio from Play bus",note:"Records from the Play bus (drums and synths, before the returns). An empty slot in a scene means the loop carries on."},
    {n:"Loop 2",g:"Loop",io:"Audio from Play bus",note:"Second looper for an overdub layer or a separate part."},
    {n:"A Space",g:"Return",ret:true,io:"Return, reverb",note:"Fixed reverb, neutral in every scene. Return tracks have no clip slots in Live."},
    {n:"B Throw",g:"Return",ret:true,io:"Return, delay",note:"Fixed delay for throws. Return tracks have no clip slots in Live."}
  ];
  var scenes=[
    {n:"HOME",t:85,cells:["stop","stop","stop","stop","stop","stop","stop"],
     d:{title:"Home",tempo:"Keeps the current tempo",mf:"Init patch",slots:"All Macros neutral, nothing playing",loop:"Both loops stopped",timbre:"Idle",note:"A known-good reset between environments."}},
    {n:"Env 01",t:85,cells:["groove A","","patch 001","chain 1","","rec",""],
     d:{title:"Environment 01",tempo:"85",mf:"Bank 1, Program 0 (preset 1)",slots:"Slot 2 chain 1 as the low end, Slot 3 empty",loop:"Loop 1 records, Loop 2 untouched",timbre:"CC lane to Macro 1 (filter cutoff on the MiniFreak chain)",note:"Placeholder for the first real environment."}},
    {n:"Env 02",t:85,cells:["groove B","","patch 002","chain 2","chain 1","","rec"],
     d:{title:"Environment 02",tempo:"85, unchanged so the carried loop keeps time",mf:"Bank 1, Program 1 (preset 2)",slots:"Slot 2 chain 2, Slot 3 chain 1",loop:"Loop 1 carries over from Env 01, Loop 2 records",timbre:"CC lane to Macro 1 (FM amount)",note:"Shows a loop surviving a scene change."}},
    {n:"Env 03",t:78,cells:["groove A","","patch 003","chain 3","","stop","loop 3"],
     d:{title:"Environment 03",tempo:"78, free to change because both loops are replaced",mf:"Bank 1, Program 2 (preset 3)",slots:"Slot 2 chain 3, Slot 3 empty",loop:"Loop 1 stopped, Loop 2 replaced",timbre:"CC lane to Macro 1 (reverb size)",note:"Shows a loop being replaced."}},
    {n:"Env 04",t:78,cells:["groove C","","patch 004","chain 4","chain 2","rec",""],
     d:{title:"Environment 04",tempo:"78, unchanged so Loop 2 keeps time",mf:"Bank 1, Program 3 (preset 4)",slots:"Slot 2 chain 4, Slot 3 chain 2",loop:"Loop 1 records fresh, Loop 2 carries over from Env 03",timbre:"CC lane to Macro 1",note:"Placeholder."}}
  ];
  var grid=document.getElementById("lvGrid"),detail=document.getElementById("lvDetail"),noteEl=document.getElementById("lvNote"),bpm=document.getElementById("lvBpm");
  if(!grid) return;
  var cur=1,pickT=-1;
  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function build(){
    grid.textContent="";
    grid.appendChild(el("div","g",""));
    var prev=null;
    tracks.forEach(function(t){grid.appendChild(el("div","g",t.g!==prev?t.g:""));prev=t.g;});
    grid.appendChild(el("div","g","Scenes"));
    tracks.forEach(function(t,i){
      var b=el("button","h"+(t.muted?" dim":"")+(i===pickT?" pick":""),t.n);
      b.type="button";
      b.addEventListener("click",function(){pickT=i;noteEl.textContent=t.n+": "+t.note;build();});
      grid.appendChild(b);
    });
    scenes.forEach(function(s,si){
      var sb=el("button","sc"+(si===cur?" on":""));
      sb.type="button";
      sb.appendChild(el("span","tri"));sb.appendChild(el("span",null,s.n));sb.appendChild(el("small",null,String(s.t)));
      sb.addEventListener("click",function(){cur=si;render();});
      grid.appendChild(sb);
      tracks.forEach(function(t,ti){
        var v=t.ret?null:s.cells[ti],cls="cl";
        if(t.ret)cls+=" na";
        else if(v==="stop")cls+=" stop";
        else if(v==="rec")cls+=" has rec";
        else if(v)cls+=" has";
        if(t.muted)cls+=" mute";
        if(si===cur)cls+=" on";
        grid.appendChild(el("div",cls,v&&v!=="stop"?(v==="rec"?"Record":v):""));
      });
    });
    grid.appendChild(el("div","g","Routing"));
    tracks.forEach(function(t){grid.appendChild(el("div","io",t.io));});
    grid.appendChild(el("div","g","Level"));
    tracks.forEach(function(t,i){var f=el("div","lvl"),bar=el("i");bar.style.setProperty("--w",(50+(i*7)%30)+"%");f.appendChild(bar);grid.appendChild(f);});
  }
  function renderDetail(){
    var d=scenes[cur].d;
    detail.textContent="";
    detail.appendChild(el("h3",null,d.title));
    [["Tempo",d.tempo],["MiniFreak patch",d.mf],["Synth slots",d.slots],["Loops",d.loop],["Timbre",d.timbre],["Note",d.note]].forEach(function(r){
      var w=el("div");w.appendChild(el("span","k",r[0]));w.appendChild(el("p","v",r[1]));detail.appendChild(w);
    });
  }
  function render(){bpm.textContent=scenes[cur].t.toFixed(2);build();renderDetail();}
  noteEl.textContent="Select a track name for its role.";
  render();
})();
</script>'''


# ── Build ────────────────────────────────────────────────

PAGES = {
    'concept': ('Concept', concept),
    'percussion': ('Percussion', percussion),
    'bass': ('Bass', bass),
    'synth': ('Synth', synth),
    'hookup': ('Hook-up', hookup),
    'midi': ('MIDI Controllers', midi),
    'arrangement': ('Arrangement', arrangement),
    'routing': ('Routing', routing),
    'looping': ('Looping', looping),
    'clock': ('Clock', clock),
    'expression': ('Expression', expression),
    'chemistry': ('Chemistry', chemistry),
    'template': ('Set Template', template),
    'practice': ('Practice', lambda: practice_mod.practice(hero, detail)),
    'grooves': ('Grooves', lambda: grooves_mod.grooves(hero, detail)),
    'gear': ('Gear List', gear),
    'roadmap': ('Roadmap', roadmap),
    'decisions': ('Open Decisions', decisions),
    'research': ('Research', research),
    'influences': ('Influences', influences),
    'name': ('Name?', name),
    'sources': ('Sources', sources),
    'settings': ('Settings', settings),
}

def map_page():
    return f'''{head("Rig — solo performance system")}
<body class="map">
<svg id="map"></svg>
<div class="map-ui tl">Rig<small>Solo performance system</small></div>
<div class="map-ui tr"><a href="settings.html" aria-label="Settings">⚙</a> <span data-ver></span></div>
<div class="map-ui bl">Drag the nodes. Click one to enter.</div>
<script src="version.js"></script>
<script src="shared.js"></script>
<script src="map.js"></script>
</body></html>'''


def build():
    print(f"Building rig site v{VERSION} ({DATE})")

    # version.js
    with open(os.path.join(DIR, 'version.js'), 'w') as f:
        f.write(f'window.RIG_VERSION={{version:"{VERSION}",date:"{DATE}"}};\n')
    print("  wrote version.js")

    # version.json
    with open(os.path.join(DIR, 'version.json'), 'w') as f:
        json.dump({"version": VERSION, "date": DATE}, f, indent=2)
        f.write('\n')
    print("  wrote version.json")

    # index.html (map)
    with open(os.path.join(DIR, 'index.html'), 'w') as f:
        f.write(map_page())
    print("  wrote index.html (map)")

    # subpages
    for page_id, (title, fn) in PAGES.items():
        body = fn()
        html = page_shell(page_id, title, body)
        with open(os.path.join(DIR, f'{page_id}.html'), 'w') as f:
            f.write(html)
        print(f"  wrote {page_id}.html")

    practice_mod.write_midi(DIR)
    print("  wrote practice/*.mid")
    grooves_mod.write_midi(DIR)
    print("  wrote grooves/*.mid")

    # builds manifest
    builds_dir = os.path.join(DIR, 'builds')
    os.makedirs(builds_dir, exist_ok=True)
    manifest = [
        {"version": "0.2.0", "date": "2026-11-10", "notes": "Single-page version", "path": "builds/0.2.0/index.html"},
        {"version": "0.3.0", "date": "2026-11-10", "notes": "Map navigation + subpages", "path": "builds/0.3.0/index.html"},
        {"version": "0.3.1", "date": "2026-11-11", "notes": "Collapsible sections, diagrams, map hierarchy, layout fix", "path": "builds/0.3.1/index.html"},
        {"version": "0.3.2", "date": "2026-11-11", "notes": "Build roadmap page", "path": "builds/0.3.2/index.html"},
        {"version": "0.4.0", "date": "2026-11-11", "notes": "Interactive roadmap + gear with costs", "path": "builds/0.4.0/index.html"},
        {"version": "0.4.1", "date": "2026-11-11", "notes": "Real kit layout: 5 drums + kick/hi-hat pedals, room plan", "path": "builds/0.4.1/index.html"},
        {"version": "0.4.2", "date": "2026-11-11", "notes": "Fix Portal double-count; bass guitar not yet owned ($2k earmarked)", "path": "builds/0.4.2/index.html"},
        {"version": "0.4.3", "date": "2026-11-11", "notes": "Correction: Portal is a real Phase 2 purchase, not owned", "path": "builds/0.4.3/index.html"},
        {"version": "0.5.0", "date": "2026-11-11", "notes": "Constellation nav restructure: Arrangement/Routing/Concept hierarchy, new MIDI Controllers page, hub-based hookup diagram, two-column Expression map, Creatures renamed to Chemistry", "path": "builds/0.5.0/index.html"},
        {"version": "0.5.1", "date": "2026-11-11", "notes": "New Set Template page: one Ableton set, one scene per environment, signal adapter for the SP2", "path": "builds/0.5.1/index.html"},
        {"version": "0.6.0", "date": "2026-11-12", "notes": "New Practice page: beginner rudiment ladder in text notation, three playable patterns with tempo and swing, downloadable .mid files", "path": "builds/0.6.0/index.html"},
        {"version": "0.6.1", "date": "2026-11-12", "notes": "Practice: all 19 patterns playable and downloadable as MIDI (plus a zip), click sounds with a five-way sound menu, left and right hands pitched apart", "path": "builds/0.6.1/index.html"},
        {"version": VERSION, "date": DATE, "notes": "New Grooves page: nine full-kit study grooves with scores, players and MIDI files", "path": f"builds/{VERSION}/index.html"},
    ]
    with open(os.path.join(builds_dir, 'builds.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    print("  wrote builds/builds.json")

    # snapshot current build
    snap_dir = os.path.join(builds_dir, VERSION)
    os.makedirs(snap_dir, exist_ok=True)
    # Copy generated files into snapshot
    for fname in os.listdir(DIR):
        if fname.endswith('.html') or fname.endswith('.css') or fname.endswith('.js'):
            if fname == 'version.js':
                continue  # skip, will copy after
            src = os.path.join(DIR, fname)
            if os.path.isfile(src):
                shutil.copy2(src, os.path.join(snap_dir, fname))
    shutil.copy2(os.path.join(DIR, 'version.js'), os.path.join(snap_dir, 'version.js'))
    print(f"  snapshot → builds/{VERSION}/")

    print("Done.")


if __name__ == '__main__':
    build()
