
const imgs = document.querySelectorAll('.imgs-box img');
const startBtn = document.querySelector('.control button');
const timeText = document.querySelector('#time');
const comboText = document.querySelector('#combo');

const GAME_TIME = 60;
const TOTAL_EVENTS = 100;
const EVENT_DURATION = 57000;
const RETRY_DELAY = 1000;
const ACTIVE_DURATION = 1000;
const HIT_DURATION = 1000;

const STATE = './img/state.png';
const ON = './img/on.png';
const OFF = './img/off.png';

let isPlaying = false;
let score = 0;
let endTime = 0;
let countdownTimer = null;
let gameEndTimer = null;
let eventTimers = [];
let cellTimers = Array(imgs.length).fill(null);

// 1. 取得格子的目前狀態
function getState(img) {
  return img.getAttribute('src').split('/').pop();
}

// 2. 設定格子的圖片
function setState(img, src) {
  img.setAttribute('src', src);
}

// 3. 排除重複的格子計時器
function clearCellTimer(index) {
  if (cellTimers[index] !== null) {
    clearTimeout(cellTimers[index]);
    cellTimers[index] = null;
  }
}

// 4. 產生一個紅色事件
function spawnEvent() {
  if (!isPlaying || Date.now() >= endTime) return;

  const available = [...imgs]
    .map((img, index) => ({ img, index }))
    .filter(({ img }) => getState(img) === 'state.png');

  if (available.length === 0) {
    const timer = setTimeout(spawnEvent, RETRY_DELAY);
    eventTimers.push(timer);
    return;
  }

  const target = available[
    Math.floor(Math.random() * available.length)
  ];

  const { img, index } = target;

  setState(img, ON);

  // 1 秒內沒擊中，就恢復為黃色
  cellTimers[index] = setTimeout(() => {
    if (getState(img) === 'on.png') {
      setState(img, STATE);
    }
    cellTimers[index] = null;
  }, ACTIVE_DURATION);
}

// 5. 點擊或按鍵擊中格子
function hit(index) {
  if (!isPlaying) return;

  const img = imgs[index];
  if (!img || getState(img) !== 'on.png') return;

  clearCellTimer(index);

  setState(img, OFF);
  score += 1;
  comboText.textContent = score;

  // 擊中後 1 秒恢復黃色
  cellTimers[index] = setTimeout(() => {
    setState(img, STATE);
    cellTimers[index] = null;
  }, HIT_DURATION);
}

// 6. 遊戲開始
function startGame() {
  if (isPlaying) return;

  isPlaying = true;
  score = 0;
  comboText.textContent = score;
  timeText.textContent = GAME_TIME;
  startBtn.disabled = true;

  imgs.forEach((img, index) => {
    clearCellTimer(index);
    setState(img, STATE);
  });

  endTime = Date.now() + GAME_TIME * 1000;

  // 倒數計時
  countdownTimer = setInterval(() => {
    const remaining = Math.max(
      0,
      Math.ceil((endTime - Date.now()) / 1000)
    );
    timeText.textContent = remaining;
  }, 100);

  // 在 0～57 秒之間平均安排 100 次事件
  for (let i = 0; i < TOTAL_EVENTS; i++) {
    const delay = i * EVENT_DURATION / (TOTAL_EVENTS - 1);
    const timer = setTimeout(spawnEvent, delay);
    eventTimers.push(timer);
  }

  // 60 秒後結束遊戲
  gameEndTimer = setTimeout(endGame, GAME_TIME * 1000);
}

// 7. 遊戲結束
function endGame() {
  isPlaying = false;

  clearInterval(countdownTimer);
  clearTimeout(gameEndTimer);
  eventTimers.forEach(clearTimeout);
  eventTimers = [];

  imgs.forEach((img, index) => {
    clearCellTimer(index);
    setState(img, STATE);
  });

  timeText.textContent = 0;
  startBtn.disabled = false;

  // 重新開放下一局的開始事件
  bindStartButton();

  alert(`遊戲結束！你的得分是 ${score} / 100 分`);
}

// 8. 開始按鈕：每次僅觸發一次
function bindStartButton() {
  startBtn.addEventListener('click', startGame, { once: true });
}

bindStartButton();

// 9. 滑鼠點擊圖片
imgs.forEach((img, index) => {
  img.addEventListener('click', () => hit(index));
});

// 10. 數字鍵盤對應位置
const keyMap = {
  Numpad7: 0, Numpad8: 1, Numpad9: 2,
  Numpad4: 3, Numpad5: 4, Numpad6: 5,
  Numpad1: 6, Numpad2: 7, Numpad3: 8
};

document.addEventListener('keydown', (event) => {
  if (event.repeat || !isPlaying) return;

  const index = keyMap[event.code];

  if (index !== undefined) {
    hit(index);
  }
});
