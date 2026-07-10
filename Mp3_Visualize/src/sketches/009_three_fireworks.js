/**
 * src/sketches/009_three_fireworks.js
 * - [버전] Ver 5.3 (프레그먼트 셰이더 uvUnoise 타이핑 오타 완치 및 렌더링 정상화 완결판)
 * - uvUnoise 에러를 uvNoise 변수명으로 정밀 교정하여 GPU 컴파일러 에러 100% 완치
 * - 자막 출현 0.8초 전 파도가 솟구쳐 화면을 가린 뒤, 내려가면서 모래사장에 자막을 표출하는 해안선 연출 복구
 * - init() 시점에 UI에서 조정한 값들의 초기화 기본 수치 콘솔 테이블 출력 유지
 * - update() 주기마다 현재 수위(Gauge) 상태 및 SRT 싱크로율을 0.5초 주기로 정갈하게 콘솔 로깅 지원
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

    this.viewWidth = 0;
    this.viewHeight = 0;
    this.lastLogTime = 0;
    this.version = "009호 자연 유체 해변 스튜디오 Ver 5.3";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000);
    this.container.appendChild(this.renderer.domElement);

    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 512;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);

    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2;
    const viewWidth = viewHeight * this.camera.aspect;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;

    const initialUI = this.getUIParams();
    console.log(`%c[🚀 009호 초기화 가동] 시스템 로드 및 기본 셋업 수치 브리핑`, "color: #00ffcc; font-weight: bold; font-size: 11px;");
    console.table({
      "Shuffle (기본 시드)": initialUI.seed,
      "Range (파도 가로폭)": initialUI.scatter,
      "Scale (폰트 광량배율)": initialUI.glow,
      "Volume (포말 증폭도)": initialUI.gain,
      "Position Offset X": initialUI.offX,
      "Position Offset Y": initialUI.offY,
      "Position Offset Z": initialUI.offZ,
      "Manual Gauge 수치": initialUI.gauge,
      "Color Style 모드": initialUI.color
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
      ui.gas1 = g.customColors?.gas1 ?? '#00ffcc';
      ui.gas2 = g.customColors?.gas2 ?? '#ffffff';
      ui.offX = g.positionOffset?.x ?? 0;
      ui.offY = g.positionOffset?.y ?? 0;
      ui.offZ = g.positionOffset?.z ?? 0;
      ui.gauge = g.gaugeValue ?? 0.5;
    }
    return ui;
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d2b48c'; 
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
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

    const geo = new THREE.PlaneGeometry(this.viewWidth, this.viewHeight);
    const mat = new THREE.MeshBasicMaterial({ map: this.baseTexture });
    this.bgPlane = new THREE.Mesh(geo, mat);
    this.bgPlane.position.set(0, 0, -2);
    this.scene.add(this.bgPlane);
  }

  buildFluidWaveSystem() {
    const geo = new THREE.PlaneGeometry(this.viewWidth, this.viewHeight, 64, 64);
    
    this.waveMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_gauge: { value: 0.3 }, 
        u_shuffle: { value: 42 },
        u_range: { value: 2.2 },
        u_volume: { value: 1.0 },
        u_colorGas1: { value: new THREE.Color('#00ffcc') }, 
        u_colorGas2: { value: new THREE.Color('#ffffff') }  
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

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123 + u_shuffle);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }

        void main() {
          vec2 uvNoise = vUv * vec2(u_range * 1.5, 3.5);
          uvNoise.y -= u_time * 0.4;

          // 💡 [오타 수리 완료] uvUnoise 오타를 uvNoise로 완벽하게 복구했습니다.
          float n = noise(uvNoise) * 0.12 * u_volume;
          n += noise(uvNoise * 2.0) * 0.04 * (u_volume * 0.5);

          float waveLine = (u_gauge * 1.1 - 0.1) + n;
          
          float f = smoothstep(waveLine - 0.04, waveLine, vUv.y);
          float foam = smoothstep(waveLine, waveLine + 0.02, vUv.y) * (1.0 - smoothstep(waveLine + 0.02, waveLine + 0.05, vUv.y));

          vec3 baseFluidColor = mix(u_colorGas1, u_colorGas2, foam * 0.7);

          float alpha = 1.0 - f;
          if (vUv.y > waveLine + 0.04) {
              alpha = 0.0;
          }
          
          gl_FragColor = vec4(baseFluidColor, alpha * 0.95);
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
    const geo = new THREE.PlaneGeometry(this.viewWidth * 0.9, this.viewHeight * 0.45);
    const mat = new THREE.MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    this.textPlane = new THREE.Mesh(geo, mat);
    this.textPlane.position.set(0, -1.8, 0.5); 
    this.scene.add(this.textPlane);
  }

  drawSubtitleToCanvas(text, fontSizeStyle) {
    const ctx = this.textCanvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 512);

    if (!text) {
      this.textTexture.needsUpdate = true;
      return;
    }

    ctx.save();
    ctx.font = `bold ${fontSizeStyle}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0, 255, 204, 0.95)';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffffff';

    const maxWidth = 940;
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

    const lineHeight = fontSizeStyle * 1.35;
    const startY = 256 - ((lines.length - 1) * lineHeight) / 2;

    for (let k = 0; k < lines.length; k++) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 5;
        ctx.fillText(lines[k], 512, startY + k * lineHeight);
        
        ctx.shadowColor = 'rgba(0, 255, 204, 0.95)';
        ctx.shadowBlur = 20;
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

    this.camera.position.set(ui.offX, ui.offY, 15 + ui.offZ);

    this.waveMaterial.uniforms.u_colorGas1.value.set(ui.gas1);
    this.waveMaterial.uniforms.u_colorGas2.value.set(ui.gas2);
    this.waveMaterial.uniforms.u_shuffle.value = ui.seed;
    this.waveMaterial.uniforms.u_range.value = ui.scatter / 10;
    this.waveMaterial.uniforms.u_volume.value = ui.gain / 100;

    const time = Date.now() * 0.002;
    this.waveMaterial.uniforms.u_time.value = time;

    let calculatedGauge = 0.28; 
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
        calculatedGauge = THREE.MathUtils.lerp(0.28, 1.05, Math.pow(progress, 2.0));
        srtStatusMessage = `⏳ 자막 전조 발생 (출현 ${timeGap.toFixed(2)}초 전 파도 전진)`;
      } 
      else if (currentSub) {
        activeText = currentSub.text;
        let activeProgress = (curTime - currentSub.start) / (currentSub.end - currentSub.start);
        calculatedGauge = THREE.MathUtils.lerp(1.05, 0.42, Math.min(1.0, activeProgress * 4.0));
        srtStatusMessage = `▶️ 자막 렌더링 중: [${activeText}]`;
      } else {
        calculatedGauge = 0.28;
        srtStatusMessage = "🎵 음악 재생 중 (공백 구간 잔잔한 파도)";
      }
    } else {
      calculatedGauge = ui.gauge;
      activeText = window.currentSubtitleText || "";
      srtStatusMessage = "⏸️ 정지 모드 (오른쪽 Gauge 수치 수동 제어 모드)";
    }

    const nowMs = Date.now();
    if (nowMs - this.lastLogTime > 500) {
      console.log(
        `%c[🌊 009호 실시간 스트리밍 모니터] %c수위(Gauge): ${(calculatedGauge * 100).toFixed(1)}% | 상태: ${srtStatusMessage}`,
        "color: #00ffcc; font-weight: bold;", "color: #ffffff;"
      );
      this.lastLogTime = nowMs;
    }

    const targetFontSize = THREE.MathUtils.mapLinear(ui.glow, 10, 250, 24, 76);
    this.drawSubtitleToCanvas(activeText, targetFontSize);

    let audioVol = audioData ? (audioData.vol || audioData.volume || 0.0) : 0.0;
    this.waveMaterial.uniforms.u_gauge.value = calculatedGauge + (audioVol * 0.06);

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);

      const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2;
      const viewWidth = viewHeight * this.camera.aspect;
      this.viewWidth = viewWidth;
      this.viewHeight = viewHeight;

      if (this.bgPlane) { this.bgPlane.geometry.dispose(); this.bgPlane.geometry = new THREE.PlaneGeometry(viewWidth, viewHeight); }
      if (this.wavePlane) { this.wavePlane.geometry.dispose(); this.wavePlane.geometry = new THREE.PlaneGeometry(viewWidth, viewHeight); }
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
