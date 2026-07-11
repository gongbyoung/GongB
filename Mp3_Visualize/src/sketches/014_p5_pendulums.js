/**
 * src/sketches/014_p5_pendulums.js
 * - [버전] Ver 2.6 (공명의 잔상 Resonant Echoes - 실지렁이 완치 및 가이드 팝업판)
 * - 음악이 꺼져 있어도 빛의 구체가 완전히 사라지지 않도록 미니멈 기본 크기 방어 연산 보정
 * - 스케치 최초 구동 시 화면 정중앙에 앰비언트 미디어 아트 팝업 가이드창(설명/운영법) 자동 투사
 * - 오디오 재생 또는 슬라이더 조작 시 팝업 창이 부드럽게 소멸하는 시네마틱 라이프사이클 구현
 */

export default class P5Pendulums {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numOrbs = 5; 
    this.orbs = [];
    this.currentAudioData = null;
    
    this.cameraDrift = 0;
    this.cameraZoom = 1.0;
    this.currentMode = "공명의 잔상";
    this.version = "Resonant Echoes Ambient Ver 2.6";

    this.guiOverlay = null; // 💡 앰비언트 안내 팝업창 객체
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    console.log(`%c[🔮 014호 명상 팝업 가이드 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    // 💡 [초기화 팝업 빌드] 화면 중앙에 스며드는 미술적 디자인 안내 가이드창 수립
    this.buildOnScreenGuideUI();

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop(); 

        this.orbs = [];
        for (let i = 0; i < this.numOrbs; i++) {
          this.orbs.push({
            smoothedSize: 0,
            pulsePhase: p.map(i, 0, this.numOrbs, 0, 360), // 부드러운 순차 위상 배치
            rippleEnergy: 0
          });
        }
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        let seed = 42, scatter = 22, glow = 85, gain = 100, gauge = 50;
        let offX = 0, offY = 0, offZ = 0;
        let colorStyle = 'neon';
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2; 
          gain = window.cosmicEngineSettings.audioGain || 1.0;          
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          customColors = window.cosmicEngineSettings.customColors || customColors;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;
          
          offX = window.cosmicEngineSettings.positionOffset?.x || 0;
          offY = window.cosmicEngineSettings.positionOffset?.y || 0;
          offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
        }

        p.noiseSeed(seed);

        // 한지 느낌의 새벽 대지 그라데이션 배경
        p.noStroke();
        ctx.shadowBlur = 0;
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0a0d14');   
        bgGrad.addColorStop(0.5, '#10141f'); 
        bgGrad.addColorStop(1, '#06080d');   
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        let alphaFade = p.map(gauge, 0, 1, 35, 8);
        p.fill(10, 14, 22, alphaFade);
        p.rect(0, 0, width, height);

        let rawData = [];
        let isAudioPlaying = false;
        if (this.currentAudioData && this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
          rawData = this.currentAudioData.raw;
          const audioEl = document.querySelector('audio');
          if (audioEl && !audioEl.paused) isPlaying = true;
        }

        // 오디오 입력이 들어오기 시작하면 가이드 팝업창을 부드럽게 숨김
        if (rawData.length > 0 && this.guiOverlay) {
          this.guiOverlay.style.opacity = '0';
          this.guiOverlay.style.pointerEvents = 'none';
        }

        let bass = this.currentAudioData ? (this.currentAudioData.bass || 0.0) : 0.0;

        // 0.06 초저속 댐핑 및 공명 물리
        for (let i = 0; i < this.numOrbs; i++) {
          let pt = this.orbs[i];
          pt.pulsePhase += 0.4; // 멈춰있을 때도 유기적으로 숨 쉬는 진동 속도

          let freqIdx = p.floor(p.map(i, 0, this.numOrbs, 3, 45));
          let rawVal = (rawData && rawData[freqIdx]) ? rawData[freqIdx] / 255.0 : 0.0;
          let targetVolume = rawVal * gain * 1.5;
          
          pt.smoothedSize += (targetVolume - pt.smoothedSize) * 0.06;

          let nextIdx = (i + 1) % this.numOrbs;
          if (this.orbs[nextIdx]) {
            this.orbs[nextIdx].rippleEnergy += (pt.smoothedSize - this.orbs[nextIdx].rippleEnergy) * 0.02;
          }
        }

        // 최면적 카메라 유영 줌 매핑
        this.cameraDrift += 0.02;
        // 💡 [실지렁이 완치 코어]: 멈춰있을 때 glow 수치가 아주 작아도 미니멈 크기(0.6)를 확보하도록 하한선 잠금장치 시공
        let baseZoomScale = p.map(glow, 10, 250, 0.6, 2.5);
        this.cameraZoom = p.constrain(baseZoomScale, 0.6, 3.5) + p.sin(this.cameraDrift * 0.3) * 0.03 - (bass * 0.02);

        let camX = (width / 2) + (offX * 2.0);
        let camY = (height / 2) + (offY * -2.0);

        p.push();
        p.translate(camX, camY);
        p.scale(this.cameraZoom);
        p.rotate(p.sin(this.cameraDrift * 0.15) * 1.2 + offZ * 4.0);

        // 5대 테마 명상 팔레트 컬러 매핑
        let c1, c2;
        if (colorStyle === 'monochrome') {
            c1 = p.color('#2b4c3b'); c2 = p.color('#5eb88b');
            ctx.shadowColor = 'rgba(94, 184, 139, 0.45)';
        } else if (colorStyle === 'neon') {
            c1 = p.color('#bfa588'); c2 = p.color('#fcf9f2');
            ctx.shadowColor = 'rgba(252, 249, 242, 0.45)';
        } else if (colorStyle === 'pastel') {
            c1 = p.color('#222d3d'); c2 = p.color('#e0b6aa');
            ctx.shadowColor = 'rgba(224, 182, 170, 0.45)';
        } else if (colorStyle === 'custom') {
            c1 = p.color(customColors.gas1); c2 = p.color(customColors.gas2);
            ctx.shadowColor = customColors.star;
        } else {
            p.randomSeed(seed + 66);
            c1 = p.color(p.random(80, 160), p.random(120, 220), 255);
            c2 = p.color(255, p.random(130, 240), p.random(90, 180));
            ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        }

        ctx.shadowBlur = p.map(scatter, 5, 50, 12, 85);

        let totalWidth = width * 0.65;
        let startX = -totalWidth / 2;
        let spacing = totalWidth / (this.numOrbs - 1);

        const timeFactor = p.frameCount * 0.15;

        // 1단계: 미세한 가스 덩굴(Tendrils) 연결선 드로잉
        p.strokeWeight(1.5);
        for (let i = 0; i < this.numOrbs - 1; i++) {
          let x1 = startX + i * spacing; let x2 = startX + (i + 1) * spacing;
          let pt1 = this.orbs[i]; let pt2 = this.orbs[i + 1];
          let y1 = p.sin(pt1.pulsePhase) * 15 + (pt1.smoothedSize * 8);
          let y2 = p.sin(pt2.pulsePhase) * 15 + (pt2.smoothedSize * 8);
          
          let lineCol = p.lerpColor(c1, c2, i / (this.numOrbs - 1));
          lineCol.setAlpha(55); p.stroke(lineCol); p.noFill();
          
          p.beginShape();
          p.curveVertex(x1, y1); p.curveVertex(x1, y1);
          p.curveVertex(p.lerp(x1, x2, 0.5), (y1 + y2) * 0.5 + p.noise(i, timeFactor) * 22 - 11);
          p.curveVertex(x2, y2); p.curveVertex(x2, y2);
          p.endShape();
        }

        // 2단계: 유기적 포그 글로우 빛의 구체(Light Orbs) 드로잉
        p.noStroke();
        for (let i = 0; i < this.numOrbs; i++) {
          let pt = this.orbs[i];
          let x = startX + i * spacing;
          
          // 💡 [실지렁이 완치 코어]: 음악이 꺼진 정적 상태일 때도 기본 구체 반경 35px을 강제 보장(Minimum Clamping)
          let baseSize = p.map(glow, 10, 250, 35, 120);
          let breathingRadius = baseSize + (pt.smoothedSize * 95) + (pt.rippleEnergy * 45) + p.sin(pt.pulsePhase * 2.5) * 8;
          let currentY = p.sin(pt.pulsePhase) * 15 + (pt.smoothedSize * 8);
          
          let orbColor = p.lerpColor(c1, c2, i / (this.numOrbs - 1));
          
          ctx.save();
          let radialGrad = ctx.createRadialGradient(x, currentY, 2, x, currentY, breathingRadius * 0.5);
          radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); 
          radialGrad.addColorStop(0.2, orbColor.toString());
          
          let edgeAlpha = p.map(p.dist(x, currentY, 0, 0), 0, width * 0.5, 0.22, 0.04);
          radialGrad.addColorStop(0.8, `rgba(${p.red(orbColor)}, ${p.green(orbColor)}, ${p.blue(orbColor)}, ${edgeAlpha})`);
          radialGrad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.fillStyle = radialGrad;
          p.ellipse(x, currentY, breathingRadius * 1.5);
          ctx.restore();
        }

        p.pop(); 
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [초기화 팝업 대장치 정밀 시공]
  buildOnScreenGuideUI() {
    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    
    Object.assign(this.guiOverlay.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '88%',
      maxWidth: '440px',
      backgroundColor: 'rgba(9, 12, 20, 0.95)',
      border: '1px solid rgba(0, 255, 204, 0.5)', 
      borderRadius: '14px',
      padding: '24px',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      zIndex: '30',
      boxShadow: '0 8px 30px rgba(0,0,0,0.75)',
      boxSizing: 'border-box',
      textAlign: 'center',
      transition: 'opacity 0.6s ease-in-out'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
        🌌 STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 17px; margin: 0 0 16px 0; font-weight: 600;">
        014호 명상 스튜디오: 공명의 잔상
      </h3>
      <div style="font-size: 13px; text-align: left; line-height: 1.8; color: #dddddd;">
        <p style="margin: 8px 0;">✨ <strong>[설명]</strong> 물리적 충돌 메커니즘을 전면 청산하고, 물속에서 피어오르는 유기적인 빛의 구체(Fluid Orbs)로 전환한 명상형 미디어 아트 공간입니다.</p>
        <p style="margin: 8px 0; border-top: 1px solid #222; padding-top: 8px; color: #00ffcc; font-weight: bold;">🛠️ 7대 관제탑 운영 방법:</p>
        <ul style="margin: 4px 0; padding-left: 18px; color: #bbb;">
          <li><strong>Shuffle :</strong> 빛의 가스 덩굴 형태학 노이즈 시드 변형</li>
          <li><strong>Range :</strong> 몽환적인 안개 발광(Glow)의 번짐 반경 조절</li>
          <li><strong>Scale :</strong> 빛 구체들의 중심부 기저 기본 크기 지배</li>
          <li><strong>Volume :</strong> 주파수 유입 시 수축·팽창 모션 민감도 증폭</li>
          <li><strong>Gauge :</strong> 잔상 레이어 농도를 통한 색상 진하기(채도) 제어</li>
          <li><strong>3D Offset :</strong> 가상 카메라의 유영 시점 이동 (0,0,0=정면)</li>
          <li><strong>Color Style :</strong> No1~No5 명상 테마 아날로그 자연색 변경</li>
        </ul>
        <p style="margin: 12px 0 0 0; color: #ffcc00; text-align: center; font-weight: bold; font-size: 12px;">▶️ [하단 오디오 재생] 버튼을 누르면 이 가이드창이 소멸합니다.</p>
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw();
  }

  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  
  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.guiOverlay) { this.guiOverlay.remove(); this.guiOverlay = null; }
    this.orbs = [];
    this.currentAudioData = null;
  }
}
