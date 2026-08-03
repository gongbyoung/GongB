/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 18.0 - Multi-Pass Noise Density & Export Ratio]
 * - 내부 노이즈 4중 중첩(Multi-Octave Density Sub-Veils): 색상 및 먹빛 농담 대폭 상향
 * - 16:9, 9:16 Export 비율 및 +10% 오버스캔 마진 자동 대응
 * - 관제탑 커스텀 색상(Gas1, Gas2, Star) 연동을 통한 풍부한 다채색 레이어링
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 18.0 (Multi-Pass & Ratio)";
    this.inkStreams = [];
    this.loadedSeed = -1;
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // =========================================================================
  // 🧩 3D Perlin / FBM 공간 노이즈 연산기
  // =========================================================================
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }

  grad3D(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3D(x, y, z) {
    const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    const perm = new Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const A  = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B  = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;

    return this.lerp(w,
      this.lerp(v,
        this.lerp(u, this.grad3D(perm[AA], xf, yf, zf), this.grad3D(perm[BA], xf - 1, yf, zf)),
        this.lerp(u, this.grad3D(perm[AB], xf, yf - 1, zf), this.grad3D(perm[BB], xf - 1, yf - 1, zf))
      ),
      this.lerp(v,
        this.lerp(u, this.grad3D(perm[AA + 1], xf, yf, zf - 1), this.grad3D(perm[BA + 1], xf - 1, yf, zf - 1)),
        this.lerp(u, this.grad3D(perm[AB + 1], xf, yf - 1, zf - 1), this.grad3D(perm[BB + 1], xf - 1, yf - 1, zf - 1))
      )
    );
  }

  fbm3D(x, y, z) {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 0.5;
    let maxValue = 0;
    for (let i = 0; i < 3; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return total / maxValue;
  }

  hexToRgb(hex) {
    if (!hex) return "30, 36, 48";
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  // =========================================================================
  // 🎲 캔버스 및 오버스캔 영역 스트림 구조 생성
  // =========================================================================
  generateInkStreams(seed, W, H) {
    this.inkStreams = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const count = 9;
    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);

      this.inkStreams.push({
        anchorX: (-0.1 + r1 * 1.2) * W,
        anchorY: (-0.1 + r2 * 1.2) * H,
        z: (r3 - 0.5) * 380,
        spanX: (W * 0.45) + r3 * (W * 0.65),
        spanY: (H * 0.38) + r1 * (H * 0.58),
        rotZ: r2 * Math.PI * 2,
        seedOffset: seed + i * 43.7
      });
    }
  }

  // =========================================================================
  // 🖌️ 내부 노이즈 4중 중첩 렌더링 (Density & Depth Fill)
  // =========================================================================
  drawUnboundInkStream(ctx, stream, time, scatterMotion, baseColorRgb, edgeRgb, vocalVol, drumVol, bassVol, otherVol, isDark, W, H) {
    ctx.save();

    const motionFactor = scatterMotion;

    // 3D Curl Noise 유동
    const driftX = this.fbm3D(stream.seedOffset, time * 0.05, 0) * motionFactor * 18;
    const driftY = this.fbm3D(stream.seedOffset + 10, time * 0.05, 5) * motionFactor * 18;
    const driftZ = this.fbm3D(stream.seedOffset + 20, time * 0.05, 10) * motionFactor * 12;

    // 🥁 드럼 충격
    const drumShakeX = (Math.sin(time * 45 + stream.seedOffset) * 0.5) * (drumVol * 12.0);
    const drumShakeY = (Math.cos(time * 40 + stream.seedOffset) * 0.5) * (drumVol * 12.0);

    // 🎸 베이스 유체 추진
    const finalX = stream.anchorX + driftX + drumShakeX + Math.sin(time * 0.08 + stream.seedOffset) * (bassVol * 100);
    const finalY = stream.anchorY + driftY + drumShakeY + Math.cos(time * 0.09 + stream.seedOffset) * (bassVol * 100);
    const finalZ = stream.z + driftZ;

    const perspective = 1000 / (1000 + finalZ);
    ctx.translate(finalX, finalY);

    // 🎹 기타 회전 소용돌이
    const swirlAngle = stream.rotZ + (time * 0.03) + (otherVol * Math.PI * 0.35);
    ctx.rotate(swirlAngle);
    ctx.scale(perspective, perspective);

    // 🎤 보컬 호흡 확장
    const vocalExpand = 1.0 + (vocalVol * 1.0);
    const baseSpanX = stream.spanX * vocalExpand;
    const baseSpanY = stream.spanY * vocalExpand;

    ctx.filter = 'none';

    // 💡 [핵심]: 내부 색상 노이즈 4중 중첩 (Outer ~ Inner 4-Layer Sub-Veil Density)
    const layerScales = [1.0, 0.75, 0.50, 0.25];
    const nodeCount = 120;

    layerScales.forEach((scaleFactor, layerIdx) => {
      const spanX = baseSpanX * scaleFactor;
      const spanY = baseSpanY * scaleFactor;
      const points = [];

      for (let i = 0; i < nodeCount; i++) {
        const a = (i / nodeCount) * Math.PI * 2;

        const nx = Math.cos(a) * (0.8 + layerIdx * 0.2) + stream.seedOffset;
        const ny = Math.sin(a) * (0.8 + layerIdx * 0.2) + stream.seedOffset;
        const nz = time * 0.05 * (motionFactor * 0.1) + layerIdx * 0.5;

        const nVal3D = this.fbm3D(nx, ny, nz);
        const distortStrength = 0.35 + (motionFactor / 50.0) * 0.65;

        const px = Math.cos(a) * spanX * (0.6 + nVal3D * distortStrength);
        const py = Math.sin(a) * spanY * (0.6 + nVal3D * distortStrength);

        points.push({ x: px, y: py });
      }

      ctx.beginPath();
      ctx.moveTo((points[0].x + points[nodeCount - 1].x) / 2, (points[0].y + points[nodeCount - 1].y) / 2);
      for (let i = 0; i < nodeCount; i++) {
        const curr = points[i];
        const next = points[(i + 1) % nodeCount];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      ctx.closePath();

      // 내부로 갈수록 농도가 진해지는 노이즈 레이어링
      const layerAlpha = isDark
        ? (0.12 + (layerIdx * 0.08) + bassVol * 0.1)
        : (0.08 + (layerIdx * 0.07) + bassVol * 0.08);

      ctx.fillStyle = `rgba(${baseColorRgb}, ${layerAlpha})`;
      ctx.fill();

      // 가장 외곽 레이어(layerIdx === 0)에만 은은한 마름 테두리 적용
      if (layerIdx === 0) {
        const strokeAlpha = isDark ? (0.35 + drumVol * 0.3) : (0.25 + drumVol * 0.2);
        ctx.strokeStyle = `rgba(${edgeRgb}, ${strokeAlpha})`;
        ctx.lineWidth = 1.0 + drumVol * 1.5;
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    this.time += 0.006;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 관제탑 설정값 읽기
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    
    // Range (Scatter) 0.1 ~ 50.0 매핑
    const rawScatter = globalSettings.scatterExponent !== undefined ? globalSettings.scatterExponent * 10 : 25;
    const scatterMotion = Math.max(0.1, Math.min(50.0, rawScatter));

    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkStreams(seedVal, W, H);
    }

    // 4-Stem 음압
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

    // 💡 [Export 비율 대응]: 10% 오버스캔 마진 설정
    const marginX = W * 0.10;
    const marginY = H * 0.10;

    this.ctx.beginPath();
    this.ctx.rect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);
    this.ctx.clip();

    // 🎨 4가지 스타일 & 관제탑 커스텀 피커(Gas1, Gas2, Star) 색상 지정
    let bgColor = "#f4f1ea";
    let isDark = false;
    
    // 관제탑 커스텀 피커 수치
    const customColors = globalSettings.customColors || {};
    const customGas1 = this.hexToRgb(customColors.gas1);
    const customGas2 = this.hexToRgb(customColors.gas2);
    const customStar = this.hexToRgb(customColors.star);

    let getColors = (idx) => ({ base: "25, 30, 42", edge: "8, 10, 15" });

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea"; // 한지 바탕색
      isDark = false;
      getColors = (idx) => ({
        base: idx % 3 === 0 ? "20, 26, 38" : idx % 3 === 1 ? "42, 50, 68" : "60, 48, 40",
        edge: "5, 8, 12"
      });
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelBases = [customGas1, customGas2, customStar, "180, 140, 200"];
      getColors = (idx) => ({
        base: pastelBases[idx % pastelBases.length],
        edge: "80, 70, 90"
      });
    } else if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      const neonBases = [customGas1, customGas2, customStar, "180, 100, 255"];
      getColors = (idx) => ({
        base: neonBases[idx % neonBases.length],
        edge: "220, 240, 255"
      });
    } else {
      bgColor = "#fdfbf7";
      isDark = false;
      const fullBases = ["210, 35, 75", "15, 120, 180", "215, 145, 15", "95, 45, 160", "30, 110, 90"];
      getColors = (idx) => ({
        base: fullBases[idx % fullBases.length],
        edge: "10, 20, 35"
      });
    }

    // 캔버스 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);

    // 합성 모드 (한지 multiply, 네온 screen)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 수묵 유체 스트림 렌더링
    this.inkStreams.forEach((stream, idx) => {
      const colors = getColors(idx);
      this.drawUnboundInkStream(
        this.ctx,
        stream,
        this.time * 0.8,
        scatterMotion,
        colors.base,
        colors.edge,
        vocalsVol,
        drumsVol,
        bassVol,
        otherVol,
        isDark,
        W,
        H
      );
    });

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `9 Streams (4-Layer Density Noise)`,
      isCovering: true,
      activeFunction: `FluidInkWash[MultiNoiseRatio_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkStreams = [];
  }
}
