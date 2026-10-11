/* Nigeria Boarding School Simulation — Unity Heights
 * A browser-based, third-person school-life prototype built with Three.js.
 * All original gameplay, architecture and character assembly is local code.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => a + Math.random() * (b - a);
  const choose = (a) => a[Math.floor(Math.random() * a.length)];
  const SAVE_KEY = 'unity-heights-save-v1';
  const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const MATERIALS = {};
  let running = false, paused = false, gameStarted = false;
  let currentDialogue = null, activeRoom = null, interiorGroup = null;
  let currentTarget = null, toastTimer = null, noticeTimer = null, simClock = 6 * 60 + 30;
  let dayNumber = 1, currentDay = 0, frameLast = 0, mapLast = 0, yaw = 0, playerMoving = false;
  let savedOutsidePosition = {x:0,z:23};
  let worldGroup, playerGroup, renderer, scene, camera, clock, hemiLight, sunLight, aerialLabelsGroup;
  let aerialMode=false, aerialHeight=112, currentMiniGame=null, miniGameTimer=null;
  let cameraPitch = 0;
  const worldNPCs = [], interiorNPCs = [], buildings = [], sleepSpots = [], studySpots = [], sitSpots = [], allProps = [];
  let playerPosture = null, postureTimer = null;
  let interiorObstacles = []; // local collision boxes for desks, beds, lockers and fixed furniture
  const keyState = Object.create(null), mouseState = {down:false,x:0,y:0,drag:false};
  const roomNames = {
    math:'Mathematics Classroom', english:'English Classroom', science:'Science Laboratory',
    assembly:'Assembly Hall', hostel:'Blue House Hostel', dining:'Dining Hall',
    library:'School Library', principal:'Principal’s Office', clinic:'School Clinic',
    staffSchool:'Staff School', greatHall:'Great Hall', shop:'Campus Shop', greenHostel:'Green House Hostel',
    mosque:'Quiet Prayer Hall', artRoom:'Arts & Culture Room', ict:'ICT & Physics Lab', printShop:'Printing Press', workshop:'Production Workshop'
  };
  const roomBlurb = {
    math:'Numbers, algebra and the occasional teacher who says “this one is simple.”',
    english:'Literature, grammar, comprehension and big words before lunch.',
    science:'Experiments, labelled diagrams and strict rules around the lab benches.',
    assembly:'Announcements, school songs, house points and Monday morning speeches.',
    hostel:'Your bunk, your locker, midnight gist and the sound of a distant generator.',
    dining:'Long benches, metal trays, generous portions and serious debate about the menu.',
    library:'Quiet corners, exam guides, old atlases and the best place to focus.',
    principal:'A neat office, the school seal, registers and a principal who hears everything.',
    clinic:'A calm little sick bay for rest, first aid and a check-in with the nurse.',
    staffSchool:'A lively junior school block beside the main campus road.',
    greatHall:'The big hall for prize-giving, debate finals, drama and inter-house events.',
    shop:'Cold drinks, biscuits, exercise books, pens and the small things every boarder forgets.',
    greenHostel:'A second hostel block with lockers, bunks and its own house notice board.',
    mosque:'A quiet campus prayer and reflection space. Everyone is expected to be respectful.',
    artRoom:'Paint, music, school play rehearsals and handmade decorations for inter-house day.',
    ict:'Computer practicals, physics equipment and careful lab work.',
    printShop:'School magazines, examination papers, posters and the smell of fresh paper.',
    workshop:'Practical projects, repairs and supervised hands-on learning.'
  };
  const schedule = [
    {at:6*60, name:'Wake up & hostel duties', place:'Blue House Hostel', room:'hostel'},
    {at:7*60, name:'Breakfast', place:'Dining Hall', room:'dining'},
    {at:8*60, name:'Morning assembly', place:'Assembly Hall', room:'assembly'},
    {at:8*60+30, name:'Mathematics', place:'Mathematics Classroom', room:'math'},
    {at:9*60+30, name:'English Language', place:'English Classroom', room:'english'},
    {at:10*60+30, name:'Break time', place:'Main Courtyard', room:'courtyard'},
    {at:11*60, name:'Basic Science', place:'Science Laboratory', room:'science'},
    {at:12*60+30, name:'Lunch', place:'Dining Hall', room:'dining'},
    {at:13*60+30, name:'Quiet reading / prep', place:'School Library', room:'library'},
    {at:15*60, name:'Games & house practice', place:'Sports Field', room:'field'},
    {at:17*60+30, name:'Evening meal', place:'Dining Hall', room:'dining'},
    {at:19*60, name:'Prep & revision', place:'School Library', room:'library'},
    {at:21*60+30, name:'Lights out', place:'Blue House Hostel', room:'hostel'}
  ];
  const quests = [
    {id:'ada', title:'Say hello to Adaeze', detail:'Meet a student in the courtyard.', done:false},
    {id:'prefect', title:'Meet your house prefect', detail:'Find someone who knows hostel life.', done:false},
    {id:'lesson', title:'Attend your first lesson', detail:'Speak to a teacher in any classroom.', done:false},
    {id:'meal', title:'Get a taste of school life', detail:'Visit the Dining Hall.', done:false},
    {id:'games', title:'Challenge a schoolmate', detail:'Play a Nigerian schoolyard game.', done:false}
  ];
  const state = {
    name:'Chinedu', gender:'m', skin:'deep', hair:'low', energy:88, knowledge:12, reputation:15, conduct:80,
    xp:0, level:1, room:'', relationships:{}, attended:[], journal:[], inventory:['Exercise books','School ID card','Blue House key'],
    meals:0, hasSlept:false, firstBoot:true, cash:23700, gameWins:0, position:{x:0,z:23}
  };
  const SKINS = {deep:'#603b2b',brown:'#81533a',medium:'#a56c49',light:'#bd8963'};
  const COLORS = {
    grass:0x4c7648,grass2:0x5c824e,concrete:0xb6b6a8,cream:0xd8d1bd,wall:0xe6dfce,
    navy:0x203b57,navyDark:0x162b40,gold:0xe4b65d,red:0x8a4c42,roof:0x737c80,
    white:0xf0eee7,green:0x315f45,blue:0x3a78ab,brown:0x7c5538
  };

  // Three.js world ---------------------------------------------------------
  function mat(color, roughness=0.84, extra={}) {
    const key = `${color}-${roughness}-${JSON.stringify(extra)}`;
    if (!MATERIALS[key]) MATERIALS[key] = new THREE.MeshStandardMaterial({color, roughness, ...extra});
    return MATERIALS[key];
  }
  function box(parent, w,h,d, material, x,y,z, options={}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,z); mesh.castShadow = options.castShadow !== false; mesh.receiveShadow = options.receiveShadow !== false;
    if (options.rx) mesh.rotation.x=options.rx; if(options.ry) mesh.rotation.y=options.ry; if(options.rz) mesh.rotation.z=options.rz;
    parent.add(mesh); return mesh;
  }
  function sphere(parent, rx,ry,rz, material,x,y,z, seg=14) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,seg,Math.max(8,seg-2)),material);
    mesh.scale.set(rx,ry,rz); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function cylinder(parent, rt,rb,h, material,x,y,z,segments=10) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function addLabel(parent,text,x,y,z,w=3,h=.42,background='#172b3a',color='#f3d38c') {
    const can=document.createElement('canvas'); can.width=512; can.height=128;
    const ctx=can.getContext('2d'); ctx.fillStyle=background; ctx.fillRect(0,0,512,128);
    ctx.fillStyle=color; ctx.font='bold 31px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text.toUpperCase(),256,64,484);
    const tex=new THREE.CanvasTexture(can); tex.minFilter=THREE.LinearFilter;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
    mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }
  function addAerialLabel(text,x,z,width=7.2) {
    const can=document.createElement('canvas');can.width=720;can.height=112;const ctx=can.getContext('2d');
    ctx.clearRect(0,0,720,112);ctx.fillStyle='rgba(255,255,255,0.95)';ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(5,5,710,102,48);else ctx.rect(5,5,710,102);ctx.fill();
    ctx.strokeStyle='rgba(31,49,53,0.16)';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#172b31';ctx.textAlign='center';ctx.textBaseline='middle';
    const size=text.length>23?28:text.length>17?31:35;ctx.font=`700 ${size}px Arial`;ctx.fillText(text,360,57,660);
    const tex=new THREE.CanvasTexture(can);tex.minFilter=THREE.LinearFilter;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,1.13),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthTest:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,11.5,z);mesh.renderOrder=30;aerialLabelsGroup.add(mesh);return mesh;
  }
  function createRenderer() {
    const canvas=$('game-canvas');
    renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
    renderer.setSize(window.innerWidth,window.innerHeight,false);
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.92;
    scene = new THREE.Scene(); scene.background=new THREE.Color(0xd3e3e6); scene.fog=new THREE.Fog(0xd3e3e6,95,215);
    camera = new THREE.PerspectiveCamera(58,window.innerWidth/window.innerHeight,.1,300);
    clock = new THREE.Clock();
    hemiLight=new THREE.HemisphereLight(0xd6e8ff,0x7b8a52,1.7); scene.add(hemiLight);
    sunLight=new THREE.DirectionalLight(0xffe2b8,2.4); sunLight.position.set(-35,55,28); sunLight.castShadow=true;
    sunLight.shadow.mapSize.set(2048,2048); sunLight.shadow.camera.left=-70;sunLight.shadow.camera.right=70;sunLight.shadow.camera.top=70;sunLight.shadow.camera.bottom=-70;
    sunLight.shadow.bias=-0.00025; scene.add(sunLight);
    worldGroup=new THREE.Group(); scene.add(worldGroup);
    playerGroup=new THREE.Group(); scene.add(playerGroup);
    aerialLabelsGroup=new THREE.Group(); aerialLabelsGroup.visible=false; scene.add(aerialLabelsGroup);createSky();
    window.addEventListener('resize',resizeRenderer);
  }
  function resizeRenderer(){ if(!renderer)return; renderer.setSize(window.innerWidth,window.innerHeight,false);camera.aspect=window.innerWidth/window.innerHeight;if(aerialMode)aerialHeight=Math.max(aerialHeight,aerialFitHeight());camera.updateProjectionMatrix(); }
  function aerialFitHeight(){const aspect=Math.max(.2,window.innerWidth/Math.max(1,window.innerHeight));return clamp(Math.max(110,90/(2*Math.tan(55*Math.PI/360)*aspect)),110,220);}

  // =========================================================================
  // VISUAL OVERHAUL · procedural textures, sky, forest, decals
  // Everything is generated in code so the game stays a single static bundle.
  // =========================================================================
  let skyDome=null, locLast=0, ROUTES=[], pathCount=0;
  const TX={}, WINI={glass:[],curtain:[],sill:[]}, BUSHI=[];
  const hashStr=(s)=>{let h=7;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))>>>0;return h;};
  const mkCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const G_TRUNK=()=>G_TRUNK.g||(G_TRUNK.g=new THREE.CylinderGeometry(.14,.26,1,6));
  const G_CANOPY=()=>G_CANOPY.g||(G_CANOPY.g=new THREE.IcosahedronGeometry(1,1));
  const G_WINDOW=()=>G_WINDOW.g||(G_WINDOW.g=new THREE.PlaneGeometry(1.25,1.35));
  const G_SILL=()=>G_SILL.g||(G_SILL.g=new THREE.BoxGeometry(1.62,.09,.26));
  const G_FROND=()=>{if(!G_FROND.g){const g=new THREE.ConeGeometry(.42,3.6,4);g.rotateX(Math.PI/2);g.translate(0,0,1.8);g.scale(1,.28,1);G_FROND.g=g;}return G_FROND.g;};

  function finishTex(c,rx=1,ry=1){
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);
    t.encoding=THREE.sRGBEncoding;t.anisotropy=renderer?Math.min(8,renderer.capabilities.getMaxAnisotropy()):4;return t;
  }
  // soft radial blotch that wraps around the tile edges so repeats have no seams
  function blob(ctx,size,px,py,r,stops,sy=1){
    for(const ox of [-size,0,size])for(const oy of [-size,0,size]){
      const cx=px+ox,cy=py+oy;if(cx+r<0||cx-r>size||cy+r*sy<0||cy-r*sy>size)continue;
      ctx.save();ctx.translate(cx,cy);ctx.scale(1,sy);const g=ctx.createRadialGradient(0,0,0,0,0,r);
      stops.forEach(s=>g.addColorStop(s[0],s[1]));ctx.fillStyle=g;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
    }
  }
  function speckle(ctx,size,n,colors,minS,maxS){
    for(let i=0;i<n;i++){ctx.fillStyle=choose(colors);ctx.fillRect(rand(0,size),rand(0,size),rand(minS,maxS),rand(minS,maxS*1.6));}
  }
  const GEN={
    plaster(){const S=512,c=mkCanvas(S,S),x=c.getContext('2d');
      x.fillStyle='#f7f2e7';x.fillRect(0,0,S,S);
      speckle(x,S,5200,['rgba(120,105,85,.07)','rgba(255,255,255,.12)','rgba(90,75,55,.06)'],1,3);
      for(let i=0;i<14;i++)blob(x,S,rand(0,S),rand(0,S),rand(30,90),[[0,'rgba(120,100,70,.10)'],[1,'rgba(120,100,70,0)']]);
      for(let i=0;i<70;i++){const px=rand(0,S),len=rand(90,430),wd=rand(2,10);const g=x.createLinearGradient(0,0,0,len);
        g.addColorStop(0,`rgba(95,80,60,${rand(.05,.15)})`);g.addColorStop(1,'rgba(95,80,60,0)');x.save();x.translate(px,0);x.fillStyle=g;x.fillRect(0,0,wd,len);x.restore();}
      const g2=x.createLinearGradient(0,340,0,S);g2.addColorStop(0,'rgba(90,70,50,0)');g2.addColorStop(1,'rgba(90,70,50,.24)');x.fillStyle=g2;x.fillRect(0,340,S,S-340);
      return finishTex(c);},
    roofTile(){const S=256,c=mkCanvas(S,S),x=c.getContext('2d');
      x.fillStyle='#ece7de';x.fillRect(0,0,S,S);
      for(let i=0;i<S;i+=16){const g=x.createLinearGradient(i,0,i+16,0);g.addColorStop(0,'rgba(0,0,0,.30)');g.addColorStop(.35,'rgba(255,255,255,.14)');g.addColorStop(1,'rgba(0,0,0,.06)');x.fillStyle=g;x.fillRect(i,0,16,S);}
      x.fillStyle='rgba(0,0,0,.22)';x.fillRect(0,0,S,3);x.fillRect(0,S/2,S,3);
      speckle(x,S,500,['rgba(90,40,20,.18)','rgba(60,80,40,.14)','rgba(255,255,255,.12)'],1,3);
      for(let i=0;i<9;i++)blob(x,S,rand(0,S),rand(0,S),rand(18,50),[[0,'rgba(50,60,30,.18)'],[1,'rgba(50,60,30,0)']]);
      return finishTex(c);},
    roofFlat(){const S=256,c=mkCanvas(S,S),x=c.getContext('2d');
      x.fillStyle='#c9c6be';x.fillRect(0,0,S,S);
      speckle(x,S,2600,['rgba(0,0,0,.08)','rgba(255,255,255,.14)','rgba(70,60,50,.08)'],1,3);
      for(let i=0;i<10;i++)blob(x,S,rand(0,S),rand(0,S),rand(20,60),[[0,'rgba(60,55,45,.20)'],[1,'rgba(60,55,45,0)']],rand(.4,1));
      for(let i=0;i<18;i++){const px=rand(0,S),g=x.createLinearGradient(0,0,0,150);g.addColorStop(0,'rgba(50,45,35,.16)');g.addColorStop(1,'rgba(50,45,35,0)');x.save();x.translate(px,rand(0,S));x.fillStyle=g;x.fillRect(0,0,rand(2,6),150);x.restore();}
      return finishTex(c);},
    road(){const S=512,c=mkCanvas(S,S),x=c.getContext('2d');
      x.fillStyle='#7d7c78';x.fillRect(0,0,S,S);
      for(let i=0;i<12;i++)blob(x,S,rand(0,S),rand(0,S),rand(40,110),[[0,'rgba(150,148,140,.28)'],[1,'rgba(150,148,140,0)']]);
      speckle(x,S,15000,['rgba(255,255,255,.14)','rgba(0,0,0,.20)','rgba(200,190,170,.18)','rgba(60,55,50,.2)'],1,3);
      for(let i=0;i<16;i++)blob(x,S,rand(0,S),rand(0,S),rand(10,30),[[0,'rgba(108,62,34,.45)'],[.6,'rgba(108,62,34,.18)'],[1,'rgba(108,62,34,0)']],rand(.5,1));
      for(let i=0;i<5;i++){x.fillStyle=`rgba(38,39,44,${rand(.2,.38)})`;x.fillRect(rand(0,S-120),rand(0,S-90),rand(50,120),rand(35,90));}
      return finishTex(c);},
    grass(){const S=512,c=mkCanvas(S,S),x=c.getContext('2d');
      x.fillStyle='#6d8140';x.fillRect(0,0,S,S);
      const cols=['rgba(122,142,66,.45)','rgba(84,114,50,.45)','rgba(158,146,80,.35)','rgba(112,88,54,.25)'];
      for(let i=0;i<70;i++)blob(x,S,rand(0,S),rand(0,S),rand(28,95),[[0,choose(cols)],[1,'rgba(0,0,0,0)']]);
      speckle(x,S,8000,['rgba(46,74,30,.32)','rgba(176,182,98,.28)','rgba(122,96,56,.18)'],1,3);
      return finishTex(c,30,30);},
    dirt(){const S=256,c=mkCanvas(S,S),x=c.getContext('2d');
      x.fillStyle='#a8623a';x.fillRect(0,0,S,S);
      for(let i=0;i<14;i++)blob(x,S,rand(0,S),rand(0,S),rand(20,60),[[0,choose(['rgba(190,122,70,.5)','rgba(120,64,36,.45)'])],[1,'rgba(0,0,0,0)']]);
      speckle(x,S,2600,['rgba(80,40,20,.22)','rgba(220,170,120,.22)','rgba(140,130,110,.25)'],1,3);
      return finishTex(c);}
  };
  function tex(name){if(!TX[name])TX[name]=GEN[name]();return TX[name];}
  const TMAT={};
  function tmat(name,color=0xffffff,rough=.9,extra={}){
    const key=`${name}-${color}-${rough}-${JSON.stringify(extra)}`;
    if(!TMAT[key])TMAT[key]=new THREE.MeshStandardMaterial({map:tex(name),color,roughness:rough,...extra});return TMAT[key];
  }
  function grassTexture(){return tex('grass');}
  // box whose UVs are scaled to real-world size, so one texture serves every wall
  function texBox(parent,w,h,d,material,x,y,z,tu=4,tv=4){
    const geo=new THREE.BoxGeometry(w,h,d),uv=geo.attributes.uv;const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
    for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0]/tu,uv.getY(i)*dims[f][1]/tv);}
    const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  // ---- windows with burglar-proof bars, painted doors, signs ----------------
  const WMAT={};
  function winMat(kind){
    if(WMAT[kind])return WMAT[kind];
    const S=256,c=mkCanvas(S,S),x=c.getContext('2d');
    x.fillStyle='#f3ecdb';x.fillRect(0,0,S,S);
    const gl=x.createLinearGradient(0,14,0,S-14);
    if(kind==='curtain'){gl.addColorStop(0,'#b53c4b');gl.addColorStop(1,'#7e2431');}else{gl.addColorStop(0,'#7a9bb0');gl.addColorStop(.55,'#35495a');gl.addColorStop(1,'#1c2a35');}
    x.fillStyle=gl;x.fillRect(14,14,S-28,S-28);
    if(kind==='curtain'){x.strokeStyle='rgba(0,0,0,.2)';x.lineWidth=3;for(let i=24;i<S-14;i+=16){x.beginPath();x.moveTo(i,14);x.lineTo(i,S-14);x.stroke();}}
    else{x.fillStyle='rgba(255,255,255,.14)';x.beginPath();x.moveTo(14,14);x.lineTo(110,14);x.lineTo(14,150);x.fill();}
    x.fillStyle='#efe8d6';x.fillRect(S/2-4,14,8,S-28);x.fillRect(14,S*.42,S-28,8);
    x.strokeStyle='#14181b';x.lineWidth=5;x.lineCap='square';
    for(let i=0;i<=5;i++){const px=14+i*(S-28)/5;x.beginPath();x.moveTo(px,14);x.lineTo(px,S-14);x.stroke();}
    for(let j=0;j<=4;j++){const py=14+j*(S-28)/4;x.beginPath();x.moveTo(14,py);x.lineTo(S-14,py);x.stroke();}
    x.lineWidth=9;x.strokeRect(14,14,S-28,S-28);
    const g=x.createLinearGradient(0,S-70,0,S);g.addColorStop(0,'rgba(80,60,40,0)');g.addColorStop(1,'rgba(80,60,40,.28)');x.fillStyle=g;x.fillRect(0,S-70,S,70);
    const t=finishTex(c);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    return WMAT[kind]=new THREE.MeshStandardMaterial({map:t,roughness:.55,metalness:.05});
  }
  function doorMat(kind){
    const key='door'+kind;if(WMAT[key])return WMAT[key];
    const W=256,H=512,c=mkCanvas(W,H),x=c.getContext('2d');
    const base=kind==='navy'?'#1f3558':'#7c1d25',hi=kind==='navy'?'#2e4a76':'#a2323a',lo=kind==='navy'?'#14243c':'#521016';
    x.fillStyle='#efe7d4';x.fillRect(0,0,W,H);x.fillStyle=base;x.fillRect(12,12,W-24,H-12);
    x.fillStyle='#e9e1cc';x.fillRect(12,12,W-24,120);
    x.fillStyle='#16191c';x.fillRect(22,22,W-44,100);
    x.strokeStyle='#8a8f93';x.lineWidth=3;for(let i=1;i<6;i++){x.beginPath();x.moveTo(22+i*(W-44)/6,22);x.lineTo(22+i*(W-44)/6,122);x.stroke();}
    for(const px of [26,W/2+8]){for(const py of [150,330]){const ph=py===150?150:150;x.fillStyle=lo;x.fillRect(px,py,W/2-34,ph);x.fillStyle=hi;x.fillRect(px+5,py+5,W/2-44,ph-10);x.fillStyle=base;x.fillRect(px+10,py+10,W/2-54,ph-20);}}
    x.fillStyle=lo;x.fillRect(W/2-2,132,4,H-132);
    x.fillStyle='#d9b45e';x.beginPath();x.arc(W/2-16,300,7,0,7);x.fill();x.beginPath();x.arc(W/2+16,300,7,0,7);x.fill();
    const t=finishTex(c);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    return WMAT[key]=new THREE.MeshStandardMaterial({map:t,roughness:.6});
  }
  function signPlane(text,w,h,bg,fg){
    const c=mkCanvas(1024,Math.round(1024*h/w)),x=c.getContext('2d');
    x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.strokeStyle=fg;x.globalAlpha=.7;x.lineWidth=6;x.strokeRect(10,10,c.width-20,c.height-20);x.globalAlpha=1;
    x.fillStyle=fg;x.font=`700 ${Math.round(c.height*.46)}px Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(String(text).toUpperCase(),c.width/2,c.height/2+2,c.width-70);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;
    return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t}));
  }
  function queueWindow(px,py,pz,ry,kind){
    const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),ry),n=new THREE.Vector3(Math.sin(ry),0,Math.cos(ry));
    m.compose(new THREE.Vector3(px+n.x*.04,py,pz+n.z*.04),q,new THREE.Vector3(1,1,1));WINI[kind].push(m);
    const s=new THREE.Matrix4();s.compose(new THREE.Vector3(px+n.x*.13,py-.74,pz+n.z*.13),q,new THREE.Vector3(1,1,1));WINI.sill.push(s);
  }
  function beam(parent,p1,p2,t,m){
    const a=new THREE.Vector3(...p1),b=new THREE.Vector3(...p2),len=a.distanceTo(b),mesh=new THREE.Mesh(new THREE.BoxGeometry(t,t*1.3,len),m);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),b.clone().sub(a).normalize());
    mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  // hip / gable roof geometry (slopes or gable-end wall triangles)
  function roofGeo(W,D,H,inset,tile,part){
    const hw=W/2,hd=D/2,rx=hw-inset;
    const A=[-hw,0,hd],B=[hw,0,hd],C=[hw,0,-hd],Dd=[-hw,0,-hd],R1=[-rx,H,0],R2=[rx,H,0];
    const pos=[],uv=[],sl=Math.hypot(hd,H),sl2=Math.hypot(inset,H);
    const tri=(p,q,r,f)=>{for(const v of [p,q,r]){pos.push(...v);uv.push(...f(v));}};
    const fb=(v)=>[v[0]/tile,(v[1]>0?sl:0)/tile], sd=(v)=>[v[2]/tile,(v[1]>0?sl2:0)/tile], gb=(v)=>[v[2]/4.2,v[1]/4.4];
    if(part==='slopes'){
      tri(A,B,R2,fb);tri(A,R2,R1,fb);tri(C,Dd,R1,fb);tri(C,R1,R2,fb);
      if(inset>0){tri(B,C,R2,sd);tri(Dd,A,R1,sd);}
    }else{tri(B,C,R2,gb);tri(Dd,A,R1,gb);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  }
  // ---- sky dome with soft clouds --------------------------------------------
  function createSky(){
    const c=mkCanvas(1024,512),x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,512);g.addColorStop(0,'#2e6fc2');g.addColorStop(.28,'#5e9ede');g.addColorStop(.44,'#a9cfe9');g.addColorStop(.5,'#d3e3e6');g.addColorStop(1,'#d3e3e6');
    x.fillStyle=g;x.fillRect(0,0,1024,512);
    for(let i=0;i<46;i++){const cx=rand(0,1024),cy=rand(130,236),sz=rand(.5,1.4);
      for(let k=0;k<9;k++){const px=cx+rand(-70,70)*sz,py=cy+rand(-10,10)*sz,r=rand(28,62)*sz;
        for(const ox of [-1024,0,1024]){const gg=x.createRadialGradient(px+ox,py,0,px+ox,py,r);gg.addColorStop(0,`rgba(255,255,255,${rand(.28,.5)})`);gg.addColorStop(1,'rgba(255,255,255,0)');
          x.save();x.translate(0,py);x.scale(1,.34);x.translate(0,-py);x.fillStyle=gg;x.fillRect(px+ox-r,py-r,r*2,r*2);x.restore();}}}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;
    skyDome=new THREE.Mesh(new THREE.SphereGeometry(230,40,20),new THREE.MeshBasicMaterial({map:t,side:THREE.BackSide,fog:false,depthWrite:false}));
    skyDome.renderOrder=-10;skyDome.frustumCulled=false;scene.add(skyDome);
  }
  // ---- trees: instanced umbrella trees (forest + campus infill) -------------
  function makeTreeInstances(spots,shadow){
    const n=spots.length;if(!n)return;
    const trunks=new THREE.InstancedMesh(G_TRUNK(),new THREE.MeshStandardMaterial({color:0x5a3d2b,roughness:.95}),n);
    const mkC=()=>new THREE.InstancedMesh(G_CANOPY(),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true}),n);
    const c1=mkC(),c2=mkC(),d=new THREE.Object3D(),col=new THREE.Color();
    const greens=[0x3d6a2a,0x4a7a30,0x35602a,0x58853a,0x2f5a2c];
    spots.forEach(([x,z],i)=>{
      const s=rand(.85,1.55);
      d.position.set(x,1.65*s,z);d.rotation.set(rand(-.06,.06),rand(0,6),rand(-.08,.08));d.scale.set(s,3.3*s,s);d.updateMatrix();trunks.setMatrixAt(i,d.matrix);
      d.rotation.set(0,rand(0,6),0);
      d.position.set(x+rand(-.3,.3)*s,3.55*s,z+rand(-.3,.3)*s);d.scale.set(2.9*s,1.0*s,2.6*s);d.updateMatrix();c1.setMatrixAt(i,d.matrix);
      col.setHex(choose(greens));c1.setColorAt(i,col);
      d.position.set(x+rand(-1,1)*s,4.35*s,z+rand(-1,1)*s);d.scale.set(1.9*s,.8*s,1.8*s);d.updateMatrix();c2.setMatrixAt(i,d.matrix);
      col.setHex(choose(greens)).offsetHSL(0,0,.04);c2.setColorAt(i,col);
    });
    for(const m of [trunks,c1,c2]){m.castShadow=shadow;m.receiveShadow=false;m.frustumCulled=false;worldGroup.add(m);}
  }
  function segDist(px,pz,x1,z1,x2,z2){
    const dx=x2-x1,dz=z2-z1,l2=dx*dx+dz*dz;let t=l2?((px-x1)*dx+(pz-z1)*dz)/l2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(x1+t*dx),pz-(z1+t*dz));
  }
  function plantForest(){
    const far=[];let tries=0;
    while(far.length<300&&tries<6000){tries++;const x=rand(-205,205),z=rand(-185,175);if(x>-50&&x<50&&z>-80&&z<42)continue;far.push([x,z]);}
    makeTreeInstances(far,false);
    const near=[];tries=0;
    while(near.length<46&&tries<2500){tries++;
      const x=rand(-47,47),z=rand(-72,38);
      if(Math.abs(x)<5.5&&z>-64)continue;                       // central avenue
      if(Math.abs(x)<24&&z<-34&&z>-63)continue;                // sports field
      if(Math.abs(x)<11&&z>0&&z<31)continue;                   // quad, court, gate
      if(buildings.some(b=>Math.abs(x-b.x)<b.w/2+4&&Math.abs(z-b.z)<b.d/2+4.5))continue;
      if(ROUTES.some(r=>segDist(x,z,r[0],r[1],r[2],r[3])<3.6))continue;
      if(near.some(p=>Math.hypot(p[0]-x,p[1]-z)<5.5))continue;
      near.push([x,z]);}
    makeTreeInstances(near,true);
  }
  // ---- laterite patches, lamp posts, instanced windows & bushes --------------
  function scatterDirt(){
    const S=128,c=mkCanvas(S,S),x=c.getContext('2d');
    for(let i=0;i<7;i++){const px=S/2+rand(-26,26),py=S/2+rand(-26,26),r=rand(26,44);const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(168,98,58,.95)');g.addColorStop(.65,'rgba(160,92,54,.6)');g.addColorStop(1,'rgba(150,90,50,0)');x.fillStyle=g;x.fillRect(0,0,S,S);}
    speckle(x,S,500,['rgba(90,50,26,.25)','rgba(210,160,110,.2)'],1,2);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
    const m=new THREE.MeshStandardMaterial({map:t,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
    let n=0,tries=0;
    while(n<60&&tries<1500){tries++;const x=rand(-46,46),z=rand(-68,36);
      if(buildings.some(b=>Math.abs(x-b.x)<b.w/2+1&&Math.abs(z-b.z)<b.d/2+1))continue;
      const p=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m);const s=rand(3,8);p.scale.set(s,s*rand(.7,1.2),1);p.rotation.set(-Math.PI/2,0,rand(0,6.28));p.position.set(x,.008+n*.00015,z);p.receiveShadow=true;worldGroup.add(p);n++;}
  }
  function addLampPosts(){
    const pole=mat(0x2d3438,.6,{metalness:.4}),head=mat(0xf4e7b8,.4,{emissive:0x403418});
    for(const sx of [-4.6,4.6])for(let z=26;z>=-40;z-=13){
      cylinder(worldGroup,.07,.09,4.6,pole,sx,2.3,z,6);box(worldGroup,.8,.07,.07,pole,sx-Math.sign(sx)*.35,4.6,z);box(worldGroup,.34,.12,.22,head,sx-Math.sign(sx)*.7,4.55,z);
    }
  }
  function flushInstances(){
    const mk=(geo,m,arr)=>{if(!arr.length)return null;const im=new THREE.InstancedMesh(geo,m,arr.length);arr.forEach((mx,i)=>im.setMatrixAt(i,mx));im.receiveShadow=true;im.frustumCulled=false;worldGroup.add(im);return im;};
    mk(G_WINDOW(),winMat('glass'),WINI.glass);mk(G_WINDOW(),winMat('curtain'),WINI.curtain);mk(G_SILL(),mat(0xf0e8d6,.85),WINI.sill);
    if(BUSHI.length){
      const im=new THREE.InstancedMesh(G_CANOPY(),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true}),BUSHI.length),d=new THREE.Object3D(),col=new THREE.Color();
      BUSHI.forEach((b,i)=>{d.position.set(b[0],b[2]*.7,b[1]);d.scale.set(b[2]*1.15,b[2]*.8,b[2]);d.rotation.set(0,rand(0,6),0);d.updateMatrix();im.setMatrixAt(i,d.matrix);col.setHex(choose([0x2f5f2c,0x3d7032,0x4b7d36,0x2a542b]));im.setColorAt(i,col);});
      im.castShadow=true;im.receiveShadow=true;im.frustumCulled=false;worldGroup.add(im);
    }
  }
  function roadBox(w,d,cx,cz,y,main){
    const e=(pathCount++%50)*.0005;
    const sh=texBox(worldGroup,w+2.4,.05,d+2.4,tmat('dirt',0xffffff,1),cx,y-.012+e,cz,5,5);sh.castShadow=false;
    const r=texBox(worldGroup,w,.05,d,tmat('road',main?0xe9e9e6:0xffffff,.95),cx,y+e,cz,6,6);r.castShadow=false;return r;
  }
  function pathSegment(parent,x1,z1,x2,z2,width=2.2){
    const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),cx=(x1+x2)/2,cz=(z1+z2)/2,ry=Math.atan2(dx,dz),e=(pathCount++%50)*.0005;
    const sh=texBox(parent,width+1.8,.03,len+1.2,tmat('dirt',0xffffff,1),cx,-.004+e,cz,5,5);sh.rotation.y=ry;sh.castShadow=false;
    const m=texBox(parent,width,.045,len,tmat('road',0xffffff,.95),cx,.012+e,cz,6,6);m.rotation.y=ry;m.castShadow=false;return m;
  }
  function addPlumbob(npc){
    const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:0x35e07a,emissive:0x1fbf5a,emissiveIntensity:.9,roughness:.25,flatShading:true,transparent:true,opacity:.93});
    const a=new THREE.Mesh(new THREE.ConeGeometry(.13,.24,4),m);a.position.y=.12;const b=new THREE.Mesh(new THREE.ConeGeometry(.13,.24,4),m);b.rotation.x=Math.PI;b.position.y=-.12;
    g.add(a,b);g.position.y=2.2;npc.group.add(g);npc.plumb=g;
  }
  const titleCase=(s)=>String(s).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  function updateLocation(){
    let txt;
    if(activeRoom)txt=roomNames[activeRoom]||'Inside School';
    else{let best=null,bd=1e9;for(const b of buildings){const dd=Math.hypot(player.x-b.x,player.z-b.z);if(dd<bd){bd=dd;best=b;}}
      const nm=best?titleCase(roomNames[best.id]||best.label):'';txt=!best?'Main Campus':bd<9?`Outside · ${nm}`:`Campus road · near ${nm}`;}
    const a=$('location-name'),b=$('mobile-location');if(a&&a.textContent!==txt)a.textContent=txt;if(b&&b.textContent!==txt)b.textContent=txt;
  }
  function animateVisuals(dt,now){
    const t=(now||0)/1000;
    for(const arr of [worldNPCs,interiorNPCs])for(const n of arr)if(n.plumb){n.plumb.rotation.y+=dt*2.2;n.plumb.position.y=((n.group.userData.rig&&n.group.userData.rig.topY)||1.9)+.32+Math.sin(t*2+n.phase)*.07;}
    if(skyDome){skyDome.position.copy(camera.position);skyDome.rotation.y+=dt*.003;skyDome.visible=!activeRoom;}
    if(gameStarted&&(now||0)-locLast>600){locLast=now||0;updateLocation();}
  }
  function tiledFloor(parent,w,d,base=0xc9c5b9,tile=1.6) {
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({map:null,color:base,roughness:.95}));
    floor.rotation.x=-Math.PI/2;floor.position.y=0;floor.receiveShadow=true;parent.add(floor);
    const lines=new THREE.Group();
    for(let x=-w/2;x<=w/2+.01;x+=tile) box(lines,.018,.008,d,mat(0xaaa99f),x,.006,0,{castShadow:false});
    for(let z=-d/2;z<=d/2+.01;z+=tile) box(lines,w,.008,.018,mat(0xaaa99f),0,.006,z,{castShadow:false});
    parent.add(lines); return floor;
  }
  function makeWindow(parent,x,y,z,w=1.25,h=1.15,side=false) {
    const glass=mat(0x5d8796,.28,{metalness:.18});
    if(!side) {
      box(parent,w+.16,h+.16,.14,mat(0xeee8d8),x,y,z);
      box(parent,w,h,.04,glass,x,y,z-.09);
      box(parent,.035,h,.05,mat(0x3c4c50),x,y,z-.13);
      box(parent,w,.035,.05,mat(0x3c4c50),x,y,z-.13);
      for(let i=0;i<4;i++)box(parent,.025,h,.045,mat(0x414b4a),x-w*.35+i*w*.23,y,z-.15);
      for(let i=0;i<3;i++)box(parent,w,.018,.05,mat(0x414b4a),x,y-h*.25+i*h*.25,z-.15);
    } else {
      box(parent,.14,h+.16,w+.16,mat(0xeee8d8),x,y,z);
      box(parent,.04,h,w,glass,x-.09,y,z);
      box(parent,.05,h,.035,mat(0x3c4c50),x-.13,y,z);
      box(parent,.05,.035,w,mat(0x3c4c50),x-.13,y,z);
      for(let i=0;i<4;i++)box(parent,.045,h,.025,mat(0x414b4a),x-.15,y,z-w*.35+i*w*.23);
    }
  }
  // ---- Buildings: painted plaster, plinth stripe, barred windows, real roofs ----
  const BPAL=[
    {wall:0xf6ecd6,trim:0x7a1f27,roof:0xb4533c,door:'red'},
    {wall:0xf3f1eb,trim:0x1f3b66,roof:0xd0a088,door:'navy'},
    {wall:0xefe2c6,trim:0x7a1f27,roof:0x8d2f2c,door:'red'},
    {wall:0xeae7dc,trim:0x8a2a2e,roof:0x7d8387,door:'red'},
    {wall:0xf7eedb,trim:0x203f6e,roof:0xa84b38,door:'navy'}
  ];
  const TWO_STOREY=new Set(['hostel','greenHostel','dining','library','principal','assembly','greatHall']);
  const FLAT_ROOF=new Set(['printShop','workshop','staffSchool','ict']);
  function buildBuilding(def) {
    const g=new THREE.Group(),x=def.x,z=def.z,w=def.w,d=def.d,id=def.id,hs=hashStr(id);
    const two=TWO_STOREY.has(id),h=two?7.6:4.4,pal=BPAL[hs%BPAL.length];
    const wall=tmat('plaster',pal.wall,.93),base=tmat('plaster',pal.trim,.9),trimM=tmat('plaster',pal.trim,.85),tt=.34;
    const frontZ=z+d/2,outF=frontZ+tt/2,outB=z-d/2-tt/2,outL=x-w/2-tt/2,outR=x+w/2+tt/2;
    const T=(bw,bh,bd,m,px,py,pz,tu,tv)=>texBox(g,bw,bh,bd,m,px,py,pz,tu||4.2,tv||h);
    // masonry shell (front is split for the doorway)
    const gap=1.8,seg=(w-gap)/2;
    T(w,h,tt,wall,x,h/2,z-d/2);T(tt,h,d,wall,x-w/2,h/2,z);T(tt,h,d,wall,x+w/2,h/2,z);
    T(seg,h,tt,wall,x-gap/2-seg/2,h/2,frontZ);T(seg,h,tt,wall,x+gap/2+seg/2,h/2,frontZ);
    T(gap,h-2.6,tt,wall,x,2.6+(h-2.6)/2,frontZ);
    box(g,w-.3,.1,d-.3,mat(0x8e8a80,.95),x,.05,z,{castShadow:false});
    // dark-red / navy painted plinth (the stripe you see on real campus blocks)
    const ph=.95;
    T(seg,ph,.07,base,x-gap/2-seg/2,ph/2,outF+.02,4.2,ph);T(seg,ph,.07,base,x+gap/2+seg/2,ph/2,outF+.02,4.2,ph);
    T(w+.14,ph,.07,base,x,ph/2,outB-.02,4.2,ph);T(.07,ph,d+.14,base,outL-.02,ph/2,z,4.2,ph);T(.07,ph,d+.14,base,outR+.02,ph/2,z,4.2,ph);
    // doorway: painted double door, frame, step and sign
    const door=new THREE.Mesh(new THREE.PlaneGeometry(gap,2.6),doorMat(pal.door));door.position.set(x,1.3,frontZ+.01);g.add(door);
    box(g,.14,2.75,.22,trimM,x-gap/2-.04,1.37,outF+.04);box(g,.14,2.75,.22,trimM,x+gap/2+.04,1.37,outF+.04);box(g,gap+.36,.16,.22,trimM,x,2.68,outF+.04);
    box(g,2.9,.18,1.6,mat(0xb9b6aa,.95),x,.09,frontZ+.75);box(g,2.5,.16,1.1,mat(0xc6c3b7,.95),x,.26,frontZ+.45);
    const sw=Math.min(3.4,w*.3),sign=signPlane(def.label,sw,.5,pal.door==='navy'?'#1f3558':'#5b161c','#f4d58c');sign.position.set(x,3.12,outF+.035);g.add(sign);
    // windows (instanced) on every side, ground floor skips the doorway
    const nF=Math.max(2,Math.floor(w/2.7)),nS=Math.max(2,Math.floor(d/3.1)),rows=two?[2.3,5.8]:[2.3];
    for(const wy of rows){
      for(let i=0;i<nF;i++){
        const wx=x-w/2+(i+.5)*w/nF,kind=((hs+i*7+Math.round(wy))%5===0)?'curtain':'glass';
        if(!(wy<3&&Math.abs(wx-x)<2.1))queueWindow(wx,wy,outF,0,kind);
        queueWindow(wx,wy,outB,Math.PI,((hs+i*3+Math.round(wy))%6===0)?'curtain':'glass');
      }
      for(let i=0;i<nS;i++){const sz=z-d/2+(i+.5)*d/nS;queueWindow(outL,wy,sz,-Math.PI/2,'glass');queueWindow(outR,wy,sz,Math.PI/2,((hs+i)%4===0)?'curtain':'glass');}
    }
    // roof
    const style=FLAT_ROOF.has(id)?'flat':two?'hip':'gable';
    if(style==='flat'){
      texBox(g,w+.8,.3,d+.8,tmat('roofFlat',0xd2cfc6,.95),x,h+.15,z,6,6);
      for(const s of [-1,1]){box(g,w+.8,.5,.18,trimM,x,h+.55,z+s*(d/2+.36));box(g,.18,.5,d+.8,trimM,x+s*(w/2+.36),h+.55,z);}
      cylinder(g,.62,.62,1.2,mat(0x1d2327,.5),x+w*.25,h+.9,z-d*.18,14);cylinder(g,.62,.62,1.2,mat(0x1d2327,.5),x+w*.25+1.5,h+.9,z-d*.18,14);
    }else{
      const rg=new THREE.Group(),alongZ=style==='gable'&&hs%2===0,Wl=(alongZ?d:w)+1.1,Dl=(alongZ?w:d)+1.1;
      rg.position.set(x,h,z);if(alongZ)rg.rotation.y=Math.PI/2;g.add(rg);
      const hip=style==='hip',H=hip?2.5:Math.min(2.7,Dl/2*.62),inset=hip?Math.min(Dl/2-.4,Wl/2-1):0;
      const roofM=tmat('roofTile',pal.roof,.78,{side:THREE.DoubleSide});
      const rm=new THREE.Mesh(roofGeo(Wl,Dl,H,inset,3.4,'slopes'),roofM);rm.castShadow=true;rm.receiveShadow=true;rg.add(rm);
      const so=box(rg,Wl-.1,.08,Dl-.1,mat(0x4a4038,.95),0,.02,0,{castShadow:false});so.receiveShadow=false;
      box(rg,Wl+.12,.3,.16,trimM,0,.08,Dl/2);box(rg,Wl+.12,.3,.16,trimM,0,.08,-Dl/2);
      if(hip){box(rg,.16,.3,Dl+.12,trimM,Wl/2,.08,0);box(rg,.16,.3,Dl+.12,trimM,-Wl/2,.08,0);}
      else{
        const ge=new THREE.Mesh(roofGeo(Wl-.2,Dl-.2,H-.1,0,3.4,'gables'),wall);ge.castShadow=true;ge.receiveShadow=true;rg.add(ge);
        for(const sx of [-1,1])for(const sz of [-1,1])beam(rg,[sx*(Wl/2+.03),.05,sz*Dl/2],[sx*(Wl/2+.03),H,0],.17,trimM);
        box(rg,Wl+.1,.2,.2,trimM,0,H,0);
      }
    }
    // foundation shrubs
    for(const sg of [-1,1])for(let k=0;k<3;k++)BUSHI.push([x+sg*(gap/2+1.7+k*1.35+rand(0,.3)),outF+.6+rand(0,.3),rand(.45,.72)]);
    worldGroup.add(g);
    const item={...def,frontZ,group:g};buildings.push(item);return item;
  }
  // ---- Trees: umbrella (acacia-style) canopies and drooping-frond palms ---------
  function tree(parent,x,z,kind='palm',scale=1) {
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);g.rotation.y=rand(0,6.28);
    if(kind==='palm'){
      const trunk=cylinder(g,.2,.34,6,mat(0x7a5b40,.95),0,3,0,7);trunk.rotation.z=rand(-.07,.07);
      for(let k=0;k<5;k++)cylinder(g,.27-k*.012,.28-k*.012,.1,mat(0x5e4430,.95),0,.9+k*1.0,0,7);
      for(let j=0;j<10;j++){
        const a=j/10*Math.PI*2+rand(-.15,.15),lf=new THREE.Mesh(G_FROND(),mat(j%2?0x2f6a35:0x3f7d3d,.85,{side:THREE.DoubleSide,flatShading:true}));
        lf.position.set(0,6.05,0);lf.rotation.order='YXZ';lf.rotation.y=a;lf.rotation.x=.45+rand(0,.4);lf.castShadow=true;g.add(lf);
      }
      sphere(g,.3,.28,.3,mat(0x5a8b4a),0,6,0,8);
    }else{
      const th=rand(2.6,3.2),t1=cylinder(g,.17,.3,th,mat(0x5d4130,.95),0,th/2,0,6);t1.rotation.z=rand(-.12,.12);
      const cols=[0x3e6b2b,0x4b7a31,0x37622a,0x5a8638],o=Math.floor(rand(0,4));
      [[0,th+.15,0,2.9,.85,2.7],[.8,th+.55,.4,2.0,.7,1.9],[-.9,th+.4,-.5,1.9,.65,1.8]].forEach((l,i)=>{
        const m=new THREE.Mesh(G_CANOPY(),mat(cols[(i+o)%4],.9,{flatShading:true}));m.position.set(l[0],l[1],l[2]);m.scale.set(l[3],l[4],l[5]);m.castShadow=true;m.receiveShadow=true;g.add(m);
      });
    }
    parent.add(g);return g;
  }
  function buildWorld() {
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(440,440),new THREE.MeshStandardMaterial({map:grassTexture(),roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.receiveShadow=true;worldGroup.add(ground);
    // Main roads and footpaths
    roadBox(6,72,0,-10,-.01,true);
    roadBox(40,3.6,0,1,0,false);
    roadBox(52,2.2,0,-17,.01,false);
    roadBox(3,27,-10,4,.012,false);
    roadBox(3,27,10,4,.012,false);
    // Red-earth games field, chalk lines and goals
    texBox(worldGroup,45,.04,25,tmat('grass',0xc2cf86,1),0,-.01,-48,8,8).castShadow=false;
    box(worldGroup,42,.025,.1,mat(0xd8d5c6),0,.015,-60,{castShadow:false});
    box(worldGroup,.1,.025,23,mat(0xd8d5c6),-21,.015,-48,{castShadow:false});box(worldGroup,.1,.025,23,mat(0xd8d5c6),21,.015,-48,{castShadow:false});
    for(const x of [-8,8]){box(worldGroup,.15,2.4,.15,mat(0xe5e4d8),x,1.2,-60);box(worldGroup,3.2,.15,.15,mat(0xe5e4d8),x,2.35,-60);}
    // Outdoor court
    box(worldGroup,17,.045,10,mat(0x8faaa0),0,.02,9,{castShadow:false});
    for(let i=-1;i<=1;i++)box(worldGroup,.025,.025,10,mat(0xece9da),i*5.3,.05,9,{castShadow:false});
    box(worldGroup,17,.025,.04,mat(0xece9da),0,.05,9,{castShadow:false});
    // Entrance plaza, gate piers and iron bars
    box(worldGroup,30,2,.52,mat(0xd1c6b0),0,1,30);
    box(worldGroup,2.2,5.4,1.2,mat(0xe0d5bf),-8,2.7,30);box(worldGroup,2.2,5.4,1.2,mat(0xe0d5bf),8,2.7,30);
    box(worldGroup,19,.35,.65,mat(0x1f3848),0,5.4,30);
    addLabel(worldGroup,'UNITY HEIGHTS SECONDARY SCHOOL',0,5.45,29.63,17,.42,'#173044','#f2cc78');
    for(let i=0;i<17;i++){const x=-6.5+i*.81;box(worldGroup,.09,3.1,.09,mat(0x46545a),x,1.72,30);}
    // Guardhouse and water tower
    box(worldGroup,4,2.9,3.6,mat(0xddd5c2),12,1.45,29);box(worldGroup,4.2,.22,3.8,mat(0x8a5140),12,3.03,29);
    makeWindow(worldGroup,11.2,1.9,27.18,1.1,.9,false);addLabel(worldGroup,'SECURITY',12,2.65,27.14,2,.28,'#293d4b','#f5d48c');
    cylinder(worldGroup,.55,.8,5.4,mat(0x737f80),20,2.7,24,12);cylinder(worldGroup,1.1,1.1,.42,mat(0x9da8a5),20,5.42,24,12);cylinder(worldGroup,.5,.7,.25,mat(0x647474),20,5.76,24,12);
    // Nigerian flag, green-white-green
    cylinder(worldGroup,.055,.075,8,mat(0xd6d5cc),-2,4,18,8);
    const flagMat1=new THREE.MeshBasicMaterial({color:0x159447,side:THREE.DoubleSide});const flagMat2=new THREE.MeshBasicMaterial({color:0xf7f4e6,side:THREE.DoubleSide});
    box(worldGroup,.62,.85,.025,flagMat1,-2.36,7.2,18);box(worldGroup,.62,.85,.025,flagMat2,-2,7.2,18);box(worldGroup,.62,.85,.025,flagMat1,-1.64,7.2,18);
    // Trees and small outdoor benches
    [[-24,-5,'palm'],[24,-3,'palm'],[-25,12,'palm'],[26,14,'palm'],[-28,-30,'tree'],[28,-27,'tree'],[-26,-49,'palm'],[27,-50,'palm'],[-5,-30,'tree'],[7,-32,'tree'],[-21,25,'tree'],[21,25,'tree'],[-8,8,'tree'],[8,7,'tree']].forEach(v=>tree(worldGroup,v[0],v[1],v[2],v[2]==='palm'?.95:1));
    for(let i=0;i<4;i++){
      const bx=-7.8+i*5.2;const bz=4.5;
      box(worldGroup,2.2,.15,.55,mat(0x8a6848),bx,.65,bz);box(worldGroup,2,.55,.12,mat(0x8a6848),bx,.93,bz+.23);
      for(const dx of [-.8,.8])box(worldGroup,.12,.65,.12,mat(0x4b5150),bx+dx,.32,bz);
    }
    const defs=[
      {id:'principal',type:'principal',label:'ADMINISTRATION',x:-17,z:-5,w:13,d:9,wall:0xd9d2c0,roof:0x767d7c},
      {id:'math',type:'class',label:'MATHEMATICS',x:0,z:-6,w:13,d:9,wall:0xe3dece,roof:0x808989},
      {id:'english',type:'class',label:'ENGLISH LANGUAGE',x:16,z:-6,w:13,d:9,wall:0xd9d5c7,roof:0x7e8585},
      {id:'science',type:'lab',label:'SCIENCE LAB',x:-12,z:-20,w:13,d:9,wall:0xd6dfd7,roof:0x7c8888},
      {id:'assembly',type:'hall',label:'ASSEMBLY HALL',x:12,z:-21,w:17,d:12,wall:0xddd4c3,roof:0x6d797b},
      {id:'library',type:'library',label:'SCHOOL LIBRARY',x:0,z:-35,w:14,d:9,wall:0xd7d1c0,roof:0x798482},
      {id:'hostel',type:'hostel',label:'BLUE HOUSE HOSTEL',x:-17,z:13,w:15,d:11,wall:0xc8d0c8,roof:0x6c8283},
      {id:'dining',type:'dining',label:'DINING HALL',x:15,z:13,w:15,d:11,wall:0xe3d9c5,roof:0x8b7f70},
      {id:'clinic',type:'clinic',label:'SCHOOL CLINIC',x:28,z:1,w:10,d:8,wall:0xd3e0d7,roof:0x8c9990},
      {id:'staffSchool',type:'school',label:'STAFF SCHOOL',x:-31,z:-7,w:12,d:8,wall:0xe0d7c5,roof:0x7b8585},
      {id:'artRoom',type:'arts',label:'ARTS & CULTURE',x:-30,z:-25,w:11,d:8,wall:0xe0d3c2,roof:0x8c6d5e},
      {id:'greatHall',type:'hall',label:'GREAT HALL',x:29,z:-31,w:15,d:11,wall:0xd7d3c7,roof:0x727b7f},
      {id:'ict',type:'lab',label:'ICT & PHYSICS LAB',x:29,z:-47,w:12,d:8,wall:0xd7e0db,roof:0x6f7c81},
      {id:'printShop',type:'workshop',label:'PRINTING PRESS',x:29,z:-62,w:12,d:8,wall:0xe2d8c8,roof:0x7b7773},
      {id:'shop',type:'shop',label:'CAMPUS SHOP',x:-30,z:1,w:10,d:8,wall:0xd9d5c8,roof:0x93624f,doorColor:0x60472f},
      {id:'greenHostel',type:'hostel',label:'GREEN HOUSE HOSTEL',x:-31,z:14,w:13,d:10,wall:0xc9d4c7,roof:0x697d78},
      {id:'mosque',type:'quiet',label:'QUIET PRAYER HALL',x:29,z:20,w:10,d:8,wall:0xe6dfcf,roof:0x52776b},
      {id:'workshop',type:'workshop',label:'PRODUCTION WORKSHOP',x:-30,z:-45,w:12,d:8,wall:0xd5d2c5,roof:0x767d7c}
    ];
    defs.forEach(buildBuilding);
    const routes=[
      [0,29,0,10,3.2],[0,10,-17,-5,2.5],[-17,-5,-31,-7,2.3],[-17,-5,-30,1,2.1],[-30,1,-31,14,2.1],
      [0,-5,-12,-20,2.4],[-12,-20,0,-35,2.3],[0,-35,0,-48,2.5],[0,-48,29,-47,2.3],[29,-47,29,-62,2.2],
      [12,-21,29,-31,2.2],[29,-31,29,-47,2.2],[16,-6,28,1,2.1],[28,1,29,20,2.1],[-12,-20,-30,-25,2.0],[-30,-25,-30,-45,2.0],
      [-17,13,0,13,2.0],[0,13,15,13,2.0],[15,13,29,20,1.9]
    ];
    ROUTES=routes;routes.forEach(r=>pathSegment(worldGroup,r[0],r[1],r[2],r[3],r[4]));
    for(let i=0;i<11;i++){const z=26-i*8.6;tree(worldGroup,-40,z,i%3===0?'palm':'tree',rand(.72,.98));tree(worldGroup,40,z,i%4===0?'palm':'tree',rand(.7,.95));}
    for(const [x,z] of [[-37,-18],[37,-22],[-39,-39],[38,-55],[-20,-58],[17,-58],[-23,22],[23,27]])tree(worldGroup,x,z,'tree',.8);
    for(const [x,z] of [[-21,-28],[20,-28],[-22,-42],[21,-43],[-15,5],[19,5]]){box(worldGroup,1.8,.14,.5,mat(0x8a6848),x,.5,z);for(const dx of [-.65,.65])box(worldGroup,.1,.5,.1,mat(0x4b5150),x+dx,.25,z);}
    const hop=mat(0xe8e2ca);for(let i=0;i<8;i++){const x=-8+(i%2)*1.35;const z=14-Math.floor(i/2)*1.45;box(worldGroup,1.12,.026,1.12,hop,x,.055,z,{castShadow:false});addLabel(worldGroup,String(i+1),x,.09,z,.43,.2,'#f4efe0','#223c3a');}
    box(worldGroup,2.35,.2,.82,mat(0x795238),-4,.52,17);box(worldGroup,2.15,.08,.68,mat(0xa47b51),-4,.66,17);
    for(let i=0;i<12;i++)sphere(worldGroup,.09,.055,.09,mat(i%3===0?0xb58b51:0x5b412d),-4.96+(i%6)*.38,.74,16.85+Math.floor(i/6)*.28,8);
    for(const b of buildings)addAerialLabel(roomNames[b.id]||b.label,b.x,b.z,Math.min(9.4,Math.max(5.8,(roomNames[b.id]||b.label).length*.25)));
    addAerialLabel('MAIN QUAD',0,4,5.6);addAerialLabel('SPORTS FIELD',0,-48,6.2);addAerialLabel('BLUE HOUSE ROAD',-5,24,7.0);
    flushInstances();plantForest();scatterDirt();addLampPosts();
    // Courtside chalk notice board and basketball pole
    box(worldGroup,3.3,2.3,.18,mat(0x574b3a),-5,.1,20);box(worldGroup,3.05,1.98,.04,mat(0x233f3a),-5,1.28,19.88);addLabel(worldGroup,'WEEKLY DUTIES',-5,1.25,19.83,2.7,.35,'#294b42','#efcf80');
    cylinder(worldGroup,.12,.16,3.6,mat(0x596367),-12,1.8,5,10);box(worldGroup,1.8,.09,.06,mat(0xece8dc),-12,3.45,5);box(worldGroup,.08,.9,.06,mat(0x8f9ba0),-11.2,3.0,5);cylinder(worldGroup,.5,.54,.13,mat(0xefefdf),-11.2,2.55,5,16);
  }

  // ---- Characters (built by characters.js) ----------------------------------
  function createHuman(cfg={}) {
    const c={...cfg};
    if(!c.gender)c.gender=(c.skirt||c.adultFemale)?'f':'m';
    return UHHumans.create(c);
  }
  const HOUSE_TIE={blue:0x2f5f9a,green:0x3a7d4f};
  const ANKARA={green:[0x2f6a5a,0xe0b84a,0xb0412f],rust:[0xb5513a,0xe6b94c,0x2f5f6a],plum:[0x7a3b6a,0xe6c84a,0x2f6a5a],navy:[0x2f4a6a,0xe6b94c,0xb5513a],earth:[0x6a3d2a,0xd9a441,0x2f5f6a]};
  const npcDefs={
    ada:{name:'Adaeze',role:'Student · Blue House',kind:'student',gender:'f',skin:SKINS.brown,hairStyle:'cornrows',pants:0x263f5a,skirt:true,backpack:true,bagColor:0x7b5143,tie:HOUSE_TIE.blue,voice:'warm',intro:'Hi! You must be the new student. I’m Adaeze. Welcome to Unity Heights — boarding school is a whole different world, honestly.',
      outside:{x:2.6,z:14.0}},
    tunde:{name:'Tunde',role:'Student · JSS 3',kind:'student',gender:'m',skin:SKINS.deep,hairStyle:'low',pants:0x223b55,backpack:true,bagColor:0x5f5b42,tie:HOUSE_TIE.blue,voice:'playful',intro:'You’re new, abi? First week can be somehow, but you’ll catch the rhythm. Just don’t sleep through prep.',outside:{x:-4.3,z:11.8}},
    prefect:{name:'Musa',role:'Senior Prefect · Blue House',kind:'prefect',gender:'m',skin:SKINS.deep,hairStyle:'fade',pants:0x223245,build:'stocky',height:.94,sash:0xc9a24a,tie:0x2f5f9a,necktie:true,voice:'firm',intro:'I’m Musa, the house prefect. Keep your locker tidy, respect lights-out, and don’t let anybody tell you prep is optional.',outside:{x:4.7,z:20.5}},
    teacherMath:{name:'Mr. Okafor',role:'Mathematics Teacher',kind:'teacher',subject:'math',gender:'m',adult:true,skin:SKINS.deep,hairStyle:'low',grey:true,shirt:0x9caa91,pants:0x3c4143,sleeves:'rolled',necktie:true,tie:0x6a2a30,glasses:true,moustache:true,lanyard:0x2f5f9a,chalk:true,watch:true,shoes:0x2a1d16,voice:'teacher',intro:'Good morning. Open your notebook. We will start with algebra, then I want to see your working — not just an answer.',room:'math'},
    teacherEnglish:{name:'Mrs. Balogun',role:'English Language Teacher',kind:'teacher',subject:'english',gender:'f',adult:true,skin:SKINS.brown,headcover:'headtie',headtiePattern:ANKARA.rust,shirt:0xe6d9c3,pants:0x5a3a2a,skirt:true,skirtLen:'long',skirtPattern:ANKARA.earth,sleeves:'short',lanyard:0x2f5f9a,book:0x7a3b3b,necktie:false,voice:'teacher',intro:'Good morning, class. A good writer notices the small things. Let’s warm up with a short comprehension passage.',room:'english'},
    teacherScience:{name:'Dr. Eze',role:'Basic Science Teacher',kind:'teacher',subject:'science',gender:'m',adult:true,skin:SKINS.deep,hairStyle:'low',beard:true,glasses:true,labCoat:true,sleeves:'long',shirt:0xdde6ee,pants:0x344657,lanyard:0x2f5f9a,voice:'teacher',intro:'Before we touch any equipment, we observe. A scientist asks questions and records evidence. Are we clear?',room:'science'},
    teacherICT:{name:'Mr. Lawal',role:'ICT & Physics Teacher',kind:'teacher',subject:'ict',like:'teacherScience',gender:'m',adult:true,skin:SKINS.brown,hairStyle:'low',glasses:true,shirt:0x7d98b0,pants:0x2c2f35,sleeves:'long',necktie:false,lanyard:0x2f5f9a,watch:true,voice:'teacher',intro:'Save your work before you do anything else. A computer forgives nothing and remembers everything — except the file you forgot to save.',room:'ict'},
    teacherCivic:{name:'Mrs. Nwosu',role:'Civic Education Teacher',kind:'teacher',subject:'staffSchool',like:'teacherEnglish',gender:'f',adult:true,skin:SKINS.deep,hairStyle:'braids',cardigan:0x6b4f7a,shirt:0xf0e6e6,pants:0x2f3340,skirt:true,sleeves:'long',lanyard:0x2f5f9a,book:0x35566a,necktie:false,voice:'teacher',intro:'Good morning. Rights come with responsibilities, and today we will talk about both. Please sit properly.',room:'staffSchool'},
    teacherArts:{name:'Mr. Adebayo',role:'Arts & Culture Teacher',kind:'teacher',subject:'artRoom',like:'teacherEnglish',gender:'m',adult:true,skin:SKINS.brown,hairStyle:'low',goatee:true,shirt:0xb5763a,pants:0x2f3a2f,sleeves:'short',necktie:false,voice:'teacher',intro:'Stand tall, breathe, and let the room hear you! Art is not about being perfect. It is about being brave.',room:'artRoom'},
    technician:{name:'Mr. Bassey',role:'Workshop Technician',kind:'staff',like:'librarian',gender:'m',adult:true,build:'stocky',skin:SKINS.deep,hairStyle:'low',shirt:0xb9b09a,pants:0x3a4147,sleeves:'rolled',apron:0x6a5a3a,necktie:false,voice:'teacher',intro:'Safety first, always. Goggles on, sleeves tidy, and nobody touches the machine until I say so.',room:'workshop'},
    principal:{name:'Mrs. Akinwale',role:'Principal · Unity Heights',kind:'principal',gender:'f',adult:true,skin:SKINS.brown,hairStyle:'braids',blazer:0x41505a,shirt:0xf1eee6,pants:0x243343,skirt:true,sleeves:'long',glasses:true,necktie:false,crest:true,voice:'principal',intro:'Welcome to Unity Heights. We expect discipline, curiosity and kindness here. You will make mistakes; what matters is what you learn from them.',room:'principal'},
    librarian:{name:'Mr. Danjuma',role:'School Librarian',kind:'staff',gender:'m',adult:true,skin:SKINS.deep,hairStyle:'low',grey:true,cardigan:0x75634b,shirt:0xcfd8d6,pants:0x293a4a,sleeves:'long',glasses:true,book:0x35566a,voice:'teacher',intro:'The library is a good place to get ahead quietly. Keep the books in good condition and bring them back on time.',room:'library'},
    nurse:{name:'Nurse Ifeoma',role:'School Nurse',kind:'staff',gender:'f',adult:true,skin:SKINS.brown,hairStyle:'bun',cap:0xffffff,shirt:0xf1f4f1,pants:0xf1f4f1,skirt:true,shoes:0xeeeeee,stethoscope:true,necktie:false,voice:'gentle',intro:'Come in, dear. If you feel tired or unwell, tell someone early. There is no prize for pretending you are fine.',room:'clinic'},
    diningStaff:{name:'Aunty Grace',role:'Dining Hall Staff',kind:'staff',gender:'f',adult:true,skin:SKINS.deep,headcover:'headtie',headtiePattern:ANKARA.green,shirt:0xe8dfc9,pants:0x37434c,skirt:true,apron:0xb8584a,sleeves:'short',necktie:false,voice:'gentle',intro:'Food is ready. Take your tray, find a space, and no pushing please. If you need more water, ask.',room:'dining',inside:{x:6,z:-4}},
    roommate:{name:'Emeka',role:'Hostel Roommate',kind:'student',gender:'m',skin:SKINS.deep,hairStyle:'curly',pants:0x243c58,tie:HOUSE_TIE.blue,backpack:false,voice:'playful',intro:'This bunk is yours? Nice. I’m Emeka. If you hear somebody shouting during football, it’s probably my side of the room.',room:'hostel',inside:{x:2.8,z:1.4}},
    hallprefect:{name:'Zainab',role:'Assembly Prefect',kind:'prefect',gender:'f',skin:SKINS.brown,headcover:'hijab',hijab:0xeeeeea,pants:0x253c55,skirt:true,sash:0xc9a24a,tie:0x2f5f9a,backpack:false,voice:'firm',intro:'Find your house row and keep the aisle clear. Principal is about to address the school.',room:'assembly',inside:{x:5,z:2.8}},
    chisom:{name:'Chisom',role:'Student · Green House',kind:'student',gender:'m',skin:SKINS.medium,hairStyle:'curly',pants:0x334b5a,tie:HOUSE_TIE.green,backpack:true,bagColor:0x526c4d,voice:'playful',intro:'You are the new person, right? Come and see the games people play after prep. Ayo gets competitive here.',outside:{x:-9,z:-2}},
    sadiq:{name:'Sadiq',role:'Student · JSS 3',kind:'student',gender:'m',skin:SKINS.deep,hairStyle:'low',pants:0x263b52,bottom:'shorts',tie:HOUSE_TIE.green,backpack:true,bagColor:0x8d5a41,voice:'warm',intro:'Sannu! I am Sadiq. There is a small football challenge by the field later. You should join us.',outside:{x:8,z:-31}},
    kemi:{name:'Kemi',role:'Student · Blue House',kind:'student',gender:'f',skin:SKINS.brown,hairStyle:'twists',pants:0x2b445c,skirt:true,tie:HOUSE_TIE.blue,backpack:true,bagColor:0x7f596e,voice:'warm',intro:'We are practising Suwe for house games. The chalk squares are beside the court. Want to try?',outside:{x:-3.5,z:5.5}},
    shopkeeper:{name:'Aunty Bisi',role:'Campus Shopkeeper',kind:'staff',gender:'f',adult:true,skin:SKINS.brown,headcover:'headtie',headtiePattern:ANKARA.plum,shirt:0x9cb19c,pants:0x384b4a,skirt:true,skirtLen:'long',skirtPattern:ANKARA.navy,sleeves:'short',necktie:false,voice:'gentle',intro:'Welcome, my dear. We have exercise books, pencils, cold water and a few snacks. Check your pocket money before you choose.'}
  };
  // More schoolmates, so every class and corner has its own faces
  function addStudent(id,name,gender,skin,hair,house,intro,extra={}){
    npcDefs[id]={name,role:`Student · ${house==='green'?'Green':'Blue'} House`,kind:'student',gender,skin,hairStyle:hair,pants:0x233c57,tie:HOUSE_TIE[house],
      backpack:true,bagColor:[0x5f5b42,0x354e65,0x7b5143,0x526c4d,0x6b4a5e][name.length%5],like:gender==='f'?'ada':'tunde',voice:'warm',intro,...(gender==='f'?{skirt:true}:{}),...extra};
  }
  addStudent('chidi','Chidi','m',SKINS.medium,'low','blue','Hey! I’m Chidi. If you need to borrow a ruler, just ask — but bring it back, abeg.');
  addStudent('ibrahim','Ibrahim','m',SKINS.brown,'low','green','Sannu! Ibrahim here, Green House. Sit anywhere; the teacher only cares that you are on time.',{bottom:'shorts'});
  addStudent('femi','Femi','m',SKINS.deep,'curly','blue','I’m Femi. If you like debating, join the club. If you like sleeping, hide from the prefect.',{glasses:true});
  addStudent('obinna','Obinna','m',SKINS.light,'low','green','Obinna. Third bunk by the window. I’m the one you ask when you can’t find your slippers.');
  addStudent('yusuf','Yusuf','m',SKINS.brown,'fade','blue','Yusuf. I read the announcements sometimes, so if you hear a loud voice on the PA, that is me.');
  addStudent('segun','Segun','m',SKINS.medium,'curly','green','Segun here. Maths is my favourite subject, football is my second. Don’t tell the teacher the order.',{bottom:'shorts'});
  addStudent('tobi','Tobi','m',SKINS.deep,'fade','blue','Tobi. Quiet in class, loud on the field. You’ll see.');
  addStudent('ngozi','Ngozi','f',SKINS.deep,'puffs','green','I’m Ngozi. Welcome to Unity Heights! The jollof rice in the dining hall is better on Sundays.');
  addStudent('amina','Amina','f',SKINS.brown,'low','green','Salaam, I’m Amina. If you are lost, ask me. I know every shortcut on this campus.',{headcover:'hijab',hijab:0xeeeeea});
  addStudent('folake','Folake','f',SKINS.medium,'braids','blue','Folake. I sing in the choir. If you hear someone humming off-key in the corridor, that is also me.');
  addStudent('blessing','Blessing','f',SKINS.deep,'cornrows','green','Blessing! I’m in Green House. We are going to win inter-house this year, just watch.');
  addStudent('hauwa','Hauwa','f',SKINS.light,'low','blue','Hauwa. I keep the class register tidy, so please don’t lose your notebook.',{headcover:'hijab',hijab:0x2d4258});
  addStudent('titi','Titi','f',SKINS.brown,'bun','blue','Titi. I draw in the back of my notebook when the lesson is boring. Shh.');
  addStudent('chiamaka','Chiamaka','f',SKINS.light,'twists','green','Chiamaka, but call me Chi. First term is hard, but you’ll be fine.');

  const angDiff=(a,b)=>{let d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
  const turnToward=(n,ang,dt,rate=6)=>{const d=angDiff(ang,n.group.rotation.y);n.group.rotation.y+=d*Math.min(1,dt*rate);return Math.abs(d);};
  const faceAngle=(from,x,z)=>Math.atan2(-(x-from.x),-(z-from.z));
  function createNPC(id, parent, pos, opts={}) {
    const def=npcDefs[id]; if(!def)return null;
    const cfg={...def,...opts};
    const human=createHuman({...cfg,seed:id}); human.position.set(pos.x,0,pos.z);human.rotation.y=cfg.rotation||0;parent.add(human);
    const npc={id,def:cfg,group:human,home:{x:pos.x,z:pos.z},x:pos.x,z:pos.z,phase:Math.random()*8,rapport:state.relationships[id]??(id==='ada'?15:10),greeted:false, wander:opts.wander!==false, tick:0, anim:0,
      mode:cfg.mode||'stand',act:cfg.act||'idle',speed:0,seatHip:cfg.seatHip,look:null,ctl:null};
    addPlumbob(npc);if(parent===worldGroup)worldNPCs.push(npc);else interiorNPCs.push(npc);
    UHHumans.update(human,.016,{t:0,mode:npc.mode,act:npc.act,seatHip:npc.seatHip,rate:100});
    return npc;
  }
  function addWorldNPCs(){
    worldNPCs.splice(0,worldNPCs.length);
    createNPC('ada',worldGroup,npcDefs.ada.outside,{wander:true});
    createNPC('tunde',worldGroup,npcDefs.tunde.outside,{wander:true});
    createNPC('prefect',worldGroup,npcDefs.prefect.outside,{wander:false});
    // Students about the campus: some wander, some stand chatting in pairs
    createNPC('roommate',worldGroup,{x:-7.2,z:8.5},{wander:true});
    createNPC('hallprefect',worldGroup,{x:7.2,z:8.4},{wander:true});
    createNPC('chisom',worldGroup,{x:-9,z:-2},{wander:true});
    createNPC('sadiq',worldGroup,{x:8,z:-31},{wander:true});
    createNPC('kemi',worldGroup,{x:-3.5,z:5.5},{wander:true});
    createNPC('yusuf',worldGroup,{x:5,z:-45},{wander:true});
    createNPC('ngozi',worldGroup,{x:-20,z:-34},{wander:true});
    createNPC('femi',worldGroup,{x:19,z:-35},{wander:true});
    createNPC('amina',worldGroup,{x:25,z:-9},{wander:true});
    createNPC('blessing',worldGroup,{x:-27,z:7},{wander:true});
    createNPC('chidi',worldGroup,{x:5.4,z:15.6},{wander:false,act:'talk',rotation:-Math.PI/2+.25});
    createNPC('folake',worldGroup,{x:6.5,z:15.3},{wander:false,act:'talk',rotation:Math.PI/2+.1});
  }

  // ---- Classroom lessons -----------------------------------------------------
  let activeClass=null;
  const BOY_IDS=['tunde','sadiq','roommate','chisom','chidi','ibrahim','femi','obinna','yusuf','segun','tobi'];
  const GIRL_IDS=['ada','kemi','ngozi','amina','folake','blessing','hauwa','titi','chiamaka'];
  const pick=(a)=>a[Math.floor(Math.random()*a.length)];
  function roster(roomId,n,must=[]){
    const r=UHHumans.rng(UHHumans.hashStr(roomId));
    const sh=(a)=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
    let boys=sh(BOY_IDS),girls=sh(GIRL_IDS);const out=[];
    for(const m of must){out.push(m);boys=boys.filter(x=>x!==m);girls=girls.filter(x=>x!==m);}
    // alternate boys and girls so every row is mixed
    out.sort((a,b)=>(BOY_IDS.includes(a)?0:1)-(BOY_IDS.includes(b)?0:1));
    const mixed=[];let bi=0,gi=0;const bs=out.filter(x=>BOY_IDS.includes(x)),gs=out.filter(x=>GIRL_IDS.includes(x));
    while(mixed.length<n){const takeBoy=mixed.length%2===0;let id=takeBoy?(bs[bi++]||boys.shift()):(gs[gi++]||girls.shift());if(!id)id=boys.shift()||girls.shift();if(!id)break;mixed.push(id);}
    return mixed;
  }
  const deskSeats=()=>{const s=[];for(let row=0;row<3;row++)for(let col=0;col<4;col++)s.push({x:-5.9+col*3.9,z:-2.1+row*2.15+.73,mode:'sit'});return s;};
  const benchSeats=()=>{const s=[];for(const z0 of [-3.6,-.1,3.3])for(const x of [-4.5,-1.5,1.5,4.5])s.push({x,z:z0+.95,mode:'stand'});return s;};
  const artSeats=()=>{const s=[];for(const x of [-5,-2.5,0,2.5,5])for(const dx of [-.45,.45])s.push({x:x+dx,z:2.05,mode:'stand'});return s;};
  const DESK_PATROL=[{p:[1.5,-3.6]},{p:[-.05,-3.0]},{p:[-.05,-.9],stop:'point'},{p:[-.05,1.3],stop:'lean'},{p:[-.05,-.9]},{p:[-.05,-3.0]},{p:[1.5,-3.6]}];
  const BENCH_PATROL=[{p:[7,-4.5]},{p:[7,-1.5]},{p:[3,-1.5],stop:'point'},{p:[-3,-1.5],stop:'lean'},{p:[-7,-1.5]},{p:[-7,-4.5]}];
  const ART_PATROL=[{p:[7,-3]},{p:[7,-.9]},{p:[3,-.9],stop:'point'},{p:[-3,-.9],stop:'lean'},{p:[-7,-.9]},{p:[-7,-3]}];
  const deskGeo={write:[-1.2,-6.15],home:[1.7,-5.2],patrol:DESK_PATROL,seats:deskSeats};
  const LESSONS={
    math:{teacher:'teacherMath',style:'desk',label:'ALGEBRA · PRACTICE',must:['tunde','ada'],geo:deskGeo,
      board:['Simplify:  3x + 2x − 4 + 7','= (3x + 2x) + (−4 + 7)','= 5x + 3','Try:  4a + 5 − a + 2'],
      copy:['Copy this into your notebooks.','Write every step. Marks are for working.'],
      talk:['Collect the like terms first.','Never skip your working, class.','Watch the signs. One minus can ruin everything.'],
      look:['Show me your working.','Good. Check that sign again.','Neat work. Keep going.'],
      ask:['Who can simplify the last line?','Hands up. Who has the answer?'],
      ans:['Sir, it is 3a + 7!','Sir, I have it!','Is it 3a + 7, sir?'],praise:['Correct. Sit down.','Well done. Everyone, note that.']},
    english:{teacher:'teacherEnglish',style:'desk',label:'READ · THINK · WRITE',must:['ada','tunde'],geo:deskGeo,
      board:['Comprehension · read the passage twice','Q1. Find evidence in paragraph two.','Q2. Tone: calm, anxious or hopeful?','Support every answer with the text'],
      copy:['Copy the questions, then read again.','Pens ready, please.'],
      talk:['Read twice. Answer once.','The author chose every word on purpose.','Use evidence, not guesses.'],
      look:['Where is your evidence?','Good opening sentence.','Check your spelling, dear.'],
      ask:['Who can read the first sentence aloud?','Which word shows the mood?'],
      ans:['Ma, the word is “uneasy”.','Ma, I think it is hopeful.','Ma, may I answer?'],praise:['Good. That is textual evidence.','Well said. Sit down, dear.']},
    staffSchool:{teacher:'teacherCivic',style:'desk',label:'CIVIC EDUCATION',geo:deskGeo,
      board:['Civic Education','Rights and responsibilities','Respect for others and for property','Honesty builds trust'],
      copy:['Write the heading and underline it.'],
      talk:['A right always comes with a duty.','Our school is a small country. Behave like good citizens.','Respect starts with the way we greet.'],
      look:['Good point. Add an example.','Write it neatly, please.'],
      ask:['Name one responsibility of a student.','Who can give an example of honesty?'],
      ans:['Ma, to keep the school clean!','Ma, to respect teachers.','Ma, to return what we borrow.'],praise:['Excellent. That is the spirit.','Very good. Sit down.']},
    ict:{teacher:'teacherICT',style:'desk',label:'ICT · PHYSICS',geo:deskGeo,
      board:['Parts of a computer','Input → Process → Output','Save your work often!','Shortcut: Ctrl + S'],
      copy:['Note this down before you touch the keyboard.'],
      talk:['Always save before you close anything.','Hardware you can touch. Software you cannot.','Do not eat near the computers.'],
      look:['Save that file now.','Good. Try the shortcut.','Eyes on your own screen.'],
      ask:['Which one is an input device?','Who can name an output device?'],
      ans:['Sir, the keyboard!','Sir, the monitor is output.','Sir, a mouse is input!'],praise:['Correct. Well done.','Right. Everyone note that.']},
    science:{teacher:'teacherScience',style:'bench',label:null,geo:{write:[-1.2,-6.15],home:[0,-4.8],patrol:BENCH_PATROL,seats:benchSeats,demo:true},
      board:['Observation & measurement','Observe → Measure → Record','Mass is measured in grams or kg','Never taste unknown liquids'],
      copy:['Record the heading in your practical notebook.'],
      talk:['A scientist observes before concluding.','Record exactly what you see.','Careful hands. Calm hands.'],
      demo:['Watch the level of the liquid, not my hands.','Observe first. Then we measure.'],
      look:['Write down what you observe.','Careful with that glassware.','Good. Record the reading.'],
      ask:['What did you observe in the beaker?','Who can read the measurement?'],
      ans:['Sir, it is 40 millilitres.','Sir, the colour did not change.','Sir, the level went up!'],praise:['Good observation.','Correct. Record it.']},
    artRoom:{teacher:'teacherArts',style:'bench',noBoard:true,label:null,geo:{home:[0,-3.3],patrol:ART_PATROL,seats:artSeats},
      board:[],copy:[],
      talk:['Project your voice to the back row!','Let the colours tell the story.','Again, from the top. Feel the rhythm.'],
      look:['Brave choice. I like it.','Add more colour here.','Use the whole space.'],
      ask:['Who will show the class their piece?','What story does this painting tell?'],
      ans:['Sir, it is about harvest time!','Sir, I used green for hope.','Sir, may I show mine?'],praise:['Beautiful. Class, applause!','Wonderful. That is real art.']}
  };
  function makeBoard(g,lines){
    if(typeof document==='undefined'||!lines.length)return null;
    const cv=document.createElement('canvas');cv.width=640;cv.height=170;const ctx=cv.getContext('2d');
    const tex=new THREE.CanvasTexture(cv);const m=new THREE.MeshBasicMaterial({map:tex,transparent:true});m.userData.disposeMap=true;
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(5.5,1.45),m);plane.position.set(0,2.25,-6.655);g.add(plane);
    const b={lines,shown:0,last:-1,draw(){
      const key=Math.floor(this.shown*12);if(key===this.last)return;this.last=key;
      ctx.clearRect(0,0,640,170);ctx.font='600 24px "Space Grotesk","DM Sans",sans-serif';ctx.fillStyle='rgba(244,243,232,.93)';ctx.textBaseline='middle';
      lines.forEach((ln,i)=>{const f=clamp(this.shown-i,0,1);if(f<=0)return;ctx.save();ctx.beginPath();ctx.rect(14,i*41+4,612*f,40);ctx.clip();ctx.fillText(ln,18,i*41+26);ctx.restore();});
      tex.needsUpdate=true;}};
    b.draw();return b;
  }
  function makeBubble(parent){
    if(typeof document==='undefined')return null;
    const cv=document.createElement('canvas');cv.width=512;cv.height=140;const ctx=cv.getContext('2d');
    const tex=new THREE.CanvasTexture(cv);const mt=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});mt.userData.disposeMap=true;
    const sp=new THREE.Sprite(mt);sp.scale.set(3.4,.93,1);sp.renderOrder=30;sp.visible=false;parent.add(sp);
    return {sp,t:0,owner:null,
      show(owner,text,dur=3.6){
        this.owner=owner;this.t=dur;ctx.clearRect(0,0,512,140);
        ctx.fillStyle='rgba(250,247,238,.96)';ctx.strokeStyle='rgba(23,43,58,.9)';ctx.lineWidth=3;
        const x=6,y=6,w=500,h=108,r=18;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(238,y+h-1);ctx.lineTo(256,y+h+20);ctx.lineTo(274,y+h-1);ctx.closePath();ctx.fill();
        ctx.fillStyle='#b8862b';ctx.font='700 19px "DM Sans",sans-serif';ctx.textBaseline='alphabetic';ctx.fillText(owner.def.name.toUpperCase(),24,36);
        ctx.fillStyle='#172b3a';ctx.font='600 25px "DM Sans",sans-serif';
        const lines=[];let line='';for(const wd of text.split(' ')){const test=line?line+' '+wd:wd;if(ctx.measureText(test).width>460&&line){lines.push(line);line=wd;}else line=test;}lines.push(line);
        lines.slice(0,2).forEach((ln,i)=>ctx.fillText(ln,24,70+i*32));
        tex.needsUpdate=true;sp.visible=true;},
      update(dt){if(this.t>0){this.t-=dt;if(this.t<=0)sp.visible=false;}
        if(sp.visible&&this.owner){const rg=this.owner.group.userData.rig;sp.position.set(this.owner.x,(rg?rg.topY:2)+1.05,this.owner.z);}}};
  }
  const say=(cls,owner,text,dur)=>{if(cls.bubble&&owner)cls.bubble.show(owner,text,dur);};
  function nearestStudent(cls,x,z){let best=null,bd=1e9;for(const s of cls.students){const d=Math.hypot(s.x-x,s.z-z);if(d<bd){bd=d;best=s;}}return best;}
  // The teacher repeats a lesson: write on the board → explain → walk the room → ask a question → wipe the board
  function teacherCycle(cls){
    const L=cls.L,G=L.geo,S=[];
    const phase=(p)=>({run(){cls.phase=p;return true;}});
    const go=(x,z,spd=1.5)=>({run(n,dt){const dx=x-n.x,dz=z-n.z,d=Math.hypot(dx,dz);if(d<.12){n.speed=0;return true;}n.x+=dx/d*spd*dt;n.z+=dz/d*spd*dt;turnToward(n,Math.atan2(-dx,-dz),dt,8);n.speed=spd;n.act='idle';return false;}});
    const face=(a)=>({run(n,dt){n.speed=0;n.act='idle';return turnToward(n,a,dt,7)<.08;}});
    const hold=(act,dur,lines)=>({t:0,run(n,dt){if(this.t===0&&lines&&lines.length)say(cls,n,pick(lines));this.t+=dt;n.speed=0;n.act=act;return this.t>=dur;}});
    const stop=(kind)=>({t:0,tgt:null,run(n,dt){
      if(!this.tgt){this.tgt=nearestStudent(cls,n.x,n.z);say(cls,n,pick(L.look));}
      if(this.tgt)turnToward(n,faceAngle(n,this.tgt.x,this.tgt.z),dt,7);
      this.t+=dt;n.speed=0;n.act=kind==='lean'?'lean_over':'teach_point';return this.t>=3.4;}});
    const write={t:0,run(n,dt){n.speed=0;n.act='teach_write';if(this.t===0)say(cls,n,pick(L.copy));this.t+=dt;
      const B=cls.board;if(!B)return this.t>6;B.shown=Math.min(L.board.length,B.shown+dt/3);B.draw();return B.shown>=L.board.length&&this.t>1;}};
    const ask={t:0,ph:0,pk:null,said:false,run(n,dt){
      n.speed=0;
      if(this.ph===0){cls.raise=new Set(cls.students.slice().sort(()=>Math.random()-.5).slice(0,3));say(cls,n,pick(L.ask),3);this.ph=1;this.t=0;}
      this.t+=dt;
      if(this.ph===1){n.act='teach_explain';if(this.t>3){this.pk=[...cls.raise][0];this.ph=2;this.t=0;}}
      else if(this.ph===2){n.act='teach_point';if(this.pk)turnToward(n,faceAngle(n,this.pk.x,this.pk.z),dt,6);
        if(this.t>.5&&!this.said){this.said=true;say(cls,this.pk,pick(L.ans),2.8);}
        if(this.t>3.2){say(cls,n,pick(L.praise),2.6);cls.raise.clear();this.ph=3;this.t=0;}}
      else{n.act='teach_explain';if(turnToward(n,Math.PI,dt,4)>.1||this.t<2.4)return false;return true;}
      return false;}};
    const clear={run(){if(cls.board){cls.board.shown=0;cls.board.last=-1;cls.board.draw();}return true;}};
    S.push(phase('write'));
    if(!L.noBoard)S.push(go(G.write[0],G.write[1]),face(0),write);
    S.push(phase('explain'),go(G.home[0],G.home[1]),face(Math.PI));
    if(G.demo)S.push(hold('bench',6,L.demo));
    S.push(hold('teach_explain',9,L.talk),phase('walk'));
    for(const w of G.patrol){S.push(go(w.p[0],w.p[1]));if(w.stop)S.push(stop(w.stop));}
    S.push(go(G.home[0],G.home[1]),face(Math.PI),phase('ask'),ask,clear);
    return S;
  }
  function studentCtl(cls){
    const bench=cls.L.style==='bench';const wr=bench?'bench':'desk_write',ls=bench?'bench_watch':'desk_listen';
    return (me,dt)=>{
      me.speed=0;const T=cls.teacher;const lookT=()=>({y:clamp(angDiff(faceAngle(me,T.x,T.z),me.group.rotation.y),-.9,.9),x:.04});
      if(cls.raise.has(me)){me.act='raise_hand';me.look=lookT();me.sT=0;return;}
      me.sT=(me.sT===undefined?Math.random()*3:me.sT)-dt;
      if(me.sT<=0||me.act==='raise_hand'){me.sT=2.2+Math.random()*5;const pw=cls.phase==='write'?.65:cls.phase==='ask'?.15:.4;me.act=Math.random()<pw?wr:ls;}
      me.look=(me.act===ls)?lookT():null;
    };
  }
  function setupLesson(g,roomId){
    const L=LESSONS[roomId];if(!L)return;
    const cls={roomId,L,phase:'explain',raise:new Set(),students:[],teacher:null,board:null,bubble:makeBubble(g),update(dt){if(this.bubble)this.bubble.update(dt);}};
    if(!L.noBoard)cls.board=makeBoard(g,L.board);
    const G=L.geo;
    cls.teacher=createNPC(L.teacher,g,{x:G.home[0],z:G.home[1]},{wander:false,rotation:Math.PI});
    let steps=teacherCycle(cls),i=0;
    cls.teacher.ctl=(n,dt)=>{const s=steps[i];if(!s){steps=teacherCycle(cls);i=0;return;}if(s.run(n,dt))i++;};
    const seats=G.seats();const r=UHHumans.rng(UHHumans.hashStr(roomId+'seat'));
    for(let k=0;k<2;k++)seats.splice(Math.floor(r()*seats.length),1);      // a couple of empty seats
    const ids=roster(roomId,seats.length,L.must||[]);
    seats.forEach((seat,k)=>{const id=ids[k];if(!id)return;
      const npc=createNPC(id,g,{x:seat.x,z:seat.z},{wander:false,mode:seat.mode,act:seat.mode==='sit'?'desk_listen':'bench_watch',rotation:0});
      if(!npc)return;npc.ctl=studentCtl(cls);cls.students.push(npc);});
    activeClass=cls;
  }
  function disposeTree(o){o.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material&&c.material.userData&&c.material.userData.disposeMap){if(c.material.map)c.material.map.dispose();c.material.dispose();}});}
  const NPC_WALK=.95;
  function moveNPCs(dt){
    const t=performance.now()/1000;
    for(const npc of activeNPCList()){
      npc.tick+=dt;npc.anim+=dt*3;
      const talking=currentDialogue===npc;
      let speed=0,act=npc.act,look=npc.look||null;
      if(npc.ctl&&!talking){npc.ctl(npc,dt,t);act=npc.act;look=npc.look||null;speed=npc.speed||0;}
      else if(npc.wander&&!currentDialogue&&!npc.ctl){
        if(npc.tick>2.3&&Math.random()<dt*.24){npc.target={x:npc.home.x+rand(-1.6,1.6),z:npc.home.z+rand(-1.3,1.3)};npc.tick=0;}
        if(npc.target){const dx=npc.target.x-npc.x,dz=npc.target.z-npc.z,len=Math.hypot(dx,dz);if(len>.1){npc.x+=dx/len*dt*NPC_WALK;npc.z+=dz/len*dt*NPC_WALK;turnToward(npc,Math.atan2(-dx,-dz),dt,8);speed=NPC_WALK;}else npc.target=null;}
        act='idle';
      }
      if(talking){
        const pa=faceAngle(npc,player.x,player.z);
        if(npc.mode==='sit')look={y:clamp(angDiff(pa,npc.group.rotation.y),-1.1,1.1),x:.03};else turnToward(npc,pa,dt,6);
        speed=0;if(npc.mode!=='sit')act='talk';
      }
      npc.group.position.x=npc.x;npc.group.position.z=npc.z;
      UHHumans.update(npc.group,dt,{t,speed,mode:npc.mode,act,seatHip:npc.seatHip,look});
    }
    if(activeRoom&&activeClass)activeClass.update(dt);
  }

  // Room interiors ---------------------------------------------------------
  function innerWall(parent,x,y,z,w,h,d,color=0xe2dfd5){return box(parent,w,h,d,mat(color),x,y,z);}
  function makeFan(parent,x,z){
    const fan=new THREE.Group();fan.position.set(x,3.35,z);cylinder(fan,.055,.08,.2,mat(0x626a69),0,0,0,8);
    for(let i=0;i<3;i++){const a=i*2*Math.PI/3;const blade=box(fan,.15,.035,.95,mat(0x747d7b),Math.sin(a)*.44,-.12,Math.cos(a)*.44,{rz:Math.cos(a)*.12,ry:a});blade.userData.isFanBlade=true;}
    parent.add(fan);allProps.push({type:'fan',group:fan});return fan;
  }
  function addCeilingWindows(parent){
    for(const x of [-6,0,6]){
      box(parent,1.8,1.0,.08,mat(0x5e8792),x,2.65,-6.82);
      for(let i=-2;i<=2;i++)box(parent,.035,1,.04,mat(0x65716d),x+i*.34,2.65,-6.88);
    }
  }
  function desk(parent,x,z,kind='student'){
    const wood=mat(kind==='teacher'?0x79583a:0x9a704a),leg=mat(0x4b5554),top=kind==='teacher'?1.0:.78;
    box(parent,kind==='teacher'?1.8:1.35,.12,kind==='teacher'?.85:.7,wood,x,top,z);
    for(const dx of [-.52,.52])for(const dz of [-.24,.24])box(parent,.055,top-.12,.055,leg,x+dx,top/2,z+dz);
    if(kind!=='teacher'){
      box(parent,1.16,.1,.32,wood,x,.47,z+.73);
      for(const dx of [-.47,.47])box(parent,.05,.46,.05,leg,x+dx,.25,z+.73);
    }
  }
  function chair(parent,x,z,color=0x4b5c64){
    const m=mat(color);box(parent,.55,.09,.52,m,x,.48,z);box(parent,.55,.66,.08,m,x,.8,z+.23);
    for(const dx of [-.22,.22])for(const dz of [-.19,.19])box(parent,.045,.48,.045,m,x+dx,.24,z+dz);
  }
  function book(parent,x,y,z,color){
    box(parent,.15,.52,.22,mat(color),x,y,z);box(parent,.16,.035,.23,mat(0xe1d4b5),x,y-.13,z-.005);
  }
  function bunk(parent,x,z,bedColor=0x456f86){
    const metal=mat(0x8a9698),pillow=mat(0xe0ddd0),linen=mat(bedColor);
    for(const y of [.62,1.68]){
      for(const dx of [-.9,.9])for(const dz of [-.12,.65])cylinder(parent,.035,.035,1.08,metal,x+dx,y/2+.04,z+dz,7);
      box(parent,1.95,.08,.95,metal,x,y,z+.24);box(parent,1.82,.17,.82,linen,x,y+.11,z+.24);
      box(parent,.38,.13,.56,pillow,x-.63,y+.22,z+.29);
      for(const dx of [-.85,.85])box(parent,.05,.25,.05,metal,x+dx,y+.1,z-.16);
      for(const dx of [-.85,.85])box(parent,.05,.25,.05,metal,x+dx,y+.1,z+.64);
    }
    for(const dx of [-.85,.85])box(parent,.055,1.85,.06,metal,x+dx,1.0,z-.14);
    for(let y=.88;y<1.55;y+=.2)box(parent,1.8,.035,.035,metal,x,y,z-.14);
  }
  function locker(parent,x,z,color=0x52766b){
    box(parent,.72,1.9,.67,mat(color),x,.98,z);box(parent,.62,1.72,.025,mat(0x49635b),x,.98,z-.35);
    box(parent,.35,.035,.02,mat(0xa1b0a6),x,.65,z-.375);sphere(parent,.025,.025,.025,mat(0xd2bd80),x+.22,.63,z-.39,8);
    for(let i=0;i<3;i++)box(parent,.36,.025,.025,mat(0x3e5b50),x,.9+i*.3,z-.38);
  }
  function buildInterior(roomId){
    if(interiorGroup){disposeTree(interiorGroup);scene.remove(interiorGroup);interiorGroup=null;}activeClass=null;
    allProps.splice(0,allProps.length);sleepSpots.splice(0,sleepSpots.length);studySpots.splice(0,studySpots.length);sitSpots.splice(0,sitSpots.length);interiorObstacles=[];playerPosture=null;if(postureTimer){clearTimeout(postureTimer);postureTimer=null;}
    interiorNPCs.splice(0,interiorNPCs.length);
    const g=new THREE.Group();interiorGroup=g;scene.add(g);
    const roomLight=new THREE.PointLight(0xd9b783,0.38,25);roomLight.position.set(0,3.15,0);g.add(roomLight);
    // Large open ceiling cutaway: walls and roof edges frame the room but keep gameplay readable.
    const floorPalette={hostel:0x786d5c,greenHostel:0x716e5a,clinic:0x898f80,science:0x777f70,library:0x76624e,principal:0x82694f,assembly:0x75634f,dining:0x82745e,math:0x817866,english:0x817866,staffSchool:0x817866,ict:0x747a70,shop:0x82674e,artRoom:0x8a705d,workshop:0x777365,printShop:0x82725e,greatHall:0x766651,mosque:0x777e68};
    tiledFloor(g,18,14,floorPalette[roomId]||0x938b7c,roomId==='hostel'?1.4:1.6);
    const wallPalette={hostel:0x626d59,greenHostel:0x566b56,science:0x66776a,principal:0x79664f,library:0x766047,clinic:0x69786a,assembly:0x79664f,dining:0x817054,math:0x6c715c,english:0x6c715c,staffSchool:0x6c715c,ict:0x66766b,shop:0x79664f,artRoom:0x806650,workshop:0x6c6b58,printShop:0x766047,greatHall:0x766047,mosque:0x687665};
    const wallColor=wallPalette[roomId]||0x766d5c;
    innerWall(g,0,1.9,-7,18,3.8,.25,wallColor);innerWall(g,-9,1.9,0,.25,3.8,14,wallColor);innerWall(g,9,1.9,0,.25,3.8,14,wallColor);
    // front wall is split around the exit, so leaving feels like a physical doorway
    innerWall(g,-5.9,1.9,7,6.2,3.8,.25,wallColor);innerWall(g,5.9,1.9,7,6.2,3.8,.25,wallColor);innerWall(g,0,3.3,7,5.8,.9,.25,wallColor);
    // Warm lower wall panels and dark timber skirting keep interiors from reading as blank white boxes.
    const panelColor=roomId==='hostel'||roomId==='greenHostel'?0x596f5b:roomId==='science'||roomId==='clinic'?0x657c70:roomId==='math'||roomId==='english'||roomId==='staffSchool'?0x657b69:0x7a6049;
    for(const z of [-6.82,6.82])for(let x=-7.7;x<=7.71;x+=2.05)box(g,1.92,.82,.035,mat(panelColor),x,.46,z);
    for(const x of [-8.82,8.82])for(let z=-5.8;z<=5.81;z+=2.05)box(g,.035,.82,1.92,mat(panelColor),x,.46,z);
    for(const z of [-6.82,6.82])box(g,17.6,.12,.07,mat(0x4f493d),0,.08,z);
    for(const x of [-8.82,8.82])box(g,.07,.12,13.6,mat(0x4f493d),x,.08,0);
    // base trim and barred high windows
    for(const x of [-6,0,6]){
      box(g,2.1,.9,.04,mat(0x69909a),x,2.65,-6.84);
      for(let i=-2;i<=2;i++)box(g,.035,.95,.04,mat(0x596a6b),x+i*.38,2.65,-6.88);
      box(g,2.15,.05,.07,mat(0x81745f),x,3.15,-6.86);
    }
    addLabel(g,roomNames[roomId]||'UNITY HEIGHTS',0,3.48,-6.83,5,.42,'#213d49','#f6d18a');
    // Door inner leaf and handle, open at the threshold
    box(g,1.7,2.25,.08,mat(0x674936),-.72,1.12,6.78,{ry:-.92});box(g,.06,2.25,.09,mat(0xa68a58),-1.36,1.12,6.43,{ry:-.92});
    // Collision boxes are aligned to the visible furniture, with small clearance for the player capsule.
    if(['math','english','staffSchool','ict'].includes(roomId)){
      if(roomId==='math'||roomId==='english')interiorObstacles.push({x:0,z:-4.35,w:1.9,d:1.0});
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){const x=-5.9+col*3.9,z=-2.1+row*2.15;interiorObstacles.push({x,z,w:1.48,d:.78});sitSpots.push({x,z:z+1.18,face:0,seatHip:.615,label:'Sit at desk',study:roomId==='math'||roomId==='english'||roomId==='staffSchool'||roomId==='ict'});}
    }
    if(roomId==='hostel'||roomId==='greenHostel'){
      for(const x of [-6,0,6])for(const z of [-4,0,4])interiorObstacles.push({x,z:z+.24,w:1.92,d:.92});
      for(const x of [-7.1,7.1])for(const z of [-3,0,3])interiorObstacles.push({x,z,w:.88,d:.78});
    }
    if(roomId==='dining'){for(const z of [-4,0,4]){interiorObstacles.push({x:0,z,w:12.15,d:1.35});for(const side of [-1,1]){interiorObstacles.push({x:0,z:z+side*1.05,w:11.1,d:.48});for(const x of [-4.5,-1.5,1.5,4.5])sitSpots.push({x,z:z+side*1.55,face:side===1?0:Math.PI,seatHip:.615,label:'Sit at dining bench'});}}}
    if(roomId==='library'){for(let row=0;row<2;row++)interiorObstacles.push({x:-7,z:-1+row*3,w:.82,d:10.2},{x:7,z:-1+row*3,w:.82,d:10.2});for(const z of [-3,1,4]){interiorObstacles.push({x:0,z,w:7.1,d:1.2});sitSpots.push({x:0,z:z+1.02,face:Math.PI,seatHip:.615,label:'Sit at reading table',study:true,room:roomId});}}
    if(roomId==='science')for(const z of [-3.6,-.1,3.3])interiorObstacles.push({x:0,z,w:12.15,d:1.45});
    if(roomId==='assembly'||roomId==='greatHall'||roomId==='artRoom'){
      for(let row=0;row<(roomId==='assembly'?4:3);row++)for(let col=0;col<(roomId==='assembly'?7:6);col++){
        const x=roomId==='assembly'?-7.1+col*2.35:-6.2+col*2.45,z=roomId==='assembly'?-2.8+row*2.1:-2.5+row*2.25;
        if(roomId==='assembly'&&col===3)continue;
        interiorObstacles.push({x,z,w:.7,d:.68});sitSpots.push({x,z:z+.72,face:0,seatHip:.615,label:'Sit on a chair'});
      }
      interiorObstacles.push({x:0,z:-5.3,w:11,d:2.35});
    }
    if(roomId==='principal'){
      interiorObstacles.push({x:0,z:-2.4,w:3.7,d:1.5});
      for(const x of [-5.5,5.5])interiorObstacles.push({x,z:-5.4,w:1.8,d:.9});
      for(const x of [-1.8,1.8]){interiorObstacles.push({x,z:.3,w:.62,d:.62});sitSpots.push({x,z:1.15,face:0,seatHip:.615,label:'Sit in the visitor chair'});}
      for(const x of [-6,6])interiorObstacles.push({x,z:3,w:1.1,d:.9});
    }
    if(roomId==='clinic')for(const z of [-3,1.5])interiorObstacles.push({x:-4,z,w:2.25,d:3.35});
    if(roomId==='shop'){for(const x of [-6,-3,0])interiorObstacles.push({x,z:-4.9,w:1.5,d:.85});interiorObstacles.push({x:5,z:-3.1,w:4.8,d:1.1});}
    if(roomId==='printShop'||roomId==='workshop')for(const x of [-5,0,5])interiorObstacles.push({x,z:-2,w:3.2,d:1.7});
    if(roomId==='mosque')for(let x=-5;x<=5;x+=2.5)interiorObstacles.push({x,z:0,w:1.6,d:2.2});
    // Main room furnishings and role-specific NPCs
    if(roomId==='math'||roomId==='english'){
      box(g,5.9,1.65,.12,mat(0x2d5e4b),0,2.25,-6.73);box(g,6.05,.08,.2,mat(0x6f583b),0,1.4,-6.6);
      // chalk lines / subject heading
      
      addLabel(g,roomId==='math'?'ALGEBRA · PRACTICE':'READ · THINK · WRITE',0,3.26,-6.62,3.2,.3,'#2d5e4b','#f6f0d9');
      desk(g,0,-4.35,'teacher');
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){const x=-5.9+col*3.9;const z=-2.1+row*2.15;desk(g,x,z);if((row+col)%2===0){box(g,.46,.045,.32,mat(0xefe9d8),x-.3,.86,z-.03);box(g,.32,.035,.24,mat(0xb9c6b6),x+.2,.85,z-.03);}studySpots.push({x,z,room:roomId});}
      for(let x of [-6,0,6])makeFan(g,x,-1);
      
    } else if(roomId==='science'){
      box(g,5.7,1.45,.13,mat(0x255642),0,2.22,-6.72);addLabel(g,'BASIC SCIENCE',0,2.65,-6.6,3,.36,'#255642','#f0ead8');
      for(const z of [-3.6,-.1,3.3]){box(g,12,.13,1.25,mat(0x6f644e),0,1.0,z);for(const x of [-5,0,5]){box(g,.08,.94,.08,mat(0x4c5d5b),x,.48,z-.42);box(g,.08,.94,.08,mat(0x4c5d5b),x,.48,z+.42);}for(const x of [-4,0,4]){cylinder(g,.13,.15,.26,mat(0x739a9e,.2,{transparent:true,opacity:.65}),x,1.2,z,12);cylinder(g,.07,.1,.4,mat(0x88afb5,.2,{transparent:true,opacity:.6}),x+1,1.28,z+.05,12);}}
      
      for(const x of [-6,0,6])makeFan(g,x,0);
    } else if(roomId==='assembly'){
      box(g,10,.55,2,mat(0x806044),0,.27,-5.3);box(g,11,.14,2.3,mat(0x9b7953),0,.62,-5.3);
      box(g,.72,1.45,.6,mat(0x6d4a32),0,1.3,-5.5);box(g,.62,.12,.55,mat(0xa9824c),0,2.03,-5.5);
      // stage drapes and school crest
      box(g,15,2.65,.15,mat(0x254a6d),0,2.2,-6.7);box(g,8,1.8,.08,mat(0x193754),0,2.1,-6.59);addLabel(g,'UNITY HEIGHTS',0,2.45,-6.52,3,.44,'#1d3f5b','#f5d18a');
      for(let row=0;row<4;row++)for(let col=0;col<7;col++){const x=-7.1+col*2.35;const z=-2.8+row*2.1;if(col===3)continue;chair(g,x,z,row%2?0x424f55:0x46555d);}
      createNPC('hallprefect',g,{x:5,z:2.6},{wander:false});createNPC('prefect',g,{x:-5,z:2.6},{wander:false});makeFan(g,-5,-1);makeFan(g,5,-1);
    } else if(roomId==='hostel'){
      // Painted bunk beds, mosquito-net-like upper rails, lockers and packed trunks
      for(const x of [-6,0,6])for(const z of [-4,0,4])bunk(g,x,z,(x+z)%2?0x466a81:0x65826d);
      for(const x of [-7.1,7.1])for(const z of [-3,0,3])locker(g,x,z,0x4f7566);
      for(const x of [-5,0,5])makeFan(g,x,0);
      box(g,2.6,.55,1.0,mat(0x71553d),0,.29,5.1);box(g,2.6,.12,1,mat(0x997553),0,.62,5.1);box(g,1.3,.45,.06,mat(0x354c56),0,.86,4.55);
      addLabel(g,'BLUE HOUSE · KEEP IT TIDY',0,1.13,4.52,2.3,.25,'#294b42','#f1d291');
      sleepSpots.push({x:-4.45,z:5.2,bed:'Your bunk',bedX:-6,bedZ:4.24});
      createNPC('prefect',g,{x:-1.5,z:-4.6},{wander:false});createNPC('roommate',g,{x:2.8,z:1.5},{wander:false});createNPC('tunde',g,{x:6.1,z:-1.7},{wander:false});
    } else if(roomId==='dining'){
      for(const z of [-4,0,4]){
        box(g,12,.15,1.25,mat(0x8b623d),0,.93,z);
        for(const x of [-5,0,5])box(g,.12,.9,.12,mat(0x525752),x,.45,z);
        for(const side of [-1,1]){box(g,11,.12,.43,mat(0x8e714e),0,.57,z+side*1.05);for(const x of [-4.5,-1.5,1.5,4.5])box(g,.08,.52,.08,mat(0x555957),x,.28,z+side*1.05);}
        for(const x of [-4,0,4]){cylinder(g,.18,.18,.06,mat(0xd9d9cb),x,1.04,z,16);cylinder(g,.07,.07,.13,mat(0x7ca2ad,.18,{transparent:true,opacity:.65}),x+ .4,1.08,z,12);}
      }
      box(g,2.3,1.5,.7,mat(0x9a876a),6, .75,-4.3);box(g,2.4,.13,.8,mat(0xd7c8a7),6,1.55,-4.3);addLabel(g,'TODAY’S MENU',6,1.92,-4.68,1.95,.28,'#65503a','#ffdda1');
      createNPC('diningStaff',g,{x:6,z:-3.5},{wander:false});const diner=(id,x,z,north)=>createNPC(id,g,{x,z:z+(north?-1.05:1.05)},{wander:false,mode:'sit',seatHip:.72,act:'dine',rotation:north?Math.PI:0});diner('ada',-4.5,0,false);diner('tunde',-1.5,0,true);diner('chidi',1.5,-4,false);diner('ngozi',-3,-4,true);diner('femi',3,4,false);diner('blessing',-3,4,true);diner('ibrahim',4.5,0,true);makeFan(g,-5,-1);makeFan(g,5,-1);
    } else if(roomId==='library'){
      for(const x of [-7,7]){
        box(g,.6,2.5,10,mat(0x6b5139),x,1.25,-1);for(let i=0;i<4;i++){box(g,.66,.08,10,mat(0x886849),x, .42+i*.57,-1);for(let j=0;j<7;j++)book(g,x+rand(-.18,.18),.69+i*.57, -5+j*1.28,choose([0x6a4a3c,0x34566a,0x806b3f,0x537260,0x9c5145]));}
      }
      for(const z of [-3,1,4]){box(g,7,.13,1.15,mat(0x805e3f),0,.91,z);for(const x of [-2.8,2.8])box(g,.12,.9,.12,mat(0x565c57),x,.44,z);for(const x of [-2,0,2]){box(g,.4,.06,.28,mat(0xe5decc),x,.99,z-.1);book(g,x+.3,1.2,z-.1,0x475c68);}studySpots.push({x:0,z,room:roomId});}
      createNPC('librarian',g,{x:-2,z:-4.7},{wander:false,act:'hold_book'});createNPC('ada',g,{x:2.5,z:1},{wander:false,act:'hold_book'});
    } else if(roomId==='principal'){
      box(g,3.5,.18,1.3,mat(0x674a32),0,1.05,-2.4);box(g,3.6,.12,1.35,mat(0x99724b),0,1.19,-2.4);box(g,1.2,.7,.05,mat(0x253e53),0,1.68,-3.0);addLabel(g,'UNITY HEIGHTS',0,1.72,-2.96,1,.18,'#273f55','#f1d28a');
      for(const x of [-5.5,5.5]){box(g,1.6,2.2,.7,mat(0x836746),x,1.1,-5.4);for(let i=0;i<4;i++)box(g,1.6,.07,.72,mat(0x9c845c),x, .35+i*.5,-5.4);}
      for(const x of [-1.8,1.8])chair(g,x,0.3,0x485968);
      box(g,1,.12,.8,mat(0x6c5138),-6,.9,3);box(g,1,.12,.8,mat(0x6c5138),6,.9,3);
      createNPC('principal',g,{x:0,z:-2.0},{wander:false});
    } else if(roomId==='clinic'){
      for(const z of [-3,1.5]){
        box(g,2.1,.18,3.2,mat(0x9caaa0),-4,.65,z);box(g,1.9,.18,2.95,mat(0xe9eee8),-4,.78,z);box(g,.65,.19,.7,mat(0xfaf7eb),-4, .93,z-1.05);
        for(const x of [-4.8,-3.2])for(const dz of [-1.4,1.4])cylinder(g,.04,.04,.65,mat(0x777f7b),x,.32,z+dz,7);
      }
      box(g,2.7,1.5,.9,mat(0x789184),5,.75,-4.6);box(g,2.8,.12,1,mat(0xc4d1c6),5,1.55,-4.6);box(g,1,.8,.08,mat(0xf1f3e9),5,2.15,-4.6);addLabel(g,'FIRST AID',5,2.15,-4.54,.8,.2,'#eef0e5','#47735d');
      createNPC('nurse',g,{x:2,z:-3.6},{wander:false});
    }
    else if(roomId==='shop'){
      for(const x of [-6,-3,0]){box(g,1.35,2.1,.72,mat(0x866344),x,1.05,-4.9);for(let row=0;row<3;row++){box(g,1.25,.08,.74,mat(0xc29b64),x,.55+row*.58,-4.49);for(let j=0;j<4;j++)box(g,.18,.34,.22,mat([0x4b7185,0x9d6b42,0x6d8a68,0x9a9a88][(j+row)%4]),x-.45+j*.3,.75+row*.58,-4.38);}}
      box(g,4.5,1.05,.9,mat(0x805a39),5,.55,-3.1);box(g,4.7,.1,1,mat(0xb48b54),5,1.1,-3.1);addLabel(g,'PAY HERE',5,1.45,-3.1,1.4,.25,'#715037','#f3dfb6');
      createNPC('shopkeeper',g,{x:4.5,z:-4.2},{wander:false});createNPC('kemi',g,{x:-1.5,z:1.6},{wander:false});
    } else if(roomId==='staffSchool'||roomId==='ict'){
      box(g,5.9,1.65,.12,mat(0x2d5e4b),0,2.25,-6.73);addLabel(g,roomId==='ict'?'ICT · PHYSICS':'CIVIC EDUCATION',0,3.26,-6.62,3.3,.32,'#2d5e4b','#f6f0d9');
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){const x=-5.9+col*3.9,z=-2.1+row*2.15;desk(g,x,z);studySpots.push({x,z,room:roomId});}
      if(roomId==='ict'){for(let row=0;row<3;row++)for(let col=0;col<4;col++){const mx=-5.9+col*3.9,mz=-2.1+row*2.15;box(g,.46,.3,.04,mat(0x1d2b33),mx,1.1,mz-.12);box(g,.08,.14,.08,mat(0x4a5558),mx,.9,mz-.12);box(g,.4,.025,.14,mat(0xd9d7cd),mx,.855,mz+.12);}}
      for(const x of [-6,0,6])makeFan(g,x,-1);
    } else if(roomId==='greenHostel'){
      for(const x of [-6,0,6])for(const z of [-4,0,4])bunk(g,x,z,(x+z)%2?0x466a81:0x65826d);
      for(const x of [-7.1,7.1])for(const z of [-3,0,3])locker(g,x,z,0x4f7566);for(const x of [-5,0,5])makeFan(g,x,0);
      addLabel(g,'GREEN HOUSE · KEEP IT TIDY',0,1.13,4.52,2.5,.25,'#294b42','#f1d291');sleepSpots.push({x:-4.45,z:5.2,bed:'Your bunk',bedX:-6,bedZ:4.24});
      createNPC('prefect',g,{x:-1.5,z:-4.6},{wander:false});createNPC('roommate',g,{x:2.8,z:1.5},{wander:false});createNPC('chisom',g,{x:6.1,z:-1.7},{wander:false});
    } else if(roomId==='greatHall'||roomId==='artRoom'){
      box(g,10,.55,2,mat(0x806044),0,.27,-5.3);box(g,11,.14,2.3,mat(0x9b7953),0,.62,-5.3);box(g,15,2.65,.15,mat(roomId==='artRoom'?0x785b76:0x254a6d),0,2.2,-6.7);
      addLabel(g,roomId==='artRoom'?'CREATE · REHEARSE · SHARE':'UNITY HEIGHTS GREAT HALL',0,2.45,-6.52,4.3,.38,'#1d3f5b','#f5d18a');
      for(let row=0;row<3;row++)for(let col=0;col<6;col++)chair(g,-6.2+col*2.45,-2.5+row*2.25,row%2?0x424f55:0x46555d);
      if(roomId==='greatHall')createNPC('hallprefect',g,{x:5,z:2.6},{wander:false});else{for(let x=-5;x<=5;x+=2.5){box(g,1.6,.12,1.2,mat(0x8a6c48),x,.8,1);sphere(g,.22,.16,.15,mat([0xb95f48,0x668a68,0x5f7898][Math.abs(Math.round(x))%3]),x,1,1,10);}}
    } else if(roomId==='mosque'){
      box(g,5.6,2.7,.15,mat(0x598074),0,1.45,-6.7);addLabel(g,'QUIET SPACE',0,2.35,-6.58,2.1,.28,'#456d60','#f8f1da');for(let x=-5;x<=5;x+=2.5){box(g,1.5,.06,2.1,mat(0xb8b29f),x,.07,0);box(g,1.5,.03,.16,mat(0x456d60),x,.11,-.9);}createNPC('hallprefect',g,{x:4,z:1.7},{wander:false});
    } else if(roomId==='printShop'||roomId==='workshop'){
      for(let x=-5;x<=5;x+=5){box(g,3,.14,1.5,mat(0x6c6255),x,.9,-2);box(g,1.2,.8,.9,mat(0x7e8984),x,1.34,-2);box(g,1.05,.07,.75,mat(0x394d51),x,1.78,-2);}for(let row=0;row<2;row++)for(let col=0;col<5;col++)box(g,.36,.055,.5,mat(0xe4ded1),-5.8+col*1.2,.3+row*.12,3.8);createNPC('technician',g,{x:0,z:-.7},{wander:false,act:'bench'});createNPC('sadiq',g,{x:4.2,z:-.7},{wander:false,act:'bench'});
    }
    if(LESSONS[roomId])setupLesson(g,roomId);   // teacher + students, lesson in progress
    // Furniture remains visible; NPCs feel like they're part of the room.
    return g;
  }

  // Player and traversal ----------------------------------------------------
  let player={group:null,x:0,z:23,speed:4.6,anim:0,dir:0};
  function createPlayer(){
    if(player.group)playerGroup.remove(player.group);
    const girl=state.gender==='f';const avatar=createHuman({gender:girl?'f':'m',skirt:girl,skin:SKINS[state.skin]||SKINS.deep,hairStyle:state.hair||(girl?'cornrows':'low'),shirt:0xf3f0e8,pants:0x223c58,tie:HOUSE_TIE.blue,backpack:false,necktie:true,seed:'player-'+(state.name||'')});
    player.group=avatar;playerGroup.add(avatar);player.x=state.position?.x??0;player.z=state.position?.z??23;avatar.position.set(player.x,0,player.z);
    $('profile-name').textContent=state.name;$('profile-portrait').textContent=(state.name||'S').slice(0,1).toUpperCase();
  }
  function activeNPCList(){return activeRoom?interiorNPCs:worldNPCs;}
  function movePlayer(dt){
    if(playerPosture && (keyState.KeyW||keyState.KeyA||keyState.KeyS||keyState.KeyD||keyState.ArrowUp||keyState.ArrowDown||keyState.ArrowLeft||keyState.ArrowRight)){standPlayerUp();}
    if(!gameStarted||paused||currentDialogue||isAnyModalOpen()){if(gameStarted&&!paused&&player.group)UHHumans.update(player.group,dt,{t:performance.now()/1000,speed:0});return;}if(aerialMode){playerMoving=false;return;}
    let pSpeed=0,pRun=false;
    let fwd=0,side=0;if(keyState.KeyW||keyState.ArrowUp)fwd+=1;if(keyState.KeyS||keyState.ArrowDown)fwd-=1;if(keyState.KeyA||keyState.ArrowLeft)side-=1;if(keyState.KeyD||keyState.ArrowRight)side+=1;
    const mag=Math.hypot(fwd,side);playerMoving=mag>0;
    if(mag){fwd/=mag;side/=mag;const forward={x:-Math.sin(yaw),z:-Math.cos(yaw)},right={x:Math.cos(yaw),z:-Math.sin(yaw)};
      let vx=(forward.x*fwd+right.x*side),vz=(forward.z*fwd+right.z*side);
      const sprint=keyState.ShiftLeft||keyState.ShiftRight;const tired=state.energy<10?.78:1;const speed=player.speed*(sprint?1.52:1)*tired;pSpeed=speed;pRun=!!sprint;const nx=player.x+vx*speed*dt,nz=player.z+vz*speed*dt;
      const allowed=canOccupy(nx,nz);if(allowed){player.x=nx;player.z=nz;}else{if(canOccupy(nx,player.z))player.x=nx;if(canOccupy(player.x,nz))player.z=nz;}
      player.dir=Math.atan2(-vx,-vz);player.group.rotation.y=player.dir;player.anim+=dt*(sprint?12:8);if(sprint&&Math.random()<dt*.12)state.energy=Math.max(0,state.energy-.1);
    }
    UHHumans.update(player.group,dt,{t:performance.now()/1000,speed:pSpeed,run:pRun,mode:playerPosture==='sit'?'sit':undefined,seatHip:playerPosture==='sit'?.615:undefined,act:playerPosture==='sit'?'desk_listen':'idle'});
    if(activeRoom){player.x=clamp(player.x,-8.1,8.1);player.z=clamp(player.z,-6.15,6.15);}
    else{player.x=clamp(player.x,-45,45);player.z=clamp(player.z,-68,38);}
    player.group.position.set(player.x,0,player.z);
  }
  function standPlayerUp(){if(postureTimer){clearTimeout(postureTimer);postureTimer=null;}playerPosture=null;if(player.group){player.group.rotation.z=0;player.group.position.y=0;}toast('You stand up.');}
  function sitPlayer(spot){if(!player.group||!spot)return;const sx=spot.x,sz=spot.z;if(activeRoom&&!canOccupy(sx,sz)){toast('Move to the open side of the seat and try again.');return;}playerPosture='sit';player.x=sx;player.z=sz;player.group.position.set(player.x,0,player.z);player.group.rotation.set(0,spot.face??0,0);yaw=spot.face??0;toast('You sit down. Move with WASD to stand up.');if(spot.study){studyAtDesk({room:spot.room||activeRoom||'library'});}}
  function canOccupy(x,z){
    if(activeRoom){
      if(!(x>-8.25&&x<8.25&&z>-6.25&&z<6.2))return false;
      // Keep the character capsule out of solid furniture while allowing movement between rows.
      for(const o of interiorObstacles){if(x>o.x-o.w/2-.20&&x<o.x+o.w/2+.20&&z>o.z-o.d/2-.20&&z<o.z+o.d/2+.20)return false;}
      return true;
    }
    for(const b of buildings){
      const withinX=Math.abs(x-b.x)<b.w/2+.42,withinZ=Math.abs(z-b.z)<b.d/2+.42;
      if(withinX&&withinZ){const doorZone=Math.abs(x-b.x)<1.15&&z>b.frontZ-.8&&z<b.frontZ+1.8;if(!doorZone)return false;}
    }
    // outside campus walls/gate limits but allow walking through the main gate
    return x>-48&&x<48&&z>-72&&z<36;
  }
  function updateCamera(dt){
    if(aerialMode&&!activeRoom){const target=new THREE.Vector3(0,aerialHeight,-17);camera.position.lerp(target,1-Math.exp(-dt*2.4));camera.lookAt(0,0,-17);camera.fov=55;camera.updateProjectionMatrix();return;}
    const distance=activeRoom?9.1:9.8,height=activeRoom?5.0:5.8;
    const desired=new THREE.Vector3(player.x+Math.sin(yaw)*distance,player.group.position.y+height+cameraPitch*distance,player.z+Math.cos(yaw)*distance);
    camera.position.lerp(desired,1-Math.exp(-dt*5.5));
    camera.lookAt(player.x,1.18,player.z-.7);
    camera.fov=keyState.ShiftLeft||keyState.ShiftRight?61:58;camera.updateProjectionMatrix();
  }
  function enterRoom(roomId){
    if(!roomId)return;
    const b=buildings.find(b=>b.id===roomId);if(!b)return;
    savedOutsidePosition={x:player.x,z:player.z};state.position={...savedOutsidePosition};playerPosture=null;
    worldGroup.visible=false;activeRoom=roomId;buildInterior(roomId);player.x=0;player.z=5.45;player.group.position.set(0,0,5.45);yaw=0;
    $('location-name').textContent=roomNames[roomId]||'Inside School';$('hud').classList.remove('hidden');
    toast(`Entered ${roomNames[roomId]}. ${roomBlurb[roomId]}`);
    if(roomId==='dining'&&state.meals<1){completeQuest('meal');}
    if(roomId==='hostel'&&state.hasSlept){};
    addJournal(`Entered ${roomNames[roomId]}.`,`${roomBlurb[roomId]}`);
    refreshUI();
  }
  function exitRoom(){
    if(!activeRoom)return;
    const was=activeRoom;playerPosture=null;disposeTree(interiorGroup);scene.remove(interiorGroup);interiorGroup=null;activeClass=null;activeRoom=null;worldGroup.visible=true;interiorNPCs.splice(0,interiorNPCs.length);
    player.x=savedOutsidePosition.x;player.z=savedOutsidePosition.z;player.group.position.set(player.x,0,player.z);yaw=0;
    $('location-name').textContent='Main Campus';
    toast(`Back outside. ${roomNames[was]} is behind you.`);saveGame();
  }
  function closestBuilding(){
    if(activeRoom)return null;
    let best=null,bd=Infinity;
    for(const b of buildings){const dx=player.x-b.x,dz=player.z-(b.frontZ+1.2),d=Math.hypot(dx,dz);if(d<bd){best=b;bd=d;}}
    return bd<4.2?{building:best,distance:bd}:null;
  }
  function closestNPC(){
    let best=null,bd=Infinity;
    for(const n of activeNPCList()){const d=Math.hypot(n.x-player.x,n.z-player.z);if(d<bd){best=n;bd=d;}}
    return bd<3.1?{npc:best,distance:bd}:null;
  }
  function nearestAction(){
    if(!gameStarted||paused||aerialMode||currentDialogue||isAnyModalOpen())return null;
    if(activeRoom){
      if(player.z>5.45&&Math.abs(player.x+.72)<1.3)return {kind:'exit',distance:Math.abs(player.z-5.7),label:'Leave building',sub:'CAMPUS'};
      if(activeRoom==='hostel'||activeRoom==='greenHostel')for(const bed of sleepSpots){const d=Math.hypot(player.x-bed.x,player.z-bed.z);if(d<1.8)return {kind:'sleep',bed,distance:d,label:'Sleep until 6:00 AM',sub:'YOUR BUNK'};}
      for(const s of sitSpots){const d=Math.hypot(player.x-s.x,player.z-s.z);if(d<1.15)return {kind:'sit',spot:s,distance:d,label:s.label||'Sit down',sub:'PRESS E TO SIT'};}
      const n=closestNPC();if(n)return {kind:'npc',npc:n.npc,distance:n.distance,label:`Talk to ${n.npc.def.name}`,sub:n.npc.def.role.toUpperCase()};
      for(const s of studySpots){const d=Math.hypot(player.x-s.x,player.z-s.z);if(d<1.2)return {kind:'study',spot:s,distance:d,label:'Study at this desk',sub:'STUDY SPOT'};}
      return null;
    }
    const n=closestNPC();const b=closestBuilding();
    if(n&&(!b||n.distance<b.distance*.9))return {kind:'npc',npc:n.npc,distance:n.distance,label:`Talk to ${n.npc.def.name}`,sub:n.npc.def.role.toUpperCase()};
    if(b)return {kind:'building',building:b.building,distance:b.distance,label:`Enter ${roomNames[b.building.id]}`,sub:'PRESS E TO EXPLORE'};
    // Outdoor sitting spots: use the clear approach side of the courtyard benches/chairs.
    const outdoorSeats=[{x:-15,z:6.0,face:0,label:'Sit on courtyard bench'},{x:19,z:6.0,face:0,label:'Sit on courtyard bench'},{x:-21,z:-26.9,face:Math.PI,label:'Sit on courtyard bench'},{x:20,z:-26.9,face:Math.PI,label:'Sit on courtyard bench'},{x:-22,z:-40.9,face:Math.PI,label:'Sit on courtyard bench'},{x:21,z:-41.9,face:Math.PI,label:'Sit on courtyard bench'}];
    for(const seat of outdoorSeats){const d=Math.hypot(player.x-seat.x,player.z-seat.z);if(d<1.35)return {kind:'sit',spot:{...seat,seatHip:.615},distance:d,label:seat.label,sub:'PRESS E TO SIT'};}
    const gameDistance=Math.hypot(player.x,player.z-9);if(gameDistance<4.6)return {kind:'games',distance:gameDistance,label:'Play Nigerian schoolyard games',sub:'AYO · SUWE · TEN-TEN · FOOTBALL'};
    // field sports interaction
    if(player.z<-39&&player.z>-62&&Math.abs(player.x)<23)return {kind:'sports',distance:Math.abs(player.z+48),label:'Join a quick football drill',sub:'SPORTS FIELD'};
    return null;
  }
  function updatePrompt(){
    currentTarget=nearestAction();const hint=$('interact-hint');
    if(currentTarget){hint.classList.remove('hidden');$('interact-text').textContent=currentTarget.label;$('interact-subtext').textContent=currentTarget.sub;}
    else hint.classList.add('hidden');
  }
  function interact(){
    if(currentDialogue){return;}
    if(isAnyModalOpen())return;
    const a=currentTarget||nearestAction();if(!a){toast('Walk closer to a person, doorway or activity.');return;}
    if(a.kind==='npc')openDialogue(a.npc);
    else if(a.kind==='building')enterRoom(a.building.id);
    else if(a.kind==='exit')exitRoom();
    else if(a.kind==='sleep')$('sleep-panel').classList.remove('hidden');
    else if(a.kind==='sit')sitPlayer(a.spot);
    else if(a.kind==='study')studyAtDesk(a.spot);
    else if(a.kind==='sports')openGames('football');
    else if(a.kind==='games')openGames();
  }

  // Time, stats, goals and save -------------------------------------------
  function gameTimeString(minutes=simClock){const h=Math.floor(minutes/60)%24,m=Math.floor(minutes%60);return `${String((h%12)||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
  function as24(minutes){return `${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(Math.floor(minutes%60)).padStart(2,'0')}`;}
  function currentSchedule(){let next=schedule.find(s=>s.at>simClock);if(!next)next=schedule[0];return next;}
  function updateTime(dt){if(!gameStarted||paused||currentDialogue||isAnyModalOpen())return;
    simClock+=dt*1.2; // accelerated school clock: one full 24-hour day every 20 real minutes
    if(simClock>=24*60){simClock-=24*60;newDay(false);}
    $('clock-label').textContent=gameTimeString();$('day-label').textContent=`${DAY_NAMES[(currentDay)%7].toUpperCase()} · DAY ${dayNumber}`;
    const h=simClock/60;
    const sunrise=clamp((h-5.5)/1.0,0,1),sunset=clamp((18.5-h)/1.0,0,1),dayBlend=Math.min(sunrise,sunset);
    // The accelerated world has roughly ten real minutes of daylight and ten of night.
    // Keep interiors warm and readable while the exterior transitions to a cooler night.
    const interiorDim=activeRoom?0.34:1;sunLight.intensity=(.17+2.13*dayBlend)*interiorDim;hemiLight.intensity=(.48+1.25*dayBlend)*(activeRoom?.48:1);
    sunLight.color.set(0x9bbcff).lerp(new THREE.Color(0xffdfad),dayBlend);
    const sky=new THREE.Color(0x17233d).lerp(new THREE.Color(0xd3e3e6),dayBlend);scene.background.copy(sky);scene.fog.color.copy(sky);if(skyDome)skyDome.material.color.set(0x0a1226).lerp(new THREE.Color(0xffffff),Math.pow(dayBlend,.7));
    $('weather-icon').textContent=h<6||h>18.5?'☾':h>16?'◒':'☀';
    const next=currentSchedule();$('event-time').textContent=as24(next.at);$('event-name').textContent=next.name;$('event-place').textContent=next.place;
    if($('mobile-next-title'))$('mobile-next-title').textContent=next.name;
    if($('mobile-next-sub')){const mins=Math.max(0,Math.round(next.at-simClock));$('mobile-next-sub').textContent=mins<=2?'HAPPENING NOW':`${roomNames[next.room]||next.place} · IN ${mins} MIN`;}
  }
  function newDay(fromSleep){dayNumber++;currentDay=(currentDay+1)%7;simClock=6*60;state.energy=100;state.hasSlept=true;state.conduct=clamp(state.conduct+2,0,100);
    state.journal.unshift({time:`DAY ${dayNumber} · 06:00 AM`,title:'A fresh morning',body:fromSleep?'You slept through the night. Your energy is back, your uniform is ready, and a new school day has begun.':'Morning has arrived at Unity Heights.'});state.journal=state.journal.slice(0,20);
    toast(`Good morning! Day ${dayNumber} starts now. Energy restored.`);showNotice('A new school day',`Day ${dayNumber} · Energy restored to 100 · Conduct +2`);refreshUI();saveGame();
  }
  function addXP(n){state.xp+=n;while(state.xp>=100){state.xp-=100;state.level++;showNotice(`Level ${state.level} unlocked`,`You’re becoming a confident Unity Heights student.`);}refreshUI();saveGame();}
  function alterStat(key,amount){if(!(key in state))return;state[key]=clamp(state[key]+amount,0,100);refreshUI();}
  function addJournal(title,body){state.journal.unshift({time:`${DAY_NAMES[currentDay]} · ${gameTimeString()}`,title,body});state.journal=state.journal.slice(0,24);}
  function completeQuest(id){const q=quests.find(q=>q.id===id);if(!q||q.done)return;q.done=true;showNotice('Checklist updated',q.title+' — done.');addXP(20);refreshUI();saveGame();}
  function refreshUI(){
    const statPairs=[['energy','energy'],['knowledge','knowledge'],['reputation','reputation'],['conduct','conduct']];
    for(const [key,id] of statPairs){$(id+'-fill').style.width=clamp(state[key],0,100)+'%';$(id+'-label').textContent=Math.round(state[key]);}
    $('xp-fill').style.width=state.xp+'%';$('level-label').textContent=`LEVEL ${state.level}`;
    $('quest-count').textContent=`${quests.filter(q=>q.done).length}/${quests.length}`;
    $('quest-list').innerHTML=quests.map(q=>`<div class="quest-item ${q.done?'done':''}"><span class="quest-box">${q.done?'✓':''}</span><div>${escapeHtml(q.title)}<small>${escapeHtml(q.detail)}</small></div></div>`).join('');
    $('profile-name').textContent=state.name;$('profile-portrait').textContent=state.name.slice(0,1).toUpperCase();
    if($('mobile-cash'))$('mobile-cash').textContent='₦'+Math.max(0,Math.round(state.cash||0)).toLocaleString('en-NG');
    if($('mobile-energy'))$('mobile-energy').textContent=Math.round(state.energy)+'%';
    if($('mobile-xp'))$('mobile-xp').textContent='LVL '+state.level;
    if(activeRoom)$('location-name').textContent=roomNames[activeRoom]||activeRoom;else $('location-name').textContent='Main Campus';
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function saveGame(){
    if(!gameStarted)return;
    state.position=activeRoom?{x:savedOutsidePosition.x,z:savedOutsidePosition.z}:{x:player.x,z:player.z};
    const payload={state:{...state},simClock,dayNumber,currentDay,quests:quests.map(q=>({...q})),activeRoom};
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(payload));}catch(e){/* private browsing can disable storage */}
  }
  function loadGame(){
    try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;const data=JSON.parse(raw);if(!data||!data.state)return false;
      Object.assign(state,data.state);state.cash=state.cash??23700;state.gameWins=state.gameWins??0;state.inventory=state.inventory||['Exercise books','School ID card','Blue House key'];simClock=data.simClock??390;dayNumber=data.dayNumber??1;currentDay=data.currentDay??0;
      if(data.quests&&data.quests.length)for(const q of quests){const old=data.quests.find(v=>v.id===q.id);if(old)q.done=!!old.done;}
      state.relationships=state.relationships||{};state.position=state.position||{x:0,z:23};savedOutsidePosition={...state.position};
      createPlayer();worldGroup.visible=true;if(data.activeRoom&&roomNames[data.activeRoom]){savedOutsidePosition={...state.position};enterRoom(data.activeRoom);}
      return true;
    }catch(e){return false;}
  }
  function showNotice(title,body){$('notice-title').textContent=title;$('notice-body').textContent=body;$('action-notice').classList.remove('hidden');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('action-notice').classList.add('hidden'),4200);}
  function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3600);}

  // Conversation system ----------------------------------------------------
  function getRapport(id){return state.relationships[id]??(id==='ada'?15:10);}
  function changeRapport(npc,amt){const value=clamp(getRapport(npc.id)+amt,0,100);state.relationships[npc.id]=value;npc.rapport=value;$('rapport-label').textContent=`${value} / 100`;$('rapport-fill').style.width=value+'%';}
  function responseText(npcId,kind){
    const n=npcDefs[npcId];if(kind==='greet')return n.intro;
    const responses={
      ada:{school:'The first few days feel long, but soon you’ll have your own corner, your friends, your jokes. Just don’t believe every piece of gist you hear!',class:'Math is next on the timetable. Mr. Okafor is strict about showing your steps, but he’ll explain again if you ask respectfully.',hostel:'Hostel life is noisy, honestly. Pack your things neatly and make friends with your roommates. They become your second family.',football:'Come to the field after classes! Blue House needs people who can pass the ball, not just shout from the sideline.',advice:'Be yourself, but pay attention. The small things matter here — greeting staff, sharing notes, showing up on time.'},
      tunde:{school:'You’ll learn the routine. Assembly, classes, food, prep, repeat. But the good gist happens in between all that.',class:'Carry your exercise books now. If you forget them, the teacher will ask you to borrow one and everybody will look at you.',hostel:'The best bunk is the one close enough to your locker but not directly under the noisy fan. I’m still negotiating for mine.',football:'Real Madrid or Arsenal? Don’t answer carelessly, this is a serious friendship interview.',advice:'Find one subject you enjoy and one friend who takes prep seriously. You need both.'},
      prefect:{school:'School rules keep everyone safe. Be back before roll call, respect the dining queue and keep your house area clean.',class:'Morning assembly is at eight. The first lesson starts at half past. Walk quickly and don’t block the corridor.',hostel:'Your bed space and locker are your responsibility. Lights-out is 9:30 PM. If you need help, find me or the housemaster.',permission:'Tell me where you’re going and why. If it’s reasonable, I can help you speak with the housemaster.',advice:'Discipline is not fear. It is doing the right thing even when nobody is watching.'},
      teacherMath:{class:'Today we are revising algebraic expressions. Simplify first, collect like terms and write each step clearly.',help:'Good. Bring your notebook after class and we’ll go over it. Never be ashamed to ask a question.',timetable:'Mathematics starts at 8:30 AM. Keep your calculator away unless I tell you to use it.',advice:'Practise a little every day. Mathematics rewards steady work more than last-minute panic.'},
      teacherEnglish:{class:'We’re working on comprehension today. Read twice before answering, and use evidence from the passage.',help:'Bring a paragraph you have written. We can improve the opening, the flow and the conclusion together.',timetable:'English is the second period. Keep your literature text with you.',advice:'Read beyond the textbook. Stories teach you how people think, not just how words work.'},
      teacherScience:{class:'Today’s lesson is observation and measurement. Record what you see before you decide what it means.',help:'Good scientists ask clear questions. Bring me your observation notes and we’ll review them safely.',timetable:'Basic Science is at eleven. No experiment starts without the correct instructions.',advice:'Curiosity is excellent. Carelessness is not. Be curious and careful at the same time.'},
      principal:{school:'We take academic work, personal responsibility and respect seriously. We also want our students to build friendships and discover what they are good at.',permission:'Explain your request clearly, and I will consider it. We have rules for a reason, but staff are here to guide you.',advice:'Your grades matter, but so does how you treat the people around you. Become someone others can trust.',timetable:'The school day begins with assembly, followed by lessons, lunch, games and evening prep. Use your timetable and arrive early.'},
      librarian:{school:'Please return every book to the desk when you are finished. You may borrow a book with your student card.',class:'Quiet reading is part of your prep routine. Pick a subject guide and spend at least twenty minutes with it.',advice:'When a topic is confusing, try a second explanation. Sometimes the right book makes everything click.'},
      nurse:{school:'Drink water, rest when you need to and tell a member of staff if you feel unwell. Please don’t share medication.',advice:'You are still growing. Sleep and proper meals are not a waste of time — they help you learn.'},
      diningStaff:{school:'Today we have rice and stew, beans, plantain and water. Take what you can finish, then clear your tray.',food:'There is rice and stew, beans and plantain today. The kitchen is busy, so please queue patiently.',advice:'Eat well, drink water and wash your hands before meals. Small habits keep the whole house healthy.'},
      roommate:{school:'It takes a minute to settle in. I can show you the bathroom block and where people leave their laundry.',hostel:'Keep your torch close during power cuts, label your bucket and don’t borrow anybody’s slippers without asking.',football:'I’m in for a match after prep — unless the prefect catches us playing when we should be revising.',advice:'You don’t have to become best friends with everybody. Just find a few good people and treat everyone fairly.'},
      hallprefect:{school:'Stand with your house, keep the rows neat and listen for announcements. The principal will mention inter-house sports soon.',class:'After assembly, go straight to your first lesson. Don’t wander around when the bell goes.',advice:'Being a prefect is mostly reminding people about things they already know. Have patience with us.'},
      chisom:{school:'Green House and Blue House have been arguing over who owns the football field. Join a game and settle it properly.',class:'The ICT block is by the Printing Press road. Physics practicals need careful hands, not noise.',hostel:'Hostel gist never finishes. Keep your locker key safe and learn the roll-call times.',football:'Ayo, Suwe, Ten-ten and football are the real break-time classics. Choose your weapon!',advice:'Be friendly, but don’t let peer pressure make decisions for you.'},
      sadiq:{school:'This campus is bigger than it looks. Use the map if you want to find the Printing Press without walking in circles.',class:'Bring your practical notebook. A missing notebook can ruin your whole morning.',football:'Choose a corner before the keeper moves. If you wait too long, he reads your body language.',advice:'Show up for your house. People remember the ones who encourage their teammates.'},
      kemi:{school:'We have a chalk court near the main court. Start slowly, then try the full Suwe pattern.',class:'I like Art and Culture. Not everything in school has to be a written exam.',football:'After our Ayo round, meet me for Ten-ten. We need someone with rhythm.',advice:'Try the games. Winning is nice, but laughing with people is the best part.'},
      shopkeeper:{school:'I keep pens, exercise books, pencils, water and small snacks. Spend your pocket money wisely.',food:'There are biscuits, chin-chin and cold water in the fridge. Buy only what you can afford.',advice:'Write your name on everything you bring to school. Things travel in a boarding house.'}
    };
    return responses[npcId]?.[kind]||responses[n.like]?.[kind]||'That’s a fair question. Keep your head up, do your best and don’t be afraid to ask for help.';
  }
  function openDialogue(npc){
    currentDialogue=npc;paused=false;
    $('dialogue-panel').classList.remove('hidden');$('dialogue-name').textContent=npc.def.name;$('dialogue-role').textContent=npc.def.role.toUpperCase();$('dialogue-avatar').textContent=npc.def.name.slice(0,1);$('dialogue-speaker').textContent=npc.def.name;
    changeRapport(npc,0);$('dialogue-text').textContent=npc.greeted?responseText(npc.id,'greet'):responseText(npc.id,'greet');npc.greeted=true;
    const opts=[];
    if(npc.def.kind==='teacher'){
      opts.push(['Attend lesson','lesson'],['Ask for help','help'],['Ask about timetable','timetable'],['Ask for advice','advice']);
    }else if(npc.def.kind==='principal'){
      opts.push(['Ask about the school','school'],['Request permission','permission'],['Ask for advice','advice'],['Ask about timetable','timetable']);
    }else if(npc.id==='prefect'){
      opts.push(['Ask about school rules','school'],['Ask about hostel life','hostel'],['Ask about permission','permission'],['Ask for advice','advice']);
    }else if(npc.id==='diningStaff'){
      opts.push(['Ask what is on the menu','food'],['Ask about school life','school'],['Ask for advice','advice']);
    }else if(npc.id==='shopkeeper'){
      opts.push(['Buy a snack · ₦500','buySnack'],['Buy exercise books · ₦1,200','buyBooks'],['Buy a football · ₦3,500','buyBall'],['Ask about school life','school']);
    }else if(npc.id==='nurse'){
      opts.push(['Ask how to stay healthy','school'],['Ask for advice','advice']);
    }else{
      opts.push(['Ask about school life','school'],['Ask about classes','class'],['Ask about hostel life','hostel'],['Talk about football','football'],['Ask for advice','advice']);
    }
    $('dialogue-options').innerHTML=opts.map((o,i)=>`<button class="dialogue-option" data-kind="${o[1]}"><span>0${i+1}</span>${escapeHtml(o[0])}</button>`).join('');
    $('dialogue-options').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>chooseDialogue(btn.dataset.kind)));
    if(npc.id==='ada')completeQuest('ada');if(npc.id==='prefect')completeQuest('prefect');
  }
  function chooseDialogue(kind){
    if(!currentDialogue)return;const npc=currentDialogue;
    if(kind==='lesson'){
      if(npc.def.kind!=='teacher'){sayToNPC(npc,'lesson');return;}
      const key=npc.def.subject||(npc.id==='teacherMath'?'math':npc.id==='teacherEnglish'?'english':'science');
      if(!state.attended.includes(`${dayNumber}-${key}`)){
        state.attended.push(`${dayNumber}-${key}`);alterStat('knowledge',key==='science'?10:8);alterStat('energy',-5);alterStat('conduct',3);addXP(25);completeQuest('lesson');
        addJournal(`Attended ${roomNames[key]}.`,`You took part in a lesson with ${npc.def.name}. Your knowledge improved, and you kept up with the timetable.`);
        sayToNPC(npc,`Good work, ${state.name}. You took part in the lesson. Keep that notebook complete and ask if any step is unclear.`);showNotice('Lesson completed','Knowledge +'+(key==='science'?10:8)+' · Conduct +3 · Energy −5');
      }else sayToNPC(npc,'You have already attended this lesson today. Use your free period to review your notes or explore another subject.');
    }else if(npc.id==='shopkeeper'&&kind.startsWith('buy')){
      const goods={buySnack:{label:'canteen snack',cost:500,energy:12,item:'Canteen snack'},buyBooks:{label:'exercise books',cost:1200,energy:0,item:'Fresh exercise books'},buyBall:{label:'school football',cost:3500,energy:0,item:'Football'}};const good=goods[kind];
      if(!good){sayToNPC(npc,'Have a look at the shelves and ask for what you need.');return;}
      if((state.cash||0)<good.cost){sayToNPC(npc,`You need ₦${good.cost.toLocaleString('en-NG')} for that. Come back after you have saved a little pocket money.`);toast('Not enough pocket money.');}
      else{state.cash-=good.cost;if(!state.inventory.includes(good.item))state.inventory.push(good.item);if(good.energy)state.energy=clamp(state.energy+good.energy,0,100);sayToNPC(npc,`There you go, ${state.name}. ${good.label} purchased for ₦${good.cost.toLocaleString('en-NG')}. Take care of your things.`);addJournal('A stop at the campus shop',`You bought ${good.label} for ₦${good.cost.toLocaleString('en-NG')}.`);showNotice('Purchase complete',`${good.item} · Pocket money left ₦${state.cash.toLocaleString('en-NG')}`);refreshUI();saveGame();}
    }else{
      const reply=responseText(npc.id,kind);sayToNPC(npc,reply);
      if(kind==='advice'||kind==='school')changeRapport(npc,2);
      if(kind==='football'){alterStat('reputation',2);}
      if(kind==='permission'&&npc.def.kind==='principal'){changeRapport(npc,1);}
      if(kind==='food'&&npc.id==='diningStaff'){state.meals++;completeQuest('meal');}
      addJournal(`Talked with ${npc.def.name}.`,reply);
    }
    refreshUI();saveGame();
  }
  function sayToNPC(npc,text){$('dialogue-speaker').textContent=npc.def.name;$('dialogue-text').textContent=text;}
  function typedTalk(){
    const text=$('talk-input').value.trim();if(!text||!currentDialogue)return;const t=text.toLowerCase(),npc=currentDialogue;let reply='I hear you. Give it time, keep an open mind and remember we are all figuring things out.';
    if(/hello|hi |hey|good morning|good afternoon|good evening/.test(t))reply=`${choose(['Hello','Hey there','Good to see you'])}, ${state.name}! What’s on your mind?`;
    else if(/class|lesson|subject|timetable|period|teacher|exam|test|homework|assignment|math|english|science/.test(t))reply=responseText(npc.id,'class');
    else if(/hostel|bed|roommate|sleep|lights.?out|locker|bathroom|bath/.test(t))reply=responseText(npc.id,'hostel');
    else if(/food|eat|lunch|breakfast|dinner|rice|stew|beans|plantain|water|hungry/.test(t))reply=npc.id==='diningStaff'?responseText(npc.id,'food'):'The dining hall is where you want to go. Try not to miss the meal bell.';
    else if(/football|sport|game|arsenal|chelsea|madrid|barcelona|ball/.test(t))reply=responseText(npc.id,'football');
    else if(/advice|help|scared|nervous|friend|lonely|hard|difficult|miss home|homesick/.test(t)){reply=responseText(npc.id,'advice');changeRapport(npc,3);}
    else if(/principal|rule|permission|leave|gate|punish|trouble/.test(t))reply=npc.id==='principal'?responseText(npc.id,'permission'):responseText('prefect','school');
    else if(/thank|thanks/.test(t)){reply='You’re welcome. Look out for yourself — and check on your friends too.';changeRapport(npc,3);}
    else if(/who are you|your name/.test(t))reply=`I’m ${npc.def.name}. ${npc.def.role}. Good to meet you, ${state.name}.`;
    else if(/family|home|parent|mum|mom|dad/.test(t))reply='Being away from home can feel strange. Keep the people you love close, and give yourself a little time to settle in.';
    else if(/gist|gossip|secret/.test(t))reply='Ah-ah, you just arrived! First make friends before you start collecting gist. Some stories grow legs in this school.';
    else if(/sorry|apolog/.test(t)){reply='It’s alright. Own your mistakes, apologise properly and do better next time.';alterStat('conduct',1);changeRapport(npc,2);}
    else if(/love|like you|best friend/.test(t)){reply='You’re kind to say that. Let’s keep building a good friendship, one day at a time.';changeRapport(npc,4);alterStat('reputation',1);}
    $('talk-input').value='';sayToNPC(npc,reply);addJournal(`You spoke with ${npc.def.name}.`,`You said: “${text}” ${reply}`);refreshUI();saveGame();
  }

  function studyAtDesk(spot){
    if(state.energy<8){toast('You are exhausted. Eat something or get some sleep first.');return;}
    const gain=spot.room==='library'?10:7;alterStat('knowledge',gain);alterStat('energy',-7);addXP(12);addJournal('A quiet study session',`You spent time studying in the ${roomNames[spot.room]}. Knowledge +${gain}; Energy −7.`);showNotice('Study session complete',`Knowledge +${gain} · Energy −7 · XP +12`);saveGame();
  }
  function playFootball(){if(state.energy<12){toast('You need a little more energy before training.');return;}alterStat('energy',-12);alterStat('reputation',4);alterStat('conduct',1);addXP(18);addJournal('After-class football','You joined a short football drill on the field. A few teammates remembered your name.');showNotice('Training complete','Reputation +4 · Energy −12 · XP +18');}
  function sleepThroughNight(){
    $('sleep-panel').classList.add('hidden');
    const sleepingRoom=activeRoom==='hostel'||activeRoom==='greenHostel';
    const bed=sleepSpots[0];
    if(!sleepingRoom||!bed||!player.group){toast('You need to be beside your bunk to sleep.');return;}
    if(postureTimer){clearTimeout(postureTimer);postureTimer=null;}playerPosture='lie';
    // Place the character lengthwise on the lower mattress, then turn the full body onto its side.
    player.x=bed.bedX??-6;player.z=bed.bedZ??4.24;player.group.position.set(player.x,.82,player.z);player.group.rotation.set(0,Math.PI,Math.PI/2);
    toast('You lie down on your bunk…');
    window.setTimeout(()=>{
      const oldDay=dayNumber;newDay(true);state.energy=100;addXP(5);addJournal('A full night’s rest','You slept in your bunk and woke up ready for the new day.');saveGame();
      playerPosture=null;player.x=-4.45;player.z=5.45;player.group.position.set(player.x,0,player.z);player.group.rotation.set(0,0,0);yaw=0;
      toast(`You slept well. Welcome to Day ${oldDay+1}.`);
    },2600);
  }

  // Nigerian schoolyard mini-games ----------------------------------------
  const miniGameNames={football:'Penalty shoot-out',ayo:'Ayo Olopon',suwe:'Suwe',tenten:'Ten-ten rhythm'};
  function openGames(type=null){
    if(currentDialogue){currentDialogue=null;$('dialogue-panel').classList.add('hidden');}
    $('games-panel').classList.remove('hidden');$('games-hub').classList.remove('hidden');$('game-play-view').classList.add('hidden');
    if(type)startMiniGame(type);
  }
  function startMiniGame(type){
    if(type==='penalty')type='football';if(!miniGameNames[type])type='football';if(miniGameTimer){clearTimeout(miniGameTimer);miniGameTimer=null;}
    const opponentIds={football:'tunde',ayo:'chisom',suwe:'kemi',tenten:'ada'};const opponentId=opponentIds[type]||'tunde',opponent=npcDefs[opponentId];
    currentMiniGame={type,opponentId,opponentName:opponent.name,finished:false,playerScore:0,rivalScore:0,round:0,moves:0,board:Array(12).fill(4),turn:'player',step:1,lives:3,misses:0,rivalStep:0,sequence:['clap','left','clap','right','turn','clap']};
    $('games-hub').classList.add('hidden');$('game-play-view').classList.remove('hidden');$('game-finish-actions').classList.add('hidden');
    $('game-title').innerHTML=`${escapeHtml(miniGameNames[type])}<span class="gold-dot">.</span>`;$('game-instructions').textContent=({football:'Choose a corner before the keeper dives. Your schoolmate shoots after each attempt.',ayo:'You and your rival each own six pits. Sow the seeds and capture them by thinking ahead.',suwe:'Hop through the chalk squares in order, from 1 to 8. You get three chances.',tenten:'Match every clap, step and turn call. Keep your rhythm better than your rival.'})[type];
    $('game-opponent-face').textContent=opponent.name[0];$('game-opponent-name').textContent=opponent.name;$('game-rival-label').textContent=opponent.name.toUpperCase();$('game-player-score').textContent='0';$('game-rival-score').textContent='0';$('game-feedback').textContent=`${opponent.name} is ready. No excuses after you lose, o!`;
    ['ayo-board','suwe-board','tenten-board','penalty-board'].forEach(id=>$(id).classList.add('hidden'));
    if(type==='ayo'){ $('ayo-board').classList.remove('hidden');renderAyoBoard(); }
    if(type==='suwe'){ $('suwe-board').classList.remove('hidden');renderSuweBoard(); }
    if(type==='tenten'){ $('tenten-board').classList.remove('hidden');renderTenTenBoard(); }
    if(type==='football'){ $('penalty-board').classList.remove('hidden');renderPenaltyBoard(); }
  }
  function renderScore(){if(!currentMiniGame)return;$('game-player-score').textContent=currentMiniGame.playerScore;$('game-rival-score').textContent=currentMiniGame.rivalScore;}
  function finishMiniGame(win,message){
    const g=currentMiniGame;if(!g||g.finished)return;g.finished=true;if(miniGameTimer){clearTimeout(miniGameTimer);miniGameTimer=null;}
    $('game-feedback').innerHTML=`<strong>${win?'YOU DID IT!':'GOOD GAME!'}</strong><br>${escapeHtml(message)}`;$('game-finish-actions').classList.remove('hidden');
    $('game-play-view').querySelectorAll('button[data-pit],button[data-hop],button[data-move],button[data-shot]').forEach(b=>b.disabled=true);
    const reward=win?750:200;state.cash=(state.cash||0)+reward;state.energy=clamp(state.energy-(g.type==='football'?8:5),0,100);state.reputation=clamp(state.reputation+(win?6:2),0,100);state.relationships[g.opponentId]=clamp((state.relationships[g.opponentId]??10)+(win?5:2),0,100);
    if(win){state.gameWins=(state.gameWins||0)+1;addXP(25);}else addXP(10);completeQuest('games');addJournal(`${miniGameNames[g.type]} with ${g.opponentName}`,`${message} Pocket money reward: ₦${reward.toLocaleString('en-NG')}.`);showNotice(win?'Schoolyard win!':'Match complete',`${win?'Reputation +6':'Reputation +2'} · Pocket money +₦${reward.toLocaleString('en-NG')} · Friendship +${win?5:2}`);refreshUI();saveGame();
  }
  function renderAyoBoard(){
    const g=currentMiniGame;if(!g)return;const el=$('ayo-board');el.innerHTML=`<div class="ayo-board-label rival-label">${escapeHtml(g.opponentName.toUpperCase())} · OPPONENT PITS</div><div class="ayo-pits">${[11,10,9,8,7,6,0,1,2,3,4,5].map(i=>`<button data-pit="${i}" class="ayo-pit ${i<6?'player-pit':'rival-pit'}" ${g.finished||g.turn!=='player'||i>=6||g.board[i]===0?'disabled':''}><span>${g.board[i]}</span><small>PIT ${i+1}</small></button>`).join('')}</div><div class="ayo-board-label player-label">YOUR PITS · PICK A PIT TO SOW</div><div class="ayo-stores"><span>YOU CAPTURED <b>${g.playerScore}</b></span><span>${escapeHtml(g.opponentName.toUpperCase())} <b>${g.rivalScore}</b></span></div>`;
  }
  function ayoMove(start,actor){
    const g=currentMiniGame;if(!g||g.finished||g.type!=='ayo'||g.turn!==actor)return;const allowed=actor==='player'?(start>=0&&start<6):(start>=6&&start<12);if(!allowed||!g.board[start])return;
    let hand=g.board[start];g.board[start]=0;let index=start,last=start,wasEmpty=false;
    while(hand>0){index=(index+1)%12;if(index===start){hand--;continue;}wasEmpty=g.board[index]===0;g.board[index]++;hand--;last=index;}
    const ownsLast=actor==='player'?last<6:last>=6;
    if(ownsLast&&wasEmpty){const opposite=11-last;if(g.board[opposite]>0){const capture=g.board[opposite]+g.board[last];g.board[opposite]=0;g.board[last]=0;if(actor==='player')g.playerScore+=capture;else g.rivalScore+=capture;}}
    g.moves++;g.turn=actor==='player'?'rival':'player';renderScore();renderAyoBoard();
    const playerEmpty=!g.board.slice(0,6).some(v=>v>0),rivalEmpty=!g.board.slice(6).some(v=>v>0);
    if(playerEmpty||rivalEmpty||g.moves>=48){g.playerScore+=g.board.slice(0,6).reduce((a,b)=>a+b,0);g.rivalScore+=g.board.slice(6).reduce((a,b)=>a+b,0);g.board.fill(0);renderScore();renderAyoBoard();finishMiniGame(g.playerScore>g.rivalScore,`${g.playerScore} seeds to ${g.rivalScore}. ${g.playerScore>g.rivalScore?'That was a sharp finish.':'Your rival read the board better this time.'}`);return;}
    $('game-feedback').textContent=actor==='player'?`You sowed the seeds. ${g.opponentName} is thinking…`:`${g.opponentName} played. Your move.`;
    if(actor==='player')miniGameTimer=setTimeout(()=>ayoAIMove(),520);
  }
  function ayoAIMove(){const g=currentMiniGame;if(!g||g.finished||g.type!=='ayo'||g.turn!=='rival')return;const pits=g.board.map((v,i)=>({v,i})).filter(p=>p.i>=6&&p.v>0).sort((a,b)=>b.v-a.v);if(!pits.length){finishMiniGame(g.playerScore>g.rivalScore,'Your rival ran out of legal pits.');return;}const pick=pits[Math.floor(Math.random()*Math.min(3,pits.length))];ayoMove(pick.i,'rival');}
  function renderSuweBoard(){const g=currentMiniGame;if(!g)return;$('suwe-board').innerHTML=`<div class="suwe-status"><span>STEP <b>${Math.min(g.step,8)}/8</b></span><span>LIVES <b>${'♥ '.repeat(g.lives)}</b></span></div><div class="suwe-tiles">${Array.from({length:8},(_,i)=>`<button data-hop="${i+1}" class="suwe-tile ${i+1<g.step?'hopped':''}" ${g.finished?'disabled':''}><span>${i+1<g.step?'✓':i+1}</span><small>${i%3===1?'LEFT / RIGHT':'HOP'}</small></button>`).join('')}</div><p class="game-small-hint">Tap the next number in the chalk sequence. Wrong square costs a life and sends you back to 1.</p>`;}
  function renderTenTenBoard(){const g=currentMiniGame;if(!g)return;const current=g.sequence[g.step-1];$('tenten-board').innerHTML=`<div class="rhythm-call"><small>YOUR NEXT MOVE</small><strong>${current?({clap:'👏 CLAP',left:'← STEP LEFT',right:'STEP RIGHT →',turn:'↻ TURN'})[current]:'FINISH!'}</strong><span>Pattern ${Math.min(g.step,g.sequence.length)} of ${g.sequence.length} · Misses ${g.misses}/3</span></div><div class="rhythm-buttons"><button data-move="clap" ${g.finished?'disabled':''}>👏<small>CLAP</small></button><button data-move="left" ${g.finished?'disabled':''}>←<small>STEP LEFT</small></button><button data-move="right" ${g.finished?'disabled':''}>→<small>STEP RIGHT</small></button><button data-move="turn" ${g.finished?'disabled':''}>↻<small>TURN</small></button></div>`;}
  function renderPenaltyBoard(){const g=currentMiniGame;if(!g)return;$('penalty-board').innerHTML=`<div class="goal-graphic"><div class="goal-net"><span>◉</span><span>◉</span><span>◉</span></div><div class="keeper-spot">🧤</div><div class="ball-spot">⚽</div></div><div class="penalty-meta">SHOT ${Math.min(g.round+1,5)} OF 5 <span>·</span> PICK A CORNER</div><div class="penalty-buttons"><button data-shot="left">LEFT CORNER</button><button data-shot="centre">CENTRE</button><button data-shot="right">RIGHT CORNER</button></div>`;}
  function handleMiniGameClick(e){
    const g=currentMiniGame;if(!g||g.finished)return;const pit=e.target.closest('[data-pit]');if(pit){ayoMove(Number(pit.dataset.pit),'player');return;}
    const hop=e.target.closest('[data-hop]');if(hop&&g.type==='suwe'){const n=Number(hop.dataset.hop);if(n===g.step){g.playerScore++;g.step++;$('game-feedback').textContent=`Clean hop! ${g.step>8?'You finished the chalk course.':`Square ${n} is clear. Keep going.`}`;if(g.step>8){g.rivalScore=6;renderScore();finishMiniGame(true,'You cleared all eight squares. Kemi says you have proper footwork!');return;}}else{g.lives--;g.step=1;$('game-feedback').textContent=`You landed on ${n}, but square ${Math.min(g.step,8)} was next. Reset and try again.`;if(g.lives<=0){g.rivalScore=7;renderScore();finishMiniGame(false,'Three missed hops. Kemi wins the Suwe round this time.');return;}}renderScore();renderSuweBoard();return;}
    const move=e.target.closest('[data-move]');if(move&&g.type==='tenten'){const call=move.dataset.move,expected=g.sequence[g.step-1];if(call===expected){g.playerScore++;g.step++;$('game-feedback').textContent=`Good rhythm! ${g.step>g.sequence.length?'You nailed the full pattern.':'Stay with the beat.'}`;if(g.step>g.sequence.length){g.rivalScore=4;renderScore();finishMiniGame(true,'You nailed the full Ten-ten pattern. Adaeze wants a rematch!');return;}}else{g.misses++;g.rivalScore++;$('game-feedback').textContent=`Not that move. The call was ${expected.toUpperCase()}. Listen and try the next beat.`;if(g.misses>=3){renderScore();finishMiniGame(false,'Three missed calls. Adaeze kept the rhythm together.');return;}}renderScore();renderTenTenBoard();return;}
    const shot=e.target.closest('[data-shot]');if(shot&&g.type==='football'){const target=shot.dataset.shot,keeper=['left','centre','right'][Math.floor(Math.random()*3)];g.round++;if(target!==keeper){g.playerScore++;$('game-feedback').textContent=`GOAL! You sent it ${target}, the keeper went ${keeper}.`; }else $('game-feedback').textContent=`SAVED! You aimed ${target} and the keeper guessed right.`;
      const aiShot=['left','centre','right'][Math.floor(Math.random()*3)],aiKeeper=['left','centre','right'][Math.floor(Math.random()*3)];if(aiShot!==aiKeeper)g.rivalScore++;renderScore();if(g.round>=5){finishMiniGame(g.playerScore>g.rivalScore,`Final score ${g.playerScore}–${g.rivalScore}. ${g.playerScore>g.rivalScore?'You have bragging rights until the next break.':'Tunde says the rematch is compulsory.'}`);return;}renderPenaltyBoard();return;}
  }
  function bindTouchControls(){
    const base=$('joystick-base'),knob=$('joystick-knob');if(!base||!knob)return;let pointer=null,center={x:0,y:0},radius=44;
    const clear=()=>{pointer=null;knob.style.transform='translate(0px,0px)';['KeyW','KeyA','KeyS','KeyD'].forEach(k=>keyState[k]=false);};
    base.addEventListener('pointerdown',e=>{if(!gameStarted||paused||isAnyModalOpen())return;pointer=e.pointerId;base.setPointerCapture?.(pointer);const r=base.getBoundingClientRect();center={x:r.left+r.width/2,y:r.top+r.height/2};radius=r.width*.31;moveStick(e);e.preventDefault();});
    const moveStick=e=>{if(pointer!==e.pointerId)return;const dx=e.clientX-center.x,dy=e.clientY-center.y,len=Math.hypot(dx,dy),m=Math.min(radius,len),x=len?dx/len*m:0,y=len?dy/len*m:0;knob.style.transform=`translate(${x}px,${y}px)`;keyState.KeyA=x<-9;keyState.KeyD=x>9;keyState.KeyW=y<-9;keyState.KeyS=y>9;};
    window.addEventListener('pointermove',e=>{if(pointer===e.pointerId)moveStick(e);});window.addEventListener('pointerup',e=>{if(pointer===e.pointerId)clear();});window.addEventListener('pointercancel',e=>{if(pointer===e.pointerId)clear();});
    const sprint=$('mobile-sprint');sprint.addEventListener('pointerdown',e=>{keyState.ShiftLeft=true;sprint.classList.add('pressed');sprint.setPointerCapture?.(e.pointerId);e.preventDefault();});const releaseSprint=()=>{keyState.ShiftLeft=false;sprint.classList.remove('pressed');};sprint.addEventListener('pointerup',releaseSprint);sprint.addEventListener('pointercancel',releaseSprint);window.addEventListener('pointerup',releaseSprint);
  }

  // Timetable, journal and map --------------------------------------------
  function openTimetable(){
    const next=currentSchedule();$('timetable-content').innerHTML=schedule.map(s=>`<div class="timetable-row ${s===next?'current':''}"><div class="tt-time">${as24(s.at)}</div><div><strong>${escapeHtml(s.name)}</strong><small>${s===next?'UP NEXT':'DAILY ROUTINE'}</small></div><div class="tt-place">${escapeHtml(s.place)}</div></div>`).join('');$('timetable-panel').classList.remove('hidden');
  }
  function openJournal(){
    $('journal-content').innerHTML=(state.journal.length?state.journal:[{time:'FIRST DAY',title:'Your story starts here',body:'Say hello to a student, meet your house prefect, attend a lesson and explore the campus.'}]).map(e=>`<article class="journal-entry"><small>${escapeHtml(e.time)}</small><p><strong>${escapeHtml(e.title)}</strong><br>${escapeHtml(e.body)}</p></article>`).join('');$('journal-panel').classList.remove('hidden');
  }
  function isAnyModalOpen(){return ['dialogue-panel','timetable-panel','journal-panel','map-panel','sleep-panel','games-panel'].some(id=>!$(id).classList.contains('hidden'));}
  function closeAllModals(){['dialogue-panel','timetable-panel','journal-panel','map-panel','sleep-panel','games-panel'].forEach(id=>$(id).classList.add('hidden'));currentDialogue=null;if(miniGameTimer){clearTimeout(miniGameTimer);miniGameTimer=null;}}
  function drawMap(canvas,big=false){
    if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
    const grd=ctx.createLinearGradient(0,0,w,h);grd.addColorStop(0,'#638357');grd.addColorStop(1,'#3f6846');ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
    // Varied campus greens create a park-like overhead guide.
    for(let i=0;i<260;i++){const x=(i*79)%w,y=(i*47)%h;ctx.fillStyle=i%3?'rgba(210,222,168,.08)':'rgba(18,56,30,.12)';ctx.beginPath();ctx.arc(x,y,(i%4)+1,0,Math.PI*2);ctx.fill();}
    const bounds={minX:-46,maxX:46,minZ:-72,maxZ:38},scale=Math.min((w-26)/(bounds.maxX-bounds.minX),(h-26)/(bounds.maxZ-bounds.minZ));
    const ox=(w-(bounds.maxX-bounds.minX)*scale)/2,oy=(h-(bounds.maxZ-bounds.minZ)*scale)/2;
    const xx=x=>ox+(x-bounds.minX)*scale,yy=z=>oy+(z-bounds.minZ)*scale;
    const rect=(x,z,ww,dd,fill,stroke)=>{ctx.fillStyle=fill;ctx.fillRect(xx(x-ww/2),yy(z-dd/2),ww*scale,dd*scale);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=big?1.7:1;ctx.strokeRect(xx(x-ww/2),yy(z-dd/2),ww*scale,dd*scale);}};
    const line=(x1,z1,x2,z2,width,color)=>{ctx.beginPath();ctx.moveTo(xx(x1),yy(z1));ctx.lineTo(xx(x2),yy(z2));ctx.lineWidth=Math.max(1,width*scale);ctx.strokeStyle=color;ctx.lineCap='round';ctx.stroke();};
    // Paths and campus roads.
    [[0,29,0,-62,3.6],[0,10,-17,-5,2.8],[-17,-5,-31,-7,2.2],[-17,-5,-30,1,2.0],[-30,1,-31,14,2.0],[0,-5,-12,-20,2.1],[-12,-20,0,-35,2.2],[0,-35,0,-48,2.2],[0,-48,29,-47,2.0],[29,-47,29,-62,2.0],[12,-21,29,-31,2.0],[29,-31,29,-47,1.9],[16,-6,28,1,1.9],[28,1,29,20,1.8],[-12,-20,-30,-25,1.8],[-30,-25,-30,-45,1.8],[-17,13,0,13,1.8],[0,13,15,13,1.8],[15,13,29,20,1.8]].forEach(r=>line(...r,'#bcb9ab'));
    // Sports field, main court and Suwe chalk area.
    rect(0,-48,45,25,'#8fa76a','#e2e1c9');rect(0,9,17,10,'#98b5a8','#e8e7d7');
    for(let i=0;i<8;i++)rect(-8+(i%2)*1.35,14-Math.floor(i/2)*1.45,1.08,1.08,'#d4d0bc','#f6f1dc');
    // Buildings use their own roof colours and a crisp perimeter.
    const roofs=['#858d8b','#777f82','#8f8070','#7b8a88','#8b7063','#7f8987'];
    for(const [i,b] of buildings.entries()){
      const fill=activeRoom===b.id?'#e9c56d':roofs[i%roofs.length];rect(b.x,b.z,b.w,b.d,fill,'rgba(244,241,225,.92)');
      if(big){ctx.fillStyle='#fdfcf3';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.max(8,Math.min(12,scale*1.3))}px Arial`;ctx.shadowColor='rgba(25,42,30,.7)';ctx.shadowBlur=3;ctx.fillText(roomNames[b.id]||b.label,xx(b.x),yy(b.z),Math.max(30,b.w*scale+22));ctx.shadowBlur=0;}
    }
    // Tree dots follow the walkways and edge of the campus.
    const treeDots=[[-24,-5],[24,-3],[-25,12],[26,14],[-28,-30],[28,-27],[-26,-49],[27,-50],[-5,-30],[7,-32],[-21,25],[21,25],[-8,8],[8,7],[-40,26],[40,26],[-40,9],[40,9],[-40,-8],[40,-8],[-40,-25],[40,-25],[-40,-43],[40,-43],[-39,-60],[39,-60]];
    treeDots.forEach(([x,z],i)=>{ctx.fillStyle=i%2?'#2e6239':'#3a7042';ctx.beginPath();ctx.arc(xx(x),yy(z),Math.max(1.4,big?4*scale:2.6),0,Math.PI*2);ctx.fill();});
    // Small active-student markers.
    if(!activeRoom){for(const npc of worldNPCs){ctx.fillStyle='#e9eee0';ctx.strokeStyle='#335943';ctx.lineWidth=1;ctx.beginPath();ctx.arc(xx(npc.x),yy(npc.z),big?3.7:2.1,0,Math.PI*2);ctx.fill();ctx.stroke();}}
    const px=xx(player.x),py=yy(player.z);ctx.save();ctx.translate(px,py);ctx.rotate(-player.group.rotation.y);ctx.fillStyle='#ffdf7b';ctx.strokeStyle='#20382d';ctx.lineWidth=big?2:1;ctx.beginPath();ctx.moveTo(0,-(big?9:6));ctx.lineTo(big?6:4,big?7:4);ctx.lineTo(-(big?6:4),big?7:4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    if(big){ctx.fillStyle='#fff7da';ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText('N ↑',12,20);ctx.fillStyle='rgba(14,35,27,.82)';ctx.fillRect(w-144,h-30,132,20);ctx.fillStyle='#d9e8d0';ctx.font='10px Arial';ctx.fillText('● YOU    ○ STUDENTS',w-137,h-16);}
  }
  function toggleAerialView(){
    if(activeRoom){toast('Step outside the building to view the full 3D campus map.');return;}
    aerialMode=!aerialMode;if(aerialLabelsGroup)aerialLabelsGroup.visible=aerialMode;
    $('game-shell').classList.toggle('aerial-mode',aerialMode);$('aerial-btn').textContent=aerialMode?'RETURN TO PLAYER ↙':'3D CAMPUS ↗';
    $('mobile-aerial-btn').textContent=aerialMode?'↙':'⌖';
    if(aerialMode){camera.up.set(0,0,-1);aerialHeight=aerialFitHeight();toast('3D campus view · Scroll to zoom · Select RETURN TO PLAYER to walk again.');}
    else{camera.up.set(0,1,0);toast('Back to your student view.');mouseState.down=false;}
  }
  function openMap(){drawMap($('big-map'),true);$('map-directory').innerHTML=buildings.map(b=>`<button class="directory-item" data-room="${b.id}"><strong>${escapeHtml(roomNames[b.id]||b.label)}</strong><small>${escapeHtml(roomBlurb[b.id]||'Explore this campus location.')}</small></button>`).join('');$('map-directory').querySelectorAll('[data-room]').forEach(btn=>btn.addEventListener('click',()=>{const b=buildings.find(x=>x.id===btn.dataset.room);if(b){closeAllModals();if(!activeRoom){aerialMode=false;if(aerialLabelsGroup)aerialLabelsGroup.visible=false;$('game-shell').classList.remove('aerial-mode');$('aerial-btn').textContent='3D CAMPUS ↗';$('mobile-aerial-btn').textContent='⌖';camera.up.set(0,1,0);player.x=clamp(b.x,-45,45);player.z=clamp(b.frontZ+1.25,-68,38);player.group.position.set(player.x,0,player.z);yaw=0;toast(`Arrived near ${roomNames[b.id]||b.label}. Press E to enter.`);}else toast('Leave the current room before heading to another building.');}}));$('map-panel').classList.remove('hidden');}


  // Menu/start/save --------------------------------------------------------
  function startNewGame(){
    state.name=($('player-name-input').value.trim()||'Chinedu').slice(0,20);state.skin=$('skin-select').value;state.hair=$('hair-select').value;state.gender=($('gender-select')||{}).value||'m';
    state.energy=88;state.knowledge=12;state.reputation=15;state.conduct=80;state.xp=0;state.level=1;state.relationships={};state.attended=[];state.journal=[];state.meals=0;state.hasSlept=false;state.cash=23700;state.gameWins=0;state.position={x:0,z:23};state.inventory=['Exercise books','School ID card','Blue House key'];
    for(const q of quests)q.done=false;aerialMode=false;camera.up.set(0,1,0);if(aerialLabelsGroup)aerialLabelsGroup.visible=false;$('game-shell').classList.remove('aerial-mode');$('aerial-btn').textContent='3D CAMPUS ↗';$('mobile-aerial-btn').textContent='⌖';dayNumber=1;currentDay=0;simClock=6*60+30;activeRoom=null;savedOutsidePosition={x:0,z:23};
    if(interiorGroup){disposeTree(interiorGroup);scene.remove(interiorGroup);interiorGroup=null;}activeClass=null;worldGroup.visible=true;activeRoom=null;
    for(const oldNpc of worldNPCs)worldGroup.remove(oldNpc.group);
    worldNPCs.splice(0,worldNPCs.length);interiorNPCs.splice(0,interiorNPCs.length);addWorldNPCs();createPlayer();gameStarted=true;running=true;paused=false;
    $('start-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('pause-panel').classList.add('hidden');$('location-name').textContent='Main Campus';
    addJournal('First day at Unity Heights','The gate is open, the campus is waiting, and your first term has begun. Find Adaeze, meet the house prefect and get to your first lesson.');
    refreshUI();toast(`Welcome to Unity Heights, ${state.name}. Your first day starts now.`);saveGame();
  }
  function continueGame(){if(loadGame()){aerialMode=false;camera.up.set(0,1,0);if(aerialLabelsGroup)aerialLabelsGroup.visible=false;$('game-shell').classList.remove('aerial-mode');$('aerial-btn').textContent='3D CAMPUS ↗';$('mobile-aerial-btn').textContent='⌖';gameStarted=true;running=true;paused=false;$('start-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('pause-panel').classList.add('hidden');worldGroup.visible=!activeRoom;$('location-name').textContent=activeRoom?roomNames[activeRoom]:'Main Campus';refreshUI();toast(`Welcome back, ${state.name}. Your term continues.`);}else{toast('No saved term yet. Start a new school term first.');}}
  function returnToTitle(){saveGame();paused=false;closeAllModals();$('pause-panel').classList.add('hidden');$('hud').classList.add('hidden');$('start-screen').classList.remove('hidden');gameStarted=false;}
  function togglePause(){if(!gameStarted)return; if(isAnyModalOpen()){closeAllModals();return;}paused=!paused;$('pause-panel').classList.toggle('hidden',!paused);}

  // Input and main loop ----------------------------------------------------
  function bindUI(){
    $('new-game-btn').addEventListener('click',startNewGame);$('continue-btn').addEventListener('click',continueGame);
    $('aerial-btn').addEventListener('click',toggleAerialView);$('mobile-aerial-btn').addEventListener('click',toggleAerialView);
    $('mobile-interact').addEventListener('click',()=>interact());$('mobile-directory').addEventListener('click',openMap);$('mobile-timetable').addEventListener('click',openTimetable);$('mobile-games').addEventListener('click',()=>openGames());
    $('roommate-nudge').addEventListener('click',()=>{if(activeRoom){toast('Step outside and open the Campus Map to find Blue House Hostel.');return;}openMap();toast('Look for Blue House Hostel on the campus directory. Emeka is usually there.');});
    $('games-hub').querySelectorAll('[data-game]').forEach(btn=>btn.addEventListener('click',()=>startMiniGame(btn.dataset.game)));
    $('games-back').addEventListener('click',()=>{if(miniGameTimer){clearTimeout(miniGameTimer);miniGameTimer=null;}currentMiniGame=null;$('game-play-view').classList.add('hidden');$('games-hub').classList.remove('hidden');});
    $('game-hub-return').addEventListener('click',()=>{if(miniGameTimer){clearTimeout(miniGameTimer);miniGameTimer=null;}currentMiniGame=null;$('game-play-view').classList.add('hidden');$('games-hub').classList.remove('hidden');});
    $('game-rematch').addEventListener('click',()=>{if(currentMiniGame)startMiniGame(currentMiniGame.type);});
    $('game-play-view').addEventListener('click',handleMiniGameClick);
    bindTouchControls();
    $('pause-btn').addEventListener('click',togglePause);$('resume-btn').addEventListener('click',()=>{paused=false;$('pause-panel').classList.add('hidden');});$('save-quit-btn').addEventListener('click',returnToTitle);
    $('timetable-btn').addEventListener('click',openTimetable);$('journal-btn').addEventListener('click',openJournal);$('map-btn').addEventListener('click',openMap);
    $('talk-form').addEventListener('submit',e=>{e.preventDefault();typedTalk();});$('end-talk-btn').addEventListener('click',()=>{closeAllModals();saveGame();});
    $('sleep-confirm-btn').addEventListener('click',sleepThroughNight);$('notice-close').addEventListener('click',()=>$('action-notice').classList.add('hidden'));
    document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>{const panel=btn.dataset.close;$(panel).classList.add('hidden');if(panel==='dialogue-panel')currentDialogue=null;if(panel==='games-panel'&&miniGameTimer){clearTimeout(miniGameTimer);miniGameTimer=null;}if(panel==='games-panel')currentMiniGame=null;}));
    window.addEventListener('keydown',e=>{
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keyState[e.code]=true;
      if(e.repeat)return;
      if(e.code==='KeyE'||e.code==='Enter'){if($('talk-input')!==document.activeElement)interact();}
      if(e.code==='Escape'){if(paused){paused=false;$('pause-panel').classList.add('hidden');}else if(currentDialogue||isAnyModalOpen()){closeAllModals();}else togglePause();}
      if(e.code==='KeyT'&&!isAnyModalOpen()&&!paused){openTimetable();}
      if(e.code==='KeyJ'&&!isAnyModalOpen()&&!paused){openJournal();}
      if(e.code==='KeyM'&&!isAnyModalOpen()&&!paused){openMap();}
      if(e.code==='KeyG'&&!isAnyModalOpen()&&!paused){openGames();}
      if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'||e.code==='Digit4'||e.code==='Digit5'){
        const i=Number(e.code.slice(-1))-1;const btn=$('dialogue-options').querySelectorAll('button')[i];if(btn&&!$('dialogue-panel').classList.contains('hidden'))chooseDialogue(btn.dataset.kind);
      }
    });
    window.addEventListener('keyup',e=>{keyState[e.code]=false;});
    const canvas=$('game-canvas');canvas.addEventListener('pointerdown',e=>{mouseState.down=true;mouseState.x=e.clientX;mouseState.y=e.clientY;mouseState.drag=false;canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!mouseState.down||!gameStarted||paused||isAnyModalOpen())return;const dx=e.clientX-mouseState.x,dy=e.clientY-mouseState.y;if(Math.abs(dx)+Math.abs(dy)>2)mouseState.drag=true;if(mouseState.drag){yaw-=dx*.006;cameraPitch=clamp(cameraPitch+dy*.0035,-.28,.52);mouseState.x=e.clientX;mouseState.y=e.clientY;}});
    canvas.addEventListener('pointerup',()=>{mouseState.down=false;});canvas.addEventListener('pointercancel',()=>{mouseState.down=false;});
    canvas.addEventListener('wheel',e=>{if(aerialMode){e.preventDefault();aerialHeight=clamp(aerialHeight+Math.sign(e.deltaY)*7,74,148);}},{passive:false});
    canvas.addEventListener('click',()=>{if(gameStarted&&!paused&&currentTarget&&currentTarget.distance<1.8)interact();});
    window.addEventListener('beforeunload',saveGame);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameStarted)saveGame();});
  }
  function animate(now){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);movePlayer(dt);moveNPCs(dt);animateVisuals(dt,now);for(const p of allProps){if(p.type==='fan')p.group.rotation.y+=dt*2.8;}updateCamera(dt);updateTime(dt);updatePrompt();
    if(now-mapLast>300&&renderer&&!aerialMode){drawMap($('minimap'),false);mapLast=now;}
    if(aerialLabelsGroup)aerialLabelsGroup.visible=!!aerialMode;
    if(renderer)renderer.render(scene,camera);
    if(gameStarted&&now%12000<32)saveGame();
  }
  function init(){
    if(typeof THREE==='undefined'){
      $('loading-cover').querySelector('p').textContent='3D ENGINE UNAVAILABLE · CHECK YOUR INTERNET CONNECTION';
      $('loading-cover').querySelector('.loading-track').style.display='none';
      return;
    }
    try{createRenderer();}catch(error){
      console.error('Unity Heights could not start WebGL:',error);
      $('loading-cover').querySelector('p').textContent='3D GRAPHICS COULD NOT START · TRY A WEBGL-COMPATIBLE BROWSER';
      $('loading-cover').querySelector('.loading-track').style.display='none';
      return;
    }
    buildWorld();addWorldNPCs();createPlayer();bindUI();
    // Place the camera before the title fades in so the world is already alive.
    camera.position.set(0,5.8,32);camera.lookAt(0,1,23);
    setTimeout(()=>$('loading-cover').classList.add('fade'),1500);
    setTimeout(()=>$('loading-cover').classList.add('hidden'),2300);
    try{if(!localStorage.getItem(SAVE_KEY))$('continue-btn').style.opacity='.45';}catch(e){$('continue-btn').style.opacity='.45';}
    refreshUI();requestAnimationFrame(animate);
  }
  init();
})();
