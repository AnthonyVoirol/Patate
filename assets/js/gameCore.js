/*

'||''|.   ..|''||   |''||''|     |     |''||''|  ..|''||   
 ||   || .|'    ||     ||       |||       ||    .|'    ||  
 ||...|' ||      ||    ||      |  ||      ||    ||      || 
 ||      '|.     ||    ||     .''''|.     ||    '|.     || 
.||.      ''|...|'    .||.   .|.  .||.   .||.    ''|...|'  
                                                           
                                                           
POTATO.THESERVER.LIFE
LICENSE GPL-3.0

-------------------------------
gameCore.js
-
Game core file
*/

import { submitScore } from "./leaderboard.js";
import { isMobile, initMobileControls } from "./mobileControls.js";

let canvas;
let ctx;
let animationFrameId;

let gamePaused = false;
let gameOver = false;
let score = 0;

let patate;
let patateImg;

let ground;
let platforms = [];
let minSpacing = 60;
let maxSpacing = 110;
let lastY;

let moveLeft = false;
let moveRight = false;
let controlsActive = false;

// Particle system
let particles = [];
let clouds = [];

// Visual effects
let cameraShake = 0;
let scorePopups = [];

// Camera system
let cameraY = 0;
let cameraTargetY = 0;

// Delta time variables for frame-rate independence
let lastTimestamp = 0;
const TARGET_FPS = 60;
const TARGET_FRAME_TIME = 1000 / TARGET_FPS;

export function initGame() {
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  canvas.width = 400;
  canvas.height = 600;

  patateImg = new Image();
  patateImg.src = "assets/img/potato.png";

  patate = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 60,
    width: 40,
    height: 40,
    velocityX: 0,
    velocityY: 0,
    gravity: 0.25,
    baseGravity: 0.25,
    jumpPower: -8.5,
    baseJumpPower: -8.5,
    onGround: true,
    firstPlatformTouched: false,
    rotation: 0,
    targetRotation: 0,
  };

  ground = {
    x: 0,
    y: canvas.height - 20,
    width: canvas.width,
    height: 20,
    visible: true,
  };

  generatePlatforms();
  initClouds();
  initControls();
}

export function startGame() {
  if (!window.pseudoSubmitted) return;

  gameOver = false;
  gamePaused = false;
  score = 0;
  window.score = 0;
  window.gameOver = false;
  window.gamePaused = false;

  controlsActive = true;
  particles = [];
  scorePopups = [];
  lastTimestamp = performance.now();

  // Reset camera
  cameraY = 0;
  cameraTargetY = 0;

  document.getElementById("score").textContent = "0";
  update(lastTimestamp);
}

export function restartGame() {
  document.location.reload();
}

export function togglePause() {
  gamePaused = !gamePaused;
  window.gamePaused = gamePaused;

  const pauseMenu = document.getElementById("pauseMenu");
  if (gamePaused) {
    pauseMenu.style.display = "block";
    document.getElementById("pauseScore").textContent = score;
  } else {
    pauseMenu.style.display = "none";
    lastTimestamp = performance.now();
    requestAnimationFrame(update);
  }
}

function update(timestamp) {
  if (gameOver || gamePaused) return;

  // Calculate delta time
  const deltaTime = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  // Normalize to 60 FPS (delta multiplier)
  const delta = deltaTime / TARGET_FRAME_TIME;

  adjustDifficulty();
  updatePatate(delta);
  updateCamera(delta);
  ensurePlatformsAhead();

  const collisionResult = updatePlatforms(delta);
  if (collisionResult.scoreChanged) {
    score += collisionResult.scoreIncrement;
    window.score = score;
    document.getElementById("score").textContent = score;

    // Create score popup
    createScorePopup(
      patate.x + patate.width / 2,
      patate.y,
      collisionResult.scoreIncrement,
    );

    // Camera shake on boost platforms
    if (collisionResult.scoreIncrement > 1) {
      cameraShake = 8;
    }
  }

  updateParticles(delta);
  updateClouds(delta);
  updateScorePopups(delta);

  // Game over if player falls below camera view
  if (patate.y > cameraY + canvas.height) {
    gameOver = true;
    window.gameOver = true;
    showGameOverScreen();
    return;
  }

  draw(delta);

  animationFrameId = requestAnimationFrame(update);
}

function draw(delta) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw gradient background (fixed, doesn't move with camera)
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#87CEEB");
  gradient.addColorStop(0.5, "#B4E7F5");
  gradient.addColorStop(1, "#A2D9CE");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Apply camera transform + shake
  ctx.save();
  ctx.translate(0, -cameraY);

  if (cameraShake > 0) {
    const shakeX = (Math.random() - 0.5) * cameraShake;
    const shakeY = (Math.random() - 0.5) * cameraShake;
    ctx.translate(shakeX, shakeY);
    cameraShake *= Math.pow(0.9, delta);
    if (cameraShake < 0.1) cameraShake = 0;
  }

  // Draw clouds
  drawClouds();

  // Draw ground
  if (ground.visible) {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(ground.x, ground.y, ground.width, ground.height);

    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(ground.x, ground.y, ground.width, 5);
  }

  // Draw platforms with effects
  platforms.forEach((plat) => {
    drawPlatform(plat);
  });

  // Draw particles
  drawParticles();

  // Draw potato with rotation and shadow
  ctx.save();
  ctx.translate(patate.x + patate.width / 2, patate.y + patate.height / 2);
  ctx.rotate(patate.rotation);

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(-patate.width / 2 + 2, patate.height / 2 + 5, patate.width, 5);

  ctx.drawImage(
    patateImg,
    -patate.width / 2,
    -patate.height / 2,
    patate.width,
    patate.height,
  );
  ctx.restore();

  // Draw score popups
  drawScorePopups();

  ctx.restore();
}

function drawPlatform(plat) {
  ctx.save();

  if (plat.type === "boost") {
    // Boost platform - red with glow
    const gradient = ctx.createLinearGradient(
      plat.x,
      plat.y,
      plat.x + plat.width,
      plat.y + plat.height,
    );
    gradient.addColorStop(0, "#FF6B6B");
    gradient.addColorStop(1, "#FF4757");
    ctx.fillStyle = gradient;

    // Glow effect
    ctx.shadowColor = "#FF6B6B";
    ctx.shadowBlur = 15;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    // Add shine effect
    ctx.shadowBlur = 0;
    const shineGrad = ctx.createLinearGradient(
      plat.x,
      plat.y,
      plat.x,
      plat.y + plat.height,
    );
    shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    shineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shineGrad;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height / 2);
  } else {
    // Normal platform - green with depth
    const gradient = ctx.createLinearGradient(
      plat.x,
      plat.y,
      plat.x + plat.width,
      plat.y + plat.height,
    );
    gradient.addColorStop(0, "#6BCF7F");
    gradient.addColorStop(1, "#4CAF50");
    ctx.fillStyle = gradient;

    // Subtle glow
    ctx.shadowColor = "#6BCF7F";
    ctx.shadowBlur = 8;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    // Shine effect
    ctx.shadowBlur = 0;
    const shineGrad = ctx.createLinearGradient(
      plat.x,
      plat.y,
      plat.x,
      plat.y + plat.height,
    );
    shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    shineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shineGrad;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height / 2);
  }

  // Border
  ctx.strokeStyle = plat.type === "boost" ? "#D63031" : "#27ae60";
  ctx.lineWidth = 2;
  ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);

  ctx.restore();
}

function updatePatate(delta) {
  // Apply gravity with delta time
  patate.velocityY += patate.gravity * delta;
  patate.y += patate.velocityY * delta;

  // Horizontal movement with smoother acceleration
  const acceleration = 0.8 * delta;
  const maxSpeed = 4;
  const friction = Math.pow(0.85, delta);

  if (moveLeft) {
    patate.velocityX -= acceleration;
    patate.targetRotation = -0.1;
  } else if (moveRight) {
    patate.velocityX += acceleration;
    patate.targetRotation = 0.1;
  } else {
    patate.velocityX *= friction;
    patate.targetRotation = 0;
  }

  // Clamp speed
  patate.velocityX = Math.max(-maxSpeed, Math.min(maxSpeed, patate.velocityX));

  patate.x += patate.velocityX * delta;

  // Smooth rotation
  const rotationSpeed = 0.1 * delta;
  patate.rotation += (patate.targetRotation - patate.rotation) * rotationSpeed;

  // Wrap around screen
  if (patate.x + patate.width < 0) {
    patate.x = canvas.width;
  } else if (patate.x > canvas.width) {
    patate.x = -patate.width;
  }

  // Ground collision
  if (
    ground.visible &&
    patate.y + patate.height >= ground.y &&
    patate.velocityY > 0
  ) {
    patate.y = ground.y - patate.height;
    patate.velocityY = 0;
    patate.onGround = true;
  }

  if (isMobile()) {
    jump();
  }
}

function updateCamera(delta) {
  // Camera follows player when they go above the middle of the screen
  const threshold = canvas.height * 0.4;

  if (patate.y < threshold) {
    cameraTargetY = patate.y - threshold;
  }

  // Smooth camera movement
  const cameraSpeed = 0.1 * delta;
  cameraY += (cameraTargetY - cameraY) * cameraSpeed;
}

function ensurePlatformsAhead() {
  // Find the highest platform
  let highestPlatform = platforms.reduce((a, b) => (a.y < b.y ? a : b));

  // Generate new platforms if the highest one is too close to the camera top
  const generationThreshold = cameraY - canvas.height;

  while (highestPlatform.y > generationThreshold) {
    const newPlatform = {
      x: Math.random() * (canvas.width - 80),
      y:
        highestPlatform.y -
        (minSpacing + Math.random() * (maxSpacing - minSpacing)),
      width: 80,
      height: 10,
      type: Math.random() > 0.8 ? "boost" : "normal",
      touched: false,
    };

    platforms.push(newPlatform);
    highestPlatform = newPlatform;

    // Add safety platform after boost
    if (newPlatform.type === "boost") {
      const safePlatform = {
        x: Math.random() * (canvas.width - 80),
        y: newPlatform.y + 40,
        width: 80,
        height: 10,
        type: "normal",
        touched: false,
      };
      platforms.push(safePlatform);
    }
  }
}

function jump() {
  if (gameOver || !controlsActive) return;

  if (patate.onGround) {
    patate.velocityY = patate.jumpPower;
    patate.onGround = false;
    createJumpParticles(patate.x + patate.width / 2, patate.y + patate.height);
  }
}

function generatePlatforms() {
  platforms = [];
  lastY = canvas.height - 80;

  // Generate more platforms initially to ensure coverage when camera moves up
  for (let i = 0; i < 20; i++) {
    const platform = {
      x: Math.random() * (canvas.width - 80),
      y: lastY,
      width: 80,
      height: 10,
      type: Math.random() > 0.8 ? "boost" : "normal",
      touched: false,
    };
    platforms.push(platform);
    lastY -= minSpacing + Math.random() * (maxSpacing - minSpacing);
  }
}

function updatePlatforms(delta) {
  let scoreChanged = false;
  let scoreIncrement = 0;

  platforms.forEach((plat) => {
    if (
      patate.y + patate.height <= plat.y + plat.height &&
      patate.y + patate.height >= plat.y &&
      patate.x + patate.width > plat.x &&
      patate.x < plat.x + plat.width &&
      patate.velocityY > 0
    ) {
      // Landing
      patate.y = plat.y - patate.height;
      patate.velocityY = patate.jumpPower;
      patate.onGround = true;

      if (!plat.touched) {
        plat.touched = true;
        scoreChanged = true;

        if (plat.type === "boost") {
          patate.velocityY = patate.jumpPower * 1.5;
          scoreIncrement = 2;
          createBoostParticles(patate.x + patate.width / 2, plat.y);
        } else {
          scoreIncrement = 1;
          createBounceParticles(patate.x + patate.width / 2, plat.y);
        }

        if (!patate.firstPlatformTouched) {
          patate.firstPlatformTouched = true;
        }
      }

      createLandingParticles(patate.x + patate.width / 2, plat.y);

      // AUTO-JUMP ON MOBILE: Automatically jump when touching platform
      if (isMobile() && patate.onGround) {
        jump();
      }
    }

    if (plat.touched && plat.y > canvas.height - 50) {
      if (ground.visible) {
        ground.visible = false;
      }
    }
  });

  // Remove platforms that are too far below the camera
  platforms = platforms.filter(
    (plat) => plat.y < cameraY + canvas.height + 200,
  );

  return { scoreChanged, scoreIncrement };
}

// Particle system
function createJumpParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 2 + 1,
      life: 1,
      color: "#6BCF7F",
      size: Math.random() * 4 + 2,
    });
  }
}

function createLandingParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 3,
      life: 1,
      color: "#A2D9CE",
      size: Math.random() * 5 + 2,
    });
  }
}

function createBounceParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4 - 2,
      life: 1,
      color: "#6BCF7F",
      size: Math.random() * 4 + 3,
    });
  }
}

function createBoostParticles(x, y) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 6 - 3,
      life: 1,
      color: Math.random() > 0.5 ? "#FF6B6B" : "#FFD93D",
      size: Math.random() * 6 + 3,
    });
  }
}

function updateParticles(delta) {
  particles.forEach((p) => {
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.vy += 0.2 * delta; // gravity
    p.life -= 0.02 * delta;
  });

  particles = particles.filter((p) => p.life > 0);
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// Clouds
function initClouds() {
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6,
      width: Math.random() * 60 + 40,
      height: Math.random() * 30 + 20,
      speed: Math.random() * 0.3 + 0.1,
    });
  }
}

function updateClouds(delta) {
  clouds.forEach((cloud) => {
    cloud.x += cloud.speed * delta;
    if (cloud.x > canvas.width + cloud.width) {
      cloud.x = -cloud.width;
      cloud.y = Math.random() * canvas.height * 0.6;
    }
  });
}

function drawClouds() {
  ctx.save();
  clouds.forEach((cloud) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.width / 3, 0, Math.PI * 2);
    ctx.arc(
      cloud.x + cloud.width / 3,
      cloud.y - cloud.height / 4,
      cloud.width / 4,
      0,
      Math.PI * 2,
    );
    ctx.arc(
      cloud.x + (cloud.width * 2) / 3,
      cloud.y,
      cloud.width / 3.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
  ctx.restore();
}

// Score popups
function createScorePopup(x, y, points) {
  scorePopups.push({
    x: x,
    y: y,
    points: points,
    life: 1,
    vy: -2,
  });
}

function updateScorePopups(delta) {
  scorePopups.forEach((popup) => {
    popup.y += popup.vy * delta;
    popup.vy += 0.05 * delta;
    popup.life -= 0.02 * delta;
  });

  scorePopups = scorePopups.filter((popup) => popup.life > 0);
}

function drawScorePopups() {
  ctx.save();
  scorePopups.forEach((popup) => {
    ctx.globalAlpha = popup.life;
    ctx.font = "bold 24px Fredoka";
    ctx.fillStyle = popup.points > 1 ? "#FF6B6B" : "#6BCF7F";
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    const text = "+" + popup.points;
    ctx.strokeText(text, popup.x - 15, popup.y);
    ctx.fillText(text, popup.x - 15, popup.y);
  });
  ctx.restore();
}

function initControls() {
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  document.addEventListener("focusin", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      controlsActive = false;
    }
  });

  document.addEventListener("focusout", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      controlsActive = true;
    }
  });

  document
    .getElementById("continueButton")
    .addEventListener("click", togglePause);
  document
    .getElementById("restartFromPauseButton")
    .addEventListener("click", restartGame);
  document
    .getElementById("restartButton")
    .addEventListener("click", restartGame);

  // Initialize mobile controls if on mobile device
  if (isMobile()) {
    initMobileControls(
      (value) => {
        moveLeft = value;
      },
      (value) => {
        moveRight = value;
      },
      (value) => {
        controlsActive = value;
      },
    );
  }
}

function handleKeyDown(event) {
  if (!controlsActive) return;

  if (gameOver) return;

  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    moveLeft = true;
    event.preventDefault();
  }

  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    moveRight = true;
    event.preventDefault();
  }

  if (event.key === " " || event.key === "w" || event.key === "W") {
    jump();
    event.preventDefault();
  }

  if (event.key === "Escape" || event.key === "p" || event.key === "P") {
    togglePause();
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    moveLeft = false;
  }

  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    moveRight = false;
  }
}

function adjustDifficulty() {
  if (score > 50) {
    minSpacing = 100;
    maxSpacing = 150;

    if (score <= 100) {
      patate.gravity = patate.baseGravity * 0.8;
      patate.jumpPower = patate.baseJumpPower * 1.15;
    } else {
      patate.gravity = patate.baseGravity;
      patate.jumpPower = patate.baseJumpPower;
    }
  }

  if (score > 100 && score <= 200) {
    platforms.forEach((plat) => {
      plat.type = "boost";
    });
  }

  if (score > 200) {
    minSpacing = 120;
    maxSpacing = 150;
    platforms.forEach((plat) => {
      plat.y += 2;
    });
  }
}

function showGameOverScreen() {
  const gameOverScreen = document.getElementById("gameOverScreen");
  const finalScoreElement = document.getElementById("finalScore");

  gameOverScreen.style.display = "block";
  finalScoreElement.textContent = score;

  if (window.uid) {
    submitScore(window.uid, score, true);
  }
}

export { score, gameOver, gamePaused, showGameOverScreen };

export function setControlsActive(active) {
  controlsActive = active;
}
