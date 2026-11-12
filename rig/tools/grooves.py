"""Grooves page for the rig site: nine full-kit study grooves as scores, players and .mid files.

One score table feeds the page grids, the player and the MIDI files. The feel of each groove
(swing, and how late or early each drum sits) is baked into the events, so the file and the player agree.

Score notation, one row per drum, bars separated by '|':
  X accent   x normal   o ghost (quiet)   . rest
Each character is one 16th note. 480 ticks = one beat, so a 16th is 120 ticks.
"""
import html
import json
import os
import re
import struct
import zipfile

from practice import _vlq, slug

PPQ = 480
STEP = PPQ // 4

# code, name, GM note, default velocities for X / x / o, note length in ticks
VOICES = [
    ("CR", "Crash", 49, (112, 88, 60), 480),
    ("RD", "Ride", 51, (105, 80, 52), 240),
    ("HH", "Closed hat", 42, (100, 78, 44), 60),
    ("PH", "Pedal hat", 44, (90, 70, 44), 60),
    ("OH", "Open hat", 46, (105, 85, 55), 240),
    ("T1", "High tom", 50, (115, 90, 55), 200),
    ("T2", "Mid tom", 47, (115, 90, 55), 200),
    ("T3", "Floor tom", 43, (115, 90, 55), 200),
    ("SN", "Snare", 38, (118, 96, 32), 100),
    ("SS", "Side stick", 37, (105, 85, 45), 60),
    ("CL", "Clap", 39, (112, 90, 50), 100),
    ("KK", "Kick", 36, (122, 98, 62), 100),
]
VINFO = {v[0]: v for v in VOICES}
ORDER = [v[0] for v in VOICES]

# artist, name, bpm, time signature (num, den), steps per bar, beat groups, swing %, lay (ticks, + is late), idea, listen, score
GROOVES = [
    dict(artist="Arthur Hnatek", name="Conversation", bpm=112, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=57,
         lay={"SN": 10, "RD": -4},
         idea="A spang-a-lang ride with the pedal hat on 2 and 4, and a sparse kick and snare answering each other instead of marking the beat. Bar two adds a skip on the ride and ends with a floor tom.",
         listen="The ghost snares between the kick hits, and the ride skip on the last 16th of beat 4.",
         score="""
CR |o...............|................|
RD |x...x..xx...x..x|x...x..xx...x.xx|
PH |....X.......X...|....X.......X...|
SN |....o.....o..x..|.o....x.....o.o.|
SS |..............o.|.............o..|
T3 |................|..............xo|
KK |X.....o...X.....|X.......o.X..o..|
"""),
    dict(artist="Arthur Hnatek", name="Seven", bpm=100, sig=(7, 8), bar=14, groups=[0, 4, 8], swing=50,
         lay={},
         idea="A groove in 7/8, counted 2+2+3. The kick marks the start of each group, the snare lands on the second group and the last note of the bar, and the hat ticks straight 8ths. Bar two fills in the hat.",
         listen="Count the groups: one-two, one-two, one-two-three. The odd bar length makes the loop feel like it's leaning forward.",
         score="""
HH |x.x.x.x.x.x.x.|xoxoxoxox.x.x.|
SS |..o...o...o...|..o...o.......|
SN |....X.......x.|....X..o....X.|
T2 |..............|..........x.o.|
KK |X...x...X.....|X.....x.X...o.|
"""),
    dict(artist="Jojo Mayer", name="Two-step ghosts", bpm=172, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=50,
         lay={"SN": 6},
         idea="The drum and bass two-step: kick on 1 and the 'and' of 3, snare on 2 and 4, a busy ghost-note layer around the snare and a hat with its own accents. Bar two ends with a quick tom run.",
         listen="The quiet ghost snares just before and after beat 4. They are the difference between a drum machine and a drummer.",
         score="""
CR |x...............|................|
HH |x.x.x.x.x.x.x.xo|x.x.x.x.x.x.xoxo|
T1 |................|.............xxX|
SN |....X..o.o..X..o|....X.o..o..X.o.|
KK |X.........X.....|X.........X..o..|
"""),
    dict(artist="Jojo Mayer", name="Half-time linear", bpm=85, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=54,
         lay={"SN": 8, "HH": -3},
         idea="A half-time groove with the snare on beat 3 and a constant 16th-note hat, accented on the beats. The kick and ghost snares move around it. Bar one ends with an open hat and bar two with a floor tom run.",
         listen="The hat never stops, while everything else breathes around it.",
         score="""
HH |XoxoXoxoXoxoXo.o|XoxoXoxoXoxoXoxo|
OH |..............X.|................|
SN |........X..o..o.|.....o..X.o....x|
T3 |................|............x.x.|
KK |X.....x...x.....|X.....x.....x.o.|
"""),
    dict(artist="Max Cooper", name="Rolling", bpm=124, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=50,
         lay={},
         idea="Four on the floor with a clap on 2 and 4, open hats on every off-beat, and a quiet 16th-note hat underneath. Machine-straight on purpose. The only variation is a small tom fill at the end of bar two.",
         listen="The ghost hats between the open hats. They make a steady kick feel like it's rolling.",
         score="""
CR |x...............|................|
OH |..X...X...X...X.|..X...X...X...X.|
HH |.o.o.o.o.o.o.o.o|.o.o.o.x.o.o.o.o|
CL |....X.......X...|....X.......X..o|
SS |...............o|.......o.......o|
T2 |................|............xoxo|
KK |X...X...X...X...|X...X...X...X...|
"""),
    dict(artist="Max Cooper", name="Three over four", bpm=120, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=50,
         lay={},
         idea="A steady 4/4 kick and backbeat under a hat that plays every third 16th note. The hat pattern needs three bars to line up with the bar again, so this is a three-bar loop. The last bar fills.",
         listen="The hat and the kick drifting apart, then meeting again on the downbeat of the fourth bar (the loop point).",
         score="""
CR |x...............|................|................
OH |................|................|..........X.....
HH |x..x..x..x..x..x|..x..x..x..x..x.|.x..x..x..x..x..
T1 |................|................|............x...
SN |....x.......x...|....x.......x...|....x.......x.xX
KK |X...X...X...X...|X...X...X...X...|X...X...X...X...
"""),
    dict(artist="Floating Points", name="Broken pocket", bpm=122, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=60,
         lay={"CL": 14, "HH": -4},
         idea="A house pulse with the kick pushed off the grid, a clap laid back, shuffled 16th hats and a side stick ghosting around them. The ride only comes in on the second bar.",
         listen="How late the clap sits. Turn the tempo down and the swing becomes obvious.",
         score="""
RD |................|x.x...x.x.x.x...
HH |xoXoxoxoxoXoxoxo|xoXoxoxoxoXoxo.o
OH |..............X.|..............X.
T2 |................|.............xox
SS |..o.....o.....o.|...o.....o.....o
CL |....X.......X...|....X.......X..o
KK |X.......X..x....|X.....x.X.......
"""),
    dict(artist="Tipper", name="Skippy half-time", bpm=100, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=52,
         lay={"SN": 12, "HH": -6, "CL": 12},
         idea="A broken half-time beat: the snare on 3 with a clap behind it, a kick that stumbles around the downbeat, and a hat that stutters in clumps. Bar two ends with a snare and tom roll.",
         listen="The kick before and after beat 1, and the little roll into the loop point.",
         score="""
CR |x...............|................
HH |x.xxo.xox.xxo.xx|x.xxo.xox.xxo.x.
OH |..............X.|................
T1 |................|..........x.x.o.
SN |........X.....o.|........X...o.xX
SS |.o.....o........|...o.......o....
CL |........x.......|........x.......
KK |X...o..x..X...o.|X.o.....x.X...o.
"""),
    dict(artist="Tipper", name="Heavy half-time", bpm=140, sig=(4, 4), bar=16, groups=[0, 4, 8, 12], swing=50,
         lay={"SN": 4},
         idea="A wide, heavy half-time pattern: one big snare on 3, a kick that leaves gaps for bass, steady 8th hats with open hats on the off-beats, and a three-tom fill at the end of bar two.",
         listen="The space. Most of the bar is empty on purpose, so a bass line can fill it.",
         score="""
CR |x...............|................
OH |......X.......X.|......X.........
HH |x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.
T1 |................|..........x.x...
T2 |................|............x.x.
T3 |................|..............xX
SN |........X.......|........X.....xX
CL |........x.......|........x.......
KK |X.......o..x....|X.....o...x.....
"""),
]


def parse_score(text, bar):
    rows = {}
    for line in text.strip().splitlines():
        code, rest = line.split(None, 1)
        bars = rest.strip().strip("|").split("|")
        for b in bars:
            assert len(b) == bar, (code, b, len(b), bar)
            assert set(b) <= set("Xxo."), (code, b)
        rows[code] = bars
    nb = {len(v) for v in rows.values()}
    assert len(nb) == 1, nb
    return rows, nb.pop()


def render(g):
    rows, nbars = parse_score(g["score"], g["bar"])
    total = nbars * g["bar"] * STEP
    sw_delay = round(STEP * (g["swing"] - 50) / 50)
    notes, markers = [], []
    for s in range(nbars * g["bar"]):
        t = s * STEP + (sw_delay if (s % g["bar"]) % 2 else 0)
        markers.append((t % total, -1, 0, s))
    for code in ORDER:
        if code not in rows:
            continue
        vi = ORDER.index(code)
        _, _, note, vels, ln = VINFO[code]
        for b, row in enumerate(rows[code]):
            for i, c in enumerate(row):
                if c == ".":
                    continue
                s = b * g["bar"] + i
                t = s * STEP + (sw_delay if i % 2 else 0) + g["lay"].get(code, 0)
                t %= total
                notes.append((t, vi, vels["Xxo".index(c)], s, note, ln))
    return rows, nbars, total, notes, markers


def make_mid(g):
    rows, nbars, total, notes, markers = render(g)
    # note off: the note length, but never past the next hit of the same pitch (loop-aware)
    bypitch = {}
    for n in notes:
        bypitch.setdefault(n[4], []).append(n)
    evs = []
    for pitch, lst in bypitch.items():
        lst.sort()
        for k, (t, vi, vel, s, note, ln) in enumerate(lst):
            nxt = lst[(k + 1) % len(lst)][0] + (total if k + 1 == len(lst) else 0)
            off = min(t + ln, nxt - 4, total - 1 if t + ln >= total else t + ln)
            off = max(off, t + 1)
            evs.append((t, 1, 0x99, note, vel))
            evs.append((off, 0, 0x89, note, 0))
    evs.sort(key=lambda e: (e[0], e[1]))
    name = f'{g["artist"]}: {g["name"]}'.encode()
    num, den = g["sig"]
    dd = {4: 2, 8: 3}[den]
    trk = bytearray()
    trk += _vlq(0) + b"\xff\x03" + _vlq(len(name)) + name
    trk += _vlq(0) + b"\xff\x51\x03" + struct.pack(">I", 60_000_000 // g["bpm"])[1:]
    trk += _vlq(0) + b"\xff\x58\x04" + bytes([num, dd, 24, 8])
    now = 0
    for t, _, status, note, vel in evs:
        trk += _vlq(t - now) + bytes([status, note, vel])
        now = t
    trk += _vlq(total - now) + b"\xff\x2f\x00"
    return b"MThd" + struct.pack(">IHHH", 6, 0, 1, PPQ) + b"MTrk" + struct.pack(">I", len(trk)) + bytes(trk)


def gid(g):
    return slug(g["artist"] + " " + g["name"])


def write_midi(rig_dir):
    out = os.path.join(rig_dir, "grooves")
    os.makedirs(out, exist_ok=True)
    keep = {"grooves.zip"}
    with zipfile.ZipFile(os.path.join(out, "grooves.zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for k, g in enumerate(GROOVES, 1):
            data = make_mid(g)
            fn = gid(g) + ".mid"
            keep.add(fn)
            with open(os.path.join(out, fn), "wb") as f:
                f.write(data)
            zi = zipfile.ZipInfo(f"{k:02d}-{fn}", date_time=(2026, 11, 12, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, data)
    for fn in os.listdir(out):
        if fn not in keep:
            os.remove(os.path.join(out, fn))


def _score_html(g, rows, nbars):
    used = [c for c in ORDER if c in rows]
    bars = []
    for b in range(nbars):
        lines = []
        for code in used:
            cells = []
            for i, c in enumerate(rows[code][b]):
                cls = "gv-c" + (" g" if i in g["groups"] else "") + (" h" if c != "." else "") + (" a" if c == "X" else "") + (" o" if c == "o" else "")
                cells.append(f'<span class="{cls}" data-s="{b * g["bar"] + i}">{"" if c == "." else c}</span>')
            lines.append(f'<div class="gv-row"><b class="gv-l" title="{VINFO[code][1]}">{code}</b>{"".join(cells)}</div>')
        bars.append(f'<div class="gv-bar"><span class="gv-n">Bar {b + 1}</span>{"".join(lines)}</div>')
    return "".join(bars)


def _feel(g):
    bits = []
    bits.append("straight 16ths" if g["swing"] == 50 else f'swing {g["swing"]}%')
    for code, t in g["lay"].items():
        bits.append(f'{VINFO[code][1].lower()} {abs(t)} ticks {"late" if t > 0 else "early"}')
    return ", ".join(bits)


def grooves(hero, detail):
    cards, data = [], {}
    for g in GROOVES:
        rows, nbars, total, notes, markers = render(g)
        evs = sorted([(t, v, vel, s) for t, v, vel, s, _, _ in notes] + [(t, v, vel, s) for t, v, vel, s in markers])
        data[gid(g)] = {"ev": [list(e) for e in evs], "loop": total, "bpm": g["bpm"], "steps": nbars * g["bar"]}
        used = [c for c in ORDER if c in rows]
        text = "\n".join(f'{c}  |' + "|".join(rows[c]) + "|" for c in used)
        num, den = g["sig"]
        cards.append(f'''<article class="gv-card" data-id="{gid(g)}">
<div class="pr-head"><h3>{html.escape(g["name"])}</h3><span class="pr-tag">{html.escape(g["artist"])}</span></div>
<p class="gv-meta mono">{g["bpm"]} BPM · {num}/{den} · {nbars} bars · {len(used)} drums</p>
<p class="sm">{html.escape(g["idea"])}</p>
<div class="gv-score" aria-hidden="true">{_score_html(g, rows, nbars)}</div>
<p class="xs">Feel: {html.escape(_feel(g))}</p>
<p class="sm"><b>Listen for:</b> {html.escape(g["listen"])}</p>
<div class="pr-act"><button type="button" class="pr-play" aria-pressed="false">Play</button>
<label class="gv-tempo">Tempo <input type="range" class="gv-bpm" min="50" max="200" value="{g["bpm"]}" aria-label="Tempo"> <b class="mono gv-bv">{g["bpm"]}</b></label>
<a class="pr-dl" href="grooves/{gid(g)}.mid" download>Download .mid</a></div>
{detail("Text score", f'<pre class="gv-pre">{html.escape(text)}</pre>')}
</article>''')

    kit = "".join(f'<tr><td class="mono">{c}</td><td>{n}</td><td class="mono">{note}</td></tr>' for c, n, note, _, _ in VOICES)
    vdata = json.dumps(ORDER)
    return hero("Grooves", "Nine full-kit study grooves in the spirit of five drummers and producers. Each has its own feel built in.",
        meta='<div><b>Status</b>Draft: 9 grooves, playable</div><div><b>Kit</b>12 drums, General MIDI notes</div><div><b>Part of</b><a href="practice.html">Practice</a></div>') + f'''
<div class="row"><h2>About these</h2>
<div class="b8">
<p class="lg">Written in the spirit of Arthur Hnatek, Jojo Mayer, Max Cooper, Floating Points and Tipper. They are original study patterns, not transcriptions of any recording.</p>
<p>Each groove has a different feel, and that feel is part of the MIDI file: some swing the 16th notes, and some drums sit a little late or early. Because it is baked into the notes, there is no global swing control. The tempo slider on each card changes the speed only. The .mid file keeps the groove's own tempo.</p>
<p class="sm">I can't hear these. I wrote them from how these styles are generally built, so treat them as first drafts to react to. Tell me which ones feel right, which feel wrong, and what to change.</p>
<ul class="pr-key">
<li><b class="mono">X</b> accent, <b class="mono">x</b> normal, <b class="mono">o</b> ghost (quiet), a blank cell is a rest. One cell is a 16th note.</li>
<li>Rows are drums, top to bottom from cymbals to kick. A heavier line marks each beat group.</li>
<li>The page plays a simple synthesised kit so you can check the rhythm. The .mid files are meant for a real Drum Rack.</li>
</ul>
</div></div>

<div class="row"><h2>The grooves</h2>
<div class="b12">
<p class="lg">Press play on any card. <a href="grooves/grooves.zip" download>Download all nine as a .zip</a></p>
<div class="gv-cards">{"".join(cards)}</div>
</div></div>

<div class="row"><h2>MIDI notes</h2>
<div class="b8">
<div class="tw"><table><thead><tr><th>Row</th><th>Drum</th><th>Note</th></tr></thead><tbody>{kit}</tbody></table></div>
<p class="sm">The notes follow General MIDI, so they land on the standard Drum Rack pads. Velocity is 122 to 32 depending on the drum and the mark (X, x or o). Beat 1 is tick 0, and there are 480 ticks to a beat. A hit that lands a little before the downbeat in the first bar wraps to the end of the loop. The 7/8 groove has a 7/8 time signature in its file, so Live will show the clip in 7/8. The three-bar groove needs a three-bar clip.</p>
</div></div>

<script>
(function(){{
var V={vdata};
var D={json.dumps(data, separators=(",", ":"))};
var AC=null,NB=null,master=null,openHat=null;
var cur=null,timer=null,raf=null,idx=0,loopNo=0,lastAbs=0,lastTime=0,queue=[],card=null;
function ensure(){{
  if(!AC){{var C=window.AudioContext||window.webkitAudioContext;if(!C)return false;AC=new C();
    var n=AC.sampleRate*2,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;NB=b;
    var comp=AC.createDynamicsCompressor();master=AC.createGain();master.gain.value=0.8;master.connect(comp);comp.connect(AC.destination);}}
  if(AC.state==='suspended')AC.resume();
  return true;
}}
function tone(t,f,type,len,vol,from,fall){{
  var o=AC.createOscillator(),g=AC.createGain();o.type=type;
  o.frequency.setValueAtTime(from||f,t);if(from)o.frequency.exponentialRampToValueAtTime(f,t+(fall||0.05));
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+len+0.03);return g;
}}
function noise(t,f,q,len,vol,type){{
  var s=AC.createBufferSource();s.buffer=NB;var fl=AC.createBiquadFilter();fl.type=type||'bandpass';fl.frequency.value=f;fl.Q.value=q;
  var g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
  s.connect(fl);fl.connect(g);g.connect(master);s.start(t);s.stop(t+len+0.03);return g;
}}
function chokeOpen(t){{if(openHat){{openHat.gain.cancelScheduledValues(t);openHat.gain.setTargetAtTime(0,t,0.01);openHat=null;}}}}
function hit(code,t,vel){{
  var v=vel/127;
  switch(code){{
    case 'KK':tone(t,48,'sine',0.38,1.0*v,150,0.09);noise(t,3000,1,0.01,0.25*v);break;
    case 'SN':noise(t,2000,0.8,0.18,0.9*v);tone(t,185,'triangle',0.1,0.55*v,260,0.03);break;
    case 'SS':noise(t,3200,3,0.03,1.3*v);tone(t,1800,'sine',0.025,0.4*v);break;
    case 'CL':noise(t,1300,1.2,0.05,0.8*v);noise(t+0.009,1300,1.2,0.05,0.8*v);noise(t+0.018,1300,1.2,0.14,0.9*v);break;
    case 'HH':chokeOpen(t);noise(t,7500,0.7,0.04,0.6*v,'highpass');break;
    case 'PH':chokeOpen(t);noise(t,6500,0.7,0.055,0.45*v,'highpass');break;
    case 'OH':chokeOpen(t);openHat=noise(t,7000,0.7,0.35,0.55*v,'highpass');break;
    case 'RD':noise(t,5500,0.7,0.5,0.28*v,'highpass');noise(t,8500,6,0.6,0.25*v);tone(t,3100,'sine',0.25,0.05*v);break;
    case 'CR':noise(t,3500,0.7,1.4,0.55*v,'highpass');break;
    case 'T1':tone(t,210,'sine',0.28,0.9*v,285,0.07);break;
    case 'T2':tone(t,160,'sine',0.3,0.9*v,215,0.07);break;
    case 'T3':tone(t,115,'sine',0.34,0.95*v,155,0.08);break;
  }}
}}
function pump(){{
  var P=D[cur],ev=P.ev,bpm=+card.querySelector('.gv-bpm').value;
  var spt=60/bpm/480;
  while(true){{
    var e=ev[idx],abs=loopNo*P.loop+e[0],t=lastTime+(abs-lastAbs)*spt;
    if(t>AC.currentTime+0.12)break;
    if(e[1]>=0)hit(V[e[1]],t,e[2]);
    queue.push({{t:t,s:e[3],m:e[1]<0}});
    lastAbs=abs;lastTime=t;
    idx++;if(idx>=ev.length){{idx=0;loopNo++;}}
  }}
}}
function paint(){{
  while(queue.length&&queue[0].t<=AC.currentTime){{
    var q=queue.shift();
    if(q.m){{
      card.querySelectorAll('.gv-c.on').forEach(function(e){{e.classList.remove('on');}});
      card.querySelectorAll('.gv-c[data-s="'+q.s+'"]').forEach(function(e){{e.classList.add('on');}});
    }}
  }}
  raf=requestAnimationFrame(paint);
}}
function stop(){{
  if(timer){{clearInterval(timer);timer=null;}}
  if(raf){{cancelAnimationFrame(raf);raf=null;}}
  queue=[];openHat=null;
  document.querySelectorAll('.gv-c.on').forEach(function(e){{e.classList.remove('on');}});
  document.querySelectorAll('.gv-card .pr-play').forEach(function(b){{b.textContent='Play';b.setAttribute('aria-pressed','false');}});
  cur=null;card=null;
}}
function play(c,btn){{
  if(!ensure())return;
  var id=c.dataset.id,was=cur;stop();
  if(was===id)return;
  cur=id;card=c;idx=0;loopNo=0;lastAbs=0;lastTime=AC.currentTime+0.1;
  btn.textContent='Stop';btn.setAttribute('aria-pressed','true');
  timer=setInterval(pump,25);pump();raf=requestAnimationFrame(paint);
}}
document.querySelectorAll('.gv-card').forEach(function(c){{
  var b=c.querySelector('.pr-play'),r=c.querySelector('.gv-bpm'),l=c.querySelector('.gv-bv');
  b.addEventListener('click',function(){{play(c,b);}});
  r.addEventListener('input',function(){{l.textContent=r.value;}});
}});
document.addEventListener('visibilitychange',function(){{if(document.hidden)stop();}});
}})();
</script>
'''
