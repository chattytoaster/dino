import { BASE_SPEED, ITEM_DEFINITIONS, SCENE_WIDTH } from './constants.js';
import {
  applyJump,
  calculateSpeed,
  checkCollision,
  createInitialState,
  getPlayerBox,
  handleCollectiblePickup,
  handleObstacleCollision,
  moveEntities,
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

    // Загрузка состояния (с Zod-валидацией и защитой от испорченных данных)
    this.state = loadGameState(this.storage);

    this.lastTimestamp = 0;
    this.animId = null;
    this.spawnTimer = 0;
    this.nextSpawnInterval = 1.8;
    this.saveTimer = 0;

    // Фиксация рекорда на начало партии и флаг однократного салюта
    this.recordAtStart = this.state.record;
    this.hasFiredRecordConfettiThisRun = false;

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowFocus);
    }

    // Если сохранённая игра была в состоянии running, продолжаем забег
    if (this.state.status === 'running') {
      this.resumeLoop();
    }
  }

  handleVisibilityChange() {
    if (typeof document !== 'undefined' && !document.hidden) {
      // Сброс таймстемпа при возврате на вкладку, чтобы не было скачка скорости
      this.lastTimestamp = performance.now();
    }
  }

  handleWindowFocus() {
    this.lastTimestamp = performance.now();
  }

  start() {
    const prevRecord = this.state.record;
    const currentName = this.state.playerName;

    this.state = createInitialState(prevRecord, currentName);
    this.state.status = 'running';
    this.recordAtStart = prevRecord;
    this.hasFiredRecordConfettiThisRun = false;

    this.spawnTimer = 0;
    this.nextSpawnInterval = 1.6;
    this.saveTimer = 0;

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
    this.state.playerName = name.slice(0, 30);
    this.save();
    this.notifyRender();
  }

  addBonus(_type = 'shield') {
    const def = ITEM_DEFINITIONS.shield;
    const newItem = {
      id: generateId(),
      type: 'shield',
      name: def.name,
      icon: def.icon,
    };
    this.state.activeItems = [...this.state.activeItems, newItem];
    this.save();
    this.notifyRender();
  }

  removeItem(id) {
    this.state.activeItems = this.state.activeItems.filter((item) => item.id !== id);
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
    // Случайный тип препятствия
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

    // С шансом 35% спавним подбираемый щит
    if (Math.random() < 0.35) {
      const def = ITEM_DEFINITIONS.shield;
      const collectibleY = Math.random() < 0.5 ? 20 : 90;
      this.state.collectibles.push({
        id: generateId(),
        x: SCENE_WIDTH + 140,
        y: collectibleY,
        type: 'shield',
        name: def.name,
        icon: def.icon,
      });
    }
  }

  gameLoop(now) {
    if (this.state.status !== 'running') {
      return;
    }

    const rawDt = (now - this.lastTimestamp) / 1000;
    // Ограничиваем dt (не более 50 мс), чтобы скорость была одинаковой
    // на 60 и 120+ Гц и не происходило скачков при возврате на вкладку
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    this.lastTimestamp = now;

    // 1. Физика прыжка и гравитация
    this.state.player = updatePhysics(this.state.player, dt);

    // 2. Начисление очков
    this.state.score = updateScore(this.state.score, this.state.speed, dt);
    const currentScoreInt = Math.floor(this.state.score);

    // 3. Рекорд и салют: конфетти вылетают только один раз при первом побитии рекорда за партию
    if (currentScoreInt > this.state.record) {
      if (
        !this.hasFiredRecordConfettiThisRun &&
        this.recordAtStart > 0 &&
        currentScoreInt > this.recordAtStart
      ) {
        fireRecordConfetti();
        this.hasFiredRecordConfettiThisRun = true;
      }
      this.state.record = currentScoreInt;
    }

    // 4. Постепенное увеличение скорости
    this.state.speed = calculateSpeed(this.state.score);

    // 5. Спавн препятствий и щитов
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnEntities();
      this.spawnTimer = 0;
      this.nextSpawnInterval = this.calculateSpawnInterval();
    }

    // 6. Перемещение объектов
    this.state.obstacles = moveEntities(this.state.obstacles, this.state.speed, dt);
    this.state.collectibles = moveEntities(this.state.collectibles, this.state.speed, dt);

    // 7. Обновление активных предметов
    this.state.activeItems = updateActiveItems(this.state.activeItems, dt);

    // 8. Проверка столкновений
    const playerBox = getPlayerBox(this.state.player);

    // Подбор щитов
    const remainingCollectibles = [];
    for (const item of this.state.collectibles) {
      const itemBox = { x: item.x, y: item.y, width: 32, height: 32 };
      if (checkCollision(playerBox, itemBox)) {
        this.state = handleCollectiblePickup(this.state, item);
      } else {
        remainingCollectibles.push(item);
      }
    }
    this.state.collectibles = remainingCollectibles;

    // Столкновение с препятствиями
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
          // Препятствие разрушено щитом, убираем его с поля
          continue;
        }
      }
      remainingObstacles.push(obstacle);
    }
    this.state.obstacles = remainingObstacles;

    if (gameOverTriggered) {
      this.save();
      this.notifyRender();
      this.stopLoop();
      return;
    }

    // 9. Автосохранение раз в секунду
    this.saveTimer += dt;
    if (this.saveTimer >= 1.0) {
      this.save();
      this.saveTimer = 0;
    }

    this.notifyRender();
    this.animId = requestAnimationFrame((nextNow) => this.gameLoop(nextNow));
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
