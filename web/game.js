// ============================================================
//  NEON DRIFT — Pseudo-3D Perspective Endless Runner
// ============================================================

// ── Color constants ──────────────────────────────────────────
const C = {
  GREEN:   '#CC00FF',
  RED:     '#FF0044',
  CYAN:    '#00FFFF',
  MAGENTA: '#FF00FF',
  YELLOW:  '#FFFF00',
  BG:      '#0A0A0F',
  WHITE:   '#FFFFFF',
  DIM:     'rgba(255,255,255,0.5)',
}

// ── Canvas setup ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas')
const ctx    = canvas.getContext('2d')
let W, H

function resize() {
  W = canvas.width  = canvas.offsetWidth
  H = canvas.height = canvas.offsetHeight
}
window.addEventListener('resize', () => { resize() })
resize()

// ── Save / Load ───────────────────────────────────────────────
const SAVE_KEY = 'neondrift_v2'
let save = {
  highScore:      0,
  totalCoins:     0,
  playerName:     '',
  settings:       { musicVol: 0.5, sfxVol: 0.5, quality: 'HIGH', particles: true },
  unlockedSkins:  ['blue'],
  unlockedTrails: ['none'],
  unlockedCars:   ['sedan'],
  activeSkin:     'blue',
  activeTrail:    'none',
  activeCar:      'sedan',
  gamesPlayed:    0,
}

function loadSave() {
  try {
    const d = localStorage.getItem(SAVE_KEY)
    if (d) {
      const parsed = JSON.parse(d)
      save = { ...save, ...parsed }
      save.settings = { ...{ musicVol: 0.5, sfxVol: 0.5, quality: 'HIGH', particles: true }, ...parsed.settings }
    }
  } catch (e) {}
}

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch (e) {}
}

loadSave()

// ── Skins ─────────────────────────────────────────────────────
const SKINS = [
  { id: 'blue',    name: 'Neon Blue',    color: '#00FFFF', cost: 0      },
  { id: 'green',   name: 'Neon Green',   color: '#00FF88', cost: 500    },
  { id: 'gold',    name: 'Neon Gold',    color: '#FFD700', cost: 2000   },
  { id: 'purple',  name: 'Neon Purple',  color: '#CC00FF', cost: 5000   },
  { id: 'red',     name: 'Neon Red',     color: '#FF0044', cost: 10000  },
  { id: 'rainbow', name: 'Neon Rainbow', color: 'rainbow', cost: 25000  },
  { id: 'void',    name: 'Void Black',   color: '#334455', cost: 50000  },
  { id: 'ghost',   name: 'Ghost White',  color: '#EEEEFF', cost: 75000  },
]

const CARS = [
  { id: 'sedan',  name: 'City Sedan',    desc: 'Balanced everyday ride',     cost: 0      },
  { id: 'sports', name: 'Sports Coupe',  desc: 'Low & wide, built for speed',cost: 1500   },
  { id: 'muscle', name: 'Muscle Car',    desc: 'Aggressive, wide body',      cost: 4000   },
  { id: 'f1',     name: 'F1 Racer',      desc: 'Flat, wide rear wing',       cost: 8000   },
  { id: 'cyber',  name: 'Cyber Wedge',   desc: 'Angular futuristic design',  cost: 15000  },
  { id: 'pickup', name: 'Neon Pickup',   desc: 'High cab, raw power',        cost: 6000   },
]

const TRAILS = [
  { id: 'none',     name: 'None',          color: null,      cost: 0      },
  { id: 'blue',     name: 'Blue Glow',     color: '#0088FF', cost: 200    },
  { id: 'purple',   name: 'Purple Glow',   color: '#8800FF', cost: 500    },
  { id: 'fire',     name: 'Fire Trail',    color: '#FF4400', cost: 1000   },
  { id: 'star',     name: 'Star Dust',     color: '#FFFF88', cost: 2000   },
  { id: 'rainbow',  name: 'Rainbow Trail', color: 'rainbow', cost: 5000   },
  { id: 'electric', name: 'Electric',      color: '#88FFFF', cost: 15000  },
]

// ── State machine ─────────────────────────────────────────────
let state = 'menu'

// ── Pseudo-3D engine constants ────────────────────────────────
const NUM_SEGS          = 120
const ROAD_W            = 0.58
const HORIZON_Y_RATIO   = 0.32
const ROAD_HALF_W_WORLD = 1.0
const CAMERA_DIST       = 22   // camera is this many segments BEHIND the car

function getHorizonY() { return H * HORIZON_Y_RATIO }

function segScreen(i) {
  const t     = i / (NUM_SEGS - 1)
  const curve = t * t
  const y     = getHorizonY() + (H - getHorizonY()) * curve
  const halfW = (W * ROAD_W / 2) * curve
  return { y, halfW, t, scale: curve }
}

// ── Buildings data ────────────────────────────────────────────
const BUILDINGS = []

function initBuildings() {
  BUILDINGS.length = 0
  for (let i = 0; i < 20; i++) {
    const height = 0.3 + Math.random() * 0.5
    const width  = 0.15 + Math.random() * 0.2
    BUILDINGS.push({ side: 'left',  segIndex: i * 6, height, width })
    BUILDINGS.push({ side: 'right', segIndex: i * 6, height, width })
  }
}

initBuildings()

// ── Game state ────────────────────────────────────────────────
let game = {}

function initGame() {
  game = {
    carZ:          CAMERA_DIST,   // car's world Z position
    cameraZ:       0,             // camera = carZ - CAMERA_DIST
    segOffset:     0,
    playerX:       0,
    playerVX:      0,
    playerLane:    1,        // 0=left 1=center 2=right
    laneMoveCool:  0,        // cooldown between lane changes
    usedRevive:    false,    // one revive per run
    score:         0,
    coins:         0,
    time:          0,
    distance:      0,
    speedMult:     1.0,
    obstacles:     [],
    speedPads:     [],
    particles:     [],
    trailParticles:[],
    wallParticles: [],
    scorePopups:   [],
    dead:          false,
    deathTimer:    0,
    shakeX:        0,
    shakeY:        0,
    shakeDuration: 0,
    flashColor:    null,
    flashTimer:    0,
    nearMissStreak: 0,
    multiplier:    1,
    lastNearMiss:  [],
    wallRiding:    false,
    milestones:    { 30: false, 60: false, 120: false },
    nameInput:     save.playerName || '',
    newRecord:     false,
    speedBoostTimer: 0,
    bonusSpeed:      0,    // permanent bonus from speed pads
    wheelAngle:      0,     // spinning wheels
    bobOffset:       0,     // subtle vertical road-bump bob
  }
}

// ── Speed progression ─────────────────────────────────────────
function getSpeedMult(t) {
  if (t < 10)  return 1.0
  if (t < 20)  return 1.1
  if (t < 30)  return 1.2
  if (t < 45)  return 1.4
  if (t < 60)  return 1.6
  if (t < 90)  return 1.8
  if (t < 120) return 2.2
  if (t < 180) return 2.6
  return 3.0 + Math.floor((t - 180) / 60) * 0.1
}

// ── Obstacle spawning ─────────────────────────────────────────
// 3 lanes: left / center / right
const LANES = [-0.64, 0, 0.64]
// Speed pads — flat tiles that boost speed when driven over
// Spawned in game.speedPads array
const LANE_TYPES = ['block','block','moving','rotating','shrinking','ghost']

function spawnObstaclesIfNeeded() {
  const t = game.time
  const spacing = t < 15 ? 65 : t < 45 ? 52 : t < 90 ? 40 : 30

  const furthestZ = game.obstacles.length
    ? Math.max(...game.obstacles.map(o => o.wz))
    : game.cameraZ

  if (furthestZ < game.cameraZ + NUM_SEGS * 0.8) {
    const spawnZ   = furthestZ + spacing
    const openLane = Math.floor(Math.random() * 3)   // 0,1 or 2 — the one gap

    // Obstacle visual variety per spawn set
    const rand = Math.random()
    let type = 'block'
    if (t > 20 && rand < 0.20) type = 'moving'
    else if (t > 35 && rand < 0.28) type = 'rotating'
    else if (t > 35 && rand < 0.35) type = 'shrinking'
    else if (t > 50 && rand < 0.40) type = 'ghost'

    for (let lane = 0; lane < 3; lane++) {
      if (lane === openLane) continue   // leave this lane open
      const wx     = LANES[lane]
      const halfW  = 0.26              // wide enough to fill the lane
      game.obstacles.push({
        wz: spawnZ, wx, halfW, origHalfW: halfW,
        w: halfW * 2, h: halfW * 2.8,  // tall barrier
        type, angle: 0, shrinkT: 0, originWX: wx,
        opacity: type === 'ghost' ? 0.35 : 1.0,
        nearMissed: false,
      })
    }
  }
}

function spawnSpeedPadsIfNeeded() {
  const furthestZ = game.speedPads.length
    ? Math.max(...game.speedPads.map(p => p.wz))
    : game.cameraZ

  // Spawn a speed pad every ~90 segments
  if (furthestZ < game.cameraZ + NUM_SEGS * 0.8) {
    if (Math.random() < 0.35) {
      const lane = Math.floor(Math.random() * 3)
      game.speedPads.push({
        wz: furthestZ + 90 + Math.random() * 30,
        wx: LANES[lane],
        used: false,
      })
    }
  }
}

function drawSpeedPads() {
  const roadHW = (W * ROAD_W) / 2
  for (const pad of game.speedPads) {
    const relZ = pad.wz - game.cameraZ
    if (relZ <= 0 || relZ >= NUM_SEGS) continue

    const segIdx = NUM_SEGS - 1 - Math.floor(relZ)
    if (segIdx < 0) continue
    const s  = segScreen(segIdx)
    const sx = W/2 + pad.wx * roadHW

    const t  = s.t
    const pw = roadHW * 0.45 * (0.3 + 0.7 * t)
    const ph = pw * 0.35

    const alpha = Math.min(1, t * 1.2)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowColor = '#00FF88'
    ctx.shadowBlur  = 20 * t
    ctx.strokeStyle = '#00FF88'
    ctx.fillStyle   = 'rgba(0,255,136,0.18)'
    ctx.lineWidth   = Math.max(1, t * 2)

    // Diamond/chevron shape flat on ground
    ctx.beginPath()
    ctx.moveTo(sx,        s.y - ph)
    ctx.lineTo(sx + pw/2, s.y)
    ctx.lineTo(sx,        s.y + ph * 0.3)
    ctx.lineTo(sx - pw/2, s.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Arrow chevrons inside
    ctx.globalAlpha = alpha * 0.7
    ctx.fillStyle = '#00FF88'
    ctx.font = `bold ${Math.max(8, pw * 0.3)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('▲', sx, s.y - ph * 0.2)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
  }
}

function checkSpeedPads() {
  const roadHW = (W * ROAD_W) / 2
  for (const pad of game.speedPads) {
    if (pad.used) continue
    const relZ = Math.abs(pad.wz - game.carZ)
    if (relZ > 3) continue

    // Check if car is over pad
    const dx = Math.abs(game.playerX - pad.wx)
    if (dx < 0.30) {
      pad.used = true
      // Permanent speed boost +0.4 (equivalent to 4 seconds of normal acceleration)
      game.bonusSpeed += 0.4
      game.score += 100
      addScorePopup('SPEED BOOST! +0.4x', '#00FF88')
      game.flashColor = '#00FF88'
      game.flashTimer = 0.3
    }
  }
  // Remove passed pads
  game.speedPads = game.speedPads.filter(p => p.wz > game.cameraZ - 5)
}

// ── Collision detection ───────────────────────────────────────
function checkCollisions() {
  for (const o of game.obstacles) {
    // Collide when obstacle is at the car's world Z (not camera Z)
    const relZ = Math.abs(o.wz - game.carZ)
    if (relZ > 3) continue

    const playerRelX = game.playerX
    const dx = Math.abs(playerRelX - o.wx)
    if (dx < o.halfW + 0.15) {
      triggerDeath()
      return
    }
    if (!o.nearMissed && dx < o.halfW + 0.28 && dx > o.halfW + 0.15) {
      o.nearMissed = true
      triggerNearMiss()
    }
  }
}

// ── Near miss ─────────────────────────────────────────────────
function triggerNearMiss() {
  const now = game.time
  game.lastNearMiss = game.lastNearMiss.filter(t => now - t < 10)
  game.lastNearMiss.push(now)
  const streak = game.lastNearMiss.length
  game.nearMissStreak = streak
  game.multiplier = streak >= 10 ? 5 : streak >= 5 ? 3 : streak >= 3 ? 2 : 1

  const bonus = 50 * game.multiplier
  game.score += bonus
  game.coins += 50

  const skin   = SKINS.find(s => s.id === save.activeSkin) || SKINS[0]
  const pColor = skin.color === 'rainbow' ? `hsl(${Date.now()/5%360},100%,60%)` : skin.color
  addScorePopup(`NEAR MISS! +${bonus}`, C.YELLOW)

  const near = segScreen(NUM_SEGS - 1)
  const px   = W/2 + game.playerX * near.halfW / ROAD_HALF_W_WORLD
  const py   = near.y - near.halfW * 0.22
  for (let i = 0; i < 8; i++) spawnParticle(px, py, pColor)
  game.flashColor = pColor
  game.flashTimer = 0.15
  sfxNearMiss()
}

// ── Death ─────────────────────────────────────────────────────
function triggerRevive() {
  // Simulate ad — in production wire to real rewarded ad SDK
  game.dead       = false
  game.deathTimer = 0
  game.usedRevive = true
  game.playerLane = 1          // reset to center lane
  game.playerX    = LANES[1]
  // Clear nearby obstacles so player isn't immediately killed again
  game.obstacles  = game.obstacles.filter(o => o.wz - game.cameraZ > 8)
  game.shakeDuration = 0
  game.flashColor    = '#FFAA00'
  game.flashTimer    = 0.6
  state = 'playing'
  addScorePopup('REVIVED!', '#FFAA00')
}

function triggerDeath() {
  if (game.dead) return
  game.dead = true
  game.shakeDuration = 0.6
  const near = segScreen(NUM_SEGS - 1)
  const px   = W/2 + game.playerX * near.halfW / ROAD_HALF_W_WORLD
  const py   = near.y - near.halfW * 0.22
  for (let i = 0; i < 40; i++) {
    spawnParticle(px, py, Math.random() < 0.5 ? '#FF4400' : C.RED, true)
  }
  game.flashColor = C.RED
  game.flashTimer = 0.5
  sfxCrash()
}

// ── Milestones ────────────────────────────────────────────────
function checkMilestones() {
  if (!game.milestones[30]  && game.time >= 30)  { game.milestones[30]  = true; triggerMilestone(30)  }
  if (!game.milestones[60]  && game.time >= 60)  { game.milestones[60]  = true; triggerMilestone(60)  }
  if (!game.milestones[120] && game.time >= 120) { game.milestones[120] = true; triggerMilestone(120) }
}

function triggerMilestone(sec) {
  const bonuses = { 30: 500, 60: 2000, 120: 10000 }
  const bonus   = bonuses[sec]
  game.score += bonus
  game.coins += bonus
  addScorePopup(`${sec}s MILESTONE! +${bonus}`, C.GREEN)
  game.flashColor = C.GREEN
  game.flashTimer = 0.4
  sfxSpeedUp()
}

// ── Particles ─────────────────────────────────────────────────
function spawnParticle(x, y, color, explosive) {
  if (!save.settings.particles) return
  if (explosive === undefined) explosive = false
  const angle = Math.random() * Math.PI * 2
  const speed = explosive ? 150 + Math.random() * 250 : 30 + Math.random() * 80
  const life  = 0.4 + Math.random() * 0.6
  game.particles.push({
    x, y, color,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life,
    maxLife: life,
    r: explosive ? 3 + Math.random() * 5 : 2 + Math.random() * 3,
  })
}

function spawnTrailParticle() {
  const trail = TRAILS.find(t => t.id === save.activeTrail)
  if (!trail || !trail.color) return
  const color = trail.color === 'rainbow'
    ? `hsl(${(Date.now() / 10) % 360},100%,60%)`
    : trail.color
  const near = segScreen(NUM_SEGS - 1)
  const px   = W/2 + game.playerX * near.halfW / ROAD_HALF_W_WORLD
  const py   = near.y - near.halfW * 0.22
  const r    = near.halfW * 0.22
  game.trailParticles.push({
    x: px + (Math.random() - 0.5) * r,
    y: py + r + (Math.random() - 0.5) * 5,
    color,
    vx: (Math.random() - 0.5) * 20,
    vy: 20 + Math.random() * 40,
    life:    0.4,
    maxLife: 0.4,
    r: 2 + Math.random() * 3,
  })
}

function updateParticles(dt) {
  const upd = arr => arr.filter(p => {
    p.x   += p.vx * dt
    p.y   += p.vy * dt
    p.vy  += 60 * dt
    p.life -= dt
    return p.life > 0
  })
  game.particles      = upd(game.particles)
  game.trailParticles = upd(game.trailParticles)
  game.wallParticles  = upd(game.wallParticles)
}

function addScorePopup(text, color) {
  const near = segScreen(NUM_SEGS - 1)
  const px   = W/2 + game.playerX * near.halfW / ROAD_HALF_W_WORLD
  const py   = near.y - near.halfW * 0.5
  game.scorePopups.push({ text, color, x: px, y: py, life: 1.2 })
}

// ── UPDATE ────────────────────────────────────────────────────
function update(dt) {
  if (game.dead) {
    game.deathTimer += dt
    updateParticles(dt)
    if (game.shakeDuration > 0) {
      game.shakeDuration -= dt
      const mag = 12 * Math.min(1, game.shakeDuration / 0.3)
      game.shakeX = (Math.random() - 0.5) * mag
      game.shakeY = (Math.random() - 0.5) * mag
    } else {
      game.shakeX = 0
      game.shakeY = 0
    }
    if (game.flashTimer > 0) game.flashTimer -= dt
    if (game.deathTimer > 2.5) {
      state = 'gameover'
      finalizeScore()
    }
    return
  }

  game.time        += dt
  game.wheelAngle  += game.speedMult * dt * 6   // wheels spin faster at higher speed
  game.bobOffset    = Math.sin(game.time * 8 * game.speedMult) * 1.2  // road-bump bob
  const prevMult = game.speedMult
  // Constant acceleration: +0.2 every 2 seconds = +0.1/sec, capped at 8x
  game.speedMult = Math.min(1.0 + game.time * 0.1 + game.bonusSpeed, 8.0)

  const thresholds = [1.1, 1.2, 1.4, 1.6, 1.8, 2.2, 2.6]
  thresholds.forEach(th => {
    if (prevMult < th && game.speedMult >= th) sfxSpeedUp()
  })

  const scrollSpeed = 15 * game.speedMult
  game.carZ    += scrollSpeed * dt          // car moves forward through world
  game.cameraZ  = game.carZ - CAMERA_DIST  // camera follows behind
  game.segOffset = game.cameraZ % 1  // scrolling ground shows movement
  game.distance  = game.cameraZ * 10

  game.score += 2 * dt * game.multiplier
  game.coins += 2 * dt

  // Smooth direct movement — hold key = constant speed, release = instant stop, zero drift
  const MOVE_SPEED = 1.8   // world units per second
  const prevX = game.playerX
  if (keys.left)  game.playerX -= MOVE_SPEED * dt
  if (keys.right) game.playerX += MOVE_SPEED * dt
  // Fall off edge — no hard clamp, death if past road boundary
  if (game.playerX < -ROAD_HALF_W_WORLD || game.playerX > ROAD_HALF_W_WORLD) {
    addScorePopup('FELL OFF!', '#FF6600')
    triggerDeath()
  }
  game.playerVX = (game.playerX - prevX) / (dt || 0.016)  // for exhaust flare direction only

  // Wall ride
  const onWall = Math.abs(game.playerX) >= ROAD_HALF_W_WORLD - 0.22
  if (onWall) {
    game.score += 5 * dt
    game.coins += 5 * dt
    game.wallRiding = true
    if (save.settings.particles && Math.random() > 0.7) {
      const carIdx2 = Math.min(NUM_SEGS-1,Math.max(0,Math.round(NUM_SEGS-1-CAMERA_DIST)))
      const near = segScreen(carIdx2)
      const px   = W/2 + game.playerX * near.halfW / ROAD_HALF_W_WORLD
      const py   = near.y
      game.wallParticles.push({
        x: px, y: py,
        color: C.MAGENTA,
        vx: (game.playerX < 0 ? 1 : -1) * (20 + Math.random() * 40),
        vy: (Math.random() - 0.5) * 40,
        life: 0.3,
        maxLife: 0.3,
        r: 2 + Math.random() * 3,
      })
    }
  } else {
    game.wallRiding = false
  }

  // Obstacles
  for (let i = game.obstacles.length - 1; i >= 0; i--) {
    const o = game.obstacles[i]
    if (o.type === 'moving')    o.wx = o.originWX + Math.sin(game.time * 2) * 0.4
    if (o.type === 'rotating')  o.angle += 2 * dt
    if (o.type === 'shrinking') {
      o.shrinkT += dt
      o.halfW    = Math.max(0.08, o.origHalfW * (1 - o.shrinkT / 6))
      o.w        = o.halfW * 2
    }
    if (o.wz < game.cameraZ - 2) game.obstacles.splice(i, 1)
  }

  spawnObstaclesIfNeeded()
  spawnSpeedPadsIfNeeded()
  checkSpeedPads()
  checkCollisions()

  // Trail
  if (save.settings.particles && save.activeTrail !== 'none') {
    spawnTrailParticle()
  }

  updateParticles(dt)

  game.scorePopups = game.scorePopups.filter(p => {
    p.y   -= 50 * dt
    p.life -= dt
    return p.life > 0
  })

  if (game.shakeDuration > 0) {
    game.shakeDuration -= dt
    const mag = 12 * Math.min(1, game.shakeDuration / 0.3)
    game.shakeX = (Math.random() - 0.5) * mag
    game.shakeY = (Math.random() - 0.5) * mag
  } else {
    game.shakeX = 0
    game.shakeY = 0
  }

  if (game.flashTimer > 0) game.flashTimer -= dt
  checkMilestones()
}

// ── DRAW HELPERS ──────────────────────────────────────────────
function drawNeonLine(x1, y1, x2, y2, color, width, alpha) {
  if (alpha === undefined) alpha = 1
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowColor = color
  ctx.shadowBlur  = 15
  ctx.strokeStyle = color
  ctx.lineWidth   = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

// ── DRAW ROAD ─────────────────────────────────────────────────
function drawRoad() {
  // Road surface — single solid trapezoid, no scrolling squares
  const nearFill = segScreen(NUM_SEGS - 1)
  const farFill  = segScreen(0)
  const rdGrad   = ctx.createLinearGradient(0, farFill.y, 0, nearFill.y)
  rdGrad.addColorStop(0,   '#08001A')
  rdGrad.addColorStop(0.5, '#0C001F')
  rdGrad.addColorStop(1,   '#0F0025')
  ctx.fillStyle = rdGrad
  ctx.beginPath()
  ctx.moveTo(W/2 - farFill.halfW,  farFill.y)
  ctx.lineTo(W/2 + farFill.halfW,  farFill.y)
  ctx.lineTo(W/2 + nearFill.halfW, nearFill.y)
  ctx.lineTo(W/2 - nearFill.halfW, nearFill.y)
  ctx.closePath()
  ctx.fill()

  // Road edge lines
  const near = segScreen(NUM_SEGS - 1)
  const far  = segScreen(0)
  drawNeonLine(W/2 - near.halfW, near.y, W/2 - far.halfW * 0.05, far.y, '#FF00FF', 2, 0.9)
  drawNeonLine(W/2 + near.halfW, near.y, W/2 + far.halfW * 0.05, far.y, '#FF00FF', 2, 0.9)

  // Center dashed line
  drawNeonLine(W/2, far.y, W/2, near.y, '#9900FF', 1, 0.30)

  // World-space grid lines — anchored to fixed world Z, scroll as camera advances
  // Each line is at worldZ = N * GRID_STEP; relZ = worldZ - game.cameraZ
  const GRID_STEP = 10
  const firstGrid = Math.ceil(game.cameraZ / GRID_STEP) * GRID_STEP
  for (let n = 0; n < 14; n++) {
    const worldZ = firstGrid + n * GRID_STEP
    const relZ   = worldZ - game.cameraZ          // 0 = at camera, NUM_SEGS = horizon
    if (relZ <= 0 || relZ >= NUM_SEGS) continue

    // Interpolate between two adjacent segment screens for smooth sub-pixel scroll
    const lo   = Math.floor(relZ), hi = Math.min(lo + 1, NUM_SEGS - 1)
    const frac = relZ - lo
    const sLo  = segScreen(NUM_SEGS - 1 - lo)
    const sHi  = segScreen(NUM_SEGS - 1 - hi)
    const sy   = sLo.y * (1 - frac) + sHi.y * frac
    const hw   = sLo.halfW * (1 - frac) + sHi.halfW * frac
    const alpha = (1 - relZ / NUM_SEGS) * 0.70
    const col   = n % 2 === 0 ? '#9900FF' : '#CC00FF'
    drawNeonLine(W/2 - hw, sy, W/2 + hw, sy, col, 1, alpha)
  }

  // Lane dividers (world-space, same scroll)
  const laneX1 = W/2 + LANES[0] * near.halfW / ROAD_HALF_W_WORLD
  const laneX2 = W/2 + LANES[2] * near.halfW / ROAD_HALF_W_WORLD
  drawNeonLine(laneX1, far.y, laneX1, near.y, '#550088', 1, 0.25)
  drawNeonLine(laneX2, far.y, laneX2, near.y, '#550088', 1, 0.25)
}

// ── DRAW BUILDINGS ────────────────────────────────────────────
function drawBuildings() {
  for (const b of BUILDINGS) {
    // Building world-Z position loops every NUM_SEGS*0.8 world units
    const BLOOP  = NUM_SEGS * 0.8
    const bWorldZ = ((b.segIndex * 3) % BLOOP + BLOOP) % BLOOP
    const relZ   = ((bWorldZ - game.cameraZ % BLOOP) % BLOOP + BLOOP) % BLOOP
    if (relZ <= 0 || relZ >= NUM_SEGS - 1) continue
    const si = NUM_SEGS - 1 - relZ
    if (si < 1 || si >= NUM_SEGS - 1) continue

    const s   = segScreen(Math.floor(si))
    if (s.halfW < 1) continue

    const bw = s.halfW * b.width * 1.5
    const bh = (H - s.y) * b.height * 1.5 + s.halfW * b.height * 2

    const bx = b.side === 'left'
      ? W/2 - s.halfW - bw * 0.6
      : W/2 + s.halfW + bw * 0.6 - bw

    const by    = s.y - bh
    const alpha = s.t * 0.75

    if (bw < 2 || bh < 2) continue

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#FF00FF'
    ctx.shadowColor = '#FF00FF'
    ctx.shadowBlur  = 10
    ctx.lineWidth   = 1

    ctx.strokeRect(bx, by, bw, bh)

    const floors = Math.max(2, Math.floor(2 + s.t * 5))
    for (let f = 1; f < floors; f++) {
      const fy = by + (bh / floors) * f
      ctx.beginPath(); ctx.moveTo(bx, fy); ctx.lineTo(bx + bw, fy); ctx.stroke()
    }
    ctx.beginPath(); ctx.moveTo(bx + bw/2, by); ctx.lineTo(bx + bw/2, by + bh); ctx.stroke()

    ctx.restore()
  }
}

// ── PROJECT OBSTACLE ──────────────────────────────────────────
function projectObstacle(o) {
  const relZ = o.wz - game.cameraZ
  if (relZ <= 0 || relZ >= NUM_SEGS) return null

  const segIdx = NUM_SEGS - 1 - Math.floor(relZ)
  if (segIdx < 0 || segIdx >= NUM_SEGS) return null

  const s      = segScreen(segIdx)
  const roadHW = (W * ROAD_W) / 2

  // Lane X — fixed to lane positions (no jitter)
  const sx = W/2 + o.wx * roadHW

  // Moderate perspective: 0.35 at far, 0.65 at near — controlled size range
  const minScale = 0.30, maxScale = 0.72
  const t = s.t
  const sizeT = minScale + (maxScale - minScale) * t

  const FIXED_W = roadHW * 0.56 * sizeT
  const FIXED_H = FIXED_W * 0.92

  return { x: sx - FIXED_W/2, y: s.y - FIXED_H, w: FIXED_W, h: FIXED_H, s }
}

// ── DRAW OBSTACLE ─────────────────────────────────────────────
function drawObstacle(o) {
  const p = projectObstacle(o)
  if (!p) return
  const alpha = Math.min(p.s.t * (o.opacity || 1), 1)
  if (alpha < 0.02) return

  const OCOLS2 = {
    block:    { s: '#FF0044', f: 'rgba(255,0,68,0.22)',    top: 'rgba(255,80,100,0.35)' },
    moving:   { s: '#FFFF00', f: 'rgba(255,255,0,0.18)',   top: 'rgba(255,255,100,0.30)' },
    shrinking:{ s: '#00FF88', f: 'rgba(0,255,136,0.18)',   top: 'rgba(80,255,160,0.28)' },
    ghost:    { s: '#AA44FF', f: 'rgba(170,68,255,0.10)',  top: 'rgba(180,100,255,0.15)' },
    rotating: { s: '#FF00FF', f: 'rgba(255,0,255,0.18)',   top: 'rgba(255,100,255,0.28)' },
    wall_l:   { s: '#FF6600', f: 'rgba(255,102,0,0.20)',   top: 'rgba(255,150,50,0.30)' },
    wall_r:   { s: '#FF6600', f: 'rgba(255,102,0,0.20)',   top: 'rgba(255,150,50,0.30)' },
  }
  const col = OCOLS2[o.type] || OCOLS2.block

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowColor = col.s
  ctx.shadowBlur  = 18 * p.s.t
  ctx.lineWidth   = Math.max(1, p.s.t * 2)

  // ── TOP FACE (trapezoid — perspective gives depth illusion) ──
  const topH   = p.h * 0.38              // height of top face
  const shrink = 0.82                    // far edge of top is narrower
  const topFL  = p.x                     // front-left
  const topFR  = p.x + p.w              // front-right
  const topBL  = p.x + p.w * (1 - shrink) / 2          // back-left
  const topBR  = p.x + p.w - p.w * (1 - shrink) / 2   // back-right
  const topFY  = p.y                     // front edge of top = top of front face
  const topBY  = p.y - topH             // back edge of top

  ctx.fillStyle   = col.top
  ctx.strokeStyle = col.s
  ctx.beginPath()
  ctx.moveTo(topFL, topFY)
  ctx.lineTo(topFR, topFY)
  ctx.lineTo(topBR, topBY)
  ctx.lineTo(topBL, topBY)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // ── FRONT FACE ──
  ctx.fillStyle = col.f
  if (o.type === 'rotating') {
    ctx.save()
    ctx.translate(p.x + p.w/2, p.y + p.h/2)
    ctx.rotate(o.angle)
    ctx.strokeRect(-p.w/2, -p.h/2, p.w, p.h)
    ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h)
    ctx.restore()
  } else if (o.type === 'ghost') {
    ctx.setLineDash([5, 4])
    ctx.strokeRect(p.x, p.y, p.w, p.h)
    ctx.setLineDash([])
    ctx.fillRect(p.x, p.y, p.w, p.h)
  } else {
    ctx.strokeRect(p.x, p.y, p.w, p.h)
    ctx.fillRect(p.x, p.y, p.w, p.h)
  }

  // ── EDGE HIGHLIGHT (left vertical edge of box) ──
  ctx.strokeStyle = col.s
  ctx.globalAlpha = alpha * 0.55
  ctx.lineWidth = Math.max(1, p.s.t * 1.5)
  ctx.beginPath()
  ctx.moveTo(topBL, topBY)
  ctx.lineTo(p.x, p.y)
  ctx.lineTo(p.x, p.y + p.h)
  ctx.stroke()
  // right edge
  ctx.beginPath()
  ctx.moveTo(topBR, topBY)
  ctx.lineTo(p.x + p.w, p.y)
  ctx.lineTo(p.x + p.w, p.y + p.h)
  ctx.stroke()

  ctx.restore()
}

// ── DRAW PLAYER (neon car) ────────────────────────────────────
function drawPlayer() {
  // Car is at world Z = game.carZ, camera is at game.cameraZ
  // relZ from camera to car = CAMERA_DIST → project to screen
  const carRelZ  = Math.max(1, game.carZ - game.cameraZ)  // should equal CAMERA_DIST
  const carSegIdx = Math.min(NUM_SEGS - 1, Math.max(0, Math.round(NUM_SEGS - 1 - carRelZ)))
  const carSeg   = segScreen(carSegIdx)
  const px   = W/2 + game.playerX * carSeg.halfW / ROAD_HALF_W_WORLD
  const py   = carSeg.y + game.bobOffset
  const cw   = carSeg.halfW * 0.32   // size relative to road width at car's screen position
  const ch   = carSeg.halfW * 0.26

  const skin  = SKINS.find(s => s.id === save.activeSkin) || SKINS[0]
  const TRIM  = skin.color === 'rainbow' ? `hsl(${Date.now()/6%360},100%,60%)` : skin.color
  const GLOW  = TRIM
  const CAR   = '#0A0015'

  ctx.save()

  // Underglow
  const ug = ctx.createRadialGradient(px, py, 0, px, py, cw*2.5)
  ug.addColorStop(0,   TRIM.replace('#','rgba(').replace(/^rgba\(([0-9a-fA-F]{6})$/,
    (_,h)=>`rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},0.30)`))
  ug.addColorStop(1,   'rgba(0,0,0,0)')
  // Simpler underglow
  ctx.fillStyle = 'rgba(180,0,255,0.18)'
  ctx.beginPath(); ctx.ellipse(px, py, cw*2.2, cw*0.35, 0, 0, Math.PI*2); ctx.fill()

  ctx.shadowColor = GLOW; ctx.shadowBlur = 22

  const model = save.activeCar || 'sedan'
  if      (model === 'sedan')  drawCarSedan(px, py, cw, ch, CAR, TRIM, GLOW)
  else if (model === 'sports') drawCarSports(px, py, cw, ch, CAR, TRIM, GLOW)
  else if (model === 'muscle') drawCarMuscle(px, py, cw, ch, CAR, TRIM, GLOW)
  else if (model === 'f1')     drawCarF1(px, py, cw, ch, CAR, TRIM, GLOW)
  else if (model === 'cyber')  drawCarCyber(px, py, cw, ch, CAR, TRIM, GLOW)
  else if (model === 'pickup') drawCarPickup(px, py, cw, ch, CAR, TRIM, GLOW)
  else                         drawCarSedan(px, py, cw, ch, CAR, TRIM, GLOW)

  ctx.restore()
}

function carNeon(color, blur){ ctx.strokeStyle=color; ctx.shadowColor=color; ctx.shadowBlur=blur; ctx.fillStyle=color }

// Draw a spinning wheel at world position (wx, wy) with radius r
function drawWheel(wx, wy, r, TRIM) {
  const a = game.wheelAngle
  ctx.save()
  ctx.shadowColor = TRIM; ctx.shadowBlur = 10
  // Tyre
  ctx.strokeStyle = TRIM; ctx.lineWidth = r * 0.55
  ctx.beginPath(); ctx.arc(wx, wy, r * 0.72, 0, Math.PI * 2); ctx.stroke()
  // Hub
  ctx.fillStyle = '#0A0015'; ctx.strokeStyle = TRIM; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(wx, wy, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  // Spokes (rotate with wheelAngle)
  ctx.lineWidth = 1.5; ctx.strokeStyle = TRIM
  for (let s = 0; s < 4; s++) {
    const sa = a + s * Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(wx + Math.cos(sa) * r * 0.35, wy + Math.sin(sa) * r * 0.35)
    ctx.lineTo(wx + Math.cos(sa) * r * 0.72, wy + Math.sin(sa) * r * 0.72)
    ctx.stroke()
  }
  ctx.restore()
}

function drawCarSedan(px,py,cw,ch,CAR,TRIM,GLOW){
  const bumpY=py-ch*0.14, bodyY=py-ch*0.82, roofY=py-ch
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=1.8
  ctx.beginPath(); ctx.roundRect(px-cw,bumpY,cw*2,ch*0.14,2); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(px-cw*0.94,bodyY,cw*1.88,ch*0.68,4); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px-cw*0.72,bodyY+ch*0.02); ctx.lineTo(px+cw*0.72,bodyY+ch*0.02)
  ctx.lineTo(px+cw*0.46,roofY); ctx.lineTo(px-cw*0.46,roofY); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle='rgba(0,220,255,0.12)'; ctx.strokeStyle='rgba(0,220,255,0.4)'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(px-cw*0.56,bodyY+ch*0.06); ctx.lineTo(px+cw*0.56,bodyY+ch*0.06)
  ctx.lineTo(px+cw*0.34,roofY-ch*0.01); ctx.lineTo(px-cw*0.34,roofY-ch*0.01); ctx.closePath(); ctx.fill(); ctx.stroke()
  carNeon(GLOW,14); ctx.lineWidth=2.5
  ctx.beginPath(); ctx.moveTo(px-cw*0.94,bodyY+ch*0.12); ctx.lineTo(px-cw*0.94,bodyY+ch*0.58); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px+cw*0.94,bodyY+ch*0.12); ctx.lineTo(px+cw*0.94,bodyY+ch*0.58); ctx.stroke()
  ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(px-cw*0.88,bumpY+ch*0.12); ctx.lineTo(px+cw*0.88,bumpY+ch*0.12); ctx.stroke()
  ctx.shadowColor='#FF0000'; ctx.shadowBlur=16; ctx.fillStyle='#FF1111'
  ctx.beginPath(); ctx.roundRect(px-cw*0.90,bodyY+ch*0.08,cw*0.20,ch*0.25,2); ctx.fill()
  ctx.beginPath(); ctx.roundRect(px+cw*0.70,bodyY+ch*0.08,cw*0.20,ch*0.25,2); ctx.fill()
  // Wheels
  const wr=cw*0.28
  drawWheel(px-cw*0.75, py+wr*0.1, wr, TRIM)
  drawWheel(px+cw*0.75, py+wr*0.1, wr, TRIM)
}

function drawCarSports(px,py,cw,ch,CAR,TRIM,GLOW){
  // Very low and wide
  const W2=cw*1.15, H2=ch*0.70
  const bY=py-H2*0.15, bodyY=py-H2*0.85, roofY=py-H2
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=1.8
  ctx.beginPath(); ctx.roundRect(px-W2,bY,W2*2,H2*0.15,2); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(px-W2*0.96,bodyY,W2*1.92,H2*0.70,5); ctx.fill(); ctx.stroke()
  // Low swept roof
  ctx.beginPath(); ctx.moveTo(px-W2*0.85,bodyY); ctx.lineTo(px+W2*0.85,bodyY)
  ctx.lineTo(px+W2*0.30,roofY); ctx.lineTo(px-W2*0.30,roofY); ctx.closePath(); ctx.fill(); ctx.stroke()
  // Wide spoiler
  carNeon(TRIM,8); ctx.lineWidth=3
  ctx.beginPath(); ctx.moveTo(px-W2*1.1,bodyY+H2*0.02); ctx.lineTo(px+W2*1.1,bodyY+H2*0.02); ctx.stroke()
  carNeon(GLOW,16); ctx.lineWidth=3
  ctx.beginPath(); ctx.moveTo(px-W2,bY+H2*0.14); ctx.lineTo(px+W2,bY+H2*0.14); ctx.stroke()
  ctx.shadowColor='#FF0000'; ctx.shadowBlur=16; ctx.fillStyle='#FF1111'
  ctx.beginPath(); ctx.roundRect(px-W2*0.95,bodyY+H2*0.06,W2*0.24,H2*0.22,2); ctx.fill()
  ctx.beginPath(); ctx.roundRect(px+W2*0.71,bodyY+H2*0.06,W2*0.24,H2*0.22,2); ctx.fill()
  const wr=W2*0.26; drawWheel(px-W2*0.78,py+wr*0.1,wr,TRIM); drawWheel(px+W2*0.78,py+wr*0.1,wr,TRIM)
}

function drawCarMuscle(px,py,cw,ch,CAR,TRIM,GLOW){
  // Wide + high hood bulge
  const W2=cw*1.10, H2=ch*1.05
  const bY=py-H2*0.14, bodyY=py-H2*0.85, roofY=py-H2
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2
  ctx.beginPath(); ctx.roundRect(px-W2,bY,W2*2,H2*0.16,2); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(px-W2*0.96,bodyY,W2*1.92,H2*0.71,4); ctx.fill(); ctx.stroke()
  // Hood bulge
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM
  ctx.beginPath(); ctx.roundRect(px-W2*0.40,bodyY-H2*0.14,W2*0.80,H2*0.16,3); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px-W2*0.68,bodyY); ctx.lineTo(px+W2*0.68,bodyY)
  ctx.lineTo(px+W2*0.44,roofY); ctx.lineTo(px-W2*0.44,roofY); ctx.closePath(); ctx.fill(); ctx.stroke()
  carNeon(GLOW,18); ctx.lineWidth=3
  ctx.beginPath(); ctx.moveTo(px-W2,bY+H2*0.14); ctx.lineTo(px+W2,bY+H2*0.14); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px-W2*0.96,bodyY+H2*0.35); ctx.lineTo(px-W2*0.96,bodyY+H2*0.65); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px+W2*0.96,bodyY+H2*0.35); ctx.lineTo(px+W2*0.96,bodyY+H2*0.65); ctx.stroke()
  ctx.shadowColor='#FF0000'; ctx.shadowBlur=18; ctx.fillStyle='#FF2222'
  ctx.beginPath(); ctx.roundRect(px-W2*0.94,bodyY+H2*0.08,W2*0.22,H2*0.28,2); ctx.fill()
  ctx.beginPath(); ctx.roundRect(px+W2*0.72,bodyY+H2*0.08,W2*0.22,H2*0.28,2); ctx.fill()
  const wr=W2*0.28; drawWheel(px-W2*0.76,py+wr*0.1,wr,TRIM); drawWheel(px+W2*0.76,py+wr*0.1,wr,TRIM)
}

function drawCarF1(px,py,cw,ch,CAR,TRIM,GLOW){
  // Flat, very wide, rear wing
  const W2=cw*1.30, H2=ch*0.50
  const bY=py-H2*0.20, bodyY=py-H2*0.90, cockpitY=py-H2*1.30
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2
  // Main flat body
  ctx.beginPath(); ctx.roundRect(px-W2,bY,W2*2,H2*0.20,2); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(px-W2*0.92,bodyY,W2*1.84,H2*0.70,4); ctx.fill(); ctx.stroke()
  // Cockpit bump (center)
  ctx.beginPath(); ctx.roundRect(px-W2*0.22,cockpitY,W2*0.44,H2*0.45,4); ctx.fill(); ctx.stroke()
  // Rear wing (wide horizontal bar above body)
  const wingY=bodyY-H2*0.18
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2.5
  ctx.beginPath(); ctx.roundRect(px-W2*1.05,wingY,W2*2.10,H2*0.14,2); ctx.fill(); ctx.stroke()
  // Wing struts
  ctx.beginPath(); ctx.moveTo(px-W2*0.60,wingY+H2*0.14); ctx.lineTo(px-W2*0.60,bodyY); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px+W2*0.60,wingY+H2*0.14); ctx.lineTo(px+W2*0.60,bodyY); ctx.stroke()
  carNeon(GLOW,20); ctx.lineWidth=3
  ctx.beginPath(); ctx.moveTo(px-W2*1.05,wingY); ctx.lineTo(px+W2*1.05,wingY); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px-W2,bY+H2*0.20); ctx.lineTo(px+W2,bY+H2*0.20); ctx.stroke()
  ctx.shadowColor='#FF0000'; ctx.shadowBlur=14; ctx.fillStyle='#FF1111'
  ctx.beginPath(); ctx.roundRect(px-W2*0.94,bodyY+H2*0.08,W2*0.20,H2*0.20,2); ctx.fill()
  ctx.beginPath(); ctx.roundRect(px+W2*0.74,bodyY+H2*0.08,W2*0.20,H2*0.20,2); ctx.fill()
  const wr=W2*0.22; drawWheel(px-W2*0.80,py+wr*0.1,wr,TRIM); drawWheel(px+W2*0.80,py+wr*0.1,wr,TRIM)
}

function drawCarCyber(px,py,cw,ch,CAR,TRIM,GLOW){
  // Sharp angular wedge
  const W2=cw*1.05, H2=ch*0.90
  const bY=py-H2*0.12, bodyY=py-H2*0.85, roofY=py-H2
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=1.8
  ctx.beginPath(); ctx.rect(px-W2,bY,W2*2,H2*0.14); ctx.fill(); ctx.stroke()
  // Angular body (no rounded corners — sharp)
  ctx.beginPath()
  ctx.moveTo(px-W2*0.96,bodyY+H2*0.70)
  ctx.lineTo(px+W2*0.96,bodyY+H2*0.70)
  ctx.lineTo(px+W2*0.96,bodyY)
  ctx.lineTo(px-W2*0.96,bodyY)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  // Sharp wedge roof
  ctx.beginPath()
  ctx.moveTo(px-W2*0.96,bodyY)
  ctx.lineTo(px+W2*0.96,bodyY)
  ctx.lineTo(px+W2*0.15,roofY)
  ctx.lineTo(px-W2*0.15,roofY)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  // Diagonal accent lines
  carNeon(GLOW,16); ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(px-W2*0.96,bodyY+H2*0.20); ctx.lineTo(px-W2*0.30,bodyY); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px+W2*0.96,bodyY+H2*0.20); ctx.lineTo(px+W2*0.30,bodyY); ctx.stroke()
  ctx.lineWidth=3
  ctx.beginPath(); ctx.moveTo(px-W2,bY+H2*0.13); ctx.lineTo(px+W2,bY+H2*0.13); ctx.stroke()
  ctx.shadowColor='#FF0000'; ctx.shadowBlur=16; ctx.fillStyle='#FF1111'
  ctx.beginPath(); ctx.rect(px-W2*0.94,bodyY+H2*0.06,W2*0.24,H2*0.18); ctx.fill()
  ctx.beginPath(); ctx.rect(px+W2*0.70,bodyY+H2*0.06,W2*0.24,H2*0.18); ctx.fill()
  const wr=W2*0.26; drawWheel(px-W2*0.78,py+wr*0.1,wr,TRIM); drawWheel(px+W2*0.78,py+wr*0.1,wr,TRIM)
}

function drawCarPickup(px,py,cw,ch,CAR,TRIM,GLOW){
  // Tall cab + flatbed
  const W2=cw*1.05, H2=ch*1.15
  const bY=py-H2*0.14, bodyY=py-H2*0.85, roofY=py-H2
  // Flatbed (rear, lower)
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=1.8
  ctx.beginPath(); ctx.roundRect(px,bY,W2,H2*0.55,3); ctx.fill(); ctx.stroke()
  // Flatbed rails
  carNeon(TRIM,8); ctx.lineWidth=1.5
  ctx.beginPath(); ctx.moveTo(px+W2*0.05,bY); ctx.lineTo(px+W2*0.05,bY-H2*0.25); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px+W2*0.98,bY); ctx.lineTo(px+W2*0.98,bY-H2*0.25); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px+W2*0.05,bY-H2*0.25); ctx.lineTo(px+W2*0.98,bY-H2*0.25); ctx.stroke()
  // Cab (left half, taller)
  ctx.fillStyle=CAR; ctx.strokeStyle=TRIM; ctx.lineWidth=2
  ctx.beginPath(); ctx.roundRect(px-W2*0.96,bY,W2*1.10,H2*0.72,4); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px-W2*0.80,bodyY); ctx.lineTo(px+W2*0.22,bodyY)
  ctx.lineTo(px+W2*0.22,roofY); ctx.lineTo(px-W2*0.50,roofY)
  ctx.lineTo(px-W2*0.80,bodyY+H2*0.08); ctx.closePath(); ctx.fill(); ctx.stroke()
  // Rear window
  ctx.fillStyle='rgba(0,220,255,0.12)'; ctx.strokeStyle='rgba(0,220,255,0.4)'; ctx.lineWidth=1
  ctx.beginPath(); ctx.rect(px-W2*0.72,bodyY+H2*0.08,W2*0.88,H2*0.38); ctx.fill(); ctx.stroke()
  carNeon(GLOW,16); ctx.lineWidth=3
  ctx.beginPath(); ctx.moveTo(px-W2,bY+H2*0.14); ctx.lineTo(px+W2,bY+H2*0.14); ctx.stroke()
  ctx.shadowColor='#FF0000'; ctx.shadowBlur=16; ctx.fillStyle='#FF1111'
  ctx.beginPath(); ctx.roundRect(px-W2*0.90,bodyY+H2*0.10,W2*0.20,H2*0.22,2); ctx.fill()
  const wr=W2*0.28; drawWheel(px-W2*0.78,py+wr*0.1,wr,TRIM); drawWheel(px+W2*0.78,py+wr*0.1,wr,TRIM)
}

// ── DRAW PARTICLES ────────────────────────────────────────────
function drawParticleArray(arr) {
  arr.forEach(p => {
    const a = Math.max(0, p.life / p.maxLife)
    ctx.save()
    ctx.globalAlpha = a
    ctx.shadowColor = p.color
    ctx.shadowBlur  = 12
    ctx.fillStyle   = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

// ── DRAW SPEED LINES ─────────────────────────────────────────
function drawSpeedLines() {
  const intensity = Math.min(1, (game.speedMult - 1.4) / 1.6)
  ctx.save()
  ctx.globalAlpha = 0.14 * intensity
  ctx.strokeStyle = '#CC00FF'
  ctx.lineWidth   = 1
  for (let i = 0; i < 14; i++) {
    const x   = Math.random() * W
    const len = 40 + Math.random() * 100
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, len)
    ctx.stroke()
  }
  ctx.restore()
}

// ── MENU BACKGROUND GRID ─────────────────────────────────────
function drawMenuGrid(time) {
  ctx.strokeStyle = 'rgba(180,0,255,0.07)'
  ctx.lineWidth   = 1
  const scroll    = (time * 80) % 60
  for (let y = -scroll; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
}

// ── MAIN RENDER ───────────────────────────────────────────────
function render() {
  ctx.save()
  ctx.translate(game.shakeX, game.shakeY)

  // Sky — deep space purple
  ctx.fillStyle = '#070010'
  ctx.fillRect(-10, -10, W + 20, H + 20)

  // Horizon glow — magenta/purple
  const horizonY = getHorizonY()
  const hg = ctx.createLinearGradient(0, horizonY - 70, 0, horizonY + 50)
  hg.addColorStop(0,   'rgba(180,0,255,0)')
  hg.addColorStop(0.45,'rgba(255,0,255,0.10)')
  hg.addColorStop(0.7, 'rgba(180,0,255,0.06)')
  hg.addColorStop(1,   'rgba(100,0,180,0)')
  ctx.fillStyle = hg
  ctx.fillRect(0, 0, W, H)

  drawRoad()
  drawBuildings()
  drawSpeedPads()

  // Obstacles far-to-near
  const sortedObs = [...game.obstacles].sort((a, b) => b.wz - a.wz)
  sortedObs.forEach(drawObstacle)

  drawParticleArray(game.trailParticles)

  if (!game.dead || Math.floor(game.deathTimer * 8) % 2 === 0) {
    drawPlayer()
  }

  drawParticleArray(game.wallParticles)
  drawParticleArray(game.particles)

  if (game.speedMult >= 1.4) drawSpeedLines()

  // Score popups
  game.scorePopups.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle   = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur  = 10
    ctx.font        = 'bold 18px Orbitron, monospace'
    ctx.textAlign   = 'center'
    ctx.fillText(p.text, p.x || W/2, p.y)
    ctx.globalAlpha = 1
    ctx.shadowBlur  = 0
  })

  // Flash overlay
  if (game.flashTimer > 0 && game.flashColor) {
    ctx.fillStyle   = game.flashColor
    ctx.globalAlpha = game.flashTimer * 0.35
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }

  ctx.restore()
  drawHUD()
}

// ── HUD ───────────────────────────────────────────────────────
function drawHUD() {
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  const score = Math.floor(game.score)

  // Score — centered, high up
  ctx.shadowColor = '#CC00FF'
  ctx.shadowBlur  = 22
  ctx.fillStyle   = '#CC00FF'
  ctx.font        = 'bold 36px Orbitron, monospace'
  ctx.textAlign   = 'center'
  ctx.fillText(score.toLocaleString(), W/2, 52)

  ctx.shadowBlur  = 0
  ctx.fillStyle   = 'rgba(255,255,255,0.35)'
  ctx.font        = '13px Orbitron, monospace'
  ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`, W/2, 74)

  if (game.multiplier > 1) {
    ctx.fillStyle   = C.YELLOW
    ctx.shadowColor = C.YELLOW
    ctx.shadowBlur  = 12
    ctx.font        = 'bold 20px Orbitron, monospace'
    ctx.fillText(`x${game.multiplier} MULTI`, 20, 96)
    ctx.shadowBlur  = 0
  }

  // Speed + distance top-right
  ctx.textAlign   = 'right'
  ctx.fillStyle   = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur  = 10
  ctx.font        = '16px Orbitron, monospace'
  ctx.fillText(`${game.speedMult.toFixed(1)}x SPEED`, W - 20, 40)
  ctx.shadowBlur  = 0
  ctx.fillStyle   = 'rgba(255,255,255,0.4)'
  ctx.font        = '13px Orbitron, monospace'
  ctx.fillText(`${Math.floor(game.distance)}m`, W - 20, 62)

  // Wall ride
  if (game.wallRiding) {
    ctx.textAlign   = 'center'
    ctx.fillStyle   = C.MAGENTA
    ctx.shadowColor = C.MAGENTA
    ctx.shadowBlur  = 14
    ctx.font        = 'bold 16px Orbitron, monospace'
    ctx.fillText('WALL RIDE +25/s', W/2, H - 30)
    ctx.shadowBlur  = 0
  }

  // Player name
  if (save.playerName) {
    ctx.textAlign   = 'center'
    ctx.fillStyle   = 'rgba(0,255,65,0.4)'
    ctx.shadowBlur  = 0
    ctx.font        = '12px Orbitron, monospace'
    ctx.fillText(save.playerName, W/2, H - 14)
  }

  // Pause icon top-right
  ctx.shadowBlur   = 0
  ctx.strokeStyle  = 'rgba(255,255,255,0.3)'
  ctx.lineWidth    = 2
  ctx.strokeRect(W - 60, 10, 44, 36)
  ctx.fillStyle    = 'rgba(255,255,255,0.5)'
  ctx.fillRect(W - 52, 18, 8, 20)
  ctx.fillRect(W - 38, 18, 8, 20)

  ctx.restore()
}

// ── MENU ITEMS ────────────────────────────────────────────────
let menuItems   = []
let menuHovered = -1

function registerButton(x, y, w, h, action) {
  menuItems.push({ x, y, w, h, action })
}

function drawButton(x, y, w, h, text, highlighted, color) {
  if (highlighted === undefined) highlighted = false
  if (color       === undefined) color = C.GREEN
  ctx.save()
  if (highlighted) {
    ctx.shadowColor = color
    ctx.shadowBlur  = 30
    ctx.strokeStyle = color
    ctx.fillStyle   = hexToRgba(color, 0.18)
  } else {
    ctx.shadowBlur  = 8
    ctx.shadowColor = color
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.fillStyle   = 'rgba(255,255,255,0.05)'
  }
  ctx.lineWidth = 2
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle    = highlighted ? color : '#fff'
  ctx.font         = `bold ${Math.min(18, Math.floor(h * 0.4))}px Orbitron, monospace`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowBlur   = highlighted ? 16 : 0
  ctx.fillText(text, x + w/2, y + h/2)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── MENU ──────────────────────────────────────────────────────
let menuAnimTime = 0

function renderMenu() {
  menuItems = []
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, W, H)
  drawMenuGrid(menuAnimTime)

  ctx.save()
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'

  const titleSize = Math.min(72, W * 0.12)
  ctx.font        = `900 ${titleSize}px Orbitron, monospace`
  ctx.shadowColor = C.GREEN
  ctx.shadowBlur  = 50
  ctx.fillStyle   = C.GREEN
  ctx.fillText('NEON', W/2, H * 0.22)
  ctx.fillStyle   = C.CYAN
  ctx.shadowColor = C.CYAN
  ctx.fillText('DRIFT', W/2, H * 0.22 + titleSize * 1.0)

  ctx.font      = `400 ${Math.min(16, W * 0.025)}px Orbitron, monospace`
  ctx.shadowBlur = 0
  ctx.fillStyle  = 'rgba(255,255,255,0.4)'
  ctx.fillText('PSEUDO-3D NEON RUNNER', W/2, H * 0.22 + titleSize * 2.1)

  ctx.font        = `bold ${Math.min(18, W * 0.028)}px Orbitron, monospace`
  ctx.fillStyle   = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur  = 10
  ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`, W/2, H * 0.22 + titleSize * 2.8)
  ctx.restore()

  const btnW  = Math.min(300, W * 0.5)
  const btnH  = Math.min(52, H * 0.07)
  const btnX  = W/2 - btnW/2
  const startY = H * 0.52
  const gap    = btnH + 14

  const buttons = [
    { text: 'PLAY',        action: () => { goToNameEntry() },                    color: C.GREEN   },
    { text: 'HOW TO PLAY', action: () => { state = 'howtoplay' },                color: C.CYAN    },
    { text: 'SHOP',        action: () => { shopTab = 'ships'; state = 'shop' },  color: C.MAGENTA },
    { text: 'LEADERBOARD', action: () => { state = 'leaderboard' },              color: C.YELLOW  },
    { text: 'SETTINGS',    action: () => { state = 'settings' },                 color: C.DIM     },
  ]

  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    drawButton(bx, by, btnW, btnH, btn.text, menuHovered === i, btn.color)
    registerButton(bx, by, btnW, btnH, btn.action)
  })

  ctx.save()
  ctx.textAlign   = 'center'
  ctx.fillStyle   = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur  = 10
  ctx.font        = `bold ${Math.min(16, W * 0.025)}px Orbitron, monospace`
  ctx.fillText(`COINS: ${Math.floor(save.totalCoins).toLocaleString()}`, W/2, H - 24)
  ctx.restore()
}

// ── NAME ENTRY ────────────────────────────────────────────────
function goToNameEntry() {
  if (save.playerName) {
    startGame()
    return
  }
  initGame()
  state = 'nameentry'
  updateNameInput()
}

function renderNameEntry() {
  menuItems = []
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, W, H)
  drawMenuGrid(menuAnimTime)

  ctx.save()
  ctx.textAlign   = 'center'
  ctx.textBaseline = 'middle'
  ctx.font        = `bold ${Math.min(40, W * 0.07)}px Orbitron, monospace`
  ctx.shadowColor = C.GREEN
  ctx.shadowBlur  = 20
  ctx.fillStyle   = C.GREEN
  ctx.fillText('ENTER YOUR NAME', W/2, H * 0.28)
  ctx.restore()

  // Input box
  const bx = W * 0.2, by = H * 0.40, bw = W * 0.6, bh = 60
  ctx.save()
  ctx.shadowColor = C.GREEN
  ctx.shadowBlur  = 15
  ctx.strokeStyle = C.GREEN
  ctx.lineWidth   = 2
  ctx.strokeRect(bx, by, bw, bh)
  ctx.fillStyle   = 'rgba(0,255,65,0.05)'
  ctx.fillRect(bx, by, bw, bh)

  // Current name with cursor
  ctx.fillStyle    = C.GREEN
  ctx.font         = `bold ${Math.min(28, W * 0.05)}px Orbitron, monospace`
  ctx.shadowBlur   = 10
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  const cursor = Math.floor(Date.now() / 500) % 2 === 0 ? '|' : ''
  ctx.fillText((game.nameInput || '') + cursor, W/2, by + bh/2)
  ctx.restore()

  // PLAY button
  const playBtnW = Math.min(280, W * 0.5)
  const playBtnH = 56
  const playBtnX = W/2 - playBtnW/2
  const playBtnY = H * 0.60
  drawButton(playBtnX, playBtnY, playBtnW, playBtnH, '► PLAY', menuHovered === 0, C.GREEN)
  registerButton(playBtnX, playBtnY, playBtnW, playBtnH, () => {
    if (game.nameInput && game.nameInput.length > 0) {
      save.playerName = game.nameInput.slice(0, 12).toUpperCase()
      writeSave()
    }
    startGame()
  })

  ctx.save()
  ctx.textAlign   = 'center'
  ctx.fillStyle   = 'rgba(255,255,255,0.35)'
  ctx.font        = '14px Orbitron, monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText('Press ENTER to play  •  Type your name above', W/2, H * 0.72)
  ctx.restore()
}

// ── PAUSE ─────────────────────────────────────────────────────
function renderPause() {
  ctx.fillStyle   = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, W, H)

  menuItems = []
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.font         = `900 ${Math.min(60, W * 0.1)}px Orbitron, monospace`
  ctx.fillStyle    = C.GREEN
  ctx.shadowColor  = C.GREEN
  ctx.shadowBlur   = 40
  ctx.fillText('PAUSED', W/2, H * 0.28)
  ctx.shadowBlur   = 0
  ctx.textBaseline = 'alphabetic'

  const btnW  = Math.min(280, W * 0.45)
  const btnH  = Math.min(50, H * 0.07)
  const btnX  = W/2 - btnW/2
  const startY = H * 0.42
  const gap    = btnH + 14

  const buttons = [
    { text: 'RESUME',   action: () => { state = 'playing' } },
    { text: 'SETTINGS', action: () => { state = 'settings' } },
    { text: 'RESTART',  action: () => { startGame() } },
    { text: 'MENU',     action: () => { state = 'menu' } },
  ]

  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    drawButton(bx, by, btnW, btnH, btn.text, menuHovered === i, C.GREEN)
    registerButton(bx, by, btnW, btnH, btn.action)
  })
}

// ── GAME OVER ─────────────────────────────────────────────────
let gameOverAnimTime = 0

function renderGameOver() {
  menuItems = []
  gameOverAnimTime += 0.016

  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, W, H)
  drawMenuGrid(gameOverAnimTime)

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'

  const titleSize = Math.min(58, W * 0.09)
  ctx.font        = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle   = C.RED
  ctx.shadowColor = C.RED
  ctx.shadowBlur  = 40
  ctx.fillText('GAME OVER', W/2, H * 0.2)
  ctx.shadowBlur  = 0

  const score = Math.floor(game.score)
  const coins = Math.floor(game.coins)
  const isNew = game.newRecord

  if (isNew) {
    ctx.font        = `bold ${Math.min(22, W * 0.035)}px Orbitron, monospace`
    ctx.fillStyle   = C.GREEN
    ctx.shadowColor = C.GREEN
    ctx.shadowBlur  = 20 + 10 * Math.sin(gameOverAnimTime * 6)
    ctx.fillText('NEW RECORD! +5000 BONUS', W/2, H * 0.32)
    ctx.shadowBlur  = 0
  }

  ctx.font        = `bold ${Math.min(34, W * 0.055)}px Orbitron, monospace`
  ctx.fillStyle   = C.GREEN
  ctx.shadowColor = C.GREEN
  ctx.shadowBlur  = 18
  ctx.fillText(score.toLocaleString(), W/2, H * 0.41)

  ctx.font      = `400 ${Math.min(16, W * 0.026)}px Orbitron, monospace`
  ctx.shadowBlur = 0
  ctx.fillStyle  = 'rgba(255,255,255,0.45)'
  ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`, W/2, H * 0.50)
  ctx.fillText(`COINS EARNED: ${coins.toLocaleString()}`, W/2, H * 0.56)
  ctx.fillText(`TIME: ${game.time.toFixed(1)}s`, W/2, H * 0.62)

  const btnW  = Math.min(280, W * 0.45)
  const btnH  = Math.min(50, H * 0.07)
  const btnX  = W/2 - btnW/2
  const startY = H * 0.70
  const gap    = btnH + 14

  // Revive button (only available once per run)
  const canRevive = !game.usedRevive
  const buttons = [
    canRevive ? { text: '▶ WATCH AD — REVIVE', action: () => { triggerRevive() }, color: '#FFAA00' } : null,
    { text: 'PLAY AGAIN', action: () => { startGame() },    color: C.GREEN   },
    { text: 'MENU',       action: () => { state = 'menu' }, color: C.MAGENTA },
  ].filter(Boolean)
  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    drawButton(bx, by, btnW, btnH, btn.text, menuHovered === i, btn.color)
    registerButton(bx, by, btnW, btnH, btn.action)
  })

  ctx.textBaseline = 'alphabetic'
}

// ── SETTINGS ──────────────────────────────────────────────────
function renderSettings() {
  menuItems = []
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, W, H)
  drawMenuGrid(menuAnimTime)

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  const titleSize  = Math.min(42, W * 0.07)
  ctx.font         = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle    = C.GREEN
  ctx.shadowColor  = C.GREEN
  ctx.shadowBlur   = 30
  ctx.fillText('SETTINGS', W/2, H * 0.14)
  ctx.shadowBlur   = 0

  const panelW = Math.min(420, W * 0.7)
  const panelX = W/2 - panelW/2
  let   oy     = H * 0.25

  ctx.textAlign    = 'left'
  ctx.textBaseline = 'middle'

  function drawSlider(label, value, setFn, y) {
    ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.shadowBlur = 0
    ctx.fillText(label, panelX, y)

    const slW = panelW * 0.55
    const slX = panelX + panelW * 0.4
    const slH = 10
    const slY = y - slH/2

    ctx.fillStyle   = 'rgba(255,255,255,0.1)'
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth   = 1
    ctx.fillRect(slX, slY, slW, slH)
    ctx.strokeRect(slX, slY, slW, slH)

    ctx.fillStyle   = C.GREEN
    ctx.shadowColor = C.GREEN
    ctx.shadowBlur  = 8
    ctx.fillRect(slX, slY, slW * value, slH)
    ctx.shadowBlur  = 0

    const hx = slX + slW * value - 7
    ctx.fillStyle = '#fff'
    ctx.fillRect(hx, slY - 5, 14, 20)

    ctx.fillStyle  = 'rgba(255,255,255,0.5)'
    ctx.font       = `13px Orbitron, monospace`
    ctx.textAlign  = 'right'
    ctx.fillText(`${Math.round(value * 100)}%`, panelX + panelW, y)
    ctx.textAlign  = 'left'

    registerButton(slX, slY - 10, slW, 28, (cx, cy) => {
      const rel = Math.max(0, Math.min(1, (cx - slX) / slW))
      setFn(rel)
      writeSave()
    })
  }

  const rowH = Math.min(54, H * 0.08)
  drawSlider('MUSIC VOL', save.settings.musicVol, v => { save.settings.musicVol = v }, oy); oy += rowH
  drawSlider('SFX VOL',   save.settings.sfxVol,   v => { save.settings.sfxVol = v },   oy); oy += rowH

  ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'left'
  ctx.fillText('QUALITY', panelX, oy)
  const qOpts = ['LOW', 'MED', 'HIGH']
  const qW    = Math.min(90, panelW * 0.2)
  qOpts.forEach((q, i) => {
    const bx = panelX + panelW * 0.38 + i * (qW + 10)
    const by = oy - 18
    const hi = save.settings.quality === q
    drawButton(bx, by, qW, 36, q, hi, C.GREEN)
    registerButton(bx, by, qW, 36, () => { save.settings.quality = q; writeSave() })
  })
  oy += rowH

  ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'left'
  ctx.fillText('PARTICLES', panelX, oy)
  const pOpts = ['ON', 'OFF']
  const pW    = Math.min(90, panelW * 0.2)
  pOpts.forEach((p, i) => {
    const bx = panelX + panelW * 0.38 + i * (pW + 10)
    const by = oy - 18
    const hi = (p === 'ON') === save.settings.particles
    drawButton(bx, by, pW, 36, p, hi, C.GREEN)
    registerButton(bx, by, pW, 36, () => { save.settings.particles = (p === 'ON'); writeSave() })
  })
  oy += rowH + 10

  // Reset name
  ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'left'
  ctx.fillText('PLAYER NAME', panelX, oy)
  const nameBtn = Math.min(120, panelW * 0.28)
  const nameBX  = panelX + panelW - nameBtn
  const nameBY  = oy - 18
  drawButton(nameBX, nameBY, nameBtn, 36, 'RESET', menuHovered === menuItems.length, C.MAGENTA)
  registerButton(nameBX, nameBY, nameBtn, 36, () => {
    save.playerName = ''
    writeSave()
  })
  oy += rowH + 10

  const btnW = Math.min(220, W * 0.36)
  const btnH = Math.min(48, H * 0.07)
  const btnX = W/2 - btnW/2
  drawButton(btnX, oy, btnW, btnH, 'BACK', menuHovered === menuItems.length, C.MAGENTA)
  registerButton(btnX, oy, btnW, btnH, () => { state = 'menu' })

  ctx.textBaseline = 'alphabetic'
}

// ── SHOP ──────────────────────────────────────────────────────
let shopTab    = 'ships'
let shopScroll = 0

function renderShop() {
  menuItems = []
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, W, H)
  drawMenuGrid(menuAnimTime)

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  const titleSize  = Math.min(40, W * 0.065)
  ctx.font         = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle    = C.MAGENTA
  ctx.shadowColor  = C.MAGENTA
  ctx.shadowBlur   = 30
  ctx.fillText('SHOP', W/2, H * 0.1)
  ctx.shadowBlur   = 0

  ctx.font        = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
  ctx.fillStyle   = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur  = 10
  ctx.fillText(`COINS: ${Math.floor(save.totalCoins).toLocaleString()}`, W/2, H * 0.18)
  ctx.shadowBlur  = 0

  const tabW  = Math.min(160, W * 0.26)
  const tabH  = 42
  const tabsX = W/2 - tabW - 8
  const TABS = ['CARS','COLORS','TRAILS']
  const tabMap = { CARS:'cars', COLORS:'ships', TRAILS:'trails' }
  const totalTabW = tabW * TABS.length + 16 * (TABS.length - 1)
  TABS.forEach((tab, i) => {
    const bx       = W/2 - totalTabW/2 + i * (tabW + 16)
    const by       = H * 0.23
    const isActive = shopTab === tabMap[tab]
    drawButton(bx, by, tabW, tabH, tab, isActive, isActive ? C.GREEN : C.DIM)
    registerButton(bx, by, tabW, tabH, () => { shopTab = tabMap[tab]; shopScroll = 0 })
  })

  const items  = shopTab === 'cars' ? CARS : shopTab === 'ships' ? SKINS : TRAILS
  const panelW = Math.min(420, W * 0.7)
  const panelX = W/2 - panelW/2
  const itemH  = Math.min(60, H * 0.085)
  const startY = H * 0.32

  items.forEach((item, i) => {
    const iy    = startY + i * (itemH + 8)
    if (iy > H - 80) return

    const owned  = shopTab === 'cars'   ? save.unlockedCars.includes(item.id)
                 : shopTab === 'ships'  ? save.unlockedSkins.includes(item.id)
                 : save.unlockedTrails.includes(item.id)
    const active = shopTab === 'cars'   ? save.activeCar === item.id
                 : shopTab === 'ships'  ? save.activeSkin === item.id
                 : save.activeTrail === item.id
    const canBuy = !owned && save.totalCoins >= item.cost

    const borderCol = active ? C.GREEN : owned ? 'rgba(0,255,65,0.4)' : 'rgba(255,255,255,0.15)'
    ctx.save()
    ctx.strokeStyle = borderCol
    ctx.lineWidth   = active ? 2 : 1
    if (active) { ctx.shadowColor = C.GREEN; ctx.shadowBlur = 12 }
    ctx.fillStyle   = active ? 'rgba(0,255,65,0.06)' : 'rgba(255,255,255,0.03)'
    ctx.fillRect(panelX, iy, panelW, itemH)
    ctx.strokeRect(panelX, iy, panelW, itemH)
    ctx.shadowBlur  = 0
    ctx.restore()

    if (shopTab === 'cars') {
      ctx.fillStyle = active ? '#CC00FF' : 'rgba(180,0,255,0.4)'
      ctx.shadowColor = '#CC00FF'; ctx.shadowBlur = active ? 10 : 0
      ctx.font = `bold 14px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('CAR', panelX + 12, iy + itemH/2)
      ctx.shadowBlur = 0
    } else if (item.color && item.color !== 'rainbow') {
      ctx.fillStyle   = item.color
      ctx.shadowColor = item.color; ctx.shadowBlur = 8
      ctx.fillRect(panelX + 10, iy + itemH/2 - 10, 20, 20)
      ctx.shadowBlur = 0
    } else if (item.color === 'rainbow') {
      const grad = ctx.createLinearGradient(panelX + 10, 0, panelX + 30, 0)
      grad.addColorStop(0, '#FF0000'); grad.addColorStop(0.5, '#00FF00'); grad.addColorStop(1, '#0000FF')
      ctx.fillStyle = grad
      ctx.fillRect(panelX + 10, iy + itemH/2 - 10, 20, 20)
    }

    ctx.font         = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
    ctx.fillStyle    = active ? C.GREEN : '#fff'
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.name, panelX + 42, iy + itemH/2 - 6)
    if (item.desc) {
      ctx.font = `${Math.min(11, W * 0.018)}px Orbitron, monospace`
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fillText(item.desc, panelX + 42, iy + itemH/2 + 9)
    }

    const btnW2 = Math.min(110, panelW * 0.28)
    const btnH2 = itemH * 0.6
    const btnX2 = panelX + panelW - btnW2 - 10
    const btnY2 = iy + (itemH - btnH2) / 2

    if (active) {
      drawButton(btnX2, btnY2, btnW2, btnH2, 'EQUIPPED', true, C.GREEN)
    } else if (owned) {
      drawButton(btnX2, btnY2, btnW2, btnH2, 'EQUIP', menuHovered === menuItems.length, C.GREEN)
      registerButton(btnX2, btnY2, btnW2, btnH2, () => {
        if      (shopTab === 'cars')   save.activeCar   = item.id
        else if (shopTab === 'ships')  save.activeSkin  = item.id
        else                           save.activeTrail = item.id
        writeSave()
      })
    } else {
      const col = canBuy ? C.YELLOW : 'rgba(255,255,255,0.25)'
      drawButton(btnX2, btnY2, btnW2, btnH2, item.cost.toLocaleString(), menuHovered === menuItems.length, col)
      if (canBuy) {
        registerButton(btnX2, btnY2, btnW2, btnH2, () => {
          if (save.totalCoins >= item.cost) {
            save.totalCoins -= item.cost
            if      (shopTab === 'cars')   save.unlockedCars.push(item.id)
            else if (shopTab === 'ships')  save.unlockedSkins.push(item.id)
            else                           save.unlockedTrails.push(item.id)
            writeSave()
            sfxConfirm()
          }
        })
      }
    }
  })

  ctx.textBaseline = 'alphabetic'

  const btnW = Math.min(200, W * 0.32)
  const btnH = Math.min(46, H * 0.065)
  const btnX = W/2 - btnW/2
  const btnY = H - btnH - 14
  drawButton(btnX, btnY, btnW, btnH, 'BACK', menuHovered === menuItems.length, C.MAGENTA)
  registerButton(btnX, btnY, btnW, btnH, () => { state = 'menu' })
}

// ── LEADERBOARD ───────────────────────────────────────────────
function getLeaderboard() {
  const playerName = save.playerName || 'YOU'
  const fakes = [
    { name: 'NR1FTR',  score: Math.max(Math.floor(save.highScore * 1.8), 18200) },
    { name: 'VLTRON',  score: Math.max(Math.floor(save.highScore * 1.5), 15400) },
    { name: 'CYBRPNK', score: Math.max(Math.floor(save.highScore * 1.3), 13100) },
    { name: 'GRDRFTR', score: Math.max(Math.floor(save.highScore * 1.15), 11000) },
    { name: 'SYNTHWV', score: Math.max(Math.floor(save.highScore * 1.05), 9700)  },
    { name: 'NXDRFTR', score: Math.max(Math.floor(save.highScore * 0.95), 8200)  },
    { name: 'PWRLVL9', score: Math.max(Math.floor(save.highScore * 0.85), 6500)  },
    { name: 'LAZERX',  score: Math.max(Math.floor(save.highScore * 0.75), 5100)  },
    { name: 'NEOX99',  score: Math.max(Math.floor(save.highScore * 0.6),  3800)  },
    { name: 'GHSTRDR', score: Math.max(Math.floor(save.highScore * 0.45), 2200)  },
  ]
  const playerEntry = { name: playerName, score: save.highScore, isPlayer: true }
  const all = [...fakes, playerEntry].sort((a, b) => b.score - a.score)
  return all.slice(0, 10)
}

function renderLeaderboard() {
  menuItems = []
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, W, H)
  drawMenuGrid(menuAnimTime)

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  const titleSize  = Math.min(40, W * 0.065)
  ctx.font         = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle    = C.YELLOW
  ctx.shadowColor  = C.YELLOW
  ctx.shadowBlur   = 30
  ctx.fillText('LEADERBOARD', W/2, H * 0.1)
  ctx.shadowBlur   = 0

  const board  = getLeaderboard()
  const panelW = Math.min(440, W * 0.72)
  const panelX = W/2 - panelW/2
  const rowH   = Math.min(40, H * 0.057)
  const startY = H * 0.2

  board.forEach((entry, i) => {
    const ry       = startY + i * (rowH + 4)
    const isPlayer = entry.isPlayer

    ctx.save()
    ctx.fillStyle   = isPlayer ? 'rgba(0,255,65,0.08)' : 'rgba(255,255,255,0.03)'
    ctx.strokeStyle = isPlayer ? C.GREEN : 'rgba(255,255,255,0.1)'
    ctx.lineWidth   = isPlayer ? 2 : 1
    if (isPlayer) { ctx.shadowColor = C.GREEN; ctx.shadowBlur = 10 }
    ctx.fillRect(panelX, ry, panelW, rowH)
    ctx.strokeRect(panelX, ry, panelW, rowH)
    ctx.shadowBlur  = 0
    ctx.restore()

    const rankCol = i === 0 ? C.YELLOW : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.5)'
    ctx.font         = `bold ${Math.min(14, W * 0.022)}px Orbitron, monospace`
    ctx.fillStyle    = rankCol
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`#${i + 1}`, panelX + 10, ry + rowH/2)

    ctx.fillStyle = isPlayer ? C.GREEN : '#fff'
    ctx.fillText(entry.name, panelX + 55, ry + rowH/2)

    ctx.textAlign = 'right'
    ctx.fillStyle = isPlayer ? C.GREEN : C.YELLOW
    ctx.fillText(entry.score.toLocaleString(), panelX + panelW - 10, ry + rowH/2)
  })

  ctx.textBaseline = 'alphabetic'

  const btnW = Math.min(200, W * 0.32)
  const btnH = Math.min(46, H * 0.065)
  const btnX = W/2 - btnW/2
  const btnY = H - btnH - 14
  drawButton(btnX, btnY, btnW, btnH, 'BACK', menuHovered === menuItems.length, C.MAGENTA)
  registerButton(btnX, btnY, btnW, btnH, () => { state = 'menu' })
}

// ── HOW TO PLAY ───────────────────────────────────────────────
function renderHowToPlay() {
  menuItems = []
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, W, H)
  drawMenuGrid(menuAnimTime)

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  const titleSize  = Math.min(38, W * 0.062)
  ctx.font         = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle    = C.GREEN
  ctx.shadowColor  = C.GREEN
  ctx.shadowBlur   = 30
  ctx.fillText('HOW TO PLAY', W/2, H * 0.1)
  ctx.shadowBlur   = 0

  const lines = [
    { text: 'CONTROLS',                       col: C.CYAN,    size: Math.min(16, W * 0.026), bold: true },
    { text: 'Arrow Keys / A-D — Move',        col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'ESC / P — Pause',                col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Touch — Swipe left / right',     col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '',                                                 size: 8 },
    { text: 'SCORING',                        col: C.YELLOW,  size: Math.min(16, W * 0.026), bold: true },
    { text: '+10 pts/sec — Surviving',        col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '+25 pts/sec — Wall riding',      col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '+50+ pts — Near miss',           col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Milestones: 30s / 60s / 120s!', col: C.GREEN,   size: Math.min(14, W * 0.022) },
    { text: '',                                                 size: 8 },
    { text: 'OBSTACLES',                      col: C.RED,     size: Math.min(16, W * 0.026), bold: true },
    { text: 'Block — Static hazard',          col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Moving — Drifts side to side',   col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Rotating — Spins!',              col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Shrinking — Gets narrower',      col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Ghost — Barely visible',         col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '',                                                 size: 8 },
    { text: 'TIPS',                           col: C.MAGENTA, size: Math.min(16, W * 0.026), bold: true },
    { text: 'Chain near misses → multiplier', col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Ride walls for bonus points',    col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Speed increases over time!',     col: C.RED,     size: Math.min(14, W * 0.022) },
  ]

  let y = H * 0.19
  ctx.textAlign = 'center'
  lines.forEach(line => {
    ctx.font        = `${line.bold ? 'bold' : '400'} ${line.size || 14}px Orbitron, monospace`
    ctx.fillStyle   = line.col || '#fff'
    ctx.shadowBlur  = line.bold ? 8 : 0
    ctx.shadowColor = line.col || '#fff'
    if (line.text) ctx.fillText(line.text, W/2, y)
    y += (line.size || 14) + 8
  })
  ctx.shadowBlur   = 0
  ctx.textBaseline = 'alphabetic'

  const btnW = Math.min(240, W * 0.38)
  const btnH = Math.min(50, H * 0.07)
  const btnX = W/2 - btnW/2
  const btnY = H - btnH - 14
  drawButton(btnX, btnY, btnW, btnH, 'START GAME', menuHovered === menuItems.length, C.GREEN)
  registerButton(btnX, btnY, btnW, btnH, () => { goToNameEntry() })
}

// ── START GAME ────────────────────────────────────────────────
function startGame() {
  resize()
  initGame()
  state = 'playing'
  gameOverAnimTime = 0
  updateNameInput()
  sfxConfirm()
}

// ── FINALIZE SCORE ────────────────────────────────────────────
function finalizeScore() {
  const score = Math.floor(game.score)
  const coins = Math.floor(game.coins)
  if (score > save.highScore) {
    game.newRecord    = true
    save.highScore    = score
    save.totalCoins  += coins + 5000
    sfxRecord()
  } else {
    save.totalCoins += coins
  }
  save.gamesPlayed++
  writeSave()
}

// ── AUDIO ─────────────────────────────────────────────────────
let audioCtx = null

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function playTone(freq, duration, type, vol) {
  if (type === undefined) type = 'sine'
  if (vol  === undefined) vol  = 0.3
  if (save.settings.sfxVol === 0) return
  try {
    const ac   = getAudioCtx()
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type           = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol * save.settings.sfxVol, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    osc.start()
    osc.stop(ac.currentTime + duration)
  } catch (e) {}
}

function sfxNearMiss() {
  playTone(800, 0.15, 'sine', 0.4)
  setTimeout(() => playTone(1200, 0.1, 'sine', 0.3), 80)
}
function sfxCrash() {
  playTone(200, 0.5, 'sawtooth', 0.6)
  playTone(100, 0.4, 'square',   0.4)
}
function sfxSpeedUp() {
  playTone(600, 0.2, 'sine', 0.3)
  setTimeout(() => playTone(900, 0.15, 'sine', 0.2), 150)
}
function sfxMenuTick()  { playTone(440,  0.05, 'sine', 0.15) }
function sfxConfirm()   { playTone(880,  0.1, 'sine', 0.25); setTimeout(() => playTone(1100, 0.1, 'sine', 0.2), 80) }
function sfxRecord()    { [880, 1100, 1320, 1760].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.3), i * 80)) }

// ── NAME INPUT ELEMENT ────────────────────────────────────────
const nameInputEl = document.getElementById('nameInput')

if (nameInputEl) {
  nameInputEl.addEventListener('input', e => {
    game.nameInput = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')
    nameInputEl.value = game.nameInput
  })

  nameInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && state === 'nameentry') {
      save.playerName = (game.nameInput || 'PLAYER').slice(0, 12)
      writeSave()
      startGame()
    }
  })
}

function updateNameInput() {
  if (!nameInputEl) return
  nameInputEl.style.display = state === 'nameentry' ? 'block' : 'none'
  if (state === 'nameentry') {
    nameInputEl.value = game.nameInput || ''
    nameInputEl.focus()
  }
}

// ── INPUT ─────────────────────────────────────────────────────
const keys = { left: false, right: false }

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true
  if (e.key === 'Escape') {
    if      (state === 'playing')   { state = 'paused'; menuItems = []; updateNameInput() }
    else if (state === 'paused')    { state = 'playing'; updateNameInput() }
    else if (state === 'nameentry') { startGame() }
    else if (state !== 'menu' && state !== 'gameover') { state = 'menu'; updateNameInput() }
  }
  if (e.key === 'p' || e.key === 'P') {
    if      (state === 'playing') { state = 'paused'; menuItems = []; updateNameInput() }
    else if (state === 'paused')  { state = 'playing'; updateNameInput() }
  }
})

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false
})

// Touch controls
let touchStartX = 0

canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX
  e.preventDefault()
  if (state !== 'playing') {
    handleClick(e.touches[0].clientX, e.touches[0].clientY)
  }
}, { passive: false })

canvas.addEventListener('touchmove', e => {
  if (state === 'playing') {
    const dx = e.touches[0].clientX - touchStartX
    if (dx < -40) { keys.left = true; keys.right = false }
    else if (dx > 40) { keys.right = true; keys.left = false }
  }
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('touchend', e => {
  keys.left  = false
  keys.right = false
  touchStartX = 0
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('click', e => handleClick(e.clientX, e.clientY))
canvas.addEventListener('mousemove', e => handleMouseMove(e.clientX, e.clientY))

function handleClick(cx, cy) {
  const rect = canvas.getBoundingClientRect()
  const x = (cx - rect.left) * (W / rect.width)
  const y = (cy - rect.top)  * (H / rect.height)

  // Pause button
  if (state === 'playing') {
    if (x >= W - 62 && x <= W - 14 && y >= 8 && y <= 48) {
      state = 'paused'
      menuItems = []
      updateNameInput()
      return
    }
  }

  for (const item of menuItems) {
    if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
      if (item.action.length >= 2) {
        item.action(x, y)
      } else {
        item.action()
      }
      sfxMenuTick()
      return
    }
  }
}

function handleMouseMove(cx, cy) {
  const rect = canvas.getBoundingClientRect()
  const x = (cx - rect.left) * (W / rect.width)
  const y = (cy - rect.top)  * (H / rect.height)
  menuHovered = -1
  menuItems.forEach((item, i) => {
    if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
      menuHovered = i
    }
  })
}

// ── MAIN LOOP ─────────────────────────────────────────────────
let lastTime = 0

function gameLoop(ts) {
  const dt = Math.min((ts - (lastTime || ts)) / 1000, 0.05)
  lastTime = ts
  menuAnimTime += dt

  switch (state) {
    case 'playing':
      update(dt)
      render()
      break
    case 'nameentry':
      renderNameEntry()
      break
    case 'menu':
      renderMenu()
      break
    case 'paused':
      render()
      renderPause()
      break
    case 'gameover':
      renderGameOver()
      break
    case 'settings':
      renderSettings()
      break
    case 'shop':
      renderShop()
      break
    case 'leaderboard':
      renderLeaderboard()
      break
    case 'howtoplay':
      renderHowToPlay()
      break
  }

  requestAnimationFrame(gameLoop)
}

// ── BOOT ──────────────────────────────────────────────────────
loadSave()
resize()
initGame()
updateNameInput()
requestAnimationFrame(gameLoop)
