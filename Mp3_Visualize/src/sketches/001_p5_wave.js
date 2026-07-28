/**
 * src/sketches/001_p5_wave.js
 * - [버전] Ver 1.7 (Color Palette 테마 연동 및 관제탑 RESET 하드웨어 동기화 완결판)
 * - select-cosmic-color 드롭다운(No1~No5) 변경 시 앰비언트 자연색 힐링 톤 실시간 완벽 스위칭
 * - RESET 단추 클릭 즉시 스플라인 노이즈 형태학 시드 및 가상 카메라 3D 오프셋 완전 초기화
 */

export default class P5Wave { 
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;

    this.numPoints = 120; 
    this.smoothedHeights = new Float32Array(this.numPoints);
    this.cameraAngle = 0;
    this.currentMode = "새벽 안개 속 빛의 고리";
    this.version = "Ambient Healing Stream Ver 1.7";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.parent(this.container);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.angleMode(p.DEGREES); 
        
        // 💡 RESET 구동 즉시 현재 관제탑의 모든 UI 상태를 메모리에 동기화 락인
        if (window.cosmicEngineSettings && p.noiseSeed) {
            p.noiseSeed(window.cosmicEngineSettings.seed || 42);
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
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon'; // 💡 관제탑 드롭다운 벨류 수혈
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;     
          gain = window.cosmicEngineSettings.audioGain || 1.0;         
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;       
          customColors = window.cosmicEngineSettings.customColors || customColors;
          offX = window.cosmicEngineSettings.positionOffset?.x || 0;
          offY = window.cosmicEngineSettings.positionOffset?.y || 0;
          offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
        }

        this.currentMode = `새벽 안개 [시드: ${seed}]`;

        // Gauge 수치 연동 색상 채도 제어
        let alphaFade = p.map(gauge, 0, 1, 45, 5); 

        p.push();
        p.noStroke();
        ctx.shadowBlur = 0;
        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            p.fill(9, 13, 20, alphaFade); p.rect(0, 0, width, height);
        } else {
            p.fill(7, 10, 15, alphaFade); p.rect(0, 0, width, height);
        }
        p.pop();

        let rawData = new Float32Array(this.numPoints);
        let bass = 0.1;
        if (this.currentAudioData && this.currentAudioData.raw) {
            rawData = this.currentAudioData.raw;
            bass = this.currentAudioData.bass || 0.1;
        }

        const timeFactor = p.frameCount * 0.3;

        for (let i = 0; i < this.numPoints; i++) {
            let rawIdx = p.floor(p.map(i, 0, this.numPoints, 2, 160));
            let targetVal = ((rawData[rawIdx] || 0) / 255.0) * (gain * 1.3);
            this.smoothedHeights[i] += (targetVal - this.smoothedHeights[i]) * 0.08;
        }

        // 3D 카메라 오프셋 및 회전 바이어스 연동
        this.cameraAngle += 0.06;
        let camX = (width / 2) + (offX * 2.0);
        let camY = (height / 2) + (offY * -2.0); 
        p.translate(camX, camY);
        p.rotate(this.cameraAngle + offZ * 5.0); 

        const baseRadius = p.map(glow, 10, 250, 60, 280) + (bass * 20.0 * gain);

        // 💡 [Color Style Palette 파이프라인 무결점 수리]
        let c1, c2;
        if (colorStyle === 'monochrome') {
            // No1 : 모스 그린 테마 (Moss Green)
            c1 = p.color('#2f523e'); c2 = p.color('#61b589');
            ctx.shadowColor = 'rgba(97, 181, 137, 0.4)';
        } else if (colorStyle === 'neon') {
            // No2 : 샌드 베이지 테마 (Sand Beige)
            c1 = p.color('#ba9e7d'); c2 = p.color('#ebe6dc');
            ctx.shadowColor = 'rgba(235, 230, 220, 0.4)';
        } else if (colorStyle === 'pastel') {
            // No3 : 은은한 대지 / 새벽녘 테마 (Earth & Dawn)
            c1 = p.color('#233142'); c2 = p.color('#fac3b3');
            ctx.shadowColor = 'rgba(250, 195, 179, 0.4)';
        } else if (colorStyle === 'custom') {
            // No4 : 커스텀 픽커 컬러 매핑
            c1 = p.color(customColors.gas1); c2 = p.color(customColors.gas2);
            ctx.shadowColor = customColors.star;
        } else {
            // No5 : 올 랜덤 아날로그 컬러 매핑
            p.randomSeed(seed + 88);
            c1 = p.color(p.random(100, 255), p.random(80, 200), p.random(120, 255));
            c2 = p.color(p.random(150, 255), p.random(150, 255), p.random(100, 200));
            ctx.shadowColor = 'rgba(255,255,255,0.4)';
        }

        ctx.shadowBlur = p.map(scatter, 5, 50, 5, 80);

        // 안쪽 유기적 곡선
        p.stroke(c1); p.strokeWeight(2.5); p.noFill();
        p.beginShape();
        for (let i = -2; i < this.numPoints + 3; i++) {
            let idx = (i + this.numPoints) % this.numPoints;
            let h = this.smoothedHeights[idx] * 75;
            let waveNoise = p.noise(i * 0.12, timeFactor) * 20;
            let r = baseRadius + h + waveNoise;
            let angle = p.map(i, 0, this.numPoints, 0, 360);
            p.curveVertex(r * p.cos(angle), r * p.sin(angle));
        }
        p.endShape();

        // 바깥쪽 곡선
        p.stroke(c2); p.strokeWeight(1.5);
        p.beginShape();
        for (let i = -2; i < this.numPoints + 3; i++) {
            let idx = (i + this.numPoints) % this.numPoints;
            let h = this.smoothedHeights[idx] * 55;
            let waveNoise = p.noise(i * 0.1, timeFactor + 80) * 15;
            let r = (baseRadius - 20) - h - waveNoise;
            let angle = p.map(i, 0, this.numPoints, 360, 0);
            p.curveVertex(r * p.cos(angle), r * p.sin(angle));
        }
        p.endShape();
      };
    };

    this.p5Instance = new p5(sketch);
  }

  update(audioData) { this.currentAudioData = audioData; }
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  destroy() { if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; } this.currentAudioData = null; }
}
