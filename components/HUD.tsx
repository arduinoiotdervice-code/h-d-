
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
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 font-orbitron">
      {/* Header Info */}
      <div className="flex justify-between items-start">
        <div className="bg-black/80 border border-gray-700 backdrop-blur-lg p-5 rounded-3xl min-w-[180px] shadow-2xl">
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mb-1">Status</p>
          <p className={`text-2xl font-bold ${gameState.phase === 'hunt' ? 'text-red-500' : 'text-blue-500'}`}>
            {(gameState.phase || 'unknown').toUpperCase()}
          </p>
          <div className="mt-1 text-4xl font-black text-white">
            {Math.max(0, Math.floor(gameState.timer))}s
          </div>
        </div>

        <div className="bg-black/80 border border-gray-700 backdrop-blur-lg p-5 rounded-3xl text-right shadow-2xl">
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mb-1">Assigned Role</p>
          <p className={`text-2xl font-bold ${me.role === 'killer' ? 'text-red-600 shadow-red-500/50' : 'text-blue-500'}`}>
            {(me.role || 'hider').toUpperCase()}
          </p>
          <p className={`text-xs mt-1 font-bold ${me.isAlive ? 'text-green-500' : 'text-gray-500'}`}>
            {me.isAlive ? '• OPERATIONAL' : '• ELIMINATED'}
          </p>
        </div>
      </div>

      {/* Dynamic Instruction */}
      <div className="self-center transform transition-all duration-500 scale-110">
        {gameState.phase === 'hide' && (
          <div className="bg-blue-600/20 border border-blue-500/50 px-10 py-5 rounded-2xl backdrop-blur-md animate-pulse">
              <p className="text-blue-400 font-bold uppercase tracking-[0.3em] text-xl">
                  {me.role === 'hider' ? 'CONCEAL YOURSELF' : 'THEY ARE CONCEALING'}
              </p>
          </div>
        )}
        {!me.isAlive && gameState.phase !== 'result' && (
           <div className="bg-gray-900/80 border border-red-500/50 px-10 py-5 rounded-2xl backdrop-blur-md">
              <p className="text-red-600 font-bold uppercase tracking-[0.3em] text-xl animate-bounce">
                  SIGNAL LOST
              </p>
           </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-end">
        <div className="bg-black/80 border border-gray-700 backdrop-blur-lg p-5 rounded-3xl shadow-2xl">
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mb-1">Survivors Remaining</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white">{aliveHiders}</span>
            <span className="text-gray-600 font-bold text-xl">/ {totalHiders}</span>
          </div>
        </div>

        {me.role === 'killer' && gameState.phase === 'hunt' && me.isAlive && (
            <div className="bg-red-600/20 border border-red-500/50 p-6 rounded-3xl animate-pulse backdrop-blur-sm">
                <p className="text-red-500 font-bold uppercase tracking-widest text-sm mb-2 text-center">Active Scan Range</p>
                <div className="flex justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1.5 h-6 bg-red-600 rounded-full animate-[bounce_1s_infinite]" style={{animationDelay: `${i*0.1}s`}}></div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center uppercase tracking-tighter">TARGETING ACTIVE</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default HUD;
