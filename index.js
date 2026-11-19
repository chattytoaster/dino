const STORAGE_KEY = 'dino-game-state';
const WIN_SCORE = 500;

class DinoGame extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.state = {
      status: 'ready',
      score: 0,
      record: 0,
      savedAt: 0,
    };

    this.speed = 5;
    this.obstacles = [];
    this.animationId = 0;
    this.lastFrame = 0;
    this.lastObstacle = 0;
    this.saveTimer = 0;
    this.isJumping = false;
    this.jumpStarted = 0;

    this.handleKeyDown = (event) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        if (this.state.status !== 'running') {
          this.startGame();
        } else {
          this.jump();
        }
      }
    };

    this.handleBeforeUnload = () => {
      this.saveState();
    };
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="style.css">
      <main class="game" aria-label="Дино">
        <header class="topbar">
          <div>
            <p class="eyebrow">RUNNER</p>
            <h1>Дино</h1>
          </div>
          <div class="scores" aria-live="polite">
            <span>СЧЁТ <b id="score">00000</b></span>
            <span>РЕКОРД <b id="record">00000</b></span>
          </div>
        </header>
        <section class="scene" id="scene" tabindex="0" aria-label="Игровое поле">
          <div class="cloud cloud-one"></div>
          <div class="cloud cloud-two"></div>
          <div class="player" id="player" aria-label="Дино"></div>
          <div class="ground"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="message" id="message">
            <strong id="messageTitle">Готов к забегу?</strong>
            <span id="messageText">Нажми «Старт» или пробел</span>
          </div>
        </section>
        <div class="controls">
          <button class="primary" id="start">Старт</button>
          <p>Прыгай пробелом или стрелкой вверх • цель: ${WIN_SCORE} очков</p>
        </div>
      </main>
    `;

    this.scene = this.shadowRoot.querySelector('#scene');
    this.player = this.shadowRoot.querySelector('#player');
    this.scoreElement = this.shadowRoot.querySelector('#score');
    this.recordElement = this.shadowRoot.querySelector('#record');
    this.message = this.shadowRoot.querySelector('#message');
    this.messageTitle = this.shadowRoot.querySelector('#messageTitle');
    this.messageText = this.shadowRoot.querySelector('#messageText');
    this.startButton = this.shadowRoot.querySelector('#start');

    this.loadState();
    this.updateScreen();

    this.startButton.addEventListener('click', () => this.startGame());
    this.scene.addEventListener('pointerdown', () => this.jump());
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    cancelAnimationFrame(this.animationId);
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;

      this.state.record = Number(saved.record) || 0;

      if (saved.status === 'running') {
        this.state.status = 'running';
        this.state.score = Number(saved.score) || 0;
        this.speed = Number(saved.speed) || 5;
        this.lastObstacle = Number(saved.lastObstacle) || 0;

        // Восстанавливаем препятствия на тех же местах
        this.obstacles = Array.isArray(saved.obstacles) ? saved.obstacles : [];
        this.renderRestoredObstacles();

        this.updateScreen();
        this.beginLoop();
      }
    } catch (error) {
      console.warn('Не удалось загрузить сохранённую игру:', error);
    }
  }

  renderRestoredObstacles() {
    this.removeObstacles();
    this.obstacles.forEach((obs) => {
      const el = document.createElement('div');
      el.className = obs.type === 'tall' ? 'obstacle tall' : 'obstacle';
      el.style.left = `${obs.x}px`;
      this.scene.appendChild(el);
      obs.el = el;
    });
  }

  saveState() {
    if (this.state.status !== 'running' && this.state.status !== 'gameover' && this.state.status !== 'win') {
      return;
    }
    const payload = {
      status: this.state.status,
      score: this.state.score,
      record: this.state.record,
      speed: this.speed,
      lastObstacle: this.lastObstacle,
      obstacles: this.obstacles.map((obs) => ({
        x: Math.round(obs.x),
        type: obs.type,
        width: obs.width,
        height: obs.height,
      })),
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  startGame() {
    this.removeObstacles();
    this.obstacles = [];
    this.state.status = 'running';
    this.state.score = 0;
    this.speed = 5;
    this.lastObstacle = 0;
    this.saveTimer = 0;
    this.isJumping = false;
    this.player.classList.remove('jumping');
    this.updateScreen();
    this.beginLoop();
    this.scene.focus();
  }

  beginLoop() {
    cancelAnimationFrame(this.animationId);
    this.lastFrame = performance.now();
    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  gameLoop(time) {
    if (this.state.status !== 'running') return;

    const delta = Math.min(time - this.lastFrame, 50);
    this.lastFrame = time;

    // Начисление очков и проверка победы
    this.state.score += (delta / 1000) * 10;
    if (this.state.score >= WIN_SCORE) {
      this.winGame();
      return;
    }

    // Рост скорости и спавн препятствий
    this.speed = Math.min(10, 5 + this.state.score / 160);
    this.lastObstacle += delta;

    if (this.lastObstacle > Math.max(750, 1350 - this.state.score * 2)) {
      this.createObstacle();
      this.lastObstacle = 0;
    }

    // Движение и проверка столкновений
    this.moveObstacles(delta);
    if (this.state.status !== 'running') return;

    this.finishJump(time);
    this.updateScreen();

    // Автосохранение раз в секунду
    this.saveTimer += delta;
    if (this.saveTimer >= 1000) {
      this.saveState();
      this.saveTimer = 0;
    }

    this.animationId = requestAnimationFrame((nextTime) => this.gameLoop(nextTime));
  }

  createObstacle() {
    const sceneWidth = this.scene.clientWidth || 840;
    const count = Math.random() < 0.35 ? 2 : 1;

    for (let index = 0; index < count; index += 1) {
      const isTall = Math.random() > 0.7;
      const width = 25;
      const height = isTall ? 61 : 43;
      const x = sceneWidth + index * 32;

      const el = document.createElement('div');
      el.className = isTall ? 'obstacle tall' : 'obstacle';
      el.style.left = `${x}px`;
      this.scene.appendChild(el);

      this.obstacles.push({
        x,
        width,
        height,
        type: isTall ? 'tall' : 'normal',
        el,
      });
    }
  }

  moveObstacles(delta) {
    const playerX = this.player.offsetLeft;
    const playerWidth = 46;

    const remaining = [];

    for (const obs of this.obstacles) {
      obs.x -= (this.speed * delta) / 10;
      obs.el.style.left = `${obs.x}px`;

      // Препятствие скрылось за левым краем
      if (obs.x + obs.width < -30) {
        obs.el.remove();
        continue;
      }

      // Проверка столкновения: динозавр на земле пересекается с кактусом
      if (!this.isJumping) {
        const hitX = playerX + playerWidth - 10 > obs.x + 6 && playerX + 10 < obs.x + obs.width - 6;
        if (hitX) {
          this.endGame();
          return;
        }
      }

      remaining.push(obs);
    }

    this.obstacles = remaining;
  }

  jump() {
    if (this.state.status !== 'running' || this.isJumping) return;
    this.isJumping = true;
    this.jumpStarted = performance.now();
    this.player.classList.add('jumping');
  }

  finishJump(time) {
    if (this.isJumping && time - this.jumpStarted >= 580) {
      this.isJumping = false;
      this.player.classList.remove('jumping');
    }
  }

  endGame() {
    this.state.status = 'gameover';
    this.state.score = Math.floor(this.state.score);
    this.state.record = Math.max(this.state.record, this.state.score);
    cancelAnimationFrame(this.animationId);
    this.updateScreen();
    this.saveState();
  }

  winGame() {
    this.state.status = 'win';
    this.state.score = WIN_SCORE;
    this.state.record = Math.max(this.state.record, this.state.score);
    cancelAnimationFrame(this.animationId);
    this.updateScreen();
    this.saveState();
  }

  removeObstacles() {
    this.obstacles.forEach((obs) => {
      if (obs.el) obs.el.remove();
    });
    this.obstacles = [];
    this.shadowRoot.querySelectorAll('.obstacle').forEach((el) => el.remove());
  }

  updateScreen() {
    this.scoreElement.textContent = String(Math.floor(this.state.score)).padStart(5, '0');
    this.recordElement.textContent = String(Math.floor(this.state.record)).padStart(5, '0');

    if (this.state.status === 'running') {
      this.message.classList.add('hidden');
      this.startButton.textContent = 'Заново';
    } else if (this.state.status === 'gameover') {
      this.message.classList.remove('hidden');
      this.messageTitle.textContent = 'Игра окончена';
      this.messageText.textContent = `Счёт: ${Math.floor(this.state.score)}. Нажми «Заново» или пробел`;
      this.startButton.textContent = 'Заново';
    } else if (this.state.status === 'win') {
      this.message.classList.remove('hidden');
      this.messageTitle.textContent = '🎉 Победа!';
      this.messageText.textContent = `Вы добежали до финиша (${WIN_SCORE} очков)! Нажми «Заново»`;
      this.startButton.textContent = 'Играть снова';
    } else {
      this.message.classList.remove('hidden');
      this.messageTitle.textContent = 'Готов к забегу?';
      this.messageText.textContent = 'Нажми «Старт» или пробел';
      this.startButton.textContent = 'Старт';
    }
  }
}

customElements.define('dino-game', DinoGame);
