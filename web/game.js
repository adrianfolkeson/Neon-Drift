// NEON DRIFT — Complete rebuild

'use strict'

// ─── Canvas Setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
let W = 800, H = 600

function resize() {
  W = canvas.width  = window.innerWidth
  H = canvas.height = window.innerHeight
}
resize()
window.addEventListener('resize', resize)

// ─── Constants ───────────────────────────────────────────────────────────────
const NUM_SEGS   = 120
const ROAD_W     = 0.58
const HORIZON_R  = 0.32
const CAMERA_DIST = 22
const ROAD_HW    = 1.0
const GRID_STEP  = 10

const C = {
  BG:'#050010', ROAD1:'#0C0020', ROAD2:'#08001A',
  CYAN:'#00FFFF', MAG:'#FF00FF', PURP:'#9900FF',
  RED:'#FF0044', YEL:'#FFFF00', GREEN:'#00FF88',
  GOLD:'#FFD700', WHT:'#FFFFFF', DIM:'rgba(255,255,255,0.4)'
}

function getHorizonY() { return H * HORIZON_R }

// ─── Skins / Trails / Cars ───────────────────────────────────────────────────
const SKINS = [
  {id:'blue',   name:'Neon Blue',   color:'#00FFFF', cost:0},
  {id:'green',  name:'Neon Green',  color:'#00FF88', cost:500},
  {id:'gold',   name:'Neon Gold',   color:'#FFD700', cost:2000},
  {id:'purple', name:'Neon Purple', color:'#CC00FF', cost:5000},
  {id:'red',    name:'Neon Red',    color:'#FF0044', cost:10000},
  {id:'rainbow',name:'Rainbow',     color:'rainbow', cost:25000},
]
const TRAILS = [
  {id:'none',    name:'None',      color:null,      cost:0},
  {id:'blue',    name:'Blue Glow', color:'#0088FF', cost:200},
  {id:'fire',    name:'Fire',      color:'#FF4400', cost:1000},
  {id:'electric',name:'Electric',  color:'#88FFFF', cost:5000},
]
const CARS = [
  {id:'sedan',  name:'City Sedan',   desc:'Balanced',          cost:0},
  {id:'sports', name:'Sports Coupe', desc:'Low & fast',        cost:1500},
  {id:'muscle', name:'Muscle Car',   desc:'Wide & aggressive', cost:4000},
  {id:'f1',     name:'F1 Racer',     desc:'Flat with wing',    cost:8000},
  {id:'cyber',  name:'Cyber Wedge',  desc:'Angular future',    cost:15000},
]
const LANES = [-0.64, 0, 0.64]

// ─── Save System ─────────────────────────────────────────────────────────────
const SAVE_KEY = 'neondrift_v2'
let save = {}

function defaultSave() {
  return {
    highScore:0, totalCoins:0, playerName:'',
    settings:{ musicVol:0.5, sfxVol:0.5, particles:true },
    unlockedSkins:['blue'], unlockedTrails:['none'], unlockedCars:['sedan'],
    activeSkin:'blue', activeTrail:'none', activeCar:'sedan',
    gamesPlayed:0
  }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      save = Object.assign(defaultSave(), parsed)
      save.settings = Object.assign(defaultSave().settings, parsed.settings||{})
    } else {
      save = defaultSave()
    }
  } catch(e) {
    save = defaultSave()
  }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch(e){}
}

// ─── Audio ───────────────────────────────────────────────────────────────────
let audioCtx = null
let engineOsc = null, engineGain = null
let windSrc = null, windGain = null
let musicNodes = []

function getAC() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function sfxPlay(freq, type, duration, volMult, freqEnd) {
  if (!save.settings.sfxVol) return
  try {
    const ac = getAC()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain); gain.connect(ac.destination)
    osc.type = type || 'sine'
    osc.frequency.setValueAtTime(freq, ac.currentTime)
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1,freqEnd), ac.currentTime + duration)
    const vol = 0.18 * (volMult||1) * save.settings.sfxVol
    gain.gain.setValueAtTime(vol, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + duration + 0.01)
  } catch(e){}
}

function sfxCrash()      { sfxPlay(200,'sawtooth',0.5,1.2,50) }
function sfxNearMiss()   { sfxPlay(800,'sine',0.15,0.7,1200) }
function sfxLaneSwitch() { sfxPlay(320,'sine',0.04,0.18,380) }   // subtle click
function sfxSpeedUp()   { sfxPlay(400,'sine',0.2,0.6,900) }
function sfxCoin()      { sfxPlay(1000,'sine',0.08,0.4) }
function sfxMilestone() {
  [880,1100,1320].forEach((f,i) => {
    setTimeout(()=>sfxPlay(f,'sine',0.25,0.5),i*60)
  })
}
function sfxMenuTick()  { sfxPlay(440,'sine',0.04,0.3) }
function sfxConfirm()   {
  sfxPlay(880,'sine',0.1,0.5)
  setTimeout(()=>sfxPlay(1100,'sine',0.1,0.5),80)
}

function startEngine() {
  // Engine hum removed — only bass music plays
}

function stopEngine() {
  try { if (windSrc) { windSrc.stop(); windSrc=null } } catch(e){}
  engineGain = null; windGain = null
}

function updateEngineAudio(speedMult) {
  if (!engineOsc || !engineGain) return
  try {
    const ac = getAC()
    engineOsc.frequency.setTargetAtTime(80 + speedMult*40, ac.currentTime, 0.1)
    engineGain.gain.setTargetAtTime(0.04 * save.settings.sfxVol, ac.currentTime, 0.1)
    if (windGain) {
      const wv = Math.min(0.06, (speedMult-1)*0.012) * save.settings.sfxVol
      windGain.gain.setTargetAtTime(wv, ac.currentTime, 0.1)
    }
  } catch(e){}
}

let musicStarted = false
let musicTimeout = null
function startMusic() {
  if (musicStarted || !save.settings.musicVol) return
  musicStarted = true
  try {
    const ac = getAC()
    const bpm = 120, beat = 60/bpm
    const pattern = [0,3,5,7,0,3,7,5]
    const baseFreq = 55
    function playBass(startT, noteIdx) {
      const semi = pattern[noteIdx % pattern.length]
      const freq = baseFreq * Math.pow(2, semi/12)
      const osc = ac.createOscillator()
      const g   = ac.createGain()
      osc.type = 'sawtooth'; osc.frequency.value = freq
      osc.connect(g); g.connect(ac.destination)
      g.gain.setValueAtTime(0.07 * save.settings.musicVol, startT)
      g.gain.exponentialRampToValueAtTime(0.001, startT + beat*0.85)
      osc.start(startT); osc.stop(startT + beat)
      musicNodes.push(osc)
    }
    let t = ac.currentTime
    function scheduleBar() {
      for (let i = 0; i < 8; i++) playBass(t + i*beat, i)
      t += beat * 8
      musicTimeout = setTimeout(scheduleBar, beat*8*1000 - 100)
    }
    scheduleBar()
  } catch(e){}
}
function stopMusic() {
  musicStarted = false
  clearTimeout(musicTimeout)
  musicNodes.forEach(n => { try { n.stop() } catch(e){} })
  musicNodes = []
}

// ─── Particle Pool ────────────────────────────────────────────────────────────
const POOL_SIZE = 300
const pool = Array.from({length: POOL_SIZE}, () => ({
  alive:false, x:0, y:0, vx:0, vy:0,
  life:0, maxLife:1, color:'#fff',
  r:2, type:'dot', gravity:60
}))

function getParticle() {
  return pool.find(p => !p.alive) || pool[0]
}

function emit(x, y, color, count, opts) {
  opts = opts || {}
  for (let i = 0; i < count; i++) {
    const p = getParticle()
    const angle = opts.angle != null
      ? opts.angle + (Math.random()-0.5)*(opts.spread||0.5)
      : Math.random()*Math.PI*2
    const speed = opts.speed || (20 + Math.random()*80)
    p.alive   = true
    p.x       = x; p.y = y
    p.vx      = Math.cos(angle)*speed
    p.vy      = Math.sin(angle)*speed + (opts.vy||0)
    p.life    = opts.life || (0.3 + Math.random()*0.5)
    p.maxLife = p.life
    p.color   = color
    p.r       = opts.r || (2 + Math.random()*3)
    p.type    = opts.type || 'dot'
    p.gravity = opts.gravity != null ? opts.gravity : 60
  }
}

function updateParticles(dt) {
  pool.forEach(p => {
    if (!p.alive) return
    p.x  += p.vx * dt; p.y += p.vy * dt
    p.vy += p.gravity * dt
    p.vx *= 0.98
    p.life -= dt
    if (p.life <= 0) p.alive = false
  })
}

function drawParticles() {
  pool.forEach(p => {
    if (!p.alive) return
    const a = Math.max(0, p.life / p.maxLife)
    ctx.save()
    ctx.globalAlpha = a
    ctx.shadowColor = p.color; ctx.shadowBlur = 8
    ctx.fillStyle   = p.color
    if (p.type === 'spark') {
      ctx.lineWidth = 1.5; ctx.strokeStyle = p.color
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx*0.06, p.y - p.vy*0.06)
      ctx.stroke()
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI*2); ctx.fill()
    }
    ctx.restore()
  })
}

// ─── Projection ───────────────────────────────────────────────────────────────
function segScreen(i) {
  const t = Math.max(0, Math.min(1, i / (NUM_SEGS - 1)))
  const c = t * t
  return {
    y:     getHorizonY() + (H - getHorizonY()) * c,
    halfW: (W * ROAD_W / 2) * c,
    t, scale: c
  }
}

function projectWorld(worldZ) {
  const relZ = worldZ - game.cameraZ
  if (relZ <= 0.1 || relZ >= NUM_SEGS) return null
  const segIdx = Math.min(NUM_SEGS-1, Math.max(0, Math.round(NUM_SEGS-1-relZ)))
  return segScreen(segIdx)
}

function carScreenPos() {
  const s = projectWorld(game.carZ)
  if (!s) return { x: W/2, y: H*0.78, halfW: W*ROAD_W/2*0.7 }
  return { x: W/2 + game.playerX * s.halfW / ROAD_HW, y: s.y, halfW: s.halfW }
}

// ─── Sky & Background ─────────────────────────────────────────────────────────
function drawSky() {
  const hy = getHorizonY()

  // Deep space gradient — very dark top, atmospheric purple near horizon
  const sg = ctx.createLinearGradient(0, 0, 0, hy)
  sg.addColorStop(0,   '#010006')
  sg.addColorStop(0.6, '#080018')
  sg.addColorStop(1,   '#120030')
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, hy)

  // Stars — minimal, static-feeling, no distracting twinkle
  for (let i = 0; i < 32; i++) {
    const sx = (i * 1483 + 37) % W
    const sy = (i * 937  + 11) % (hy * 0.85)
    const sa = 0.10 + (i % 3 === 0 ? 0.12 : 0.04)
    ctx.fillStyle = `rgba(200,170,255,${sa})`
    ctx.beginPath(); ctx.arc(sx, sy, i%9===0 ? 1.2 : 0.6, 0, Math.PI*2); ctx.fill()
  }

  // Wide atmospheric glow at horizon — TRON-style horizon bloom
  const hg1 = ctx.createLinearGradient(0, hy - 50, 0, hy + 20)
  hg1.addColorStop(0,   'rgba(80,0,160,0)')
  hg1.addColorStop(0.4, 'rgba(160,0,255,0.14)')
  hg1.addColorStop(0.7, 'rgba(200,0,255,0.08)')
  hg1.addColorStop(1,   'rgba(80,0,120,0)')
  ctx.fillStyle = hg1; ctx.fillRect(0, hy - 50, W, 70)

  // Subtle horizontal lens-flare line at horizon
  ctx.strokeStyle = 'rgba(180,80,255,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke()
}

// ─── Road ────────────────────────────────────────────────────────────────────
function drawRoad() {
  const hy    = getHorizonY()
  const nearS = segScreen(NUM_SEGS - 1)
  const farS  = segScreen(0)

  // ── Road surface — dark tarmac with depth ──────────────────────
  const rg = ctx.createLinearGradient(0, hy, 0, H)
  rg.addColorStop(0,   '#06000F')   // nearly black at horizon (receding depth)
  rg.addColorStop(0.3, '#09001A')
  rg.addColorStop(0.7, '#0C001E')
  rg.addColorStop(1,   '#0E0022')   // slightly brighter near camera
  ctx.fillStyle = rg
  ctx.beginPath()
  ctx.moveTo(W/2 - farS.halfW,  farS.y)
  ctx.lineTo(W/2 + farS.halfW,  farS.y)
  ctx.lineTo(W/2 + nearS.halfW, nearS.y)
  ctx.lineTo(W/2 - nearS.halfW, nearS.y)
  ctx.closePath(); ctx.fill()

  // ── Atmospheric fog at horizon — road fades into distance ───────
  const fog = ctx.createLinearGradient(0, hy, 0, hy + (nearS.y - hy) * 0.35)
  fog.addColorStop(0, 'rgba(20,0,50,0.55)')
  fog.addColorStop(1, 'rgba(20,0,50,0)')
  ctx.fillStyle = fog
  ctx.beginPath()
  ctx.moveTo(W/2 - farS.halfW, farS.y)
  ctx.lineTo(W/2 + farS.halfW, farS.y)
  ctx.lineTo(W/2 + nearS.halfW * 0.6, hy + (nearS.y - hy) * 0.35)
  ctx.lineTo(W/2 - nearS.halfW * 0.6, hy + (nearS.y - hy) * 0.35)
  ctx.closePath(); ctx.fill()

  // ── Road edges — magenta neon, elegant ─────────────────────────
  ctx.shadowColor = '#FF00FF'; ctx.shadowBlur = 8
  ctx.strokeStyle = '#DD00DD'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(W/2 - nearS.halfW, nearS.y); ctx.lineTo(W/2 - farS.halfW * 0.04, farS.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W/2 + nearS.halfW, nearS.y); ctx.lineTo(W/2 + farS.halfW * 0.04, farS.y); ctx.stroke()
  ctx.shadowBlur = 0

  // ── World-space horizontal grid — subtle, depth-fading ──────────
  const firstGrid = Math.ceil(game.cameraZ / GRID_STEP) * GRID_STEP
  for (let n = 0; n < 16; n++) {
    const wz  = firstGrid + n * GRID_STEP
    const rel = wz - game.cameraZ
    if (rel <= 0 || rel >= NUM_SEGS) continue
    const lo = Math.floor(rel), hi = Math.min(lo + 1, NUM_SEGS - 1)
    const fr = rel - lo
    const sL = segScreen(NUM_SEGS - 1 - lo), sH = segScreen(NUM_SEGS - 1 - hi)
    const sy  = sL.y * (1 - fr) + sH.y * fr
    const hw  = sL.halfW * (1 - fr) + sH.halfW * fr
    const a   = Math.pow(1 - rel / NUM_SEGS, 1.8) * 0.40  // sharper falloff
    ctx.strokeStyle = `rgba(100,0,200,${a})`
    ctx.lineWidth = 0.75
    ctx.beginPath(); ctx.moveTo(W/2 - hw, sy); ctx.lineTo(W/2 + hw, sy); ctx.stroke()
  }

  // ── World-space scrolling center dashes — lane marker ───────────
  const DASH_STEP = GRID_STEP / 2
  const firstDash = Math.ceil(game.cameraZ / DASH_STEP) * DASH_STEP
  for (let n = 0; n < 24; n++) {
    const wz  = firstDash + n * DASH_STEP
    const rel = wz - game.cameraZ
    if (rel <= 0 || rel >= NUM_SEGS - 2) continue
    if (Math.floor((wz / DASH_STEP)) % 2 === 0) continue  // skip every other = dashes
    const lo = Math.floor(rel)
    const s  = segScreen(NUM_SEGS - 1 - lo)
    const a  = Math.pow(1 - rel / NUM_SEGS, 2.0) * 0.55
    ctx.strokeStyle = `rgba(160,80,255,${a})`
    ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(W/2, s.y); ctx.lineTo(W/2, s.y + 3); ctx.stroke()
  }

  // ── Lane dividers at LANES[0] and LANES[2] ──────────────────────
  ctx.strokeStyle = 'rgba(70,0,140,0.22)'; ctx.lineWidth = 0.75
  for (let l = 0; l < 2; l++) {
    const lx0 = W/2 + LANES[l * 2] * nearS.halfW / ROAD_HW
    const lx1 = W/2 + LANES[l * 2] * farS.halfW  / ROAD_HW * 0.08
    ctx.beginPath(); ctx.moveTo(lx0, nearS.y); ctx.lineTo(lx1, farS.y); ctx.stroke()
  }

  // ── Near-camera road glow — car's headlights on road ────────────
  const carCP = carScreenPos()
  const nrgGrad = ctx.createRadialGradient(W/2, nearS.y, 0, W/2, nearS.y, nearS.halfW * 1.8)
  nrgGrad.addColorStop(0,   'rgba(0,200,255,0.06)')
  nrgGrad.addColorStop(0.5, 'rgba(0,100,180,0.03)')
  nrgGrad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = nrgGrad
  ctx.fillRect(W/2 - nearS.halfW * 1.8, carCP.y - 30, nearS.halfW * 3.6, H - carCP.y + 40)
}

// ─── Buildings ────────────────────────────────────────────────────────────────
const BUILDINGS = []
function initBuildings() {
  for (let i=0; i<24; i++) {
    BUILDINGS.push({
      side:   i%2===0?'left':'right',
      phase:  i*7.3,
      height: 0.25+(i%5)*0.08,
      width:  0.12+(i%3)*0.06,
    })
  }
}
initBuildings()

function drawBuildings() {
  const hy = getHorizonY()
  // Tiny drift: buildings barely move — almost static, just enough to feel alive
  const drift = (game.cameraZ * 0.018) % (W * 2)

  for (const b of BUILDINGS) {
    const side  = b.side === 'left'
    // Fixed screen X position based on phase, with tiny drift
    const baseX = side
      ? W * 0.01 + (b.phase * W * 0.18) % (W * 0.42)
      : W * 0.57 + (b.phase * W * 0.18) % (W * 0.42)
    const bx = ((baseX - drift * (side ? 0.5 : -0.5)) % W + W) % W

    // Fixed screen height — buildings are distant, always near horizon
    const bh = hy * (0.22 + b.height * 0.38)
    const bw = W * (0.028 + b.width * 0.040)
    const by = hy - bh

    if (bx + bw < 0 || bx > W) continue

    ctx.save()
    ctx.globalAlpha = 0.32   // dim — background silhouette only

    // Dark fill, silhouette look
    ctx.fillStyle = '#060014'
    ctx.fillRect(bx, by, bw, bh)

    // Faint dim outline — no shadowBlur, no glow
    ctx.strokeStyle = 'rgba(120,40,180,0.35)'
    ctx.lineWidth   = 0.75
    ctx.strokeRect(bx, by, bw, bh)

    // Subtle horizontal floor lines (every ~12px)
    ctx.strokeStyle = 'rgba(100,30,150,0.18)'
    ctx.lineWidth   = 0.5
    const floorH = Math.max(8, bh / Math.max(3, Math.floor(bh / 14)))
    for (let y = by + floorH; y < by + bh - 2; y += floorH) {
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke()
    }

    // A few dim window dots — static, no animation
    ctx.fillStyle = 'rgba(200,160,80,0.28)'
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        if ((Math.floor(b.phase * 3) + r + c) % 3 !== 0) {
          ctx.fillRect(
            bx + c * (bw * 0.35) + bw * 0.1,
            by + r * (bh * 0.24) + bh * 0.08,
            Math.max(1.5, bw * 0.14),
            Math.max(1.5, bh * 0.06)
          )
        }
      }
    }
    ctx.restore()
  }
}

// ─── Speed Pads ──────────────────────────────────────────────────────────────
function drawSpeedPads() {
  const rHW = W*ROAD_W/2
  for (const pad of game.speedPads) {
    const s = projectWorld(pad.wz)
    if (!s) continue
    const sx = W/2 + pad.wx*rHW
    const a  = Math.min(1, s.t*1.5)
    const pw = rHW*0.50*(0.25+0.75*s.t)
    const ph = pw*0.30
    ctx.save(); ctx.globalAlpha=a
    ctx.shadowColor=C.GREEN; ctx.shadowBlur=20*s.t
    ctx.strokeStyle=C.GREEN; ctx.fillStyle='rgba(0,255,136,0.15)'
    ctx.lineWidth=Math.max(1,s.t*2)
    ctx.beginPath()
    ctx.moveTo(sx,    s.y-ph)
    ctx.lineTo(sx+pw/2, s.y)
    ctx.lineTo(sx,    s.y+ph*0.25)
    ctx.lineTo(sx-pw/2, s.y)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    if (pw>14) {
      ctx.fillStyle=C.GREEN; ctx.shadowBlur=8
      ctx.font=`bold ${Math.max(7,pw*0.22)}px monospace`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText('BOOST',sx,s.y-ph*0.1)
      ctx.textBaseline='alphabetic'
    }
    ctx.restore()
  }
}

// ─── Obstacles ───────────────────────────────────────────────────────────────
const OCOL = {
  block:    {s:'#FF0044', f:'rgba(255,0,68,0.65)',    top:'rgba(255,100,120,0.85)', hi:'#FF4466'},
  moving:   {s:'#FFFF00', f:'rgba(200,200,0,0.65)',   top:'rgba(255,255,100,0.85)', hi:'#FFFF44'},
  shrinking:{s:'#00FF88', f:'rgba(0,200,100,0.65)',   top:'rgba(80,255,160,0.85)',  hi:'#44FFAA'},
  ghost:    {s:'#CC88FF', f:'rgba(140,60,220,0.50)',  top:'rgba(200,140,255,0.65)', hi:'#DD99FF'},
  rotating: {s:'#FF00FF', f:'rgba(200,0,200,0.65)',   top:'rgba(255,80,255,0.85)',  hi:'#FF44FF'},
  wall_l:   {s:'#FF8800', f:'rgba(200,80,0,0.65)',    top:'rgba(255,160,60,0.85)',  hi:'#FFAA44'},
  wall_r:   {s:'#FF8800', f:'rgba(200,80,0,0.65)',    top:'rgba(255,160,60,0.85)',  hi:'#FFAA44'},
}

function projectObstacle(o) {
  const s = projectWorld(o.wz)
  if (!s) return null
  // Use s.halfW (road width at this depth) for X — anchors obstacle to its lane at all distances
  const sx = W/2 + (o.wx / ROAD_HW) * s.halfW
  const sw = s.halfW * 0.56
  const sh = sw * 0.95
  return { x:sx-sw/2, y:s.y-sh, w:sw, h:sh, s }
}

function drawObstacle(o) {
  const p = projectObstacle(o)
  if (!p || p.s.t < 0.02) return
  const col   = OCOL[o.type] || OCOL.block
  const alpha = o.type === 'ghost' ? 0.48 : 1.0
  const {x, y, w, h} = p
  const t = game.time

  ctx.save()
  ctx.globalAlpha = alpha

  // ── Interior fill — very transparent, holographic feel ──────────
  const interiorAlpha = o.type === 'ghost' ? 0.06 : 0.10
  ctx.fillStyle = col.f.replace(/[\d.]+\)$/, `${interiorAlpha})`)
  ctx.fillRect(x, y, w, h)

  // ── Animated scan lines (horizontal, downward sweep) ────────────
  const scanSpacing = Math.max(5, h * 0.14)
  const scanOff     = (t * 55 + o.wz * 1.5) % scanSpacing
  ctx.globalAlpha   = alpha * (o.type === 'ghost' ? 0.12 : 0.18)
  ctx.strokeStyle   = col.s; ctx.lineWidth = 0.7
  for (let sy = y + scanOff - scanSpacing; sy < y + h; sy += scanSpacing) {
    if (sy < y || sy > y + h) continue
    ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + w, sy); ctx.stroke()
  }

  // ── Left energy pillar ──────────────────────────────────────────
  ctx.globalAlpha   = alpha
  ctx.shadowColor   = col.s; ctx.shadowBlur = 10
  ctx.strokeStyle   = col.s; ctx.lineWidth  = Math.max(1.5, p.s.t * 3)
  ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + h); ctx.stroke()

  // ── Right energy pillar ─────────────────────────────────────────
  ctx.beginPath(); ctx.moveTo(x + w - 1, y); ctx.lineTo(x + w - 1, y + h); ctx.stroke()

  // ── Top energy beam — brightest, primary read element ──────────
  ctx.shadowBlur  = 18; ctx.lineWidth = Math.max(2, p.s.t * 3.5)
  ctx.strokeStyle = col.hi
  ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x + w + 1, y); ctx.stroke()

  // ── Ground bar — connects to road surface ──────────────────────
  ctx.shadowBlur  = 5; ctx.lineWidth = 1.5; ctx.strokeStyle = col.s
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()

  // ── Type-specific visual variations ────────────────────────────
  if (o.type === 'rotating') {
    // Spinning X pattern inside
    ctx.save()
    ctx.translate(x + w/2, y + h/2); ctx.rotate(o.angle)
    ctx.globalAlpha = alpha * 0.55; ctx.strokeStyle = col.hi; ctx.lineWidth = 1.5; ctx.shadowBlur = 6
    ctx.beginPath(); ctx.moveTo(-w*0.4, -h*0.4); ctx.lineTo(w*0.4, h*0.4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(w*0.4, -h*0.4); ctx.lineTo(-w*0.4, h*0.4); ctx.stroke()
    ctx.restore()
  } else if (o.type === 'ghost') {
    // Dashed outline — hard to fully read
    ctx.globalAlpha = alpha * 0.7
    ctx.setLineDash([4, 6])
    ctx.strokeStyle = col.hi; ctx.lineWidth = 1; ctx.shadowBlur = 4
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4)
    ctx.setLineDash([])
  } else if (o.type === 'moving') {
    // Horizontal speed arrows inside
    ctx.globalAlpha = alpha * 0.4; ctx.strokeStyle = col.hi; ctx.lineWidth = 1; ctx.shadowBlur = 4
    const arrY = y + h * 0.5
    ctx.beginPath(); ctx.moveTo(x + w*0.2, arrY); ctx.lineTo(x + w*0.8, arrY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x + w*0.6, arrY - h*0.18); ctx.lineTo(x + w*0.8, arrY); ctx.lineTo(x + w*0.6, arrY + h*0.18); ctx.stroke()
  } else if (o.type === 'shrinking') {
    // Inward-pointing triangles showing it's shrinking
    ctx.globalAlpha = alpha * 0.35; ctx.strokeStyle = col.hi; ctx.lineWidth = 1; ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + w*0.3, y + h*0.5); ctx.lineTo(x + 2, y + h - 2); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w - 2, y + 2); ctx.lineTo(x + w*0.7, y + h*0.5); ctx.lineTo(x + w - 2, y + h - 2); ctx.stroke()
  }

  // ── Pulsing danger warning at center ───────────────────────────
  const warn = 0.3 + 0.25 * Math.abs(Math.sin(t * 2.8 + o.wz * 0.3))
  ctx.globalAlpha = alpha * warn
  ctx.strokeStyle = col.hi; ctx.lineWidth = 1; ctx.shadowBlur = 10
  ctx.beginPath(); ctx.moveTo(x + w/2, y + h*0.12); ctx.lineTo(x + w/2, y + h*0.88); ctx.stroke()

  // ── 3D top face — gives depth without being a box ──────────────
  const topH = h * 0.18, shr = 0.82
  const bL   = x + w*(1-shr)/2, bR = x + w - w*(1-shr)/2
  ctx.globalAlpha = alpha * 0.5; ctx.shadowBlur = 6
  ctx.strokeStyle = col.hi; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(bL, y - topH); ctx.lineTo(bR, y - topH); ctx.stroke()
  ctx.globalAlpha = alpha * 0.3; ctx.lineWidth = 0.8; ctx.strokeStyle = col.s
  ctx.beginPath(); ctx.moveTo(bL, y - topH); ctx.lineTo(x, y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(bR, y - topH); ctx.lineTo(x + w, y); ctx.stroke()

  ctx.restore()
}

// ─── Wheel ────────────────────────────────────────────────────────────────────
let wheelAngle = 0
function drawWheel(wx, wy, r, col) {
  ctx.save()
  ctx.shadowColor=col; ctx.shadowBlur=10
  ctx.strokeStyle=col; ctx.lineWidth=r*0.5
  ctx.beginPath(); ctx.arc(wx,wy,r*0.72,0,Math.PI*2); ctx.stroke()
  ctx.fillStyle='#0A0015'; ctx.strokeStyle=col; ctx.lineWidth=1
  ctx.beginPath(); ctx.arc(wx,wy,r*0.35,0,Math.PI*2); ctx.fill(); ctx.stroke()
  ctx.lineWidth=1.5
  for (let sp=0;sp<4;sp++) {
    const sa=wheelAngle+sp*Math.PI/2
    ctx.beginPath()
    ctx.moveTo(wx+Math.cos(sa)*r*0.35, wy+Math.sin(sa)*r*0.35)
    ctx.lineTo(wx+Math.cos(sa)*r*0.72, wy+Math.sin(sa)*r*0.72)
    ctx.stroke()
  }
  ctx.restore()
}

// ─── Car Models ───────────────────────────────────────────────────────────────
function drawSedan(px,py,cw,ch,CAR,TRIM) {
  const w=cw*2, h=ch*2
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2
  ctx.beginPath()
  ctx.moveTo(px-w*0.5, py+h*0.35)
  ctx.lineTo(px-w*0.5, py-h*0.05)
  ctx.lineTo(px-w*0.3, py-h*0.45)
  ctx.lineTo(px+w*0.3, py-h*0.45)
  ctx.lineTo(px+w*0.5, py-h*0.05)
  ctx.lineTo(px+w*0.5, py+h*0.35)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle='rgba(0,200,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(px-w*0.25, py-h*0.08)
  ctx.lineTo(px-w*0.22, py-h*0.42)
  ctx.lineTo(px+w*0.22, py-h*0.42)
  ctx.lineTo(px+w*0.25, py-h*0.08)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle=TRIM; ctx.lineWidth=1.5; ctx.globalAlpha=0.7
  ctx.beginPath(); ctx.moveTo(px-w*0.22,py-h*0.42); ctx.lineTo(px+w*0.22,py-h*0.42); ctx.stroke()
  ctx.globalAlpha=1
  ctx.fillStyle='#FF0033'; ctx.shadowColor='#FF0033'; ctx.shadowBlur=10
  ctx.fillRect(px-w*0.5, py-h*0.02, w*0.09, h*0.12)
  ctx.fillRect(px+w*0.41, py-h*0.02, w*0.09, h*0.12)
  ctx.shadowBlur=0
  const wr=cw*0.32
  drawWheel(px-w*0.38, py+h*0.38, wr, TRIM)
  drawWheel(px+w*0.38, py+h*0.38, wr, TRIM)
  drawWheel(px-w*0.38, py+h*0.04, wr, TRIM)
  drawWheel(px+w*0.38, py+h*0.04, wr, TRIM)
  ctx.strokeStyle=TRIM; ctx.lineWidth=2; ctx.globalAlpha=0.6
  ctx.shadowColor=TRIM; ctx.shadowBlur=12
  ctx.beginPath(); ctx.moveTo(px-w*0.48,py+h*0.36); ctx.lineTo(px+w*0.48,py+h*0.36); ctx.stroke()
  ctx.globalAlpha=1; ctx.shadowBlur=0
}

function drawSports(px,py,cw,ch,CAR,TRIM) {
  const w=cw*2, h=ch*1.7
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2
  ctx.beginPath()
  ctx.moveTo(px-w*0.52, py+h*0.42)
  ctx.lineTo(px-w*0.52, py+h*0.05)
  ctx.lineTo(px-w*0.38, py-h*0.38)
  ctx.lineTo(px-w*0.10, py-h*0.52)
  ctx.lineTo(px+w*0.20, py-h*0.52)
  ctx.lineTo(px+w*0.50, py-h*0.10)
  ctx.lineTo(px+w*0.52, py+h*0.42)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle='rgba(0,200,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(px-w*0.30, py+h*0.02)
  ctx.lineTo(px-w*0.08, py-h*0.48)
  ctx.lineTo(px+w*0.18, py-h*0.48)
  ctx.lineTo(px+w*0.44, py-h*0.06)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle='#FF0033'; ctx.shadowColor='#FF0033'; ctx.shadowBlur=10
  ctx.fillRect(px-w*0.52, py+h*0.10, w*0.08, h*0.14)
  ctx.fillRect(px+w*0.44, py-h*0.06, w*0.08, h*0.14)
  ctx.shadowBlur=0
  const wr=cw*0.30
  drawWheel(px-w*0.40, py+h*0.44, wr, TRIM)
  drawWheel(px+w*0.40, py+h*0.44, wr, TRIM)
  drawWheel(px-w*0.40, py+h*0.06, wr, TRIM)
  drawWheel(px+w*0.40, py+h*0.06, wr, TRIM)
  ctx.strokeStyle=TRIM; ctx.lineWidth=2; ctx.globalAlpha=0.6
  ctx.shadowColor=TRIM; ctx.shadowBlur=12
  ctx.beginPath(); ctx.moveTo(px-w*0.50,py+h*0.43); ctx.lineTo(px+w*0.50,py+h*0.43); ctx.stroke()
  ctx.globalAlpha=1; ctx.shadowBlur=0
}

function drawMuscle(px,py,cw,ch,CAR,TRIM) {
  const w=cw*2.2, h=ch*2.1
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2.5
  ctx.beginPath()
  ctx.moveTo(px-w*0.52, py+h*0.40)
  ctx.lineTo(px-w*0.52, py-h*0.10)
  ctx.lineTo(px-w*0.42, py-h*0.42)
  ctx.lineTo(px-w*0.14, py-h*0.52)
  ctx.lineTo(px+w*0.14, py-h*0.52)
  ctx.lineTo(px+w*0.42, py-h*0.42)
  ctx.lineTo(px+w*0.52, py-h*0.10)
  ctx.lineTo(px+w*0.52, py+h*0.40)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle=TRIM; ctx.globalAlpha=0.5
  ctx.beginPath()
  ctx.ellipse(px, py-h*0.28, w*0.12, h*0.08, 0, 0, Math.PI*2)
  ctx.fill()
  ctx.globalAlpha=1
  ctx.fillStyle='rgba(0,200,255,0.15)'
  ctx.beginPath()
  ctx.moveTo(px-w*0.38, py-h*0.14)
  ctx.lineTo(px-w*0.12, py-h*0.50)
  ctx.lineTo(px+w*0.12, py-h*0.50)
  ctx.lineTo(px+w*0.38, py-h*0.14)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle='#FF0033'; ctx.shadowColor='#FF0033'; ctx.shadowBlur=12
  ctx.fillRect(px-w*0.52, py-h*0.08, w*0.10, h*0.15)
  ctx.fillRect(px+w*0.42, py-h*0.08, w*0.10, h*0.15)
  ctx.shadowBlur=0
  const wr=cw*0.36
  drawWheel(px-w*0.42, py+h*0.44, wr, TRIM)
  drawWheel(px+w*0.42, py+h*0.44, wr, TRIM)
  drawWheel(px-w*0.42, py+h*0.05, wr, TRIM)
  drawWheel(px+w*0.42, py+h*0.05, wr, TRIM)
  ctx.strokeStyle=TRIM; ctx.lineWidth=2.5; ctx.globalAlpha=0.6
  ctx.shadowColor=TRIM; ctx.shadowBlur=14
  ctx.beginPath(); ctx.moveTo(px-w*0.50,py+h*0.42); ctx.lineTo(px+w*0.50,py+h*0.42); ctx.stroke()
  ctx.globalAlpha=1; ctx.shadowBlur=0
}

function drawF1(px,py,cw,ch,CAR,TRIM) {
  const w=cw*2, h=ch*1.3
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=1.5
  ctx.beginPath()
  ctx.moveTo(px, py-h*0.75)
  ctx.lineTo(px-w*0.15, py-h*0.40)
  ctx.lineTo(px-w*0.50, py-h*0.20)
  ctx.lineTo(px-w*0.52, py+h*0.38)
  ctx.lineTo(px+w*0.52, py+h*0.38)
  ctx.lineTo(px+w*0.50, py-h*0.20)
  ctx.lineTo(px+w*0.15, py-h*0.40)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle='rgba(0,200,255,0.22)'
  ctx.beginPath()
  ctx.ellipse(px, py-h*0.12, w*0.14, h*0.25, 0, 0, Math.PI*2)
  ctx.fill()
  ctx.fillStyle=TRIM; ctx.globalAlpha=0.85
  ctx.fillRect(px-w*0.52, py+h*0.22, w*1.04, h*0.08)
  ctx.globalAlpha=1
  ctx.fillStyle=TRIM; ctx.globalAlpha=0.7
  ctx.fillRect(px-w*0.35, py-h*0.68, w*0.70, h*0.07)
  ctx.globalAlpha=1
  ctx.fillStyle='#FF0033'; ctx.shadowColor='#FF0033'; ctx.shadowBlur=10
  ctx.fillRect(px-w*0.52, py+h*0.06, w*0.09, h*0.10)
  ctx.fillRect(px+w*0.43, py+h*0.06, w*0.09, h*0.10)
  ctx.shadowBlur=0
  const wr=cw*0.26
  drawWheel(px-w*0.48, py+h*0.40, wr, TRIM)
  drawWheel(px+w*0.48, py+h*0.40, wr, TRIM)
  drawWheel(px-w*0.40, py-h*0.15, wr, TRIM)
  drawWheel(px+w*0.40, py-h*0.15, wr, TRIM)
  ctx.strokeStyle=TRIM; ctx.lineWidth=2; ctx.globalAlpha=0.7
  ctx.shadowColor=TRIM; ctx.shadowBlur=10
  ctx.beginPath(); ctx.moveTo(px-w*0.50,py+h*0.40); ctx.lineTo(px+w*0.50,py+h*0.40); ctx.stroke()
  ctx.globalAlpha=1; ctx.shadowBlur=0
}

function drawCyber(px,py,cw,ch,CAR,TRIM) {
  const w=cw*2, h=ch*1.8
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2
  ctx.beginPath()
  ctx.moveTo(px-w*0.20, py-h*0.55)
  ctx.lineTo(px+w*0.50, py-h*0.30)
  ctx.lineTo(px+w*0.52, py+h*0.38)
  ctx.lineTo(px-w*0.52, py+h*0.38)
  ctx.lineTo(px-w*0.52, py-h*0.10)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.strokeStyle=TRIM; ctx.lineWidth=1.5; ctx.globalAlpha=0.7
  ctx.beginPath()
  ctx.moveTo(px-w*0.20, py-h*0.55)
  ctx.lineTo(px-w*0.52, py-h*0.10)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px-w*0.10, py-h*0.20)
  ctx.lineTo(px+w*0.40, py-h*0.06)
  ctx.stroke()
  ctx.globalAlpha=1
  ctx.fillStyle='rgba(0,200,255,0.20)'
  ctx.beginPath()
  ctx.moveTo(px-w*0.15, py-h*0.52)
  ctx.lineTo(px+w*0.44, py-h*0.28)
  ctx.lineTo(px+w*0.44, py-h*0.08)
  ctx.lineTo(px-w*0.15, py-h*0.08)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle='#FF0033'; ctx.shadowColor='#FF0033'; ctx.shadowBlur=10
  ctx.fillRect(px-w*0.52, py, w*0.09, h*0.12)
  ctx.fillRect(px+w*0.43, py-h*0.28, w*0.09, h*0.12)
  ctx.shadowBlur=0
  const wr=cw*0.30
  drawWheel(px-w*0.40, py+h*0.42, wr, TRIM)
  drawWheel(px+w*0.40, py+h*0.42, wr, TRIM)
  drawWheel(px-w*0.40, py+h*0.04, wr, TRIM)
  drawWheel(px+w*0.40, py+h*0.04, wr, TRIM)
  ctx.strokeStyle=TRIM; ctx.lineWidth=2; ctx.globalAlpha=0.6
  ctx.shadowColor=TRIM; ctx.shadowBlur=12
  ctx.beginPath(); ctx.moveTo(px-w*0.50,py+h*0.40); ctx.lineTo(px+w*0.50,py+h*0.40); ctx.stroke()
  ctx.globalAlpha=1; ctx.shadowBlur=0
}

function drawCarModel(px,py,cw,ch,CAR,TRIM,model) {
  if      (model==='sedan')  drawSedan(px,py,cw,ch,CAR,TRIM)
  else if (model==='sports') drawSports(px,py,cw,ch,CAR,TRIM)
  else if (model==='muscle') drawMuscle(px,py,cw,ch,CAR,TRIM)
  else if (model==='f1')     drawF1(px,py,cw,ch,CAR,TRIM)
  else if (model==='cyber')  drawCyber(px,py,cw,ch,CAR,TRIM)
  else                       drawSedan(px,py,cw,ch,CAR,TRIM)
}

function getSkinColor() {
  const skin = SKINS.find(s=>s.id===save.activeSkin)||SKINS[0]
  return skin.color==='rainbow'
    ? `hsl(${(Date.now()/6)%360},100%,60%)`
    : skin.color
}

function drawCar() {
  const cp   = carScreenPos()
  const px   = cp.x, py = cp.y
  const cw   = cp.halfW * 0.36   // larger presence
  const ch   = cp.halfW * 0.26
  const TRIM = getSkinColor()
  const CAR  = '#080015'
  const roll = game.playerVX * -0.08   // subtle body roll

  // ── Hover shadow on road surface ────────────────────────────────
  const nearS  = segScreen(NUM_SEGS - 1)
  const shadowY = nearS.y - 4
  const shd = ctx.createRadialGradient(px, shadowY, 0, px, shadowY, cw * 3.2)
  shd.addColorStop(0, 'rgba(0,200,255,0.16)')
  shd.addColorStop(0.4,'rgba(0,100,200,0.08)')
  shd.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shd
  ctx.beginPath(); ctx.ellipse(px, shadowY, cw * 3.2, cw * 0.5, 0, 0, Math.PI * 2); ctx.fill()

  // ── Headlight beams — forward-pointing glow cones ───────────────
  const beamY = py - ch * 1.8    // beams reach toward horizon
  ctx.save()
  ctx.globalAlpha = 0.055
  const lb = ctx.createLinearGradient(px - cw * 0.6, py - ch, px - cw * 0.6, beamY)
  lb.addColorStop(0, 'rgba(150,220,255,1)')
  lb.addColorStop(1, 'rgba(150,220,255,0)')
  ctx.fillStyle = lb
  ctx.beginPath()
  ctx.moveTo(px - cw * 0.7, py - ch)
  ctx.lineTo(px - cw * 2.2, beamY)
  ctx.lineTo(px,            beamY)
  ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px + cw * 0.7, py - ch)
  ctx.lineTo(px + cw * 2.2, beamY)
  ctx.lineTo(px,            beamY)
  ctx.closePath(); ctx.fill()
  ctx.restore()

  // ── Car body ─────────────────────────────────────────────────────
  ctx.save()
  ctx.translate(px, py); ctx.rotate(roll); ctx.translate(-px, -py)
  ctx.shadowColor = TRIM; ctx.shadowBlur = 18
  drawCarModel(px, py, cw, ch, CAR, TRIM, save.activeCar || 'sedan')
  ctx.restore()

  // ── Exhaust particles ─────────────────────────────────────────────
  if (save.settings.particles && !game.dead) {
    const exhaustCol = game.bonusSpeed > 0 ? '#FF4400' : TRIM
    emit(px, py + ch * 0.08, exhaustCol, 1,
      {angle: Math.PI/2, spread:0.5, speed:12+Math.random()*20, life:0.22, r:2+Math.random()*2.5, gravity:-8, vy:18})
    if (game.speedMult > 3.0) {
      emit(px - cw * 0.4, py + ch * 0.06, '#FF5500', 1, {angle:Math.PI*0.58, spread:0.35, speed:18, life:0.18, r:2.5, gravity:0})
      emit(px + cw * 0.4, py + ch * 0.06, '#FF5500', 1, {angle:Math.PI*0.42, spread:0.35, speed:18, life:0.18, r:2.5, gravity:0})
    }
  }
}

// ─── Screen Effects ───────────────────────────────────────────────────────────
function drawSpeedLines() {
  const intensity = Math.min(1,(game.speedMult-3.5)/4)   // only at higher speed
  if (intensity<0.05) return
  const cp = carScreenPos()
  ctx.save(); ctx.globalAlpha=0.04+intensity*0.07  // subtler speed lines
  ctx.strokeStyle=getSkinColor(); ctx.lineWidth=1
  for (let i=0;i<16;i++) {
    const angle=(i/16)*Math.PI*2
    const len=30+intensity*120
    ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=4
    ctx.beginPath(); ctx.moveTo(cp.x,cp.y)
    ctx.lineTo(cp.x+Math.cos(angle)*len, cp.y+Math.sin(angle)*len)
    ctx.stroke()
  }
  ctx.restore()
}

function drawChromaticAberration() {
  const intensity = Math.min(0.4,(game.speedMult-5.5)/4)  // only triggers at very high speed, capped low
  if (intensity<0.05) return
  const off = Math.floor(intensity*5)
  ctx.save()
  ctx.globalCompositeOperation='screen'
  ctx.globalAlpha=intensity*0.35
  ctx.fillStyle='rgba(255,0,0,0.3)'; ctx.fillRect(-off,0,W+off,H)
  ctx.fillStyle='rgba(0,0,255,0.3)'; ctx.fillRect(off,0,W-off,H)
  ctx.restore()
}

function drawVignette() {
  // Radial — focus on road center
  const vg = ctx.createRadialGradient(W/2, H*0.55, H*0.22, W/2, H*0.55, H*0.82)
  vg.addColorStop(0,   'rgba(0,0,0,0)')
  vg.addColorStop(0.6, 'rgba(0,0,8,0.12)')
  vg.addColorStop(1,   'rgba(0,0,12,0.80)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
  // Top bar — pushes attention down to road
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.20)
  top.addColorStop(0, 'rgba(0,0,6,0.52)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, H * 0.20)
}

function applyFlash() {
  if (game.flashTimer>0 && game.flashColor) {
    ctx.fillStyle=game.flashColor
    ctx.globalAlpha=Math.min(0.22,game.flashTimer*0.25)
    ctx.fillRect(0,0,W,H)
    ctx.globalAlpha=1
  }
}

function applyGrayscale() {
  if (!game.dead) return
  const t=Math.min(1,game.deathTimer/1.5)
  ctx.save()
  ctx.globalAlpha=t*0.7
  ctx.fillStyle='rgba(40,40,60,1)'
  ctx.globalCompositeOperation='color'
  ctx.fillRect(0,0,W,H)
  ctx.restore()
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function drawHUD() {
  const score=Math.floor(game.score)
  ctx.save()

  ctx.textAlign='center'; ctx.textBaseline='top'
  ctx.font=`900 ${Math.min(44,W*0.07)}px Orbitron,monospace`
  ctx.fillStyle='#CC00FF'; ctx.shadowColor='#CC00FF'; ctx.shadowBlur=24
  ctx.fillText(score.toLocaleString(), W/2, 14)
  ctx.shadowBlur=0
  ctx.font=`${Math.min(13,W*0.02)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.35)'
  if (Math.floor(game.score) > save.highScore && save.highScore > 0) {
    const pbPulse=0.7+0.3*Math.abs(Math.sin(game.time*6))
    ctx.fillStyle=C.GOLD; ctx.shadowColor=C.GOLD; ctx.shadowBlur=10; ctx.globalAlpha=pbPulse
    ctx.fillText('NEW BEST!', W/2, 62)
    ctx.shadowBlur=0; ctx.globalAlpha=1
  } else {
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.shadowBlur=0
    ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`, W/2, 62)
  }

  const mx=W-60, my=54, mr=38
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=5
  ctx.beginPath(); ctx.arc(mx,my,mr,-Math.PI*0.8,Math.PI*0.2); ctx.stroke()
  const speedFrac=Math.min(1,(game.speedMult-1)/7)
  const speedCol=speedFrac<0.5?'rgba(0,255,136,0.9)':speedFrac<0.8?'rgba(255,200,0,0.9)':'rgba(255,50,50,0.9)'
  ctx.strokeStyle=speedCol; ctx.shadowColor=speedCol; ctx.shadowBlur=12
  ctx.beginPath(); ctx.arc(mx,my,mr,-Math.PI*0.8,-Math.PI*0.8+speedFrac*Math.PI); ctx.stroke()
  ctx.shadowBlur=0
  ctx.textAlign='center'
  ctx.font=`bold ${Math.min(11,W*0.018)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.fillText(`${game.speedMult.toFixed(1)}x`,mx,my+4)
  ctx.font=`${Math.min(9,W*0.014)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillText('SPEED',mx,my+17)

  ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`${Math.min(13,W*0.02)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.45)'
  ctx.fillText(`${Math.floor(game.distance)}m`,16,14)
  ctx.font=`${Math.min(11,W*0.018)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.25)'
  ctx.fillText(`${game.time.toFixed(1)}s`,16,34)

  if (game.multiplier>1) {
    const pulse=0.9+0.1*Math.sin(game.time*8)
    ctx.textAlign='left'
    ctx.font=`bold ${Math.min(22,W*0.035)*pulse}px Orbitron,monospace`
    ctx.fillStyle=C.YEL; ctx.shadowColor=C.YEL; ctx.shadowBlur=14
    ctx.fillText(`x${game.multiplier}`,16,58)
    ctx.shadowBlur=0
  }

  // Streak meter bar
  if (game.lastNearMiss && game.lastNearMiss.length > 0) {
    const streak = game.lastNearMiss.length
    const barW = 80, barH = 6, barX = 16, barY = 82
    const streakCol = streak >= 7 ? '#FF00FF' : streak >= 5 ? '#FF6600' : streak >= 3 ? '#FFFF00' : '#00FFFF'
    const glowAmt = 4 + streak * 1.5
    const fill = Math.min(streak / 10, 1)
    ctx.save()
    ctx.textAlign = 'left'
    ctx.font = `bold ${Math.min(9, W*0.014)}px Orbitron,monospace`
    ctx.fillStyle = streakCol; ctx.shadowColor = streakCol; ctx.shadowBlur = glowAmt
    ctx.fillText(`STREAK x${streak}`, barX, barY - 3)
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(barX, barY, barW, barH)
    ctx.fillStyle = streakCol
    ctx.shadowColor = streakCol; ctx.shadowBlur = glowAmt * 1.5
    ctx.fillRect(barX, barY, barW * fill, barH)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  if (game.wallRiding) {
    ctx.textAlign='center'
    ctx.font=`bold ${Math.min(16,W*0.025)}px Orbitron,monospace`
    ctx.fillStyle=C.MAG; ctx.shadowColor=C.MAG; ctx.shadowBlur=12
    ctx.fillText('WALL RIDE +5/s',W/2,H-40)
    ctx.shadowBlur=0
  }

  for (let i=game.scorePopups.length-1;i>=0;i--) {
    const p=game.scorePopups[i]
    ctx.globalAlpha=Math.max(0,p.life)
    ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=8
    ctx.textAlign='center'
    ctx.font=`bold ${Math.min(p.size||18,W*0.028)}px Orbitron,monospace`
    ctx.fillText(p.text,p.x,p.y)
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0

  // Pause button
  ctx.globalAlpha=0.4; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5
  ctx.strokeRect(W-52,12,36,28)
  ctx.fillStyle='#fff'
  ctx.fillRect(W-46,17,8,18); ctx.fillRect(W-34,17,8,18)
  ctx.globalAlpha=1

  ctx.textBaseline='alphabetic'
  ctx.restore()
}

// ─── Game State ───────────────────────────────────────────────────────────────
let game = {}
function initGame() {
  game = {
    carZ:CAMERA_DIST, cameraZ:0,
    playerX:0, playerVX:0,
    score:0, coins:0, time:0, distance:0,
    speedMult:1.0, bonusSpeed:0, speedBoostTimer:0,
    slowMoTimer:0,   // near-miss time dilation
    obstacles:[], speedPads:[],
    scorePopups:[],
    dead:false, deathTimer:0, usedRevive:false, newRecord:false,
    nearMissStreak:0, multiplier:1, lastNearMiss:[],
    wallRiding:false,
    shakeX:0, shakeY:0, shakeDuration:0,
    flashColor:null, flashTimer:0,
    milestones:{30:false,60:false,120:false},
    distMilestones:{}, pbBeaten:false,
    countdownVal:3, countdownTimer:0,
  }
  pool.forEach(p=>p.alive=false)
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
// Tracks last open lane so consecutive patterns are always reachable
// ── Pattern library ────────────────────────────────────────────────────────
// Each entry: blocked[] = which lanes are blocked (true/false), openIdx = which lane(s) open
// Guaranteed: at least 1 false (open lane) in every pattern
const PLIB = {
  // 1 block, 2 open — very forgiving, player has lots of space
  single: [
    [true,  false, false],   // left blocked
    [false, true,  false],   // center blocked
    [false, false, true ],   // right blocked
  ],
  // 2 blocks, 1 open — requires precision
  double: [
    [true,  true,  false],   // open RIGHT
    [false, true,  true ],   // open LEFT
    [true,  false, true ],   // open CENTER (hardest — sandwiched)
  ],
  // 0 blocks — breathing room / rhythm break
  clear: [
    [false, false, false],
  ],
}

// Track the "open zone center X" of last spawn to enforce reachability
// ── Sequence state machine ──────────────────────────────────────────────────
// Phases: 'intro' | 'breath' | 'flow' | 'tension' | 'burst'
// Each phase runs for seqRowsLeft rows then transitions to next phase.
// Spacing multiplier controls density within the phase.

let lastOpenX    = LANES[1]
let seqPhase     = 'intro'
let seqRowsLeft  = 3
let seqSpaceMult = 1.8    // spacing as fraction of base reaction time
let seqBaseReact = 2.0    // reaction seconds at current phase start

function pickObstacleType(t, spd) {
  const r = Math.random()
  let type = 'block'
  if      (t > 30 && r < 0.18) type = 'moving'
  else if (t > 50 && r < 0.22) type = 'shrinking'
  else if (t > 65 && r < 0.26) type = 'rotating'
  else if (t > 80 && r < 0.30) type = 'ghost'
  if (spd > 4.5 && (type === 'moving' || type === 'rotating')) type = 'block'
  return type
}

function openXofPattern(pat) {
  const open = [0,1,2].filter(i => !pat[i])
  return open.reduce((s,i) => s + LANES[i], 0) / open.length
}

function isReachable(fromX, toX, secs) {
  return Math.abs(toX - fromX) <= 1.8 * secs + 0.15
}

function nextSequence(t) {
  const r  = Math.random()
  const prev = seqPhase

  // Global reaction window floor
  const react = t < 10 ? 2.2
              : t < 30 ? 1.9
              : t < 70 ? 1.55
              : Math.max(0.88, 1.55 - (t-70)*0.005)
  seqBaseReact = react

  // Transition table: prev phase → next phase weights
  if (prev === 'intro' || prev === 'breath') {
    seqPhase    = r < 0.55 ? 'flow' : (r < 0.85 ? 'tension' : 'burst')
  } else if (prev === 'burst') {
    seqPhase    = r < 0.70 ? 'breath' : 'flow'   // always give relief after burst
  } else if (prev === 'flow') {
    seqPhase    = r < 0.18 ? 'breath' : (r < 0.52 ? 'flow' : (r < 0.82 ? 'tension' : 'burst'))
  } else { // tension
    seqPhase    = r < 0.22 ? 'breath' : (r < 0.48 ? 'flow' : (r < 0.78 ? 'tension' : 'burst'))
  }

  // Burst requires some game time to unlock
  if (seqPhase === 'burst' && t < 20) seqPhase = 'tension'
  if (seqPhase === 'tension' && t < 8) seqPhase = 'flow'

  // Phase parameters: rows + spacing multiplier
  switch(seqPhase) {
    case 'breath':
      seqRowsLeft  = 2 + Math.floor(Math.random()*2)   // 2–3 clear rows
      seqSpaceMult = 2.0 + Math.random()*0.6            // wide gaps
      break
    case 'flow':
      seqRowsLeft  = 4 + Math.floor(Math.random()*4)   // 4–7 rows, moderate
      seqSpaceMult = 0.90 + Math.random()*0.25
      break
    case 'tension':
      seqRowsLeft  = 3 + Math.floor(Math.random()*4)   // 3–6 rows, tighter
      seqSpaceMult = 0.68 + Math.random()*0.20
      break
    case 'burst':
      seqRowsLeft  = 2 + Math.floor(Math.random()*3)   // 2–4 rapid rows
      seqSpaceMult = 0.45 + Math.random()*0.18          // very tight
      break
  }
}

function pickPatternForPhase(react) {
  const r = Math.random()
  let pool
  switch(seqPhase) {
    case 'intro':
    case 'breath':
      pool = PLIB.clear                                              // all clear
      break
    case 'flow':
      pool = r < 0.14 ? PLIB.clear : (r < 0.42 ? PLIB.double : PLIB.single)
      break
    case 'tension':
      pool = r < 0.06 ? PLIB.single : PLIB.double                   // mostly doubles
      break
    case 'burst':
      pool = r < 0.30 ? PLIB.single : PLIB.double                   // doubles + singles alternating
      break
    default: pool = PLIB.single
  }
  // Reachability filter
  const shuffled = pool.slice().sort(() => Math.random()-0.5)
  let chosen = shuffled[0]
  for (const c of shuffled) {
    if (isReachable(lastOpenX, openXofPattern(c), react)) { chosen = c; break }
  }
  return chosen
}

function spawnObstacles() {
  const t   = game.time
  const spd = game.speedMult

  const furthestZ = game.obstacles.length
    ? Math.max(...game.obstacles.map(o => o.wz))
    : game.carZ

  if (furthestZ >= game.cameraZ + NUM_SEGS + 5) return

  // Advance sequence state if needed
  if (seqRowsLeft <= 0) nextSequence(t)

  // Spacing = base reaction × phase multiplier × small random variance × speed
  const spacingSecs = seqBaseReact * seqSpaceMult * (0.85 + Math.random()*0.30)
  const spacing     = spacingSecs * (15 * spd)
  const spawnZ      = Math.max(furthestZ + spacing, game.cameraZ + NUM_SEGS)

  const chosen = pickPatternForPhase(seqBaseReact * seqSpaceMult)
  lastOpenX = openXofPattern(chosen)
  seqRowsLeft--

  if (chosen.every(b => !b)) return   // clear row — no obstacles to push

  const type = pickObstacleType(t, spd)
  for (let lane = 0; lane < 3; lane++) {
    if (!chosen[lane]) continue
    game.obstacles.push({
      wz: spawnZ, wx: LANES[lane],
      halfW: 0.27, origHalfW: 0.27,
      w: 0.54, h: 0.52,
      type, angle:0, shrinkT:0, originWX: LANES[lane],
      opacity: type==='ghost' ? 0.50 : 1.0,
      nearMissed: false,
    })
  }
}

function spawnSpeedPads() {
  const furthestZ=game.speedPads.length ? Math.max(...game.speedPads.map(p=>p.wz)) : game.carZ
  if (furthestZ < game.carZ+NUM_SEGS*0.8 && Math.random()<0.3) {
    game.speedPads.push({wz:furthestZ+90+Math.random()*30, wx:LANES[Math.floor(Math.random()*3)], used:false})
  }
}

// ─── Event Functions ──────────────────────────────────────────────────────────
function addPopup(text,color,x,y) {
  game.scorePopups.push({text,color,x:x||W/2,y:y||(H*0.45),life:1.2})
}

function triggerDeath() {
  if (game.dead) return
  game.dead=true
  game.shakeDuration=0.3   // halved — less disorienting
  game.flashColor='#FF0044'; game.flashTimer=0.25
  const cp=carScreenPos()
  emit(cp.x,cp.y,'#FF4400',25,{speed:80,life:0.8,r:5,gravity:40,type:'spark'})
  emit(cp.x,cp.y,'#FF0044',20,{speed:60,life:0.6,r:6})
  emit(cp.x,cp.y,'#888888',12,{speed:30,life:1.0,r:8,gravity:15})
  sfxCrash()
  stopEngine()
}

function triggerNearMiss() {
  const now=game.time
  game.lastNearMiss=game.lastNearMiss.filter(t=>now-t<10)
  game.lastNearMiss.push(now)
  const streak=game.lastNearMiss.length
  game.multiplier=streak>=10?5:streak>=5?3:streak>=3?2:1
  const bonus=50*game.multiplier
  game.score+=bonus; game.coins+=50

  // Slow-mo hit — 0.18s time dilation at 28% speed
  game.slowMoTimer=0.18
  game.flashColor='#00FFFF'; game.flashTimer=0.06

  const cp=carScreenPos()
  // Sparks burst outward from car
  emit(cp.x,cp.y,'#00FFFF',12,{speed:55,life:0.35,type:'spark',gravity:-20})
  emit(cp.x,cp.y,'#FFFFFF',5, {speed:30,life:0.20,r:3})

  // Gold coin burst particles
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI/2 + (Math.random()-0.5)*Math.PI
    emit(cp.x, cp.y, '#FFD700', 1, {
      vx: Math.cos(angle)*(30+Math.random()*60),
      vy: Math.sin(angle)*(20+Math.random()*40),
      life: 0.5+Math.random()*0.3, r: 3+Math.random()*2,
      gravity: 80, type: 'dot'
    })
  }

  // "CLOSE!" popup right above car (at head level), not just top HUD
  game.scorePopups.push({text:`CLOSE! +${bonus}`, color:C.YEL, x:cp.x, y:cp.y-60, life:0.9, size: 14 + game.multiplier * 4})
  if (game.multiplier>1)
    game.scorePopups.push({text:`x${game.multiplier}`, color:'#FF00FF', x:cp.x+40, y:cp.y-40, life:0.7})

  sfxNearMiss()
}

function triggerMilestone(sec) {
  const bonuses={30:500,60:2000,120:10000}
  game.score+=bonuses[sec]; game.coins+=bonuses[sec]
  addPopup(`${sec}s ALIVE! +${bonuses[sec]}`,C.GREEN)
  sfxMilestone()
}

function triggerRevive() {
  game.dead=false; game.deathTimer=0; game.usedRevive=true
  game.playerX=0
  game.obstacles=game.obstacles.filter(o=>o.wz-game.carZ>10)
  game.flashColor=C.GOLD; game.flashTimer=0.6
  state='playing'
  addPopup('REVIVED!',C.GOLD,W/2,H*0.4)
  startEngine()
}

function finalizeScore() {
  const score=Math.floor(game.score)
  if (score>save.highScore) {
    save.highScore=score; game.newRecord=true
    save.totalCoins+=Math.floor(game.coins)+5000
  } else {
    save.totalCoins+=Math.floor(game.coins)
  }
  save.gamesPlayed++
  writeSave()
}

function startGame() {
  initGame()
  lastOpenX    = LANES[1]
  seqPhase     = 'intro'
  seqRowsLeft  = 3
  seqSpaceMult = 1.8
  seqBaseReact = 2.0
  state = 'countdown'
  game.countdownVal = 3
  game.countdownTimer = 0
  sfxConfirm()
  startEngine()
  startMusic()
}

function renderCountdown() {
  // Draw the game scene behind the countdown
  renderGame()

  clearButtons()
  const val = game.countdownVal
  const pulse = 0.7 + 0.3 * Math.sin(game.countdownTimer * Math.PI * 2)
  const col = val === 3 ? '#00FFFF' : val === 2 ? '#FFFF00' : '#00FF88'

  ctx.save()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = col; ctx.shadowBlur = 60
  ctx.fillStyle = col
  ctx.font = `900 ${Math.min(120, W*0.22)*pulse}px Orbitron, monospace`
  ctx.globalAlpha = 0.9
  ctx.fillText(val > 0 ? val : 'GO!', W/2, H/2)
  ctx.restore()
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  if (game.dead) {
    game.deathTimer+=dt
    updateParticles(dt)
    if (game.deathTimer>1.2) { finalizeScore(); state='gameover' }  // fast to game over
    return
  }

  // Near-miss slow-mo time dilation
  if (game.slowMoTimer>0) { game.slowMoTimer-=dt; dt*=0.28 }

  game.time+=dt
  wheelAngle+=game.speedMult*dt*6

  // Start at "t=12s equivalent" — skip slow ramp, game is engaging immediately
  game.speedMult=Math.min(2.2 + game.time*0.10 + game.bonusSpeed, 8.0)

  const scrollSpeed=15*game.speedMult
  game.carZ   +=scrollSpeed*dt
  game.cameraZ =game.carZ-CAMERA_DIST
  game.distance=game.carZ*8

  game.score +=2*dt*game.multiplier
  game.coins +=2*dt

  updateEngineAudio(game.speedMult)

  const MOVE_SPEED=1.8
  const prevX=game.playerX
  const wasMoving=game.playerVX!==0
  if (keys.left)  game.playerX-=MOVE_SPEED*dt
  if (keys.right) game.playerX+=MOVE_SPEED*dt
  game.playerVX=(game.playerX-prevX)/(dt||0.016)
  // Lane switch SFX — fire once when movement starts (not every frame)
  if (!wasMoving && Math.abs(game.playerVX)>0.1) sfxLaneSwitch()

  if (game.playerX < -ROAD_HW || game.playerX > ROAD_HW) {
    addPopup('FELL OFF!','#FF6600',W/2,H*0.5)
    triggerDeath(); return
  }

  const onWall=Math.abs(game.playerX)>=ROAD_HW-0.18
  game.wallRiding=onWall
  if (onWall) { game.score+=5*dt; game.coins+=5*dt }

  for (let i=game.obstacles.length-1;i>=0;i--) {
    const o=game.obstacles[i]
    if (o.type==='moving')    o.wx=o.originWX+Math.sin(game.time*1.8)*0.40
    if (o.type==='rotating')  o.angle+=2*dt
    if (o.type==='shrinking') { o.shrinkT+=dt; o.halfW=Math.max(0.08,o.origHalfW*(1-o.shrinkT/6)) }
    if (o.wz<game.cameraZ-5) game.obstacles.splice(i,1)
  }

  for (const pad of game.speedPads) {
    if (pad.used) continue
    const dz=Math.abs(pad.wz-game.carZ)
    const dx=Math.abs(game.playerX-pad.wx)
    if (dz<3&&dx<0.32) {
      pad.used=true
      game.bonusSpeed+=0.4
      game.score+=100
      addPopup('SPEED BOOST +0.4x',C.GREEN,W/2,H*0.4)
      game.flashColor=C.GREEN; game.flashTimer=0.3
      sfxSpeedUp()
    }
  }
  game.speedPads=game.speedPads.filter(p=>p.wz>game.cameraZ-5)

  for (const o of game.obstacles) {
    const dz=Math.abs(o.wz-game.carZ)
    if (dz>3) continue
    const dx=Math.abs(game.playerX-o.wx)
    if (dx<o.halfW+0.15) { triggerDeath(); return }
    if (!o.nearMissed&&dx<o.halfW+0.28&&dx>o.halfW+0.15) {
      o.nearMissed=true; triggerNearMiss()
    }
  }

  spawnObstacles()
  spawnSpeedPads()

  updateParticles(dt)

  if (game.shakeDuration>0) {
    game.shakeDuration-=dt
    game.shakeX=(Math.random()-0.5)*10*game.shakeDuration
    game.shakeY=(Math.random()-0.5)*10*game.shakeDuration
  } else { game.shakeX=0; game.shakeY=0 }
  if (game.flashTimer>0) game.flashTimer-=dt

  if (!game.milestones[30]&&game.time>=30)  { game.milestones[30]=true;  triggerMilestone(30)  }
  if (!game.milestones[60]&&game.time>=60)  { game.milestones[60]=true;  triggerMilestone(60)  }
  if (!game.milestones[120]&&game.time>=120){ game.milestones[120]=true; triggerMilestone(120) }

  // Distance milestones
  const distMilestones = [250, 500, 1000, 2000, 5000]
  for (const dm of distMilestones) {
    const key = `dist_${dm}`
    if (!game.distMilestones[key] && game.distance >= dm) {
      game.distMilestones[key] = true
      const bonus = dm * 2
      game.score += bonus; game.coins += bonus
      addPopup(`${dm >= 1000 ? dm/1000 + 'KM' : dm + 'M'}! +${bonus}`, '#00FFFF', W/2, H*0.35)
      game.flashColor = '#00FFFF'; game.flashTimer = 0.2
      sfxMilestone()
    }
  }

  // Detect first moment of beating PB this run
  if (!game.pbBeaten && save.highScore > 0 && Math.floor(game.score) > save.highScore) {
    game.pbBeaten = true
    game.flashColor = '#FFD700'; game.flashTimer = 0.4
    game.slowMoTimer = 0.25
    addPopup('NEW BEST!', '#FFD700', W/2, H*0.40)
    sfxMilestone()
    for (let i = 0; i < 20; i++) {
      emit(W/2, H*0.5, '#FFD700', 1, {speed: 60+Math.random()*80, life: 0.6+Math.random()*0.4, r: 3+Math.random()*4, gravity: 30})
    }
  }

  game.scorePopups.forEach(p=>{p.y-=50*dt; p.life-=dt})
  game.scorePopups=game.scorePopups.filter(p=>p.life>0)
}

// ─── Render Game ──────────────────────────────────────────────────────────────
function renderGame() {
  ctx.save()
  ctx.translate(game.shakeX||0, game.shakeY||0)

  drawSky()
  drawBuildings()
  drawRoad()
  drawSpeedPads()

  const sorted=[...game.obstacles].sort((a,b)=>b.wz-a.wz)
  sorted.forEach(drawObstacle)

  drawParticles()

  if (!game.dead||Math.floor(game.deathTimer*8)%2===0) drawCar()

  drawSpeedLines()
  drawChromaticAberration()
  applyFlash()
  applyGrayscale()
  drawVignette()

  // "In the zone" - subtle neon border when combo active
  if (game.multiplier >= 2 && !game.dead) {
    const zoneColors = {2:'#00FFFF', 3:'#FFFF00', 5:'#FF00FF'}
    const zoneCol = zoneColors[game.multiplier] || '#FF00FF'
    const zonePulse = 0.4 + 0.3 * Math.abs(Math.sin(game.time * 4))
    ctx.save()
    ctx.globalAlpha = zonePulse * 0.35
    ctx.shadowColor = zoneCol; ctx.shadowBlur = 20
    ctx.strokeStyle = zoneCol; ctx.lineWidth = 3
    ctx.strokeRect(2, 2, W-4, H-4)
    ctx.restore()
  }

  ctx.restore()
  drawHUD()
}

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {left:false, right:false}

document.addEventListener('keydown',e=>{
  if (e.key==='ArrowLeft'||e.key==='a'||e.key==='A')  keys.left=true
  if (e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right=true
  if (state === 'countdown') { state = 'playing'; return }
  // Game over: any non-modifier key = instant retry
  if (state==='gameover' && !['Tab','Alt','Meta','Control','Shift'].includes(e.key)) {
    startGame(); return
  }
  if (e.key==='Escape') {
    if      (state==='playing') state='paused'
    else if (state==='paused')  state='playing'
    else if (state!=='menu'&&state!=='gameover') state='menu'
  }
})
document.addEventListener('keyup',e=>{
  if (e.key==='ArrowLeft'||e.key==='a'||e.key==='A')  keys.left=false
  if (e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right=false
})

let touchStartX=0
canvas.addEventListener('touchstart',e=>{
  touchStartX=e.touches[0].clientX
  e.preventDefault()
  if (state === 'countdown') { state = 'playing'; return }
  if (state==='gameover') { startGame(); return }  // tap anywhere = instant retry
  if (state!=='playing') handleClick(e.touches[0].clientX,e.touches[0].clientY)
},{passive:false})
canvas.addEventListener('touchmove',e=>{
  if (state==='playing') {
    const dx=e.touches[0].clientX-touchStartX
    keys.left=dx<-35; keys.right=dx>35
  }
  e.preventDefault()
},{passive:false})
canvas.addEventListener('touchend',e=>{
  keys.left=false; keys.right=false
  e.preventDefault()
},{passive:false})
canvas.addEventListener('click',e=>handleClick(e.clientX,e.clientY))
canvas.addEventListener('mousemove',e=>handleMouseMove(e.clientX,e.clientY))

let menuItems=[], menuHovered=-1
function registerButton(x,y,w,h,action) { menuItems.push({x,y,w,h,action}) }
function clearButtons() { menuItems=[]; menuHovered=-1 }

function handleClick(cx,cy) {
  try { if (audioCtx && audioCtx.state==='suspended') audioCtx.resume() } catch(e){}
  const r=canvas.getBoundingClientRect()
  const x=(cx-r.left)*(W/r.width), y=(cy-r.top)*(H/r.height)
  for (const item of menuItems) {
    if (x>=item.x&&x<=item.x+item.w&&y>=item.y&&y<=item.y+item.h) {
      item.action(); return
    }
  }
  if (state==='playing') {
    const px2=(cx-r.left)*(W/r.width), py2=(cy-r.top)*(H/r.height)
    if (px2>=W-56&&px2<=W-14&&py2>=10&&py2<=42) { state='paused'; return }
  }
}
function handleMouseMove(cx,cy) {
  const r=canvas.getBoundingClientRect()
  const x=(cx-r.left)*(W/r.width), y=(cy-r.top)*(H/r.height)
  menuHovered=-1
  menuItems.forEach((item,i)=>{
    if (x>=item.x&&x<=item.x+item.w&&y>=item.y&&y<=item.y+item.h) menuHovered=i
  })
}

function drawButton(x,y,w,h,text,highlighted,color) {
  color=color||'#CC00FF'
  ctx.save()
  if (highlighted) {
    ctx.shadowColor=color; ctx.shadowBlur=25
    ctx.strokeStyle=color; ctx.fillStyle=color+'22'
  } else {
    ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.shadowBlur=0
  }
  ctx.lineWidth=highlighted?2:1.5
  ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h)
  ctx.fillStyle=highlighted?color:'#fff'
  ctx.font=`bold ${Math.min(17,h*0.42)}px Orbitron,monospace`
  ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText(text,x+w/2,y+h/2)
  ctx.textBaseline='alphabetic'
  ctx.restore()
}

// ─── State ────────────────────────────────────────────────────────────────────
let state    = 'menu'
let shopTab  = 'cars'
let nameInput = ''
let prevState = 'menu'

// ─── Menu Grid Animation ──────────────────────────────────────────────────────
let menuTime = 0

function drawMenuGrid() {
  const hy=getHorizonY()
  const sg=ctx.createLinearGradient(0,0,0,hy)
  sg.addColorStop(0,'#020008'); sg.addColorStop(0.6,'#0D0028'); sg.addColorStop(1,'#1A0040')
  ctx.fillStyle=sg; ctx.fillRect(0,0,W,hy)
  ctx.fillStyle='#050010'; ctx.fillRect(0,hy,W,H-hy)

  const nearS=segScreen(NUM_SEGS-1), farS=segScreen(0)
  ctx.beginPath()
  ctx.moveTo(W/2-farS.halfW,farS.y); ctx.lineTo(W/2+farS.halfW,farS.y)
  ctx.lineTo(W/2+nearS.halfW,nearS.y); ctx.lineTo(W/2-nearS.halfW,nearS.y)
  ctx.closePath()
  const rg=ctx.createLinearGradient(0,hy,0,H)
  rg.addColorStop(0,'#08001A'); rg.addColorStop(1,'#0F0028')
  ctx.fillStyle=rg; ctx.fill()

  const off=(menuTime*30)%GRID_STEP
  for (let n=0;n<20;n++) {
    const rel=off+n*GRID_STEP
    if (rel<=0||rel>=NUM_SEGS) continue
    const lo=Math.floor(rel),hi=Math.min(lo+1,NUM_SEGS-1)
    const fr=rel-lo
    const sL=segScreen(NUM_SEGS-1-lo),sH=segScreen(NUM_SEGS-1-hi)
    const sy=sL.y*(1-fr)+sH.y*fr
    const hw=sL.halfW*(1-fr)+sH.halfW*fr
    const a=(1-rel/NUM_SEGS)*0.5
    ctx.strokeStyle=`rgba(153,0,255,${a})`
    ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(W/2-hw,sy); ctx.lineTo(W/2+hw,sy); ctx.stroke()
  }

  ctx.shadowColor='#FF00FF'; ctx.shadowBlur=12
  ctx.strokeStyle='#FF00FF'; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(W/2-nearS.halfW,nearS.y); ctx.lineTo(W/2-farS.halfW*0.05,farS.y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W/2+nearS.halfW,nearS.y); ctx.lineTo(W/2+farS.halfW*0.05,farS.y); ctx.stroke()
  ctx.shadowBlur=0

  for (let i=0;i<60;i++) {
    const sx=((i*1483+37)%W)
    const sy2=((i*937+11)%hy)
    const sa=0.3+Math.sin(menuTime*1.2+i*0.8)*0.2
    ctx.fillStyle=`rgba(220,180,255,${sa})`
    ctx.beginPath(); ctx.arc(sx,sy2,i%7===0?1.4:0.7,0,Math.PI*2); ctx.fill()
  }
}

// ─── renderMenu ───────────────────────────────────────────────────────────────
function renderMenu() {
  clearButtons()
  ctx.fillStyle=C.BG; ctx.fillRect(0,0,W,H)
  drawMenuGrid()
  drawVignette()

  ctx.save()
  ctx.textAlign='center'
  ctx.font=`900 ${Math.min(72,W*0.12)}px Orbitron,monospace`
  ctx.shadowColor='#FF00FF'; ctx.shadowBlur=40
  ctx.fillStyle='#FF00FF'
  ctx.fillText('NEON',W/2-W*0.18,H*0.20)
  ctx.shadowColor='#00FFFF'; ctx.shadowBlur=40
  ctx.fillStyle='#00FFFF'
  ctx.fillText('DRIFT',W/2+W*0.19,H*0.20)
  ctx.shadowBlur=0
  ctx.font=`${Math.min(13,W*0.02)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.4)'
  ctx.fillText('SYNTHWAVE ENDLESS RUNNER',W/2,H*0.20+44)
  ctx.restore()

  if (save.highScore>0) {
    ctx.save()
    ctx.textAlign='center'; ctx.textBaseline='top'
    ctx.font=`bold ${Math.min(16,W*0.025)}px Orbitron,monospace`
    ctx.fillStyle=C.GOLD; ctx.shadowColor=C.GOLD; ctx.shadowBlur=10
    ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`,W/2,H*0.30)
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.shadowBlur=0
    ctx.font=`${Math.min(12,W*0.018)}px Orbitron,monospace`
    ctx.fillText(`${save.totalCoins.toLocaleString()} COINS  •  ${save.gamesPlayed} GAMES`,W/2,H*0.30+26)
    ctx.restore()
  }

  const bw=Math.min(260,W*0.42), bh=46, bx=W/2-bw/2
  const buttons=[
    {label:'PLAY',        col:'#00FFFF', act:()=>{ if(!save.playerName){state='nameentry'}else{startGame()} }},
    {label:'HOW TO PLAY', col:'#CC00FF', act:()=>{ state='howtoplay' }},
    {label:'SHOP',        col:'#FF00FF', act:()=>{ state='shop' }},
    {label:'LEADERBOARD', col:'#FFD700', act:()=>{ state='leaderboard' }},
    {label:'SETTINGS',    col:'rgba(255,255,255,0.6)', act:()=>{ prevState='menu'; state='settings' }},
  ]
  const startY=H*0.42
  buttons.forEach((b,i)=>{
    const by=startY+i*(bh+10)
    drawButton(bx,by,bw,bh,b.label,menuHovered===i,b.col)
    registerButton(bx,by,bw,bh,b.act)
  })

  if (save.playerName) {
    ctx.save()
    ctx.textAlign='center'
    ctx.font=`${Math.min(12,W*0.018)}px Orbitron,monospace`
    ctx.fillStyle='rgba(255,255,255,0.35)'
    ctx.fillText(`PILOT: ${save.playerName}`,W/2,H-18)
    ctx.restore()
  }
}

// ─── renderNameEntry ──────────────────────────────────────────────────────────
let nameEntryActive = false
function renderNameEntry() {
  clearButtons()
  if (!nameEntryActive) {
    nameEntryActive = true
    document.addEventListener('keydown', nameEntryKey)
  }

  ctx.fillStyle=C.BG; ctx.fillRect(0,0,W,H)
  drawMenuGrid()
  drawVignette()

  ctx.save()
  ctx.textAlign='center'
  ctx.font=`900 ${Math.min(42,W*0.07)}px Orbitron,monospace`
  ctx.fillStyle='#00FFFF'; ctx.shadowColor='#00FFFF'; ctx.shadowBlur=20
  ctx.fillText('ENTER YOUR NAME',W/2,H*0.28)
  ctx.shadowBlur=0

  const bx2=W/2-180, by2=H*0.40, bw2=360, bh2=58
  ctx.strokeStyle='#CC00FF'; ctx.lineWidth=2
  ctx.shadowColor='#CC00FF'; ctx.shadowBlur=15
  ctx.fillStyle='rgba(0,0,0,0.5)'
  ctx.fillRect(bx2,by2,bw2,bh2); ctx.strokeRect(bx2,by2,bw2,bh2)
  ctx.shadowBlur=0
  ctx.font=`bold ${Math.min(28,W*0.045)}px Orbitron,monospace`
  ctx.fillStyle='#fff'
  const display=nameInput+(Math.floor(Date.now()/500)%2===0?'|':'')
  ctx.fillText(display||'|',W/2,by2+bh2*0.65)
  ctx.font=`${Math.min(13,W*0.02)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.4)'
  ctx.fillText('TYPE YOUR NAME — UP TO 12 CHARACTERS',W/2,H*0.58)
  ctx.restore()

  const pbw=Math.min(220,W*0.36), pbh=46, pbx=W/2-pbw/2, pby=H*0.66
  drawButton(pbx,pby,pbw,pbh,'PLAY',menuHovered===0,'#00FFFF')
  registerButton(pbx,pby,pbw,pbh,()=>{
    save.playerName=(nameInput||'PILOT').toUpperCase().slice(0,12)
    writeSave(); nameEntryActive=false; startGame()
  })

  const bbw=180, bbh=40, bbx=W/2-bbw/2, bby=H*0.76
  drawButton(bbx,bby,bbw,bbh,'BACK',menuHovered===1,'rgba(255,255,255,0.5)')
  registerButton(bbx,bby,bbw,bbh,()=>{ nameEntryActive=false; document.removeEventListener('keydown',nameEntryKey); state='menu' })
}

function nameEntryKey(e) {
  if (state!=='nameentry') { document.removeEventListener('keydown',nameEntryKey); nameEntryActive=false; return }
  if (e.key==='Backspace') { nameInput=nameInput.slice(0,-1); sfxMenuTick() }
  else if (e.key==='Enter') {
    save.playerName=(nameInput||'PILOT').toUpperCase().slice(0,12)
    writeSave(); nameEntryActive=false; document.removeEventListener('keydown',nameEntryKey); startGame()
  } else if (e.key.length===1 && nameInput.length<12 && e.key.match(/[a-zA-Z0-9 _-]/)) {
    nameInput+=e.key.toUpperCase(); sfxMenuTick()
  }
}

// ─── renderPause ──────────────────────────────────────────────────────────────
function renderPause() {
  ctx.save()
  ctx.fillStyle='rgba(0,0,10,0.7)'; ctx.fillRect(0,0,W,H)
  ctx.textAlign='center'; ctx.textBaseline='top'
  ctx.font=`900 ${Math.min(52,W*0.085)}px Orbitron,monospace`
  ctx.fillStyle='#CC00FF'; ctx.shadowColor='#CC00FF'; ctx.shadowBlur=30
  ctx.fillText('PAUSED',W/2,H*0.18)
  ctx.shadowBlur=0
  ctx.restore()

  clearButtons()
  const bw=Math.min(240,W*0.38), bh=46, bx=W/2-bw/2
  const items=[
    {l:'RESUME',  c:'#00FFFF', a:()=>{state='playing'}},
    {l:'RESTART', c:'#FF00FF', a:()=>{stopEngine();startGame()}},
    {l:'SETTINGS',c:'#CC00FF', a:()=>{prevState='paused';state='settings'}},
    {l:'MENU',    c:'rgba(255,255,255,0.5)', a:()=>{stopEngine();state='menu'}},
  ]
  const startY=H*0.36
  items.forEach((b,i)=>{
    const by=startY+i*(bh+10)
    drawButton(bx,by,bw,bh,b.l,menuHovered===i,b.c)
    registerButton(bx,by,bw,bh,b.a)
  })
}

// ─── renderGameOver ───────────────────────────────────────────────────────────
function renderGameOver() {
  clearButtons()
  ctx.fillStyle='rgba(0,0,8,0.92)'; ctx.fillRect(0,0,W,H)
  drawVignette()

  ctx.save()
  ctx.textAlign='center'
  const pulse=0.9+0.1*Math.sin(menuTime*6)
  ctx.font=`900 ${Math.min(58,W*0.095)*pulse}px Orbitron,monospace`
  ctx.fillStyle=C.RED; ctx.shadowColor=C.RED; ctx.shadowBlur=30
  ctx.fillText('GAME OVER',W/2,H*0.16)
  ctx.shadowBlur=0

  const px2=W/2-160, py2=H*0.30, pw=320, ph=170
  ctx.fillStyle='rgba(0,0,20,0.8)'; ctx.strokeStyle='rgba(200,0,255,0.4)'; ctx.lineWidth=1
  ctx.fillRect(px2,py2,pw,ph); ctx.strokeRect(px2,py2,pw,ph)

  const rows=[
    {l:'SCORE',    v:Math.floor(game.score).toLocaleString(), c:'#CC00FF'},
    {l:'DISTANCE', v:`${Math.floor(game.distance)}m`,         c:'#00FFFF'},
    {l:'TIME',     v:`${game.time.toFixed(1)}s`,              c:'#00FFFF'},
    {l:'COINS',    v:`+${Math.floor(game.coins).toLocaleString()}`, c:C.GOLD},
  ]
  ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`${Math.min(13,W*0.02)}px Orbitron,monospace`
  rows.forEach((r,i)=>{
    const ry=py2+18+i*36
    ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fillText(r.l,px2+18,ry)
    ctx.fillStyle=r.c; ctx.textAlign='right'; ctx.fillText(r.v,px2+pw-18,ry)
    ctx.textAlign='left'
  })

  // Score delta vs personal best
  const score=Math.floor(game.score)
  const diff=score - save.highScore
  ctx.textAlign='center'; ctx.font=`${Math.min(13,W*0.02)}px Orbitron,monospace`
  if (game.newRecord) {
    const recPulse=0.88+0.12*Math.sin(menuTime*10)
    ctx.font=`bold ${Math.min(20,W*0.032)*recPulse}px Orbitron,monospace`
    ctx.fillStyle=C.GOLD; ctx.shadowColor=C.GOLD; ctx.shadowBlur=22
    ctx.fillText('NEW PERSONAL BEST!',W/2,py2+ph+16)
    ctx.shadowBlur=0
  } else if (diff > -30) {
    ctx.fillStyle='rgba(255,200,0,0.8)'
    ctx.fillText(`SO CLOSE! ${diff} from PB`,W/2,py2+ph+16)
  } else {
    ctx.fillStyle='rgba(255,255,255,0.35)'
    ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`,W/2,py2+ph+16)
  }
  ctx.shadowBlur=0
  ctx.fillStyle='rgba(255,255,255,0.22)'
  ctx.font=`${Math.min(11,W*0.017)}px Orbitron,monospace`
  ctx.fillText(`TOTAL COINS: ${save.totalCoins.toLocaleString()}`,W/2,py2+ph+36+(game.newRecord||diff>-30?0:0))
  ctx.restore()

  // Tap anywhere hint — most prominent action
  const pulse2=0.6+0.4*Math.abs(Math.sin(menuTime*3))
  ctx.save(); ctx.textAlign='center'; ctx.globalAlpha=pulse2
  ctx.font=`bold ${Math.min(19,W*0.030)}px Orbitron,monospace`
  ctx.fillStyle='#00FFFF'; ctx.shadowColor='#00FFFF'; ctx.shadowBlur=14
  ctx.fillText('TAP ANYWHERE TO RETRY',W/2,H*0.68)
  ctx.shadowBlur=0; ctx.restore()

  const bw=Math.min(200,W*0.32), bh=40, bx=W/2-bw/2
  let btnY=H*0.76
  let btnIdx=0

  if (!game.usedRevive) {
    drawButton(bx,btnY,bw,bh,'REVIVE (AD)',menuHovered===btnIdx,C.GOLD)
    registerButton(bx,btnY,bw,bh,()=>{ triggerRevive(); sfxConfirm() })
    btnY+=bh+8; btnIdx++
  }

  drawButton(bx,btnY,bw,bh,'MENU',menuHovered===btnIdx,'rgba(255,255,255,0.4)')
  registerButton(bx,btnY,bw,bh,()=>{ state='menu' })
}

// ─── renderShop ───────────────────────────────────────────────────────────────
function renderShop() {
  clearButtons()
  ctx.fillStyle='rgba(0,0,12,0.97)'; ctx.fillRect(0,0,W,H)
  drawVignette()

  ctx.save()
  ctx.textAlign='center'
  ctx.font=`900 ${Math.min(40,W*0.065)}px Orbitron,monospace`
  ctx.fillStyle='#FF00FF'; ctx.shadowColor='#FF00FF'; ctx.shadowBlur=20
  ctx.fillText('SHOP',W/2,36)
  ctx.shadowBlur=0
  ctx.font=`bold ${Math.min(14,W*0.022)}px Orbitron,monospace`
  ctx.fillStyle=C.GOLD; ctx.shadowColor=C.GOLD; ctx.shadowBlur=8
  ctx.fillText(`${save.totalCoins.toLocaleString()} COINS`,W/2,62)
  ctx.shadowBlur=0
  ctx.restore()

  const tabs=['cars','colors','trails']
  const tw=Math.min(100,W*0.16), th=34, tx0=W/2-tw*1.5
  tabs.forEach((tab,i)=>{
    const tx=tx0+i*(tw+4)
    const active=shopTab===tab
    ctx.save()
    ctx.fillStyle=active?'rgba(200,0,255,0.3)':'rgba(255,255,255,0.05)'
    ctx.strokeStyle=active?'#CC00FF':'rgba(255,255,255,0.2)'; ctx.lineWidth=active?2:1
    ctx.fillRect(tx,78,tw,th); ctx.strokeRect(tx,78,tw,th)
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.font=`bold ${Math.min(11,W*0.017)}px Orbitron,monospace`
    ctx.fillStyle=active?'#CC00FF':'rgba(255,255,255,0.6)'
    ctx.fillText(tab.toUpperCase(),tx+tw/2,78+th/2)
    ctx.restore()
    registerButton(tx,78,tw,th,()=>{ shopTab=tab; sfxMenuTick() })
  })

  const items    = shopTab==='cars'?CARS:shopTab==='colors'?SKINS:TRAILS
  const unlocked = shopTab==='cars'?save.unlockedCars:shopTab==='colors'?save.unlockedSkins:save.unlockedTrails
  const activeId = shopTab==='cars'?save.activeCar:shopTab==='colors'?save.activeSkin:save.activeTrail

  const iw=Math.min(W-60,580), ih=56, ix=W/2-iw/2, iy0=124

  items.forEach((item,i)=>{
    const iy=iy0+i*(ih+8)
    if (iy+ih>H-70) return
    const owned=unlocked.includes(item.id)
    const isActive=activeId===item.id
    const canBuy=!owned&&save.totalCoins>=item.cost

    ctx.save()
    ctx.fillStyle=isActive?'rgba(0,200,255,0.08)':'rgba(255,255,255,0.03)'
    ctx.strokeStyle=isActive?'#00FFFF':'rgba(255,255,255,0.12)'; ctx.lineWidth=isActive?2:1
    ctx.fillRect(ix,iy,iw,ih); ctx.strokeRect(ix,iy,iw,ih)

    if (shopTab!=='cars'&&item.color) {
      ctx.fillStyle=item.color==='rainbow'?`hsl(${(menuTime*80+i*60)%360},100%,60%)`:item.color
      ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=8
      ctx.beginPath(); ctx.arc(ix+32,iy+ih/2,12,0,Math.PI*2); ctx.fill()
      ctx.shadowBlur=0
    }

    const textX=shopTab!=='cars'&&item.color ? ix+58 : ix+18
    ctx.textBaseline='middle'; ctx.textAlign='left'
    ctx.font=`bold ${Math.min(14,W*0.022)}px Orbitron,monospace`
    ctx.fillStyle=isActive?'#00FFFF':'#fff'
    ctx.fillText(item.name,textX,iy+ih*0.38)
    if (item.desc) {
      ctx.font=`${Math.min(11,W*0.017)}px Orbitron,monospace`
      ctx.fillStyle='rgba(255,255,255,0.4)'
      ctx.fillText(item.desc,textX,iy+ih*0.68)
    }

    const bbw=90, bbh=32, bbx=ix+iw-bbw-12, bby=iy+ih/2-bbh/2
    if (isActive) {
      ctx.fillStyle='rgba(0,255,200,0.15)'; ctx.strokeStyle='#00FFCC'; ctx.lineWidth=1
      ctx.fillRect(bbx,bby,bbw,bbh); ctx.strokeRect(bbx,bby,bbw,bbh)
      ctx.font=`bold ${Math.min(11,W*0.017)}px Orbitron,monospace`
      ctx.fillStyle='#00FFCC'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText('EQUIPPED',bbx+bbw/2,bby+bbh/2)
    } else if (owned) {
      const hov=menuHovered===menuItems.length
      ctx.fillStyle=hov?'rgba(0,200,255,0.2)':'rgba(255,255,255,0.05)'
      ctx.strokeStyle=hov?'#00FFFF':'rgba(255,255,255,0.25)'; ctx.lineWidth=1
      ctx.fillRect(bbx,bby,bbw,bbh); ctx.strokeRect(bbx,bby,bbw,bbh)
      ctx.font=`bold ${Math.min(11,W*0.017)}px Orbitron,monospace`
      ctx.fillStyle=hov?'#00FFFF':'#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText('EQUIP',bbx+bbw/2,bby+bbh/2)
      const itemId=item.id
      registerButton(bbx,bby,bbw,bbh,()=>{
        if (shopTab==='cars')        save.activeCar=itemId
        else if (shopTab==='colors') save.activeSkin=itemId
        else                         save.activeTrail=itemId
        writeSave(); sfxConfirm()
      })
    } else {
      const hov=menuHovered===menuItems.length
      ctx.fillStyle=canBuy?(hov?'rgba(255,200,0,0.2)':'rgba(255,200,0,0.05)'):'rgba(100,100,100,0.05)'
      ctx.strokeStyle=canBuy?(hov?C.GOLD:'rgba(255,200,0,0.4)'):'rgba(100,100,100,0.3)'; ctx.lineWidth=1
      ctx.fillRect(bbx,bby,bbw,bbh); ctx.strokeRect(bbx,bby,bbw,bbh)
      ctx.font=`bold ${Math.min(10,W*0.016)}px Orbitron,monospace`
      ctx.fillStyle=canBuy?(hov?C.GOLD:'rgba(255,200,0,0.8)'):'rgba(150,150,150,0.6)'
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`${item.cost.toLocaleString()}¢`,bbx+bbw/2,bby+bbh/2)
      if (canBuy) {
        const itemId=item.id, itemCost=item.cost
        registerButton(bbx,bby,bbw,bbh,()=>{
          save.totalCoins-=itemCost
          if (shopTab==='cars')        { save.unlockedCars.push(itemId);   save.activeCar=itemId   }
          else if (shopTab==='colors') { save.unlockedSkins.push(itemId);  save.activeSkin=itemId  }
          else                         { save.unlockedTrails.push(itemId); save.activeTrail=itemId }
          writeSave(); sfxConfirm()
        })
      }
    }
    ctx.restore()
  })

  const bbw2=140, bbh2=40, bbx2=W/2-bbw2/2, bby2=H-58
  drawButton(bbx2,bby2,bbw2,bbh2,'BACK',menuHovered===menuItems.length,'rgba(255,255,255,0.5)')
  registerButton(bbx2,bby2,bbw2,bbh2,()=>{ state='menu'; sfxMenuTick() })
}

// ─── renderLeaderboard ────────────────────────────────────────────────────────
const FAKE_SCORES=[
  {name:'SYNTH_X',    score:284700},
  {name:'NEON_ACE',   score:196300},
  {name:'CYBR_RUN',   score:152400},
  {name:'VOLT_DASH',  score:108900},
  {name:'GLITCH_99',  score: 87200},
  {name:'PULSE_WAVE', score: 64100},
  {name:'GRID_JCKY',  score: 41800},
  {name:'DARKWAVE',   score: 29500},
  {name:'RETRO_FX',   score: 17300},
  {name:'NEON_LVL1',  score:  8400},
]

function renderLeaderboard() {
  clearButtons()
  ctx.fillStyle='rgba(0,0,12,0.97)'; ctx.fillRect(0,0,W,H)
  drawVignette()

  ctx.save()
  ctx.textAlign='center'
  ctx.font=`900 ${Math.min(36,W*0.058)}px Orbitron,monospace`
  ctx.fillStyle=C.GOLD; ctx.shadowColor=C.GOLD; ctx.shadowBlur=20
  ctx.fillText('LEADERBOARD',W/2,36)
  ctx.shadowBlur=0
  ctx.restore()

  const playerEntry={name:save.playerName||'YOU', score:save.highScore, isPlayer:true}
  let combined=[...FAKE_SCORES,playerEntry].sort((a,b)=>b.score-a.score).slice(0,10)

  const iw=Math.min(W-60,500), ih=44, ix=W/2-iw/2, iy0=68
  const rankColors=['#FFD700','#C0C0C0','#CD7F32']

  combined.forEach((entry,i)=>{
    const iy=iy0+i*(ih+4)
    const isP=entry.isPlayer
    ctx.save()
    ctx.fillStyle=isP?'rgba(0,200,255,0.10)':'rgba(255,255,255,0.03)'
    ctx.strokeStyle=isP?'#00FFFF':'rgba(255,255,255,0.08)'; ctx.lineWidth=isP?1.5:1
    ctx.fillRect(ix,iy,iw,ih); ctx.strokeRect(ix,iy,iw,ih)
    ctx.textBaseline='middle'
    ctx.font=`bold ${Math.min(16,W*0.025)}px Orbitron,monospace`
    ctx.fillStyle=i<3?rankColors[i]:'rgba(255,255,255,0.4)'; ctx.textAlign='center'
    ctx.fillText(`#${i+1}`,ix+28,iy+ih/2)
    ctx.font=`bold ${Math.min(13,W*0.02)}px Orbitron,monospace`
    ctx.fillStyle=isP?'#00FFFF':'#fff'; ctx.textAlign='left'
    ctx.fillText(entry.name,ix+56,iy+ih/2)
    ctx.textAlign='right'
    ctx.fillStyle=isP?'#00FFFF':i<3?rankColors[i]:'rgba(255,255,255,0.7)'
    ctx.fillText(entry.score.toLocaleString(),ix+iw-16,iy+ih/2)
    ctx.restore()
  })

  const bbw=140,bbh=40,bbx=W/2-bbw/2,bby=H-58
  drawButton(bbx,bby,bbw,bbh,'BACK',menuHovered===0,'rgba(255,255,255,0.5)')
  registerButton(bbx,bby,bbw,bbh,()=>{ state='menu'; sfxMenuTick() })
}

// ─── renderSettings ───────────────────────────────────────────────────────────
function renderSettings() {
  clearButtons()
  ctx.fillStyle='rgba(0,0,12,0.97)'; ctx.fillRect(0,0,W,H)
  drawVignette()

  ctx.save()
  ctx.textAlign='center'
  ctx.font=`900 ${Math.min(40,W*0.065)}px Orbitron,monospace`
  ctx.fillStyle='#CC00FF'; ctx.shadowColor='#CC00FF'; ctx.shadowBlur=20
  ctx.fillText('SETTINGS',W/2,38)
  ctx.shadowBlur=0
  ctx.restore()

  const sw=Math.min(300,W*0.5), sx=W/2-sw/2
  let cy=H*0.24

  drawSliderRow('MUSIC VOL', save.settings.musicVol, sx, cy, sw, v=>{ save.settings.musicVol=v; writeSave() })
  cy+=84

  drawSliderRow('SFX VOL', save.settings.sfxVol, sx, cy, sw, v=>{ save.settings.sfxVol=v; writeSave() })
  cy+=84

  // Particles
  const togX=W/2-60, togY=cy+4, togW=120, togH=38
  ctx.save()
  ctx.textAlign='center'; ctx.textBaseline='top'
  ctx.font=`${Math.min(12,W*0.018)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.5)'
  ctx.fillText('PARTICLES',W/2,cy-20)
  const on=save.settings.particles
  ctx.fillStyle=on?'rgba(0,255,136,0.2)':'rgba(255,255,255,0.05)'
  ctx.strokeStyle=on?C.GREEN:'rgba(255,255,255,0.2)'; ctx.lineWidth=1.5
  ctx.fillRect(togX,togY,togW,togH); ctx.strokeRect(togX,togY,togW,togH)
  ctx.textBaseline='middle'; ctx.fillStyle=on?C.GREEN:'rgba(255,255,255,0.5)'
  ctx.font=`bold ${Math.min(13,W*0.02)}px Orbitron,monospace`
  ctx.fillText(on?'ON':'OFF',W/2,togY+togH/2)
  ctx.restore()
  registerButton(togX,togY,togW,togH,()=>{ save.settings.particles=!save.settings.particles; writeSave(); sfxMenuTick() })
  cy+=84

  // Reset
  const rdw=180, rdh=38, rdx=W/2-rdw/2
  const isHovReset=menuHovered===menuItems.length
  drawButton(rdx,cy,rdw,rdh,'RESET DATA',isHovReset,'#FF0044')
  registerButton(rdx,cy,rdw,rdh,()=>{
    if (confirm('Reset ALL save data?')) {
      localStorage.removeItem(SAVE_KEY); loadSave(); sfxCrash(); state='menu'
    }
  })

  const bbw=140,bbh=40,bbx=W/2-bbw/2,bby=H-58
  const isHovBack=menuHovered===menuItems.length
  drawButton(bbx,bby,bbw,bbh,'BACK',isHovBack,'rgba(255,255,255,0.5)')
  registerButton(bbx,bby,bbw,bbh,()=>{ state=prevState||'menu'; sfxMenuTick() })
}

function drawSliderRow(label, val, sx, sy, sw, onChange) {
  ctx.save()
  ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`${Math.min(12,W*0.018)}px Orbitron,monospace`
  ctx.fillStyle='rgba(255,255,255,0.5)'
  ctx.fillText(label,sx,sy-20)
  ctx.textAlign='right'
  ctx.fillStyle='rgba(255,255,255,0.7)'
  ctx.fillText(Math.round(val*100)+'%',sx+sw,sy-20)

  const th=10, ty=sy+(38-th)/2
  ctx.fillStyle='rgba(255,255,255,0.08)'
  ctx.fillRect(sx,ty,sw,th)
  ctx.fillStyle='#CC00FF'; ctx.shadowColor='#CC00FF'; ctx.shadowBlur=8
  ctx.fillRect(sx,ty,sw*val,th)
  ctx.shadowBlur=0

  const hx=sx+sw*val, hy2=ty+th/2
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hx,hy2,9,0,Math.PI*2); ctx.fill()
  ctx.strokeStyle='#CC00FF'; ctx.lineWidth=2; ctx.stroke()
  ctx.restore()

  // Click zone
  const clickX=sx, clickY=sy-24, clickW=sw, clickH=62
  registerButton(clickX,clickY,clickW,clickH,()=>{}) // hover target only
  // Actual value change handled via separate click listener stored per-slider
  const selfOnChange=onChange
  function sliderClickHandler(ev) {
    if (state!=='settings') { canvas.removeEventListener('click',sliderClickHandler); return }
    const r=canvas.getBoundingClientRect()
    const x=(ev.clientX-r.left)*(W/r.width)
    const y=(ev.clientY-r.top)*(H/r.height)
    if (y>=clickY&&y<=clickY+clickH&&x>=sx&&x<=sx+sw) {
      const v=Math.max(0,Math.min(1,(x-sx)/sw))
      selfOnChange(v); sfxMenuTick()
    }
    canvas.removeEventListener('click',sliderClickHandler)
  }
  canvas.addEventListener('click',sliderClickHandler,{once:true})
}

// ─── renderHowToPlay ──────────────────────────────────────────────────────────
function renderHowToPlay() {
  clearButtons()
  ctx.fillStyle='rgba(0,0,12,0.97)'; ctx.fillRect(0,0,W,H)
  drawVignette()

  ctx.save()
  ctx.textAlign='center'
  ctx.font=`900 ${Math.min(36,W*0.058)}px Orbitron,monospace`
  ctx.fillStyle='#00FFFF'; ctx.shadowColor='#00FFFF'; ctx.shadowBlur=20
  ctx.fillText('HOW TO PLAY',W/2,36)
  ctx.shadowBlur=0

  const lines=[
    {t:'CONTROLS',                                         c:'#FF00FF', big:true},
    {t:'Arrow Keys / A D  —  Steer left and right',        c:'#fff'},
    {t:'Touch: Swipe left or right to steer',              c:'#fff'},
    {t:'ESC — Pause game',                                 c:'rgba(255,255,255,0.5)'},
    {t:'',c:''},
    {t:'OBJECTIVE',                                        c:'#FF00FF', big:true},
    {t:'Avoid all obstacles. Stay on the road.',           c:'#fff'},
    {t:'Survive as long as possible for high score.',      c:'#fff'},
    {t:'',c:''},
    {t:'SCORING',                                          c:'#FF00FF', big:true},
    {t:'Near Miss — dodge closely for score bonus',        c:'#00FF88'},
    {t:'Wall Ride — hug the road edge for extra coins',    c:'#FFFF00'},
    {t:'Green BOOST diamonds give a speed burst',          c:'#00FFFF'},
    {t:'30 / 60 / 120 second milestones = big bonus',     c:'#FFD700'},
    {t:'',c:''},
    {t:'OBSTACLE TYPES',                                   c:'#FF00FF', big:true},
    {t:'Red = static    Yellow = moving side to side',     c:'rgba(255,255,255,0.7)'},
    {t:'Green = shrinking    Purple = ghost (pass through)',c:'rgba(255,255,255,0.7)'},
    {t:'Magenta = rotating — be careful!',                 c:'rgba(255,255,255,0.7)'},
  ]

  let cy=72
  lines.forEach(line=>{
    if (!line.t) { cy+=8; return }
    ctx.textAlign='center'
    ctx.font=line.big
      ? `bold ${Math.min(15,W*0.023)}px Orbitron,monospace`
      : `${Math.min(12,W*0.019)}px Orbitron,monospace`
    ctx.fillStyle=line.c
    if (line.big) { ctx.shadowColor=line.c; ctx.shadowBlur=8 }
    ctx.fillText(line.t,W/2,cy)
    ctx.shadowBlur=0
    cy+=line.big?28:21
  })
  ctx.restore()

  const bw=Math.min(220,W*0.36), bh=46, bx=W/2-bw/2, by=H-68
  drawButton(bx,by,bw,bh,'START GAME',menuHovered===0,'#00FFFF')
  registerButton(bx,by,bw,bh,()=>{ if(!save.playerName){state='nameentry'}else{startGame()} })

  const bbw=140, bbh=36, bbx=W/2-bbw/2, bby=H-16
  drawButton(bbx,bby,bbw,bbh,'BACK',menuHovered===1,'rgba(255,255,255,0.4)')
  registerButton(bbx,bby,bbw,bbh,()=>{ state='menu'; sfxMenuTick() })
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
let lastTime = 0

function ensureGameDefaults() {
  if (!game || game.time == null) {
    game = {
      carZ:CAMERA_DIST, cameraZ:0, playerX:0, playerVX:0,
      score:0, coins:0, time:0, distance:0,
      speedMult:1.0, bonusSpeed:0,
      obstacles:[], speedPads:[], scorePopups:[],
      dead:false, deathTimer:0, usedRevive:false, newRecord:false,
      nearMissStreak:0, multiplier:1, lastNearMiss:[],
      wallRiding:false, shakeX:0, shakeY:0, shakeDuration:0,
      flashColor:null, flashTimer:0,
      milestones:{30:false,60:false,120:false},
    }
  }
}

function gameLoop(ts) {
  const dt = Math.min((ts - lastTime)/1000, 0.05)
  lastTime = ts
  menuTime += dt

  ensureGameDefaults()

  if      (state==='playing')     { update(dt); renderGame() }
  else if (state==='countdown')   {
    game.countdownTimer += dt
    if (game.countdownTimer >= 1.0) {
      game.countdownTimer = 0
      game.countdownVal--
      if (game.countdownVal < 0) state = 'playing'
      else sfxSpeedUp()
    }
    renderCountdown()
  }
  else if (state==='paused')      { renderGame(); renderPause() }
  else if (state==='gameover')    { renderGameOver() }
  else if (state==='menu')        { renderMenu() }
  else if (state==='nameentry')   { renderNameEntry() }
  else if (state==='shop')        { renderShop() }
  else if (state==='leaderboard') { renderLeaderboard() }
  else if (state==='howtoplay')   { renderHowToPlay() }
  else if (state==='settings')    { renderSettings() }

  requestAnimationFrame(gameLoop)
}

loadSave(); requestAnimationFrame(ts => { lastTime=ts; gameLoop(ts) })
