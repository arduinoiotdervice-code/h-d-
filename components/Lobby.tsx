
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
    <div className="absolute inset-0 z-[4000] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#0a0a0a] border border-gray-800 rounded-[2rem] p-10 shadow-[0_0_50px_rgba(0,0,0,1)] relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px]"></div>

        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <h2 className="text-5xl font-orbitron font-black text-white tracking-tighter">
              LOBBY<span className="text-red-600">_</span>
            </h2>
            <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-xs">Waiting for tactical readiness</p>
          </div>
          <div className="text-right">
            <span className="text-gray-500 block text-[10px] uppercase tracking-widest mb-1">Squad Strength</span>
            <span className="text-3xl font-black text-white">{playerCount}<span className="text-gray-600 text-xl">/8</span></span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 max-h-[320px] overflow-y-auto mb-8 pr-2 relative z-10">
          {gameState.players.map((player) => (
            <div key={player.id} className={`flex items-center justify-between bg-[#111] border ${player.id === gameState.myId ? 'border-blue-500/30' : 'border-gray-800/50'} p-4 rounded-2xl transition-all`}>
              <div className="flex items-center gap-4">
                <div className={`w-2 h-8 rounded-full ${player.isReady ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-600 animate-pulse'}`}></div>
                <div>
                  <span className={`text-lg font-bold block ${player.id === gameState.myId ? 'text-blue-400' : 'text-gray-200'}`}>
                    {player.name} {player.id === gameState.myId && <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded text-blue-400 ml-2">YOU</span>}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-tighter ${player.isReady ? 'text-green-500' : 'text-red-600'}`}>
                    {player.isReady ? 'Ready for deployment' : 'Awaiting confirmation'}
                  </span>
                </div>
              </div>
              {player.isReady && (
                <div className="bg-green-500/10 p-2 rounded-full border border-green-500/20">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              )}
            </div>
          ))}
          
          {playerCount < minPlayers && (
            <div className="p-4 rounded-2xl border border-dashed border-gray-800 text-center">
              <p className="text-gray-600 text-sm italic font-medium">Need {minPlayers - playerCount} more player(s) to initialize systems...</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 relative z-10">
          <button
            onClick={toggleReady}
            className={`w-full py-5 rounded-2xl font-orbitron font-black text-xl tracking-widest transition-all shadow-lg active:scale-95 border-b-4 ${
              me?.isReady 
              ? 'bg-green-600 hover:bg-green-500 border-green-800 text-white' 
              : 'bg-red-600 hover:bg-red-500 border-red-800 text-white'
            }`}
          >
            {me?.isReady ? 'SYSTEMS READY' : 'PREPARE FOR HUNT'}
          </button>

          {everyoneReady && (
            <div className="text-center bg-white/5 p-4 rounded-2xl border border-white/10 animate-pulse">
               <p className="text-white font-orbitron font-bold text-lg uppercase tracking-widest">
                Deployment in {gameState.timer}s
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
