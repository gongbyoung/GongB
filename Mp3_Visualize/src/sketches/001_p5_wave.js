/**
 * src/sketches/001_p5_wave.js
 * - [버전] Ver 1.5 (새벽 안개 속 빛의 고리 - 명상형 앰비언트 미디어 아트 완결판)
 * - 날카로운 지그재그 선을 완전 유기적인 부드러운 스플라인 곡선(p.curveVertex)으로 변환
 * - 고대비 형광색을 걷어내고 모스 그린, 샌드 베이지, 은은한 대지/새벽녘 색상(Earth Tone) 배합
 * - 높은 자극성 노이즈를 필터링하고 깊은 여운(Decay/Smoothing)을 주어 유영하듯 움직이는 카메라 앵글 구현
 * - 캔버스 중심부에서 은은하게 새어 나오는 몽환적인 안개 발광(Light Leak & Fog Glow) 이펙트 탑재
 */

export default class P5Wave { 
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;

    // 💡 심리적 안정을 위한 장기 보간(Smoothing) 및 여운(Decay) 버퍼 버킷 수립
    this.numPoints = 120; // 가독성 피로도를 대폭 낮추기 위해 주파수 샘플링 포인트를 정갈하게 압축
    this.smoothedHeights = new Float32Array(this.numPoints);
    this.cameraAngle = 0;
  }

  init() {
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

        // 💡 [배경 최적화]: 절대적 블랙 대신 어스름한 새벽녘 하늘빛 백그라운드 캔버스 전개
        p.noStroke();
        ctx.shadowBlur = 0; // 배경 컴파일 시 블러 간섭 초기화
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#091011');  // 어스름한 모스 새벽빛
        bgGrad.addColorStop(0.5, '#0e141a'); // 차분한 딥 스페이스 블루
        bgGrad.addColorStop(1, '#05070a');  // 안정감을 주는 심해색
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 💡 잉크 잔상 효과를 부드럽게 남기기 위한 반투명 아날로그 포그 필터 한 겹 레이어링
        p.fill(11, 16, 22, 18);
        p.fillRect(0, 0, width, height);

        // 오디오 버퍼가 없을 때 정적인 예외 연출 처리 방지 -> 물 흐르듯 유기적인 기저 파동 가동
        let rawData = new Float32Array(this.numPoints);
        let bass = 0.1;

        if (this.currentAudioData && this.currentAudioData.raw) {
            rawData = this.currentAudioData.raw;
            bass = this.currentAudioData.bass || 0.1;
        }

        // 아주 부드러운 유영감을 지탱하는 타임 타임라인 시드 생성
        const timeFactor = p.frameCount * 0.4;

        // 💡 [반응의 템포 보정]: 자잘한 떨림은 무효화하고 Lerp 계수를 0.08로 극도로 낮춰 깊은 댐핑 호흡 주입
        for (let i = 0; i < this.numPoints; i++) {
            // 주로 부드러운 멜로디가 들어오는 저역/중역 대역 인덱싱 추출
            let rawIdx = p.floor(p.map(i, 0, this.numPoints, 2, 140));
            let targetVal = (rawData[rawIdx] || 0) / 255.0;
            
            // 0.08의 초저속 보간으로 정점을 찍은 후 돌아올 때의 슬로우 릴리즈(Decay) 완수
            this.smoothedHeights[i] += (targetVal - this.smoothedHeights[i]) * 0.08;
        }

        // 💡 [공간의 확장]: 카메라 앵글이 매 프레임 우주를 유영하듯 부드럽게 자동 정현파 회전 공전
        this.cameraAngle += 0.08;
        p.translate(width / 2, height / 2);
        p.rotate(this.cameraAngle);

        // 오디오 호흡 강도에 싱크되는 은은한 기본 링 반경 베이스 세팅
        const baseRadius = p.map(bass, 0, 1, 120, 160);

        // 💡 [Light Leak 효과]: 원형 링 중심부 내부에서 바깥으로 아련하게 피어오르는 빛의 안개 묘사
        ctx.save();
        p.noStroke();
        ctx.shadowBlur = p.map(bass, 0, 1, 30, 90);
        ctx.shadowColor = 'rgba(235, 220, 195, 0.25)'; // 따뜻한 샌드 베이지 광량 안개
        let centerGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, baseRadius * 0.8);
        centerGlow.addColorStop(0, 'rgba(0, 255, 150, 0.08)');  // 은은한 모스 그린 기운
        centerGlow.addColorStop(0.6, 'rgba(235, 220, 195, 0.03)');
        centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = centerGlow;
        p.ellipse(0, 0, baseRadius * 1.5);
        ctx.restore();

        // 💡 [네온 글로우 브러시 필터 장착]
        ctx.shadowBlur = p.map(bass, 0, 1, 15, 45); // 음악의 호흡 강도에 맞춰 빛무리가 팽창/수축함

        // 💡 1번 파형 트랙 레이어: 은은한 차분한 모스 그린 (Moss Green) 빛의 링
        ctx.shadowColor = '#408060';
        p.stroke('rgba(80, 170, 130, 0.55)');
        p.strokeWeight(2.5);
        p.noFill();

        // 완벽한 원형 폐곡선 스플라인을 위한 curveVertex 드로잉 설계
        p.beginShape();
        // 앞뒤 마진 포인트를 추가 중첩하여 결합 부위가 뚝 끊어지지 않게 처리
        for (let i = -2; i < this.numPoints + 3; i++) {
            let idx = (i + this.numPoints) % this.numPoints;
            let h = this.smoothedHeights[idx] * 90; // 과하지 않은 편안한 진폭 리미트
            
            // 물결이 스스로 일렁이는 노이즈 효과 가산
            let waveNoise = p.noise(i * 0.1, timeFactor) * 15;
            let r = baseRadius + h + waveNoise;
            
            let angle = p.map(i, 0, this.numPoints, 0, 360);
            let x = r * p.cos(angle);
            let y = r * p.sin(angle);
            p.curveVertex(x, y);
        }
        p.endShape();

        // 💡 2번 대칭형 파형 트랙 레이어: 따뜻하고 아련한 샌드 베이지 (Sand Beige / Off-White) 링
        ctx.shadowColor = '#d9c5b2';
        p.stroke('rgba(235, 215, 190, 0.45)');
        p.strokeWeight(1.5);

        p.beginShape();
        for (let i = -2; i < this.numPoints + 3; i++) {
            let idx = (i + this.numPoints) % this.numPoints;
            let h = this.smoothedHeights[idx] * 70;
            
            // 반대 방향 정현파 스윙 연산으로 정교하고 오가닉한 교차 구조 확립
            let waveNoise = p.noise(i * 0.08, timeFactor + 50) * 12;
            let r = (baseRadius - 15) - h - waveNoise; // 안쪽으로 부드럽게 감기는 대칭 링
            
            let angle = p.map(i, 0, this.numPoints, 360, 0); // 역방향 궤적 공전
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
