
import React, { useRef, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player, Wall } from '../types';
import { CONFIG, MAP_DATA } from '../constants';
import HUD from './HUD';

interface GameProps {
  socket: Socket;
  gameState: GameState;
}

interface VisualEffect {
  id: string;
  type: 'tracer' | 'blood';
  x: number;
  y: number;
  tx?: number;
  ty?: number;
  startTime: number;
  duration: number;
  particles?: { dx: number; dy: number; size: number; color: string }[];
}

const KILL_SOUND_URL = "https://cdn.freesound.org/previews/240/240156_4243673-lq.mp3";
const BGM_URL = "https://cdn.pixabay.com/download/audio/2022/02/10/audio_5157a53f0f.mp3"; // Dark ambient
const START_SFX_URL = "https://cdn.pixabay.com/download/audio/2021/08/04/audio_c89e13d11b.mp3";

const Game: React.FC<GameProps> = ({ socket, gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wallsRef = useRef<Wall[]>([]);
  const lastUpdateRef = useRef<number>(performance.now());
  const localPosRef = useRef({ x: 0, y: 0, angle: 0 });
  const lastSentPosRef = useRef({ x: 0, y: 0, angle: 0 });
  const effectsRef = useRef<VisualEffect[]>([]);
  const killSoundRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const startSfxRef = useRef<HTMLAudioElement | null>(null);
  
  // Mobile Controls - Dual Joysticks
  const moveJoystickRef = useRef<{ active: boolean, id: number | null, startX: number, startY: number, curX: number, curY: number }>({ active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 });
  const lookJoystickRef = useRef<{ active: boolean, id: number | null, startX: number, startY: number, curX: number, curY: number }>({ active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 });
  
  const [isMobile, setIsMobile] = useState(false);
  const [moveJoystickUI, setMoveJoystickUI] = useState<{ x: number, y: number, handleX: number, handleY: number } | null>(null);
  const [lookJoystickUI, setLookJoystickUI] = useState<{ x: number, y: number, handleX: number, handleY: number } | null>(null);

  // Interpolation state
  const interpolatedPlayersRef = useRef<Record<string, { x: number, y: number, angle: number }>>({});
  const keysRef = useRef<Record<string, boolean>>({});
  const [killFeed, setKillFeed] = useState<string[]>([]);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    killSoundRef.current = new Audio(KILL_SOUND_URL);
    killSoundRef.current.load();
    
    bgmRef.current = new Audio(BGM_URL);
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.4;
    
    startSfxRef.current = new Audio(START_SFX_URL);
    startSfxRef.current.load();
    
    const walls: Wall[] = [];
    MAP_DATA.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile === 1) {
          walls.push({
            x: x * CONFIG.TILE_SIZE,
            y: y * CONFIG.TILE_SIZE,
            w: CONFIG.TILE_SIZE,
            h: CONFIG.TILE_SIZE
          });
        }
      });
    });
    wallsRef.current = walls;
  }, []);

  // Handle phase-based BGM
  useEffect(() => {
    if (gameState.phase === 'hide' || gameState.phase === 'hunt') {
      bgmRef.current?.play().catch(() => {});
      if (gameState.phase === 'hide') {
        startSfxRef.current?.play().catch(() => {});
      }
    } else {
      bgmRef.current?.pause();
      if (bgmRef.current) bgmRef.current.currentTime = 0;
    }
  }, [gameState.phase]);

  useEffect(() => {
    const handleKill = (data: { playerId: string, playerName?: string, killerId: string, killerName?: string }) => {
      const pName = data.playerName || "Survivor";
      const kName = data.killerName || "Killer";
      
      if (killSoundRef.current) {
        killSoundRef.current.currentTime = 0;
        killSoundRef.current.play().catch(() => {});
      }

      setKillFeed(prev => [...prev.slice(-3), `${pName.toUpperCase()} ELIMINATED BY ${kName.toUpperCase()}`]);
      setTimeout(() => setKillFeed(prev => prev.slice(1)), 4000);

      const victim = gameState.players.find(p => p.id === data.playerId);
      const killer = gameState.players.find(p => p.id === data.killerId);

      if (victim && killer) {
        const vPos = interpolatedPlayersRef.current[victim.id] || { x: victim.x, y: victim.y };
        const kPos = interpolatedPlayersRef.current[killer.id] || { x: killer.x, y: killer.y };
        const now = performance.now();

        effectsRef.current.push({
          id: `tracer-${now}`,
          type: 'tracer',
          x: kPos.x,
          y: kPos.y,
          tx: vPos.x,
          ty: vPos.y,
          startTime: now,
          duration: 200,
        });

        const particles = Array.from({ length: 15 }).map(() => ({
          dx: (Math.random() - 0.5) * 120,
          dy: (Math.random() - 0.5) * 120,
          size: 2 + Math.random() * 5,
          color: Math.random() > 0.4 ? '#990000' : '#ff1111'
        }));

        effectsRef.current.push({
          id: `blood-${now}`,
          type: 'blood',
          x: vPos.x,
          y: vPos.y,
          startTime: now,
          duration: 1000,
          particles
        });
      }
    };
    socket.on('playerKilled', handleKill);
    return () => { socket.off('playerKilled', handleKill); };
  }, [socket, gameState.players]);

  useEffect(() => {
    const me = gameState.players.find(p => p.id === gameState.myId);
    if (me && (gameState.phase === 'hide' || gameState.phase === 'hunt')) {
      const dist = Math.sqrt(Math.pow(me.x - localPosRef.current.x, 2) + Math.pow(me.y - localPosRef.current.y, 2));
      if (dist > 100) {
        localPosRef.current.x = me.x;
        localPosRef.current.y = me.y;
      }
    }
  }, [gameState.phase, gameState.myId, gameState.players]);

  const checkWallCollision = (x: number, y: number) => {
    const radius = CONFIG.PLAYER_RADIUS;
    for (const wall of wallsRef.current) {
      const closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
      const closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
      const dx = x - closestX;
      const dy = y - closestY;
      if ((dx * dx + dy * dy) < (radius * radius)) return true;
    }
    return false;
  };

  const lineIntersectsRect = (x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) => {
    let tmin = 0, tmax = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > tmin) tmin = t; }
        else { if (t < tmax) tmax = t; }
      }
    }
    return tmin <= tmax;
  };

  const hasLineOfSight = (x1: number, y1: number, x2: number, y2: number) => {
    for (const wall of wallsRef.current) {
      if (lineIntersectsRect(x1, y1, x2, y2, wall.x, wall.y, wall.w, wall.h)) return false;
    }
    return true;
  };

  const normalizeAngle = (angle: number) => {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  };

  const isInFlashlightCone = (kx: number, ky: number, ka: number, tx: number, ty: number) => {
    const dx = tx - kx;
    const dy = ty - ky;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > CONFIG.FLASHLIGHT_RANGE) return false;
    const angleToTarget = Math.atan2(dy, dx);
    const angleDiff = Math.abs(normalizeAngle(angleToTarget - ka));
    return angleDiff < (CONFIG.FLASHLIGHT_ANGLE / 2);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.code] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.code] = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - rect.width / 2;
      const dy = e.clientY - rect.height / 2;
      localPosRef.current.angle = Math.atan2(dy, dx);
    };

    // Touch Events for Dual Joysticks
    const handleTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX < window.innerWidth / 2) {
          if (!moveJoystickRef.current.active) {
            moveJoystickRef.current = { active: true, id: touch.identifier, startX: touch.clientX, startY: touch.clientY, curX: touch.clientX, curY: touch.clientY };
            setMoveJoystickUI({ x: touch.clientX, y: touch.clientY, handleX: 0, handleY: 0 });
          }
        } else {
          if (!lookJoystickRef.current.active) {
            lookJoystickRef.current = { active: true, id: touch.identifier, startX: touch.clientX, startY: touch.clientY, curX: touch.clientX, curY: touch.clientY };
            setLookJoystickUI({ x: touch.clientX, y: touch.clientY, handleX: 0, handleY: 0 });
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === moveJoystickRef.current.id) {
          moveJoystickRef.current.curX = touch.clientX;
          moveJoystickRef.current.curY = touch.clientY;
          const dx = touch.clientX - moveJoystickRef.current.startX;
          const dy = touch.clientY - moveJoystickRef.current.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 40;
          const angle = Math.atan2(dy, dx);
          const limitedDist = Math.min(dist, maxDist);
          setMoveJoystickUI(prev => prev ? { ...prev, handleX: Math.cos(angle) * limitedDist, handleY: Math.sin(angle) * limitedDist } : null);
        } else if (touch.identifier === lookJoystickRef.current.id) {
          lookJoystickRef.current.curX = touch.clientX;
          lookJoystickRef.current.curY = touch.clientY;
          const dx = touch.clientX - lookJoystickRef.current.startX;
          const dy = touch.clientY - lookJoystickRef.current.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            localPosRef.current.angle = Math.atan2(dy, dx);
          }
          const maxDist = 40;
          const angle = Math.atan2(dy, dx);
          const limitedDist = Math.min(dist, maxDist);
          setLookJoystickUI(prev => prev ? { ...prev, handleX: Math.cos(angle) * limitedDist, handleY: Math.sin(angle) * limitedDist } : null);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === moveJoystickRef.current.id) {
          moveJoystickRef.current = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 };
          setMoveJoystickUI(null);
        } else if (touch.identifier === lookJoystickRef.current.id) {
          lookJoystickRef.current = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 };
          setLookJoystickUI(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    if (!isMobile) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      window.addEventListener('touchstart', handleTouchStart, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isMobile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;
    const loop = (timestamp: number) => {
      const dt = Math.min(0.1, (timestamp - lastUpdateRef.current) / 1000);
      lastUpdateRef.current = timestamp;
      update(dt, timestamp);
      draw(ctx, timestamp);
      animationId = requestAnimationFrame(loop);
    };

    const update = (dt: number, now: number) => {
      const me = gameState.players.find(p => p.id === gameState.myId);
      effectsRef.current = effectsRef.current.filter(e => now - e.startTime < e.duration);

      gameState.players.forEach(p => {
        if (p.id === gameState.myId) return;
        if (!interpolatedPlayersRef.current[p.id]) {
          interpolatedPlayersRef.current[p.id] = { x: p.x, y: p.y, angle: p.angle };
        } else {
          const interp = interpolatedPlayersRef.current[p.id];
          const factor = Math.min(1, CONFIG.INTERPOLATION_SPEED * dt);
          interp.x += (p.x - interp.x) * factor;
          interp.y += (p.y - interp.y) * factor;
          interp.angle += normalizeAngle(p.angle - interp.angle) * factor;
        }
      });

      if (gameState.phase === 'lobby' || gameState.phase === 'result') return;
      if (!me || !me.isAlive) return;
      if (me.role === 'killer' && gameState.phase === 'hide') return;

      let dx = 0, dy = 0;
      if (moveJoystickRef.current.active) {
        const jDx = moveJoystickRef.current.curX - moveJoystickRef.current.startX;
        const jDy = moveJoystickRef.current.curY - moveJoystickRef.current.startY;
        const jDist = Math.sqrt(jDx * jDx + jDy * jDy);
        if (jDist > 5) {
          dx = jDx / jDist;
          dy = jDy / jDist;
        }
      } else {
        if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dy -= 1;
        if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dy += 1;
        if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= 1;
        if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += 1;
      }

      if (dx !== 0 || dy !== 0 || localPosRef.current.angle !== lastSentPosRef.current.angle) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        const speed = CONFIG.PLAYER_SPEED * dt;
        const nx = localPosRef.current.x + (dx !== 0 ? (dx / (mag || 1)) * speed : 0);
        const ny = localPosRef.current.y + (dy !== 0 ? (dy / (mag || 1)) * speed : 0);

        if (!checkWallCollision(nx, localPosRef.current.y)) localPosRef.current.x = nx;
        if (!checkWallCollision(localPosRef.current.x, ny)) localPosRef.current.y = ny;

        const moved = Math.abs(localPosRef.current.x - lastSentPosRef.current.x) > 0.4 || 
                      Math.abs(localPosRef.current.y - lastSentPosRef.current.y) > 0.4 ||
                      Math.abs(localPosRef.current.angle - lastSentPosRef.current.angle) > 0.05;

        if (moved) {
            socket.emit('move', { x: localPosRef.current.x, y: localPosRef.current.y, angle: localPosRef.current.angle });
            lastSentPosRef.current = { ...localPosRef.current };
        }
      }

      if (me.role === 'killer' && gameState.phase === 'hunt' && me.isAlive) {
        gameState.players.forEach(p => {
          if (p.role === 'hider' && p.isAlive) {
            const pos = interpolatedPlayersRef.current[p.id] || p;
            if (isInFlashlightCone(localPosRef.current.x, localPosRef.current.y, localPosRef.current.angle, pos.x, pos.y)) {
               if (hasLineOfSight(localPosRef.current.x, localPosRef.current.y, pos.x, pos.y)) {
                 socket.emit('attemptKill', { targetId: p.id });
               }
            }
          }
        });
      }
    };

    const draw = (ctx: CanvasRenderingContext2D, now: number) => {
      const { width, height } = canvas;
      const me = gameState.players.find(p => p.id === gameState.myId);
      if (!me) return;

      const camX = localPosRef.current.x - width / 2;
      const camY = localPosRef.current.y - height / 2;

      ctx.fillStyle = '#010101';
      ctx.fillRect(0, 0, width, height);

      let maskApplied = false;
      if (!(me.role === 'killer' && gameState.phase === 'hide')) {
        const dCanvas = document.createElement('canvas');
        dCanvas.width = width; dCanvas.height = height;
        const dctx = dCanvas.getContext('2d')!;
        dctx.fillStyle = 'rgba(0,0,0,0.985)';
        dctx.fillRect(0,0,width,height);
        dctx.globalCompositeOperation = 'destination-out';

        if (me.role === 'killer') {
          dctx.beginPath();
          dctx.moveTo(width/2, height/2);
          dctx.arc(width/2, height/2, CONFIG.FLASHLIGHT_RANGE, localPosRef.current.angle - CONFIG.FLASHLIGHT_ANGLE/2, localPosRef.current.angle + CONFIG.FLASHLIGHT_ANGLE/2);
          dctx.closePath();
          dctx.fill();
        } else {
          const g = dctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, CONFIG.HIDER_VISIBILITY_RADIUS);
          g.addColorStop(0, 'white'); g.addColorStop(1, 'transparent');
          dctx.fillStyle = g;
          dctx.beginPath(); dctx.arc(width/2, height/2, CONFIG.HIDER_VISIBILITY_RADIUS, 0, Math.PI*2); dctx.fill();
        }
        
        ctx.drawImage(dCanvas, 0, 0);
        maskApplied = true;
      } else {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.save();
      ctx.translate(-camX, -camY);

      gameState.players.forEach(p => {
        if (!p.isAlive && p.id !== gameState.myId) return;
        const pos = p.id === gameState.myId ? localPosRef.current : (interpolatedPlayersRef.current[p.id] || p);
        
        let isVisible = p.id === gameState.myId;
        if (!isVisible && maskApplied) {
            if (me.role === 'killer') {
                if (isInFlashlightCone(localPosRef.current.x, localPosRef.current.y, localPosRef.current.angle, pos.x, pos.y)) {
                    if (hasLineOfSight(localPosRef.current.x, localPosRef.current.y, pos.x, pos.y)) {
                        isVisible = true;
                    }
                }
            } else {
                const d = Math.sqrt(Math.pow(pos.x - localPosRef.current.x, 2) + Math.pow(pos.y - localPosRef.current.y, 2));
                if (p.role === 'killer' || d < CONFIG.HIDER_VISIBILITY_RADIUS) {
                    if (hasLineOfSight(localPosRef.current.x, localPosRef.current.y, pos.x, pos.y)) {
                      isVisible = true;
                    }
                }
            }
        }

        if (isVisible) {
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.beginPath(); ctx.arc(0, 0, CONFIG.PLAYER_RADIUS, 0, Math.PI*2);
          ctx.fillStyle = p.role === 'killer' ? '#dc2626' : '#2563eb';
          if (!p.isAlive) ctx.fillStyle = '#444';
          ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

          ctx.rotate(pos.angle);
          ctx.fillStyle = '#fde047'; ctx.fillRect(CONFIG.PLAYER_RADIUS - 2, -2, 12, 4);
          ctx.restore();
          
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(p.name.toUpperCase(), pos.x, pos.y - CONFIG.PLAYER_RADIUS - 8);
        }
      });

      wallsRef.current.forEach(w => {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
      });

      if (me.role === 'killer' && gameState.phase !== 'hide' && me.isAlive) {
        ctx.save();
        ctx.translate(localPosRef.current.x, localPosRef.current.y);
        ctx.rotate(localPosRef.current.angle);
        const g = ctx.createLinearGradient(0, 0, CONFIG.FLASHLIGHT_RANGE, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.15)'); g.addColorStop(0.8, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0,0);
        const yOff = Math.tan(CONFIG.FLASHLIGHT_ANGLE/2)*CONFIG.FLASHLIGHT_RANGE;
        ctx.lineTo(CONFIG.FLASHLIGHT_RANGE, -yOff);
        ctx.lineTo(CONFIG.FLASHLIGHT_RANGE, yOff);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      effectsRef.current.forEach(e => {
        const prog = (now - e.startTime) / e.duration;
        const alpha = 1 - prog;
        if (e.type === 'tracer') {
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.tx!, e.ty!);
          ctx.strokeStyle = `rgba(255,255,0,${alpha*0.8})`; ctx.lineWidth = 4*alpha; ctx.stroke();
        } else {
          e.particles?.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = alpha;
            ctx.beginPath(); ctx.arc(e.x + p.dx*prog, e.y + p.dy*prog, p.size*alpha, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
          });
        }
      });
      ctx.restore();
      
      if (me.role === 'killer' && gameState.phase === 'hide') {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 36px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('STAY IN THE DARK', width/2, height/2 - 20);
        ctx.font = 'bold 20px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.fillText(`PREPARING HUNT... ${Math.ceil(gameState.timer)}S`, width/2, height/2 + 30);
      }
    };

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();
    animationId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animationId); window.removeEventListener('resize', resize); };
  }, [gameState.phase, gameState.players, gameState.myId, socket]);

  return (
    <div className="w-full h-full touch-none select-none overflow-hidden relative">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {killFeed.length > 0 && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-[5000]">
          {killFeed.map((m, i) => (
            <div key={i} className="bg-red-600 px-6 py-2 rounded-full font-bold text-[10px] uppercase shadow-xl animate-bounce border border-red-400">
              {m}
            </div>
          ))}
        </div>
      )}

      {/* Mobile Movement Joystick UI */}
      {isMobile && moveJoystickUI && (
        <div 
          className="fixed pointer-events-none z-[10000]"
          style={{ left: moveJoystickUI.x, top: moveJoystickUI.y }}
        >
          <div className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 bg-white/5 rounded-full border border-white/20 backdrop-blur-sm"></div>
          <div 
            className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 bg-white/30 rounded-full shadow-lg border border-white/50"
            style={{ transform: `translate(calc(-50% + ${moveJoystickUI.handleX}px), calc(-50% + ${moveJoystickUI.handleY}px))` }}
          ></div>
        </div>
      )}

      {/* Mobile Look Joystick UI */}
      {isMobile && lookJoystickUI && (
        <div 
          className="fixed pointer-events-none z-[10000]"
          style={{ left: lookJoystickUI.x, top: lookJoystickUI.y }}
        >
          <div className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 bg-white/5 rounded-full border border-white/20 backdrop-blur-sm"></div>
          <div 
            className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 bg-red-600/40 rounded-full shadow-lg border border-red-500/50"
            style={{ transform: `translate(calc(-50% + ${lookJoystickUI.handleX}px), calc(-50% + ${lookJoystickUI.handleY}px))` }}
          ></div>
        </div>
      )}

      <HUD gameState={gameState} />
    </div>
  );
};

export default Game;
