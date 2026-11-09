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
} from '../src/game/rules.js';
import { BASE_SPEED, JUMP_SPEED, MAX_SPEED } from '../src/game/constants.js';

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
      assert.equal(result.activeItems.length, 0); // щит израсходован
    });
  });

  describe('Правило 4: Начисление очков и рост скорости', () => {
    it('очки начисляются пропорционально скорости и времени', () => {
      const score = updateScore(10, 300, 1);
      // points = (300 / 10) * 1 = 30
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
    it('щит успешно добавляется в список', () => {
      const items = [];
      const item = { id: 'shield-1', type: 'shield', name: 'Щит', icon: '🛡️' };
      const updated = addActiveItem(items, item);

      assert.equal(updated.length, 1);
      assert.equal(updated[0].id, 'shield-1');
      assert.equal(updated[0].type, 'shield');
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
      const collectible = { id: 'shield-road-1', type: 'shield', name: 'Защитный щит', icon: '🛡️' };
      const updated = handleCollectiblePickup(state, collectible);

      assert.equal(updated.activeItems.length, 1);
      assert.equal(updated.activeItems[0].type, 'shield');
    });
  });

  describe('Правило 6: Побитие рекорда за партию (конфетти только 1 раз)', () => {
    it('салют срабатывает ровно один раз при первом превышении рекорда', () => {
      const recordAtStart = 100;
      let hasFiredConfetti = false;
      let fireCount = 0;

      const checkRecordBreak = (score) => {
        if (!hasFiredConfetti && recordAtStart > 0 && score > recordAtStart) {
          fireCount += 1;
          hasFiredConfetti = true;
        }
      };

      checkRecordBreak(99);
      assert.equal(fireCount, 0);

      checkRecordBreak(101); // первое побитие рекорда
      assert.equal(fireCount, 1);

      checkRecordBreak(102); // дальнейший рост очков в той же партии
      checkRecordBreak(150);
      checkRecordBreak(200);
      assert.equal(fireCount, 1); // не должен повторно вызываться
    });
  });
});
