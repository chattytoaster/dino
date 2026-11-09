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

  it('корректно сохраняет и восстанавливает валидное состояние', () => {
    const storage = new MockStorage();
    const originalState = {
      ...createInitialState(250, 'Рекс-Бегун'),
      status: 'running',
      score: 120,
      activeItems: [{ id: 'bonus-1', type: 'shield', name: 'Защитный щит', icon: '🛡️' }],
    };

    saveGameState(originalState, storage);
    const loadedState = loadGameState(storage);

    assert.equal(loadedState.status, 'running');
    assert.equal(loadedState.score, 120);
    assert.equal(loadedState.record, 250);
    assert.equal(loadedState.playerName, 'Рекс-Бегун');
    assert.equal(loadedState.activeItems.length, 1);
    assert.equal(loadedState.activeItems[0].name, 'Защитный щит');
  });

  it('при повреждении JSON восстанавливает состояние заново без ошибок', () => {
    const storage = new MockStorage();
    // Записываем невалидный JSON
    storage.setItem('dino-game-state', '{{corrupted_json:::123');

    const state = loadGameState(storage);

    assert.equal(state.status, 'ready');
    assert.equal(state.score, 0);
    // Проверяем, что повреждённая запись очищена
    assert.equal(storage.getItem('dino-game-state'), null);
  });

  it('при порче типов данных (невалидная Zod-схема) восстанавливает состояние без ошибок', () => {
    const storage = new MockStorage();
    // Записываем данные с невалидными типами (score строка вместо числа, неизвестный статус)
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

  it('при отрицательном счёте или некорректных хитбоксах Zod сбрасывает состояние заново', () => {
    const storage = new MockStorage();
    const invalidPayload = {
      score: -500, // отрицательный счёт недопустим (nonnegative)
      obstacles: [{ id: 'bad', x: 10, width: -10, height: 20, type: 'single' }], // отрицательная ширина
    };
    storage.setItem('dino-game-state', JSON.stringify(invalidPayload));

    const state = loadGameState(storage);

    assert.equal(state.status, 'ready');
    assert.equal(state.score, 0);
  });
});
