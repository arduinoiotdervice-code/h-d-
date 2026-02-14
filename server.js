
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

app.get("/", (_, res) => {
  res.send("Shadow Hunt Server v3.2 - Random Spawns & Flashlight Fixed");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});

/* ================= GAME CONFIG ================= */

const CONFIG = {
  TILE_SIZE: 40,
  PLAYER_RADIUS: 14,
  PLAYER_SPEED: 135, 
  FLASHLIGHT_RANGE: 400,
  FLASHLIGHT_ANGLE: Math.PI / 2.5, 
  HIDE_DURATION: 15,
  HUNT_DURATION: 120,
  LOBBY_COUNTDOWN: 10,
  MIN_PLAYERS: 3
};

const PHASES = {
  LOBBY: "lobby",
  HIDE: "hide",
  HUNT: "hunt",
  RESULT: "result"
};

const MAP_DATA = {
  tiles: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  spawnPoints: [
    { x: 180, y: 180 }, { x: 400, y: 180 }, { x: 620, y: 180 },
    { x: 180, y: 440 }, { x: 400, y: 440 }, { x: 620, y: 440 },
    { x: 180, y: 620 }, { x: 400, y: 620 }, { x: 620, y: 620 }
  ]
};

const walls = [];
for (let y = 0; y < MAP_DATA.tiles.length; y++) {
  for (let x = 0; x < MAP_DATA.tiles[y].length; x++) {
    if (MAP_DATA.tiles[y][x] === 1) {
      walls.push({ x: x * CONFIG.TILE_SIZE, y: y * CONFIG.TILE_SIZE, w: CONFIG.TILE_SIZE, h: CONFIG.TILE_SIZE });
    }
  }
}

let players = {};
let phase = PHASES.LOBBY;
let timer = 0;
let phaseInterval = null;
let lobbyCountdownInterval = null;

/* ================= HELPERS ================= */

function circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (radius * radius);
}

function checkWallCollision(x, y, radius) {
  for (const wall of walls) {
    if (circleRectCollision(x, y, radius, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function isInFlashlightCone(kx, ky, ka, tx, ty) {
  const dx = tx - kx, dy = ty - ky;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > CONFIG.FLASHLIGHT_RANGE) return false;
  const angleDiff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - ka));
  return angleDiff < (CONFIG.FLASHLIGHT_ANGLE / 2);
}

/* ================= SHUFFLE HELPER ================= */
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function getAliveHiders() {
    return Object.values(players).filter(p => p.role === 'hider' && p.isAlive);
}

/* ================= GAME FLOW ================= */

function broadcastPlayers() {
  io.emit("updatePlayers", Object.values(players));
}

function broadcastPhase() {
  io.emit("phaseChange", { phase, duration: timer });
}

function resetGame() {
  if (phaseInterval) clearInterval(phaseInterval);
  if (lobbyCountdownInterval) clearInterval(lobbyCountdownInterval);
  phaseInterval = null;
  lobbyCountdownInterval = null;
  phase = PHASES.LOBBY;
  timer = 0;
  
  Object.values(players).forEach(p => { 
    p.role = "hider"; 
    p.isAlive = true; 
    p.isReady = false;
    p.x = MAP_DATA.spawnPoints[0].x;
    p.y = MAP_DATA.spawnPoints[0].y;
  });
  
  broadcastPlayers();
  broadcastPhase();
}

function checkAndStartLobbyCountdown() {
  const playerList = Object.values(players);
  const everyoneReady = playerList.length >= CONFIG.MIN_PLAYERS && playerList.every(p => p.isReady);

  if (everyoneReady && phase === PHASES.LOBBY) {
    if (lobbyCountdownInterval) return;
    timer = CONFIG.LOBBY_COUNTDOWN;
    broadcastPhase();
    lobbyCountdownInterval = setInterval(() => {
      timer--;
      broadcastPhase();
      if (timer <= 0) {
        clearInterval(lobbyCountdownInterval);
        lobbyCountdownInterval = null;
        startHidePhase();
      }
    }, 1000);
  } else if (!everyoneReady && lobbyCountdownInterval) {
    clearInterval(lobbyCountdownInterval);
    lobbyCountdownInterval = null;
    timer = 0;
    broadcastPhase();
  }
}

function startHidePhase() {
  phase = PHASES.HIDE;
  timer = CONFIG.HIDE_DURATION;
  
  const ids = Object.keys(players);
  const killerId = ids[Math.floor(Math.random() * ids.length)];

  // Randomize Spawns
  const shuffledSpawns = shuffle([...MAP_DATA.spawnPoints]);

  ids.forEach((id, index) => {
    const spawn = shuffledSpawns[index % shuffledSpawns.length];
    players[id].role = id === killerId ? "killer" : "hider";
    players[id].isAlive = true;
    players[id].x = spawn.x;
    players[id].y = spawn.y;
    players[id].angle = 0;
  });

  broadcastPhase();
  broadcastPlayers();

  phaseInterval = setInterval(() => {
    timer--;
    broadcastPhase();
    if (timer <= 0) {
      clearInterval(phaseInterval);
      startHuntPhase();
    }
  }, 1000);
}

function startHuntPhase() {
  phase = PHASES.HUNT;
  timer = CONFIG.HUNT_DURATION;
  broadcastPhase();
  phaseInterval = setInterval(() => {
    timer--;
    broadcastPhase();
    if (timer <= 0) endGame("hiders");
  }, 1000);
}

function endGame(winner) {
  phase = PHASES.RESULT;
  if (phaseInterval) clearInterval(phaseInterval);
  io.emit("gameEnd", { winner });
  setTimeout(() => { resetGame(); }, 5000);
}

/* ================= SOCKETS ================= */

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ name }) => {
    players[socket.id] = {
      id: socket.id,
      name: name || `Survivor_${socket.id.substr(0, 4)}`,
      x: MAP_DATA.spawnPoints[0].x,
      y: MAP_DATA.spawnPoints[0].y,
      angle: 0,
      role: "hider",
      isAlive: true,
      isReady: false
    };
    socket.emit("joined", { id: socket.id, name: players[socket.id].name, players: Object.values(players) });
    broadcastPlayers();
    broadcastPhase();
  });

  socket.on("toggleReady", () => {
    if (players[socket.id] && phase === PHASES.LOBBY) {
      players[socket.id].isReady = !players[socket.id].isReady;
      broadcastPlayers();
      checkAndStartLobbyCountdown();
    }
  });

  socket.on("move", ({ x, y, angle }) => {
    const p = players[socket.id];
    if (!p || !p.isAlive || phase === PHASES.RESULT) return;
    if (phase === PHASES.HIDE && p.role === "killer") return;
    
    const clampedX = Math.max(CONFIG.PLAYER_RADIUS, Math.min(x, MAP_DATA.tiles[0].length * CONFIG.TILE_SIZE - CONFIG.PLAYER_RADIUS));
    const clampedY = Math.max(CONFIG.PLAYER_RADIUS, Math.min(y, MAP_DATA.tiles.length * CONFIG.TILE_SIZE - CONFIG.PLAYER_RADIUS));
    
    if (!checkWallCollision(clampedX, p.y, CONFIG.PLAYER_RADIUS)) p.x = clampedX;
    if (!checkWallCollision(p.x, clampedY, CONFIG.PLAYER_RADIUS)) p.y = clampedY;
    
    p.angle = angle ?? p.angle;
  });

  socket.on("attemptKill", ({ targetId }) => {
    if (phase !== PHASES.HUNT) return;
    const killer = players[socket.id], target = players[targetId];
    if (!killer || !target || killer.role !== "killer" || !target.isAlive) return;

    const dx = target.x - killer.x;
    const dy = target.y - killer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CONFIG.FLASHLIGHT_RANGE && isInFlashlightCone(killer.x, killer.y, killer.angle, target.x, target.y)) {
      target.isAlive = false;
      io.emit("playerKilled", { 
        playerId: targetId, 
        playerName: target.name,
        killerId: socket.id,
        killerName: killer.name
      });
      
      const aliveHiders = getAliveHiders();
      if (aliveHiders.length === 0) {
          endGame("killer");
      } else {
          broadcastPlayers();
      }
    }
  });

  socket.on("disconnect", () => {
    const p = players[socket.id];
    if (!p) return;
    delete players[socket.id];
    
    if (Object.keys(players).length === 0) {
      resetGame();
    } else {
      broadcastPlayers();
      if (phase === PHASES.LOBBY) {
          checkAndStartLobbyCountdown();
      } else if (phase === PHASES.HIDE || phase === PHASES.HUNT) {
        const killer = Object.values(players).find(p => p.role === "killer");
        const aliveHiders = getAliveHiders();
        if (!killer && aliveHiders.length > 0) endGame("hiders");
        else if (aliveHiders.length === 0) endGame("killer");
      }
    }
  });
});

setInterval(broadcastPlayers, 45);
