import { PLAYER_X } from './constants.js';

export function createGameDOM(root) {
  root.innerHTML = `
    <main class="game" aria-label="Дино">
      <header class="topbar">
        <div>
          <p class="eyebrow">RUNNER</p>
          <h1 class="title">Дино</h1>
        </div>
        <div class="scores" aria-live="polite">
          <div class="score-card">
            <span class="label">СЧЁТ</span>
            <b id="scoreValue">00000</b>
          </div>
          <div class="score-card">
            <span class="label">РЕКОРД</span>
            <b id="recordValue">00000</b>
          </div>
        </div>
      </header>

      <section class="scene" id="scene" tabindex="0" aria-label="Игровое поле">
        <div class="cloud cloud-one"></div>
        <div class="cloud cloud-two"></div>
        <div class="player" id="player" aria-label="Дино"></div>
        <div class="entities-layer" id="entitiesLayer"></div>
        <div class="ground"><i></i><i></i><i></i><i></i><i></i></div>

        <div class="message" id="messageOverlay">
          <strong id="messageTitle">Готов к забегу?</strong>
          <span id="messageSubtitle">Нажми «Старт» или пробел для прыжка</span>
        </div>
      </section>

      <section class="gameplay-bar">
        <div class="input-card">
          <label for="playerNameInput" class="input-label">Имя игрока:</label>
          <input
            type="text"
            id="playerNameInput"
            class="player-input"
            maxlength="24"
            placeholder="Имя игрока..."
            autocomplete="off"
          />
        </div>

        <div class="primary-actions">
          <button type="button" class="btn btn-primary" id="startBtn">Старт</button>
          <button type="button" class="btn btn-secondary" id="jumpBtn">Прыжок</button>
        </div>
      </section>

      <section class="inventory-section">
        <div class="inventory-header">
          <h2>Бонусы (<span id="itemsCount">0</span>)</h2>
          <div class="bonus-quick-add">
            <button type="button" class="chip-btn" data-add-bonus="shield">+ 🛡️ Добавить щит</button>
            <button type="button" class="chip-btn chip-danger" id="clearItemsBtn">Очистить список</button>
          </div>
        </div>

        <ul class="items-list" id="activeItemsList">
          <li class="empty-state">Список пуст. Собери щит на трассе или добавь кнопкой выше.</li>
        </ul>
      </section>

      <footer class="footer-info">
        <p>Прыгай пробелом или стрелкой вверх • Игра сохраняется автоматически</p>
      </footer>
    </main>
  `;

  return {
    scene: root.querySelector('#scene'),
    player: root.querySelector('#player'),
    entitiesLayer: root.querySelector('#entitiesLayer'),
    scoreValue: root.querySelector('#scoreValue'),
    recordValue: root.querySelector('#recordValue'),
    messageOverlay: root.querySelector('#messageOverlay'),
    messageTitle: root.querySelector('#messageTitle'),
    messageSubtitle: root.querySelector('#messageSubtitle'),
    playerNameInput: root.querySelector('#playerNameInput'),
    startBtn: root.querySelector('#startBtn'),
    jumpBtn: root.querySelector('#jumpBtn'),
    itemsCount: root.querySelector('#itemsCount'),
    activeItemsList: root.querySelector('#activeItemsList'),
    clearItemsBtn: root.querySelector('#clearItemsBtn'),
    bonusButtons: root.querySelectorAll('[data-add-bonus]'),
  };
}

export function createRenderer(dom) {
  let renderedItemsSignature = '';

  return function render(state) {
    // 1. Очки и рекорд
    dom.scoreValue.textContent = String(Math.floor(state.score)).padStart(5, '0');
    dom.recordValue.textContent = String(Math.floor(state.record)).padStart(5, '0');

    // 2. Игрок: позиция прыжка
    dom.player.style.left = `${PLAYER_X}px`;
    dom.player.style.bottom = `${40 + state.player.y}px`;
    dom.player.classList.toggle('jumping', state.player.isJumping);

    // Подсветка динозавра при наличии щита
    const hasShield = state.activeItems.some((i) => i.type === 'shield');
    dom.player.classList.toggle('has-shield', hasShield);

    // 3. Сообщения о статусе игры
    if (state.status === 'running') {
      dom.messageOverlay.classList.add('hidden');
      dom.startBtn.textContent = 'Заново';
    } else if (state.status === 'gameover') {
      dom.messageOverlay.classList.remove('hidden');
      dom.messageTitle.textContent = 'Игра окончена!';
      dom.messageSubtitle.textContent = `Счёт: ${Math.floor(state.score)}. Нажми «Заново» или пробел`;
      dom.startBtn.textContent = 'Заново';
    } else {
      dom.messageOverlay.classList.remove('hidden');
      dom.messageTitle.textContent = 'Готов к забегу?';
      dom.messageSubtitle.textContent = 'Нажми «Старт» или пробел для прыжка';
      dom.startBtn.textContent = 'Старт';
    }

    // 4. Поле ввода: обновляем только если пользователь сейчас не печатает в нём
    if (document.activeElement !== dom.playerNameInput) {
      if (dom.playerNameInput.value !== state.playerName) {
        dom.playerNameInput.value = state.playerName || '';
      }
    }

    // 5. Отрисовка препятствий и подбираемых щитов
    let entitiesHtml = '';
    for (const obs of state.obstacles) {
      const cls =
        obs.type === 'tall'
          ? 'obstacle tall'
          : obs.type === 'double'
            ? 'obstacle double'
            : 'obstacle';
      entitiesHtml += `<div class="${cls}" style="left: ${obs.x}px; width: ${obs.width}px; height: ${obs.height}px;"></div>`;
    }

    for (const item of state.collectibles) {
      entitiesHtml += `
        <div class="collectible" style="left: ${item.x}px; bottom: ${44 + item.y}px;" title="${item.name}">
          <span>${item.icon}</span>
        </div>
      `;
    }
    dom.entitiesLayer.innerHTML = entitiesHtml;

    // 6. Список активных щитов
    dom.itemsCount.textContent = String(state.activeItems.length);

    const currentSignature = state.activeItems.map((i) => `${i.id}-${i.type}`).join('|');

    if (currentSignature !== renderedItemsSignature) {
      renderedItemsSignature = currentSignature;

      if (state.activeItems.length === 0) {
        dom.activeItemsList.innerHTML = `
          <li class="empty-state">Список пуст. Собери щит на трассе или добавь кнопкой выше.</li>
        `;
      } else {
        dom.activeItemsList.innerHTML = state.activeItems
          .map((item) => {
            return `
              <li class="item-card item-${item.type}" data-item-id="${item.id}">
                <div class="item-info">
                  <span class="item-icon">${item.icon}</span>
                  <div>
                    <strong class="item-title">${item.name}</strong>
                    <span class="item-desc">Спасает от 1 столкновения</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="item-remove-btn"
                  data-remove-id="${item.id}"
                  title="Удалить из списка"
                  aria-label="Удалить ${item.name}"
                >✕</button>
              </li>
            `;
          })
          .join('');
      }
    }
  };
}
