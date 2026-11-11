import './style.css';
import { GameEngine } from './game/engine.js';
import { createGameDOM, createRenderer } from './game/render.js';

function initApp() {
  const root = document.querySelector('#app') || document.body;
  const dom = createGameDOM(root);
  const renderer = createRenderer(dom);

  const engine = new GameEngine({
    onRender: (state) => renderer(state),
  });

  // Первичная отрисовка текущего состояния (начального или загруженного из localStorage)
  renderer(engine.state);

  // =========================================================================
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // Согласно требованиям задания: обработчики событий НЕ изменяют DOM!
  // Они лишь вызывают методы движка, изменяющие состояние игры.
  // Вся визуализация происходит централизованно через renderer(state).
  // =========================================================================

  dom.startBtn.addEventListener('click', () => {
    engine.start();
  });

  dom.jumpBtn.addEventListener('click', () => {
    engine.jump();
  });

  dom.scene.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    engine.jump();
  });

  window.addEventListener('keydown', (e) => {
    // Если пользователь сейчас печатает в поле ввода, не мешаем вводу пробелов
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      engine.jump();
    }
  });

  dom.playerNameInput.addEventListener('input', (e) => {
    engine.setPlayerName(e.target.value);
  });

  dom.activeItemsList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-id]');
    if (removeBtn) {
      const id = removeBtn.getAttribute('data-remove-id');
      if (id) {
        engine.removeItem(id);
      }
    }
  });

  dom.clearItemsBtn.addEventListener('click', () => {
    engine.clearItems();
  });

  window.addEventListener('beforeunload', () => {
    engine.save();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
