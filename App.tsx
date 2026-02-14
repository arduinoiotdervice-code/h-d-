import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { GameState, Player, GamePhase } from './types';
import { CONFIG } from './constants';

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    phase: 'lobby',
    timer: 0,
    myId: null,
  });
  const [isJoined, setIsJoined] = useState(false);
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    const newSocket = io(CONFIG.SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      setGameState(prev => ({ ...prev, myId: newSocket.id || null }));
    });

    newSocket.on('updatePlayers', (players: Player[]) => {
      setGameState(prev => ({ ...prev, players }));
    });

    newSocket.on('phaseChange', ({ phase, duration }: { phase: GamePhase; duration: number }) => {
      setGameState(prev => ({ ...prev, phase, timer: duration }));
    });

    newSocket.on('gameEnd', ({ winner }: { winner: string }) => {
      setGameState(prev => ({ ...prev, phase: 'result', winner }));
    });

    newSocket.on('gameReset', () => {
      setGameState(prev => ({ ...prev, phase: 'lobby', winner: undefined }));
    });

    newSocket.on('joined', (data: { id: string; name: string; players: Player[] }) => {
      setGameState(prev => ({ ...prev, myId: data.id, players: data.players }));
      setIsJoined(true);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoin = (name: string) => {
    if (socket && name.trim()) {
      socket.emit('joinRoom', { name });
      setPlayerName(name);
    }
  };

  if (!isJoined) {
    return (
      <div className="sh-screen">
        <div className="sh-panel">
          <h1 className="font-orbitron" style={{ fontSize: '3rem', color: '#dc2626', fontWeight: 900, marginBottom: '0.5rem', textAlign: 'center' }}>
            SHADOW HUNT
          </h1>
          <p style={{ opacity: 0.5, fontSize: '10px', textTransform: 'uppercase', textAlign: 'center', marginBottom: '2.5rem', letterSpacing: '0.2em' }}>Multiplayer Horror Simulation</p>
          
          <input
            type="text"
            placeholder="ENTER SURVIVOR NAME"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={15}
            className="sh-input"
          />
          <button
            onClick={() => handleJoin(playerName)}
            disabled={!playerName.trim()}
            className="sh-btn"
          >
            INITIALIZE JOIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <Game socket={socket!} gameState={gameState} />
      
      {gameState.phase === 'lobby' && (
        <Lobby gameState={gameState} socket={socket!} />
      )}

      {gameState.phase === 'result' && (
        <div className="sh-result-overlay">
          <div className="text-center">
            <h2 className="font-orbitron" style={{ fontSize: '5rem', fontWeight: 900, color: gameState.winner === 'killer' ? '#dc2626' : '#2563eb' }}>
              {(gameState.winner || 'NONE').toUpperCase()} WINS
            </h2>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
               {gameState.players.filter(p => p.role === (gameState.winner === 'killer' ? 'killer' : 'hider')).slice(0, 3).map(p => (
                 <div key={p.id} style={{ background: '#111', padding: '1rem 1.5rem', borderRadius: '1rem', border: '1px solid #374151' }}>
                   <p style={{ fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>{p.name}</p>
                 </div>
               ))}
            </div>
            <p className="animate-pulse" style={{ marginTop: '3rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.3em' }}>Rebooting in 5s...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;