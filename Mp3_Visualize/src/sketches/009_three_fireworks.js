/**
 * src/sketches/009_three_fireworks.js
 * - [버전] Ver 5.4 (직교 카메라 좌표계 수리 및 마스터 UI 정밀 매프 바인딩 완결판)
 * - 붉은 사각형 오류 원인이던 uTextScale 연산을 직교 뷰포트형 screenUv 파이프라인으로 전면 전개 수리
 * - Shuffle(파도 모양 뒤섞기), Range(가로 범위), Scale(폰트 크기), Volume(포말 쪼개짐 강도), Gauge(수동 수위) 완벽 링킹
 * - init() 시점에 우측 UI 조작 파라미터들의 초기화 기본 수치 콘솔 테이블 출력 완비
 * - update() 루프 주기마다 현재 실시간 파도 수위 상태 및 SRT 자막 싱크 상황 모니터링 콘솔 로깅 지원
 */

export default class ThreeMediaArtWall {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.bgPlane = null;
    this.wavePlane = null;
    this.textCanvas = null;
    this.textTexture = null;
    this.textPlane = null;

    this.currentImageEl = null;
    this.baseTexture = null;

    this.currentWidth = 0;
    this.currentHeight = 0;
    this.lastLogTime = 0;
    this.version = "009호 자연 유체 해변 스튜디오 Ver 5.4";
  }

  init() {
    this.currentWidth = this.container.clientWidth;
    this.currentHeight = this.container.clientHeight;

    this.scene = new THREE.Scene();

    // 💡 화면 고정용 정면 직교 카메라 정렬 시공
    this.camera = new THREE.OrthographicCamera(-this.currentWidth / 2, this.currentWidth / 2, this.currentHeight / 2, -this.currentHeight / 2, 0.1, 1000);
    this.camera.position.z = 15;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.renderer.setClearColor(0x000000);
    this.container.appendChild(this.renderer.domElement);

    // 자막 해상도 버퍼를 뷰포트 축과 동기화하여 글자 잘림 방지
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 1024;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.minFilter = THREE.LinearFilter;

    const initialUI = this.getUIParams();
    console.log(`%c[🚀 009호 부팅 완료] 시스템 로드 기본 세팅 수치 리포트`, "color: #00ffcc; font-weight: bold; font-size: 11px;");
    console.table({
      "Shuffle (기본 시드)": initialUI.seed,
      "Range (파도 가로폭)": initialUI.scatter,
      "Scale (폰트 기본 크기)": initialUI.glow,
      "Volume (포말 쪼개짐 강도)": initialUI.gain,
      "3D Position Offset X": initialUI.offX,
      "3D Position Offset Y": initialUI.offY,
      "3D Position Offset Z": initialUI.offZ,
      "Manual Gauge 제어값": initialUI.gauge,
      "Color Style 팔레트": initialUI.color
    });

    this.buildStaticBackground();
    this.buildFluidWaveSystem();
    this.buildTextLayer();
  }

  getUIParams() {
    let ui = { seed: 42, scatter: 22, color: 'neon', glow: 85, gain: 100, gas1: '#00ffcc', gas2: '#ffffff', offX: 0, offY: 0, offZ: 0, gauge: 0.5 };
    if (window.cosmicEngineSettings) {
      const g = window.cosmicEngineSettings;
      ui.seed = g.seed ?? 42;
      ui.scatter = (g.scatterExponent ?? 2.2) * 10;
      ui.color = g.colorStyle ?? 'neon';
      ui.glow = (g.glowIntensity ?? 0.85) * 100;
      ui.gain = (g.audioGain ?? 1.0) * 100;
      ui.gas1 = g.customColors?.gas1 ?? '#ff0055'; // 회원님 픽커 컬러 수혈 기본값
      ui.gas2 = g.customColors?.gas2 ?? '#00ffcc';
      ui.offX = g.positionOffset?.x ?? 0;
      ui.offY = g.positionOffset?.y ?? 0;
      ui.offZ = g.positionOffset?.z ?? 0;
      ui.gauge = g.gaugeValue ?? 0.5;
    }
    return ui;
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d2b48c'; 
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    return new THREE.CanvasTexture(canvas);
  }

  buildStaticBackground() {
    this.currentImageEl = window.currentUploadedImageElement || null;
    if (this.currentImageEl) {
      this.baseTexture = new THREE.Texture(this.currentImageEl);
      this.baseTexture.needsUpdate = true;
    } else {
      this.baseTexture = this.createFallbackTexture();
    }

    const geo = new THREE.PlaneGeometry(this.currentWidth, this.currentHeight);
    const mat = new THREE.MeshBasicMaterial({ map: this.baseTexture });
    this.bgPlane = new THREE.Mesh(geo, mat);
    this.bgPlane.position.set(0, 0, -2);
    this.scene.add(this.bgPlane);
  }

  buildFluidWaveSystem() {
    const geo = new THREE.PlaneGeometry(this.currentWidth, this.currentHeight);
    
    this.waveMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_gauge: { value: 0.5 }, 
        u_shuffle: { value: 42 },
        u_range: { value: 2.2 },
        u_volume: { value: 1.0 },
        u_colorGas1: { value: new THREE.Color('#ff0055') }, 
        u_colorGas2: { value: new THREE.Color('#00ffcc') }  
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform float u_gauge;
        uniform float u_shuffle;
        uniform float u_range;
        uniform float u_volume;
        uniform vec3 u_colorGas1;
        uniform vec3 u_colorGas2;
        varying vec2 vUv;

        vec2 hash(vec2 p) {
          p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
          return -1.0 + 2.0*fract(sin(p)*43758.5453123 + u_shuffle);
        }
        float noise(vec2 p) {
          const float K1 = 0.366025404; const float K2 = 0.211324865;
          vec2 i = floor(p + (p.x+p.y)*K1); vec2 a = p - i + (i.x+i.y)*K2;
          vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
          vec2 b = a - o + K2; vec2 c = a - 1.0 + 2.0*K2;
          vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
          vec3 n = h*h*h*h*vec3(dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
          return dot(n, vec3(70.0));
        }

        void main() {
          // 💡 [Range 제어 바인딩] 파도의 가로 파동 스펙트럼 밀도 가변 분기
          vec2 uvNoise = vUv * vec2(u_range * 2.0, 5.0);
          uvNoise.y -= u_time * 0.3;

          // [Volume 제어 바인딩] 파도 끝단 포말이 쪼개지는 자글자글한 디테일 노이즈 강도 결합
          float n = noise(uvNoise * 4.0) * 0.08 * u_volume;
          n += noise(uvNoise * 12.0) * 0.03 * (u_volume * 0.6);

          // Gauge 연동 물리 한계선
          float waveLine = u_gauge + n;
          
          float f = smoothstep(waveLine - 0.03, waveLine, vUv.y);
          float foam = smoothstep(waveLine - 0.005, waveLine, vUv.y) * (1.0 - smoothstep(waveLine, waveLine + 0.02, vUv.y));

          // 최종 유체 컬러 조합
          vec3 waveColor = mix(u_colorGas1, u_colorGas2, vUv.y);
          waveColor = mix(waveColor, vec3(1.0), foam * 0.8); // 하얀 거품층 가산 혼합

          // 💥 사각형 박스 오류 원천 제거: 디스카드 조건식을 직교 Uv 축 경계에 맞춰 무결점 컷팅
          if (vUv.y > waveLine + 0.02) {
             discard;
          }

          gl_FragColor = vec4(waveColor, (1.0 - f) * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.wavePlane = new THREE.Mesh(geo, this.waveMaterial);
    this.wavePlane.position.set(0, 0, 1); 
    this.scene.add(this.wavePlane);
  }

  buildTextLayer() {
    const geo = new THREE.PlaneGeometry(this.currentWidth, this.currentHeight);
    const mat = new THREE.MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    this.textPlane = new THREE.Mesh(geo, mat);
    this.textPlane.position.set(0, 0, 0.5); // 자막 배치 레이어 정돈
    this.scene.add(this.textPlane);
  }

  /**
   * 💡 [Scale 폰트 크기 가인] 자동 동기화 네온 크로스 드로잉 엔진
   */
  drawSubtitleToCanvas(text, fontSizeStyle) {
    const ctx = this.textCanvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 1024);

    if (!text) {
      this.textTexture.needsUpdate = true;
      return;
    }

    ctx.save();
    ctx.font = `bold ${fontSizeStyle}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 쨍하고 깊은 광량의 Additive 네온 글로우 드로잉 레이어 시공
    ctx.shadowColor = 'rgba(0, 255, 204, 0.95)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = 'rgba(0, 255, 204, 0.8)';

    const maxWidth = 900;
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const lineHeight = fontSizeStyle * 1.4;
    // 화면 중앙 기준 하단 65% 지점(모래사장 바닥면 감각)에 정밀 영동
    const startY = 680 - ((lines.length - 1) * lineHeight) / 2;

    for (let k = 0; k < lines.length; k++) {
        // 1단 네온 섀도 베이스
        ctx.shadowColor = 'rgba(0, 255, 204, 0.9)';
        ctx.shadowBlur = 25;
        ctx.fillText(lines[k], 512, startY + k * lineHeight);
        
        // 2단 네온사인의 하얀 심지(Core) 수직 중첩 렌더링
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(lines[k], 512, startY + k * lineHeight);
    }

    ctx.restore();
    this.textTexture.needsUpdate = true;
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (this.currentImageEl !== window.currentUploadedImageElement) {
      this.currentImageEl = window.currentUploadedImageElement;
      if (this.currentImageEl) {
        this.baseTexture = new THREE.Texture(this.currentImageEl);
        this.baseTexture.needsUpdate = true;
        this.bgPlane.material.map = this.baseTexture;
      }
    }

    const ui = this.getUIParams();

    // 💡 [3D Position Offset X, Y, Z] 실시간 가변축 오프셋 반영 투사
    this.camera.position.set(ui.offX, ui.offY, 15 + ui.offZ);

    this.waveMaterial.uniforms.u_colorGas1.value.set(ui.gas1);
    this.waveMaterial.uniforms.u_colorGas2.value.set(ui.gas2);
    this.waveMaterial.uniforms.u_shuffle.value = ui.seed;
    this.waveMaterial.uniforms.u_range.value = ui.scatter / 10;
    this.waveMaterial.uniforms.u_volume.value = ui.gain / 100;

    const time = Date.now() * 0.002;
    this.waveMaterial.uniforms.u_time.value = time;

    let calculatedGauge = 0.3; 
    let activeText = "";
    let srtStatusMessage = "대기 상태";

    const audioEl = document.querySelector('audio');
    if (audioEl && window.parsedSubtitles && window.parsedSubtitles.length > 0) {
      const curTime = audioEl.currentTime;
      
      const nextSub = window.parsedSubtitles.find(sub => sub.start > curTime && sub.start - curTime <= 0.8);
      const currentSub = window.parsedSubtitles.find(sub => curTime >= sub.start && curTime <= sub.end);

      if (nextSub) {
        let timeGap = nextSub.start - curTime; 
        let progress = 1.0 - (timeGap / 0.8);  
        calculatedGauge = THREE.MathUtils.lerp(0.3, 0.95, Math.pow(progress, 2.0));
        srtStatusMessage = `⏳ 자막 전조 발생 (출현 ${timeGap.toFixed(2)}초 전 파도 밀려옴)`;
      } 
      else if (currentSub) {
        activeText = currentSub.text;
        let activeProgress = (curTime - currentSub.start) / (currentSub.end - currentSub.start);
        calculatedGauge = THREE.MathUtils.lerp(0.95, 0.45, Math.min(1.0, activeProgress * 3.5));
        srtStatusMessage = `▶️ 자막 노출 파도 철수: [${activeText}]`;
      } else {
        calculatedGauge = 0.3;
        srtStatusMessage = "🎵 음악 공백 대기 구간 (평온한 수위)";
      }
    } else {
      // 💡 음악 미재생 시 [Gauge] 입력 칸 숫자로 100% 매뉴얼 제어권 락인
      calculatedGauge = ui.gauge;
      activeText = window.currentSubtitleText || "자연 유체 스튜디오 v0.010\n(빛나는 네온 효과 완성)";
      srtStatusMessage = "⏸️ 정지 모드 (오른쪽 Gauge 수치 타이핑 실시간 테스트)";
    }

    const nowMs = Date.now();
    if (nowMs - this.lastLogTime > 500) {
      console.log(
        `%c[🌊 009호 실시간 스트리밍 모니터] %c수위(Gauge): ${(calculatedGauge * 100).toFixed(1)}% | 상태: ${srtStatusMessage}`,
        "color: #00ffcc; font-weight: bold;", "color: #ffffff;"
      );
      this.lastLogTime = nowMs;
    }

    // 💡 [Scale] 파라미터 연동 ➡️ 폰트 크기 스케일 정밀 가인 결합
    const targetFontSize = THREE.MathUtils.mapLinear(ui.glow, 10, 250, 30, 85);
    this.drawSubtitleToCanvas(activeText, targetFontSize);

    let audioVol = audioData ? (audioData.vol || audioData.volume || 0.0) : 0.0;
    this.waveMaterial.uniforms.u_gauge.value = calculatedGauge + (audioVol * 0.05);

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.currentWidth = w;
      this.currentHeight = h;
      
      this.camera.left = -w / 2;
      this.camera.right = w / 2;
      this.camera.top = h / 2;
      this.camera.bottom = -h / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);

      if (this.bgPlane) { this.bgPlane.geometry.dispose(); this.bgPlane.geometry = new THREE.PlaneGeometry(w, h); }
      if (this.wavePlane) { this.wavePlane.geometry.dispose(); this.wavePlane.geometry = new THREE.PlaneGeometry(w, h); }
      if (this.textPlane) { this.textPlane.geometry.dispose(); this.textPlane.geometry = new THREE.PlaneGeometry(w, h); }
    }
  }

  destroy() {
    if (!this.scene) return;
    if (this.bgPlane) { this.bgPlane.geometry.dispose(); this.bgPlane.material.dispose(); }
    if (this.wavePlane) { this.wavePlane.geometry.dispose(); this.wavePlane.material.dispose(); }
    if (this.textPlane) { this.textPlane.geometry.dispose(); this.textPlane.material.dispose(); }
    if (this.textTexture) this.textTexture.dispose();
    if (this.renderer) { this.container.removeChild(this.renderer.domElement); this.renderer.dispose(); }
    this.scene = null; this.camera = null; this.renderer = null;
  }
}
