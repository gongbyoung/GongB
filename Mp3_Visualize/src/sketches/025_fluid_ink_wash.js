/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 (Fluid Ink Wash)]
 * - 동양화 수묵 번짐 / 알코올 잉크(Alcohol Ink) 번짐 결 효과
 * - 4-Stem 오디오 독립 반응 + 흑백/올컬러/파스텔/네온 4가지 스타일 지원
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 1.0";

    // 잉크 번짐 덩어리(Blob) & 붓결(Filament) 데이터
    this.inkBlobs = [];
    this.silkThreads = [];
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
  // 🎲 수묵화 잉크 덩어리 및 붓결 사전 생성 (Seed 기반)
  // =========================================================================
  generateInkStructures(seed, W, H) {
    this.inkBlobs = [];
    this.silkThreads = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    // 1. 메인 잉크 번짐 덩어리 (10개)
    const blobCount = 10;
    for (let i = 0; i < blobCount; i++) {
      const r1 = pseudoRand(seed + i * 1.3);
      const r2 = pseudoRand(seed + i * 2.7);
      const r3 = pseudoRand(seed + i * 4.1);

      // 노이즈 오프셋 점들 (유기적인 변형 각도 12개)
      const pointOffsets = [];
      for (let p = 0; p < 12; p++) {
        pointOffsets.push(0.6 + pseudoRand(seed + i * 10 + p * 1.7) * 0.8);
      }

      this.inkBlobs.push({
        cx: (0.15 + r1 * 0.7) * W,
        cy: (0.2 + r2 * 0.6) * H,
        baseRadius: (120 + r3 * 220) * (Math.min(W, H) / 1000),
        pointOffsets: pointOffsets,
        rotationSpeed: (r1 - 0.5) * 0.005,
        hueShift: Math.floor(r1 * 360)
      });
    }

    // 2. 잉크 결을 가로지르는 섬세한 명주실/붓 터치 선 (18개)
    const threadCount = 18;
    for (let t = 0; t < threadCount; t++) {
      const r1 = pseudoRand(seed + t * 5.1);
      const r2 = pseudoRand(seed + t * 7.3);

      this.silkThreads.push({
        startY: (0.1 + r1 * 0.8) * H,
        amplitude: 30 + r2 * 80,
        frequency: 0.002 + r1 * 0.004,
        speed: 0.5 + r2 * 1.5,
        lineWidth: 0.8 + r1 * 2.5
      });
    }
  }

  // =========================================================================
  // 🖌️ 알코올 잉크/수묵 특유의 "테두리가 더 진하게 마르는 번짐(Bleed Edge)" 렌더링
  // =========================================================================
  drawInkBlob(ctx, cx, cy, radius, pointOffsets, time, darkAlpha, edgeColor, fillColor) {
    ctx.save();
    ctx.translate(cx, cy);

    const points = pointOffsets.length;
    const angleStep = (Math.PI * 2) / points;

    // 여러 겹의 투명 레이어로 알코올 잉크 입체감 연출 (3개 겹침)
    for (let layer = 3; layer >= 1; layer--) {
      const layerRadius = radius * (layer / 3);
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const idx = i % points;
        const angle = idx * angleStep;

        // 시간에 따른 유기적 노이즈 파동
        const wave = Math.sin(time * 1.5 + idx * 0.8 + layer) * 0.15;
        const r = layerRadius * (pointOffsets[idx] + wave);

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else {
          // 커브 곡선으로 부드럽게 잇기
          const prevAngle = (idx - 1) * angleStep;
          const prevR = layerRadius * (pointOffsets[(idx - 1 + points) % points] + wave);
          const cx1 = Math.cos(prevAngle + angleStep * 0.5) * (prevR + r) * 0.5;
          const cy1 = Math.sin(prevAngle + angleStep * 0.5) * (prevR + r) * 0.5;
          ctx.quadraticCurveTo(cx1, cy1, x, y);
        }
      }
      ctx.closePath();

      // 내부 연한 채우기
      ctx.fillStyle = fillColor;
      ctx.fill();

      // 💡 핵심: 수묵화 번짐 테두리 (Edge Bleed Effect)
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.2 + (3 - layer) * 1.0;
      ctx.stroke();
    }

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    this.time += 0.01;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 관제탑 글로벌 설정 수치 독출
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const scatterVal = (globalSettings.scatterExponent ?? 2.2) * 0.1;
    const glowVal = globalSettings.glowIntensity ?? 0.85;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 시드나 화면 크기 바뀌면 잉크 구조재 생성
    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkStructures(seedVal, W, H);
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

    // =========================================================================
    // 🎨 4가지 스타일 테마 팔레트 정의
    // =========================================================================
    let bgColor = "#f4f1ea";       // 종이 바탕색
    let isDarkBg = false;
    let getBlobColors = (idx, alpha) => {};

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      // 1. 흑백 (수묵화 Ink Wash - 첨부 이미지 스타일)
      bgColor = "#f5f2eb";
      isDarkBg = false;
      getBlobColors = (idx, a) => {
        const darkGrad = Math.min(0.85, 0.15 + a * 0.7);
        return {
          fill: `rgba(20, 24, 30, ${a * 0.12})`,
          edge: `rgba(10, 12, 18, ${darkGrad * 0.6})`,
          thread: `rgba(15, 18, 25, ${0.15 + a * 0.3})`
        };
      };
    } else if (colorStyle === 'pastel') {
      // 2. 파스텔컬러 (Soft Watercolor)
      bgColor = "#f8f6f0";
      isDarkBg = false;
      const pastelHues = [340, 210, 160, 35, 270];
      getBlobColors = (idx, a) => {
        const h = pastelHues[idx % pastelHues.length];
        return {
          fill: `hsla(${h}, 65%, 75%, ${a * 0.18})`,
          edge: `hsla(${h}, 75%, 45%, ${a * 0.5})`,
          thread: `hsla(${h}, 60%, 55%, ${0.2 + a * 0.4})`
        };
      };
    } else if (colorStyle === 'neon') {
      // 3. 네온컬러 (Glowing Neon Ink)
      bgColor = "#05060f";
      isDarkBg = true;
      const neonHues = [180, 300, 120, 50, 330];
      getBlobColors = (idx, a) => {
        const h = neonHues[idx % neonHues.length];
        return {
          fill: `hsla(${h}, 100%, 50%, ${a * 0.15})`,
          edge: `hsla(${h}, 100%, 65%, ${0.4 + a * 0.5})`,
          thread: `hsla(${h}, 100%, 70%, ${0.3 + a * 0.5})`
        };
      };
    } else {
      // 4. 올컬러 (Vibrant Alcohol Ink)
      bgColor = "#fdfbf7";
      isDarkBg = false;
      getBlobColors = (idx, a) => {
        const h = (idx * 45 + this.time * 10) % 360;
        return {
          fill: `hsla(${h}, 85%, 55%, ${a * 0.16})`,
          edge: `hsla(${h}, 90%, 35%, ${a * 0.6})`,
          thread: `hsla(${h}, 80%, 40%, ${0.2 + a * 0.4})`
        };
      };
    }

    // 캔버스 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 네온 스타일일 때 믹스 블렌딩 처리
    if (isDarkBg) {
      this.ctx.globalCompositeOperation = 'screen';
    } else {
      this.ctx.globalCompositeOperation = 'multiply';
    }

    // 🎤 보컬 & 🥁 드럼 반응에 따른 잉크 팽창률
    const vocalPulse = vocalsVol * 1.8;
    const drumImpact = drumsVol * 1.2;

    // 1. 10개 메인 잉크 번짐 덩어리 렌더링
    this.inkBlobs.forEach((blob, idx) => {
      const currentRadius = blob.baseRadius * (1.0 + vocalPulse + (idx % 2 === 0 ? drumImpact : 0));
      const blobAlpha = Math.min(1.0, 0.4 + vocalPulse * 0.5 + bassVol * 0.3);

      const colors = getBlobColors(idx, blobAlpha);

      this.drawInkBlob(
        this.ctx,
        blob.cx,
        blob.cy,
        currentRadius,
        blob.pointOffsets,
        this.time * (0.8 + gaugeVal) + idx,
        blobAlpha,
        colors.edge,
        colors.fill
      );
    });

    // 2. 🎹 기타/반주 (Other) 소리에 맞춰 가로지르는 섬세한 붓결(Filament) 라인
    this.ctx.globalCompositeOperation = isDarkBg ? 'lighter' : 'source-over';
    
    this.silkThreads.forEach((thread, idx) => {
      const colors = getBlobColors(idx, 0.5 + otherVol * 0.5);
      this.ctx.strokeStyle = colors.thread;
      this.ctx.lineWidth = thread.lineWidth * (1.0 + otherVol * 2.0);

      this.ctx.beginPath();
      for (let x = 0; x <= W; x += 15) {
        const wave1 = Math.sin(x * thread.frequency + this.time * thread.speed + idx) * thread.amplitude;
        const wave2 = Math.cos(x * 0.005 + this.time * 2.0) * (otherVol * 60);
        const y = thread.startY + wave1 + wave2;

        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    });

    this.ctx.restore();

    // 💡 HUD 진단 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Ink Blobs: 10 Layered Pools`,
      isCovering: true,
      activeFunction: `FluidInkWash[${colorStyle.toUpperCase()}_Mode]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkBlobs = [];
    this.silkThreads = [];
  }
}
