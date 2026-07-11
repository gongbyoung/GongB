/**
 * src/sketches/014_p5_pendulums.js
 * - [버전] Ver 2.7 (isPlaying 참조 에러 완치 및 시네마틱 오토 팝업 페이딩 완결판)
 * - 이징 오타 및 ReferenceError 원천 봉쇄 처리 완료
 * - 음악 재생 시 락이 걸리지 않고 안내 팝업창이 정상적으로 투명 소멸하도록 밸런스 조정
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
    this.version = "Resonant Echoes Ambient Ver 2.7";

    this.guiOverlay = null; 
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
            pulsePhase: p.map(i, 0, this.numOrbs, 0, 360), 
            rippleEnergy: 0
          });
        }
      };

      p.draw = () => {
        p.clear();

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

        // 한지 느낌의 그라데이션 배경
        p.noStroke();
        ctx.shadowBlur = 0;
        const ctx = p.drawingContext;
        const bgGrad = ctx.createLinearGradient(0, 0, 0, p.height);
        bgGrad.addColorStop(0, '#0a0d14');   
        bgGrad.addColorStop(0.5, '#10141f'); 
        bgGrad.addColorStop(1, '#06080d');   
        ctx.fillStyle = bgGrad;
        p.rect(0, 0, p.width, p.height);

        let alphaFade = p.map(gauge, 0, 1, 35, 8);
        p.fill(10, 14, 22, alphaFade);
        p.rect(0, 0, p.width, p.height);

        let rawData = [];
        let isAudioPlaying = false;
        if (this.currentAudioData && this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
          rawData = this.currentAudioData.raw;
          const audioEl = document.querySelector('audio');
          if (audioEl && !audioEl.paused) isAudioPlaying = true; // 💡 오타 완치: 변수 연동 일치
        }

        // 💡 오디오가 실제로 재생 시작되면 팝업 가이드를 부드럽게 소멸시킴
        if (isAudioPlaying && this.guiOverlay) {
          this.guiOverlay.style.opacity = '0';
          this.guiOverlay.style.pointerEvents = 'none';
        }

        let bass = this.currentAudioData ? (this.currentAudioData.bass || 0.0) : 0.0;

        for (let i = 0; i < this.numOrbs; i++) {
          let pt = this.orbs[i];
          pt.pulsePhase += 0.4; 

          let freqIdx = p.floor(p.map(i, 0, this.numOrbs, 3, 45));
          let rawVal = (rawData && rawData[freqIdx]) ? rawData[freqIdx] / 255.0 : 0.0;
          let targetVolume = rawVal * gain * 1.5;
          
          pt.smoothedSize += (targetVolume - pt.smoothedSize) * 0.06;

          let nextIdx = (i + 1) % this.numOrbs;
          if (this.orbs[nextIdx]) {
            this.orbs[nextIdx].rippleEnergy += (pt.smoothedSize - this.orbs[nextIdx].rippleEnergy) * 0.02;
          }
        }

        this.cameraDrift += 0.02;
        let baseZoomScale = p.map(glow, 10, 250, 0.6, 2.5);
        this.cameraZoom = p.constrain(baseZoomScale, 0.6, 3.5) + p.sin(this.cameraDrift * 0.3) * 0.03 - (bass * 0.02);

        let camX = (p.width / 2) + (offX * 2.0);
        let camY = (p.height / 2) + (offY * -2.0);

        p.push();
        p.translate(camX, camY);
        p.scale(this.cameraZoom);
        p.rotate(p.sin(this.cameraDrift * 0.15) * 1.2 + offZ * 4.0);

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

        let totalWidth = p.width * 0.65;
        let startX = -totalWidth / 2;
        let spacing = totalWidth / (this.numOrbs - 1);

        const timeFactor = p.frameCount * 0.15;

        // 1단계: 연결선 그리기
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

        // 2단계: 빛의 구체 그리기
        p.noStroke();
        for (let i = 0; i < this.numOrbs; i++) {
          let pt = this.orbs[i];
          let x = startX + i * spacing;
          
          let baseSize = p.map(glow, 10, 250, 35, 120);
          let breathingRadius = baseSize + (pt.smoothedSize * 95) + (pt.rippleEnergy * 45) + p.sin(pt.pulsePhase * 2.5) * 8;
          let currentY = p.sin(pt.pulsePhase) * 15 + (pt.smoothedSize * 8);
          
          let orbColor = p.lerpColor(c1, c2, i / (this.numOrbs - 1));
          
          ctx.save();
          let radialGrad = ctx.createRadialGradient(x, currentY, 2, x, currentY, breathingRadius * 0.5);
          radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); 
          radialGrad.addColorStop(0.2, orbColor.toString());
          
          let edgeAlpha = p.map(p.dist(x, currentY, 0, 0), 0, p.width * 0.5, 0.22, 0.04);
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

  buildOnScreenGuideUI() {
    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    
    Object.assign(this.guiOverlay.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '88%', maxWidth: '440px', backgroundColor: 'rgba(9, 12, 20, 0.95)',
      border: '1px solid rgba(0, 255, 204, 0.5)', borderRadius: '14px', padding: '24px',
      color: '#ffffff', fontFamily: 'sans-serif', zIndex: '30', boxShadow: '0 8px 30px rgba(0,0,0,0.75)',
      boxSizing: 'border-box', textAlign: 'center', transition: 'opacity 0.5s ease-in-out'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
        🌌 STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 17px; margin: 0 0 16px 0; font-weight: 600;">
        014호 명상 스튜디오: 공명의 잔상
      </h3>
      <div style="font-size: 13px; text-align: left; line-height: 1.8; color: #dddddd;">
        <p style="margin: 8px 0;">✨ <strong>[설명]</strong> 물속에서 피어오르는 유기적인 빛의 구체로 전환한 앰비언트 공간입니다.</p>
        <p style="margin: 8px 0; border-top: 1px solid #222; padding-top: 8px; color: #00ffcc; font-weight: bold;">🛠️ 7대 관제탑 운영 방법:</p>
        <ul style="margin: 4px 0; padding-left: 18px; color: #bbb; font-size: 12.5px;">
          <li><strong>Shuffle :</strong> 가스 덩굴 노이즈 형태학 무작위 시드 변경</li>
          <li><strong>Range :</strong> 몽환적인 안개 발광(Glow)의 번짐 반경 조절</li>
          <li><strong>Scale :</strong> 빛 구체들의 중심부 기저 기본 크기 지배</li>
          <li><strong>Volume :</strong> 주파수 유입 시 수축·팽창 모션 민감도 증폭</li>
          <li><strong>Gauge :</strong> 잔상 레이어 농도를 통한 색상 진하기 제어</li>
          <li><strong>3D Offset :</strong> 가상 카메라의 유영 시점 이동 (0,0,0=정면)</li>
          <li><strong>Color Style :</strong> No1~No5 명상 테마 아날로그 자연색 변경</li>
        </ul>
        <p style="margin: 12px 0 0 0; color: #ffcc00; text-align: center; font-weight: bold; font-size: 12px;">▶️ [하단 음악 파일] 재생 버튼을 누르면 이 가이드창이 아련하게 소멸합니다.</p>
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
