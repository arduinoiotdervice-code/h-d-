
import React from 'react';
import { GameState } from '../types';
import { CONFIG } from '../constants';

interface LobbyProps {
  gameState: GameState;
}

const Lobby: React.FC<LobbyProps> = ({ gameState }) => {
  const minPlayers = 3; // From server config
  const playerCount = gameState.players.length;
  const isReady = playerCount >= minPlayers;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#111] border border-gray-800 rounded-3xl p-10 shadow-2xl">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-4xl font-orbitron font-bold text-red-600">LOBBY</h2>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 uppercase tracking-widest text-sm">Status:</span>
            <span className={`px-4 py-1 rounded-full text-sm font-bold ${isReady ? 'bg-green-600/20 text-green-500' : 'bg-yellow-600/20 text-yellow-500'}`}>
              {isReady ? 'READY TO HUNT' : 'WAITING FOR VICTIMS'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto mb-10 p-2">
          {gameState.players.map((player) => (
            <div key={player.id} className="flex items-center gap-4 bg-[#0a0a0a] border border-gray-800 p-4 rounded-xl group transition-all hover:border-red-600/50">
              <div className={`w-3 h-3 rounded-full ${player.id === gameState.myId ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-gray-600'}`}></div>
              <span className={`text-lg font-medium ${player.id === gameState.myId ? 'text-blue-400 font-bold' : 'text-gray-300'}`}>
                {player.name} {player.id === gameState.myId && '(YOU)'}
              </span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 6 - playerCount) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-4 bg-[#0a0a0a]/50 border border-gray-900 border-dashed p-4 rounded-xl opacity-30">
              <div className="w-3 h-3 rounded-full bg-gray-800"></div>
              <span className="text-gray-600 italic">Searching...</span>
            </div>
          ))}
        </div>

        {isReady ? (
          <div className="text-center space-y-4">
            <p className="text-3xl font-orbitron text-red-500 animate-pulse">STARTING IN {gameState.timer}s</p>
            <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
               <div 
                className="bg-red-600 h-full transition-all duration-1000" 
                style={{ width: `${(gameState.timer / 20) * 100}%` }}
               ></div>
            </div>
          </div>
        ) : (
          <div className="text-center">
             <p className="text-gray-500 font-medium">Need {minPlayers - playerCount} more player(s) to begin the horror...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
