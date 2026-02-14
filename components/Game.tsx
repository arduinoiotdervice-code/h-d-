
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
const BGM_URL = "https://cdn.pixabay.com/download/audio/2022/02/10/audio_5157a53f0f.mp3";

const Game: React.FC<GameProps> = ({ socket, gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wallsRef = useRef<Wall[]>([]);
  const lastUpdateRef = useRef<number>(performance.now());
  const localPosRef = useRef({ x: 0, y: 0, angle: 0 });
  const lastSentPosRef = useRef({ x: 0, y: 0, angle: 0 });
  const effectsRef = useRef<VisualEffect[]>([]);
  
  const killSoundRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  
  // Mobile Controls - Dual Joysticks
  const moveJoystickRef = useRef<{ active: boolean, id: number | null, startX: number, startY: number, curX: number, curY: number }>({ active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 });
  const lookJoystickRef = useRef<{ active: boolean, id: number | null, startX: number, startY: number, curX: number, curY: number }>({ active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 });
  
  const [isMobile, setIsMobile] = useState(false);
  const [moveJoystickUI, setMoveJoystickUI] = useState<{ x: number, y: number, hX: number, hY: number } | null>(null);
  const [lookJoystickUI, setLookJoystickUI] = useState<{ x: number, y: number, hX: number, hY: number } | null>(null);

  const interpolatedPlayersRef = useRef<Record<string, { x: number, y: number, angle: number }>>({});
  const keysRef = useRef<Record<string, boolean>>({});
  const [killFeed, setKillFeed] = useState<string[]>([]);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    killSoundRef.current = new Audio(KILL_SOUND_URL);
    killSoundRef.current.load();
    
    bgmRef.current = new Audio(BGM_URL);
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.3;
    
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

  useEffect(() => {
    if (gameState.phase === 'hunt' || gameState.phase === 'hide') {
      bgmRef.current?.play().catch(() => {});
    } else {
      bgmRef.current?.pause();
      if (bgmRef.current) bgmRef.current.currentTime = 0;
    }
  }, [gameState.phase]);

  useEffect(() => {
    const handleKill = (data: { playerId: string, playerName?: string, killerId: string, killerName?: string }) => {
      killSoundRef.current?.play().catch(() => {});
      const pName = data.playerName || "Survivor";
      const kName = data.killerName || "Killer";
      setKillFeed(prev => [...prev.slice(-2), `${pName.toUpperCase()} ELIMINATED BY ${kName.toUpperCase()}`]);
      setTimeout(() => setKillFeed(prev => prev.slice(1)), 4000);

      const victim = gameState.players.find(p => p.id === data.playerId);
      const killer = gameState.players.find(p => p.id === data.killerId);
      if (victim && killer) {
        const now = performance.now();
        effectsRef.current.push({ id: `t${now}`, type: 'tracer', x: killer.x, y: killer.y, tx: victim.x, ty: victim.y, startTime: now, duration: 200 });
        effectsRef.current.push({
          id: `b${now}`, type: 'blood', x: victim.x, y: victim.y, startTime: now, duration: 1000,
          particles: Array.from({ length: 15 }).map(() => ({
            dx: (Math.random() - 0.5) * 120, dy: (Math.random() - 0.5) * 120, size: 2 + Math.random() * 4, color: '#dc2626'
          }))
        });
      }
    };
    socket.on('playerKilled', handleKill);
    return () => { socket.off('playerKilled'); };
  }, [socket, gameState.players]);

  const normalizeAngle = (a: number) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
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

  const hasLoS = (x1: number, y1: number, x2: number, y2: number) => {
    for (const w of wallsRef.current) {
      if (lineIntersectsRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return false;
    }
    return true;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.code] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.code] = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      localPosRef.current.angle = Math.atan2(e.clientY - rect.height / 2, e.clientX - rect.width / 2);
    };

    const handleTS = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX < window.innerWidth / 2) {
          if (!moveJoystickRef.current.active) {
            moveJoystickRef.current = { active: true, id: t.identifier, startX: t.clientX, startY: t.clientY, curX: t.clientX, curY: t.clientY };
            setMoveJoystickUI({ x: t.clientX, y: t.clientY, hX: 0, hY: 0 });
          }
        } else {
          if (!lookJoystickRef.current.active) {
            lookJoystickRef.current = { active: true, id: t.identifier, startX: t.clientX, startY: t.clientY, curX: t.clientX, curY: t.clientY };
            setLookJoystickUI({ x: t.clientX, y: t.clientY, hX: 0, hY: 0 });
          }
        }
      }
    };

    const handleTM = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === moveJoystickRef.current.id) {
          moveJoystickRef.current.curX = t.clientX;
          moveJoystickRef.current.curY = t.clientY;
          const dx = t.clientX - moveJoystickRef.current.startX;
          const dy = t.clientY - moveJoystickRef.current.startY;
          const d = Math.sqrt(dx * dx + dy * dy);
          const max = 40;
          const a = Math.atan2(dy, dx);
          setMoveJoystickUI(prev => prev ? { ...prev, hX: Math.cos(a) * Math.min(d, max), hY: Math.sin(a) * Math.min(d, max) } : null);
        } else if (t.identifier === lookJoystickRef.current.id) {
          const dx = t.clientX - lookJoystickRef.current.startX;
          const dy = t.clientY - lookJoystickRef.current.startY;
          if (Math.sqrt(dx * dx + dy * dy) > 5) {
            localPosRef.current.angle = Math.atan2(dy, dx);
          }
          const d = Math.sqrt(dx * dx + dy * dy);
          const max = 40;
          const a = Math.atan2(dy, dx);
          setLookJoystickUI(prev => prev ? { ...prev, hX: Math.cos(a) * Math.min(d, max), hY: Math.sin(a) * Math.min(d, max) } : null);
        }
      }
    };

    const handleTE = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === moveJoystickRef.current.id) {
          moveJoystickRef.current = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 };
          setMoveJoystickUI(null);
        } else if (t.identifier === lookJoystickRef.current.id) {
          lookJoystickRef.current = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 };
          setLookJoystickUI(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    if (!isMobile) window.addEventListener('mousemove', handleMouseMove);
    else {
      window.addEventListener('touchstart', handleTS, { passive: false });
      window.addEventListener('touchmove', handleTM, { passive: false });
      window.addEventListener('touchend', handleTE);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTS);
      window.removeEventListener('touchmove', handleTM);
      window.removeEventListener('touchend', handleTE);
    };
  }, [isMobile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    const checkWall = (x: number, y: number) => {
      for (const w of wallsRef.current) {
        const cx = Math.max(w.x, Math.min(x, w.x + w.w));
        const cy = Math.max(w.y, Math.min(y, w.y + w.h));
        if ((x - cx)**2 + (y - cy)**2 < CONFIG.PLAYER_RADIUS**2) return true;
      }
      return false;
    };

    const loop = (time: number) => {
      const dt = Math.min(0.1, (time - lastUpdateRef.current) / 1000);
      lastUpdateRef.current = time;
      const me = gameState.players.find(p => p.id === gameState.myId);

      if (me && me.isAlive && gameState.phase !== 'lobby' && !(me.role === 'killer' && gameState.phase === 'hide')) {
        let dx = 0, dy = 0;
        if (moveJoystickRef.current.active) {
          const jx = moveJoystickRef.current.curX - moveJoystickRef.current.startX;
          const jy = moveJoystickRef.current.curY - moveJoystickRef.current.startY;
          const d = Math.sqrt(jx * jx + jy * jy);
          if (d > 5) { dx = jx / d; dy = jy / d; }
        } else {
          if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dy -= 1;
          if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dy += 1;
          if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= 1;
          if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += 1;
        }

        if (dx !== 0 || dy !== 0) {
          const mag = Math.sqrt(dx * dx + dy * dy);
          const nx = localPosRef.current.x + (dx / mag) * CONFIG.PLAYER_SPEED * dt;
          const ny = localPosRef.current.y + (dy / mag) * CONFIG.PLAYER_SPEED * dt;
          if (!checkWall(nx, localPosRef.current.y)) localPosRef.current.x = nx;
          if (!checkWall(localPosRef.current.x, ny)) localPosRef.current.y = ny;
        }

        if (Math.abs(localPosRef.current.x - lastSentPosRef.current.x) > 0.5 || 
            Math.abs(localPosRef.current.y - lastSentPosRef.current.y) > 0.5 ||
            Math.abs(localPosRef.current.angle - lastSentPosRef.current.angle) > 0.05) {
          socket.emit('move', localPosRef.current);
          lastSentPosRef.current = { ...localPosRef.current };
        }
      }

      // Drawing
      const { width, height } = canvas;
      ctx.fillStyle = '#010101';
      ctx.fillRect(0, 0, width, height);
      if (!me) return;

      const camX = localPosRef.current.x - width / 2;
      const camY = localPosRef.current.y - height / 2;

      // Visibility Mask
      // Killer sees blackness unless flashlight is on.
      // Hiders see small visibility circle.
      if (!(me.role === 'killer' && gameState.phase === 'hide')) {
        const mC = document.createElement('canvas'); mC.width = width; mC.height = height;
        const mCtx = mC.getContext('2d')!;
        mCtx.fillStyle = 'rgba(0,0,0,0.985)';
        mCtx.fillRect(0, 0, width, height);
        mCtx.globalCompositeOperation = 'destination-out';
        if (me.role === 'killer') {
          // Killer only sees in flashlight cone
          mCtx.beginPath(); mCtx.moveTo(width / 2, height / 2);
          mCtx.arc(width / 2, height / 2, CONFIG.FLASHLIGHT_RANGE, localPosRef.current.angle - CONFIG.FLASHLIGHT_ANGLE / 2, localPosRef.current.angle + CONFIG.FLASHLIGHT_ANGLE / 2);
          mCtx.closePath(); mCtx.fill();
        } else {
          // Hider sees around themselves
          const g = mCtx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, CONFIG.HIDER_VISIBILITY_RADIUS);
          g.addColorStop(0, 'white'); g.addColorStop(1, 'transparent');
          mCtx.fillStyle = g; mCtx.beginPath(); mCtx.arc(width / 2, height / 2, CONFIG.HIDER_VISIBILITY_RADIUS, 0, Math.PI * 2); mCtx.fill();
        }
        ctx.drawImage(mC, 0, 0);
      }

      ctx.save();
      ctx.translate(-camX, -camY);

      // Walls
      wallsRef.current.forEach(w => {
        ctx.fillStyle = '#111';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
      });

      // Players
      gameState.players.forEach(p => {
        if (!p.isAlive && p.id !== gameState.myId) return;
        const pos = p.id === gameState.myId ? localPosRef.current : p;
        
        let isVis = p.id === gameState.myId;
        
        // RULE: Other players can always see the Killer's movement (even without LoS for extra game feel?)
        // Let's stick to: Hiders see Killer if LoS is clear, OR if they are the Killer themselves.
        if (!isVis && !(me.role === 'killer' && gameState.phase === 'hide')) {
          const distSq = (pos.x - localPosRef.current.x)**2 + (pos.y - localPosRef.current.y)**2;
          
          if (me.role === 'killer') {
            // Killer only sees hiders in cone
            if (p.role === 'hider' && distSq < CONFIG.FLASHLIGHT_RANGE**2) {
              const a = Math.atan2(pos.y - localPosRef.current.y, pos.x - localPosRef.current.x);
              if (Math.abs(normalizeAngle(a - localPosRef.current.angle)) < CONFIG.FLASHLIGHT_ANGLE / 2) {
                if (hasLoS(localPosRef.current.x, localPosRef.current.y, pos.x, pos.y)) isVis = true;
              }
            }
          } else {
            // Hider sees killer EVERYWHERE (requested feature) OR hider sees other hiders in radius
            if (p.role === 'killer') {
                isVis = true; // "other player can see killer every movement"
            } else if (distSq < CONFIG.HIDER_VISIBILITY_RADIUS**2) {
                if (hasLoS(localPosRef.current.x, localPosRef.current.y, pos.x, pos.y)) isVis = true;
            }
          }
        }

        if (isVis) {
          ctx.save(); ctx.translate(pos.x, pos.y);
          ctx.beginPath(); ctx.arc(0, 0, CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = p.role === 'killer' ? '#ef4444' : '#3b82f6';
          if (!p.isAlive) ctx.fillStyle = '#333';
          ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.rotate(pos.angle);
          ctx.fillStyle = '#fbbf24'; ctx.fillRect(CONFIG.PLAYER_RADIUS - 2, -2, 10, 4);
          ctx.restore();
          
          ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center';
          ctx.fillText(p.name.toUpperCase(), pos.x, pos.y - CONFIG.PLAYER_RADIUS - 8);
        }
      });

      // Render Visual Flashlight for Killer
      const killer = gameState.players.find(p => p.role === 'killer');
      if (killer && killer.isAlive && gameState.phase === 'hunt') {
          const kPos = killer.id === gameState.myId ? localPosRef.current : killer;
          ctx.save();
          ctx.translate(kPos.x, kPos.y);
          ctx.rotate(kPos.angle);
          const grad = ctx.createLinearGradient(0, 0, CONFIG.FLASHLIGHT_RANGE, 0);
          grad.addColorStop(0, 'rgba(255,255,255,0.15)');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.arc(0,0, CONFIG.FLASHLIGHT_RANGE, -CONFIG.FLASHLIGHT_ANGLE/2, CONFIG.FLASHLIGHT_ANGLE/2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
      }

      // Effects
      effectsRef.current = effectsRef.current.filter(e => {
        const el = time - e.startTime; if (el > e.duration) return false;
        const a = 1 - el / e.duration;
        if (e.type === 'tracer') {
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.tx!, e.ty!);
          ctx.strokeStyle = `rgba(255,255,0,${a * 0.8})`; ctx.lineWidth = 4 * a; ctx.stroke();
        } else {
          e.particles?.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = a;
            ctx.beginPath(); ctx.arc(e.x + p.dx * el / 1000, e.y + p.dy * el / 1000, p.size * a, 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
        return true;
      });

      ctx.restore();

      if (me.role === 'killer' && gameState.phase === 'hide') {
        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 36px Orbitron'; ctx.textAlign = 'center';
        ctx.fillText("PREPARING HUNT", width / 2, height / 2 - 20);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Orbitron';
        ctx.fillText(`DEPLOYING IN ${Math.ceil(gameState.timer)}S`, width / 2, height / 2 + 30);
      }
      animId = requestAnimationFrame(loop);
    };

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();
    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [gameState]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} />
      
      {killFeed.length > 0 && (
        <div className="sh-kill-feed">
          {killFeed.map((m, i) => <div key={i} className="sh-kill-tag">{m}</div>)}
        </div>
      )}

      {isMobile && moveJoystickUI && (
        <div className="sh-joystick-base" style={{ left: moveJoystickUI.x, top: moveJoystickUI.y, zIndex: 10000 }}>
          <div className="sh-joystick-handle" style={{ left: `calc(50% + ${moveJoystickUI.hX}px)`, top: `calc(50% + ${moveJoystickUI.hY}px)` }}></div>
        </div>
      )}

      {isMobile && lookJoystickUI && (
        <div className="sh-joystick-base" style={{ left: lookJoystickUI.x, top: lookJoystickUI.y, zIndex: 10000 }}>
          <div className="sh-joystick-handle sh-look-handle" style={{ left: `calc(50% + ${lookJoystickUI.hX}px)`, top: `calc(50% + ${lookJoystickUI.hY}px)` }}></div>
        </div>
      )}

      <HUD gameState={gameState} />
    </div>
  );
};

export default Game;
