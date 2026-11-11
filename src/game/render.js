import { MAX_ACTIVE_ITEMS, PLAYER_X } from './constants.js';

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
          <h2>Бонусы (<span id="itemsCount">0</span>/${MAX_ACTIVE_ITEMS})</h2>
          <div class="bonus-quick-add">
            <button type="button" class="chip-btn chip-danger" id="clearItemsBtn">Очистить список</button>
          </div>
        </div>

        <ul class="items-list" id="activeItemsList">
          <li class="empty-state">Список пуст. Собери щит на трассе.</li>
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

    // 4. Поле ввода
    if (document.activeElement !== dom.playerNameInput) {
      if (dom.playerNameInput.value !== state.playerName) {
        dom.playerNameInput.value = state.playerName || '';
      }
    }

    // 5. Отрисовка препятствий и бонусов через безопасные методы DOM (защита от XSS)
    const entityNodes = [];

    for (const obs of state.obstacles) {
      const el = document.createElement('div');
      const cls =
        obs.type === 'tall'
          ? 'obstacle tall'
          : obs.type === 'double'
            ? 'obstacle double'
            : 'obstacle';
      el.className = cls;
      el.style.left = `${obs.x}px`;
      el.style.width = `${obs.width}px`;
      el.style.height = `${obs.height}px`;
      entityNodes.push(el);
    }

    for (const item of state.collectibles) {
      const el = document.createElement('div');
      el.className = 'collectible';
      el.style.left = `${item.x}px`;
      el.style.bottom = `${44 + item.y}px`;
      el.title = item.name;

      const span = document.createElement('span');
      span.textContent = item.icon;
      el.appendChild(span);
      entityNodes.push(el);
    }

    dom.entitiesLayer.replaceChildren(...entityNodes);

    // 6. Список активных щитов (безопасное построение через DOM API)
    dom.itemsCount.textContent = String(state.activeItems.length);

    const currentSignature = state.activeItems.map((i) => `${i.id}-${i.type}`).join('|');

    if (currentSignature !== renderedItemsSignature) {
      renderedItemsSignature = currentSignature;
      dom.activeItemsList.replaceChildren();

      if (state.activeItems.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty-state';
        empty.textContent = 'Список пуст. Собери щит на трассе.';
        dom.activeItemsList.appendChild(empty);
      } else {
        for (const item of state.activeItems) {
          const li = document.createElement('li');
          li.className = `item-card item-${item.type}`;
          li.dataset.itemId = item.id;

          const info = document.createElement('div');
          info.className = 'item-info';

          const iconSpan = document.createElement('span');
          iconSpan.className = 'item-icon';
          iconSpan.textContent = item.icon;

          const textDiv = document.createElement('div');
          const strong = document.createElement('strong');
          strong.className = 'item-title';
          strong.textContent = item.name;

          const desc = document.createElement('span');
          desc.className = 'item-desc';
          desc.textContent = 'Спасает от 1 столкновения';

          textDiv.append(strong, desc);
          info.append(iconSpan, textDiv);

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'item-remove-btn';
          btn.dataset.removeId = item.id;
          btn.title = 'Удалить из списка';
          btn.setAttribute('aria-label', `Удалить ${item.name}`);
          btn.textContent = '✕';

          li.append(info, btn);
          dom.activeItemsList.appendChild(li);
        }
      }
    }
  };
}
