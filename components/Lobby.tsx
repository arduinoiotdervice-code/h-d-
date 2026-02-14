import React, { useRef, useEffect } from 'react';
import { GameState } from '../types';
import { Socket } from 'socket.io-client';

interface LobbyProps {
  gameState: GameState;
  socket: Socket;
}

const CLICK_SFX_URL = "https://cdn.pixabay.com/download/audio/2021/08/04/audio_06d2036720.mp3";

const Lobby: React.FC<LobbyProps> = ({ gameState, socket }) => {
  const minPlayers = 3;
  const playerCount = gameState.players.length;
  const me = gameState.players.find(p => p.id === gameState.myId);
  const everyoneReady = gameState.players.length >= minPlayers && gameState.players.every(p => p.isReady);
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    clickSfxRef.current = new Audio(CLICK_SFX_URL);
    clickSfxRef.current.load();
  }, []);

  const toggleReady = () => {
    clickSfxRef.current?.play().catch(() => {});
    socket.emit('toggleReady');
  };

  return (
    <div className="sh-result-overlay" style={{ background: 'rgba(0,0,0,0.92)' }}>
      <div className="sh-panel" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 className="font-orbitron" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>
              LOBBY<span style={{ color: '#dc2626' }}>_</span>
            </h2>
            <p style={{ color: '#9ca3af', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.2em', marginTop: '4px' }}>Waiting for tactical deployment</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 900 }}>SQUAD</span>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{playerCount}<span style={{ opacity: 0.3, fontSize: '1.2rem' }}>/8</span></div>
          </div>
        </div>

        <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '2rem' }}>
          {gameState.players.map((player) => (
            <div key={player.id} className="sh-lobby-row" style={{ borderColor: player.id === gameState.myId ? '#2563eb' : '#1f2937' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="sh-ready-indicator" style={{ background: player.isReady ? '#22c55e' : '#dc2626', boxShadow: player.isReady ? '0 0 10px #22c55e' : 'none' }}></div>
                <div>
                  <p style={{ fontWeight: 900, color: player.id === gameState.myId ? '#3b82f6' : 'white', margin: 0 }}>
                    {player.name} {player.id === gameState.myId && <span style={{ fontSize: '10px', opacity: 0.5, marginLeft: '8px' }}>(YOU)</span>}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 900, opacity: 0.5, textTransform: 'uppercase' }}>
                {player.isReady ? 'Ready' : 'Waiting'}
              </span>
            </div>
          ))}
          
          {playerCount < minPlayers && (
            <div style={{ padding: '1rem', border: '1px dashed #374151', borderRadius: '1rem', textAlign: 'center', opacity: 0.5 }}>
              <p style={{ fontSize: '12px', margin: 0 }}>Need {minPlayers - playerCount} more survivors...</p>
            </div>
          )}
        </div>

        <button
          onClick={toggleReady}
          className={`sh-btn ${me?.isReady ? 'sh-btn-ready' : 'sh-btn-not-ready'}`}
        >
          {me?.isReady ? 'SYSTEMS READY' : 'PREPARE FOR HUNT'}
        </button>

        {everyoneReady && (
          <div className="animate-pulse" style={{ marginTop: '1.5rem', textAlign: 'center', color: '#22c55e', fontWeight: 900, fontFamily: 'Orbitron' }}>
            DEPLOYMENT IN {gameState.timer}s
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;