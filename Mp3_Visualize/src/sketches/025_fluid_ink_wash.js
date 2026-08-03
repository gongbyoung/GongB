/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 9.0 - True Ink Bleed & Soft Diffusion]
 * - 각진 폴리곤 각짐 100% 소멸 ➔ 초고해상도 베지어 곡선(Quadratic Bezier) 적용
 * - shadowBlur 기반 실시간 먹물 번짐(Ink Bleed Edge) 이식
 * - 제자리 쿵쿵거림 해제 ➔ 유체 벡터 흐름 및 오디오 비트 번짐 축적
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 9.0 (True Bleed)";

    this.inkClouds = [];
    this.loadedSeed = -1;

    this.init();
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || this.container.clientWidth || 800;
    this.height = h || this.container.clientHeight || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // =========================================================================
  // 🧩 초고해상도 Smooth Quintic Perlin Noise (각짐 없는 순수 곡선연산)
  // =========================================================================
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10); // 5차 S-Curve 보간
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  smoothNoise2D(x, y) {
    const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    const perm = new Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }

  fbm(x, y) {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0;
    for (let i = 0; i < 4; i++) {
      total += this.smoothNoise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return total / maxValue;
  }

  // =========================================================================
  // 🎲 비대칭 수묵 구름 구조 생성 (Seed 기반)
  // =========================================================================
  generateInkClouds(seed, W, H) {
    this.inkClouds = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const count = 7;
    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);

      this.inkClouds.push({
        x: (0.15 + r1 * 0.7) * W,
        y: (0.2 + r2 * 0.6) * H,
        baseRx: (160 + r3 * 260) * (Math.min(W, H) / 1000),
        baseRy: (110 + r1 * 200) * (Math.min(W, H) / 1000),
        angle: r2 * Math.PI * 2,
        driftVx: (r1 - 0.5) * 0.8,
        driftVy: (r2 - 0.5) * 0.8,
        accumulatedExpansion: 0,
        seedOffset: seed + i * 41.2
      });
    }
  }

  // =========================================================================
  // 🖌️ 먹물 번짐(Ink Bleed & Soft Feathering) 곡선 렌더링
  // =========================================================================
  drawBleedingInkCloud(ctx, cloud, time, baseColorRgb, edgeRgb, vocalVol, drumVol, bassVol, shatterVal, isDark) {
    ctx.save();

    // 단순 제자리 크기 팽창 쿵쿵거림 해제 ➔ 비트에 맞춰 번짐 정도(Expansion) 축적
    cloud.accumulatedExpansion += (drumVol * 0.8 + vocalVol * 0.4);
    cloud.accumulatedExpansion *= 0.96; // 은은한 서서히 수축 복원

    // 유체 위치 흐름 (Drift)
    const driftX = Math.sin(time * 0.2 + cloud.seedOffset) * 40 + cloud.driftVx * time * 5;
    const driftY = Math.cos(time * 0.25 + cloud.seedOffset) * 40 + cloud.driftVy * time * 5;

    ctx.translate(cloud.x + driftX, cloud.y + driftY);
    ctx.rotate(cloud.angle + Math.sin(time * 0.1) * 0.15);

    const rx = Math.max(20, cloud.baseRx + cloud.accumulatedExpansion * 20);
    const ry = Math.max(20, cloud.baseRy + cloud.accumulatedExpansion * 15);

    const pointCount = 36; // 곡선 매김 점
    const points = [];

    for (let i = 0; i < pointCount; i++) {
      const a = (i / pointCount) * Math.PI * 2;
      const nx = Math.cos(a) * 1.5 + cloud.seedOffset;
      const ny = Math.sin(a) * 1.5 + time * 0.1;

      const nVal = this.fbm(nx, ny);
      const prx = rx * (0.7 + nVal * 0.6);
      const pry = ry * (0.7 + nVal * 0.6);

      points.push({
        x: Math.cos(a) * prx,
        y: Math.sin(a) * pry
      });
    }

    // 💡 [핵심]: 직선 대신 초고해상도 이차 베지어 곡선(quadraticCurveTo) 연결
    ctx.beginPath();
    ctx.moveTo((points[0].x + points[pointCount - 1].x) / 2, (points[0].y + points[pointCount - 1].y) / 2);

    for (let i = 0; i < pointCount; i++) {
      const curr = points[i];
      const next = points[(i + 1) % pointCount];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
    }
    ctx.closePath();

    // 💡 [먹물 번짐 실시간 이식]: Canvas shadowBlur로 한지 스머징 연출
    const bleedGlow = 15 + bassVol * 30 + drumVol * 20;
    ctx.shadowColor = `rgba(${edgeRgb}, ${isDark ? 0.6 : 0.4})`;
    ctx.shadowBlur = bleedGlow;

    // 수묵 투명 면 채우기
    const fillAlpha = isDark ? (0.15 + bassVol * 0.2) : (0.09 + bassVol * 0.14);
    ctx.fillStyle = `rgba(${baseColorRgb}, ${fillAlpha})`;
    ctx.fill();

    // 테두리 미세 번짐 마름선
    const strokeAlpha = isDark ? (0.3 + drumVol * 0.4) : (0.2 + drumVol * 0.3);
    ctx.strokeStyle = `rgba(${edgeRgb}, ${strokeAlpha})`;
    ctx.lineWidth = 0.8 + drumVol * 1.0;
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    this.time += 0.008;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 관제탑 설정 수치
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 150;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 시드 변경 시 구름 구조 재생성
    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkClouds(seedVal, W, H);
    }

    // 4-Stem 음압 감도 수신
    let vocalsVol = 0, drumsVol = 0, bassVol = 0, otherVol = 0;
    if (targetAudio && targetAudio.isMultiStem) {
      vocalsVol = (targetAudio.vocalsVol || 0) * gainVal;
      drumsVol  = (targetAudio.drumsVol  || 0) * gainVal;
      bassVol   = (targetAudio.bassVol   || 0) * gainVal;
      otherVol  = (targetAudio.otherVol  || 0) * gainVal;
    } else {
      vocalsVol = (targetAudio.mid || 0) * 2.5 * gainVal;
      drumsVol  = (targetAudio.bass || 0) * 3.0 * gainVal;
      bassVol   = (targetAudio.bass || 0) * 2.5 * gainVal;
      otherVol  = (targetAudio.treble || 0) * 2.5 * gainVal;
    }

    this.ctx.save();

    // 🎨 4가지 스타일 색상 매핑
    let bgColor = "#f4f1ea";
    let isDark = false;
    let getColors = (idx) => ({ base: "25, 30, 42", edge: "10, 12, 18" });

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea"; // 한지 바탕
      isDark = false;
      getColors = (idx) => ({
        base: idx % 2 === 0 ? "20, 24, 34" : "45, 50, 62",
        edge: "8, 10, 15"
      });
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelBases = ["215, 140, 165", "130, 175, 210", "140, 195, 175", "200, 160, 215"];
      const pastelEdges = ["160, 80, 105", "70, 115, 160", "80, 135, 115", "140, 100, 155"];
      getColors = (idx) => ({
        base: pastelBases[idx % pastelBases.length],
        edge: pastelEdges[idx % pastelEdges.length]
      });
    } else if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      const neonBases = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      const neonEdges = ["180, 255, 255", "255, 150, 200", "200, 255, 180", "220, 180, 255"];
      getColors = (idx) => ({
        base: neonBases[idx % neonBases.length],
        edge: neonEdges[idx % neonEdges.length]
      });
    } else {
      bgColor = "#fdfbf7";
      isDark = false;
      const fullBases = ["210, 45, 85", "20, 135, 195", "225, 155, 25", "105, 55, 175"];
      const fullEdges = ["140, 15, 45", "10, 80, 135", "150, 95, 10", "65, 20, 115"];
      getColors = (idx) => ({
        base: fullBases[idx % fullBases.length],
        edge: fullEdges[idx % fullEdges.length]
      });
    }

    // 바탕 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 합성 모드 (한지 multiply, 네온 screen)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 수묵 구름 렌더링
    this.inkClouds.forEach((cloud, idx) => {
      const colors = getColors(idx);
      this.drawBleedingInkCloud(
        this.ctx,
        cloud,
        this.time * 0.8 + (otherVol * 0.5),
        colors.base,
        colors.edge,
        vocalsVol,
        drumsVol,
        bassVol,
        shatterVal,
        isDark
      );
    });

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `7 Bleeding Organic Clouds (No Polygons)`,
      isCovering: true,
      activeFunction: `FluidInkWash[TrueBleed_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkClouds = [];
  }
}
