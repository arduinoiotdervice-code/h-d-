import React from 'react';
import { GameState } from '../types';

interface HUDProps {
  gameState: GameState;
}

const HUD: React.FC<HUDProps> = ({ gameState }) => {
  const me = gameState.players.find(p => p.id === gameState.myId);
  if (!me) return null;

  const hiders = gameState.players.filter(p => p.role === 'hider');
  const aliveHiders = hiders.filter(p => p.isAlive).length;
  const totalHiders = hiders.length;

  return (
    <div className="sh-hud-container">
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div className="sh-hud-box" style={{ minWidth: '160px' }}>
          <p style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 4px 0' }}>Status</p>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: gameState.phase === 'hunt' ? '#ef4444' : '#3b82f6' }}>
            {(gameState.phase || 'unknown').toUpperCase()}
          </p>
          <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>
            {Math.max(0, Math.floor(gameState.timer))}s
          </div>
        </div>

        <div className="sh-hud-box" style={{ textAlign: 'right' }}>
          <p style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 4px 0' }}>Role Assigned</p>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: me.role === 'killer' ? '#ef4444' : '#3b82f6' }}>
            {(me.role || 'hider').toUpperCase()}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '10px', fontWeight: 900, color: me.isAlive ? '#22c55e' : '#9ca3af' }}>
            {me.isAlive ? '• OPERATIONAL' : '• SIGNAL LOST'}
          </p>
        </div>
      </div>

      {/* Center Instruction Overlay */}
      <div style={{ alignSelf: 'center', textAlign: 'center' }}>
        {gameState.phase === 'hide' && (
          <div style={{ background: 'rgba(37, 99, 235, 0.2)', border: '1px solid #3b82f6', padding: '1rem 2rem', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
              <p className="animate-pulse" style={{ color: '#3b82f6', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '0.4em', margin: 0 }}>
                  {me.role === 'hider' ? 'CONCEAL YOURSELF' : 'PREPARE THE BLADES'}
              </p>
          </div>
        )}
        {!me.isAlive && gameState.phase !== 'result' && (
           <div style={{ background: 'rgba(220, 38, 38, 0.2)', border: '1px solid #dc2626', padding: '1rem 2rem', borderRadius: '1rem' }}>
              <p style={{ color: '#dc2626', fontWeight: 900, fontSize: '1.5rem', letterSpacing: '0.3em', margin: 0 }}>
                  FATAL ERROR
              </p>
           </div>
        )}
      </div>

      {/* Footer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
        <div className="sh-hud-box">
          <p style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 4px 0' }}>Squad Alive</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: 900 }}>{aliveHiders}</span>
            <span style={{ opacity: 0.3, fontSize: '1.5rem', fontWeight: 900 }}>/ {totalHiders}</span>
          </div>
        </div>

        {me.role === 'killer' && gameState.phase === 'hunt' && me.isAlive && (
            <div className="sh-hud-box" style={{ background: 'rgba(220, 38, 38, 0.1)', borderColor: 'rgba(220, 38, 38, 0.5)' }}>
                <p style={{ color: '#ef4444', fontWeight: 900, fontSize: '10px', letterSpacing: '0.2em', textAlign: 'center', marginBottom: '8px' }}>RADAR SCANNING</p>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse" style={{ width: '4px', height: '16px', background: '#dc2626', borderRadius: '99px', animationDelay: `${i*0.2}s` }}></div>
                  ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default HUD;