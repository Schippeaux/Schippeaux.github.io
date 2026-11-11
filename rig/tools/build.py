#!/usr/bin/env python3
"""Generate rig site v0.3.1: collapsible sections, map hierarchy, diagrams, layout fix."""

import json, os, shutil, datetime, textwrap

DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # rig/
VERSION = "0.3.1"
DATE = "2026-11-11"

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
    return hero("Percussion", "Sensory Percussion 2 on a compact mesh kit: kick, snare, hi-hat, three toms and a hi-hat pedal. Expression comes from zones and technique, not from pad count.") + '''
<div class="row"><h2>What the sensor reads</h2>
<div class="b8">
<p>It does not read acoustic timbre. What the software calls "timbre" is derived from where and how the head is struck — position and strike classification — not from spectral analysis. The raw axes are <strong>position/zone</strong>, <strong>velocity</strong>, and <strong>speed</strong> (hit rate). Everything else in the expression list is computed from those three.</p>
''' + detail("Zone training", '''<p>Each sensor can be trained with up to <strong>ten zones per drum</strong>: centre, edge, rimshot-centre, rimshot-edge, rim tip, rim shoulder, cross-stick, damped, shell, and a "void" zone for things to ignore. Most players train four to six that they can strike reliably and distinctly; zones can be blended so they flow into each other proportionally rather than switching hard.</p>
<p>Built-in controller types: Timbre, Velocity, Speed and LFO — each mappable to any parameter or sent out as MIDI CC.</p>''', "SP2") + '''
</div></div>

<div class="row"><h2>The kit</h2>
<div class="b8">
<p>Kick, snare, hi-hat (with pedal), and three toms. All mesh heads with Sensory Percussion sensors. The hi-hat pedal connection to the Portal is an open question — it is not documented as a sensor input.</p>
<table>
<thead><tr><th>Drum</th><th>Diameter</th><th>mm</th><th>Note</th></tr></thead>
<tbody>
<tr><td>Kick</td><td>18–20"</td><td>457–508</td><td>Mesh-head kick with SP2 sensor; compact electronic kick or trigger pad</td></tr>
<tr><td>Snare</td><td>12–13"</td><td>305–330</td><td>Compact, still a real rim for rimshots and cross-stick</td></tr>
<tr><td>Hi-hat</td><td>13–14"</td><td>330–356</td><td>SP2 sensor on top; pedal control TBC</td></tr>
<tr><td>Tom 1</td><td>8"</td><td>203</td><td>Smallest common rack tom; mesh heads easy to find</td></tr>
<tr><td>Tom 2</td><td>10"</td><td>254</td><td></td></tr>
<tr><td>Tom 3</td><td>12"</td><td>305</td><td>Lowest voice; doubles as a secondary surface instrument</td></tr>
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
        '<strong>Groove learning</strong> — the same principle as the Mimic creature: a model of the rhythmic shape biases what gets added and where.',
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


def hookup():
    return hero("Hook-up", "How everything plugs in. The EVANS Portal is at the centre — every audio source and sensor cable runs through it.") + '''
<div class="row">
<div class="b12">
<figure>
<svg class="sv" viewBox="0 0 840 680" role="img" aria-label="Wiring diagram: drums, bass, synth, interface, laptop, speakers, headphones">
<defs>
<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
</defs>
<!-- Drums top row -->
<rect class="bx" x="20" y="20" width="110" height="45"/><text x="75" y="38" text-anchor="middle" font-weight="600" font-size="12">Kick</text><text class="q" x="75" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="140" y="20" width="110" height="45"/><text x="195" y="38" text-anchor="middle" font-weight="600" font-size="12">Snare</text><text class="q" x="195" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="260" y="20" width="110" height="45"/><text x="315" y="38" text-anchor="middle" font-weight="600" font-size="12">Hi-hat</text><text class="q" x="315" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="380" y="20" width="90" height="45"/><text x="425" y="38" text-anchor="middle" font-weight="600" font-size="12">Tom 1</text><text class="q" x="425" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="480" y="20" width="90" height="45"/><text x="525" y="38" text-anchor="middle" font-weight="600" font-size="12">Tom 2</text><text class="q" x="525" y="55" text-anchor="middle" font-size="10">sensor</text>
<rect class="bx" x="580" y="20" width="90" height="45"/><text x="625" y="38" text-anchor="middle" font-weight="600" font-size="12">Tom 3</text><text class="q" x="625" y="55" text-anchor="middle" font-size="10">sensor</text>
<!-- HH pedal -->
<rect class="bxd" x="260" y="80" width="110" height="35"/><text class="q" x="315" y="103" text-anchor="middle" font-size="10">HH pedal — connection TBC</text>
<!-- sensor cables to Portal -->
<g class="thin" style="color:var(--line)">
<line x1="75" y1="65" x2="75" y2="170"/><line x1="195" y1="65" x2="195" y2="170"/>
<line x1="315" y1="65" x2="315" y2="170"/><line x1="425" y1="65" x2="425" y2="170"/>
<line x1="525" y1="65" x2="505" y2="170"/><line x1="625" y1="65" x2="575" y2="170"/>
</g>
<line class="lnq" x1="315" y1="115" x2="315" y2="170"/>
<!-- Portal -->
<rect class="hi" x="40" y="170" width="540" height="70"/>
<text x="310" y="196" text-anchor="middle" font-weight="700" font-size="14">EVANS Portal</text>
<text class="q" x="310" y="215" text-anchor="middle" font-size="11">7 sensor in · combo A/B (inst/line, +48V) · line C/D · main out L/R · aux 5-8 · phones · ADAT · MIDI DIN · USB-C</text>
<!-- Bass chain left -->
<rect class="bx" x="640" y="20" width="170" height="45"/><text x="725" y="38" text-anchor="middle" font-weight="600" font-size="12">Bass guitar</text><text class="q" x="725" y="55" text-anchor="middle" font-size="10">passive</text>
<rect class="bx" x="640" y="85" width="80" height="40"/><text x="680" y="101" text-anchor="middle" font-size="11">Compressor</text>
<rect class="bx" x="730" y="85" width="80" height="40"/><text x="770" y="101" text-anchor="middle" font-size="11">SansAmp</text>
<g class="ln" style="color:var(--line)">
<path d="M725 65L725 72L680 72L680 85" marker-end="url(#arr)"/>
<path d="M720 105L730 105" marker-end="url(#arr)"/>
<path d="M770 125L770 155L575 155L575 170" marker-end="url(#arr)"/>
</g>
<text class="q" x="620" y="155" font-size="9">input A (inst)</text>
<!-- Synth -->
<rect class="bx" x="640" y="180" width="170" height="50"/><text x="725" y="200" text-anchor="middle" font-weight="600" font-size="12">MiniFreak</text><text class="q" x="725" y="218" text-anchor="middle" font-size="10">audio + USB-MIDI</text>
<g class="ln" style="color:var(--line)"><path d="M640 200L580 200" marker-end="url(#arr)"/></g>
<text class="q" x="595" y="195" font-size="9">C/D line</text>
<line class="usb" x1="725" y1="230" x2="725" y2="340" style="stroke-dasharray:6 4"/>
<text class="q" x="735" y="290" font-size="9" transform="rotate(90 735 290)">USB-MIDI</text>
<!-- USB from Portal to laptop -->
<line class="usb" x1="310" y1="240" x2="310" y2="340"/>
<text class="q" x="320" y="290" font-size="9" transform="rotate(90 320 290)">USB-C</text>
<!-- Laptop -->
<rect class="hi" x="140" y="340" width="620" height="70"/>
<text x="450" y="365" text-anchor="middle" font-weight="700" font-size="14">Laptop</text>
<text class="q" x="450" y="385" text-anchor="middle" font-size="11">Sensory Percussion 2 → MIDI/CC → Ableton Live (+ Max for Live) → Jam Origin MIDI Bass</text>
<!-- Controllers -->
<rect class="bx" x="20" y="350" width="100" height="45"/><text x="70" y="368" text-anchor="middle" font-weight="600" font-size="11">Push 1</text><text class="q" x="70" y="385" text-anchor="middle" font-size="9">clips, scenes</text>
<line class="usb" x1="120" y1="372" x2="140" y2="372"/>
<rect class="bx" x="20" y="420" width="100" height="40"/><text x="70" y="436" text-anchor="middle" font-size="11">Loop controller</text><text class="q" x="70" y="450" text-anchor="middle" font-size="9">foot MIDI</text>
<line class="usb" x1="120" y1="440" x2="200" y2="440" x2="200" y2="410"/>
<rect class="bx" x="20" y="480" width="100" height="40"/><text x="70" y="496" text-anchor="middle" font-size="11">FX knobs</text><text class="q" x="70" y="514" text-anchor="middle" font-size="9">MIDI controller</text>
<line class="usb" x1="120" y1="500" x2="180" y2="500" x2="180" y2="410"/>
<!-- Outputs -->
<g class="ln" style="color:var(--line)">
<path d="M310 240L150 270L150 310L310 310" style="stroke:none"/>
</g>
<!-- Main out from Portal -->
<g class="ln" style="color:var(--line)">
<path d="M200 240L200 470L260 470" marker-end="url(#arr)"/>
</g>
<rect class="bx" x="260" y="450" width="180" height="45"/><text x="350" y="468" text-anchor="middle" font-weight="600" font-size="12">Speakers</text><text class="q" x="350" y="485" text-anchor="middle" font-size="10">Portal main out L/R</text>
<!-- Headphones from Portal -->
<g class="ln" style="color:var(--line)">
<path d="M260" y1="240" x2="260" y2="540" style="stroke:none"/>
<path d="M160 240L160 540L260 540" marker-end="url(#arr)"/>
</g>
<rect class="bx" x="260" y="520" width="180" height="45"/><text x="350" y="538" text-anchor="middle" font-weight="600" font-size="12">Headphones</text><text class="q" x="350" y="555" text-anchor="middle" font-size="10">Portal phones (3.5mm + ¼")</text>
<!-- Fallback interface -->
<rect class="bxd" x="520" y="460" width="200" height="50"/><text class="q" x="620" y="482" text-anchor="middle" font-size="11">Separate audio interface</text><text class="q" x="620" y="498" text-anchor="middle" font-size="9">fallback if Portal can't serve as sole I/O</text>
<!-- Legend -->
<g transform="translate(40 610)">
<line class="ln" x1="0" y1="8" x2="30" y2="8" style="color:var(--line)"/><text x="36" y="12" font-size="10">Audio</text>
<line class="usb" x1="100" y1="8" x2="130" y2="8"/><text x="136" y="12" font-size="10">USB / MIDI</text>
<line class="thin" x1="210" y1="8" x2="240" y2="8" style="color:var(--line)"/><text x="246" y="12" font-size="10">Sensor cable</text>
<line class="lnq" x1="330" y1="8" x2="360" y2="8"/><text x="366" y="12" font-size="10">Unconfirmed</text>
<rect class="bxd" x="440" y="0" width="16" height="16"/><text x="462" y="12" font-size="10">Fallback / optional</text>
</g>
</svg>
<figcaption>Wiring diagram. The Portal handles both sensor inputs and audio I/O. Whether it can be the only audio interface is an open question.</figcaption>
</figure>
</div></div>

<div class="row"><h2>Open questions</h2>
<div class="b7">
<ul>
<li><strong>Portal as sole interface?</strong> Bass into input A (inst), MiniFreak into C/D, speakers on Main Out, headphones on phones. If it works, no separate audio interface is needed.</li>
<li><strong>Hi-hat pedal:</strong> the Portal has 7 sensor inputs (3.5 mm TRS) plus combo inputs A/B, but a hi-hat pedal/controller connection is not documented.</li>
</ul>
</div></div>'''


def layout():
    return hero("Layout", "Seated centrally. Each instrument sits on one side of the chair so that switching is a turn, not a move.") + '''
<div class="row">
<div class="b8">
<figure>
<svg class="sv" viewBox="0 0 760 300" role="img" aria-label="Plan view: percussion, synth, bass, controllers">
<rect class="bx" x="300" y="120" width="160" height="60"/>
<text x="380" y="155" text-anchor="middle" font-weight="600">Seat</text>
<rect class="bx" x="40" y="100" width="200" height="100"/>
<text x="140" y="140" text-anchor="middle" font-weight="600">Percussion</text>
<text class="q" x="140" y="160" text-anchor="middle" font-size="12">kick, snare, hi-hat, 3 toms</text>
<rect class="bx" x="520" y="100" width="200" height="100"/>
<text x="620" y="140" text-anchor="middle" font-weight="600">Bass</text>
<text class="q" x="620" y="160" text-anchor="middle" font-size="12">pedals on the floor</text>
<rect class="bx" x="280" y="20" width="200" height="60"/>
<text x="380" y="45" text-anchor="middle" font-weight="600">Synth</text>
<text class="q" x="380" y="63" text-anchor="middle" font-size="12">MiniFreak, sequencer</text>
<rect class="bx hi" x="240" y="220" width="280" height="60"/>
<text x="380" y="245" text-anchor="middle" font-weight="600">Push 1 + loop controller + FX knobs</text>
<text class="q" x="380" y="263" text-anchor="middle" font-size="12">in front, within reach of all three</text>
</svg>
<figcaption>Plan view. Which side is which is still open; reach from the seat decides it.</figcaption>
</figure>
</div></div>'''


def signal():
    return hero("Signal flow", "Two parallel paths: audio and control. Audio is sound; control is MIDI, CC, and automation.") + '''
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
<p>Every voice can be looped independently. Audio loops of the drums and bass free your hands for the synth. Audio loops of the MiniFreak free it for new layers — the synth can be re-patched while its last phrase keeps playing. Drums can also be looped as MIDI (the raw zone/velocity data) and re-routed to a different creature or voice.</p>
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
<li>On the turnaround, trigger the next scene — the drum loop evolves, the bass hands off to the synth, the creatures wake up.</li>
</ol>
</div></div>'''


def time_tempo():
    return hero("Time and tempo", "Playing without a click and letting Live follow.") + '''
<div class="row">
<div class="b8">
<p class="lg">Live 11 introduced a built-in Tempo Follower. Before that it was BeatSeeker, a paid Max for Live device from Queen Mary's Centre for Digital Music.</p>
<p>Either listens to a rhythmic audio signal and moves Live's tempo to match. Switching between fixed and following modes can be mapped to a footswitch.</p>
<p><strong>What it tolerates:</strong> subtle fluctuation, ordinary push-and-pull. <strong>What it struggles with:</strong> sustained drift — speeding up or slowing down over several bars — where it can latch onto the initial tempo and let the grid slip away.</p>
<p>This needs testing with the real kit. A hybrid where the drums set tempo at the start of a section and the grid holds for the loop may be the practical answer.</p>
<div class="rule"><h3>Clock master</h3>
<p class="sm">If the MiniFreak's sequencer is synced to Live, following tempo moves everything together. If it runs free, loops recorded into Live are unquantised and the feel is looser.</p>
</div>
</div></div>'''


def expression():
    return hero("Expression", "What the playing can do to the synth and effects — from simple and legible to poetic.") + '''
<div class="row">
<div class="b12">
<figure>
<svg class="sv" viewBox="0 0 660 320" role="img" aria-label="Expression tiers diagram: four layers from direct one-to-one mappings up to system personality">
<defs><marker id="ea" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g style="fill:var(--panel);stroke:var(--line);stroke-width:1.5">
<rect x="10" y="10" width="640" height="60" rx="4"/>
<rect x="10" y="85" width="640" height="60" rx="4"/>
<rect x="10" y="160" width="640" height="60" rx="4"/>
<rect x="10" y="235" width="640" height="60" rx="4"/>
</g>
<g font-size="13" font-weight="700" style="fill:var(--ink)">
<text x="30" y="37">Tier 1</text><text x="100" y="37" font-weight="400" font-size="11">Direct, one to one</text>
<text x="30" y="112">Tier 2</text><text x="100" y="112" font-weight="400" font-size="11">Shaping rather than switching</text>
<text x="30" y="187">Tier 3</text><text x="100" y="187" font-weight="400" font-size="11">Derived and relational</text>
<text x="30" y="262">Tier 4</text><text x="100" y="262" font-weight="400" font-size="11">The system has a personality</text>
</g>
<g font-size="10" style="fill:var(--ink-2)">
<text x="30" y="55">velocity → volume · zone → patch · strike type → voice</text>
<text x="30" y="130">velocity → envelope · position → pan · speed → delay feedback</text>
<text x="30" y="205">micro-timing → destabilise · dynamic variance → randomisation · position drift → wavetable</text>
<text x="30" y="280">silence → growth · fatigue arc · harmonic memory · surprise threshold</text>
</g>
<g style="color:var(--accent)">
<text x="600" y="37" text-anchor="end" font-size="10" font-weight="600" style="fill:var(--accent)">legible</text>
<text x="600" y="262" text-anchor="end" font-size="10" font-weight="600" style="fill:var(--accent)">poetic</text>
<line x1="630" y1="50" x2="630" y2="255" stroke="currentColor" stroke-width="1.5" marker-end="url(#ea)"/>
</g>
</svg>
<figcaption>Four layers of expression mapping, from simple input→output to emergent system behaviour.</figcaption>
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


def creatures():
    return hero("Creatures", "The synth sounds are not patches — they are creatures, each with a character, living in the environment the drums create.") + '''
<div class="row">
<div class="b8">
<p class="lg">Each creature has two halves: what it feels like to play with, and how to build it. Click the build section to expand it. Their voices are all MiniFreak presets — one synth holds several at once, or one creature per scene.</p>
</div></div>

<div class="row">
<div class="b12">
''' + creature("The turnaround", "form-aware — knows where it is in the bar count",
    "The environment counts along with you. In 4/4 it knows a four- or eight-bar phrase is coming to its turnaround and, as you approach it, the creatures brace — a pad holds its breath, a pluck leans in. On the downbeat of the new phrase something happens: the key shifts under you, or everything drops out for a bar and comes back changed, or a new creature wakes up.",
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
    "You lay down a rhythm and the mimic starts to shadow it — first exactly, then in its own way, keeping the shape but choosing variations. Stop and it keeps going. But leave it too long and it gets thinner. Hits go missing, the timing loosens, the pitch drifts. It is still your idea, but it is forgetting it. Come back in and it brightens. It is a creature you have to keep feeding.",
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
<p class="lg">Each creature can be set to listen to any other creature's output — its notes, its dynamics, its life signal. When two creatures listen to each other, they start forming feedback loops.</p>
<figure>
<svg class="sv net" viewBox="0 0 440 280" role="img" aria-label="Voice routing diagram: four creatures connected by directional arrows">
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
<figcaption>Routing matrix: accent arrows are active connections, grey are potential. Any creature can listen to any other.</figcaption>
</figure>
</div></div>

<div class="row">
<div class="b12">
''' + detail("Routing architecture", '''
<ul>
<li><strong>Routing matrix:</strong> a Max for Live device or a simple send/receive bus where each creature's output signals (notes fired, velocity profile, life meter, density) are published, and each creature subscribes to whichever others it wants to hear.</li>
<li><strong>Response rules:</strong> when creature A hears creature B fire a note, it might echo it (transposed), answer it (a complementary rhythm), or go quiet (make space). These rules go both ways — B also reacts to A.</li>
<li><strong>Locking in:</strong> two creatures listening and responding to each other will eventually converge — their patterns interlock and a repeating figure emerges from what started as generative drift. This is the payoff: emergent structure from simple rules.</li>
<li><strong>Spiralling out:</strong> or they do not converge. The feedback amplifies differences instead of smoothing them — density escalates, timing scatters, the texture grows chaotic. A life-meter decay or a turnaround event can reset the spiral, or you can let it ride and play into the chaos.</li>
<li><strong>Manual routing:</strong> switching which voices listen to which could be a performance gesture — a knob or a Push pad that rewires the connections mid-set, changing which creatures are in conversation.</li>
</ul>''', "Max for Live") + '''
</div></div>

<div class="row"><h2>Where this leads</h2>
<div class="b8">
<p>The creatures are not just listening to the drummer — they are listening to each other. One Max for Live device per creature, with a shared bus of a few signals (life, turnaround, density, position), is enough architecture. The music makes itself.</p>
</div></div>'''


def gear():
    return hero("Gear", "What is owned, what is needed, and what has been deliberately left out.") + '''
<div class="row">
<div class="b12">
<table>
<thead><tr><th>Role</th><th>Item</th><th>Status</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Percussion</td><td>Sensory Percussion 2 + Portal</td><td>Owned</td><td>Sensors + hi-hat; train 4–6 zones per drum</td></tr>
<tr><td>Percussion</td><td>Kick, 12–13" snare, hi-hat, 8"+10"+12" toms, mesh heads</td><td class="st need">Needed</td><td>Shallow shells for compactness</td></tr>
<tr><td>Synth</td><td>Arturia MiniFreak</td><td>Owned</td><td>Onboard sequencer and arp first</td></tr>
<tr><td>Synth</td><td>Hardware step sequencer</td><td>Deferred</td><td>Only if MiniFreak + Live runs out</td></tr>
<tr><td>Bass</td><td>Bass guitar</td><td>Owned</td><td></td></tr>
<tr><td>Bass</td><td>SansAmp Bass Driver DI</td><td class="st need">Needed</td><td>Character + DI in one</td></tr>
<tr><td>Bass</td><td>Bass compressor</td><td class="st need">Needed</td><td>Dynamics and loop levels</td></tr>
<tr><td>Bass → MIDI</td><td>Jam Origin MIDI Bass (plugin)</td><td class="st need">Needed</td><td>Real-time bass-to-MIDI for synth handoff</td></tr>
<tr><td>Session control</td><td>Ableton Push 1</td><td>Owned</td><td>Clunky but works; Fixed Length first</td></tr>
<tr><td>Loop control</td><td>MIDI foot controller</td><td class="st need">Needed</td><td>Morningstar MC6 / SoftStep 2 / simple 2–4 button</td></tr>
<tr><td>Effects</td><td>Modular MIDI controller</td><td class="st need">Needed</td><td>Intech Grid / Monogram; follows selected track</td></tr>
<tr><td>Footswitch</td><td>MIDI footswitch</td><td class="st need">Needed</td><td>Record, track select, tempo follow on/off</td></tr>
<tr><td>Audio I/O</td><td>Portal (as interface)</td><td>Owned</td><td>May serve as sole audio interface — testing needed</td></tr>
<tr><td>Audio I/O</td><td>Separate audio interface (fallback)</td><td>Deferred</td><td>Only if Portal can't handle all I/O</td></tr>
<tr><td>Hub</td><td>Ableton Live Suite</td><td>Owned</td><td>Max for Live required</td></tr>
<tr><td>Output</td><td>Monitors / headphones</td><td class="st need">Needed</td><td>Closed-back for low-volume practice</td></tr>
<tr><td>Dropped</td><td>Keyboard</td><td>—</td><td>Sequencer and Push pads cover melodic input</td></tr>
</tbody>
</table>
</div></div>'''


def decisions():
    return hero("Open decisions", "Things to decide or test before buying.") + '''
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
<div class="b4"><div class="rule"><h3>Voice routing architecture</h3><p class="sm">Max for Live send/receive bus design for creature-to-creature signals. How to make routing switchable mid-performance.</p></div></div>
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


# ── Build ────────────────────────────────────────────────

PAGES = {
    'concept': ('Concept', concept),
    'percussion': ('Percussion', percussion),
    'bass': ('Bass', bass),
    'synth': ('Synth', synth),
    'hookup': ('Hook-up', hookup),
    'layout': ('Layout', layout),
    'signal': ('Signal flow', signal),
    'looping': ('Looping', looping),
    'time': ('Time and tempo', time_tempo),
    'expression': ('Expression', expression),
    'creatures': ('Creatures', creatures),
    'gear': ('Gear', gear),
    'decisions': ('Open decisions', decisions),
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

    # builds manifest
    builds_dir = os.path.join(DIR, 'builds')
    os.makedirs(builds_dir, exist_ok=True)
    manifest = [
        {"version": "0.2.0", "date": "2026-11-10", "notes": "Single-page version", "path": "builds/0.2.0/index.html"},
        {"version": "0.3.0", "date": "2026-11-10", "notes": "Map navigation + subpages", "path": "builds/0.3.0/index.html"},
        {"version": VERSION, "date": DATE, "notes": "Collapsible sections, diagrams, map hierarchy, layout fix", "path": f"builds/{VERSION}/index.html"},
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
