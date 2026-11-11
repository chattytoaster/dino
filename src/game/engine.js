import {
  BASE_SPEED,
  COLLECTIBLE_SIZE,
  FIXED_DT,
  ITEM_DEFINITIONS,
  SCENE_WIDTH,
} from './constants.js';
import {
  applyJump,
  calculateSpeed,
  checkCollision,
  createInitialState,
  getPlayerBox,
  handleCollectiblePickup,
  handleObstacleCollision,
  moveEntities,
  removeActiveItem,
  updateActiveItems,
  updatePhysics,
  updateScore,
} from './rules.js';
import { loadGameState, saveGameState } from './storage.js';
import { fireRecordConfetti } from './confetti.js';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export class GameEngine {
  constructor(options = {}) {
    this.onRender = options.onRender || (() => {});
    this.storage = options.storage || globalThis.localStorage;

    this.state = loadGameState(this.storage);

    this.lastTimestamp = 0;
    this.animId = null;
    this.accumulator = 0;
    this.saveTimer = 0;

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowFocus);
    }

    if (this.state.status === 'running') {
      this.resumeLoop();
    }
  }

  handleVisibilityChange() {
    if (typeof document !== 'undefined' && !document.hidden) {
      this.lastTimestamp = performance.now();
      this.accumulator = 0;
    }
  }

  handleWindowFocus() {
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
  }

  start() {
    const prevRecord = this.state.record;
    const currentName = this.state.playerName;

    this.state = createInitialState(prevRecord, currentName);
    this.state.status = 'running';
    this.saveTimer = 0;
    this.accumulator = 0;

    this.save();
    this.notifyRender();
    this.resumeLoop();
  }

  jump() {
    if (this.state.status !== 'running') {
      this.start();
      return;
    }
    this.state.player = applyJump(this.state.player);
    this.notifyRender();
  }

  setPlayerName(name) {
    this.state.playerName = (name || '').slice(0, 30);
    this.save();
    this.notifyRender();
  }

  removeItem(id) {
    this.state.activeItems = removeActiveItem(this.state.activeItems, id);
    this.save();
    this.notifyRender();
  }

  clearItems() {
    this.state.activeItems = [];
    this.save();
    this.notifyRender();
  }

  resumeLoop() {
    cancelAnimationFrame(this.animId);
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.animId = requestAnimationFrame((now) => this.gameLoop(now));
  }

  stopLoop() {
    cancelAnimationFrame(this.animId);
    this.animId = null;
  }

  calculateSpawnInterval() {
    const speedFactor = BASE_SPEED / Math.max(BASE_SPEED, this.state.speed);
    return Math.max(1.1, 1.4 * speedFactor + Math.random() * 0.9);
  }

  spawnEntities() {
    const rand = Math.random();
    let obsType = 'single';
    let width = 26;
    let height = 44;

    if (rand > 0.65) {
      obsType = 'tall';
      height = 62;
    } else if (rand > 0.4) {
      obsType = 'double';
      width = 48;
      height = 44;
    }

    const obstacle = {
      id: generateId(),
      x: SCENE_WIDTH + 20,
      width,
      height,
      type: obsType,
    };
    this.state.obstacles.push(obstacle);

    if (Math.random() < 0.35) {
      const def = ITEM_DEFINITIONS.shield;
      const collectibleY = Math.random() < 0.5 ? 20 : 90;
      this.state.collectibles.push({
        id: generateId(),
        x: SCENE_WIDTH + 140,
        y: collectibleY,
        width: COLLECTIBLE_SIZE,
        height: COLLECTIBLE_SIZE,
        type: 'shield',
        name: def.name,
        icon: def.icon,
      });
    }
  }

  tick(dt) {
    this.state.player = updatePhysics(this.state.player, dt);
    this.state.score = updateScore(this.state.score, this.state.speed, dt);
    const currentScoreInt = Math.floor(this.state.score);

    if (currentScoreInt > this.state.record) {
      if (
        !this.state.hasFiredRecordConfettiThisRun &&
        this.state.recordAtStart > 0 &&
        currentScoreInt > this.state.recordAtStart
      ) {
        fireRecordConfetti();
        this.state.hasFiredRecordConfettiThisRun = true;
      }
      this.state.record = currentScoreInt;
    }

    this.state.speed = calculateSpeed(this.state.score);

    this.state.spawnTimer += dt;
    if (this.state.spawnTimer >= this.state.nextSpawnInterval) {
      this.spawnEntities();
      this.state.spawnTimer = 0;
      this.state.nextSpawnInterval = this.calculateSpawnInterval();
    }

    this.state.obstacles = moveEntities(this.state.obstacles, this.state.speed, dt);
    this.state.collectibles = moveEntities(this.state.collectibles, this.state.speed, dt);
    this.state.activeItems = updateActiveItems(this.state.activeItems, dt);

    const playerBox = getPlayerBox(this.state.player);

    const remainingCollectibles = [];
    for (const item of this.state.collectibles) {
      const itemBox = {
        x: item.x,
        y: item.y,
        width: item.width ?? COLLECTIBLE_SIZE,
        height: item.height ?? COLLECTIBLE_SIZE,
      };
      if (checkCollision(playerBox, itemBox)) {
        this.state = handleCollectiblePickup(this.state, item);
      } else {
        remainingCollectibles.push(item);
      }
    }
    this.state.collectibles = remainingCollectibles;

    let gameOverTriggered = false;
    const remainingObstacles = [];
    for (const obstacle of this.state.obstacles) {
      const obstacleBox = {
        x: obstacle.x,
        y: 0,
        width: obstacle.width,
        height: obstacle.height,
      };

      if (!gameOverTriggered && checkCollision(playerBox, obstacleBox)) {
        const result = handleObstacleCollision(this.state);
        this.state = result;
        if (result.status === 'gameover') {
          gameOverTriggered = true;
        } else if (result.shieldSaved) {
          continue;
        }
      }
      remainingObstacles.push(obstacle);
    }
    this.state.obstacles = remainingObstacles;

    if (gameOverTriggered) {
      this.save();
      this.stopLoop();
      return;
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 1.0) {
      this.save();
      this.saveTimer = 0;
    }
  }

  gameLoop(now) {
    if (this.state.status !== 'running') {
      return;
    }

    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    // Защита от спирали смерти при задержке кадров (максимум 0.25с накопления за кадр)
    this.accumulator += Math.min(Math.max(rawDt, 0), 0.25);

    while (this.accumulator >= FIXED_DT) {
      this.tick(FIXED_DT);
      this.accumulator -= FIXED_DT;
      if (this.state.status !== 'running') {
        break;
      }
    }

    this.notifyRender();

    if (this.state.status === 'running') {
      this.animId = requestAnimationFrame((nextNow) => this.gameLoop(nextNow));
    }
  }

  save() {
    saveGameState(this.state, this.storage);
  }

  notifyRender() {
    this.onRender(this.state);
  }

  destroy() {
    this.stopLoop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowFocus);
    }
  }
}
