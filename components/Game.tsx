
import React, { useRef, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player, Wall } from '../types';
import { CONFIG, MAP_DATA } from '../constants';
import HUD from './HUD';

interface GameProps {
  socket: Socket;
  gameState: GameState;
}

const Game: React.FC<GameProps> = ({ socket, gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wallsRef = useRef<Wall[]>([]);
  const lastUpdateRef = useRef<number>(performance.now());
  const localPosRef = useRef({ x: 0, y: 0, angle: 0 });
  const remoteInterpolationRef = useRef<Record<string, { x: number, y: number, angle: number }>>({});
  const keysRef = useRef<Record<string, boolean>>({});
  
  // Cache for static mask if needed, but we'll use dynamic composite ops for performance
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
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

  // Update interpolation targets
  useEffect(() => {
    gameState.players.forEach(p => {
      if (p.id !== gameState.myId) {
        remoteInterpolationRef.current[p.id] = { x: p.x, y: p.y, angle: p.angle };
      }
    });
  }, [gameState.players, gameState.myId]);

  // Handle spawn and phase transitions
  useEffect(() => {
    const me = gameState.players.find(p => p.id === gameState.myId);
    if (me && (gameState.phase === 'hide' || gameState.phase === 'hunt')) {
      // Snap to server if we're too far off (network correction)
      const dist = Math.sqrt(Math.pow(me.x - localPosRef.current.x, 2) + Math.pow(me.y - localPosRef.current.y, 2));
      if (dist > 100) {
        localPosRef.current.x = me.x;
        localPosRef.current.y = me.y;
      }
    }
  }, [gameState.phase, gameState.myId, gameState.players]);

  const circleRectCollision = (cx: number, cy: number, radius: number, rx: number, ry: number, rw: number, rh: number) => {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (radius * radius);
  };

  const checkWallCollision = (x: number, y: number) => {
    for (const wall of wallsRef.current) {
      if (circleRectCollision(x, y, CONFIG.PLAYER_RADIUS, wall.x, wall.y, wall.w, wall.h)) return true;
    }
    return false;
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

  const hasLineOfSight = (x1: number, y1: number, x2: number, y2: number) => {
    for (const wall of wallsRef.current) {
      if (lineIntersectsRect(x1, y1, x2, y2, wall.x, wall.y, wall.w, wall.h)) return false;
    }
    return true;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.code] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.code] = false;
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - rect.width / 2;
      const dy = e.clientY - rect.height / 2;
      localPosRef.current.angle = Math.atan2(dy, dx);
      socket.emit('angle', { angle: localPosRef.current.angle });
    };

    const handleMouseDown = () => {
      const me = gameState.players.find(p => p.id === gameState.myId);
      if (me?.role === 'killer' && gameState.phase === 'hunt' && me.isAlive) {
        gameState.players.forEach(p => {
          if (p.role === 'hider' && p.isAlive) {
            if (isInFlashlightCone(localPosRef.current.x, localPosRef.current.y, localPosRef.current.angle, p.x, p.y)) {
              if (hasLineOfSight(localPosRef.current.x, localPosRef.current.y, p.x, p.y)) {
                socket.emit('attemptKill', { targetId: p.id });
              }
            }
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gameState.myId, gameState.players, gameState.phase, socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;

    const loop = (timestamp: number) => {
      const dt = (timestamp - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = timestamp;

      update(dt);
      draw(ctx);
      animationId = requestAnimationFrame(loop);
    };

    const update = (dt: number) => {
      if (gameState.phase === 'lobby' || gameState.phase === 'result') return;

      const me = gameState.players.find(p => p.id === gameState.myId);
      if (!me || !me.isAlive) return;

      // Killer movement restricted during hide phase
      if (me.role === 'killer' && gameState.phase === 'hide') return;

      let dx = 0, dy = 0;
      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dy -= 1;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dy += 1;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= 1;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        const speed = CONFIG.PLAYER_SPEED * dt;
        const nx = localPosRef.current.x + (dx / mag) * speed;
        const ny = localPosRef.current.y + (dy / mag) * speed;

        if (!checkWallCollision(nx, localPosRef.current.y)) localPosRef.current.x = nx;
        if (!checkWallCollision(localPosRef.current.x, ny)) localPosRef.current.y = ny;

        socket.emit('move', { 
            x: localPosRef.current.x, 
            y: localPosRef.current.y, 
            angle: localPosRef.current.angle 
        });
      }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
      const { width, height } = canvas;
      const me = gameState.players.find(p => p.id === gameState.myId);
      if (!me) return;

      // BLACKOUT FOR KILLER DURING HIDE
      if (me.role === 'killer' && gameState.phase === 'hide') {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('STAY IN THE SHADOWS', width/2, height/2 - 20);
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 24px Orbitron';
        ctx.fillText(`PREPARING HUNT... ${Math.ceil(gameState.timer)}s`, width/2, height/2 + 40);
        return;
      }

      const camX = localPosRef.current.x - width / 2;
      const camY = localPosRef.current.y - height / 2;

      // Draw Background / Floor
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(-camX, -camY);

      // Draw Map
      MAP_DATA.tiles.forEach((row, y) => {
        row.forEach((tile, x) => {
          const px = x * CONFIG.TILE_SIZE;
          const py = y * CONFIG.TILE_SIZE;
          if (px + CONFIG.TILE_SIZE < camX || px > camX + width || py + CONFIG.TILE_SIZE < camY || py > camY + height) return;
          
          if (tile === 1) {
            ctx.fillStyle = '#1c1c1c';
            ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
            ctx.strokeStyle = '#333';
            ctx.strokeRect(px + 1, py + 1, CONFIG.TILE_SIZE - 2, CONFIG.TILE_SIZE - 2);
          } else {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
          }
        });
      });

      // Darkness Layer
      ctx.restore();
      
      const darknessCanvas = document.createElement('canvas');
      darknessCanvas.width = width;
      darknessCanvas.height = height;
      const dctx = darknessCanvas.getContext('2d')!;
      dctx.fillStyle = 'rgba(0, 0, 0, 0.94)';
      dctx.fillRect(0, 0, width, height);

      dctx.globalCompositeOperation = 'destination-out';
      if (me.role === 'killer') {
        const grad = dctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, CONFIG.FLASHLIGHT_RANGE);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.8, 'rgba(255,255,255,0.4)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        
        dctx.beginPath();
        dctx.moveTo(width/2, height/2);
        dctx.arc(width/2, height/2, CONFIG.FLASHLIGHT_RANGE, localPosRef.current.angle - CONFIG.FLASHLIGHT_ANGLE/2, localPosRef.current.angle + CONFIG.FLASHLIGHT_ANGLE/2);
        dctx.fillStyle = grad;
        dctx.fill();
      } else {
        const grad = dctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, CONFIG.HIDER_VISIBILITY_RADIUS);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        dctx.fillStyle = grad;
        dctx.beginPath();
        dctx.arc(width/2, height/2, CONFIG.HIDER_VISIBILITY_RADIUS, 0, Math.PI * 2);
        dctx.fill();
      }

      ctx.drawImage(darknessCanvas, 0, 0);

      // Draw Players
      ctx.save();
      ctx.translate(-camX, -camY);

      gameState.players.forEach(p => {
        if (!p.isAlive && p.id !== gameState.myId) return;

        let isVisible = false;
        const targetX = p.id === gameState.myId ? localPosRef.current.x : p.x;
        const targetY = p.id === gameState.myId ? localPosRef.current.y : p.y;
        const targetAngle = p.id === gameState.myId ? localPosRef.current.angle : p.angle;

        if (p.id === gameState.myId) isVisible = true;
        else if (me.role === 'hider') {
           const dist = Math.sqrt(Math.pow(targetX - localPosRef.current.x, 2) + Math.pow(targetY - localPosRef.current.y, 2));
           // Hiders see killer always, other hiders only nearby
           if (p.role === 'killer' || dist < CONFIG.HIDER_VISIBILITY_RADIUS) isVisible = true;
        } else {
           // Killer sees ONLY in cone
           isVisible = isInFlashlightCone(localPosRef.current.x, localPosRef.current.y, localPosRef.current.angle, targetX, targetY);
        }

        if (isVisible) {
          ctx.save();
          ctx.translate(targetX, targetY);
          
          // Body
          ctx.beginPath();
          ctx.arc(0, 0, CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = p.role === 'killer' ? '#dc2626' : '#2563eb';
          if (!p.isAlive) ctx.fillStyle = '#444';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Heading Indicator
          ctx.rotate(targetAngle);
          ctx.beginPath();
          ctx.moveTo(CONFIG.PLAYER_RADIUS - 2, 0);
          ctx.lineTo(CONFIG.PLAYER_RADIUS + 10, 0);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.restore();

          // Text Label
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(p.name, targetX, targetY - CONFIG.PLAYER_RADIUS - 15);
        }
      });

      ctx.restore();
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();
    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [gameState.phase, gameState.players, gameState.myId, socket]);

  return (
    <div className="w-full h-full cursor-none">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div 
        className="fixed w-6 h-6 border-2 border-red-600 rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-[999]"
        style={{ left: '50%', top: '50%' }}
      >
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-600 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
      </div>
      <HUD gameState={gameState} />
    </div>
  );
};

export default Game;
