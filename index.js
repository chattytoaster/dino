const STORAGE_KEY = 'dino-game-state';

class DinoGame extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      status: 'ready',
      score: 0,
      record: 0,
      savedAt: 0
    };
    this.animationId = 0;
    this.lastFrame = 0;
    this.lastObstacle = 0;
    this.speed = 5;
    this.isJumping = false;
    this.jumpStarted = 0;
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
          <p>Прыгай пробелом или стрелкой вверх • игра сохраняется автоматически</p>
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
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        if (this.state.status !== 'running') this.startGame();
        else this.jump();
      }
    });
    window.addEventListener('beforeunload', () => this.saveState());
  }

  loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      this.state.record = Number(saved.record) || 0;
      if (saved.status === 'running') {
        this.state.status = 'running';
        this.state.score = Number(saved.score) || 0;
        this.updateScreen();
        this.beginLoop();
      }
    } catch (error) {
      console.warn('Не удалось загрузить сохранённую игру:', error);
    }
  }

  saveState() {
    if (this.state.status !== 'running' && this.state.status !== 'gameover') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      status: this.state.status,
      score: this.state.score,
      record: this.state.record,
      savedAt: Date.now()
    }));
  }

  startGame() {
    this.removeObstacles();
    this.state.status = 'running';
    this.state.score = 0;
    this.speed = 5;
    this.lastObstacle = 0;
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
    this.state.score += delta / 1000 * 10;
    this.speed = Math.min(10, 5 + this.state.score / 160);
    this.lastObstacle += delta;

    if (this.lastObstacle > Math.max(750, 1350 - this.state.score * 2)) {
      this.createObstacle();
      this.lastObstacle = 0;
    }
    this.moveObstacles(delta);
    this.finishJump(time);
    this.updateScreen();
    if (this.state.score % 10 < 0.2) this.saveState();
    this.animationId = requestAnimationFrame((nextTime) => this.gameLoop(nextTime));
  }

  createObstacle() {
    const count = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 2) : 1;
    for (let index = 0; index < count; index += 1) {
      const obstacle = document.createElement('div');
      obstacle.className = Math.random() > 0.7 ? 'obstacle tall' : 'obstacle';
      obstacle.style.right = `${-42 - index * 28}px`;
      this.scene.appendChild(obstacle);
    }
  }

  moveObstacles(delta) {
    const obstacles = this.shadowRoot.querySelectorAll('.obstacle');
    obstacles.forEach((obstacle) => {
      const right = parseFloat(obstacle.style.right) || -42;
      obstacle.style.right = `${right + this.speed * delta / 10}px`;
      if (right > this.scene.clientWidth + 60) obstacle.remove();
      else if (this.hitTest(this.player, obstacle)) this.endGame();
    });
  }

  hitTest(first, second) {
    const a = first.getBoundingClientRect();
    const b = second.getBoundingClientRect();
    return a.left + 8 < b.right - 5 && a.right - 7 > b.left + 5 &&
      a.top + 7 < b.bottom && a.bottom - 3 > b.top + 5;
  }

  jump() {
    if (this.state.status !== 'running' || this.isJumping) return;
    this.isJumping = true;
    this.jumpStarted = performance.now();
    this.player.classList.add('jumping');
  }

  finishJump(time) {
    if (this.isJumping && time - this.jumpStarted >= 650) {
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

  removeObstacles() {
    this.shadowRoot.querySelectorAll('.obstacle').forEach((obstacle) => obstacle.remove());
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
      this.messageText.textContent = 'Нажми «Заново» или пробел';
      this.startButton.textContent = 'Заново';
    } else {
      this.message.classList.remove('hidden');
      this.messageTitle.textContent = 'Готов к забегу?';
      this.messageText.textContent = 'Нажми «Старт» или пробел';
      this.startButton.textContent = 'Старт';
    }
  }
}

customElements.define('dino-game', DinoGame);
