import {
  BASE_SPEED,
  GRAVITY,
  JUMP_SPEED,
  MAX_SPEED,
  SPEED_GROWTH,
  PLAYER_X,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  COLLECTIBLE_SIZE,
  MAX_ACTIVE_ITEMS,
} from './constants.js';

export function createInitialState(record = 0, playerName = 'Дино') {
  const safeRecord = Math.max(0, Math.min(99999, Math.floor(record) || 0));
  return {
    status: 'ready',
    score: 0,
    record: safeRecord,
    speed: BASE_SPEED,
    playerName: (playerName || 'Дино').slice(0, 30),
    player: {
      y: 0,
      vy: 0,
      isJumping: false,
    },
    obstacles: [],
    collectibles: [],
    activeItems: [],
    spawnTimer: 0,
    nextSpawnInterval: 1.8,
    recordAtStart: safeRecord,
    hasFiredRecordConfettiThisRun: false,
    savedAt: Date.now(),
  };
}

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

export function updateScore(currentScore, speed, dt) {
  const points = (speed / 10) * dt;
  return currentScore + points;
}

export function calculateSpeed(score) {
  return Math.min(MAX_SPEED, BASE_SPEED + score * (SPEED_GROWTH / 10));
}

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

export function addActiveItem(items, item) {
  if (items.length >= MAX_ACTIVE_ITEMS) {
    return items;
  }
  return [...items, item];
}

export function removeActiveItem(items, itemId) {
  return items.filter((item) => item.id !== itemId);
}

export function handleCollectiblePickup(state, collectible) {
  if (collectible.type !== 'shield' || state.activeItems.length >= MAX_ACTIVE_ITEMS) {
    return state;
  }

  const item = {
    id: collectible.id,
    type: 'shield',
    name: collectible.name,
    icon: collectible.icon,
  };

  return {
    ...state,
    activeItems: addActiveItem(state.activeItems, item),
  };
}

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

export function moveEntities(entities, speed, dt) {
  return entities
    .map((entity) => ({
      ...entity,
      x: entity.x - speed * dt,
    }))
    .filter((entity) => {
      const width = entity.width ?? COLLECTIBLE_SIZE;
      return entity.x + width > -50;
    });
}

export function getPlayerBox(player) {
  return {
    x: PLAYER_X,
    y: player.y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };
}
