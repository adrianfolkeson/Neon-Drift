// ============================================================
//  NEON DRIFT — Complete Game
// ============================================================

// ── Color constants ──────────────────────────────────────────
const C = {
  CYAN:    '#00FFFF',
  MAGENTA: '#FF00FF',
  YELLOW:  '#FFFF00',
  RED:     '#FF0044',
  BG:      '#0A0A0F',
  GREEN:   '#00FF88',
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
window.addEventListener('resize', () => {
  resize()
})
resize()

// ── Save / Load ───────────────────────────────────────────────
const SAVE_KEY = 'neondrift_v1'
let save = {
  highScore: 0,
  totalCoins: 0,
  settings: { musicVol: 0.5, sfxVol: 0.5, quality: 'HIGH', particles: true },
  unlockedSkins:  ['blue'],
  unlockedTrails: ['none'],
  unlockedMusic:  ['neon_rush'],
  activeSkin:   'blue',
  activeTrail:  'none',
  activeMusic:  'neon_rush',
  dailyChallenge: { date: '', completed: false, best: 0 },
  gamesPlayed: 0,
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

// ── Skins & Trails ────────────────────────────────────────────
const SKINS = [
  { id: 'blue',    name: 'Neon Blue',    color: '#00FFFF', cost: 0      },
  { id: 'green',   name: 'Neon Green',   color: '#00FF88', cost: 500    },
  { id: 'gold',    name: 'Neon Gold',    color: '#FFD700', cost: 2000   },
  { id: 'purple',  name: 'Neon Purple',  color: '#CC00FF', cost: 5000   },
  { id: 'red',     name: 'Neon Red',     color: '#FF0044', cost: 10000  },
  { id: 'rainbow', name: 'Neon Rainbow', color: 'rainbow', cost: 25000  },
  { id: 'void',    name: 'Void Black',   color: '#111122', cost: 50000  },
  { id: 'ghost',   name: 'Ghost White',  color: '#EEEEFF', cost: 75000  },
]

const TRAILS = [
  { id: 'none',     name: 'None',          color: null,      cost: 0      },
  { id: 'blue',     name: 'Blue Glow',     color: '#0088FF', cost: 200    },
  { id: 'purple',   name: 'Purple Glow',   color: '#8800FF', cost: 500    },
  { id: 'fire',     name: 'Fire Trail',    color: '#FF4400', cost: 1000   },
  { id: 'star',     name: 'Star Dust',     color: '#FFFF88', cost: 2000   },
  { id: 'rainbow',  name: 'Rainbow Trail', color: 'rainbow', cost: 5000   },
  { id: 'skull',    name: 'Skull Trail',   color: '#AAAAAA', cost: 10000  },
  { id: 'electric', name: 'Electric',      color: '#88FFFF', cost: 15000  },
]

// ── State machine ─────────────────────────────────────────────
// 'menu' | 'playing' | 'paused' | 'gameover' | 'settings' | 'shop' | 'leaderboard' | 'howtoplay'
let state = 'menu'

// ── Game state ────────────────────────────────────────────────
let game = {}

function initGame() {
  game = {
    score:        0,
    coins:        0,
    time:         0,
    distance:     0,
    speedMult:    1.0,
    baseSpeed:    200,
    player: {
      x:       W / 2,
      y:       H * 0.72,
      w:       30,
      h:       48,
      vx:      0,
      targetX: W / 2,
    },
    obstacles:     [],
    particles:     [],
    scorePopups:   [],
    wallParticles: [],
    trailParticles:[],
    nextObstacleY: -200,
    obstacleSpacing: 400,
    nearMissStreak: 0,
    multiplier:   1,
    wallRiding:   false,
    wallRideTimer: 0,
    shakeX: 0, shakeY: 0,
    shakeDuration: 0,
    flashColor: null,
    flashTimer: 0,
    speedLineTimer: 0,
    milestones: { 30: false, 60: false, 120: false },
    dead:      false,
    deathTimer: 0,
    lastNearMiss: [],
    lastSpeedThreshold: 1.0,
    newRecord: false,
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
function spawnObstacle() {
  const t = game.time
  let section = t < 15 ? 'easy' : t < 45 ? 'medium' : t < 90 ? 'hard' : 'expert'
  const spacings = { easy: 400, medium: 300, hard: 200, expert: 150 }
  const baseWs   = { easy: 40,  medium: 50,  hard: 60,  expert: 70  }

  const rand = Math.random()
  let type = 'block'
  if (section !== 'easy') {
    if      (rand < 0.05) type = 'ghost'
    else if (rand < 0.10) type = 'rotating'
    else if (rand < 0.20) type = 'shrinking'
    else if (rand < 0.40) type = 'moving'
  }

  const w = baseWs[section] + Math.random() * 40
  const h = 60 + Math.random() * 60
  const trackW = W * 0.7
  const trackX = W * 0.15

  let x = trackX + Math.random() * (trackW - w)
  // Clamp so the obstacle stays inside the track
  x = Math.max(trackX, Math.min(trackX + trackW - w, x))

  game.obstacles.push({
    x, y: -h - 20, w, h, type,
    moveDir:    1,
    moveSpeed:  100 + Math.random() * 200,
    moveRange:  Math.min(80, trackW * 0.25),
    originX:    x,
    shrinkTimer: 0,
    origW:      w,
    angle:      0,
    rotSpeed:   Math.PI * (Math.random() < 0.5 ? 1 : -1),
    opacity:    type === 'ghost' ? 0.35 : 1.0,
    pulse:      0,
    nearMissed: false,
  })

  game.obstacleSpacing = spacings[section]
}

// ── Collision ─────────────────────────────────────────────────
function checkCollision(pl, o) {
  const pw = pl.w * 0.7
  const ph = pl.h * 0.7
  return (
    pl.x - pw / 2 < o.x + o.w &&
    pl.x + pw / 2 > o.x &&
    pl.y - ph / 2 < o.y + o.h &&
    pl.y + ph / 2 > o.y
  )
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
  addScorePopup(`NEAR MISS! +${bonus}`, C.YELLOW)

  for (let i = 0; i < 8; i++) spawnParticle(game.player.x, game.player.y, C.CYAN)
  game.flashColor = C.CYAN
  game.flashTimer = 0.15
  sfxNearMiss()
}

// ── Death ─────────────────────────────────────────────────────
function triggerDeath() {
  if (game.dead) return
  game.dead = true
  game.shakeDuration = 0.6
  for (let i = 0; i < 40; i++) {
    spawnParticle(game.player.x, game.player.y, Math.random() < 0.5 ? '#FF4400' : C.RED, true)
  }
  game.flashColor = C.RED
  game.flashTimer = 0.5
  sfxCrash()
}

// ── Milestones ────────────────────────────────────────────────
function triggerMilestone(sec) {
  const bonuses = { 30: 500, 60: 2000, 120: 10000 }
  const bonus = bonuses[sec]
  game.score += bonus
  game.coins += bonus
  addScorePopup(`${sec}s MILESTONE! +${bonus}`, C.GREEN)
  game.flashColor = C.GREEN
  game.flashTimer = 0.4
  sfxSpeedUp()
}

// ── Particles ─────────────────────────────────────────────────
function spawnParticle(x, y, color, explosive = false) {
  if (!save.settings.particles) return
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
  game.trailParticles.push({
    x: game.player.x + (Math.random() - 0.5) * 10,
    y: game.player.y + game.player.h / 2,
    color,
    vx: (Math.random() - 0.5) * 20,
    vy: 20 + Math.random() * 40,
    life: 0.4,
    maxLife: 0.4,
    r: 3 + Math.random() * 4,
  })
}

function spawnWallParticles(wallX) {
  if (Math.random() > 0.3) return
  game.wallParticles.push({
    x: wallX + (Math.random() - 0.5) * 10,
    y: game.player.y + (Math.random() - 0.5) * 20,
    color: C.MAGENTA,
    vx: (wallX < W / 2 ? 1 : -1) * (20 + Math.random() * 40),
    vy: (Math.random() - 0.5) * 40,
    life: 0.3,
    maxLife: 0.3,
    r: 2 + Math.random() * 3,
  })
}

function updateParticles(dt) {
  const upd = arr => arr.filter(p => {
    p.x  += p.vx * dt
    p.y  += p.vy * dt
    p.vy += 60 * dt
    p.life -= dt
    return p.life > 0
  })
  game.particles      = upd(game.particles)
  game.trailParticles = upd(game.trailParticles)
  game.wallParticles  = upd(game.wallParticles)
}

function addScorePopup(text, color) {
  game.scorePopups.push({
    text, color,
    x: game.player.x,
    y: game.player.y - 40,
    life: 1.2,
  })
}

// ── UPDATE ────────────────────────────────────────────────────
function update(dt) {
  if (game.dead) {
    game.deathTimer += dt
    updateParticles(dt)
    if (game.deathTimer > 2.5) {
      state = 'gameover'
      finalizeScore()
    }
    return
  }

  game.time     += dt
  game.distance += game.baseSpeed * game.speedMult * dt
  const prevMult   = game.speedMult
  game.speedMult   = getSpeedMult(game.time)

  // Speed-up sound cues
  const thresholds = [1.1, 1.2, 1.4, 1.6, 1.8, 2.2, 2.6]
  thresholds.forEach(th => {
    if (prevMult < th && game.speedMult >= th) sfxSpeedUp()
  })

  // Score per second
  game.score += 10 * dt * game.multiplier
  game.coins += 10 * dt

  // Track bounds
  const trackX = W * 0.15
  const trackW = W * 0.7
  const pl = game.player

  // Wall ride
  const onLeftWall  = pl.x - pl.w / 2 <= trackX + 5
  const onRightWall = pl.x + pl.w / 2 >= trackX + trackW - 5
  if (onLeftWall || onRightWall) {
    game.score += 25 * dt * game.multiplier
    game.coins += 25 * dt
    game.wallRiding = true
    game.wallRideTimer += dt
    if (save.settings.particles) {
      spawnWallParticles(onLeftWall ? trackX : trackX + trackW)
    }
  } else {
    game.wallRiding = false
    game.wallRideTimer = 0
  }

  // Player movement
  const ACCEL   = 2400
  const MAX_VX  = 800
  if (keys.left)  game.player.vx -= ACCEL * dt
  if (keys.right) game.player.vx += ACCEL * dt
  if (!keys.left && !keys.right) game.player.vx *= Math.pow(0.01, dt)
  game.player.vx = Math.max(-MAX_VX, Math.min(MAX_VX, game.player.vx))
  game.player.x += game.player.vx * dt
  game.player.x  = Math.max(trackX + pl.w / 2, Math.min(trackX + trackW - pl.w / 2, game.player.x))

  // Obstacles
  const speed = game.baseSpeed * game.speedMult
  for (let i = game.obstacles.length - 1; i >= 0; i--) {
    const o = game.obstacles[i]
    o.y    += speed * dt
    o.pulse += dt * 3

    if (o.type === 'moving') {
      o.x = o.originX + Math.sin(o.pulse * 0.7) * o.moveRange
    }
    if (o.type === 'shrinking') {
      o.shrinkTimer += dt
      o.w = Math.max(20, o.origW - (o.origW - 20) * Math.min(o.shrinkTimer / 5, 1))
    }
    if (o.type === 'rotating') {
      o.angle += o.rotSpeed * dt
    }

    // Near miss (15px margin threshold)
    if (!o.nearMissed && o.y > pl.y - pl.h / 2 - 20 && o.y < pl.y + pl.h / 2 + 20) {
      const distLeft  = Math.abs(pl.x - pl.w / 2 - (o.x + o.w))
      const distRight = Math.abs(o.x - (pl.x + pl.w / 2))
      const margin = Math.min(distLeft, distRight)
      if (margin >= 0 && margin < 15 && !checkCollision(pl, o)) {
        o.nearMissed = true
        triggerNearMiss()
      }
    }

    // Collision
    if (!game.dead && checkCollision(pl, o)) {
      triggerDeath()
      return
    }

    if (o.y > H + 100) game.obstacles.splice(i, 1)
  }

  // Spawn next obstacle
  const minY = game.obstacles.length
    ? Math.min(...game.obstacles.map(o => o.y))
    : Infinity
  if (minY > -game.obstacleSpacing + speed * dt) {
    spawnObstacle()
  }

  // Trail particles
  if (save.settings.particles && save.activeTrail !== 'none') {
    spawnTrailParticle()
  }

  updateParticles(dt)

  // Score popups
  game.scorePopups = game.scorePopups.filter(p => {
    p.y   -= 60 * dt
    p.life -= dt
    return p.life > 0
  })

  // Screen shake
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

  // Milestones
  if (!game.milestones[30]  && game.time >= 30)  { game.milestones[30]  = true; triggerMilestone(30)  }
  if (!game.milestones[60]  && game.time >= 60)  { game.milestones[60]  = true; triggerMilestone(60)  }
  if (!game.milestones[120] && game.time >= 120) { game.milestones[120] = true; triggerMilestone(120) }
}

// ── RENDER ────────────────────────────────────────────────────
function render() {
  ctx.save()
  ctx.translate(game.shakeX, game.shakeY)

  // Background
  ctx.fillStyle = C.BG
  ctx.fillRect(-10, -10, W + 20, H + 20)

  drawGrid()
  drawTrack()

  drawParticleArray(game.trailParticles)
  game.obstacles.forEach(drawObstacle)

  // Player flashes on death
  if (!game.dead || Math.floor(game.deathTimer * 10) % 2 === 0) {
    drawPlayer()
  }

  drawParticleArray(game.wallParticles)
  drawParticleArray(game.particles)

  if (game.speedMult >= 1.4) drawSpeedLines()

  // Score popups
  game.scorePopups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life)
    ctx.fillStyle   = p.color
    ctx.font        = 'bold 18px Orbitron, monospace'
    ctx.textAlign   = 'center'
    ctx.shadowColor = p.color
    ctx.shadowBlur  = 10
    ctx.fillText(p.text, p.x, p.y)
    ctx.globalAlpha = 1
    ctx.shadowBlur  = 0
  })

  // Flash overlay
  if (game.flashTimer > 0 && game.flashColor) {
    ctx.fillStyle   = game.flashColor
    ctx.globalAlpha = game.flashTimer * 0.4
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }

  ctx.restore()
  drawHUD()
}

// ── Draw helpers ──────────────────────────────────────────────
function drawGrid() {
  ctx.strokeStyle = 'rgba(255,0,255,0.07)'
  ctx.lineWidth   = 1
  const scroll = (game.distance * 0.5) % 60
  for (let y = -scroll; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
}

function drawMenuGrid(time) {
  ctx.strokeStyle = 'rgba(255,0,255,0.07)'
  ctx.lineWidth   = 1
  const scroll = (time * 80) % 60
  for (let y = -scroll; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
}

function drawTrack() {
  const trackX = W * 0.15
  const trackW = W * 0.7
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(trackX, 0, trackW, H)
  drawNeonLine(trackX,          0, trackX,          H, C.MAGENTA, 3)
  drawNeonLine(trackX + trackW, 0, trackX + trackW, H, C.MAGENTA, 3)
}

function drawNeonLine(x1, y1, x2, y2, color, width) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur  = 20
  ctx.strokeStyle = color
  ctx.lineWidth   = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()
}

function drawNeonRect(x, y, w, h, color, alpha) {
  if (alpha === undefined) alpha = 1
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowColor = color
  ctx.shadowBlur  = 24
  ctx.strokeStyle = color
  ctx.lineWidth   = 2
  ctx.strokeRect(x, y, w, h)
  ctx.globalAlpha = alpha * 0.15
  ctx.fillStyle   = color
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = alpha
  ctx.shadowBlur  = 0
  ctx.restore()
}

function drawPlayer() {
  const skin = SKINS.find(s => s.id === save.activeSkin) || SKINS[0]
  const color = skin.color === 'rainbow'
    ? `hsl(${(Date.now() / 5) % 360},100%,60%)`
    : skin.color
  const { x, y, w, h } = game.player

  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur  = 30
  ctx.fillStyle   = color

  ctx.beginPath()
  ctx.moveTo(x,          y - h / 2)
  ctx.lineTo(x + w / 2,  y)
  ctx.lineTo(x + w / 3,  y + h / 2)
  ctx.lineTo(x,          y + h / 3)
  ctx.lineTo(x - w / 3,  y + h / 2)
  ctx.lineTo(x - w / 2,  y)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#fff'
  ctx.lineWidth   = 1.5
  ctx.globalAlpha = 0.6
  ctx.stroke()
  ctx.restore()
}

function drawObstacle(o) {
  const alpha = o.opacity
  ctx.save()
  if (o.type === 'rotating') {
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2)
    ctx.rotate(o.angle)
    ctx.translate(-o.w / 2, -o.h / 2)
    drawNeonRect(0, 0, o.w, o.h, C.RED, alpha)
  } else {
    ctx.translate(o.x, o.y)
    const col = o.type === 'ghost' ? '#FF0088' : C.RED
    drawNeonRect(0, 0, o.w, o.h, col, alpha)
  }
  ctx.restore()
}

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

function drawSpeedLines() {
  const intensity = Math.min(1, (game.speedMult - 1.4) / 1.6)
  ctx.save()
  ctx.globalAlpha = 0.12 * intensity
  ctx.strokeStyle = '#fff'
  ctx.lineWidth   = 1
  for (let i = 0; i < 12; i++) {
    const x   = Math.random() * W
    const len = 40 + Math.random() * 80
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, len)
    ctx.stroke()
  }
  ctx.restore()
}

// ── HUD ───────────────────────────────────────────────────────
function drawHUD() {
  ctx.save()
  const score = Math.floor(game.score)
  const best  = save.highScore

  // Score
  ctx.shadowColor = C.CYAN
  ctx.shadowBlur  = 16
  ctx.fillStyle   = C.CYAN
  ctx.font        = 'bold 28px Orbitron, monospace'
  ctx.textAlign   = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(score.toLocaleString(), 20, 48)

  ctx.shadowBlur  = 0
  ctx.fillStyle   = 'rgba(255,255,255,0.4)'
  ctx.font        = '14px Orbitron, monospace'
  ctx.fillText(`BEST: ${best.toLocaleString()}`, 20, 72)

  if (game.multiplier > 1) {
    ctx.fillStyle   = C.YELLOW
    ctx.shadowColor = C.YELLOW
    ctx.shadowBlur  = 12
    ctx.font        = 'bold 20px Orbitron, monospace'
    ctx.fillText(`x${game.multiplier} MULTI`, 20, 96)
  }

  // Speed + distance (top right)
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
    ctx.fillText('WALL RIDE +25/s', W / 2, H - 30)
  }

  // Pause button (top right)
  ctx.shadowBlur   = 0
  ctx.strokeStyle  = 'rgba(255,255,255,0.3)'
  ctx.lineWidth    = 2
  ctx.strokeRect(W - 60, 10, 44, 36)
  ctx.fillStyle    = 'rgba(255,255,255,0.5)'
  ctx.fillRect(W - 52, 18, 8, 20)
  ctx.fillRect(W - 38, 18, 8, 20)

  ctx.restore()
}

// ── Menu items (click tracking) ───────────────────────────────
let menuItems  = []
let menuHovered = -1

function registerButton(x, y, w, h, action) {
  menuItems.push({ x, y, w, h, action })
}

function drawButton(x, y, w, h, text, highlighted, color) {
  if (highlighted === undefined) highlighted = false
  if (color      === undefined) color       = C.CYAN
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
  ctx.fillStyle  = highlighted ? color : '#fff'
  ctx.font       = `bold ${Math.min(18, Math.floor(h * 0.4))}px Orbitron, monospace`
  ctx.textAlign  = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowBlur = highlighted ? 16 : 0
  ctx.fillText(text, x + w / 2, y + h / 2)
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

  // Title glow
  ctx.save()
  ctx.textAlign   = 'center'
  ctx.textBaseline = 'middle'

  const titleSize = Math.min(72, W * 0.12)
  ctx.font        = `900 ${titleSize}px Orbitron, monospace`
  ctx.shadowColor = C.CYAN
  ctx.shadowBlur  = 50
  ctx.fillStyle   = C.CYAN
  ctx.fillText('NEON', W / 2, H * 0.22)
  ctx.fillStyle   = C.MAGENTA
  ctx.shadowColor = C.MAGENTA
  ctx.fillText('DRIFT', W / 2, H * 0.22 + titleSize * 1.0)

  // Subtitle
  ctx.font        = `400 ${Math.min(16, W * 0.025)}px Orbitron, monospace`
  ctx.shadowBlur  = 0
  ctx.fillStyle   = 'rgba(255,255,255,0.4)'
  ctx.fillText('ENDLESS CYBERPUNK RUNNER', W / 2, H * 0.22 + titleSize * 2.1)

  // Best score
  ctx.font        = `bold ${Math.min(18, W * 0.028)}px Orbitron, monospace`
  ctx.fillStyle   = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur  = 10
  ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`, W / 2, H * 0.22 + titleSize * 2.8)
  ctx.restore()

  // Buttons
  const btnW = Math.min(300, W * 0.5)
  const btnH = Math.min(52, H * 0.07)
  const btnX = W / 2 - btnW / 2
  const startY = H * 0.52
  const gap    = btnH + 14

  const buttons = [
    { text: 'PLAY',         action: () => { startGame() },                    color: C.CYAN    },
    { text: 'HOW TO PLAY',  action: () => { state = 'howtoplay' },            color: C.GREEN   },
    { text: 'SHOP',         action: () => { shopTab = 'ships'; state = 'shop' }, color: C.MAGENTA },
    { text: 'LEADERBOARD',  action: () => { state = 'leaderboard' },          color: C.YELLOW  },
    { text: 'SETTINGS',     action: () => { state = 'settings' },             color: C.DIM     },
  ]

  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    const hi  = menuHovered === i
    drawButton(bx, by, btnW, btnH, btn.text, hi, btn.color)
    registerButton(bx, by, btnW, btnH, btn.action)
  })

  // Coins display bottom
  ctx.save()
  ctx.textAlign   = 'center'
  ctx.fillStyle   = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur  = 10
  ctx.font        = `bold ${Math.min(16, W * 0.025)}px Orbitron, monospace`
  ctx.fillText(`COINS: ${Math.floor(save.totalCoins).toLocaleString()}`, W / 2, H - 24)
  ctx.restore()
}

// ── PAUSE ─────────────────────────────────────────────────────
function renderPause() {
  // Dimmed overlay
  ctx.fillStyle   = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, W, H)

  menuItems = []
  ctx.textAlign   = 'center'
  ctx.textBaseline = 'middle'
  ctx.font        = `900 ${Math.min(60, W * 0.1)}px Orbitron, monospace`
  ctx.fillStyle   = C.CYAN
  ctx.shadowColor = C.CYAN
  ctx.shadowBlur  = 40
  ctx.fillText('PAUSED', W / 2, H * 0.28)
  ctx.shadowBlur  = 0
  ctx.textBaseline = 'alphabetic'

  const btnW = Math.min(280, W * 0.45)
  const btnH = Math.min(50, H * 0.07)
  const btnX = W / 2 - btnW / 2
  const startY = H * 0.42
  const gap    = btnH + 14

  const buttons = [
    { text: 'RESUME',   action: () => { state = 'playing' }                           },
    { text: 'SETTINGS', action: () => { state = 'settings' }                          },
    { text: 'RESTART',  action: () => { startGame() }                                 },
    { text: 'MENU',     action: () => { state = 'menu' }                              },
  ]

  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    const hi  = menuHovered === i
    drawButton(bx, by, btnW, btnH, btn.text, hi)
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

  ctx.textAlign   = 'center'
  ctx.textBaseline = 'middle'

  // Title
  const titleSize = Math.min(58, W * 0.09)
  ctx.font        = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle   = C.RED
  ctx.shadowColor = C.RED
  ctx.shadowBlur  = 40
  ctx.fillText('GAME OVER', W / 2, H * 0.2)
  ctx.shadowBlur  = 0

  // Score
  const score = Math.floor(game.score)
  const coins = Math.floor(game.coins)
  const isNew = game.newRecord

  if (isNew) {
    ctx.font        = `bold ${Math.min(22, W * 0.035)}px Orbitron, monospace`
    ctx.fillStyle   = C.GREEN
    ctx.shadowColor = C.GREEN
    ctx.shadowBlur  = 20 + 10 * Math.sin(gameOverAnimTime * 6)
    ctx.fillText('NEW RECORD! +5000 BONUS', W / 2, H * 0.32)
    ctx.shadowBlur  = 0
  }

  ctx.font        = `bold ${Math.min(34, W * 0.055)}px Orbitron, monospace`
  ctx.fillStyle   = C.CYAN
  ctx.shadowColor = C.CYAN
  ctx.shadowBlur  = 18
  ctx.fillText(score.toLocaleString(), W / 2, H * 0.41)

  ctx.font        = `400 ${Math.min(16, W * 0.026)}px Orbitron, monospace`
  ctx.shadowBlur  = 0
  ctx.fillStyle   = 'rgba(255,255,255,0.45)'
  ctx.fillText(`BEST: ${save.highScore.toLocaleString()}`, W / 2, H * 0.50)
  ctx.fillText(`COINS EARNED: ${coins.toLocaleString()}`, W / 2, H * 0.56)
  ctx.fillText(`TIME: ${game.time.toFixed(1)}s`, W / 2, H * 0.62)

  const btnW = Math.min(280, W * 0.45)
  const btnH = Math.min(50, H * 0.07)
  const btnX = W / 2 - btnW / 2
  const startY = H * 0.70
  const gap    = btnH + 14

  const buttons = [
    { text: 'PLAY AGAIN', action: () => { startGame() },       color: C.CYAN    },
    { text: 'MENU',       action: () => { state = 'menu' },    color: C.MAGENTA },
  ]
  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    const hi  = menuHovered === i
    drawButton(bx, by, btnW, btnH, btn.text, hi, btn.color)
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

  ctx.textAlign   = 'center'
  ctx.textBaseline = 'middle'
  const titleSize = Math.min(42, W * 0.07)
  ctx.font        = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle   = C.CYAN
  ctx.shadowColor = C.CYAN
  ctx.shadowBlur  = 30
  ctx.fillText('SETTINGS', W / 2, H * 0.14)
  ctx.shadowBlur  = 0

  const panelW = Math.min(420, W * 0.7)
  const panelX = W / 2 - panelW / 2
  let   oy     = H * 0.25

  ctx.textAlign   = 'left'
  ctx.textBaseline = 'middle'

  // Helper to draw a setting row
  function drawSlider(label, value, setFn, y) {
    ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.shadowBlur = 0
    ctx.fillText(label, panelX, y)

    const slW = panelW * 0.55
    const slX = panelX + panelW * 0.4
    const slH = 10
    const slY = y - slH / 2

    // Track
    ctx.fillStyle   = 'rgba(255,255,255,0.1)'
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth   = 1
    ctx.fillRect(slX, slY, slW, slH)
    ctx.strokeRect(slX, slY, slW, slH)

    // Fill
    ctx.fillStyle   = C.CYAN
    ctx.shadowColor = C.CYAN
    ctx.shadowBlur  = 8
    ctx.fillRect(slX, slY, slW * value, slH)
    ctx.shadowBlur  = 0

    // Handle
    const hx = slX + slW * value - 7
    ctx.fillStyle   = '#fff'
    ctx.fillRect(hx, slY - 5, 14, 20)

    // Percentage
    ctx.fillStyle   = 'rgba(255,255,255,0.5)'
    ctx.font        = `13px Orbitron, monospace`
    ctx.textAlign   = 'right'
    ctx.fillText(`${Math.round(value * 100)}%`, panelX + panelW, y)
    ctx.textAlign   = 'left'

    // Click area for slider
    registerButton(slX, slY - 10, slW, 28, (cx, cy) => {
      const rel = Math.max(0, Math.min(1, (cx - slX) / slW))
      setFn(rel)
      writeSave()
    })
  }

  const rowH = Math.min(54, H * 0.08)

  drawSlider('MUSIC VOL',  save.settings.musicVol, v => { save.settings.musicVol = v }, oy); oy += rowH
  drawSlider('SFX VOL',    save.settings.sfxVol,   v => { save.settings.sfxVol   = v }, oy); oy += rowH

  // Quality toggle
  ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'left'
  ctx.fillText('QUALITY', panelX, oy)
  const qOpts = ['LOW', 'MED', 'HIGH']
  const qW    = Math.min(90, panelW * 0.2)
  qOpts.forEach((q, i) => {
    const bx = panelX + panelW * 0.38 + i * (qW + 10)
    const by = oy - 18
    const hi  = save.settings.quality === q
    drawButton(bx, by, qW, 36, q, hi, C.CYAN)
    registerButton(bx, by, qW, 36, () => { save.settings.quality = q; writeSave() })
  })
  oy += rowH

  // Particles toggle
  ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'left'
  ctx.fillText('PARTICLES', panelX, oy)
  const pOpts = ['ON', 'OFF']
  const pW    = Math.min(90, panelW * 0.2)
  pOpts.forEach((p, i) => {
    const bx = panelX + panelW * 0.38 + i * (pW + 10)
    const by = oy - 18
    const hi  = (p === 'ON') === save.settings.particles
    drawButton(bx, by, pW, 36, p, hi, C.CYAN)
    registerButton(bx, by, pW, 36, () => { save.settings.particles = (p === 'ON'); writeSave() })
  })
  oy += rowH + 10

  // Back
  const btnW = Math.min(220, W * 0.36)
  const btnH = Math.min(48, H * 0.07)
  const btnX = W / 2 - btnW / 2
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

  ctx.textAlign   = 'center'
  ctx.textBaseline = 'middle'
  const titleSize = Math.min(40, W * 0.065)
  ctx.font        = `900 ${titleSize}px Orbitron, monospace`
  ctx.fillStyle   = C.MAGENTA
  ctx.shadowColor = C.MAGENTA
  ctx.shadowBlur  = 30
  ctx.fillText('SHOP', W / 2, H * 0.1)
  ctx.shadowBlur  = 0

  // Coins display
  ctx.font      = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
  ctx.fillStyle = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur  = 10
  ctx.fillText(`COINS: ${Math.floor(save.totalCoins).toLocaleString()}`, W / 2, H * 0.18)
  ctx.shadowBlur = 0

  // Tabs
  const tabW = Math.min(160, W * 0.26)
  const tabH = 42
  const tabsX = W / 2 - tabW - 8
  ;['SHIPS', 'TRAILS'].forEach((tab, i) => {
    const bx = tabsX + i * (tabW + 16)
    const by = H * 0.23
    const isActive = (tab === 'SHIPS' && shopTab === 'ships') || (tab === 'TRAILS' && shopTab === 'trails')
    drawButton(bx, by, tabW, tabH, tab, isActive, isActive ? C.CYAN : C.DIM)
    registerButton(bx, by, tabW, tabH, () => { shopTab = tab === 'SHIPS' ? 'ships' : 'trails'; shopScroll = 0 })
  })

  // Items
  const items = shopTab === 'ships' ? SKINS : TRAILS
  const panelW = Math.min(420, W * 0.7)
  const panelX = W / 2 - panelW / 2
  const itemH  = Math.min(60, H * 0.085)
  const startY = H * 0.32

  items.forEach((item, i) => {
    const iy      = startY + i * (itemH + 8)
    if (iy > H - 80) return

    const owned   = shopTab === 'ships'
      ? save.unlockedSkins.includes(item.id)
      : save.unlockedTrails.includes(item.id)
    const active  = shopTab === 'ships'
      ? save.activeSkin === item.id
      : save.activeTrail === item.id
    const canBuy  = !owned && save.totalCoins >= item.cost

    // Row background
    const borderCol = active ? C.CYAN : owned ? C.GREEN : 'rgba(255,255,255,0.15)'
    ctx.save()
    ctx.strokeStyle = borderCol
    ctx.lineWidth   = active ? 2 : 1
    if (active) { ctx.shadowColor = C.CYAN; ctx.shadowBlur = 12 }
    ctx.fillStyle   = active ? 'rgba(0,255,255,0.06)' : 'rgba(255,255,255,0.03)'
    ctx.fillRect(panelX, iy, panelW, itemH)
    ctx.strokeRect(panelX, iy, panelW, itemH)
    ctx.shadowBlur  = 0
    ctx.restore()

    // Color swatch
    if (item.color && item.color !== 'rainbow') {
      ctx.fillStyle   = item.color
      ctx.shadowColor = item.color
      ctx.shadowBlur  = 8
      ctx.fillRect(panelX + 10, iy + itemH / 2 - 10, 20, 20)
      ctx.shadowBlur  = 0
    } else if (item.color === 'rainbow') {
      const grad = ctx.createLinearGradient(panelX + 10, 0, panelX + 30, 0)
      grad.addColorStop(0,   '#FF0000')
      grad.addColorStop(0.5, '#00FF00')
      grad.addColorStop(1,   '#0000FF')
      ctx.fillStyle = grad
      ctx.fillRect(panelX + 10, iy + itemH / 2 - 10, 20, 20)
    }

    // Name
    ctx.font        = `bold ${Math.min(15, W * 0.024)}px Orbitron, monospace`
    ctx.fillStyle   = active ? C.CYAN : '#fff'
    ctx.textAlign   = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.name, panelX + 40, iy + itemH / 2)

    // Status / Buy button
    const btnW2 = Math.min(110, panelW * 0.28)
    const btnH2 = itemH * 0.6
    const btnX2 = panelX + panelW - btnW2 - 10
    const btnY2 = iy + (itemH - btnH2) / 2

    if (active) {
      drawButton(btnX2, btnY2, btnW2, btnH2, 'EQUIPPED', true, C.CYAN)
    } else if (owned) {
      drawButton(btnX2, btnY2, btnW2, btnH2, 'EQUIP', menuHovered === menuItems.length, C.GREEN)
      registerButton(btnX2, btnY2, btnW2, btnH2, () => {
        if (shopTab === 'ships') save.activeSkin  = item.id
        else                     save.activeTrail = item.id
        writeSave()
      })
    } else {
      const col = canBuy ? C.YELLOW : 'rgba(255,255,255,0.25)'
      drawButton(btnX2, btnY2, btnW2, btnH2, item.cost.toLocaleString(), menuHovered === menuItems.length, col)
      if (canBuy) {
        registerButton(btnX2, btnY2, btnW2, btnH2, () => {
          if (save.totalCoins >= item.cost) {
            save.totalCoins -= item.cost
            if (shopTab === 'ships') save.unlockedSkins.push(item.id)
            else                     save.unlockedTrails.push(item.id)
            writeSave()
            sfxConfirm()
          }
        })
      }
    }
  })

  ctx.textBaseline = 'alphabetic'

  // Back button
  const btnW = Math.min(200, W * 0.32)
  const btnH = Math.min(46, H * 0.065)
  const btnX = W / 2 - btnW / 2
  const btnY = H - btnH - 14
  const hiIdx = menuItems.length
  drawButton(btnX, btnY, btnW, btnH, 'BACK', menuHovered === hiIdx, C.MAGENTA)
  registerButton(btnX, btnY, btnW, btnH, () => { state = 'menu' })
}

// ── LEADERBOARD ───────────────────────────────────────────────
function getLeaderboard() {
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
  const playerEntry = { name: 'YOU', score: save.highScore, isPlayer: true }
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
  ctx.fillText('LEADERBOARD', W / 2, H * 0.1)
  ctx.shadowBlur   = 0

  const board  = getLeaderboard()
  const panelW = Math.min(440, W * 0.72)
  const panelX = W / 2 - panelW / 2
  const rowH   = Math.min(40, H * 0.057)
  const startY = H * 0.2

  board.forEach((entry, i) => {
    const ry = startY + i * (rowH + 4)
    const isPlayer = entry.isPlayer

    ctx.save()
    ctx.fillStyle   = isPlayer ? 'rgba(0,255,255,0.08)' : 'rgba(255,255,255,0.03)'
    ctx.strokeStyle = isPlayer ? C.CYAN : 'rgba(255,255,255,0.1)'
    ctx.lineWidth   = isPlayer ? 2 : 1
    if (isPlayer) { ctx.shadowColor = C.CYAN; ctx.shadowBlur = 10 }
    ctx.fillRect(panelX, ry, panelW, rowH)
    ctx.strokeRect(panelX, ry, panelW, rowH)
    ctx.shadowBlur  = 0
    ctx.restore()

    const rankCol = i === 0 ? C.YELLOW : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.5)'
    ctx.font        = `bold ${Math.min(14, W * 0.022)}px Orbitron, monospace`
    ctx.fillStyle   = rankCol
    ctx.textAlign   = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`#${i + 1}`, panelX + 10, ry + rowH / 2)

    ctx.fillStyle = isPlayer ? C.CYAN : '#fff'
    ctx.fillText(entry.name, panelX + 55, ry + rowH / 2)

    ctx.textAlign = 'right'
    ctx.fillStyle = isPlayer ? C.CYAN : C.YELLOW
    ctx.fillText(entry.score.toLocaleString(), panelX + panelW - 10, ry + rowH / 2)
  })

  ctx.textBaseline = 'alphabetic'

  const btnW = Math.min(200, W * 0.32)
  const btnH = Math.min(46, H * 0.065)
  const btnX = W / 2 - btnW / 2
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
  ctx.fillText('HOW TO PLAY', W / 2, H * 0.1)
  ctx.shadowBlur   = 0

  const lines = [
    { text: 'CONTROLS',                     col: C.CYAN,    size: Math.min(16, W * 0.026), bold: true },
    { text: 'Arrow Keys / A-D — Move ship', col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'ESC — Pause game',             col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Touch — Swipe left / right',   col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '',                                               size: 8 },
    { text: 'SCORING',                      col: C.YELLOW,  size: Math.min(16, W * 0.026), bold: true },
    { text: '+10 pts/sec — Surviving',      col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '+25 pts/sec — Wall riding',    col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '+50+ pts — Near miss',         col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Milestones: 30s / 60s / 120s bonus!', col: C.GREEN, size: Math.min(14, W * 0.022) },
    { text: '',                                               size: 8 },
    { text: 'OBSTACLES',                    col: C.RED,     size: Math.min(16, W * 0.026), bold: true },
    { text: 'Moving — Drifts side to side', col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Rotating — Spins!',            col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Shrinking — Gets smaller',     col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Ghost — Barely visible',       col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: '',                                               size: 8 },
    { text: 'TIPS',                         col: C.MAGENTA, size: Math.min(16, W * 0.026), bold: true },
    { text: 'Chain near misses → multiplier', col: '#fff',  size: Math.min(14, W * 0.022) },
    { text: 'Ride walls for bonus points',  col: '#fff',    size: Math.min(14, W * 0.022) },
    { text: 'Speed increases over time!',   col: C.RED,     size: Math.min(14, W * 0.022) },
  ]

  let y = H * 0.19
  ctx.textAlign = 'center'
  lines.forEach(line => {
    ctx.font        = `${line.bold ? 'bold' : '400'} ${line.size || 14}px Orbitron, monospace`
    ctx.fillStyle   = line.col || '#fff'
    ctx.shadowBlur  = line.bold ? 8 : 0
    ctx.shadowColor = line.col || '#fff'
    if (line.text) ctx.fillText(line.text, W / 2, y)
    y += (line.size || 14) + 8
  })
  ctx.shadowBlur   = 0
  ctx.textBaseline = 'alphabetic'

  const btnW = Math.min(240, W * 0.38)
  const btnH = Math.min(50, H * 0.07)
  const btnX = W / 2 - btnW / 2
  const btnY = H - btnH - 14
  drawButton(btnX, btnY, btnW, btnH, 'START GAME', menuHovered === menuItems.length, C.GREEN)
  registerButton(btnX, btnY, btnW, btnH, () => { startGame() })
}

// ── START GAME ────────────────────────────────────────────────
function startGame() {
  resize()
  initGame()
  state = 'playing'
  gameOverAnimTime = 0
  sfxConfirm()
}

// ── FINALIZE ──────────────────────────────────────────────────
function finalizeScore() {
  const score = Math.floor(game.score)
  const coins = Math.floor(game.coins)
  if (score > save.highScore) {
    game.newRecord   = true
    save.highScore   = score
    save.totalCoins += coins + 5000
    sfxRecord()
  } else {
    save.totalCoins += coins
  }
  save.gamesPlayed++
  writeSave()
}

// ── AUDIO (Web Audio API) ─────────────────────────────────────
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
    osc.type          = type
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
function sfxConfirm()   { playTone(880,  0.1,  'sine', 0.25); setTimeout(() => playTone(1100, 0.1, 'sine', 0.2), 80) }
function sfxRecord()    { [880, 1100, 1320, 1760].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.3), i * 80)) }

// ── INPUT ─────────────────────────────────────────────────────
const keys = { left: false, right: false }

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true
  if (e.key === 'Escape') {
    if      (state === 'playing') { state = 'paused'; menuItems = [] }
    else if (state === 'paused')  { state = 'playing' }
    else if (state !== 'menu' && state !== 'gameover') state = 'menu'
  }
  if (e.key === 'p' || e.key === 'P') {
    if (state === 'playing') { state = 'paused'; menuItems = [] }
    else if (state === 'paused') state = 'playing'
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
  // Tap clicks menus when not playing
  if (state !== 'playing') {
    handleClick(e.touches[0].clientX, e.touches[0].clientY)
  }
}, { passive: false })

canvas.addEventListener('touchmove', e => {
  if (state === 'playing') {
    const dx = e.touches[0].clientX - touchStartX
    keys.left  = dx < -20
    keys.right = dx > 20
  }
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('touchend', e => {
  keys.left  = false
  keys.right = false
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('click', e => handleClick(e.clientX, e.clientY))
canvas.addEventListener('mousemove', e => handleMouseMove(e.clientX, e.clientY))

function handleClick(cx, cy) {
  const rect = canvas.getBoundingClientRect()
  const x = (cx - rect.left) * (W / rect.width)
  const y = (cy - rect.top)  * (H / rect.height)

  // Pause button hit area (playing state)
  if (state === 'playing') {
    if (x >= W - 62 && x <= W - 14 && y >= 8 && y <= 48) {
      state = 'paused'
      menuItems = []
      return
    }
  }

  // Settings sliders pass (cx, cy) — use canvas coords
  for (const item of menuItems) {
    if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
      // Sliders receive canvas x,y; buttons just trigger
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

// Boot
loadSave()
resize()
requestAnimationFrame(gameLoop)
