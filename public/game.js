"use strict";

// ============================================================
// 1. CONFIGURAÇÃO INICIAL
// ============================================================

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const coinCountElement = document.getElementById("coin-count");
const statusElement = document.getElementById("game-status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 2800;

// Física do personagem: os valores são ajustados para pixels/segundo.
const GRAVITY = 1700;
const MOVE_ACCELERATION = 2200;
const MAX_SPEED = 300;
const FRICTION = 1800;
const JUMP_SPEED = 620;

// Teclas que estão pressionadas neste momento.
const keys = new Set();

// Estado geral da partida.
let gameState = "playing";
let cameraX = 0;
let score = 0;
let lastTime = 0;
let animationId = null;

// ============================================================
// 2. CENÁRIO E PLATAFORMAS
// ============================================================

// Cada plataforma é um retângulo.
// x e y indicam o canto superior esquerdo.
// width é a largura; height é a altura.
const platforms = [
  // Chão principal. Os espaços entre os trechos são abismos.
  { x: 0,    y: 470, width: 650, height: 70, type: "ground" },
  { x: 790,  y: 470, width: 500, height: 70, type: "ground" },
  { x: 1430, y: 470, width: 440, height: 70, type: "ground" },
  { x: 2010, y: 470, width: 790, height: 70, type: "ground" },

  // Plataformas suspensas.
  { x: 220,  y: 365, width: 150, height: 22, type: "floating" },
  { x: 430,  y: 310, width: 145, height: 22, type: "floating" },
  { x: 860,  y: 365, width: 150, height: 22, type: "floating" },
  { x: 1080, y: 300, width: 150, height: 22, type: "floating" },
  { x: 1510, y: 350, width: 160, height: 22, type: "floating" },
  { x: 1730, y: 290, width: 150, height: 22, type: "floating" },
  { x: 2100, y: 360, width: 155, height: 22, type: "floating" },
  { x: 2320, y: 305, width: 160, height: 22, type: "floating" }
];

// ============================================================
// 3. MOEDAS
// ============================================================

// Cada moeda tem posição, raio e estado de coleta.
const originalCoins = [
  { x: 270,  y: 325, radius: 11 },
  { x: 330,  y: 325, radius: 11 },
  { x: 480,  y: 270, radius: 11 },
  { x: 540,  y: 270, radius: 11 },
  { x: 720,  y: 420, radius: 11 },
  { x: 920,  y: 325, radius: 11 },
  { x: 1140, y: 260, radius: 11 },
  { x: 1190, y: 260, radius: 11 },
  { x: 1550, y: 310, radius: 11 },
  { x: 1780, y: 250, radius: 11 },
  { x: 1930, y: 420, radius: 11 },
  { x: 2160, y: 320, radius: 11 },
  { x: 2380, y: 265, radius: 11 },
  { x: 2530, y: 420, radius: 11 }
];

let coins = [];

// ============================================================
// 4. PERSONAGEM
// ============================================================

const playerStart = {
  x: 70,
  y: 350,
  width: 30,
  height: 42
};

let player;

// ============================================================
// 5. INIMIGOS
// ============================================================

const originalEnemies = [
  {
    x: 930,
    y: 430,
    width: 34,
    height: 40,
    minX: 820,
    maxX: 1190,
    speed: 85,
    direction: 1
  },
  {
    x: 2160,
    y: 430,
    width: 34,
    height: 40,
    minX: 2040,
    maxX: 2380,
    speed: 100,
    direction: -1
  }
];

let enemies = [];

// ============================================================
// 6. FUNÇÕES PARA CRIAR E REINICIAR A PARTIDA
// ============================================================

function resetGame() {
  player = {
    x: playerStart.x,
    y: playerStart.y,
    width: playerStart.width,
    height: playerStart.height,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1
  };

  // Copiamos os objetos para que a coleta não altere o modelo inicial.
  coins = originalCoins.map((coin) => ({
    ...coin,
    collected: false
  }));

  enemies = originalEnemies.map((enemy) => ({ ...enemy }));

  score = 0;
  cameraX = 0;
  gameState = "playing";

  updateHUD();
}

// Atualiza o placar e o texto de situação na interface.
function updateHUD() {
  coinCountElement.textContent = String(score);

  const messages = {
    playing: "JOGANDO",
    won: "VITÓRIA!",
    lost: "GAME OVER"
  };

  statusElement.textContent = messages[gameState];
}

// ============================================================
// 7. DETECÇÃO DE COLISÃO AABB
// ============================================================

// AABB significa Axis-Aligned Bounding Box.
// Comparamos dois retângulos alinhados aos eixos X e Y.
function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ============================================================
// 8. CONTROLES DO TECLADO
// ============================================================

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  // Impede que as setas e o espaço rolem a página.
  if (
    ["arrowleft", "arrowright", "arrowup", " "].includes(key)
  ) {
    event.preventDefault();
  }

  // Reinicia a partida quando R é pressionado.
  if (key === "r") {
    resetGame();
    return;
  }

  // Só inicia o pulo na primeira tecla pressionada.
  // Isso evita repetir o pulo automaticamente enquanto segura.
  const alreadyPressed = keys.has(key);
  keys.add(key);

  if (!alreadyPressed && gameState === "playing") {
    const jumpKey = [" ", "w", "arrowup"].includes(key);

    if (jumpKey && player.onGround) {
      player.vy = -JUMP_SPEED;
      player.onGround = false;
    }
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  keys.delete(key);

  // Soltar o botão de pulo reduz a força do salto.
  // Isso permite controlar a altura do pulo.
  const jumpKey = [" ", "w", "arrowup"].includes(key);

  if (jumpKey && player && player.vy < -180) {
    player.vy *= 0.48;
  }
});

// Evita manter teclas pressionadas se a janela perder o foco.
window.addEventListener("blur", () => {
  keys.clear();
});

// ============================================================
// 9. MOVIMENTAÇÃO HORIZONTAL
// ============================================================

function movePlayerHorizontally(dt) {
  let direction = 0;

  if (keys.has("arrowleft") || keys.has("a")) {
    direction -= 1;
  }

  if (keys.has("arrowright") || keys.has("d")) {
    direction += 1;
  }

  if (direction !== 0) {
    // Acelera progressivamente, em vez de atingir a velocidade máxima
    // instantaneamente.
    player.vx += direction * MOVE_ACCELERATION * dt;

    // Registra para que lado o personagem está olhando.
    player.facing = direction;
  } else {
    // Diminui a velocidade quando nenhuma direção é pressionada.
    if (player.vx > 0) {
      player.vx = Math.max(0, player.vx - FRICTION * dt);
    } else if (player.vx < 0) {
      player.vx = Math.min(0, player.vx + FRICTION * dt);
    }
  }

  // Limita a velocidade para que o personagem não acelere sem fim.
  player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

  // Aplica o deslocamento horizontal.
  player.x += player.vx * dt;

  // Colisão lateral com as plataformas.
  for (const platform of platforms) {
    if (!intersects(player, platform)) continue;

    if (player.vx > 0) {
      player.x = platform.x - player.width;
    } else if (player.vx < 0) {
      player.x = platform.x + platform.width;
    }

    player.vx = 0;
  }

  // Impede que o personagem saia do início do mapa.
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }

  // O final do mundo é controlado pela bandeira.
  if (player.x + player.width > WORLD_WIDTH) {
    player.x = WORLD_WIDTH - player.width;
    player.vx = 0;
  }
}

// ============================================================
// 10. GRAVIDADE E COLISÃO VERTICAL
// ============================================================

function movePlayerVertically(dt) {
  // A gravidade aumenta a velocidade vertical ao longo do tempo.
  player.vy += GRAVITY * dt;

  // Evita que a velocidade de queda cresça indefinidamente.
  player.vy = Math.min(player.vy, 950);

  // Aplica o deslocamento vertical.
  const previousY = player.y;
  player.y += player.vy * dt;
  player.onGround = false;

  for (const platform of platforms) {
    if (!intersects(player, platform)) continue;

    // Caindo: o jogador aterrissa sobre o topo da plataforma.
    // A comparação com previousY evita tratar a parte de baixo
    // da plataforma como um piso.
    if (
      player.vy >= 0 &&
      previousY + player.height <= platform.y + 4
    ) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.onGround = true;
    } else if (player.vy < 0) {
      // Subindo: bate a cabeça na parte inferior da plataforma.
      if (previousY >= platform.y + platform.height - 4) {
        player.y = platform.y + platform.height;
        player.vy = 0;
      }
    }
  }
}

// ============================================================
// 11. ATUALIZAÇÃO DOS INIMIGOS
// ============================================================

function updateEnemies(dt) {
  for (const enemy of enemies) {
    enemy.x += enemy.speed * enemy.direction * dt;

    // Ao alcançar um limite, o inimigo troca de direção.
    if (enemy.x <= enemy.minX) {
      enemy.x = enemy.minX;
      enemy.direction = 1;
    } else if (enemy.x + enemy.width >= enemy.maxX) {
      enemy.x = enemy.maxX - enemy.width;
      enemy.direction = -1;
    }
  }
}

// ============================================================
// 12. COLETA DE MOEDAS E COLISÕES COM INIMIGOS
// ============================================================

function checkCollectibles() {
  for (const coin of coins) {
    if (coin.collected) continue;

    // Representa a moeda como um pequeno quadrado para a colisão.
    const coinBox = {
      x: coin.x - coin.radius,
      y: coin.y - coin.radius,
      width: coin.radius * 2,
      height: coin.radius * 2
    };

    if (intersects(player, coinBox)) {
      coin.collected = true;
      score += 1;
      updateHUD();
    }
  }
}

function checkEnemyCollisions() {
  for (const enemy of enemies) {
    if (intersects(player, enemy)) {
      gameState = "lost";
      updateHUD();
      return;
    }
  }
}

// ============================================================
// 13. VITÓRIA, DERROTA E CÂMERA
// ============================================================

const flag = {
  x: 2670,
  y: 320,
  width: 30,
  height: 150
};

function updateGame(dt) {
  if (gameState !== "playing") return;

  movePlayerHorizontally(dt);
  movePlayerVertically(dt);

  updateEnemies(dt);
  checkCollectibles();
  checkEnemyCollisions();

  // Cair abaixo da tela significa cair em um abismo.
  if (player.y > HEIGHT + 80) {
    gameState = "lost";
    updateHUD();
  }

  // Atingir a região da bandeira conclui a fase.
  if (intersects(player, flag)) {
    gameState = "won";
    updateHUD();
  }

  // A câmera acompanha o jogador sem mostrar espaço fora do mundo.
  cameraX = player.x + player.width / 2 - WIDTH / 2;
  cameraX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, cameraX));
}

// ============================================================
// 14. DESENHO DO CENÁRIO
// ============================================================

function drawBackground() {
  // Céu em degradê.
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#67c8fa");
  sky.addColorStop(1, "#d2f4ff");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Montanhas decorativas com movimento parallax.
  ctx.fillStyle = "#8ac8ba";
  drawMountain(80 - cameraX * 0.15, 420, 180, 210);
  drawMountain(380 - cameraX * 0.15, 420, 240, 260);
  drawMountain(720 - cameraX * 0.15, 420, 200, 220);
  drawMountain(1050 - cameraX * 0.15, 420, 250, 280);

  // Nuvens.
  drawCloud(100 - cameraX * 0.25, 95);
  drawCloud(420 - cameraX * 0.25, 145);
  drawCloud(780 - cameraX * 0.25, 80);
}

function drawMountain(x, baseY, width, height) {
  // Desenha somente montanhas que podem aparecer na tela.
  if (x + width < -100 || x > WIDTH + 100) return;

  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + width / 2, baseY - height);
  ctx.lineTo(x + width, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawCloud(x, y) {
  if (x < -100 || x > WIDTH + 100) return;

  ctx.fillStyle = "#ffffffcc";
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.arc(x + 24, y - 10, 27, 0, Math.PI * 2);
  ctx.arc(x + 52, y, 20, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================
// 15. DESENHO DAS PLATAFORMAS
// ============================================================

function drawPlatforms() {
  for (const platform of platforms) {
    const screenX = platform.x - cameraX;

    if (screenX + platform.width < 0 || screenX > WIDTH) continue;

    // Base de terra.
    ctx.fillStyle = platform.type === "ground" ? "#9b623c" : "#80513c";
    ctx.fillRect(screenX, platform.y, platform.width, platform.height);

    // Grama no topo.
    ctx.fillStyle = "#42b94d";
    ctx.fillRect(screenX, platform.y, platform.width, 9);

    ctx.fillStyle = "#27853b";
    ctx.fillRect(screenX, platform.y + 9, platform.width, 4);

    // Pequenos detalhes na terra.
    ctx.fillStyle = "#c18452";

    for (let x = 12; x < platform.width; x += 38) {
      ctx.fillRect(screenX + x, platform.y + 24, 10, 5);
      ctx.fillRect(screenX + x + 14, platform.y + 43, 7, 5);
    }
  }
}

// ============================================================
// 16. DESENHO DAS MOEDAS
// ============================================================

function drawCoins() {
  for (const coin of coins) {
    if (coin.collected) continue;

    const x = coin.x - cameraX;
    if (x < -30 || x > WIDTH + 30) continue;

    // Sombra da moeda.
    ctx.fillStyle = "#b77916";
    ctx.beginPath();
    ctx.ellipse(x, coin.y + 3, coin.radius, coin.radius + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Corpo dourado.
    ctx.fillStyle = "#ffdc45";
    ctx.beginPath();
    ctx.ellipse(x, coin.y, coin.radius - 1, coin.radius + 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brilho.
    ctx.fillStyle = "#fff6ae";
    ctx.fillRect(x - 3, coin.y - 6, 3, 12);
  }
}

// ============================================================
// 17. DESENHO DOS INIMIGOS
// ============================================================

function drawEnemies() {
  for (const enemy of enemies) {
    const x = enemy.x - cameraX;
    if (x + enemy.width < 0 || x > WIDTH) continue;

    // Corpo do inimigo.
    ctx.fillStyle = "#9b4c29";
    ctx.fillRect(x + 3, enemy.y + 10, enemy.width - 6, enemy.height - 10);

    // Parte superior arredondada.
    ctx.beginPath();
    ctx.ellipse(
      x + enemy.width / 2,
      enemy.y + 14,
      enemy.width / 2,
      14,
      0,
      Math.PI,
      Math.PI * 2
    );
    ctx.fill();

    // Olhos.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 8, enemy.y + 12, 7, 8);
    ctx.fillRect(x + 20, enemy.y + 12, 7, 8);

    ctx.fillStyle = "#241a20";
    ctx.fillRect(x + 10, enemy.y + 15, 3, 4);
    ctx.fillRect(x + 22, enemy.y + 15, 3, 4);

    // Pés.
    ctx.fillStyle = "#523024";
    ctx.fillRect(x, enemy.y + enemy.height - 5, 14, 7);
    ctx.fillRect(x + 20, enemy.y + enemy.height - 5, 14, 7);
  }
}

// ============================================================
// 18. DESENHO DO JOGADOR
// ============================================================

function drawPlayer() {
  const x = player.x - cameraX;
  const y = player.y;

  // Sombra.
  ctx.fillStyle = "#17324b44";
  ctx.fillRect(x + 2, y + player.height - 2, player.width - 4, 5);

  // Corpo.
  ctx.fillStyle = "#ed4d4d";
  ctx.fillRect(x + 3, y + 12, player.width - 6, 17);

  // Cabeça.
  ctx.fillStyle = "#ffd1a3";
  ctx.fillRect(x + 5, y + 3, player.width - 10, 15);

  // Boné.
  ctx.fillStyle = "#d93248";
  ctx.fillRect(x + 3, y, player.width - 6, 7);
  ctx.fillRect(x + (player.facing === 1 ? 14 : 0), y + 5, 16, 4);

  // Olho na direção do movimento.
  ctx.fillStyle = "#20283b";
  const eyeX = player.facing === 1 ? x + 20 : x + 7;
  ctx.fillRect(eyeX, y + 9, 4, 5);

  // Jardineira.
  ctx.fillStyle = "#3478ed";
  ctx.fillRect(x + 4, y + 24, player.width - 8, 9);

  // Pernas.
  ctx.fillStyle = "#253e77";
  ctx.fillRect(x + 4, y + 32, 9, 7);
  ctx.fillRect(x + 18, y + 32, 9, 7);

  // Sapatos.
  ctx.fillStyle = "#542e2e";
  ctx.fillRect(x + 1, y + 38, 13, 4);
  ctx.fillRect(x + 16, y + 38, 13, 4);
}

// ============================================================
// 19. DESENHO DA BANDEIRA
// ============================================================

function drawFlag() {
  const x = flag.x - cameraX;

  ctx.fillStyle = "#e9f2ff";
  ctx.fillRect(x + 10, flag.y, 7, flag.height);

  ctx.fillStyle = "#ffcf45";
  ctx.fillRect(x + 2, flag.y + flag.height - 8, 23, 8);

  ctx.fillStyle = "#2bd47c";
  ctx.beginPath();
  ctx.moveTo(x + 17, flag.y + 8);
  ctx.lineTo(x + 65, flag.y + 25);
  ctx.lineTo(x + 17, flag.y + 43);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Arial";
  ctx.fillText("FIM", x + 22, flag.y + 28);
}

// ============================================================
// 20. MENSAGEM DE VITÓRIA OU GAME OVER
// ============================================================

function drawEndMessage() {
  if (gameState === "playing") return;

  // Camada escura por cima do jogo.
  ctx.fillStyle = "#081226cc";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const won = gameState === "won";

  ctx.textAlign = "center";
  ctx.fillStyle = won ? "#ffe36d" : "#ff8585";
  ctx.font = "bold 44px Arial";
  ctx.fillText(won ? "FASE CONCLUÍDA!" : "GAME OVER", WIDTH / 2, HEIGHT / 2 - 30);

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px Arial";
  ctx.fillText(`Moedas coletadas: ${score}`, WIDTH / 2, HEIGHT / 2 + 12);

  ctx.fillStyle = "#b8c9e6";
  ctx.font = "16px Arial";
  ctx.fillText("Pressione R para jogar novamente", WIDTH / 2, HEIGHT / 2 + 52);

  ctx.textAlign = "left";
}

// ============================================================
// 21. RENDERIZAÇÃO COMPLETA
// ============================================================

function render() {
  drawBackground();

  // Transforma as coordenadas do mundo em coordenadas da câmera.
  drawPlatforms();
  drawCoins();
  drawEnemies();
  drawFlag();
  drawPlayer();

  drawEndMessage();
}

// ============================================================
// 22. GAME LOOP
// ============================================================

function gameLoop(timestamp) {
  // O timestamp é fornecido pelo requestAnimationFrame em milissegundos.
  // Convertendo para segundos, podemos calcular movimento por tempo.
  const dt = lastTime === 0
    ? 0
    : Math.min((timestamp - lastTime) / 1000, 0.033);

  lastTime = timestamp;

  updateGame(dt);
  render();

  animationId = requestAnimationFrame(gameLoop);
}

// Inicia o jogo pela primeira vez.
resetGame();
animationId = requestAnimationFrame(gameLoop);
