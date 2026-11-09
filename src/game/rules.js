import {
  BASE_SPEED,
  GRAVITY,
  JUMP_SPEED,
  MAX_SPEED,
  SPEED_GROWTH,
  PLAYER_X,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
} from './constants.js';

/**
 * Создаёт начальное состояние игры.
 */
export function createInitialState(record = 0, playerName = 'Дино') {
  return {
    status: 'ready',
    score: 0,
    record: Math.max(0, Math.floor(record)),
    speed: BASE_SPEED,
    playerName: playerName || 'Дино',
    player: {
      y: 0,
      vy: 0,
      isJumping: false,
    },
    obstacles: [],
    collectibles: [],
    activeItems: [],
    savedAt: Date.now(),
  };
}

/**
 * Правило 1: прыжок игрока.
 * Начинает прыжок только если игрок находится на земле.
 */
export function applyJump(player) {
  if (player.isJumping || player.y > 0) {
    return player;
  }
  return {
    ...player,
    isJumping: true,
    vy: JUMP_SPEED,
  };
}

/**
 * Правило 2: гравитация и физика перемещения игрока.
 */
export function updatePhysics(player, dt) {
  if (!player.isJumping && player.y === 0) {
    return player;
  }

  const newVy = player.vy - GRAVITY * dt;
  const newY = player.y + player.vy * dt;

  if (newY <= 0) {
    return {
      y: 0,
      vy: 0,
      isJumping: false,
    };
  }

  return {
    y: newY,
    vy: newVy,
    isJumping: true,
  };
}

/**
 * Проверка столкновения двух прямоугольников с учётом отступов (хитбоксов).
 */
export function checkCollision(playerBox, entityBox) {
  const padX = 8;
  const padY = 6;

  const aLeft = playerBox.x + padX;
  const aRight = playerBox.x + playerBox.width - padX;
  const aBottom = playerBox.y + padY;
  const aTop = playerBox.y + playerBox.height - padY;

  const bLeft = entityBox.x + padX;
  const bRight = entityBox.x + entityBox.width - padX;
  const bBottom = entityBox.y;
  const bTop = entityBox.y + entityBox.height;

  return aLeft < bRight && aRight > bLeft && aBottom < bTop && aTop > bBottom;
}

/**
 * Правило 3: начисление очков и пересчёт скорости.
 */
export function updateScore(currentScore, speed, dt) {
  const points = (speed / 10) * dt;
  return currentScore + points;
}

/**
 * Пересчёт скорости бега в зависимости от счёта.
 */
export function calculateSpeed(score) {
  return Math.min(MAX_SPEED, BASE_SPEED + score * (SPEED_GROWTH / 10));
}

/**
 * Правило 4: обработка столкновения с препятствием.
 * Если есть активный щит, он расходуется и игра продолжается.
 * Иначе наступает gameover.
 */
export function handleObstacleCollision(state) {
  const shieldIndex = state.activeItems.findIndex((item) => item.type === 'shield');

  if (shieldIndex !== -1) {
    const updatedItems = [...state.activeItems];
    updatedItems.splice(shieldIndex, 1);
    return {
      ...state,
      activeItems: updatedItems,
      shieldSaved: true,
    };
  }

  const finalScore = Math.floor(state.score);
  return {
    ...state,
    status: 'gameover',
    score: finalScore,
    record: Math.max(state.record, finalScore),
    shieldSaved: false,
  };
}

/**
 * Правило 5: подбор щита (бонуса).
 */
export function handleCollectiblePickup(state, collectible) {
  if (collectible.type !== 'shield') {
    return state;
  }

  return {
    ...state,
    activeItems: [
      ...state.activeItems,
      {
        id: collectible.id,
        type: 'shield',
        name: collectible.name,
        icon: collectible.icon,
      },
    ],
  };
}

/**
 * Правило 6: работа со списком активных предметов (добавление).
 */
export function addActiveItem(items, item) {
  return [...items, item];
}

/**
 * Правило 7: работа со списком активных предметов (удаление).
 */
export function removeActiveItem(items, itemId) {
  return items.filter((item) => item.id !== itemId);
}

/**
 * Правило 8: обновление активных предметов (удаление истёкших по таймеру при наличии).
 */
export function updateActiveItems(items, dt) {
  const result = [];
  for (const item of items) {
    if (typeof item.timeLeft === 'number') {
      const nextTime = item.timeLeft - dt;
      if (nextTime > 0) {
        result.push({ ...item, timeLeft: nextTime });
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Перемещение препятствий и подбираемых предметов.
 */
export function moveEntities(entities, speed, dt) {
  return entities
    .map((entity) => ({
      ...entity,
      x: entity.x - speed * dt,
    }))
    .filter((entity) => entity.x + entity.width > -50);
}

/**
 * Получение текущего хитбокса игрока.
 */
export function getPlayerBox(player) {
  return {
    x: PLAYER_X,
    y: player.y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };
}
