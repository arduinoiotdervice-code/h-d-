
export type Role = 'hider' | 'killer';
export type GamePhase = 'lobby' | 'hide' | 'hunt' | 'result';

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  role: Role;
  isAlive: boolean;
  score?: number;
}

export interface GameState {
  players: Player[];
  phase: GamePhase;
  timer: number;
  myId: string | null;
  winner?: string;
}

export interface MapData {
  tiles: number[][];
  spawnPoints: { x: number; y: number }[];
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}
