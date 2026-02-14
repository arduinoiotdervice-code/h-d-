
import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { GameState, Player, GamePhase } from './types';

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
          <p className="text-gray-400 font-medium tracking-widest uppercase text-xs">Multiplayer Horror Simulation</p>
          
          <div className="bg-[#111] p-8 rounded-3xl border border-gray-800 shadow-2xl space-y-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
            <input
              type="text"
              placeholder="ENTER SURVIVOR NAME"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={15}
              className="w-full bg-[#0a0a0a] text-white border-2 border-gray-800 p-4 rounded-2xl focus:outline-none focus:border-red-600 transition-all font-bold font-orbitron text-center"
            />
            <button
              onClick={() => handleJoin(playerName)}
              disabled={!playerName.trim()}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white font-black py-5 rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-[0.2em] font-orbitron"
            >
              INITIALIZE JOIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white">
      <Game socket={socket!} gameState={gameState} />
      
      {gameState.phase === 'lobby' && (
        <Lobby gameState={gameState} socket={socket!} />
      )}

      {gameState.phase === 'result' && (
        <div className="absolute inset-0 z-[6000] flex items-center justify-center bg-black/95 animate-in fade-in duration-1000">
          <div className="text-center space-y-8">
            <h2 className={`text-8xl font-orbitron font-black tracking-tighter ${gameState.winner === 'killer' ? 'text-red-600' : 'text-blue-500'}`}>
              {(gameState.winner || 'NONE').toUpperCase()} WINS
            </h2>
            <div className="flex justify-center gap-4">
               {gameState.players.slice(0, 4).map(p => (
                 <div key={p.id} className="bg-[#111] p-6 rounded-3xl border border-gray-800 w-40">
                   <p className="font-black text-xl mb-1">{p.name}</p>
                   <p className={`text-[10px] font-bold uppercase tracking-widest ${p.role === 'killer' ? 'text-red-600' : 'text-blue-500'}`}>
                    {p.role}
                   </p>
                 </div>
               ))}
            </div>
            <p className="text-gray-500 font-orbitron font-bold uppercase tracking-widest animate-pulse">Rebooting in 5s...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
