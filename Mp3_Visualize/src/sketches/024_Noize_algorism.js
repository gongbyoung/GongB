/**
 * src/sketches/023_poem_mask_packer.js
 * - [023호 노이즈 아트 그래픽 엔진]
 * - 8개 노이즈별 흑(Black)·백(White)·컬러(Color) 맞춤형 배경 & 30개 도형 포스터 렌더링
 * - 5종 기본 도형 (선, 세모, 네모, 점, 동그라미) 30개 구동
 */

export default class PoemMaskPackerSketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    
    this.time = 0;
    this.version = "023호 노이즈 아트 그래픽 엔진";

    // 30개 기본 도형 데이터
    this.shapes = [];
    this.loadedSeed = -1;

    // 8종 노이즈 아트 도감 & 흑·백·컬러 테마 스타일
    this.noiseCatalog = [
      {
        id: "PERLIN",
        name: "1. Perlin Noise (딥 다크 & 사이언 파동)",
        desc: "딥 다크 배경 위 순백의 도형과 사이언/마젠타 빛이 해수면처럼 완만하게 일렁이는 스펙트럼 포스터입니다.",
        theme: {
          bgTop: "#05070f", bgBottom: "#0d1126",
          darkColor: "#020307", lightColor: "#ffffff", accentColor: "#00f0ff", subColor: "#ff0077"
        }
      },
      {
        id: "SIMPLEX",
        name: "2. Simplex Noise (모던 화이트 & 아방가르드)",
        desc: "화이트/라이트 모던 배경에 강렬한 먹색 도형과 레드/블루 어센트가 날카롭고 고르게 교차합니다.",
        theme: {
          bgTop: "#f4f5f8", bgBottom: "#e2e8f0",
          darkColor: "#0f172a", lightColor: "#ffffff", accentColor: "#ef4444", subColor: "#2563eb"
        }
      },
      {
        id: "WORLEY",
        name: "3. Worley / Cellular (칠흑의 세포 결정체)",
        desc: "칠흑 같은 무광 흑색 배경 위, 정밀한 백색 세공 선과 에메랄드 빛이 보로노이 거점으로 집결합니다.",
        theme: {
          bgTop: "#000000", bgBottom: "#050d0a",
          darkColor: "#000000", lightColor: "#ffffff", accentColor: "#10b981", subColor: "#06b6d4"
        }
      },
      {
        id: "FBM",
        name: "4. FBM Noise (챠콜 엠버 엠보싱)",
        desc: "챠콜 배경과 연기 질감의 백색 도형 위로 warm 엠버 골드 빛이 고차원 중첩 파동을 그립니다.",
        theme: {
          bgTop: "#121214", bgBottom: "#1f1e24",
          darkColor: "#09090b", lightColor: "#f8fafc", accentColor: "#f59e0b", subColor: "#f97316"
        }
      },
      {
        id: "VALUE",
        name: "5. Value Noise (모노크롬 픽셀 옐로우)",
        desc: "흑백 바둑판 모노크롬 격자 구도에 비비드 옐로우가 더해져 디지털 레트로 기하학 이미지를 연출합니다.",
        theme: {
          bgTop: "#080808", bgBottom: "#171717",
          darkColor: "#000000", lightColor: "#ffffff", accentColor: "#eab308", subColor: "#a3e635"
        }
      },
      {
        id: "CURL",
        name: "6. Curl Noise (딥 네이비 유체 소용돌이)",
        desc: "딥 네이비 밤하늘 배경 위, 유체 소용돌이를 따라 곡선과 도형들이 회전하며 흐릅니다.",
        theme: {
          bgTop: "#020617", bgBottom: "#0f172a",
          darkColor: "#020617", lightColor: "#e2e8f0", accentColor: "#8b5cf6", subColor: "#38bdf8"
        }
      },
      {
        id: "DOMAIN_WARP",
        name: "7. Domain Warping (캔버스 마블 핫핑크)",
        desc: "순백색 캔버스 위 검은 지형 마블 라인과 핫핑크/네온 그린 위상이 비선형으로 우아하게 마모됩니다.",
        theme: {
          bgTop: "#ffffff", bgBottom: "#f1f5f9",
          darkColor: "#020617", lightColor: "#ffffff", accentColor: "#ec4899", subColor: "#22c55e"
        }
      },
      {
        id: "HARMONIC",
        name: "8. Harmonic Sine (미드나잇 레이저 스펙트럼)",
        desc: "미드나잇 흑색 배경과 동심원 조화파 위로 라임/네온 핑크 레이저 라인이 삼각함수 파동을 그립니다.",
        theme: {
          bgTop: "#030712", bgBottom: "#090d16",
          darkColor: "#000000", lightColor: "#ffffff", accentColor: "#84cc16", subColor: "#f43f5e"
        }
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
  // 🎲 30개 기본 도형(선, 세모, 네모, 점, 동그라미) 생성
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
        type: types[i % types.length], // 5가지 도형 종류가 6개씩 30개 구성
        baseX: (0.12 + r1 * 0.76) * W,
        baseY: (0.12 + r2 * 0.76) * H,
        baseSize: 18 + r3 * 38,
        baseAngle: r4 * Math.PI * 2,
        colorCategory: i % 3 // 0: 흑(Black/Dark), 1: 백(White/Light), 2: 컬러(Accent)
      });
    }
  }

  // =========================================================================
  // 🧩 8종 노이즈 수학 엔진
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
  // 🖼️ 노이즈별 고유 배경 아트 그리드 & 그래픽 레이어 생성
  // =========================================================================
  drawNoiseBackgroundArt(ctx, W, H, theme, noiseIdx, time) {
    // 1. 메인 배경 그라데이션
    let bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. 노이즈별 고유 흑/백 배경 패턴 그리드
    ctx.save();
    ctx.lineWidth = 1;

    if (noiseIdx === 0 || noiseIdx === 5) {
      // 펄린/컬 유체: 흐르는 유기적 곡선 가이드라인 (백색/컬러)
      ctx.strokeStyle = theme.lightColor;
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 12; i++) {
        let y = (i / 12) * H;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 30) {
          let ny = y + Math.sin(x * 0.005 + time + i) * 30;
          if (x === 0) ctx.moveTo(x, ny);
          else ctx.lineTo(x, ny);
        }
        ctx.stroke();
      }
    } else if (noiseIdx === 1 || noiseIdx === 4) {
      // 심플렉스/밸류: 모던 흑백 격자 픽셀 그리드
      ctx.strokeStyle = theme.darkColor;
      ctx.globalAlpha = 0.12;
      let gridSize = 60;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    } else if (noiseIdx === 2) {
      // 보로노이: 칠흑 배경 속 백색 도트 매트릭스
      ctx.fillStyle = theme.lightColor;
      ctx.globalAlpha = 0.15;
      for (let x = 40; x < W; x += 80) {
        for (let y = 40; y < H; y += 80) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (noiseIdx === 6 || noiseIdx === 7) {
      // 도메인/조화: 동심원 레이저 라인
      ctx.strokeStyle = theme.accentColor;
      ctx.globalAlpha = 0.1;
      for (let r = 50; r < Math.max(W, H); r += 90) {
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, r + Math.sin(time) * 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // =========================================================================
  // 🖌️ 5가지 기본 도형 렌더링
  // =========================================================================
  drawSingleShape(ctx, shape, x, y, size, angle, strokeW, colorHex, isFill) {
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
        if (isFill) ctx.fill();
        else ctx.stroke();
        break;

      case 'SQUARE': // 3. 네모
        if (isFill) ctx.fillRect(-size / 2, -size / 2, size, size);
        else ctx.strokeRect(-size / 2, -size / 2, size, size);
        break;

      case 'DOT': // 4. 점 (채워진 원)
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(3, size * 0.3), 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'CIRCLE': // 5. 동그라미 (테두리 원)
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.65, 0, Math.PI * 2);
        if (isFill) ctx.fill();
        else ctx.stroke();
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

    // 관제탑 제어 수치
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;                         // SHUFFLE
    const rangeVal = (globalSettings.scatterExponent ?? 2.2) * 0.005;  // RANGE
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 120;   // SHATTER
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;                // GAUGE
    const gainVal = globalSettings.audioGain ?? 1.0;

    // 시드나 화면 크기가 변경되면 30개 도형 배치 재생성
    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generate30Shapes(seedVal, W, H);
    }

    // SHUFFLE 슬라이더 수치로 8종 노이즈 선택 및 테마 할당
    const activeNoiseIndex = Math.abs(seedVal) % this.noiseCatalog.length;
    const currentNoiseInfo = this.noiseCatalog[activeNoiseIndex];
    const theme = currentNoiseInfo.theme;

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

    // 1. 노이즈별 배경 그래픽 생성 (흑/백/그리드)
    this.drawNoiseBackgroundArt(this.ctx, W, H, theme, activeNoiseIndex, this.time);

    // 2. 30개 도형 (흑 / 백 / 컬러 레이어) 노이즈 연동 렌더링
    this.shapes.forEach((s) => {
      const noiseVector = this.sampleNoise(
        activeNoiseIndex,
        s.baseX * rangeVal,
        s.baseY * rangeVal,
        this.time * (0.8 + gaugeVal * 1.5 + otherVol * 2.0)
      );

      // 위치 (Shatter + 오디오 충격파)
      const currentShatter = shatterVal * (1.0 + drumsVol * 2.5);
      const renderX = s.baseX + noiseVector.dx * currentShatter;
      const renderY = s.baseY + noiseVector.dy * currentShatter;

      // 크기 및 회전 (보컬/베이스 연동)
      const renderSize = s.baseSize * (0.85 + vocalsVol * 1.6 + drumsVol * 0.7);
      const renderAngle = s.baseAngle + this.time * (1.0 + gaugeVal * 2.0) + (noiseVector.dx * 3.0);
      const strokeW = Math.max(1.5, (2.0 + gaugeVal * 3.5 + bassVol * 5.0));

      // 💡 흑, 백, 컬러 포인트 색상 및 채우기 분배
      let currentColor = theme.lightColor;
      let isFill = false;

      if (s.colorCategory === 0) {
        // 흑(Dark) 계열 도형
        currentColor = theme.darkColor;
        isFill = true;
      } else if (s.colorCategory === 1) {
        // 백(Light/White) 계열 도형
        currentColor = theme.lightColor;
        isFill = false;
      } else {
        // 컬러(Accent/Sub) 포인트 도형
        currentColor = (s.id % 2 === 0) ? theme.accentColor : theme.subColor;
        isFill = (s.type === 'SQUARE' || s.type === 'TRIANGLE');
        this.ctx.shadowColor = currentColor;
        this.ctx.shadowBlur = 10 + bassVol * 30;
      }

      this.drawSingleShape(this.ctx, s, renderX, renderY, renderSize, renderAngle, strokeW, currentColor, isFill);
    });

    this.ctx.restore();

    // 💡 우측 상단 HUD에 현재 노이즈 이름 & 스타일 설명 팝업 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `30 Shapes [Dark/White/Color]`,
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
