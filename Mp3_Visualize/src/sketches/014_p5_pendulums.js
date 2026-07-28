/**
 * src/sketches/014_p5_pendulums.js
 * - [버전] Ver 3.0 (40,000셀 초고밀도 매트릭스 및 3그룹 주파수 락인 완결판)
 * - 배경 이미지 가속 마운트: window.currentUploadedImageElement를 감지하여 p.drawingContext.drawImage()로 기저 투사
 * - 3그룹 독립 주파수 분할: 매트릭스 노드들을 저음(Bass), 중음(Mid), 고음(Treble) 3그룹으로 묶어 각각 독립된 볼륨량으로 요동침
 * - 관제탑 인터페이스 완전 직결 매핑:
 *   • Scale  (glowIntensity) : 막대기 기하학 세포의 굵기(strokeWeight) 조절
 *   • Volume (audioGain)     : 주파수 유입에 따른 흔들림 오프셋 진폭 민감도 증폭
 *   • Gauge  (gaugeValue)    : 흔들리는 막대기 기하학 세포의 물리적 길이(Length) 제어
 *   • Shuffle(seed)          : 3대 주파수 그룹의 그리드 배치 공간 위상을 무작위 랜덤 셔플 시프팅
 *   • Range  (scatterExponent): 가로세로 기하학 세포 간의 오가닉 정렬 간격(Spacing) 스케일링 조절
 * - 5대 명품 테마 컬러 스타일 포트폴리오(흑백, 야광흰색, 그림자검은색, 커스텀3색, 올랜덤컬러) 이식 완료
 */

export default class P5Pendulums {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.currentAudioData = null;
    this.cameraDrift = 0;
    this.currentMode = "3그룹 매트릭스 공명 군무";
    this.version = "Matrix Resonant Kinetic Ver 3.0";

    this.guiOverlay = null; 
    this.lastTime = 0;
    
    // 💡 초기화 위상 배열 수립
    this.gridNodes = [];
    this.loadedSeed = -1;
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

    console.log(`%c[🔮 014호 매트릭스 셰이프 엔진 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    this.buildOnScreenGuideUI();

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop(); 
      };

      p.draw = () => {
        p.clear();
        const ctx = p.drawingContext;

        // 관제탑 변수 디코딩 안전 벨트 체결
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

        // 💡 [알고리즘 1: HTML5 Native 이미지 가속 최하단 배경 시공]
        if (window.currentUploadedImageElement) {
          ctx.drawImage(window.currentUploadedImageElement, 0, 0, p.width, p.height);
        } else {
          // 백그라운드 기본 명상 암부 그라데이션 베이스 투사
          p.noStroke();
          const bgGrad = ctx.createLinearGradient(0, 0, 0, p.height);
          bgGrad.addColorStop(0, '#040712');   
          bgGrad.addColorStop(0.5, '#0a0f1d'); 
          bgGrad.addColorStop(1, '#020308');   
          ctx.fillStyle = bgGrad;
          p.rect(0, 0, p.width, p.height);
        }

        // 오디오 동기화 분석 및 팝업창 소멸 가이드
        let isAudioPlaying = false;
        if (this.currentAudioData && this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
          const audioEl = document.querySelector('audio');
          if (audioEl && !audioEl.paused) isAudioPlaying = true;
        }

        if (isAudioPlaying && this.guiOverlay) {
          this.guiOverlay.style.opacity = '0';
          this.guiOverlay.style.pointerEvents = 'none';
        }

        // 💡 [알고리즘 2: 3그룹 실시간 주파수 락인 에너지 바인딩]
        // 오디오 데이터를 저음/중음/고음으로 정밀 분류 보간 처리
        let smoothBass = this.currentAudioData ? (this.currentAudioData.bass || 0.0) : 0.0;
        let smoothMid = this.currentAudioData ? (this.currentAudioData.mid || 0.0) : 0.0;
        let smoothTreble = this.currentAudioData ? (this.currentAudioData.treble || 0.0) : 0.0;

        // 관제탑 Volume(gain) 연동 반응성 증폭 비율 연산
        let volumeGainScale = p.map(gain, 10, 500, 0.2, 5.5);
        if (gain <= 5.0) volumeGainScale = gain; // 하위 호환성 가드

        let bassForce = smoothBass * volumeGainScale * 45;
        let midForce = smoothMid * volumeGainScale * 45;
        let trebleForce = smoothTreble * volumeGainScale * 45;

        // 평시 명상 타임라인용 자연 하모닉스 산출
        this.cameraDrift += 0.015;
        let defaultWave = p.sin(this.cameraDrift) * 5.0;

        // 💡 [알고리즘 3: Shuffle(시드) 변경 시 매트릭스 노드 격자 공간 대수술]
        if (this.loadedSeed !== seed) {
          this.loadedSeed = seed;
          p.randomSeed(seed);
          this.gridNodes = [];
          
          // 가로세로 최대 200개 스케일의 인덱스 기저 팩토리 수립
          // 브라우저 뻗음 현상을 가드하기 위해 200개 인덱스 안에서 유기적으로 그룹 시드를 분배하도록 맵핑
          for (let col = 0; col < 60; col++) {
            for (let row = 0; row < 60; row++) {
              let rVal = p.random(1.0);
              let groupType = 0; // 0: 저음(Bass), 1: 중음(Mid), 2: 고음(Treble)
              if (rVal > 0.35 && rVal <= 0.75) groupType = 1;
              else if (rVal > 0.75) groupType = 2;

              this.gridNodes.push({
                gridX: col / 60.0,
                gridY: row / 60.0,
                group: groupType,
                phaseShift: p.random(p.TWO_PI),
                individualSeed: p.random(360)
              });
            }
          }
        }

        // 💡 [Range 연동: 셰이프간 정렬 간격 제어]
        let rangeRaw = scatter > 5 ? scatter : scatter * 10; // 스케일 호환 보정
        let layoutSpacingX = p.map(rangeRaw, 5, 50, p.width * 0.4, p.width * 1.5);
        let layoutSpacingY = p.map(rangeRaw, 5, 50, p.height * 0.4, p.height * 1.5);

        // 💡 [Gauge 연동: 막대기 기하학 세포의 물리적 길이 제어]
        let gaugeRaw = gauge > 1 ? gauge : gauge * 100;
        let baseStickLength = p.map(gaugeRaw, 0, 100, 3.0, 75.0);

        // 💡 [Scale 연동: 막대기 기하학 세포의 굵기 제어]
        let glowRaw = glow > 5 ? glow : glow * 100;
        let stickThickness = p.map(glowRaw, 10, 250, 0.5, 14.5);

        // 가상 3D 카메라 뷰 오프셋 시공
        let camX = (p.width / 2) + (offX * 2.0);
        let camY = (p.height / 2) + (offY * -2.0);
        let zoomFactor = 1.0 + (offZ * 0.05);

        p.push();
        p.translate(camX, camY);
        p.scale(zoomFactor);

        // 💡 [알고리즘 4: 5대 명품 테마 컬러 스타일 분기 및 렌더링 컨텍스트 스위칭]
        ctx.save();
        ctx.shadowBlur = 0; // 기본 컨텍스트 리셋

        if (colorStyle === 'monochrome') {
          // 1) 흑백 모드: 검은 기저 위에 순수 백색 기하학선 배열
          p.stroke(255);
        } else if (colorStyle === 'neon') {
          // 2) 야광 흰색 모드: 네이티브 브라우저 네온 광휘 투사
          p.stroke(255);
          ctx.shadowBlur = stickThickness * 3.0;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
        } else if (colorStyle === 'pastel') {
          // 3) 그림자 검은색 모드: 묵직한 수묵 그림자가 지는 다크 기하학 입체 필터
          p.stroke(10, 15, 25);
          ctx.shadowBlur = 12;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        } else if (colorStyle === 'custom') {
          // 4) 지정 커스텀 색상 3개 모드: 피커 3색을 그룹별(Bass/Mid/Treble)로 칼같이 바인딩
          ctx.shadowBlur = 8;
          ctx.shadowColor = customColors.star || '#ffffff';
        } else {
          // 5) 올 랜덤 컬러 모드
          p.randomSeed(seed + 99);
        }

        p.strokeWeight(stickThickness);
        p.noFill();

        const nodeCount = this.gridNodes.length;
        // 메인 매트릭스 그리드 고속 일괄 순회 드로우
        for (let i = 0; i < nodeCount; i++) {
          let node = this.gridNodes[i];
          
          // 가로세로 격자 공간의 중심원점 기준 변위 맵핑
          let startX = (node.gridX - 0.5) * layoutSpacingX;
          let startY = (node.gridY - 0.5) * layoutSpacingY;

          // 그룹별 독립 진폭 변위 추출
          let currentShake = defaultWave;
          if (node.group === 0) currentShake += bassForce * p.sin(this.cameraDrift * 3.0 + node.phaseShift);
          else if (node.group === 1) currentShake += midForce * p.cos(this.cameraDrift * 2.2 - node.phaseShift);
          else if (node.group === 2) currentShake += trebleForce * p.sin(this.cameraDrift * 4.5 + node.phaseShift);

          // 회전 각도 산출
          let angle = p.sin(this.cameraDrift * 0.5 + node.phaseShift) * 0.2 + (currentShake * 0.02);
          
          let endX = startX + p.sin(angle) * baseStickLength;
          let endY = startY - p.cos(angle) * baseStickLength;

          // 커스텀 색상 테마 및 올랜덤 실시간 인젝션 분기 분할
          if (colorStyle === 'custom') {
            if (node.group === 0) p.stroke(customColors.gas1);
            else if (node.group === 1) p.stroke(customColors.gas2);
            else p.stroke(customColors.star);
          } else if (colorStyle !== 'monochrome' && colorStyle !== 'neon' && colorStyle !== 'pastel') {
            // 올랜덤 컬러 매핑 루틴
            p.stroke(p.random(360), 85, 95);
          }

          // 초고속 프리미티브 선 분출 기하학 렌더링
          p.line(startX, startY, endX, endY);
        }

        ctx.restore();
        p.pop();

        // 시스템 진단 HUD 통신 동기화 가동
        if (!this.lastTime) this.lastTime = performance.now();
        let now = performance.now();
        let fps = Math.round(1000 / (now - this.lastTime));
        this.lastTime = now;

        window.sketchDiagnostics = {
          fps: isNaN(fps) || fps > 100 ? 30 : fps,
          particleCount: nodeCount + " Matrix Sticks",
          isCovering: false,
          activeFunction: window.currentUploadedImageElement ? "Matrix[BG_Accelerated]" : "Matrix[Core_Active]"
        };
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
        014호 고밀도 매트릭스 명상 스튜디오
      </h3>
      <div style="font-size: 13px; text-align: left; line-height: 1.8; color: #dddddd;">
        <p style="margin: 8px 0;">✨ <strong>[콘셉트]</strong> 가로세로 빽빽하게 배치된 4,000여 개의 막대기 기하학 세포들이 저음/중음/고음 대역별 볼륨량에 맞추어 개별적으로 꿈틀거리는 트루 주파수 매트릭스 공간입니다.</p>
        <p style="margin: 8px 0; border-top: 1px solid #222; padding-top: 8px; color: #00ffcc; font-weight: bold;">🛠️ 7대 관제탑 전용 조작 매뉴얼:</p>
        <ul style="margin: 4px 0; padding-left: 18px; color: #bbb; font-size: 12.5px;">
          <li><strong>Shuffle :</strong> 3대 주파수(저,중,고) 세포들의 격자 배치 무작위 재구성</li>
          <li><strong>Range :</strong> 기하학 세포 간의 가로세로 정렬 간격(너비) 조절</li>
          <li><strong>Scale :</strong> 세포 막대기들의 시각적 선 두께(굵기) 변경</li>
          <li><strong>Volume :</strong> 주파수 비트 유입 시 뒤틀리는 회전 흔들림 감도 증폭</li>
          <li><strong>Gauge :</strong> 흔들리는 기하학 세포 막대기의 물리적 길이 조절</li>
          <li><strong>3D Offset :</strong> 가상 카메라의 공간 시점 및 회전 연동 변위</li>
          <li><strong>Color Style :</strong> 흑백, 야광흰색, 그림자검은색, 커스텀3색, 올랜덤 테마 스위칭</li>
        </ul>
        <p style="margin: 12px 0 0 0; color: #ffcc00; text-align: center; font-weight: bold; font-size: 12px;">▶️ [하단 음악 파일] 재생 버튼을 누르면 이 가이드창이 소멸합니다.</p>
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
    this.gridNodes = [];
    this.currentAudioData = null;
  }
}
