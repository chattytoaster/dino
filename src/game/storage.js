import { GameStateSchema } from './schema.js';
import { createInitialState } from './rules.js';
import { STORAGE_KEY } from './constants.js';

/**
 * Загружает состояние игры из хранилища.
 * Использует Zod для строгой валидации. При повреждении данных
 * восстанавливает чистое начальное состояние без ошибок в консоли.
 */
export function loadGameState(storage = globalThis.localStorage, key = STORAGE_KEY) {
  if (!storage) {
    return createInitialState();
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return createInitialState();
    }

    const parsedJson = JSON.parse(raw);
    const validationResult = GameStateSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      // Данные повреждены или не соответствуют схеме Zod:
      // тихо сбрасываем хранилище и начинаем заново без вывода ошибок в консоль
      try {
        storage.removeItem(key);
      } catch {
        // игнорируем ошибки хранилища
      }
      return createInitialState();
    }

    return validationResult.data;
  } catch {
    // Невалидный JSON в хранилище:
    // тихо сбрасываем и начинаем заново без console.error
    try {
      storage.removeItem(key);
    } catch {
      // игнорируем
    }
    return createInitialState();
  }
}

/**
 * Сохраняет состояние игры в хранилище.
 */
export function saveGameState(state, storage = globalThis.localStorage, key = STORAGE_KEY) {
  if (!storage) return false;
  try {
    const dataToSave = {
      ...state,
      savedAt: Date.now(),
    };
    storage.setItem(key, JSON.stringify(dataToSave));
    return true;
  } catch {
    return false;
  }
}

/**
 * Очищает сохранённое состояние.
 */
export function clearGameState(storage = globalThis.localStorage, key = STORAGE_KEY) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // игнорируем
  }
}
