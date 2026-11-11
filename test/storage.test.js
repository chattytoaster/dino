import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadGameState, saveGameState } from '../src/game/storage.js';
import { createInitialState } from '../src/game/rules.js';

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

describe('Сохранение и валидация через Zod (storage and recovery)', () => {
  it('возвращает исходное начальное состояние, если хранилище пустое', () => {
    const storage = new MockStorage();
    const state = loadGameState(storage);

    assert.equal(state.status, 'ready');
    assert.equal(state.score, 0);
    assert.equal(Array.isArray(state.activeItems), true);
  });

  it('корректно сохраняет и восстанавливает валидное состояние со всеми таймерами и флагами', () => {
    const storage = new MockStorage();
    const originalState = {
      ...createInitialState(250, 'Рекс-Бегун'),
      status: 'running',
      score: 120,
      spawnTimer: 1.2,
      nextSpawnInterval: 1.5,
      recordAtStart: 250,
      hasFiredRecordConfettiThisRun: true,
      activeItems: [{ id: 'bonus-1', type: 'shield', name: 'Защитный щит', icon: '🛡️' }],
    };

    saveGameState(originalState, storage);
    const loadedState = loadGameState(storage);

    assert.equal(loadedState.status, 'running');
    assert.equal(loadedState.score, 120);
    assert.equal(loadedState.record, 250);
    assert.equal(loadedState.playerName, 'Рекс-Бегун');
    assert.equal(loadedState.spawnTimer, 1.2);
    assert.equal(loadedState.nextSpawnInterval, 1.5);
    assert.equal(loadedState.recordAtStart, 250);
    assert.equal(loadedState.hasFiredRecordConfettiThisRun, true);
    assert.equal(loadedState.activeItems.length, 1);
    assert.equal(loadedState.activeItems[0].name, 'Защитный щит');
  });

  it('при повреждении JSON восстанавливает состояние заново без ошибок', () => {
    const storage = new MockStorage();
    storage.setItem('dino-game-state', '{{corrupted_json:::123');

    const state = loadGameState(storage);

    assert.equal(state.status, 'ready');
    assert.equal(state.score, 0);
    assert.equal(storage.getItem('dino-game-state'), null);
  });

  it('при порче типов данных (невалидная Zod-схема) восстанавливает состояние без ошибок', () => {
    const storage = new MockStorage();
    const corruptedPayload = {
      status: 'invalid_status_unknown',
      score: 'not_a_number',
      record: -999,
      player: { y: 'broken', vy: null },
    };
    storage.setItem('dino-game-state', JSON.stringify(corruptedPayload));

    const state = loadGameState(storage);

    assert.equal(state.status, 'ready');
    assert.equal(state.score, 0);
    assert.equal(storage.getItem('dino-game-state'), null);
  });

  it('пустой объект без обязательных полей не проходит валидацию и сбрасывается', () => {
    const storage = new MockStorage();
    // Без .default() пустой объект не должен считаться валидным состоянием
    storage.setItem('dino-game-state', JSON.stringify({}));

    const state = loadGameState(storage);

    assert.equal(state.status, 'ready');
    assert.equal(state.score, 0);
    assert.equal(storage.getItem('dino-game-state'), null);
  });

  it('абсурдные значения (например 1000000000) отклоняются схемой', () => {
    const storage = new MockStorage();
    const absurdPayload = {
      ...createInitialState(100),
      score: 1000000000, // недопустимо большой счёт
    };
    storage.setItem('dino-game-state', JSON.stringify(absurdPayload));

    const state = loadGameState(storage);
    assert.equal(state.score, 0); // сброшено к начальному
  });

  it('устаревший timestamp savedAt (1000000000) отклоняется схемой', () => {
    const storage = new MockStorage();
    const oldTimestampPayload = {
      ...createInitialState(100),
      savedAt: 1000000000, // 1970 год
    };
    storage.setItem('dino-game-state', JSON.stringify(oldTimestampPayload));

    const state = loadGameState(storage);
    assert.equal(state.score, 0); // сброшено к начальному
  });
});
