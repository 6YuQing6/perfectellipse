const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const historyEl = document.getElementById("history");
// fix bluriness
// https://medium.com/wdstack/fixing-html5-2d-canvas-blur-8ebe27db07da
const dpi = window.devicePixelRatio || 1;
canvas.style.width = window.innerWidth + "px";
canvas.style.height = window.innerHeight + "px";
canvas.width = window.innerWidth * dpi;
canvas.height = window.innerHeight * dpi;
ctx.scale(dpi, dpi);
const W = window.innerWidth,
  H = window.innerHeight;
const cx = W / 2,
  cy = H / 2;

let drawing = false;
let path = [];
let beginPoint = null;
let endPoint = null;
let gameOver = false;
let A, B, angle;
let liveScore = null;
let highScore = 0;
let newHighScore = false;
let history = [];

function randEllipse() {
  A = W * 0.18 + Math.random() * (W * 0.05);
  B = H * 0.18 + Math.random() * (H * 0.05);
  if (B > A) [A, B] = [B, A]; // ensure A >= B
  angle = Math.random() * Math.PI; // rotation 0–180°
}

// Point on rotated ellipse at parameter t
function ellipsePoint(t) {
  const ex = A * Math.cos(t);
  const ey = B * Math.sin(t);
  return [
    cx + ex * Math.cos(angle) - ey * Math.sin(angle),
    cy + ex * Math.sin(angle) + ey * Math.cos(angle),
  ];
}

// Score: for each drawn point, find nearest point on ellipse via angle in ellipse space
function calcScore() {
  // if end point too far from ellipse, player is going wrong way, so score is 0
  if (pointError(beginPoint[0], beginPoint[1]) > 80) return 0;
  if (endPoint && pointError(endPoint[0], endPoint[1]) > 80) return 0;
  let totalErr = 0;
  const cosA = Math.cos(-angle),
    sinA = Math.sin(-angle);
  for (const [px, py] of path) {
    const dx = px - cx,
      dy = py - cy;
    // Rotate into ellipse frame
    const lx = dx * cosA - dy * sinA;
    const ly = dx * sinA + dy * cosA;
    const t = Math.atan2(ly / B, lx / A);
    const [ix, iy] = ellipsePoint(t);
    totalErr += Math.hypot(px - ix, py - iy);
  }
  const avgErr = totalErr / path.length;
  return Math.max(0, Math.min(100, 100 - (avgErr / 40) * 100));
}

function scoreColor(pct) {
  if (pct >= 99) return "#00ff88"; // S  — bright green
  if (pct >= 90) return "rgb(57, 255, 0)"; // A+ — soft green
  if (pct >= 80) return "rgb(160, 255, 0)"; // B+ — lime yellow
  if (pct >= 70) return "rgb(255, 239, 0)"; // B  — yellow
  if (pct >= 45) return "rgb(255, 166, 0)"; // D  — deep orange
  return "rgb(255, 29, 0)"; // F  — red
}

function drawGuide(isGameOver) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  ctx.save();

  // Axis lines — always visible
  ctx.strokeStyle = "#2a2a3a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - (A + 18) * cos, cy - (A + 18) * sin);
  ctx.lineTo(cx + (A + 18) * cos, cy + (A + 18) * sin);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - (B + 18) * -sin, cy - (B + 18) * cos);
  ctx.lineTo(cx + (B + 18) * -sin, cy + (B + 18) * cos);
  ctx.stroke();

  if (isGameOver) {
    // Dashed ellipse — only at game over
    ctx.beginPath();
    ctx.ellipse(cx, cy, A, B, angle, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Axis endpoint dots — always visible
  const mkr = (x, y) => {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  };
  mkr(cx + A * cos, cy + A * sin);
  mkr(cx - A * cos, cy - A * sin);
  mkr(cx + B * -sin, cy + B * cos);
  mkr(cx - B * -sin, cy - B * cos);

  ctx.restore();
}

function drawCenterScore(pct, isGameOver) {
  const label = pct.toFixed(1) + "%";
  const size = 64;
  ctx.save();
  ctx.font = `bold ${size}px 'LowerPixel', 'Pixelify Sans', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 1;
  ctx.fillStyle = scoreColor(pct);
  // Glow on new high score
  if (isGameOver && newHighScore) {
    ctx.shadowColor = scoreColor(pct);
    ctx.shadowBlur = 30;
  }
  ctx.fillText(label, cx, cy - 10);
  ctx.shadowBlur = 0;
  if (isGameOver) {
    // High score
    if (highScore > 0) {
      if (newHighScore) {
        // Just show "New Highscore!" with no number
        ctx.font = `24px 'Playpen Sans', sans-serif`;
        ctx.fillStyle = scoreColor(highScore);
        ctx.textAlign = "center";
        ctx.fillText("New Highscore!", cx, cy + 42);
      } else {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Measure "Best: " in Playpen Sans
        ctx.font = `24px 'Playpen Sans', sans-serif`;
        const bestLabel = "Best: ";
        const bestWidth = ctx.measureText(bestLabel).width;

        // Measure the number in Pixelify Sans
        ctx.font = `32px 'Pixelify Sans', sans-serif`;
        const numStr = highScore.toFixed(1) + "%";
        const numWidth = ctx.measureText(numStr).width;

        const totalWidth = bestWidth + numWidth;
        const startX = cx - totalWidth / 2;

        // Draw "Best: " in Playpen Sans
        ctx.font = `24px 'Playpen Sans', sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
        ctx.fillText(bestLabel, startX, cy + 42);

        // Draw the number in Pixelify Sans
        ctx.font = `32px 'Pixelify Sans', sans-serif`;
        ctx.fillStyle = scoreColor(highScore);
        ctx.fillText(numStr, startX + bestWidth, cy + 42);
      }
    } else {
      ctx.font = `24px 'Playpen Sans', sans-serif`;
      ctx.fillStyle = "#ff1212";
      ctx.textAlign = "center";
      ctx.fillText("Try Again", cx, cy + 42);
    }
    if (history.length > 1) {
      const avg = history.reduce((a, b) => a + b, 0) / history.length;
      ctx.font = `24px 'Playpen Sans', sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.fillText(`Average: ${avg.toFixed(1)}%`, cx, cy + 84);
    }
    ctx.font = `20px  'Playpen Sans', sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.fillText("Press anywhere to play again", cx, cy + 130);
  }
  ctx.restore();
}

function pointError(px, py) {
  const cosA = Math.cos(-angle),
    sinA = Math.sin(-angle);
  const dx = px - cx,
    dy = py - cy;
  const lx = dx * cosA - dy * sinA;
  const ly = dx * sinA + dy * cosA;
  const t = Math.atan2(ly / B, lx / A);
  const [ix, iy] = ellipsePoint(t);
  return Math.hypot(px - ix, py - iy);
}

function errToColor(err) {
  const maxErr = 40;
  const t = Math.min(err / maxErr, 1);
  const r = Math.round(80 + 175 * t);
  const g = Math.round(220 - 200 * t);
  const b = Math.round(80 - 60 * t);
  const a = 1;
  return `rgba(${r},${g},${b},${a})`;
}

function drawPath(pts) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const maxW = 6,
    minW = 4,
    taperPts = 40;
  for (let i = 1; i < pts.length; i++) {
    const t = Math.min(i / taperPts, 1);
    const w = maxW + (minW - maxW) * t;
    const err = pointError(pts[i][0], pts[i][1]);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
    ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = errToColor(err);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCenterDot(hide) {
  if (hide) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#555577";
  ctx.fill();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  const showScore = liveScore !== null;
  drawGuide(gameOver);
  drawPath(path);
  drawCenterDot(showScore); // hide dot when score shown
  if (showScore) drawCenterScore(liveScore, gameOver);
}

function reset() {
  path = [];
  drawing = false;
  gameOver = false;
  liveScore = null;
  newHighScore = false;
  randEllipse();
  render();
}

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return [src.clientX - r.left, src.clientY - r.top];
}

function onDown(e) {
  e.preventDefault();
  if (gameOver) {
    reset();
    return;
  }
  if (drawing) return;
  drawing = true;
  path = [getPos(e)];
  beginPoint = path[0];
  liveScore = 0;
  render();
}

function onMove(e) {
  e.preventDefault();
  if (!drawing || gameOver) return;
  path.push(getPos(e));
  endPoint = path[path.length - 1];
  liveScore = calcScore();
  if (liveScore <= 0) {
    gameOver = true;
  }
  render();
}

function onUp(e) {
  e.preventDefault();
  if (!drawing || gameOver) return;
  drawing = false;
  gameOver = true;
  if (
    beginPoint &&
    endPoint &&
    Math.hypot(beginPoint[0] - endPoint[0], beginPoint[1] - endPoint[1]) > 100
  ) {
    liveScore = 0;
  } else {
    liveScore = calcScore();
  }
  if (liveScore > highScore) {
    highScore = liveScore;
    newHighScore = true;
  } else {
    newHighScore = false;
  }
  if (liveScore > 0) {
    history.push(liveScore);
  }
  render();
}

canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("mouseup", onUp);
canvas.addEventListener("mouseleave", onUp);
canvas.addEventListener("touchstart", onDown, { passive: false });
canvas.addEventListener("touchmove", onMove, { passive: false });
canvas.addEventListener("touchend", onUp, { passive: false });

randEllipse();
render();
