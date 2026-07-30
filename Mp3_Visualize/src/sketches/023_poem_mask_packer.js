/**
 * src/sketches/023_poem_mask_packer.js
 * - [버전] Ver 1.0 음절 단위 타이포 마스크 패커 (4-Stem 오디오 반응형)
 * - 보내주신 "슬픈 우상" 픽셀 충격 검사 패킹 알고리즘 기반 스케치 이식판
 */

export default class PoemMaskPackerSketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    
    // 마스크 판독용 오프스크린 캔버스
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');

    this.time = 0;
    this.version = "023호 시마스크 패커 Ver 1.0";

    // 기본 내장 긴 시 구절
    this.defaultPoem = "그대는 이 밤에 안식하시옵니까. 홀로 속삭이는 목소리로 그대의 안부를 여쭐지라도, 어찌 이 가벼운 입술로 다 전할 수 있으리오. 깊고 깊은 바다 속에 신비한 산호가 자라듯 그대 안에 보배로운 것들이 가득합니다. 그대의 심장, 얼마나 진기한 도가니인지요. 그대는 어찌하여 이 사랑의 성전을 지니셨나이다. 그대의 숨결은 얼마나 화려하고 신선하며, 숨겨진 속내는 얼마나 오묘하고 깊으신가요. 미묘한 곡선을 지닌 신비로운 두 언덕을 지나 이 아름다운 몸을 헤아리는 동안, 나는 미궁에 빠진 나그네처럼 길을 잃고 헤듭니다. 그대의 눈은 속속들이 맑고 푸른 한 쌍의 호수, 밤은 그대의 호수에 깃들기 위해 찾아오는 듯합니다. 조심히, 조심히 그대의 이마를 우러르고 뺨을 지나 흑단빛 머리칼에 숨은 그대의 귀에 다다릅니다.";

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

  update(audioData) {
    if (!this.ctx || !this.canvas) {
      this.init();
      if (!this.ctx) return;
    }

    const targetAudio = (audioData && audioData.isMultiStem !== undefined) ? audioData : (window.latestCompiledAudioData || audioData || {});

    this.time += 0.016;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 전역 컨트롤 타워 파라미터 로드
    const globalSettings = window.cosmicEngineSettings || {};
    const seed = globalSettings.seed ?? 42;
    const scatterVal = globalSettings.scatterExponent ?? 2.2; // 내부 글자 크기
    const glowVal = globalSettings.glowIntensity ?? 0.85;       // 마스크 틀 크기
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;         // 줄 간격
    const targetFontFamily = globalSettings.fontFamily || "'Noto Sans KR'";

    // 4-Stem 음압 감도
    let vocalsVol = 0, drumsVol = 0, bassVol = 0, otherVol = 0;
    if (targetAudio && targetAudio.isMultiStem) {
      vocalsVol = (targetAudio.vocalsVol || 0) * gainVal * 4.0;
      drumsVol  = (targetAudio.drumsVol  || 0) * gainVal * 4.0;
      bassVol   = (targetAudio.bassVol   || 0) * gainVal * 4.0;
      otherVol  = (targetAudio.otherVol  || 0) * gainVal * 4.0;
    } else if (targetAudio) {
      const vol = targetAudio.vol || 0;
      vocalsVol = (targetAudio.mid || 0) * 3.0 * gainVal;
      drumsVol  = (targetAudio.bass || 0) * 3.5 * gainVal;
      bassVol   = (targetAudio.bass || 0) * 3.0 * gainVal;
      otherVol  = (targetAudio.treble || 0) * 3.0 * gainVal;
    }

    // 1. 캔버스 및 배경 처리
    this.ctx.save();

    // 🥁 드럼: 비트 발생 시 화면 충격 셰이크
    if (drumsVol > 0.06) {
      const shakeX = (Math.random() - 0.5) * Math.min(drumsVol * 20, 20);
      const shakeY = (Math.random() - 0.5) * Math.min(drumsVol * 20, 20);
      this.ctx.translate(shakeX, shakeY);
    }

    const bgImg = window.currentUploadedImageElement;
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const imgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
      const canvasAspect = W / H;
      let rw, rh, xs, ys;

      if (canvasAspect > imgAspect) {
        rw = W; rh = W / imgAspect; xs = 0; ys = (H - rh) / 2;
      } else {
        rh = H; rw = H * imgAspect; xs = (W - rw) / 2; ys = 0;
      }

      this.ctx.drawImage(bgImg, xs, ys, rw, rh);
      this.ctx.fillStyle = 'rgba(5, 7, 15, 0.7)';
      this.ctx.fillRect(0, 0, W, H);
    } else {
      this.ctx.fillStyle = '#060812';
      this.ctx.fillRect(0, 0, W, H);
    }

    // 2. 틀 글자 (마스크) 텍스트 분할 ("슬픈" / "우상")
    const rawTitle = (globalSettings.poemText || "슬픈 우상").trim();
    const titleWords = rawTitle.split(' ');
    const line1Chars = (titleWords[0] || "슬픈").split('');
    const line2Chars = (titleWords.slice(1).join(' ') || "우상").split('');

    // 🎤 보컬: 가창에 따라 틀 글자 크기 바운스
    const mFontSize = Math.min(W, H) * 0.32 * (0.6 + glowVal * 0.8) + (vocalsVol * 30);
    const lineGap = mFontSize * (0.8 + gaugeVal * 0.2);
    const startY = H / 2 - (lineGap / 2);

    const glyphs = [];
    if (line1Chars.length > 0) {
      const step1 = W / line1Chars.length;
      line1Chars.forEach((ch, idx) => {
        glyphs.push({ char: ch, cx: step1 * (idx + 0.5), cy: startY });
      });
    }
    if (line2Chars.length > 0) {
      const step2 = W / line2Chars.length;
      line2Chars.forEach((ch, idx) => {
        glyphs.push({ char: ch, cx: step2 * (idx + 0.5), cy: startY + lineGap });
      });
    }

    // 3. 오프스크린 캔버스에 마스크 글자 디코딩 및 픽셀 맵 작성
    this.maskCanvas.width = W;
    this.maskCanvas.height = H;
    this.maskCtx.clearRect(0, 0, W, H);

    this.maskCtx.fillStyle = '#ffffff';
    this.maskCtx.font = `900 ${mFontSize}px ${targetFontFamily}, sans-serif`;
    this.maskCtx.textAlign = 'center';
    this.maskCtx.textBaseline = 'middle';

    // 외곽 확장 획
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

    const canFitBox = (x, y, w, h) => {
      const samples = 2;
      for (let i = 0; i <= samples; i++) {
        for (let j = 0; j <= samples; j++) {
          if (!isInsideGlyph(x + (w * i) / samples, y + (h * j) / samples)) return false;
        }
      }
      return true;
    };

    // 4. 내부 채움 시 글자 스트림 채우기
    const cleanPoem = this.defaultPoem.replace(/\s+/g, ' ');
    const poemChars = cleanPoem.split('');

    // 내부 글자 크기 & 줄 간격 (관제탑 Range / Gauge 연동)
    const cFontSize = Math.min(W, H) * 0.015 * (0.8 + scatterVal * 0.2);
    const cLineHeight = 1.1 + gaugeVal * 0.3;
    const lineSpacing = cFontSize * cLineHeight;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `700 ${cFontSize}px 'Nanum Myeongjo', ${targetFontFamily}, serif`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    let charIdx = 0;
    let totalPlaced = 0;

    // Color Style Palette 바인딩
    const colorSelectDOM = document.getElementById('select-cosmic-color');
    let colorStyle = colorSelectDOM ? colorSelectDOM.value.toLowerCase() : 'neon';

    let textColor = '#e2e8f0';
    let strokeColor = '#00f0ff';

    switch(colorStyle) {
      case 'neon': strokeColor = '#00f0ff'; textColor = '#ffffff'; break;
      case 'pastel': strokeColor = '#f472b6'; textColor = '#fef08a'; break;
      case 'monochrome': strokeColor = '#ffffff'; textColor = '#cbd5e1'; break;
      case 'custom':
        strokeColor = globalSettings.customColors?.gas1 || '#00ffcc';
        textColor = globalSettings.customColors?.star || '#ffffff';
        break;
    }

    this.ctx.fillStyle = textColor;

    // 글자 단위 충돌 패킹 렌더링
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

          if (canFitBox(x, y, charWidth, cFontSize)) {
            this.ctx.fillText(currentChar, x, y);
            x += charWidth;
            charIdx++;
            totalPlaced++;
          } else {
            x += stepX;
          }
        }
      }
    });

    // 🎸 베이스: 저음 타격 시 틀 외곽선 네온 발광
    const effectiveGlow = bassVol + vocalsVol * 0.5;
    if (effectiveGlow > 0.03) {
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

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Packed Chars: ${totalPlaced} Pcs`,
      isCovering: true,
      activeFunction: "PoemMaskPacker[Syllable_v1.0]"
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
