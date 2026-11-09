export const SCENE_WIDTH = 840;
export const SCENE_HEIGHT = 280;

export const PLAYER_X = 80;
export const PLAYER_WIDTH = 48;
export const PLAYER_HEIGHT = 50;

export const GRAVITY = 1800; // px / s^2
export const JUMP_SPEED = 650; // px / s

export const BASE_SPEED = 320; // px / s
export const MAX_SPEED = 680; // px / s
export const SPEED_GROWTH = 1.8; // px / s per point

export const STORAGE_KEY = 'dino-game-state';

export const ITEM_DEFINITIONS = {
  shield: {
    type: 'shield',
    name: 'Защитный щит',
    icon: '🛡️',
    description: 'Спасает от одного столкновения',
  },
};
