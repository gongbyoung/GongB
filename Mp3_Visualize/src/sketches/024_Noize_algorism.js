/**
 * src/sketches/023_poem_mask_packer.js
 * - [023호 노이즈 쉐이프 엔진]
 * - 글자 완전 제거 ➔ 5종 기본 도형(선, 세모, 네모, 점, 동그라미) 30개 탑재
 * - 8종 노이즈 필드 + 4-Stem 오디오 비트 연동형
 */

export default class PoemMaskPackerSketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    
    this.time = 0;
    this.version = "023호 노이즈 쉐이프 엔진 (30 Shapes)";

    // 30개 기본 도형 객체 배열
    this.shapes = [];
    this.loadedSeed = -1;

    // 8종 노이즈 알고리즘 도감
    this.noiseCatalog = [
      {
        id: "PERLIN",
        name: "1. Perlin Noise (펄린 노이즈)",
        desc: "연속 그라디언트 노이즈. 30개 도형이 해수면이나 바람 흐름처럼 완만하고 유기적으로 일렁입니다."
      },
      {
        id: "SIMPLEX",
        name: "2. Simplex Noise (심플렉스 노이즈)",
        desc: "고속 단면체 격자 노이즈. 아티팩트 없이 고르고 날카로운 공간 변형을 도형에 제공합니다."
      },
      {
        id: "WORLEY",
        name: "3. Worley / Cellular (보로노이 노이즈)",
        desc: "세포점 거리 기반 노이즈. 기하학적 결정체나 수중 빛처럼 도형들이 특정 거점을 중심으로 집결합니다."
      },
      {
        id: "FBM",
        name: "4. FBM (Fractional Brownian Motion)",
        desc: "다층 옥타브 중첩 노이즈. 복잡하고 역동적인 거친 난기류 파동을 도형들에게 부여합니다."
      },
      {
        id: "VALUE",
        name: "5. Value Noise (밸류 노이즈)",
        desc: "격자점 보간 노이즈. 디지털 그리드 감성의 레트로 픽셀 단계별 위치 왜곡을 만듭니다."
      },
      {
        id: "CURL",
        name: "6. Curl Noise (컬 유체 노이즈)",
        desc: "회전자 Vector Curl 기반의 유체 와류. 도형들이 소용돌이치는 물결을 따라 빙글빙글 회전합니다."
      },
      {
        id: "DOMAIN_WARP",
        name: "7. Domain Warping (도메인 워핑)",
        desc: "노이즈 입력을 재귀 중첩. 플라스마 마블 지형처럼 도형들이 대각선 위상으로 길게 일렁입니다."
      },
      {
        id: "HARMONIC",
        name: "8. Harmonic Sine (조화 고주파 노이즈)",
        desc: "삼각함수 하모닉 중첩파. 음향 스펙트럼과 유사한 정밀 사이클 진동으로 도형을 구동합니다."
      }
    ];

    this.init();
  }

  init() {
    if (!this.canvas || !this.canvas.parentNode) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      if (this.container) {
        this.container.appendChild(this.canvas);
      }
    }
    this.resize();
  }

  resize(w, h) {
    if (!this.container && !w) return;
    this.width = w || this.container.clientWidth || 800;
    this.height = h || this.container.clientHeight || 600;
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
  }

  // =========================================================================
  // 🎲 30개 기본 도형(선, 세모, 네모, 점, 동그라미) 시드 기반 배치 생성
  // =========================================================================
  generate30Shapes(seed, W, H) {
    this.shapes = [];
    let pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const types = ['LINE', 'TRIANGLE', 'SQUARE', 'DOT', 'CIRCLE'];
    const totalCount = 30;

    for (let i = 0; i < totalCount; i++) {
      let r1 = pseudoRand(seed + i * 1.1);
      let r2 = pseudoRand(seed + i * 2.3);
      let r3 = pseudoRand(seed + i * 3.7);
      let r4 = pseudoRand(seed + i * 4.9);

      this.shapes.push({
        id: i,
        type: types[i % types.length], // 5가지 종류가 균등하게 6개씩 배치
        baseX: (0.15 + r1 * 0.7) * W,
        baseY: (0.15 + r2 * 0.7) * H,
        baseSize: 20 + r3 * 40,
        baseAngle: r4 * Math.PI * 2,
        hueOffset: Math.floor(r1 * 360)
      });
    }
  }

  // =========================================================================
  // 🧩 8종 순수 수학 노이즈 연산 엔진
  // =========================================================================
  pseudoRandom(x, y) {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return n - Math.floor(n);
  }

  valueNoise(x, y) {
    let ix = Math.floor(x); let iy = Math.floor(y);
    let fx = x - ix; let fy = y - iy;
    let ux = fx * fx * (3.0 - 2.0 * fx);
    let uy = fy * fy * (3.0 - 2.0 * fy);

    let a = this.pseudoRandom(ix, iy);
    let b = this.pseudoRandom(ix + 1, iy);
    let c = this.pseudoRandom(ix, iy + 1);
    let d = this.pseudoRandom(ix + 1, iy + 1);

    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  perlinNoise(x, y) {
    return (this.valueNoise(x, y) + this.valueNoise(x * 2.1 + 1.3, y * 2.1 + 1.7) * 0.5) / 1.5;
  }

  simplexNoise(x, y) {
    let xin = x * 0.866; let yin = y * 0.866;
    let n1 = Math.sin(xin + Math.cos(yin * 1.4));
    let n2 = Math.cos(yin + Math.sin(xin * 1.4));
    return (n1 + n2) * 0.5 + 0.5;
  }

  worleyNoise(x, y) {
    let ix = Math.floor(x); let iy = Math.floor(y);
    let minDist = 1.0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let cx = ix + dx; let cy = iy + dy;
        let px = cx + this.pseudoRandom(cx, cy);
        let py = cy + this.pseudoRandom(cx + 100, cy + 100);
        let dist = Math.hypot(x - px, y - py);
        if (dist < minDist) minDist = dist;
      }
    }
    return Math.min(1.0, minDist);
  }

  fbmNoise(x, y) {
    let value = 0; let amplitude = 0.5; let frequency = 1.0;
    for (let i = 0; i < 4; i++) {
      value += amplitude * this.valueNoise(x * frequency, y * frequency);
      frequency *= 2.0; amplitude *= 0.5;
    }
    return value;
  }

  curlNoise(x, y) {
    let eps = 0.1;
    let n1 = this.perlinNoise(x, y + eps);
    let n2 = this.perlinNoise(x, y - eps);
    let n3 = this.perlinNoise(x + eps, y);
    let n4 = this.perlinNoise(x - eps, y);
    return { x: (n1 - n2) / (2 * eps), y: -(n3 - n4) / (2 * eps) };
  }

  domainWarpNoise(x, y) {
    let qx = this.fbmNoise(x, y);
    let qy = this.fbmNoise(x + 5.2, y + 1.3);
    return this.fbmNoise(x + 4.0 * qx, y + 4.0 * qy);
  }

  harmonicNoise(x, y) {
    let h1 = Math.sin(x * 3.0 + y * 2.0);
    let h2 = Math.sin(x * 7.0 - y * 5.0) * 0.5;
    let h3 = Math.cos(x * 12.0 + y * 11.0) * 0.25;
    return (h1 + h2 + h3) / 1.75 * 0.5 + 0.5;
  }

  sampleNoise(typeIdx, x, y, time) {
    switch (typeIdx) {
      case 0: return { dx: (this.perlinNoise(x + time, y) - 0.5) * 2, dy: (this.perlinNoise(x, y + time) - 0.5) * 2 };
      case 1: return { dx: (this.simplexNoise(x + time, y) - 0.5) * 2, dy: (this.simplexNoise(x, y + time) - 0.5) * 2 };
      case 2: return { dx: (this.worleyNoise(x + time, y) - 0.5) * 2, dy: (this.worleyNoise(x, y + time) - 0.5) * 2 };
      case 3: return { dx: (this.fbmNoise(x + time, y) - 0.5) * 2, dy: (this.fbmNoise(x, y + time) - 0.5) * 2 };
      case 4: return { dx: (this.valueNoise(x + time, y) - 0.5) * 2, dy: (this.valueNoise(x, y + time) - 0.5) * 2 };
      case 5: {
        let c = this.curlNoise(x + time * 0.5, y + time * 0.5);
        return { dx: c.x * 2.0, dy: c.y * 2.0 };
      }
      case 6: return { dx: (this.domainWarpNoise(x + time, y) - 0.5) * 2, dy: (this.domainWarpNoise(x, y + time) - 0.5) * 2 };
      case 7: return { dx: (this.harmonicNoise(x + time, y) - 0.5) * 2, dy: (this.harmonicNoise(x, y + time) - 0.5) * 2 };
      default: return { dx: 0, dy: 0 };
    }
  }

  // =========================================================================
  // 🖌️ 5가지 기본 도형 개별 렌더링 루틴
  // =========================================================================
  drawSingleShape(ctx, shape, x, y, size, angle, strokeW, colorHex) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.strokeStyle = colorHex;
    ctx.fillStyle = colorHex;
    ctx.lineWidth = strokeW;

    switch (shape.type) {
      case 'LINE': // 1. 선
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.stroke();
        break;

      case 'TRIANGLE': // 2. 세모
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.866, size * 0.5);
        ctx.lineTo(-size * 0.866, size * 0.5);
        ctx.closePath();
        ctx.stroke();
        break;

      case 'SQUARE': // 3. 네모
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        break;

      case 'DOT': // 4. 점 (채워진 작은 원)
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(3, size * 0.25), 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'CIRCLE': // 5. 동그라미 (테두리 원)
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) {
      this.init();
      if (!this.ctx) return;
    }

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    this.time += 0.012;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 관제탑 컨트롤 타워 수치 로드
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;                         // SHUFFLE
    const rangeVal = (globalSettings.scatterExponent ?? 2.2) * 0.005;  // RANGE (Noise Frequency)
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 120;   // SHATTER (Displacement Distance)
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;                // GAUGE (Stroke & Speed)
    const gainVal = globalSettings.audioGain ?? 1.0;

    // 시드나 화면 크기가 변경되면 30개 도형 배치 재생성
    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generate30Shapes(seedVal, W, H);
    }

    // SHUFFLE 슬라이더 수치로 8종 노이즈 선택
    const activeNoiseIndex = Math.abs(seedVal) % this.noiseCatalog.length;
    const currentNoiseInfo = this.noiseCatalog[activeNoiseIndex];

    // 4-Stem 오디오 수신
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

    // 배경 어둡게 잔상 클리어
    this.ctx.fillStyle = 'rgba(6, 8, 18, 0.35)';
    this.ctx.fillRect(0, 0, W, H);

    // 색상 팔레트
    const mainColor = globalSettings.customColors?.gas1 || '#00ffcc';
    const subColor = globalSettings.customColors?.gas2 || '#ff0055';

    // 💡 30개 도형 개별 노이즈 변형 렌더링
    this.shapes.forEach((s) => {
      // 노이즈 오프셋 연산
      const noiseVector = this.sampleNoise(
        activeNoiseIndex,
        s.baseX * rangeVal,
        s.baseY * rangeVal,
        this.time * (0.8 + gaugeVal * 1.5 + otherVol * 2.0)
      );

      // 위치 이동 (Shatter + 드럼/베이스 충격파)
      const currentShatter = shatterVal * (1.0 + drumsVol * 2.5);
      const renderX = s.baseX + noiseVector.dx * currentShatter;
      const renderY = s.baseY + noiseVector.dy * currentShatter;

      // 크기 및 회전 (보컬/베이스 연동)
      const renderSize = s.baseSize * (0.8 + vocalsVol * 1.8 + drumsVol * 0.8);
      const renderAngle = s.baseAngle + this.time * (1.0 + gaugeVal * 2.0) + (noiseVector.dx * 3.0);

      // 선 두께 및 글로우 발광
      const strokeW = Math.max(1.5, (2.0 + gaugeVal * 4.0 + bassVol * 6.0));
      
      this.ctx.shadowColor = (s.id % 2 === 0) ? mainColor : subColor;
      this.ctx.shadowBlur = 8 + bassVol * 30;

      const currentColor = (s.id % 2 === 0) ? mainColor : subColor;

      this.drawSingleShape(this.ctx, s, renderX, renderY, renderSize, renderAngle, strokeW, currentColor);
    });

    this.ctx.restore();

    // 💡 [LOG / HUD 진단 팝업]: 우측 상단 HUD에 현재 노이즈 정보 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `30 Shapes [Line, Tri, Sq, Dot, Circ]`,
      isCovering: true,
      activeFunction: `${currentNoiseInfo.name} | ${currentNoiseInfo.desc}`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.shapes = [];
  }
}
