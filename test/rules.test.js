import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyJump,
  updatePhysics,
  checkCollision,
  handleObstacleCollision,
  handleCollectiblePickup,
  updateScore,
  calculateSpeed,
  addActiveItem,
  removeActiveItem,
  createInitialState,
  moveEntities,
  updateRecord,
  updateActiveItems,
  getPlayerBox,
} from '../src/game/rules.js';
import { BASE_SPEED, JUMP_SPEED, MAX_SPEED, MAX_ACTIVE_ITEMS } from '../src/game/constants.js';

describe('Правила игры (game rules)', () => {
  describe('Правило 1: Физика прыжка и ограничения в воздухе', () => {
    it('игрок на земле начинает прыжок с заданной начальной скоростью', () => {
      const groundPlayer = { y: 0, vy: 0, isJumping: false };
      const jumpingPlayer = applyJump(groundPlayer);

      assert.equal(jumpingPlayer.isJumping, true);
      assert.equal(jumpingPlayer.vy, JUMP_SPEED);
      assert.equal(jumpingPlayer.y, 0);
    });

    it('игрок уже в воздухе не может прыгнуть повторно', () => {
      const midAirPlayer = { y: 40, vy: 200, isJumping: true };
      const result = applyJump(midAirPlayer);

      assert.equal(result.vy, 200);
      assert.equal(result.y, 40);
    });

    it('гравитация тянет игрока вниз и при приземлении сбрасывает скорость', () => {
      const player = { y: 20, vy: -100, isJumping: true };
      const dt = 0.5;
      const landedPlayer = updatePhysics(player, dt);

      assert.equal(landedPlayer.y, 0);
      assert.equal(landedPlayer.vy, 0);
      assert.equal(landedPlayer.isJumping, false);
    });
  });

  describe('Правило 2: Определение столкновений (hitbox collision)', () => {
    it('фиксирует столкновение, когда хитбоксы игрока и препятствия пересекаются', () => {
      const playerBox = { x: 80, y: 0, width: 48, height: 50 };
      const obstacleBox = { x: 90, y: 0, width: 26, height: 44 };

      const isHit = checkCollision(playerBox, obstacleBox);
      assert.equal(isHit, true);
    });

    it('не фиксирует столкновение, если препятствие далеко впереди', () => {
      const playerBox = { x: 80, y: 0, width: 48, height: 50 };
      const farObstacleBox = { x: 500, y: 0, width: 26, height: 44 };

      const isHit = checkCollision(playerBox, farObstacleBox);
      assert.equal(isHit, false);
    });

    it('не фиксирует столкновение, если игрок перепрыгнул препятствие', () => {
      const jumpingPlayerBox = { x: 80, y: 80, width: 48, height: 50 };
      const lowObstacleBox = { x: 85, y: 0, width: 26, height: 40 };

      const isHit = checkCollision(jumpingPlayerBox, lowObstacleBox);
      assert.equal(isHit, false);
    });
  });

  describe('Правило 3: Столкновение с препятствием и спасение щитом', () => {
    it('столкновение без щита приводит к завершению игры (gameover)', () => {
      const state = {
        ...createInitialState(100),
        status: 'running',
        score: 150,
        record: 100,
        activeItems: [],
      };

      const result = handleObstacleCollision(state);

      assert.equal(result.status, 'gameover');
      assert.equal(result.shieldSaved, false);
      assert.equal(result.record, 150);
    });

    it('наличие щита поглощает удар, тратит щит и спасает от gameover', () => {
      const state = {
        ...createInitialState(100),
        status: 'running',
        score: 80,
        activeItems: [{ id: 'shield-1', type: 'shield', name: 'Защитный щит', icon: '🛡️' }],
      };

      const result = handleObstacleCollision(state);

      assert.equal(result.status, 'running');
      assert.equal(result.shieldSaved, true);
      assert.equal(result.activeItems.length, 0);
    });
  });

  describe('Правило 4: Начисление очков и рост скорости', () => {
    it('очки начисляются пропорционально скорости и времени', () => {
      const score = updateScore(10, 300, 1);
      assert.equal(score, 40);
    });

    it('скорость растёт вместе со счётом, но не превышает MAX_SPEED', () => {
      const startSpeed = calculateSpeed(0);
      assert.equal(startSpeed, BASE_SPEED);

      const highSpeed = calculateSpeed(10000);
      assert.equal(highSpeed, MAX_SPEED);
    });
  });

  describe('Правило 5: Работа со списком активных предметов (щитов)', () => {
    it('щит успешно добавляется в список с ограничением максимума', () => {
      let items = [];
      const item = { id: 'shield-1', type: 'shield', name: 'Щит', icon: '🛡️' };
      items = addActiveItem(items, item);

      assert.equal(items.length, 1);
      assert.equal(items[0].id, 'shield-1');
      assert.equal(items[0].type, 'shield');

      for (let i = 2; i <= MAX_ACTIVE_ITEMS + 2; i++) {
        items = addActiveItem(items, {
          id: `shield-${i}`,
          type: 'shield',
          name: 'Щит',
          icon: '🛡️',
        });
      }
      assert.equal(items.length, MAX_ACTIVE_ITEMS);
    });

    it('щит успешно удаляется из списка по id', () => {
      const items = [
        { id: 'shield-1', type: 'shield', name: 'Щит 1', icon: '🛡️' },
        { id: 'shield-2', type: 'shield', name: 'Щит 2', icon: '🛡️' },
      ];
      const updated = removeActiveItem(items, 'shield-1');

      assert.equal(updated.length, 1);
      assert.equal(updated[0].id, 'shield-2');
    });

    it('подбор щита на трассе добавляет его в список активных предметов', () => {
      const state = createInitialState();
      const collectible = {
        id: 'shield-road-1',
        type: 'shield',
        name: 'Защитный щит',
        icon: '🛡️',
        width: 32,
        height: 32,
      };
      const updated = handleCollectiblePickup(state, collectible);

      assert.equal(updated.activeItems.length, 1);
      assert.equal(updated.activeItems[0].type, 'shield');
    });
  });

  describe('Правило 6: Движение сущностей (препятствий и бонусов)', () => {
    it('бонусы перемещаются по экрану и не отфильтровываются ошибочно', () => {
      const collectibles = [
        { id: 'c-1', x: 200, y: 20, width: 32, height: 32, type: 'shield' },
        { id: 'c-2', x: 100, y: 80, type: 'shield' }, // без явного указания width
      ];
      const moved = moveEntities(collectibles, 100, 0.5);

      assert.equal(moved.length, 2);
      assert.equal(moved[0].x, 150);
      assert.equal(moved[1].x, 50);
    });
  });

  describe('Правило 7: Побитие рекорда за партию (конфетти только 1 раз)', () => {
    it('функция updateRecord обновляет рекорд и вызывает коллбэк салюта ровно один раз за забег', () => {
      let state = {
        ...createInitialState(100),
        status: 'running',
        record: 100,
        recordAtStart: 100,
        hasFiredRecordConfettiThisRun: false,
      };
      let fireCount = 0;
      const onRecordBreak = () => {
        fireCount += 1;
      };

      state = updateRecord(state, 99, onRecordBreak);
      assert.equal(state.record, 100);
      assert.equal(fireCount, 0);
      assert.equal(state.hasFiredRecordConfettiThisRun, false);

      state = updateRecord(state, 101, onRecordBreak);
      assert.equal(state.record, 101);
      assert.equal(fireCount, 1);
      assert.equal(state.hasFiredRecordConfettiThisRun, true);

      state = updateRecord(state, 102, onRecordBreak);
      state = updateRecord(state, 150, onRecordBreak);
      assert.equal(state.record, 150);
      assert.equal(fireCount, 1);
    });

    it('при recordAtStart равном 0 салют не вызывается', () => {
      let state = {
        ...createInitialState(0),
        status: 'running',
        record: 0,
        recordAtStart: 0,
        hasFiredRecordConfettiThisRun: false,
      };
      let fireCount = 0;
      state = updateRecord(state, 10, () => {
        fireCount += 1;
      });
      assert.equal(state.record, 10);
      assert.equal(fireCount, 0);
    });

    it('после перезагрузки страницы с hasFiredRecordConfettiThisRun: true салют не вызывается повторно', () => {
      let state = {
        ...createInitialState(100),
        status: 'running',
        record: 150,
        recordAtStart: 100,
        hasFiredRecordConfettiThisRun: true,
      };
      let fireCount = 0;
      state = updateRecord(state, 160, () => {
        fireCount += 1;
      });
      assert.equal(state.record, 160);
      assert.equal(fireCount, 0);
    });
  });

  describe('Правило 8: Обновление таймеров активных предметов', () => {
    it('уменьшает timeLeft и удаляет истёкшие предметы, сохраняя бессрочные', () => {
      const items = [
        { id: '1', type: 'shield', name: 'Временный', icon: '🛡️', timeLeft: 1.0 },
        { id: '2', type: 'shield', name: 'Постоянный', icon: '🛡️' },
      ];

      const afterHalfSec = updateActiveItems(items, 0.5);
      assert.equal(afterHalfSec.length, 2);
      assert.equal(afterHalfSec[0].timeLeft, 0.5);

      const afterExpiry = updateActiveItems(afterHalfSec, 0.6);
      assert.equal(afterExpiry.length, 1);
      assert.equal(afterExpiry[0].id, '2');
    });
  });

  describe('Правило 9: Получение хитбокса игрока', () => {
    it('возвращает корректные координаты и размеры хитбокса', () => {
      const player = { y: 45, vy: 100, isJumping: true };
      const box = getPlayerBox(player);

      assert.equal(box.x, 80);
      assert.equal(box.y, 45);
      assert.equal(box.width, 48);
      assert.equal(box.height, 50);
    });
  });
});
