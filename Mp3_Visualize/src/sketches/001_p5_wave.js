/**
 * src/sketches/001_p5_wave.js
 * - [버전] Ver 1.6 (p.fillRect 에러 완치 및 7대 관제탑 UI 1:1 하드웨어 바인딩 완결판)
 * - p.fillRect() 문법 오류를 p.rect()로 완벽 치유하여 렌더링 락 전면 해제
 * - Shuffle(곡선 랜덤), Range(안개 발광), Scale(전체 크기), Volume(움직임 세기), Gauge(색상 채도) 완벽 매립
 * - 3D Offset X, Y, Z 수치를 카메라의 3차원 투사 변위로 매핑하여 정면(0,0,0) 및 입체 앵글 구현
 * - Color Style Palette (No1 ~ No5) 드롭다운 필터와 1:1 결합 완수
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
    this.version = "Ambient Healing Stream Ver 1.6";
  }

  init() {
    // 💡 초기화 구동 시 콘솔창에 기본 UI 작동 원리 브리핑 인젝션
    console.log(`%c[🔮 001호 앰비언트 엔진 가동완료] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");
    console.log(
        `%c🎛️ 001호 조작 가이드 패널\n` +
        `• Shuffle  ➡️ 입력값에 따라 스플라인 곡선의 일렁임 노이즈 시드가 변형됩니다.\n` +
        `• Range    ➡️ 몽환적인 안개 발광(Glow)의 번짐 두께를 조절합니다.\n` +
        `• Scale    ➡️ 전체 빛의 고리 중심부 크기 및 스케일을 지배합니다.\n` +
        `• Volume   ➡️ 주파수 입력 시 곡선이 출렁이는 모션 강도를 증폭합니다.\n` +
        `• Gauge    ➡️ 잔상 버퍼 농도를 제어하여 색상의 진하기(채도)를 결정합니다.\n` +
        `• 3D Oﬀset ➡️ X, Y, Z 축 가상 카메라 좌표계 무브먼트를 담당합니다. (0,0,0=정면)`,
        "color: #ffffff; line-height: 1.6;"
    );

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.parent(this.container);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.angleMode(p.DEGREES); 
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        // 💡 관제탑 실시간 UI 세팅값 인터셉트 인터페이스 수립
        let seed = 42, scatter = 22, glow = 85, gain = 100, gauge = 50;
        let offX = 0, offY = 0, offZ = 0;
        let colorStyle = 'neon';
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2; // 레일 간격용 수치 분할
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;     // Scale 매핑용
          gain = window.cosmicEngineSettings.audioGain || 1.0;         // Volume 매핑용
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;       // Gauge 매핑용
          customColors = window.cosmicEngineSettings.customColors || customColors;
          
          offX = window.cosmicEngineSettings.positionOffset?.x || 0;
          offY = window.cosmicEngineSettings.positionOffset?.y || 0;
          offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
        }

        // 시드 값에 반응하는 무작위 스플라인 일렁임용 랜덤 노이즈 시드 고정
        p.noiseSeed(seed);

        // 💡 [Gauge 연동]: 게이지 변수(0~1)를 역산하여 잔상 투명도를 제어함으로서 색상의 진하기(채도) 조절
        let alphaFade = p.map(gauge, 0, 1, 45, 5); 

        // 💡 [에러 교정 완료]: p.fillRect() 에러를 p.rect()로 완벽 정화 시공
        p.push();
        p.noStroke();
        ctx.shadowBlur = 0;
        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            p.fill(9, 13, 20, alphaFade);
            p.rect(0, 0, width, height);
        } else {
            p.fill(7, 10, 15, alphaFade);
            p.rect(0, 0, width, height);
        }
        p.pop();

        // 오디오 파이프라인 데이터 피딩
        let rawData = new Float32Array(this.numPoints);
        let bass = 0.1;
        if (this.currentAudioData && this.currentAudioData.raw) {
            rawData = this.currentAudioData.raw;
            bass = this.currentAudioData.bass || 0.1;
        }

        const timeFactor = p.frameCount * 0.3;

        // 💡 [Volume 연동]: gain(Volume) 계수를 곱해 곡선의 모션 움직임 강도를 조절
        for (let i = 0; i < this.numPoints; i++) {
            let rawIdx = p.floor(p.map(i, 0, this.numPoints, 2, 160));
            let targetVal = ((rawData[rawIdx] || 0) / 255.0) * (gain * 1.3);
            this.smoothedHeights[i] += (targetVal - this.smoothedHeights[i]) * 0.08;
        }

        // 💡 [3D Offset 및 기본 유영 연동]: X, Y, Z 좌표계를 가상 카메라 무브먼트로 변환 치환
        // 0,0,0 일 때는 완벽한 정면이며 변수를 건드리면 그 방향으로 시점이 비스듬히 아웃포커싱 유영함
        this.cameraAngle += 0.06;
        let camX = (width / 2) + (offX * 2.0);
        let camY = (height / 2) + (offY * -2.0); // 직관적인 상하 변위 보정
        
        p.translate(camX, camY);
        p.rotate(this.cameraAngle + offZ * 5.0); // Z축 제어 시 회전 바이어스 가산

        // 💡 [Scale 연동]: glow(Scale) 입력을 매핑하여 고리의 중심부 기본 크기를 유연하게 대축소 조절
        const baseRadius = p.map(glow, 0.1, 2.5, 60, 280) + (bass * 20.0 * gain);

        // 💡 [Color Style Palette 5대 모드 테마 정의 통합 매립]
        let c1, c2;
        if (colorStyle === 'monochrome') {
            // No1 : 차분하고 우아한 모스 그린 테마 (Moss Green)
            c1 = p.color('#36634d'); c2 = p.color('#6db38e');
            ctx.shadowColor = 'rgba(109, 179, 142, 0.4)';
        } else if (colorStyle === 'neon') {
            // No2 : 고즈넉하고 따뜻한 샌드 베이지 테마 (Sand Beige)
            c1 = p.color('#c7b198'); c2 = p.color('#f0ece3');
            ctx.shadowColor = 'rgba(240, 236, 227, 0.4)';
        } else if (colorStyle === 'pastel') {
            // No3 : 은은한 대지 / 새벽녘 테마 (Earth & Dawn)
            c1 = p.color('#2b3a4a'); c2 = p.color('#e8c4b8');
            ctx.shadowColor = 'rgba(232, 196, 184, 0.4)';
        } else if (colorStyle === 'custom') {
            // No4 : 사용자가 픽커로 선택한 커스텀 컬러 파이프라인 직결
            c1 = p.color(customColors.gas1); c2 = p.color(customColors.gas2);
            ctx.shadowColor = customColors.star;
        } else if (colorStyle === 'full-random') {
            // No5 : 시드에 기반하여 완전 자동 연산되는 올 랜덤 컬러 감성
            p.randomSeed(seed + 99);
            c1 = p.color(p.random(255), p.random(255), p.random(255));
            c2 = p.color(p.random(255), p.random(255), p.random(255));
            ctx.shadowColor = 'rgba(255,255,255,0.4)';
        }

        // 💡 [Range 연동]: scatter(Range) 항목 수치를 몽환적인 안개 발광 블러의 두께로 다이렉트 매핑
        ctx.shadowBlur = p.map(scatter, 0.5, 5.0, 5, 80);

        // 1번 안쪽 스플라인 유기적 곡선 루프 드로잉
        p.stroke(c1);
        p.strokeWeight(2.5);
        p.noFill();
        p.beginShape();
        for (let i = -2; i < this.numPoints + 3; i++) {
            let idx = (i + this.numPoints) % this.numPoints;
            let h = this.smoothedHeights[idx] * 75;
            
            // Shuffle 시드값에 기반하여 비정형적으로 뒤틀리는 스플라인 연산식
            let waveNoise = p.noise(i * 0.12, timeFactor) * 20;
            let r = baseRadius + h + waveNoise;
            
            let angle = p.map(i, 0, this.numPoints, 0, 360);
            let x = r * p.cos(angle);
            let y = r * p.sin(angle);
            p.curveVertex(x, y);
        }
        p.endShape();

        // 2번 바깥쪽 교차 스플라인 유기적 곡선 루프 드로잉
        p.stroke(c2);
        p.strokeWeight(1.5);
        p.beginShape();
        for (let i = -2; i < this.numPoints + 3; i++) {
            let idx = (i + this.numPoints) % this.numPoints;
            let h = this.smoothedHeights[idx] * 55;
            
            let waveNoise = p.noise(i * 0.1, timeFactor + 80) * 15;
            let r = (baseRadius - 20) - h - waveNoise;
            
            let angle = p.map(i, 0, this.numPoints, 360, 0);
            let x = r * p.cos(angle);
            let y = r * p.sin(angle);
            p.curveVertex(x, y);
        }
        p.endShape();
      };
    };

    this.p5Instance = new p5(sketch);
  }

  update(audioData) {
    this.currentAudioData = audioData;
  }

  resize(w, h) {
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.currentAudioData = null;
  }
}
