/* The map: nodes float, attract each other a little, and are pulled home a little more.
   Children (nodes with .parent) are attracted to their parent rather than to the centre. */
(function(){
  const R=window.RIG, svg=document.getElementById('map'), NS='http://www.w3.org/2000/svg';
  const mk=(t,a,p)=>{ const e=document.createElementNS(NS,t); for(const k in a) e.setAttribute(k,a[k]); (p||svg).appendChild(e); return e; };
  const ZA=[-135,-45,45,135];
  let W=0,H=0,cx=0,cy=0,drag=null;

  const nodes=R.PAGES.map(p=>({...p,x:0,y:0,vx:0,vy:0,hx:0,hy:0,p1:Math.random()*6.28,p2:Math.random()*6.28}));
  // Build parent lookup
  const byId={}; nodes.forEach(n=>byId[n.id]=n);
  nodes.forEach(n=>{ if(n.parent) n.parentNode=byId[n.parent]; });

  [0,1,2,3].forEach(z=>{
    const list=nodes.filter(n=>n.z===z), k=list.length, span=k>4?70:54;
    list.forEach((n,i)=>{ n.a=(ZA[z]+(k===1?0:(i/(k-1)-.5)*span))*Math.PI/180; n.f=i%2?.96:.6; n.i=i; });
  });
  // Children sit further out
  nodes.forEach(n=>{ if(n.parentNode) n.f=Math.max(n.f,1.08); });

  const gE=mk('g',{}), gZ=mk('g',{}), gN=mk('g',{});
  const zl=R.ZONES.map(t=>{ const e=mk('text',{class:'zl','text-anchor':'middle'},gZ); e.textContent=t; return e; });
  nodes.forEach(n=>{
    // Non-children get an edge to centre; children get a parent edge
    if(!n.parentNode){
      n.e=mk('line',{class:'e'},gE);
    } else {
      n.e=mk('line',{class:'e parent'},gE);
    }
    n.el=mk('a',{href:n.id+'.html','aria-label':n.t},gN);
    mk('circle',{class:'hit',r:22},n.el);
    n.c=mk('circle',{r:9},n.el);
    n.tx=mk('text',{dy:'.35em'},n.el); n.tx.textContent=n.t;
  });
  const zEdges=[];
  [0,1,2,3].forEach(z=>{ const l=nodes.filter(n=>n.z===z&&!n.parentNode); for(let i=0;i<l.length-1;i++) zEdges.push({a:l[i],b:l[i+1],e:mk('line',{class:'e z'},gE)}); });
  const me=mk('g',{class:'me',tabindex:0,role:'button','aria-label':'This rig. Scatter the map.'});
  mk('circle',{class:'pulse',r:26},me); mk('circle',{r:26},me);
  const meT=mk('text',{'text-anchor':'middle',y:52},me); meT.textContent='This rig';

  function layout(first){
    W=innerWidth; H=innerHeight; cx=W/2; cy=H/2;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    const rx=Math.min(W*.4,560), ry=Math.min(H*.39,400);
    nodes.forEach(n=>{ n.hx=cx+rx*n.f*Math.cos(n.a); n.hy=cy+ry*n.f*Math.sin(n.a);
      if(first){ n.x=cx+(Math.random()-.5)*8; n.y=cy+(Math.random()-.5)*8; } });
    zl.forEach((e,z)=>{ const a=ZA[z]*Math.PI/180; e.setAttribute('x',cx+rx*1.12*Math.cos(a)); e.setAttribute('y',cy+ry*1.2*Math.sin(a)+(a>0?10:0)); });
    me.setAttribute('transform','translate('+cx+' '+cy+')');
  }

  function tick(t){
    for(const n of nodes){
      if(drag&&drag.n===n) continue;
      let fx=(n.hx-n.x)*.014, fy=(n.hy-n.y)*.014;
      // Children: extra attraction toward parent
      if(n.parentNode){
        const pn=n.parentNode;
        const dx=pn.x-n.x, dy=pn.y-n.y;
        const d=Math.max(Math.hypot(dx,dy),1);
        fx+=dx/d*.15; fy+=dy/d*.15;
        if(d<50){ const f=(50-d)*.03; fx-=dx/d*f; fy-=dy/d*f; }
      }
      for(const o of nodes){
        if(o===n) continue;
        const dx=o.x-n.x, dy=o.y-n.y, d=Math.max(Math.hypot(dx,dy),1);
        if(d<64){ const f=(64-d)*.035; fx-=dx/d*f; fy-=dy/d*f; }
        else{ const f=(drag&&drag.n===o?150:16)/d; fx+=dx/d*f*.06; fy+=dy/d*f*.06; }
      }
      // Centre exclusion only for non-children
      if(!n.parentNode){
        const dx=n.x-cx, dy=n.y-cy, d=Math.max(Math.hypot(dx,dy),1);
        if(d<90){ const f=(90-d)*.04; fx+=dx/d*f; fy+=dy/d*f; }
      }
      if(!R.reduce){ fx+=Math.sin(t*.0006+n.p1)*.03; fy+=Math.cos(t*.0005+n.p2)*.03; }
      n.vx=(n.vx+fx)*.9; n.vy=(n.vy+fy)*.9; n.x+=n.vx; n.y+=n.vy;
    }
    for(const n of nodes){
      n.el.setAttribute('transform','translate('+n.x.toFixed(1)+' '+n.y.toFixed(1)+')');
      const right=n.x>=cx;
      n.tx.setAttribute('x',right?17:-17); n.tx.setAttribute('text-anchor',right?'start':'end');
      if(n.parentNode){
        n.e.setAttribute('x1',n.parentNode.x); n.e.setAttribute('y1',n.parentNode.y);
      } else {
        n.e.setAttribute('x1',cx); n.e.setAttribute('y1',cy);
      }
      n.e.setAttribute('x2',n.x); n.e.setAttribute('y2',n.y);
    }
    for(const z of zEdges){ z.e.setAttribute('x1',z.a.x); z.e.setAttribute('y1',z.a.y); z.e.setAttribute('x2',z.b.x); z.e.setAttribute('y2',z.b.y); }
    requestAnimationFrame(tick);
  }

  function pt(e){ const r=svg.getBoundingClientRect(); return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}; }
  function enter(n){
    const r=n.c.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
    if(!R.reduce){ svg.style.transformOrigin=x+'px '+y+'px'; svg.style.transform='scale(5)'; }
    R.go(n.id+'.html',x,y,false);
  }
  nodes.forEach(n=>{
    n.el.addEventListener('pointerdown',e=>{
      if(e.button) return; e.preventDefault();
      const p=pt(e); drag={n,ox:n.x-p.x,oy:n.y-p.y,sx:e.clientX,sy:e.clientY,moved:false,lx:p.x,ly:p.y};
      n.el.setPointerCapture(e.pointerId); n.el.classList.add('drag');
    });
    n.el.addEventListener('pointermove',e=>{
      if(!drag||drag.n!==n) return;
      const p=pt(e);
      if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>5) drag.moved=true;
      n.vx=(p.x-drag.lx)*.6; n.vy=(p.y-drag.ly)*.6; drag.lx=p.x; drag.ly=p.y;
      n.x=p.x+drag.ox; n.y=p.y+drag.oy;
    });
    const end=e=>{
      if(!drag||drag.n!==n) return;
      const moved=drag.moved; drag=null; n.el.classList.remove('drag');
      if(!moved&&e.type==='pointerup') enter(n);
    };
    n.el.addEventListener('pointerup',end); n.el.addEventListener('pointercancel',end);
    n.el.addEventListener('click',e=>e.preventDefault());
    n.el.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); enter(n); } });
    n.el.addEventListener('dragstart',e=>e.preventDefault());
  });
  function scatter(){ nodes.forEach(n=>{ const a=Math.atan2(n.y-cy,n.x-cx)+(Math.random()-.5), s=10+Math.random()*14; n.vx+=Math.cos(a)*s; n.vy+=Math.sin(a)*s; }); }
  me.addEventListener('click',scatter);
  me.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); scatter(); } });

  addEventListener('resize',()=>layout(false));
  layout(true);
  let from=null; try{ from=sessionStorage.getItem('rig.from'); sessionStorage.removeItem('rig.from'); }catch(e){}
  if(from==='dot'&&!R.reduce){
    const d=document.createElement('div'); d.className='iris acc'; d.style.clipPath='circle(150vmax at '+cx+'px '+cy+'px)'; document.body.appendChild(d);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ d.style.clipPath='circle(26px at '+cx+'px '+cy+'px)'; }));
    setTimeout(()=>d.remove(),640);
  }
  addEventListener('pageshow',e=>{ if(e.persisted){ svg.style.transform=''; } });
  requestAnimationFrame(tick);
})();
