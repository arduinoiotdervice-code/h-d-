
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { GameState, Player, GamePhase } from './types';
import { CONFIG } from './constants';

const SERVER_URL = "https://hide-seek-server-l7u3.onrender.com";

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
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      console.log('Connected to server:', newSocket.id);
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
    if (socket) {
      socket.emit('joinRoom', { name });
      setPlayerName(name);
    }
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <h1 className="text-6xl font-orbitron font-bold text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
            SHADOW HUNT
          </h1>
          <p className="text-gray-400 font-medium">Multiplayer Hide & Seek Nightmare</p>
          
          <div className="bg-[#111] p-8 rounded-2xl border border-gray-800 shadow-2xl space-y-6">
            <input
              type="text"
              placeholder="Enter Survivor Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={15}
              className="w-full bg-[#0a0a0a] text-white border-2 border-gray-800 p-4 rounded-xl focus:outline-none focus:border-red-600 transition-all font-semibold"
            />
            <button
              onClick={() => handleJoin(playerName)}
              disabled={!playerName.trim()}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-widest"
            >
              Join the Hunt
            </button>
          </div>
          
          <div className="text-xs text-gray-600 space-y-1">
            <p>WASD / Arrows to Move</p>
            <p>Mouse to Look / Aim</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <Game socket={socket!} gameState={gameState} />
      
      {gameState.phase === 'lobby' && (
        <Lobby gameState={gameState} />
      )}

      {gameState.phase === 'result' && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 animate-in fade-in duration-1000">
          <div className="text-center space-y-6">
            <h2 className={`text-7xl font-orbitron font-bold ${gameState.winner === 'killer' ? 'text-red-600' : 'text-blue-500'}`}>
              {gameState.winner?.toUpperCase()} WINS
            </h2>
            <p className="text-gray-400 text-xl">Returning to lobby soon...</p>
            <div className="mt-8 flex justify-center gap-4">
               {gameState.players.slice(0, 3).map(p => (
                 <div key={p.id} className="bg-[#111] p-4 rounded-lg border border-gray-800">
                   <p className="font-bold">{p.name}</p>
                   <p className="text-xs text-gray-500">{p.role}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
