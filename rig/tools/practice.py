"""Practice page for the rig site: rudiment ladder, a player and a .mid file for every pattern.

One notation table feeds the page player, the step grids and the MIDI files, so they cannot drift apart.

Notation: R/L = hand. Capital = accent, lowercase = normal, '.' = rest. (l)R = flam, (ll)R = drag:
the grace notes come just before the main note. Each character is one step. 'spb' is steps per beat:
4 for 16th notes, 3 for triplets. '|:' and ':|' are cosmetic repeat marks.
"""
import html
import json
import math
import os
import re
import struct
import zipfile

NOTE = {"R": 38, "L": 37}   # right hand = snare, left hand = side stick, so a Drum Rack can tell them apart
PPQ = 480
ACCENT, NORMAL, GRACE = 112, 72, 50
NOTE_LEN = 60               # ticks
GRACE_UNIT = 22             # ticks between grace notes and before the main note
GRACE_LEN = 14

# (level title, move-on rule, items). Item: (name, notation, tip, steps per beat, suggested BPM)
LADDER = [
    ("Level 1: Foundations", "Alternating hands, one accent per beat. Move on when you can play each for a full minute with an even sound at 70 BPM.", [
        ("Single strokes, 8th notes", "|: R.l. R.l. :|", "Count 1 and 2 and. Just alternate.", 4, 70),
        ("Single stroke roll", "Rlrl Rlrl Rlrl Rlrl", "Hands alternate, right leads every beat. Make the lowercase notes match each other in volume and height.", 4, 70),
        ("Double stroke roll", "RrLl RrLl RrLl RrLl", "Two notes per hand. The second of each pair is a rebound, not a second hit. Let the stick bounce.", 4, 60),
        ("Single paradiddle", "Rlrr Lrll Rlrr Lrll", "Right-left-right-right, then left-right-left-left. The accent always lands on the lead hand, so it swaps sides every beat.", 4, 60),
    ]),
    ("Level 2: Triplets and flams", "Three notes per beat, and the first grace notes. Move on when triplets stay even and flams sound like one fat note.", [
        ("Single stroke triplets", "|: Rlr Lrl :|", "Three letters per beat (triplet grid). The lead hand swaps every beat.", 3, 60),
        ("Flam", "|: (l)R... (r)L... :|", "(l)R is a quiet left grace note just before an accented right. Low stick for the grace, high stick for the main note.", 4, 60),
        ("Flam tap", "|: (l)R R (r)L L :|", "A flam, then a tap on the same hand, then swap.", 4, 60),
    ]),
    ("Level 3: Rolls", "Longer runs of doubles that end on an accent. Move on when the last note of each roll lands on the beat.", [
        ("Five stroke roll", "|: RrLl R... LlRr L... :|", "Two doubles and a single. The single lands on beat 2 and beat 4.", 4, 60),
        ("Seven stroke roll", "|: RrLl RrL. LlRr LlR. :|", "Same idea, one more double.", 4, 60),
        ("Nine stroke roll", "|: RrLl RrLl R... LlRr LlRr L... :|", "Each roll takes three beats, so the full pattern is six beats and the lead hand swaps halfway.", 4, 60),
        ("Triple stroke roll", "|: Rrr Lll :|", "Triplet grid. Three notes per hand.", 3, 60),
    ]),
    ("Level 4: Drags and flam combinations", "Two grace notes, and flams joined to other patterns. Move on when the grace notes are quiet and the accents are clear.", [
        ("Single drag tap", "|: (ll)R l (rr)L r :|", "Two quick grace notes (a drag) before the accent, then a tap with the other hand.", 4, 50),
        ("Flam accent", "|: (l)R l r (r)L r l :|", "Triplet grid. The flam is on beat one of each group.", 3, 50),
        ("Flam paradiddle", "|: (l)R l r r (r)L r l l :|", "A paradiddle with a flam on the lead note.", 4, 50),
    ]),
    ("Level 5: Long combinations", "Longer sticking patterns and moving accents. Move on when you can start any of them on either hand.", [
        ("Double paradiddle", "|: Rlrlrr Lrlrll :|", "Six notes per half, played as a triplet feel.", 3, 50),
        ("Paradiddle-diddle", "|: Rlrrll Lrllrr :|", "Six notes per half. A common one for fills and ride patterns.", 3, 50),
        ("Triple paradiddle", "|: Rlrlrlrr Lrlrlrll :|", "Eight notes per half, played as 16th notes over four beats.", 4, 50),
        ("Flam paradiddle-diddle", "|: (l)R l r r l l (r)L r l l r r :|", "A paradiddle-diddle with a flam on the lead note. Triplet grid.", 3, 50),
        ("Paradiddle accent displacement", "|: Rlrr Lrll :|  |: rLrr lRll :|  |: rlRr lrLl :|  |: rlrR lrlL :|", "Same sticking, accent moved through all four positions. Plays each once, then loops.", 4, 50),
    ]),
]


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse(text):
    """Notation -> list of steps: (hand or None, accent, [grace hands])."""
    s = text.replace("|:", "").replace(":|", "")
    s = re.sub(r"\s+", "", s)
    out, i = [], 0
    while i < len(s):
        c = s[i]
        graces = []
        if c == "(":
            j = s.index(")", i)
            graces = [h.upper() for h in s[i + 1:j]]
            i = j + 1
            c = s[i]
        if c == ".":
            out.append((None, False, []))
        elif c in "RrLl":
            out.append((c.upper(), c.isupper(), graces))
        else:
            raise ValueError(f"bad notation character {c!r} in {text!r}")
        i += 1
    return out


def all_patterns():
    out = []
    for lv, (title, rule, items) in enumerate(LADDER, 1):
        for name, text, tip, spb, bpm in items:
            steps = parse(text)
            assert len(steps) % spb == 0, name
            out.append({"id": slug(name), "name": name, "text": text, "tip": tip, "spb": spb,
                        "bpm": bpm, "level": lv, "steps": steps})
    return out


def _vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


def render_events(p):
    """Returns (events, total_ticks). The pattern repeats to fill whole 4/4 bars so the file loops cleanly in Live."""
    n, spb = len(p["steps"]), p["spb"]
    st = PPQ // spb
    reps = 4 // math.gcd(n // spb, 4)
    total = n * reps * st
    evs = []  # (tick, order, status, note, vel); order 0 = off, 1 = on

    def add(t, note, vel, length):
        evs.append((t, 1, 0x99, note, vel))
        evs.append((t + length, 0, 0x89, note, 0))

    for r in range(reps):
        for i, (hand, acc, graces) in enumerate(p["steps"]):
            if hand is None:
                continue
            t = (r * n + i) * st
            add(t, NOTE[hand], ACCENT if acc else NORMAL, NOTE_LEN)
            for k, gh in enumerate(graces):
                gt = t - GRACE_UNIT * (len(graces) - k)
                if gt < 0:
                    gt += total      # a grace before beat 1 wraps to the end of the loop
                add(gt, NOTE[gh], GRACE, GRACE_LEN)
    evs.sort(key=lambda e: (e[0], e[1]))
    return evs, total


def make_mid(p):
    evs, total = render_events(p)
    name = p["name"].encode()
    trk = bytearray()
    trk += _vlq(0) + b"\xff\x03" + _vlq(len(name)) + name
    trk += _vlq(0) + b"\xff\x51\x03" + struct.pack(">I", 60_000_000 // p["bpm"])[1:]
    trk += _vlq(0) + b"\xff\x58\x04\x04\x02\x18\x08"
    now = 0
    for t, _, status, note, vel in evs:
        trk += _vlq(t - now) + bytes([status, note, vel])
        now = t
    trk += _vlq(total - now) + b"\xff\x2f\x00"
    return b"MThd" + struct.pack(">IHHH", 6, 0, 1, PPQ) + b"MTrk" + struct.pack(">I", len(trk)) + bytes(trk)


def write_midi(rig_dir):
    out = os.path.join(rig_dir, "practice")
    os.makedirs(out, exist_ok=True)
    keep = set()
    zpath = os.path.join(out, "rudiments.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for k, p in enumerate(all_patterns(), 1):
            data = make_mid(p)
            fn = p["id"] + ".mid"
            keep.add(fn)
            with open(os.path.join(out, fn), "wb") as f:
                f.write(data)
            zi = zipfile.ZipInfo(f"{k:02d}-{fn}", date_time=(2026, 11, 12, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, data)
    keep.add("rudiments.zip")
    for fn in os.listdir(out):
        if fn not in keep:
            os.remove(os.path.join(out, fn))


def _cell(step):
    hand, acc, graces = step
    if hand is None:
        return '<span class="pr-c r" data-i="{i}"></span>'
    g = f'<i>{"".join(h.lower() for h in graces)}</i>' if graces else ""
    return f'<span class="pr-c{" a" if acc else ""}" data-i="{{i}}">{g}{hand if acc else hand.lower()}</span>'


def _grid(p):
    spb, steps = p["spb"], p["steps"]
    beats = []
    for b in range(len(steps) // spb):
        cells = "".join(_cell(steps[b * spb + k]).replace("{i}", str(b * spb + k)) for k in range(spb))
        beats.append(f'<span class="pr-b">{cells}</span>')
    return "".join(beats)


def practice(hero, detail):
    pats = all_patterns()
    data = {}
    for p in pats:
        sl = []
        for hand, acc, graces in p["steps"]:
            if hand is None:
                sl.append(".")
            else:
                sl.append((f'({"".join(graces)})' if graces else "") + (hand if acc else hand.lower()))
        data[p["id"]] = {"s": sl, "spb": p["spb"]}

    sections = []
    for lv, (title, rule, items) in enumerate(LADDER, 1):
        cards = []
        for p in [q for q in pats if q["level"] == lv]:
            trip = ' <span class="pr-tag">triplets</span>' if p["spb"] == 3 else ""
            cards.append(f'''<article class="pr-card" data-id="{p["id"]}">
<div class="pr-head"><h4>{html.escape(p["name"])}</h4>{trip}</div>
<p class="pr-txt">{html.escape(p["text"])}</p>
<div class="pr-grid" aria-hidden="true">{_grid(p)}</div>
<p class="sm">{html.escape(p["tip"])}</p>
<p class="xs">Start at {p["bpm"]} BPM{" · swing has no effect on triplets" if p["spb"] == 3 else ""}</p>
<div class="pr-act"><button type="button" class="pr-play" aria-pressed="false">Play</button>
<a class="pr-dl" href="practice/{p["id"]}.mid" download>Download .mid</a></div>
</article>''')
        sections.append(f'<section class="pr-level"><h3>{html.escape(title)}</h3><p class="sm">{html.escape(rule)}</p><div class="pr-cards">{"".join(cards)}</div></section>')

    sounds = ["Click", "Woodblock", "Clave", "Rim tick", "Hat tick"]
    opts = "".join(f'<option value="{k}">{n}</option>' for k, n in enumerate(sounds))

    return hero("Practice", "Learn the hands first. Repeat until it stops being a decision. The synths and effects come after.",
        meta=f'<div><b>Status</b>Draft: all {len(pats)} patterns playable</div><div><b>Level</b>Beginner, hands only (L and R)</div><div><b>Part of</b><a href="template.html">Set Template</a></div>') + f'''
<div class="row"><h2>How to read the notation</h2>
<div class="b8">
<p class="lg">One letter per note. Each group is one beat.</p>
<ul class="pr-key">
<li><b class="mono">R</b> and <b class="mono">L</b> are right and left hand. <b>Capital</b> letters are accents, <b>lowercase</b> are normal notes.</li>
<li><b class="mono">.</b> is a rest.</li>
<li><b class="mono">(l)R</b> is a flam: a quiet left grace note just before an accented right. <b class="mono">(ll)R</b> is a drag, with two grace notes. In the step grids the grace notes are the small letters above the main note.</li>
<li><b class="mono">|: ... :|</b> means repeat. Four letters per beat is 16th notes. Patterns marked "triplets" have three per beat.</li>
</ul>
<p class="sm">Example: <span class="mono">Rlrr Lrll</span> is a single paradiddle, and the capitals show the accent landing on the lead hand.</p>
</div></div>

<div class="row"><h2>The ladder, easy to hard</h2>
<div class="b12">
<p class="lg">{len(pats)} patterns in five levels. Every one plays here and downloads as a .mid file. <a href="practice/rudiments.zip" download>Download all as a .zip</a></p>
<div class="pr-bar" role="group" aria-label="Playback controls">
<label>Tempo <input type="range" id="prBpm" min="40" max="140" step="1" value="60"> <b id="prBpmV" class="mono">60</b> BPM</label>
<label>Swing <input type="range" id="prSwing" min="50" max="75" step="1" value="50"> <b id="prSwingV" class="mono">50</b>%</label>
<label>Sound <select id="prSound">{opts}</select></label>
<label class="pr-chk"><input type="checkbox" id="prClick" checked> Metronome</label>
</div>
{"".join(sections)}
<p class="sm">Swing delays every second 16th note: 50% is straight, about 67% is a triplet feel, 75% is very late. Leave it at 50% while learning the sticking, then use it to hear the same pattern in a jazz feel. It affects playback here only. The downloaded .mid files are straight; in Live you add swing by dropping a groove from the Groove Pool onto the clip.</p>
<p class="sm">The sounds are synthesised clicks so you can check timing and sticking. The right hand is always a little higher in pitch than the left. The metronome is a softer, lower beep so it doesn't get confused with your hands.</p>
<p class="sm">In the .mid files the right hand is note 38 and the left is note 37, so a Drum Rack can give each hand its own pad, or the same sound. Accents are velocity 112, normal notes 72 and grace notes 50. Grace notes sit a few milliseconds before the beat, and a flam on the first note wraps to the end of the loop. Each file is a whole number of bars: shorter patterns repeat to fill them, so the clip loops cleanly.</p>
</div></div>

<div class="row"><h2>A session</h2>
<div class="b8">
<ol class="pr-steps">
<li><b>Warm up, 3 minutes.</b> Single stroke roll at a tempo that feels easy.</li>
<li><b>One new pattern, 10 minutes.</b> Slow, with the metronome, until three passes in a row are even.</li>
<li><b>One review pattern, 5 minutes.</b> Something from last session, a little faster.</li>
<li><b>Play, 2 minutes.</b> No metronome. Mix anything you know.</li>
</ol>
<p class="sm">A common rule is to raise the tempo by about 4 BPM only after a few clean passes. The aim is the same pattern, repeated until your hands do it without you.</p>
<p class="sm">In the Ableton set these loops would sit in a practice scene, played by the stand-in Drum Rack. Once the hands are there, synth layers and effects are added on top and the loops become the environments from the <a href="template.html">Set Template</a>.</p>
</div></div>

<script>
(function(){{
var D={json.dumps(data, separators=(",", ":"))};
Object.keys(D).forEach(function(k){{
  D[k].p=D[k].s.map(function(s){{
    if(s==='.')return null;
    var g='',m=s;
    if(s.charAt(0)==='('){{var j=s.indexOf(')');g=s.slice(1,j);m=s.slice(j+1);}}
    return {{h:m.toUpperCase(),a:m===m.toUpperCase(),g:g.split('').filter(Boolean)}};
  }});
}});
var AC=null,NB=null,timer=null,raf=null,cur=null,step=0,next=0,queue=[];
var $=function(id){{return document.getElementById(id);}};
var bpm=$('prBpm'),sw=$('prSwing'),ck=$('prClick'),snd=$('prSound');
try{{var sv=localStorage.getItem('rig.practice.sound');if(sv!==null&&snd.querySelector('option[value="'+sv+'"]'))snd.value=sv;}}catch(e){{}}
function lab(){{$('prBpmV').textContent=bpm.value;$('prSwingV').textContent=sw.value;}}
bpm.addEventListener('input',lab);sw.addEventListener('input',lab);lab();
function ensure(){{
  if(!AC){{var C=window.AudioContext||window.webkitAudioContext;if(!C)return false;AC=new C();
    var n=AC.sampleRate*0.2,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;NB=b;}}
  if(AC.state==='suspended')AC.resume();
  return true;
}}
function tone(t,f,type,len,vol,drop){{
  var o=AC.createOscillator(),g=AC.createGain();o.type=type;
  o.frequency.setValueAtTime(f*(drop||1),t);if(drop)o.frequency.exponentialRampToValueAtTime(f,t+0.012);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
  o.connect(g);g.connect(out);o.start(t);o.stop(t+len+0.02);
}}
function noise(t,f,q,len,vol,type){{
  var s=AC.createBufferSource();s.buffer=NB;var fl=AC.createBiquadFilter();fl.type=type||'bandpass';fl.frequency.value=f;fl.Q.value=q;
  var g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0008,t+len);
  s.connect(fl);fl.connect(g);g.connect(out);s.start(t);s.stop(t+len+0.02);
}}
var out=null;
function hit(t,hand,acc,scale){{
  var r=hand==='R',v=(acc?1:0.5)*scale,k=+snd.value;
  var pan=AC.createStereoPanner?AC.createStereoPanner():null;
  out=AC.createGain();out.gain.value=1;
  if(pan){{pan.pan.value=r?0.2:-0.2;out.connect(pan);pan.connect(AC.destination);}}else{{out.connect(AC.destination);}}
  if(k===0){{tone(t,r?1500:1250,'sine',0.035,0.6*v);}}
  else if(k===1){{tone(t,r?900:750,'sine',0.07,0.8*v,1.2);}}
  else if(k===2){{tone(t,r?2500:2100,'sine',0.11,0.6*v);}}
  else if(k===3){{noise(t,r?2900:2300,4,0.045,1.4*v);tone(t,r?1900:1550,'sine',0.02,0.4*v);}}
  else{{noise(t,r?7500:5800,1.5,0.035,1.1*v);}}
}}
function metro(t,strong){{
  out=AC.createGain();out.gain.value=1;out.connect(AC.destination);
  tone(t,strong?660:440,'triangle',0.05,0.1);
}}
snd.addEventListener('change',function(){{
  try{{localStorage.setItem('rig.practice.sound',snd.value);}}catch(e){{}}
  if(!ensure())return;var t=AC.currentTime+0.03;hit(t,'R',true,1);hit(t+0.2,'L',true,1);
}});
function schedule(){{
  var P=D[cur].p,n=P.length,spb=D[cur].spb;
  while(next<AC.currentTime+0.12){{
    var dur=60/bpm.value/spb,i=step%n,s=P[i];
    var t=next+((spb===4&&i%2)?dur*(sw.value-50)/50:0);
    if(s){{
      hit(t,s.h,s.a,1);
      for(var k=0;k<s.g.length;k++)hit(t-0.035*(s.g.length-k),s.g[k],false,0.6);
    }}
    if(ck.checked&&i%spb===0)metro(next,i===0);
    queue.push({{t:t,i:i}});
    next+=dur;step++;
  }}
}}
function paint(){{
  var card=document.querySelector('.pr-card[data-id="'+cur+'"]');
  if(card){{
    while(queue.length&&queue[0].t<=AC.currentTime){{
      var q=queue.shift();
      var on=card.querySelector('.pr-c.on');if(on)on.classList.remove('on');
      card.querySelector('.pr-c[data-i="'+q.i+'"]').classList.add('on');
    }}
  }}
  raf=requestAnimationFrame(paint);
}}
function stop(){{
  if(timer){{clearInterval(timer);timer=null;}}
  if(raf){{cancelAnimationFrame(raf);raf=null;}}
  queue=[];
  document.querySelectorAll('.pr-c.on').forEach(function(e){{e.classList.remove('on');}});
  document.querySelectorAll('.pr-play').forEach(function(b){{b.textContent='Play';b.setAttribute('aria-pressed','false');}});
  cur=null;
}}
function play(id,btn){{
  if(!ensure())return;
  var was=cur;stop();
  if(was===id)return;
  cur=id;step=0;next=AC.currentTime+0.08;
  btn.textContent='Stop';btn.setAttribute('aria-pressed','true');
  timer=setInterval(schedule,25);schedule();raf=requestAnimationFrame(paint);
}}
document.querySelectorAll('.pr-card').forEach(function(card){{
  var b=card.querySelector('.pr-play');
  b.addEventListener('click',function(){{play(card.dataset.id,b);}});
}});
document.addEventListener('visibilitychange',function(){{if(document.hidden)stop();}});
}})();
</script>
'''
