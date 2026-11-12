"""Practice page for the rig site: rudiment ladder, three playable patterns, and the .mid files.

One pattern table feeds both the page player and the generated MIDI files, so they cannot drift apart.
Notation: R/L = hand. Capital = accent, lowercase = normal, '.' = rest. 16 characters = one bar of 16th notes.
"""
import html
import json
import os
import struct

SNARE = 38          # General MIDI acoustic snare, both hands
PPQ = 480
ACCENT, NORMAL = 112, 72

PLAYABLE = [
    {"id": "single-stroke-roll", "name": "Single stroke roll", "steps": "RlrlRlrlRlrlRlrl",
     "bpm": 70, "how": "Hands alternate, right leads every beat. Make the lowercase notes match each other in volume and height."},
    {"id": "double-stroke-roll", "name": "Double stroke roll", "steps": "RrLlRrLlRrLlRrLl",
     "bpm": 60, "how": "Two notes per hand. The second of each pair is a rebound, not a second hit. Let the stick bounce."},
    {"id": "single-paradiddle", "name": "Single paradiddle", "steps": "RlrrLrllRlrrLrll",
     "bpm": 60, "how": "Right-left-right-right, then left-right-left-left. The accent always lands on the lead hand, so it swaps sides every beat."},
]

# (level title, move-on rule, items). Items: (name, text, tip, playable id or None)
LADDER = [
    ("Level 1: Foundations", "Alternating hands, one accent per beat. Move on when you can play each for a full minute with an even sound at 70 BPM.", [
        ("Single strokes, 8th notes", "|: R.l. R.l. :|", "Count 1 and 2 and. Just alternate.", None),
        ("Single stroke roll, 16ths", "Rlrl Rlrl Rlrl Rlrl", "Playable below.", "single-stroke-roll"),
        ("Double stroke roll, 16ths", "RrLl RrLl RrLl RrLl", "Playable below.", "double-stroke-roll"),
        ("Single paradiddle", "Rlrr Lrll Rlrr Lrll", "Playable below.", "single-paradiddle"),
    ]),
    ("Level 2: Triplets and flams", "Three notes per beat, and the first grace notes. Move on when triplets stay even and flams sound like one fat note.", [
        ("Single stroke triplets", "|: Rlr Lrl :|", "Three letters per beat (triplet grid). The lead hand swaps every beat.", None),
        ("Flam", "|: (l)R... (r)L... :|", "(l)R is a quiet left grace note just before an accented right. Low stick for the grace, high stick for the main note.", None),
        ("Flam tap", "|: (l)R R (r)L L :|", "A flam, then a tap on the same hand, then swap.", None),
    ]),
    ("Level 3: Rolls", "Longer runs of doubles that end on an accent. Move on when the last note of each roll lands on the beat.", [
        ("Five stroke roll", "|: RrLl R... LlRr L... :|", "Two doubles and a single. The single lands on beat 2 and beat 4.", None),
        ("Seven stroke roll", "|: RrLl RrL. LlRr LlR. :|", "Same idea, one more double.", None),
        ("Nine stroke roll", "|: RrLl RrLl R... LlRr LlRr L... :|", "Each roll takes three beats, so the full pattern is six beats and the lead hand swaps halfway.", None),
        ("Triple stroke roll", "|: Rrr Lll :|", "Triplet grid. Three notes per hand.", None),
    ]),
    ("Level 4: Drags and flam combinations", "Two grace notes, and flams joined to other patterns. Move on when the grace notes are quiet and the accents are clear.", [
        ("Single drag tap", "|: (ll)R l (rr)L r :|", "Two quick grace notes (a drag) before the accent, then a tap with the other hand.", None),
        ("Flam accent", "|: (l)R l r (r)L r l :|", "Triplet grid. The flam is on beat one of each group.", None),
        ("Flam paradiddle", "|: (l)R l r r (r)L r l l :|", "A paradiddle with a flam on the lead note.", None),
    ]),
    ("Level 5: Long combinations", "Longer sticking patterns and moving accents. Move on when you can start any of them on either hand.", [
        ("Double paradiddle", "|: Rlrlrr Lrlrll :|", "Six notes per half, played as a triplet feel.", None),
        ("Paradiddle-diddle", "|: Rlrrll Lrllrr :|", "Six notes per half. A common one for fills and ride patterns.", None),
        ("Triple paradiddle", "|: Rlrlrlrr Lrlrlrll :|", "Eight notes per half, played as 16ths over two beats.", None),
        ("Flam paradiddle-diddle", "|: (l)R l r r l l (r)L r l l r r :|", "A paradiddle-diddle with a flam on the lead note.", None),
        ("Paradiddle accent displacement", "|: Rlrr Lrll :|  |: rLrr lRll :|  |: rlRr lrLl :|  |: rlrR lrlL :|", "Same sticking, accent moved through all four positions.", None),
    ]),
]


def fmt(steps):
    return " ".join(steps[i:i + 4] for i in range(0, 16, 4))


def _vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


def make_mid(p, bpm=80):
    """Type 0 SMF, one 4/4 bar, channel 10, ready to drop on a 1-bar loop."""
    step = PPQ // 4
    events = []
    for i, c in enumerate(p["steps"]):
        if c == ".":
            continue
        t = i * step
        events.append((t, 1, 0x99, SNARE, ACCENT if c.isupper() else NORMAL))
        events.append((t + step - 20, 0, 0x89, SNARE, 0))
    events.sort(key=lambda e: (e[0], e[1]))
    name = p["name"].encode()
    trk = bytearray()
    trk += _vlq(0) + b"\xff\x03" + _vlq(len(name)) + name
    trk += _vlq(0) + b"\xff\x51\x03" + struct.pack(">I", 60_000_000 // bpm)[1:]
    trk += _vlq(0) + b"\xff\x58\x04\x04\x02\x18\x08"
    now = 0
    for t, _, status, note, vel in events:
        trk += _vlq(t - now) + bytes([status, note, vel])
        now = t
    trk += _vlq(4 * PPQ - now) + b"\xff\x2f\x00"
    return b"MThd" + struct.pack(">IHHH", 6, 0, 1, PPQ) + b"MTrk" + struct.pack(">I", len(trk)) + bytes(trk)


def write_midi(rig_dir):
    out = os.path.join(rig_dir, "practice")
    os.makedirs(out, exist_ok=True)
    for p in PLAYABLE:
        with open(os.path.join(out, p["id"] + ".mid"), "wb") as f:
            f.write(make_mid(p))


def practice(hero, detail):
    cards = []
    for p in PLAYABLE:
        cells = "".join(
            f'<span class="pr-c{" a" if c.isupper() else ""}{" r" if c == "." else ""}" data-i="{i}">{"" if c == "." else c}</span>'
            for i, c in enumerate(p["steps"]))
        cards.append(f'''<article class="pr-card" data-id="{p["id"]}">
<div class="pr-head"><h3>{html.escape(p["name"])}</h3><span class="pr-tag">Level 1</span></div>
<p class="pr-txt">{fmt(p["steps"])}</p>
<div class="pr-grid" aria-hidden="true">{cells}</div>
<p class="sm">{html.escape(p["how"])}</p>
<div class="pr-act"><button type="button" class="pr-play" aria-pressed="false">Play</button>
<a class="pr-dl" href="practice/{p["id"]}.mid" download>Download .mid</a></div>
</article>''')

    ladder = []
    for title, rule, items in LADDER:
        rows = "".join(
            f'<tr><td>{name}</td><td class="mono">{html.escape(t)}</td><td>{html.escape(tip)}{" <b>Playable.</b>" if pid else ""}</td></tr>'
            for (name, t, tip, pid) in items)
        ladder.append(detail(title, f'<p class="sm">{html.escape(rule)}</p><div class="tw"><table><thead><tr><th>Pattern</th><th>Notation</th><th>Notes</th></tr></thead><tbody>{rows}</tbody></table></div>',
                             f"{len(items)} patterns"))

    data = json.dumps({"patterns": {p["id"]: p["steps"] for p in PLAYABLE}, "bpm": {p["id"]: p["bpm"] for p in PLAYABLE}})

    return hero("Practice", "Learn the hands first. Repeat until it stops being a decision. The synths and effects come after.",
        meta='<div><b>Status</b>Draft: three patterns playable, rest listed</div><div><b>Level</b>Beginner, hands only (L and R)</div><div><b>Part of</b><a href="template.html">Set Template</a></div>') + f'''
<div class="row"><h2>How to read the notation</h2>
<div class="b8">
<p class="lg">Sixteen letters make one bar. Each group of four is one beat.</p>
<ul class="pr-key">
<li><b class="mono">R</b> and <b class="mono">L</b> are right and left hand. <b>Capital</b> letters are accents, <b>lowercase</b> are normal notes.</li>
<li><b class="mono">.</b> is a rest.</li>
<li><b class="mono">(l)R</b> is a flam: a quiet left grace note just before an accented right.</li>
<li><b class="mono">|: ... :|</b> means repeat. Patterns marked as triplets have three letters per beat.</li>
</ul>
<p class="sm">Example: <span class="mono">Rlrr Lrll</span> is a single paradiddle, and the capitals show the accent landing on the lead hand.</p>
</div></div>

<div class="row"><h2>Three to review</h2>
<div class="b12">
<p class="lg">Press play. They loop until you stop them.</p>
<div class="pr-bar" role="group" aria-label="Playback controls">
<label>Tempo <input type="range" id="prBpm" min="40" max="140" step="1" value="60"> <b id="prBpmV" class="mono">60</b> BPM</label>
<label>Swing <input type="range" id="prSwing" min="50" max="75" step="1" value="50"> <b id="prSwingV" class="mono">50</b>%</label>
<label class="pr-chk"><input type="checkbox" id="prClick" checked> Click</label>
</div>
<div class="pr-cards">{"".join(cards)}</div>
<p class="sm">Swing delays every second 16th note: 50% is straight, about 67% is a triplet feel, 75% is very late. Leave it at 50% while learning the sticking, then use it to hear the same pattern in a jazz feel. It affects playback here only. The downloaded .mid files are straight; in Live you add swing by dropping a groove from the Groove Pool onto the clip.</p>
<p class="sm">The sound is a simple synthesised snare so you can check timing and sticking. The right hand sits a little higher in pitch than the left to make the sticking audible. In the .mid files both hands use the same snare note (General MIDI 38), so any Drum Rack snare will play them. Accents are velocity 112, normal notes 72.</p>
</div></div>

<div class="row"><h2>The ladder, easy to hard</h2>
<div class="b8">
<p class="lg">Nineteen patterns in five levels, written as text. The next step is to turn each into a .mid file and a player once the first three feel right.</p>
{"".join(ladder)}
<p class="sm">This is a starter list built from the standard rudiments. The full set of 40 comes later, with the same notation.</p>
</div></div>

<div class="row"><h2>A session</h2>
<div class="b8">
<ol class="pr-steps">
<li><b>Warm up, 3 minutes.</b> Single stroke roll at a tempo that feels easy.</li>
<li><b>One new pattern, 10 minutes.</b> Slow, with the click, until three passes in a row are even.</li>
<li><b>One review pattern, 5 minutes.</b> Something from last session, a little faster.</li>
<li><b>Play, 2 minutes.</b> No click. Mix anything you know.</li>
</ol>
<p class="sm">A common rule is to raise the tempo by about 4 BPM only after a few clean passes. The aim is the same pattern, repeated until your hands do it without you.</p>
<p class="sm">In the Ableton set these loops would sit in a practice scene, played by the stand-in Drum Rack. Once the hands are there, synth layers and effects are added on top and the loops become the environments from the <a href="template.html">Set Template</a>.</p>
</div></div>

<script>
(function(){{
var D={data};
var AC=null,timer=null,raf=null,cur=null,step=0,next=0,queue=[];
var $=function(id){{return document.getElementById(id);}};
var bpm=$('prBpm'),sw=$('prSwing'),ck=$('prClick');
function lab(){{$('prBpmV').textContent=bpm.value;$('prSwingV').textContent=sw.value;}}
bpm.addEventListener('input',lab);sw.addEventListener('input',lab);lab();
function noiseBuf(){{var n=AC.sampleRate*0.2,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;return b;}}
var NB=null;
function snare(t,acc,right){{
  var g=AC.createGain(),pan=AC.createStereoPanner?AC.createStereoPanner():null;
  var v=acc?1:0.5;
  var s=AC.createBufferSource();s.buffer=NB;
  var hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=1500;
  var ng=AC.createGain();ng.gain.setValueAtTime(0.7*v,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.14);
  s.connect(hp);hp.connect(ng);ng.connect(g);
  var o=AC.createOscillator();o.type='triangle';
  var f=right?210:175;o.frequency.setValueAtTime(f*1.4,t);o.frequency.exponentialRampToValueAtTime(f,t+0.05);
  var og=AC.createGain();og.gain.setValueAtTime(0.6*v,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.12);
  o.connect(og);og.connect(g);
  if(pan){{pan.pan.value=right?0.25:-0.25;g.connect(pan);pan.connect(AC.destination);}}else{{g.connect(AC.destination);}}
  s.start(t);s.stop(t+0.2);o.start(t);o.stop(t+0.2);
}}
function click(t,strong){{
  var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=strong?1600:1100;
  g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.04);
  o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+0.05);
}}
function schedule(){{
  var pat=D.patterns[cur];
  while(next<AC.currentTime+0.12){{
    var dur=60/bpm.value/4,i=step%16,c=pat.charAt(i);
    var t=next+((i%2)?dur*(sw.value-50)/50:0);
    if(c!=='.')snare(t,c===c.toUpperCase(),c.toUpperCase()==='R');
    if(ck.checked&&i%4===0)click(next,i===0);
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
  if(!AC){{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;AC=new C();NB=noiseBuf();}}
  if(AC.state==='suspended')AC.resume();
  var was=cur;stop();
  if(was===id)return;
  cur=id;bpm.value=D.bpm[id];lab();
  step=0;next=AC.currentTime+0.08;
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
