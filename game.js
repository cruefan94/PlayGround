(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('minimap');
  const mctx = mapCanvas.getContext('2d');
  const shell = document.getElementById('game-shell');
  const overlay = document.getElementById('overlay');
  const startButton = document.getElementById('start-button');
  const touchControls = document.getElementById('touch-controls');
  const weapons = [
    {name:'M16A1',type:'RIFLE',desc:'5.56×45mm · SELECT-FIRE',mag:20,reserve:140,damage:34,rate:145,reload:1.35,spread:.035,speed:790,kind:'m16'},
    {name:'AK-47',type:'RIFLE',desc:'7.62×39mm · AUTOMATIC',mag:30,reserve:180,damage:41,rate:185,reload:1.6,spread:.075,speed:710,kind:'ak'},
    {name:'M14',type:'BATTLE RIFLE',desc:'7.62×51mm · SEMI-AUTO',mag:20,reserve:100,damage:57,rate:280,reload:1.55,spread:.018,speed:900,kind:'m14'},
    {name:'M60',type:'MACHINE GUN',desc:'7.62×51mm · BELT-FED',mag:60,reserve:240,damage:28,rate:95,reload:2.2,spread:.10,speed:760,kind:'m60'}
  ];
  const state = {mode:'title',last:0,elapsed:0,sector:1,kills:0,score:0,shots:0,weaponIndex:0,magazines:[20,30,20,60],reserves:[140,180,100,240],player:{x:800,y:560,hp:100,maxHp:100,angle:0,speed:210,ammo:20,reserve:140,reloading:0,cooldown:0,invuln:0},base:{hp:100,maxHp:100},enemies:[],bullets:[],sparks:[],pickups:[],decor:[],trees:[],keys:{},pointer:{x:0,y:0,down:false},touch:{x:0,y:0,fire:false},spawnTimer:1.3,spawned:0,sectorTime:0,toastTimer:0,between:0,damageFlash:0};
  let W=0,H=0,dpr=1,camera={x:0,y:0},joy={active:false,id:null,cx:0,cy:0};
  const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function resize(){dpr=Math.min(devicePixelRatio||1,2);W=shell.clientWidth;H=shell.clientHeight;canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  window.addEventListener('resize',resize); resize();
  function buildWorld(){
    for(let i=0;i<80;i++){const x=rand(45,1555),y=rand(38,960);if(Math.hypot(x-800,y-560)>205)state.trees.push({x,y,r:rand(20,40),tone:Math.floor(rand(0,4)),dark:rand(.75,1.15)});}
    for(let i=0;i<96;i++)state.decor.push({x:rand(15,1585),y:rand(15,985),r:rand(2,8),type:Math.random()});
  }
  buildWorld();
  const ui={sector:document.getElementById('sector'),mission:document.getElementById('mission-label'),objective:document.getElementById('objective-title'),copy:document.getElementById('objective-copy'),base:document.getElementById('base-health'),baseText:document.getElementById('base-health-text'),health:document.getElementById('player-health'),healthText:document.getElementById('player-health-text'),wave:document.getElementById('wave-status'),name:document.getElementById('weapon-name'),type:document.getElementById('weapon-type'),desc:document.getElementById('weapon-desc'),ammo:document.getElementById('ammo-count'),reserve:document.getElementById('reserve-count'),art:document.getElementById('weapon-art'),note:document.getElementById('field-note-text'),toast:document.getElementById('toast')};
  const notes=['Stay mobile. The tree line hides more than you think.','Short bursts make every round count.','Keep the radio tent clear. Reinforcements are listening.','Watch the flanks—the jungle is close on every side.','A fresh magazine is no good if you reload in the open.'];
  function weapon(){return weapons[state.weaponIndex];}
  function setWeapon(n){if(state.mode!=='playing'||n===state.weaponIndex)return;state.magazines[state.weaponIndex]=state.player.ammo;state.reserves[state.weaponIndex]=state.player.reserve;state.weaponIndex=n;state.player.ammo=state.magazines[n];state.player.reserve=state.reserves[n];state.player.reloading=0;updateHUD();toast(`${weapons[n].name} SELECTED`);}
  let lastArt='';
  function updateHUD(){const w=weapon(),p=state.player;state.magazines[state.weaponIndex]=p.ammo;state.reserves[state.weaponIndex]=p.reserve;ui.sector.textContent=String(state.sector).padStart(2,'0');ui.mission.textContent=`PATROL SECTOR · ${String(state.sector).padStart(2,'0')}`;ui.name.textContent=w.name;ui.type.textContent=w.type;ui.desc.textContent=w.desc;ui.ammo.textContent=p.reloading?'···':p.ammo;ui.reserve.textContent=p.reserve;ui.base.style.width=`${state.base.hp}%`;ui.baseText.textContent=`${Math.ceil(state.base.hp)}%`;ui.health.style.width=`${p.hp}%`;ui.healthText.textContent=`${Math.ceil(p.hp)}%`;if(lastArt!==w.kind)drawWeaponCard(w.kind);}
  function drawWeaponArt(g,kind,scale=1){
    g.save();g.scale(scale,scale);g.translate(0,0);
    const metal='#687064',edge='#a4a28a',dark='#30382f',wood='#75543a',woodHi='#98704a';
    const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
    // Draw realistic period silhouettes from above, muzzle to the right.
    if(kind==='m16'){
      rect(-36,-3,26,6,wood);rect(-13,-4,40,8,dark);rect(-1,-6,9,12,metal);rect(4,-4,19,8,wood);rect(20,-3,37,6,metal);rect(57,-2,31,4,edge);rect(88,-2,10,4,dark);
      rect(-5,-8,16,2,metal);rect(-2,-11,11,3,edge);rect(8,-10,5,4,dark);rect(31,-3,7,13,dark);rect(35,7,4,12,metal);rect(38,18,3,6,dark);rect(-28,-4,5,8,woodHi);rect(50,-5,2,10,edge);
    }else if(kind==='ak'){
      rect(-39,-4,29,8,wood);rect(-12,-5,35,10,dark);rect(-3,-8,11,3,metal);rect(0,-5,22,10,wood);rect(20,-3,38,6,metal);rect(57,-2,34,4,edge);rect(90,-2,10,4,dark);
      // Curved stamped magazine and distinctive handguard / gas tube
      g.fillStyle=wood;g.beginPath();g.moveTo(10,4);g.lineTo(27,4);g.lineTo(34,20);g.quadraticCurveTo(35,27,29,28);g.lineTo(21,27);g.lineTo(17,11);g.closePath();g.fill();rect(5,-9,16,3,metal);rect(-29,-4,5,8,woodHi);rect(51,-4,3,8,edge);rect(-6,7,5,8,dark);rect(-2,-3,9,2,edge);
    }else if(kind==='m14'){
      rect(-40,-5,34,10,wood);rect(-7,-5,36,10,wood);rect(27,-4,33,8,metal);rect(60,-3,32,6,edge);rect(91,-2,9,4,dark);rect(-1,-7,31,2,metal);rect(1,-10,20,3,dark);rect(12,-5,5,10,edge);
      rect(5,5,6,10,dark);rect(10,14,4,8,metal);rect(9,22,6,3,dark);rect(-34,-4,5,8,woodHi);rect(47,-5,2,10,dark);rect(71,-4,2,8,metal);
    }else{
      // M60: long receiver, top cover, bipod and linked ammunition belt
      rect(-38,-5,27,10,dark);rect(-11,-9,40,18,metal);rect(-6,-11,30,3,edge);rect(28,-6,27,12,dark);rect(54,-3,37,6,metal);rect(90,-2,10,4,edge);rect(-3,9,6,14,dark);rect(4,8,6,16,metal);rect(7,22,8,3,dark);rect(13,9,7,15,metal);
      g.strokeStyle='#b49b55';g.lineWidth=2;g.beginPath();g.moveTo(22,-6);g.lineTo(18,-12);g.lineTo(12,-12);g.lineTo(9,-7);g.stroke();
      rect(-29,-4,7,8,wood);rect(12,-3,4,6,edge);rect(36,-3,3,6,edge);
    }
    g.restore();
  }
  function drawWeaponCard(kind){const c=document.createElement('canvas');c.width=190;c.height=100;const g=c.getContext('2d');g.translate(3,47);g.scale(.86,.86);drawWeaponArt(g,kind);ui.art.replaceChildren(c);lastArt=kind;}
  function toast(text){ui.toast.textContent=text;ui.toast.classList.add('show');state.toastTimer=1.5;}
  function startGame(){
    overlay.classList.add('hidden');state.mode='playing';state.last=performance.now();state.elapsed=0;state.sector=1;state.kills=0;state.score=0;state.shots=0;state.player={x:800,y:560,hp:100,maxHp:100,angle:0,speed:210,ammo:20,reserve:140,reloading:0,cooldown:0,invuln:0};state.base.hp=100;state.enemies=[];state.bullets=[];state.sparks=[];state.pickups=[];state.spawnTimer=.8;state.spawned=0;state.sectorTime=0;state.between=0;state.weaponIndex=0;ui.note.textContent=notes[0];ui.objective.textContent='Hold the perimeter';ui.copy.textContent='Clear the tree line. Keep the radio online.';updateHUD();requestAnimationFrame(frame);
  }
  function endGame(won){state.mode=won?'won':'lost';overlay.classList.remove('hidden');document.getElementById('overlay-title').innerHTML=won?'NIGHT<br><em>SECURED.</em>':'RADIO<br><em>SILENT.</em>';document.getElementById('overlay-copy').textContent=won?`The perimeter held. Extraction is inbound. You cleared ${state.kills} hostiles and kept Firebase 67 online.`:`Firebase 67 has gone quiet. You cleared ${state.kills} hostiles. Regroup and try another patrol.`;startButton.querySelector('span').textContent=won?'RUN IT AGAIN':'REDEPLOY';document.querySelector('.eyebrow').innerHTML=`<span></span> ${won?'MISSION COMPLETE':'MISSION FAILED'} · AFTER-ACTION REPORT`;document.querySelector('.briefing').innerHTML=`<div><small>HOSTILES CLEARED</small><b>${state.kills}</b></div><div><small>ROUNDS FIRED</small><b>${state.shots}</b></div><div><small>FINAL SCORE</small><b>${state.score}</b></div>`;}
  function togglePause(){if(state.mode==='playing'){state.mode='paused';overlay.classList.remove('hidden');document.getElementById('overlay-title').innerHTML='HOLD<br><em>POSITION.</em>';document.getElementById('overlay-copy').textContent='Take a moment. The perimeter is waiting.';startButton.querySelector('span').textContent='RESUME PATROL';document.querySelector('.eyebrow').innerHTML='<span></span> FIELD PAUSED · SECTOR '+String(state.sector).padStart(2,'0');}else if(state.mode==='paused'){overlay.classList.add('hidden');state.mode='playing';state.last=performance.now();requestAnimationFrame(frame);}}
  startButton.addEventListener('click',()=>state.mode==='paused'?togglePause():startGame());document.getElementById('pause-button').addEventListener('click',togglePause);
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();state.keys[k]=true;if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='escape'||k==='p'){togglePause();return;}if(k==='r')reload();if(k>='1'&&k<='4')setWeapon(Number(k)-1);});window.addEventListener('keyup',e=>state.keys[e.key.toLowerCase()]=false);
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();state.pointer.x=e.clientX-r.left;state.pointer.y=e.clientY-r.top;});canvas.addEventListener('pointerdown',e=>{if(e.button===0){state.pointer.down=true;canvas.setPointerCapture?.(e.pointerId);}});window.addEventListener('pointerup',()=>state.pointer.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  function reload(){const p=state.player,w=weapon();if(state.mode!=='playing'||p.reloading||p.ammo===w.mag||p.reserve<=0)return;p.reloading=w.reload;toast('RELOADING');}
  document.getElementById('touch-fire').addEventListener('pointerdown',e=>{e.preventDefault();state.touch.fire=true;});window.addEventListener('pointerup',()=>state.touch.fire=false);document.getElementById('touch-reload').addEventListener('pointerdown',e=>{e.preventDefault();reload();});
  const joystick=document.getElementById('joystick'),knob=joystick.querySelector('.joy-knob');
  joystick.addEventListener('pointerdown',e=>{e.preventDefault();joy.active=true;joy.id=e.pointerId;const r=joystick.getBoundingClientRect();joy.cx=r.left+r.width/2;joy.cy=r.top+r.height/2;joystick.setPointerCapture(e.pointerId);moveJoy(e);});joystick.addEventListener('pointermove',e=>{if(joy.active&&e.pointerId===joy.id)moveJoy(e);});function moveJoy(e){let dx=e.clientX-joy.cx,dy=e.clientY-joy.cy,d=Math.hypot(dx,dy),max=38;if(d>max){dx*=max/d;dy*=max/d;}state.touch.x=dx/max;state.touch.y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`;}function endJoy(){joy.active=false;state.touch.x=state.touch.y=0;knob.style.transform='';}joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);
  function spawnEnemy(){
    const side=Math.floor(rand(0,4)),x=side===0?-25:side===1?1625:rand(0,1600),y=side===2?-25:side===3?1025:rand(0,1000),elite=state.sector>=2&&Math.random()<.22;
    state.enemies.push({x,y,hp:elite?100:64,maxHp:elite?100:64,speed:elite?rand(48,64):rand(61,82)+state.sector*3,attack:rand(.4,1.3),shot:rand(1,2),elite,phase:rand(0,6.2),r:elite?14:11});
  }
  function update(dt){
    if(state.mode!=='playing')return;
    const p=state.player,w=weapon();state.elapsed+=dt;state.sectorTime+=dt;if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)ui.toast.classList.remove('show');}if(state.damageFlash>0)state.damageFlash-=dt;
    let dx=(state.keys.d||state.keys.arrowright?1:0)-(state.keys.a||state.keys.arrowleft?1:0)+state.touch.x,dy=(state.keys.s||state.keys.arrowdown?1:0)-(state.keys.w||state.keys.arrowup?1:0)+state.touch.y;let len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}p.x=clamp(p.x+dx*p.speed*dt,35,1565);p.y=clamp(p.y+dy*p.speed*dt,35,965);
    camera.x=clamp(p.x-W/2,0,1600-W);camera.y=clamp(p.y-H/2,0,1000-H);
    let aimX=state.pointer.x+camera.x,aimY=state.pointer.y+camera.y;
    if(state.touch.fire&&state.enemies.length){let nearest=state.enemies.reduce((a,b)=>dist(p,a)<dist(p,b)?a:b);aimX=nearest.x;aimY=nearest.y;}
    p.angle=Math.atan2(aimY-p.y,aimX-p.x);p.cooldown=Math.max(0,p.cooldown-dt);p.invuln=Math.max(0,p.invuln-dt);
    if(p.reloading>0){p.reloading-=dt;if(p.reloading<=0){let take=Math.min(w.mag-p.ammo,p.reserve);p.ammo+=take;p.reserve-=take;p.reloading=0;updateHUD();toast('MAGAZINE READY');}}
    if((state.pointer.down||state.touch.fire)&&p.cooldown<=0&&!p.reloading){if(p.ammo>0)fire();else if(p.reserve>0)reload();else{p.cooldown=.35;toast('OUT OF AMMUNITION');}}
    state.spawnTimer-=dt;if(state.spawnTimer<=0&&state.spawned<8+state.sector*3){spawnEnemy();state.spawned++;state.spawnTimer=Math.max(.65,2.4-state.sector*.35);}
    for(let i=state.enemies.length-1;i>=0;i--){const e=state.enemies[i],d=Math.hypot(800-e.x,560-e.y),pd=dist(e,p);e.phase+=dt*4;
      if(d>87){let tx=pd<245?p.x:800,ty=pd<245?p.y:560,a=Math.atan2(ty-e.y,tx-e.x);e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;}
      else{e.attack-=dt;if(e.attack<=0){state.base.hp=Math.max(0,state.base.hp-(e.elite?5:3));e.attack=e.elite?1.05:1.35;state.sparks.push({x:800+rand(-32,32),y:560+rand(-25,25),life:.22,max:.22,color:'#c58b58'});updateHUD();}}
      e.shot-=dt;if(pd<360&&e.shot<=0){const a=Math.atan2(p.y-e.y,p.x-e.x);state.bullets.push({x:e.x,y:e.y,vx:Math.cos(a)*250,vy:Math.sin(a)*250,life:1.7,enemy:true});e.shot=rand(1.6,2.5);}
      if(p.invuln<=0&&pd<13){p.hp=Math.max(0,p.hp-9);p.invuln=.65;state.damageFlash=.16;updateHUD();}
    }
    for(let i=state.bullets.length-1;i>=0;i--){const b=state.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let hit=false;if(b.enemy){if(Math.hypot(b.x-p.x,b.y-p.y)<14){if(p.invuln<=0){p.hp=Math.max(0,p.hp-8);p.invuln=.6;state.damageFlash=.13;updateHUD();}hit=true;}}else{for(let j=state.enemies.length-1;j>=0;j--){const e=state.enemies[j];if(Math.hypot(b.x-e.x,b.y-e.y)<e.r+2){e.hp-=b.damage;hit=true;state.sparks.push({x:b.x,y:b.y,life:.17,max:.17,color:'#e4c374'});if(e.hp<=0){state.kills++;state.score+=100+(e.elite?75:0);if(Math.random()<.17)state.pickups.push({x:e.x,y:e.y,type:'ammo',life:10});state.enemies.splice(j,1);}break;}}}if(hit||b.life<=0||b.x<0||b.y<0||b.x>1600||b.y>1000)state.bullets.splice(i,1);}
    for(let i=state.sparks.length-1;i>=0;i--){state.sparks[i].life-=dt;if(state.sparks[i].life<=0)state.sparks.splice(i,1);}
    for(let i=state.pickups.length-1;i>=0;i--){const q=state.pickups[i];q.life-=dt;if(dist(p,q)<24){p.reserve=Math.min(p.reserve+50,300);state.pickups.splice(i,1);toast('AMMUNITION RECOVERED');updateHUD();}else if(q.life<=0)state.pickups.splice(i,1);}
    if(state.spawned>=8+state.sector*3&&state.enemies.length===0){state.between+=dt;ui.wave.textContent='SECTOR CLEAR · REFORMING';if(state.between>3){if(state.sector>=3){endGame(true);return;}state.sector++;state.spawned=0;state.between=0;state.sectorTime=0;state.spawnTimer=1;state.base.hp=Math.min(100,state.base.hp+12);p.hp=Math.min(100,p.hp+15);p.reserve+=35;ui.note.textContent=notes[Math.floor(rand(0,notes.length))];ui.objective.textContent=['Hold the perimeter','Secure the radio tent','Hold until extraction'][state.sector-1];ui.copy.textContent=['Clear the tree line. Keep the radio online.','They are pressing the east approach.','Extraction is inbound—one last push.'][state.sector-1];updateHUD();toast(`SECTOR ${String(state.sector).padStart(2,'0')} · CONTACT INBOUND`);}}
    else{state.between=0;ui.wave.textContent=state.enemies.length?`CONTACT · ${state.enemies.length} HOSTILE${state.enemies.length===1?'':'S'}`:'AREA QUIET';}
    if(state.base.hp<=0||p.hp<=0){endGame(false);return;}
    draw();
  }
  function fire(){const p=state.player,w=weapon(),a=p.angle+rand(-w.spread,w.spread);p.ammo--;p.cooldown=w.rate/1000;state.shots++;state.bullets.push({x:p.x+Math.cos(a)*47,y:p.y+Math.sin(a)*47,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,life:1.25,damage:w.damage,enemy:false});state.sparks.push({x:p.x+Math.cos(a)*54,y:p.y+Math.sin(a)*54,life:.08,max:.08,color:'#ffd879'});updateHUD();}
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(-camera.x,-camera.y);drawGround();drawBase();drawTrees();drawPickups();drawBullets();drawEnemies();drawPlayer();drawSparks();ctx.restore();drawMiniMap();
    if(state.damageFlash>0){ctx.fillStyle=`rgba(168,55,34,${state.damageFlash*1.1})`;ctx.fillRect(0,0,W,H);}
    if(state.player.reloading>0){ctx.fillStyle='#eee6cd';ctx.font="10px 'DM Mono'";ctx.textAlign='center';ctx.fillText('RELOADING',W/2,H*.8);}
    if(state.player.invuln>0&&state.player.hp<30){ctx.strokeStyle=`rgba(196,67,48,${.3+Math.sin(state.elapsed*8)*.2})`;ctx.lineWidth=7;ctx.strokeRect(4,4,W-8,H-8);}
  }
  function drawGround(){
    ctx.fillStyle='#283326';ctx.fillRect(0,0,1600,1000);
    // Variegated jungle floor and broken clearings
    for(let i=0;i<state.decor.length;i++){const d=state.decor[i];ctx.fillStyle=d.type>.82?'#596044':d.type>.45?'#37402f':'#202b24';ctx.globalAlpha=.36;ctx.beginPath();ctx.ellipse(d.x,d.y,d.r*1.8,d.r*.8,0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    ctx.fillStyle='#59513a';ctx.globalAlpha=.43;ctx.beginPath();ctx.moveTo(800,560);ctx.bezierCurveTo(600,450,485,430,330,355);ctx.bezierCurveTo(455,492,587,530,800,600);ctx.fill();ctx.beginPath();ctx.moveTo(800,560);ctx.bezierCurveTo(936,457,1112,460,1342,335);ctx.bezierCurveTo(1200,514,1010,562,800,608);ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle='#bbb18712';ctx.lineWidth=1;for(let x=0;x<1600;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1000);ctx.stroke();}for(let y=0;y<1000;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1600,y);ctx.stroke();}
  }
  function drawBase(){
    // Camp clearing, perimeter sandbags, radio shack and tents
    ctx.fillStyle='#5e5940';ctx.globalAlpha=.24;ctx.beginPath();ctx.ellipse(800,560,151,108,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle='#a89d70';ctx.lineWidth=10;ctx.setLineDash([17,7]);ctx.beginPath();ctx.ellipse(800,560,116,79,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#aaa27b';ctx.fillRect(741,493,38,25);ctx.fillStyle='#665f45';ctx.beginPath();ctx.moveTo(738,493);ctx.lineTo(760,478);ctx.lineTo(782,493);ctx.fill();ctx.fillStyle='#c3ae72';ctx.fillRect(752,501,12,17);
    ctx.fillStyle='#78836d';ctx.beginPath();ctx.moveTo(831,578);ctx.lineTo(861,532);ctx.lineTo(891,578);ctx.closePath();ctx.fill();ctx.strokeStyle='#c0b894';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#bea96f';ctx.fillRect(852,567,17,11);
    // Radio mast and dish
    ctx.strokeStyle='#bbb492';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(800,484);ctx.lineTo(800,447);ctx.moveTo(791,459);ctx.lineTo(809,459);ctx.moveTo(794,467);ctx.lineTo(806,467);ctx.stroke();ctx.beginPath();ctx.arc(800,447,7,Math.PI,0);ctx.stroke();
    ctx.fillStyle='#d5c890';ctx.font="9px 'DM Mono'";ctx.textAlign='center';ctx.fillText('FIREBASE 67',800,618);
  }
  function drawTrees(){
    const pal=['#17271e','#1e3023','#283728','#35402b'];
    for(const t of state.trees){ctx.fillStyle='#10181180';ctx.beginPath();ctx.ellipse(t.x+5,t.y+9,t.r*1.08,t.r*.72,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3c3425';ctx.beginPath();ctx.ellipse(t.x,t.y+4,t.r*.25,t.r*.22,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=pal[t.tone];ctx.beginPath();ctx.arc(t.x,t.y,t.r*t.dark,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#77805444';ctx.lineWidth=2;ctx.beginPath();ctx.arc(t.x-2,t.y-3,t.r*.69,3.8,5.6);ctx.stroke();ctx.fillStyle='#4b553588';ctx.beginPath();ctx.arc(t.x-t.r*.2,t.y-t.r*.23,t.r*.34,3.5,5.6);ctx.fill();}
  }
  function drawPickups(){for(const q of state.pickups){ctx.save();ctx.translate(q.x,q.y);ctx.globalAlpha=Math.min(1,q.life);ctx.fillStyle='#c9bc83';ctx.fillRect(-8,-6,16,12);ctx.fillStyle='#31382c';ctx.fillRect(-5,-3,10,6);ctx.fillStyle='#d5cc9b';ctx.fillRect(-2,-6,4,12);ctx.restore();}}
  function drawBullets(){for(const b of state.bullets){ctx.strokeStyle=b.enemy?'#d18b53':'#ffe6a0';ctx.lineWidth=b.enemy?2:2.5;ctx.globalAlpha=.78;ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalAlpha=1;}}
  function drawEnemies(){for(const e of state.enemies){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.atan2(560-e.y,800-e.x));ctx.fillStyle='#0d120e88';ctx.beginPath();ctx.ellipse(2,5,e.r+3,e.r*.78,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=e.elite?'#765847':'#605b42';ctx.beginPath();ctx.ellipse(0,0,e.r,e.r*.75,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=e.elite?'#8f664d':'#7b7451';ctx.beginPath();ctx.arc(4,-1,e.r*.52,0,Math.PI*2);ctx.fill();ctx.fillStyle='#242c22';ctx.fillRect(4,-2,e.r+10,4);ctx.fillStyle='#a94f37';ctx.fillRect(-2,-2,4,4);if(e.hp<e.maxHp){ctx.fillStyle='#10140f';ctx.fillRect(-12,-e.r-8,24,3);ctx.fillStyle='#c27051';ctx.fillRect(-12,-e.r-8,24*e.hp/e.maxHp,3);}ctx.restore();}}
  function drawPlayer(){const p=state.player;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='#0e140f88';ctx.beginPath();ctx.ellipse(-1,5,21,15,0,0,Math.PI*2);ctx.fill();
    // Pack and shoulders, then rifle model pointed along the aim line.
    ctx.fillStyle='#48513a';ctx.beginPath();ctx.ellipse(-3,0,15,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#656749';ctx.beginPath();ctx.ellipse(0,0,11,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a19868';ctx.beginPath();ctx.arc(5,0,7.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7d7954';ctx.beginPath();ctx.arc(6,-1,6.2,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#d1c48b';ctx.fillRect(8,-1,2,2);
    ctx.save();ctx.translate(7,1);drawWeaponArt(ctx,weapon().kind,.73);ctx.restore();
    if(p.invuln>0&&Math.floor(state.elapsed*18)%2===0){ctx.strokeStyle='#f0d7a2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();}ctx.restore();}
  function drawSparks(){for(const s of state.sparks){ctx.globalAlpha=Math.max(0,s.life/s.max);ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,2+s.life*11,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
  function drawMiniMap(){const w=mapCanvas.width,h=mapCanvas.height;mctx.fillStyle='#273126';mctx.fillRect(0,0,w,h);for(const t of state.trees){mctx.fillStyle='#111b14';mctx.beginPath();mctx.arc(t.x/1600*w,t.y/1000*h,Math.max(1,t.r/7),0,Math.PI*2);mctx.fill();}mctx.strokeStyle='#8c875f';mctx.beginPath();mctx.arc(800/1600*w,560/1000*h,9,0,Math.PI*2);mctx.stroke();mctx.fillStyle='#c4c880';mctx.beginPath();mctx.arc(state.player.x/1600*w,state.player.y/1000*h,3,0,Math.PI*2);mctx.fill();mctx.fillStyle='#bd7555';for(const e of state.enemies){mctx.fillRect(e.x/1600*w-1,e.y/1000*h-1,3,3);}mctx.strokeStyle='#ffffff33';mctx.strokeRect(camera.x/1600*w,camera.y/1000*h,W/1600*w,H/1000*h);}
  function frame(now){if(state.mode!=='playing')return;const dt=Math.min(.035,(now-state.last)/1000||0);state.last=now;update(dt);if(state.mode==='playing')requestAnimationFrame(frame);}
  // Draw a quiet live scene beneath the briefing screen.
  draw();updateHUD();
})();
