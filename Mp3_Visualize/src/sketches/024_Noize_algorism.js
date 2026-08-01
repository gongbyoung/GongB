/**
 * src/sketches/023_poem_mask_packer.js
 * - 023호 시마스크 노이즈 필드 엔진
 * - Three.js / p5.js / GLSL 8종 노이즈 수식 내장
 * - Shuffle(Seed) 알고리즘 스위칭 & Range / Gauge / Shatter 수치 실시간 제어
 */

export default class PoemMaskPackerSketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    
    // 오프스크린 캔버스 (마스크 및 픽셀 판독용)
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');

    this.time = 0;
    this.version = "023호 시마스크 (Noise Field Multi-Engine)";

    // 8종 노이즈 알고리즘 정보 맵
    this.noiseCatalog = [
      {
        id: "PERLIN",
        name: "1. Perlin Noise (펄린 노이즈)",
        desc: "Ken Perlin이 개발한 연속 그라디언트 노이즈. 유기적인 해수면 및 완만한 구름/바람의 파동을 연출합니다."
      },
      {
        id: "SIMPLEX",
        name: "2. Simplex Noise (심플렉스 노이즈)",
        desc: "단면체 격자 기반의 고속 그라디언트. 격자 아티팩트가 적고 날카로우며 고른 공간 변형을 제공합니다."
      },
      {
        id: "WORLEY",
        name: "3. Worley / Cellular (워리 보로노이)",
        desc: "특징점 간 최단 거리 기반 세포 구조. 기하학적 결정체, 세포막, 수중 빛 굴절 효과를 연출합니다."
      },
      {
        id: "FBM",
        name: "4. FBM (Fractional Brownian Motion)",
        desc: "여러 옥타브(주파수 층)를 중첩한 옥타브 레이어드 노이즈. 복잡하고 울퉁불퉁한 산맥 및 연기 질감을 표현합니다."
      },
      {
        id: "VALUE",
        name: "5. Value Noise (밸류 노이즈)",
        desc: "격자점의 랜덤 난수를 보간하는 알고리즘. 디지털 그리드 감성의 레트로 픽셀 왜곡 파동을 만듭니다."
      },
      {
        id: "CURL",
        name: "6. Curl Noise (컬 유체 노이즈)",
        desc: "노이즈 장의 회전자(Vector Curl)를 연산한 발산 제어 와류. 유체 시뮬레이션 같은 渦流(와류) 소용돌이를 만듭니다."
      },
      {
        id: "DOMAIN_WARP",
        name: "7. Domain Warping (도메인 워핑)",
        desc: "노이즈의 좌표 입력값에 또 다른 노이즈를 재귀 중첩. 대리석 마블 패턴 및 플라스마 지형 왜곡을 만듭니다."
      },
      {
        id: "HARMONIC",
        name: "8. Harmonic Sine Superposition (조화 파동)",
        desc: "삼각함수 하모닉 주파수 중첩파. 신디사이저 음향 스펙트럼과 유사한 정밀 사이클 진동 파동을 연출합니다."
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
  // 🧩 8종 순수 수학 노이즈 함수 엔진
  // =========================================================================
  pseudoRandom(x, y) {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return n - Math.floor(n);
  }

  // 1. Value Noise
  valueNoise(x, y) {
    let ix = Math.floor(x);
    let iy = Math.floor(y);
    let fx = x - ix;
    let fy = y - iy;

    let ux = fx * fx * (3.0 - 2.0 * fx);
    let uy = fy * fy * (3.0 - 2.0 * fy);

    let a = this.pseudoRandom(ix, iy);
    let b = this.pseudoRandom(ix + 1, iy);
    let c = this.pseudoRandom(ix, iy + 1);
    let d = this.pseudoRandom(ix + 1, iy + 1);

    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  // 2. Perlin Noise
  perlinNoise(x, y) {
    return (this.valueNoise(x, y) + this.valueNoise(x * 2.1 + 1.3, y * 2.1 + 1.7) * 0.5) / 1.5;
  }

  // 3. Simplex Noise (Approximated 2D)
  simplexNoise(x, y) {
    let xin = x * 0.866;
    let yin = y * 0.866;
    let n1 = Math.sin(xin + Math.cos(yin * 1.4));
    let n2 = Math.cos(yin + Math.sin(xin * 1.4));
    return (n1 + n2) * 0.5 + 0.5;
  }

  // 4. Worley / Cellular Noise
  worleyNoise(x, y) {
    let ix = Math.floor(x);
    let iy = Math.floor(y);
    let minDist = 1.0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let cx = ix + dx;
        let cy = iy + dy;
        let px = cx + this.pseudoRandom(cx, cy);
        let py = cy + this.pseudoRandom(cx + 100, cy + 100);
        let dist = Math.hypot(x - px, y - py);
        if (dist < minDist) minDist = dist;
      }
    }
    return Math.min(1.0, minDist);
  }

  // 5. FBM (Fractional Brownian Motion)
  fbmNoise(x, y) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < 4; i++) {
      value += amplitude * this.valueNoise(x * frequency, y * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  // 6. Curl Noise (2D Vector Output)
  curlNoise(x, y) {
    let eps = 0.1;
    let n1 = this.perlinNoise(x, y + eps);
    let n2 = this.perlinNoise(x, y - eps);
    let n3 = this.perlinNoise(x + eps, y);
    let n4 = this.perlinNoise(x - eps, y);

    let dx = (n1 - n2) / (2 * eps);
    let dy = (n3 - n4) / (2 * eps);
    return { x: dy, y: -dx }; // Rotated gradient field
  }

  // 7. Domain Warping
  domainWarpNoise(x, y) {
    let qx = this.fbmNoise(x, y);
    let qy = this.fbmNoise(x + 5.2, y + 1.3);
    return this.fbmNoise(x + 4.0 * qx, y + 4.0 * qy);
  }

  // 8. Harmonic Sine Superposition
  harmonicNoise(x, y) {
    let h1 = Math.sin(x * 3.0 + y * 2.0);
    let h2 = Math.sin(x * 7.0 - y * 5.0) * 0.5;
    let h3 = Math.cos(x * 12.0 + y * 11.0) * 0.25;
    return (h1 + h2 + h3) / 1.75 * 0.5 + 0.5;
  }

  // 💡 선택된 알고리즘 계산 통합 디스패처
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

    // 💡 관제탑 제어 수치 읽기 (SHUFFLE / RANGE / GAUGE / SHATTER)
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;                         // SHUFFLE
    const rangeVal = (globalSettings.scatterExponent ?? 2.2) * 0.05;   // RANGE (Noise Scale / Frequency)
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 50;    // SHATTER (Displacement Strength)
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;                // GAUGE (Noise Intensity / Line Height)
    const gainVal = globalSettings.audioGain ?? 1.0;
    const targetFontFamily = globalSettings.fontFamily || "'Black Han Sans'";

    // SHUFFLE 슬라이더 수치로 8종 노이즈 인덱스 산출
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

    // 배경 처리
    this.ctx.fillStyle = '#060812';
    this.ctx.fillRect(0, 0, W, H);

    // 마스크 글자 파싱
    const rawMaskTitle = (globalSettings.maskText || "슬픈 우상").trim();
    const rawPoemContent = (globalSettings.poemContent || "그대는 이 밤에 안식하시옵니까. 깊고 깊은 바다 속에 신비한 산호가 자라듯 그대 안에 보배로운 것들이 가득합니다.").trim();

    const titleWords = rawMaskTitle.split(' ');
    const line1Chars = (titleWords[0] || "슬픈").split('');
    const line2Chars = (titleWords.slice(1).join(' ') || "우상").split('');

    const mFontSize = Math.min(W, H) * 0.32 + (vocalsVol * 30);
    const lineGap = mFontSize * (0.8 + gaugeVal * 0.3);
    const startY = H / 2 - (lineGap / 2);

    const glyphs = [];
    if (line1Chars.length > 0) {
      const step1 = W / line1Chars.length;
      line1Chars.forEach((ch, idx) => { glyphs.push({ char: ch, cx: step1 * (idx + 0.5), cy: startY }); });
    }
    if (line2Chars.length > 0) {
      const step2 = W / line2Chars.length;
      line2Chars.forEach((ch, idx) => { glyphs.push({ char: ch, cx: step2 * (idx + 0.5), cy: startY + lineGap }); });
    }

    // 마스크 오프스크린 디코딩
    this.maskCanvas.width = W;
    this.maskCanvas.height = H;
    this.maskCtx.clearRect(0, 0, W, H);

    this.maskCtx.fillStyle = '#ffffff';
    this.maskCtx.font = `900 ${mFontSize}px ${targetFontFamily}, sans-serif`;
    this.maskCtx.textAlign = 'center';
    this.maskCtx.textBaseline = 'middle';
    this.maskCtx.lineWidth = Math.max(12, mFontSize * 0.1);
    this.maskCtx.strokeStyle = '#ffffff';

    glyphs.forEach(g => {
      this.maskCtx.strokeText(g.char, g.cx, g.cy);
      this.maskCtx.fillText(g.char, g.cx, g.cy);
    });

    const imgData = this.maskCtx.getImageData(0, 0, W, H);
    const pixels = imgData.data;

    const isInsideGlyph = (px, py) => {
      const x = Math.floor(px);
      const y = Math.floor(py);
      if (x < 0 || x >= W || y < 0 || y >= H) return false;
      return pixels[(y * W + x) * 4 + 3] > 128;
    };

    // 내부 시 구절 배치 연산
    const cleanPoem = rawPoemContent.replace(/\s+/g, ' ');
    const poemChars = cleanPoem.split('');

    const cFontSize = Math.min(W, H) * 0.016;
    const lineSpacing = cFontSize * (1.1 + gaugeVal * 0.3);

    this.ctx.fillStyle = globalSettings.customColors?.star || '#ffffff';
    this.ctx.font = `700 ${cFontSize}px 'Nanum Myeongjo', ${targetFontFamily}, serif`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    let charIdx = 0;
    let totalPlaced = 0;

    // 💡 [핵심]: 각 글자 위치마다 활성화된 노이즈 필드를 통한 좌표 왜곡(SHATTER/RANGE 적용)
    glyphs.forEach(g => {
      const bboxYMin = Math.max(0, Math.floor(g.cy - mFontSize * 0.6));
      const bboxYMax = Math.min(H - cFontSize, Math.floor(g.cy + mFontSize * 0.6));
      const bboxXMin = Math.max(0, Math.floor(g.cx - mFontSize * 0.6));
      const bboxXMax = Math.min(W - cFontSize, Math.floor(g.cx + mFontSize * 0.6));

      const stepX = Math.max(2, Math.floor(cFontSize * 0.25));

      for (let y = bboxYMin; y <= bboxYMax; y += lineSpacing) {
        let x = bboxXMin;
        while (x <= bboxXMax) {
          if (!isInsideGlyph(x, y + cFontSize * 0.5)) {
            x += stepX;
            continue;
          }

          const currentChar = poemChars[charIdx % poemChars.length];
          const charWidth = this.ctx.measureText(currentChar).width;

          // 💡 선택된 노이즈 장에 따른 오프셋 추출
          const noiseVector = this.sampleNoise(
            activeNoiseIndex,
            x * rangeVal,
            y * rangeVal,
            this.time * (1.0 + otherVol * 2.0)
          );

          // SHATTER(왜곡 세기) + 드럼/베이스 오디오 연동 변위
          const totalShatter = shatterVal * (1.0 + drumsVol * 2.0);
          const offsetX = noiseVector.dx * totalShatter;
          const offsetY = noiseVector.dy * totalShatter;

          this.ctx.fillText(currentChar, x + offsetX, y + offsetY);

          x += charWidth;
          charIdx++;
          totalPlaced++;
        }
      }
    });

    // 🎸 베이스/보컬 반응 외곽 테두리
    const effectiveGlow = bassVol + vocalsVol * 0.5;
    if (effectiveGlow > 0.05) {
      const strokeColor = globalSettings.customColors?.gas1 || '#00ffcc';
      this.ctx.shadowColor = strokeColor;
      this.ctx.shadowBlur = 10 + effectiveGlow * 35;
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 2 + effectiveGlow * 4;
      this.ctx.font = `900 ${mFontSize}px ${targetFontFamily}, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      glyphs.forEach(g => {
        this.ctx.strokeText(g.char, g.cx, g.cy);
      });
    }

    this.ctx.restore();

    // 💡 [LOG / HUD 진단 팝업 전달]: 우측 상단 HUD 콘솔에 선택된 노이즈 정보 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Noise: [${currentNoiseInfo.id}] / Placed: ${totalPlaced} Pcs`,
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
    this.maskCanvas = null;
    this.maskCtx = null;
  }
}
