// --- 実際の天体データ（単位は万km） ---
const DATA = {
  sun: { name: "太陽", radius: 69.6, distance: 0, color: "#fde047" },
  mercury: { name: "水星", radius: 0.244, distance: 5791, color: "#a8a29e" },
  venus: { name: "金星", radius: 0.605, distance: 10820, color: "#fca5a5" },
  earth: { name: "地球", radius: 0.637, distance: 14960, color: "#3b82f6" },
  moon: { name: "月", radius: 0.174, distance: 14960 + 38.4, color: "#d1d5db" },
  mars: { name: "火星", radius: 0.339, distance: 22792, color: "#ef4444" },
  jupiter: { name: "木星", radius: 6.991, distance: 77857, color: "#e0b084" },
  saturn: { name: "土星", radius: 5.823, distance: 143353, color: "#fde68a" },
  uranus: { name: "天王星", radius: 2.536, distance: 287246, color: "#7dd3fc" },
  neptune: {
    name: "海王星",
    radius: 2.462,
    distance: 450440,
    color: "#4338ca",
  },
  pluto: { name: "冥王星", radius: 0.118, distance: 590638, color: "#c4b5a5" },
};

// 位置スライダーが表せる最大距離（万km）＝冥王星より少し先まで
const POS_MAX = 600000;
// 位置スライダー(HTML側 input要素)の内部値域
const POS_SLIDER_MAX = 1000;

const canvas = document.getElementById("scaleCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("canvasContainer");

let width, height;
let zoom = 1;
let cameraX = 0;
let showRays = true;
let stars = [];

// ズームの指数レンジ（1 〜 10^ZOOM_EXPONENT_MAX 倍）。惑星が増えてPOS_MAXが
// 大きくなった分、遠くの小さな星まで寄れるようにレンジを拡張。
const ZOOM_EXPONENT_MAX = 6;
const ZOOM_MAX = Math.pow(10, ZOOM_EXPONENT_MAX);

function getCurrentScale() {
  const baseScale = (width * 0.8) / POS_MAX;
  return baseScale * zoom;
}

// 「〇〇万km」「〇〇億km」「〇〇km」に自動でフォーマットする
function formatDistance(manKm) {
  if (manKm >= 10000) {
    return (
      (manKm / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 2 }) +
      "億km"
    );
  } else if (manKm >= 1) {
    return manKm.toLocaleString("ja-JP", { maximumFractionDigits: 2 }) + "万km";
  }
  return Math.round(manKm * 10000).toLocaleString("ja-JP") + "km";
}

// ------------------------------------------------------------------
// 位置スライダー ⇔ 実距離 の変換
// 太陽のすぐ近くは何もないためリニアに、水星〜冥王星の区間は
// 内側の惑星が密集し外側ほど間隔が広いため対数で対応させる。
// こうすることで、スライダー上で全ての星のラベルが偏りなく並ぶ。
// ------------------------------------------------------------------
const LINEAR_ZONE_END = 3000; // 万km：この距離までは太陽近傍としてリニア対応
const LINEAR_FRAC = 0.04; // スライダー全体に占めるリニア区間の割合

function sliderValueToDistance(sliderVal) {
  const t = Math.max(0, Math.min(1, sliderVal / POS_SLIDER_MAX));
  if (t <= LINEAR_FRAC) {
    return (t / LINEAR_FRAC) * LINEAR_ZONE_END;
  }
  const minLog = Math.log10(LINEAR_ZONE_END);
  const maxLog = Math.log10(POS_MAX);
  const u = (t - LINEAR_FRAC) / (1 - LINEAR_FRAC);
  return Math.pow(10, minLog + u * (maxLog - minLog));
}

function distanceToSliderValue(distance) {
  const d = Math.max(0, Math.min(POS_MAX, distance));
  let t;
  if (d <= LINEAR_ZONE_END) {
    t = (d / LINEAR_ZONE_END) * LINEAR_FRAC;
  } else {
    const minLog = Math.log10(LINEAR_ZONE_END);
    const maxLog = Math.log10(POS_MAX);
    const u = (Math.log10(d) - minLog) / (maxLog - minLog);
    t = LINEAR_FRAC + u * (1 - LINEAR_FRAC);
  }
  return Math.max(0, Math.min(1, t)) * POS_SLIDER_MAX;
}

function generateStars() {
  stars = [];
  const count = Math.round((width * height) / 4000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.6 + 0.2,
    });
  }
}

function resize() {
  width = container.clientWidth;
  height = container.clientHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  generateStars();
  draw();
}
window.addEventListener("resize", resize);

const posSlider = document.getElementById("posSlider");
const zoomSlider = document.getElementById("zoomSlider");
const posLabel = document.getElementById("posLabel");
const zoomLabel = document.getElementById("zoomLabel");
const viewWidthLabel = document.getElementById("viewWidthLabel");
const cameraDistLabel = document.getElementById("cameraDistLabel");
const sliderTicksContainer = document.getElementById("sliderTicks");
const rayToggle = document.getElementById("rayToggle");

// ------------------------------------------------------------------
// スライダー下の星名表示
// input[type=range] のつまみ(24px)は左右に半径(12px)分の余白を持つため、
// 単純な 0%〜100% ではズレる。calc((100% - 24px) * t + 12px) で、
// 実際につまみが吸い付いた時の中心位置と一致させる。
// ------------------------------------------------------------------
const TICK_BODIES = [
  { key: "sun", label: "太陽", distance: DATA.sun.distance },
  { key: "mercury", label: "水星", distance: DATA.mercury.distance },
  { key: "venus", label: "金星", distance: DATA.venus.distance },
  { key: "earth", label: "地球・月", distance: DATA.earth.distance },
  { key: "mars", label: "火星", distance: DATA.mars.distance },
  { key: "jupiter", label: "木星", distance: DATA.jupiter.distance },
  { key: "saturn", label: "土星", distance: DATA.saturn.distance },
  { key: "uranus", label: "天王星", distance: DATA.uranus.distance },
  { key: "neptune", label: "海王星", distance: DATA.neptune.distance },
  { key: "pluto", label: "冥王星", distance: DATA.pluto.distance },
];

function renderSliderTicks() {
  sliderTicksContainer.innerHTML = "";
  TICK_BODIES.forEach((body, i) => {
    const t = distanceToSliderValue(body.distance) / POS_SLIDER_MAX;
    const btn = document.createElement("button");
    btn.type = "button";
    // 押しやすいボタンスタイル（背景色・枠線・影・タップ時の縮小アニメーション）
    btn.className =
      "absolute whitespace-nowrap cursor-pointer text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700 hover:text-amber-300 border border-slate-700/80 hover:border-amber-400/50 transition shadow-sm z-20 flex items-center gap-1 active:scale-95";
    btn.style.left = `calc((100% - 24px) * ${t} + 12px)`;
    btn.style.transform = "translateX(-50%)";
    btn.style.top = i % 2 === 0 ? "0px" : "16px";

    // 星の色の小さなカラー丸
    const dot = document.createElement("span");
    dot.className = "w-1.5 h-1.5 rounded-full inline-block shrink-0";
    dot.style.background = DATA[body.key] ? DATA[body.key].color : "#ffffff";
    btn.appendChild(dot);

    // 星の名前テキスト
    const text = document.createElement("span");
    text.textContent = body.label;
    btn.appendChild(text);

    btn.addEventListener("click", () => {
      updateCameraPosition(body.distance, true);
      hideHint();
    });

    sliderTicksContainer.appendChild(btn);
  });
}
renderSliderTicks();

// カメラ位置を更新し、星に「吸い付く（スナップ）」処理
function updateCameraPosition(rawValue, updateSlider = false) {
  rawValue = Math.max(0, Math.min(POS_MAX, rawValue));

  // ズームしているほど吸い付く範囲（万km）を狭くして、微調整しやすくする
  const threshold = 500 / Math.max(1, Math.sqrt(zoom));

  // 全天体を自動的にスナップ対象にする（惑星を増やしてもここを直す必要がない）
  const targets = Object.keys(DATA).map((key) => ({
    dist: DATA[key].distance,
    name: DATA[key].name,
  }));

  let snappedTarget = null;
  let snappedDiff = Infinity;
  let nearestTarget = null;
  let nearestDiff = Infinity;

  for (const t of targets) {
    const diff = Math.abs(rawValue - t.dist);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestTarget = t;
    }
    if (diff <= threshold && diff < snappedDiff) {
      snappedTarget = t;
      snappedDiff = diff;
    }
  }

  if (snappedTarget) {
    // 星の近くなら、カメラの座標を星と【完全に同じ】にする（画面中央にピタッと止まる）
    cameraX = snappedTarget.dist;
    posLabel.innerHTML = `<span class="text-amber-300"><i class="fa-solid fa-location-crosshairs"></i> ${snappedTarget.name}（中心）</span>`;
  } else {
    cameraX = rawValue;
    posLabel.innerText = nearestTarget
      ? `${nearestTarget.name}へ移動中`
      : "宇宙空間";
  }

  // ボタン操作時のみ、スライダーのツマミ位置を同期させる（ドラッグ中には上書きしない）
  if (updateSlider) {
    posSlider.value = distanceToSliderValue(cameraX);
  }

  draw();
}

function setZoom(newZoom, focusScreenX = null) {
  newZoom = Math.max(1, Math.min(ZOOM_MAX, newZoom));

  // focusScreenX を指定すると、そのスクリーン座標が指す実座標を保ったままズームする
  if (focusScreenX !== null) {
    const oldScale = getCurrentScale();
    const realX = cameraX + (focusScreenX - width / 2) / oldScale;
    zoom = newZoom;
    const newScale = getCurrentScale();
    cameraX = realX - (focusScreenX - width / 2) / newScale;
  } else {
    zoom = newZoom;
  }

  const sliderVal = (Math.log10(zoom) / ZOOM_EXPONENT_MAX) * 100;
  zoomSlider.value = Math.max(0, Math.min(100, sliderVal));
  zoomLabel.innerText = Math.round(zoom).toLocaleString("ja-JP");

  updateCameraPosition(cameraX, true);
}

// スライダーをドラッグした時の処理
posSlider.addEventListener("input", () => {
  const rawValue = sliderValueToDistance(parseFloat(posSlider.value));
  updateCameraPosition(rawValue, false);
  hideHint();
});

// ズームスライダーを動かした時の処理
zoomSlider.addEventListener("input", () => {
  const val = parseFloat(zoomSlider.value);
  zoom = Math.pow(10, (val / 100) * ZOOM_EXPONENT_MAX);
  zoomLabel.innerText = Math.round(zoom).toLocaleString("ja-JP");

  // ズーム中も吸い付き判定を再計算する（ズームで範囲が変わるため）
  updateCameraPosition(cameraX, false);
  hideHint();
});

rayToggle.addEventListener("change", () => {
  showRays = rayToggle.checked;
  draw();
});

// 天体を描画する関数（縮尺に関わらず、常に星の名前を表示する）
function drawPlanet(planet, currentScale, labelRow) {
  const screenX = (planet.distance - cameraX) * currentScale + width / 2;
  const screenY = height / 2;
  const screenRadius = planet.radius * currentScale;

  // 画面外なら描画しない（ラベル分の余白も考慮して少し広めに判定）
  if (screenX + screenRadius < -40 || screenX - screenRadius > width + 40)
    return;

  const dotRadius = Math.max(screenRadius, 2.5);

  ctx.beginPath();
  ctx.arc(screenX, screenY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = planet.color;
  ctx.fill();

  // 名前ラベル：星が小さくて見失われないよう、大きさに関係なく常に表示する
  const labelY = screenY - dotRadius - 10 - (labelRow ? 14 : 0);
  ctx.font = "bold 13px 'M PLUS Rounded 1c', sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(2, 6, 23, 0.85)";
  ctx.strokeText(planet.name, screenX, labelY);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(planet.name, screenX, labelY);
}

// 距離メーター（物差し）を描画。画面幅を代表するキリの良い数値を自動選出する。
function drawScaleBar(currentScale) {
  const targetPx = 110;
  const rawValue = targetPx / currentScale;
  if (!isFinite(rawValue) || rawValue <= 0) return;

  const exponent = Math.floor(Math.log10(rawValue));
  const base = rawValue / Math.pow(10, exponent);
  let niceBase;
  if (base < 1.5) niceBase = 1;
  else if (base < 3.5) niceBase = 2;
  else if (base < 7.5) niceBase = 5;
  else niceBase = 10;
  const niceValue = niceBase * Math.pow(10, exponent);
  const barPx = niceValue * currentScale;

  const x0 = 20;
  const y0 = height - 24;

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + barPx, y0);
  ctx.moveTo(x0, y0 - 6);
  ctx.lineTo(x0, y0 + 6);
  ctx.moveTo(x0 + barPx, y0 - 6);
  ctx.lineTo(x0 + barPx, y0 + 6);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 12px 'M PLUS Rounded 1c', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(formatDistance(niceValue), x0, y0 - 12);
}

function drawStars() {
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fill();
  }
}

// メイン描画ループ
function draw() {
  if (!width || !height) return;

  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);
  drawStars();

  const currentScale = getCurrentScale();

  const earthDist = DATA.earth.distance;
  const earthRad = DATA.earth.radius;
  const angle = Math.atan2(earthRad, earthDist);

  const sunScreenX = (DATA.sun.distance - cameraX) * currentScale + width / 2;
  const screenY = height / 2;

  if (showRays) {
    const rayLength = POS_MAX * 1.1; // 冥王星の先（約66億km）まで光線を伸ばす
    ctx.beginPath();
    ctx.moveTo(sunScreenX, screenY);
    ctx.lineTo(
      sunScreenX + Math.cos(angle) * rayLength * currentScale,
      screenY - Math.sin(angle) * rayLength * currentScale,
    );
    ctx.moveTo(sunScreenX, screenY);
    ctx.lineTo(
      sunScreenX + Math.cos(-angle) * rayLength * currentScale,
      screenY - Math.sin(-angle) * rayLength * currentScale,
    );

    ctx.strokeStyle = "rgba(253, 224, 71, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 豆知識キャプション（画面上部中央、固定表示）
    ctx.fillStyle = "rgba(253, 224, 71, 0.85)";
    ctx.font = "bold 12px 'M PLUS Rounded 1c', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "豆知識：太陽はとても遠いので、地球に届く光はほぼ平行だとみなせます",
      width / 2,
      28,
    );
  }

  // 全天体を描画（labelRowを交互にしてラベルの重なりを軽減）
  const bodies = Object.keys(DATA);
  bodies.forEach((key, i) => {
    drawPlanet(DATA[key], currentScale, i % 2 === 1);
  });

  drawScaleBar(currentScale);

  // 情報パネルの更新
  zoomLabel.innerText = Math.round(zoom).toLocaleString("ja-JP");
  viewWidthLabel.innerText = formatDistance(width / currentScale);
  cameraDistLabel.innerText = formatDistance(cameraX);
}

// 画面移動ボタン
function moveCamera(direction) {
  const currentScale = getCurrentScale();
  let moveAmount = (width * 0.15) / currentScale; // 画面幅の15%分を移動

  // 星に吸い付いている時にボタンを押したら、吸力（閾値）を振り切って脱出できるようにする
  const threshold = 500 / Math.max(1, Math.sqrt(zoom));
  if (moveAmount <= threshold) {
    moveAmount = threshold * 1.2;
  }

  let rawValue = cameraX + direction * moveAmount;
  rawValue = Math.max(0, Math.min(POS_MAX, rawValue));

  updateCameraPosition(rawValue, true);
}

const btnScaleZoomIn = document.getElementById("btnScaleZoomIn");
const btnScaleZoomOut = document.getElementById("btnScaleZoomOut");
const btnScaleMoveLeft = document.getElementById("btnScaleMoveLeft");
const btnScaleMoveRight = document.getElementById("btnScaleMoveRight");
const btnScaleReset = document.getElementById("btnScaleReset");

btnScaleZoomIn.addEventListener("click", () => {
  zoomSlider.value = Math.min(100, parseFloat(zoomSlider.value) + 5);
  zoomSlider.dispatchEvent(new Event("input"));
});
btnScaleZoomOut.addEventListener("click", () => {
  zoomSlider.value = Math.max(0, parseFloat(zoomSlider.value) - 5);
  zoomSlider.dispatchEvent(new Event("input"));
});
btnScaleMoveLeft.addEventListener("click", () => {
  moveCamera(-1);
  hideHint();
});
btnScaleMoveRight.addEventListener("click", () => {
  moveCamera(1);
  hideHint();
});
btnScaleReset.addEventListener("click", () => {
  zoomSlider.value = 0;
  zoom = 1;
  updateCameraPosition(300000, true); // カメラの中心を全体の真ん中に設定
  zoomLabel.innerText = "1";
});

// ------------------------------------------------------------------
// マウス／タッチ操作：ドラッグでパン、ホイール／ピンチでズーム
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// マウス／タッチ操作：ドラッグでパン、ホイール／ピンチでズーム、星タップでジャンプ
// ------------------------------------------------------------------
let isDragging = false;
let dragStartScreenX = 0;
let dragStartCameraX = 0;
let pointerDownPos = { x: 0, y: 0 }; // タップとドラッグを区別するための記録
const activePointers = new Map();
let pinchStartDist = null;
let pinchStartZoom = null;

// クリックされた位置に星や星の名前があるかを判定する関数
function findClickedPlanet(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const clickX = clientX - rect.left;
  const clickY = clientY - rect.top;
  const currentScale = getCurrentScale();
  const bodies = Object.keys(DATA);

  for (let i = 0; i < bodies.length; i++) {
    const key = bodies[i];
    const planet = DATA[key];
    const screenX = (planet.distance - cameraX) * currentScale + width / 2;
    const screenY = height / 2;
    const screenRadius = planet.radius * currentScale;
    const dotRadius = Math.max(screenRadius, 2.5);

    // 星本体の判定（タップしやすいように最低半径18pxを確保）
    const distToStar = Math.hypot(clickX - screenX, clickY - screenY);
    if (distToStar <= Math.max(dotRadius + 8, 18)) {
      return planet;
    }

    // 名前ラベルの判定
    const labelRow = i % 2 === 1;
    const labelY = screenY - dotRadius - 10 - (labelRow ? 14 : 0);
    const labelHalfWidth = (planet.name.length * 13) / 2 + 8;
    if (
      Math.abs(clickX - screenX) <= labelHalfWidth &&
      clickY >= labelY - 16 &&
      clickY <= labelY + 8
    ) {
      return planet;
    }
  }
  return null;
}

// マウスが星の上に乗った時にカーソルを「指マーク（pointer）」に変える
canvas.addEventListener("mousemove", (e) => {
  if (isDragging) return;
  const hitPlanet = findClickedPlanet(e.clientX, e.clientY);
  canvas.style.cursor = hitPlanet ? "pointer" : "grab";
});

function getPointerDistance() {
  const pts = Array.from(activePointers.values());
  if (pts.length < 2) return null;
  const dx = pts[0].x - pts[1].x;
  const dy = pts[0].y - pts[1].y;
  return Math.sqrt(dx * dx + dy * dy);
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  pointerDownPos = { x: e.clientX, y: e.clientY };

  if (activePointers.size === 1) {
    isDragging = true;
    dragStartScreenX = e.clientX;
    dragStartCameraX = cameraX;
  } else if (activePointers.size === 2) {
    isDragging = false;
    pinchStartDist = getPointerDistance();
    pinchStartZoom = zoom;
  }
  hideHint();
});

canvas.addEventListener("pointermove", (e) => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activePointers.size === 2) {
    const dist = getPointerDistance();
    if (dist && pinchStartDist) {
      const scaleFactor = dist / pinchStartDist;
      setZoom(pinchStartZoom * scaleFactor);
    }
    return;
  }

  if (isDragging && activePointers.size === 1) {
    const currentScale = getCurrentScale();
    const dx = e.clientX - dragStartScreenX;
    const rawValue = dragStartCameraX - dx / currentScale;
    updateCameraPosition(rawValue, true);
  }
});

function endPointer(e) {
  // 指を離した時、移動量が小さければ「タップ/クリック」とみなして星へジャンプ
  const moveDist = Math.hypot(
    e.clientX - pointerDownPos.x,
    e.clientY - pointerDownPos.y,
  );
  if (moveDist < 6 && isDragging) {
    const hitPlanet = findClickedPlanet(e.clientX, e.clientY);
    if (hitPlanet) {
      updateCameraPosition(hitPlanet.distance, true);
      hideHint();
    }
  }

  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) {
    pinchStartDist = null;
  }
  if (activePointers.size === 0) {
    isDragging = false;
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", endPointer);

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const focusScreenX = e.clientX - rect.left;
    const factor = Math.pow(1.0015, -e.deltaY);
    setZoom(zoom * factor, focusScreenX);
    hideHint();
  },
  { passive: false },
);

// ------------------------------------------------------------------
// 初回ヒントオーバーレイ
// ------------------------------------------------------------------
const hintOverlay = document.getElementById("hintOverlay");
const hintCloseBtn = document.getElementById("hintCloseBtn");
const btnHintReopen = document.getElementById("btnHintReopen");

function hideHint() {
  hintOverlay.style.display = "none";
}
hintCloseBtn.addEventListener("click", hideHint);
btnHintReopen.addEventListener("click", () => {
  hintOverlay.style.display = "flex";
});

// 最初の描画を実行
resize();
updateCameraPosition(300000, true); // 起動時もカメラの中心を全体の真ん中に設定
