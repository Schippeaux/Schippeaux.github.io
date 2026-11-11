/* Shared runtime: settings, zoom, page chrome, transitions, builds. */
(function(){
  const V = window.RIG_VERSION || {version:'0.0.0',date:''};
  const here = new URL('.', document.currentScript.src).href;
  const archived = /\/builds\/[^/]+\/$/.test(here);
  const rootUrl = archived ? new URL('../../', here).href : here;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const get = (k,d)=>{ try{ const r=localStorage.getItem(k); return r==null?d:JSON.parse(r); }catch(e){ return d; } };
  const put = (k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };

  // zones: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left
  const ZONES = ['Instruments','System','Project','Living system'];
  const PAGES = [
    {id:'arrangement',t:'Arrangement',z:0},
    {id:'gear',t:'Gear List',z:0,parent:'arrangement'},
    {id:'hookup',t:'Hook-up',z:0,parent:'arrangement'},
    {id:'synth',t:'Synth',z:0,parent:'hookup'},
    {id:'bass',t:'Bass',z:0,parent:'hookup'},
    {id:'percussion',t:'Percussion',z:0,parent:'hookup'},
    {id:'midi',t:'MIDI Controllers',z:0,parent:'hookup'},
    {id:'routing',t:'Routing',z:1},
    {id:'looping',t:'Looping',z:1,parent:'routing'},
    {id:'clock',t:'Clock',z:1,parent:'routing'},
    {id:'expression',t:'Expression',z:1,parent:'routing'},
    {id:'chemistry',t:'Chemistry',z:1,parent:'routing'},
    {id:'template',t:'Set Template',z:1,parent:'routing'},
    {id:'concept',t:'Concept',z:3},
    {id:'influences',t:'Influences',z:3,parent:'concept'},
    {id:'name',t:'Name?',z:3,parent:'concept'},
    {id:'research',t:'Research',z:3,parent:'concept'},
    {id:'sources',t:'Sources',z:3,parent:'research'},
    {id:'decisions',t:'Open Decisions',z:3,parent:'concept'},
    {id:'roadmap',t:'Roadmap',z:2}
  ];

  /* ---- appearance settings ---- */
  const KEY='rig.settings.v1';
  const defaults={theme:'light',accent:'#ff4d00',fontHead:"'Archivo',system-ui,sans-serif",fontBody:"'IBM Plex Sans',system-ui,sans-serif",fs:16,measure:72,radius:0};
  let s={...defaults,...get(KEY,{})};
  let zoom=get('rig.zoom',1);
  function apply(){
    root.dataset.theme=s.theme;
    root.style.setProperty('--accent',s.accent);
    root.style.setProperty('--font-head',s.fontHead);
    root.style.setProperty('--font-body',s.fontBody);
    root.style.setProperty('--fs',s.fs+'px');
    root.style.setProperty('--measure',s.measure+'ch');
    root.style.setProperty('--radius',s.radius+'px');
    root.style.setProperty('--zoom',document.body && document.body.classList.contains('map')?1:zoom);
    const o=$('zoomOut'); if(o) o.textContent=Math.round(zoom*100)+'%';
    if($('themeSeg')) syncForm();
  }
  function save(){ put(KEY,s); apply(); }
  function setZoom(z){ zoom=Math.min(2.4,Math.max(.6,Math.round(z*10)/10)); put('rig.zoom',zoom); apply(); }

  /* ---- transitions ---- */
  function iris(x,y,accent,grow,done){
    const d=document.createElement('div'); d.className='iris'+(accent?' acc':'');
    const big='circle(150vmax at '+x+'px '+y+'px)', small='circle(0px at '+x+'px '+y+'px)';
    d.style.clipPath=grow?small:big; document.body.appendChild(d);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ d.style.clipPath=grow?big:small; }));
    setTimeout(()=>{ done&&done(d); },620);
    return d;
  }
  function go(href,x,y,accent){
    if(reduce){ location.href=href; return; }
    try{ sessionStorage.setItem('rig.from',accent?'dot':'node'); }catch(e){}
    iris(x,y,accent,true,()=>{ location.href=href; });
  }
  window.addEventListener('pageshow',e=>{ if(e.persisted) document.querySelectorAll('.iris').forEach(n=>n.remove()); });

  window.RIG={V,PAGES,ZONES,go,iris,reduce,get,put,rootUrl,archived};

  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    const id=document.body.dataset.page;
    if(id) chrome(id);
    if(archived){
      const b=document.createElement('div'); b.className='archived';
      b.innerHTML='Archived build v'+V.version+' · <a href="'+rootUrl+'index.html">Go to current</a>';
      document.body.appendChild(b);
    }
    document.querySelectorAll('[data-ver]').forEach(n=>n.textContent='v'+V.version);
    if($('themeSeg')) settingsPage();
    if($('names')) namesPage();
    tasks();
  });

  /* ---- chrome on content pages ---- */
  function chrome(id){
    const i=PAGES.findIndex(p=>p.id===id), p=i>=0?PAGES[i]:null;
    const bar=document.createElement('header'); bar.className='bar';
    const crumb=p?ZONES[p.z]+' / '+String(i+1).padStart(2,'0')+' of '+PAGES.length:'Settings';
    bar.innerHTML='<a class="home" href="index.html" aria-label="Back to the map"><span class="dot"></span><span>Rig</span></a>'+
      '<span class="crumb">'+crumb+'</span>'+
      '<div class="tools"><button id="zm" aria-label="Zoom out">−</button><output id="zoomOut"></output><button id="zp" aria-label="Zoom in">+</button>'+
      (id==='settings'?'':'<a href="settings.html">⚙</a>')+'</div>';
    document.body.prepend(bar);
    $('zm').onclick=()=>setZoom(zoom-.1); $('zp').onclick=()=>setZoom(zoom+.1);
    $('zoomOut').onclick=()=>setZoom(1); $('zoomOut').title='Reset zoom'; $('zoomOut').style.cursor='pointer';
    bar.querySelector('.home').addEventListener('click',e=>{
      if(e.metaKey||e.ctrlKey||e.shiftKey) return; e.preventDefault();
      const r=e.currentTarget.querySelector('.dot').getBoundingClientRect();
      go('index.html',r.left+r.width/2,r.top+r.height/2,true);
    });
    addEventListener('keydown',e=>{
      if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey) return;
      if(e.key==='+'||e.key==='=') setZoom(zoom+.1); else if(e.key==='-') setZoom(zoom-.1); else if(e.key==='0') setZoom(1);
      else if(e.key==='Escape') bar.querySelector('.home').click();
    });
    addEventListener('wheel',e=>{ if(e.ctrlKey){ e.preventDefault(); setZoom(zoom+(e.deltaY<0?.1:-.1)); } },{passive:false});
    if(p){
      const main=document.querySelector('main');
      const a=PAGES[(i-1+PAGES.length)%PAGES.length], b=PAGES[(i+1)%PAGES.length];
      const pn=document.createElement('nav'); pn.className='pn'; pn.setAttribute('aria-label','Previous and next page');
      pn.innerHTML='<a href="'+a.id+'.html"><small>Previous</small>'+a.t+'</a><a href="'+b.id+'.html"><small>Next</small>'+b.t+'</a>';
      main.appendChild(pn);
    }
    apply();
  }

  /* ---- checklists persist ---- */
  function tasks(){
    const st=get('rig.tasks',{});
    document.querySelectorAll('.tasks input[type=checkbox]').forEach(c=>{
      c.checked=!!st[c.id];
      c.addEventListener('change',()=>{ st[c.id]=c.checked; put('rig.tasks',st); });
    });
  }

  /* ---- name candidates ---- */
  function namesPage(){
    const base=['The Rig','Colonel Cluster','Zookeeper','Mind Hive'];
    let mine=get('rig.names',[]), fav=get('rig.nameFav','');
    const ul=$('names');
    function draw(){
      ul.innerHTML='';
      base.concat(mine).forEach(n=>{
        const li=document.createElement('li'); if(n===fav) li.className='fav';
        const sp=document.createElement('span'); sp.className='nm'; sp.textContent=n; li.appendChild(sp);
        const f=document.createElement('button'); f.textContent=n===fav?'Front-runner':'Pick'; f.setAttribute('aria-pressed',String(n===fav));
        f.onclick=()=>{ fav=(fav===n?'':n); put('rig.nameFav',fav); draw(); }; li.appendChild(f);
        if(mine.includes(n)){ const x=document.createElement('button'); x.textContent='Remove'; x.onclick=()=>{ mine=mine.filter(m=>m!==n); put('rig.names',mine); draw(); }; li.appendChild(x); }
        ul.appendChild(li);
      });
    }
    $('nameForm').addEventListener('submit',e=>{
      e.preventDefault(); const v=$('nameIn').value.trim();
      if(!v){ $('nameMsg').textContent='Type a name first.'; return; }
      if(base.concat(mine).some(n=>n.toLowerCase()===v.toLowerCase())){ $('nameMsg').textContent='That one is already on the list.'; return; }
      mine.push(v); put('rig.names',mine); $('nameIn').value=''; $('nameMsg').textContent=''; draw();
    });
    draw();
  }

  /* ---- settings page ---- */
  function syncForm(){
    document.querySelectorAll('#themeSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===s.theme)));
    $('accent').value=s.accent; $('accentHex').textContent=s.accent;
    $('fontHead').value=s.fontHead; $('fontBody').value=s.fontBody;
    $('fs').value=s.fs; $('fsVal').textContent=s.fs+'px';
    $('radius').value=s.radius; $('radiusVal').textContent=s.radius+'px';
  }
  function settingsPage(){
    document.querySelectorAll('#themeSeg button').forEach(b=>b.addEventListener('click',()=>{s.theme=b.dataset.v;save();}));
    $('accent').addEventListener('input',e=>{s.accent=e.target.value;save();});
    document.querySelectorAll('.sw button').forEach(b=>b.addEventListener('click',()=>{s.accent=b.dataset.c;save();}));
    $('fontHead').addEventListener('change',e=>{s.fontHead=e.target.value;save();});
    $('fontBody').addEventListener('change',e=>{s.fontBody=e.target.value;save();});
    $('fs').addEventListener('input',e=>{s.fs=+e.target.value;save();});
    $('radius').addEventListener('input',e=>{s.radius=+e.target.value;save();});
    $('resetBtn').addEventListener('click',()=>{s={...defaults};setZoom(1);save();});
    $('verNum').textContent='v'+V.version; $('verDate').textContent='Released '+V.date+(archived?' (archived build)':'');
    $('checkBtn').addEventListener('click',async()=>{
      const st=$('verStatus'); st.textContent='Checking…';
      try{
        const r=await fetch(rootUrl+'version.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) throw 0;
        const j=await r.json();
        st.textContent = j.version===V.version ? 'You have the latest version ('+j.version+').'
          : 'Version '+j.version+' is the current build (this is '+V.version+'). '+(archived?'Use "Go to current".':'Use Hard refresh to load it.');
      }catch(e){ st.textContent='Could not reach version.json. Opened as a local file, that is expected.'; }
    });
    $('refreshBtn').addEventListener('click',async()=>{
      try{ if('caches' in window){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(e){}
      try{ if(navigator.serviceWorker){ const rs=await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r=>r.unregister())); } }catch(e){}
      const u=new URL(location.href); u.searchParams.set('r',Date.now()); location.replace(u.toString());
    });
    const ul=$('builds');
    fetch(rootUrl+'builds/builds.json?t='+Date.now(),{cache:'no-store'}).then(r=>{ if(!r.ok) throw 0; return r.json(); }).then(list=>{
      ul.innerHTML='';
      list.slice().reverse().forEach(b=>{
        const li=document.createElement('li'); if(b.version===V.version) li.className='cur';
        const a=document.createElement('a'); a.href=rootUrl+b.path; a.textContent='v'+b.version;
        const d=document.createElement('span'); d.className='d'; d.textContent=b.date;
        const n=document.createElement('span'); n.textContent=b.notes;
        li.append(a,d,n); ul.appendChild(li);
      });
    }).catch(()=>{ ul.innerHTML='<li style="display:block">Could not load the build list. Opened as a local file, that is expected; it works once hosted.</li>'; });
  }
})();
