/**
 * src/sketches/009_three_fireworks.js
 * - [버전] Ver 5.5 (Shuffle 0~360도 각도 변환 및 반대편 화면 끝 이탈 방지 완결판)
 * - Shuffle 파라미터를 0~360도 공간 회전 각도로 다이렉트 매핑하여 파도가 해당 각도 방향으로 치도록 대수술
 * - 회전 벡터 기반의 수위 한계 클램핑 공식을 주입하여 파도 끝단이 각도 정반대편 화면 경계선을 탈출하지 않도록 방어
 * - Range(가로 범위), Scale(폰트 크기), Volume(포말 쪼개짐 강도), Gauge(실시간 수위 제어) 유기적 링크 고정
 * - init() 시점의 초기화 기본 수치 리포트 및 update() 루프 주기별 콘솔 디버그 로그 시스템 유지
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
    this.version = "009호 자연 유체 해변 스튜디오 Ver 5.5";
  }

  init() {
    this.currentWidth = this.container.clientWidth;
    this.currentHeight = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-this.currentWidth / 2, this.currentWidth / 2, this.currentHeight / 2, -this.currentHeight / 2, 0.1, 1000);
    this.camera.position.z = 15;

    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 1024;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.minFilter = THREE.LinearFilter;

    const initialUI = this.getUIParams();
    console.log(`%c[🚀 009호 셋업 완료] Shuffle 각도 및 경계선 락 파라미터 브리핑`, "color: #00ffcc; font-weight: bold; font-size: 11px;");
    console.table({
      "Shuffle Angle (파도 각도)": `${initialUI.seed}°`,
      "Range (파도 진폭 범위)": initialUI.scatter,
      "Scale (자막 폰트 크기)": initialUI.glow,
      "Volume (포말 디테일 강도)": initialUI.gain,
      "3D Position Offset X": initialUI.offX,
      "3D Position Offset Y": initialUI.offY,
      "3D Position Offset Z": initialUI.offZ,
      "Manual Gauge 제어값": initialUI.gauge,
      "Color Style 모드": initialUI.color
    });

    this.buildStaticBackground();
    this.buildFluidWaveSystem();
    this.buildTextLayer();
  }

  getUIParams() {
    let ui = { seed: 180, scatter: 22, color: 'neon', glow: 85, gain: 100, gas1: '#00ffcc', gas2: '#ffffff', offX: 0, offY: 0, offZ: 0, gauge: 0.5 };
    if (window.cosmicEngineSettings) {
      const g = window.cosmicEngineSettings;
      // Shuffle 수치를 0~360도 각도로 가변 고정
      ui.seed = THREE.MathUtils.clamp(g.seed ?? 180, 0, 360);
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
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d2b48c'; 
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
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
        u_shuffleAngle: { value: 180.0 }, // Shuffle 수치가 각도로 변환되어 주입됨
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
        uniform float u_shuffleAngle;
        uniform float u_range;
        uniform float u_volume;
        uniform vec3 u_colorGas1;
        uniform vec3 u_colorGas2;
        varying vec2 vUv;

        vec2 hash(vec2 p) {
          p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
          return -1.0 + 2.0*fract(sin(p)*43758.5453123);
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
          // 💡 [Shuffle 방향 각도 변환 이식] 2D 회전 매트릭스 가동
          float rad = radians(u_shuffleAngle);
          float cosA = cos(rad); float sinA = sin(rad);
          mat2 rotationMatrix = mat2(cosA, -sinA, sinA, cosA);

          // 화면 중심 기준으로 UV 회전 전개
          vec2 rotatedUv = rotationMatrix * (vUv - 0.5) + 0.5;

          // Range 가 적용된 가로축 물결 밀도 벡터
          vec2 noiseUv = rotatedUv * vec2(u_range * 1.5, 4.0);
          noiseUv.x += u_time * 0.2;

          // Volume 기반 포말 쪼개짐 노이즈 가중치
          float n = noise(noiseUv * 3.5) * 0.09 * u_volume;
          n += noise(noiseUv * 10.0) * 0.03 * (u_volume * 0.5);

          // 💡 [반대편 화면 끝 탈출 방지 알고리즘]
          // 파도 수위선이 회전 각도에 의해 화면 외부 경계선을 뚫고 증발하지 않도록 안전 마진 하드웨어 클램핑 락
          float safetyGauge = clamp(u_gauge, 0.03, 0.97);
          float waveLine = (safetyGauge * 1.05 - 0.025) + n;
          
          float f = smoothstep(waveLine - 0.03, waveLine, rotatedUv.y);
          float foam = smoothstep(waveLine - 0.005, waveLine, rotatedUv.y) * (1.0 - smoothstep(waveLine, waveLine + 0.02, rotatedUv.y));

          vec3 waveColor = mix(u_colorGas1, u_colorGas2, rotatedUv.y);
          waveColor = mix(waveColor, vec3(1.0), foam * 0.8); 

          float alpha = 1.0 - f;
          if (rotatedUv.y > waveLine + 0.02) {
             alpha = 0.0;
          }
          
          gl_FragColor = vec4(waveColor, alpha * 0.95);
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
    this.textPlane.position.set(0, 0, 0.5); 
    this.scene.add(this.textPlane);
  }

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
    const startY = 720 - ((lines.length - 1) * lineHeight) / 2; // 모래사장 하단 정밀 영동 위치

    for (let k = 0; k < lines.length; k++) {
        ctx.shadowColor = 'rgba(0, 255, 204, 0.9)';
        ctx.shadowBlur = 25;
        ctx.fillText(lines[k], 512, startY + k * lineHeight);
        
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

    this.camera.position.set(ui.offX, ui.offY, 15 + ui.offZ);

    this.waveMaterial.uniforms.u_colorGas1.value.set(ui.gas1);
    this.waveMaterial.uniforms.u_colorGas2.value.set(ui.gas2);
    
    // 💡 Shuffle 값을 파도의 회전 각도(0~360) 유니폼으로 직통 링크
    this.waveMaterial.uniforms.u_shuffleAngle.value = ui.seed;
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
        srtStatusMessage = "🎵 음악 공백 구간";
      }
    } else {
      calculatedGauge = ui.gauge;
      activeText = window.currentSubtitleText || "자연 유체 스튜디오 v0.010\n(빛나는 네온 효과 완성)";
      srtStatusMessage = "⏸️ 정지 모드 (오른쪽 Gauge 수치 타이핑 제어)";
    }

    const nowMs = Date.now();
    if (nowMs - this.lastLogTime > 500) {
      console.log(
        `%c[🌊 009호 실시간 스트리밍 모니터] %c수위(Gauge): ${(calculatedGauge * 100).toFixed(1)}% | 방향 각도(Shuffle): ${ui.seed}° | 상태: ${srtStatusMessage}`,
        "color: #00ffcc; font-weight: bold;", "color: #ffffff;"
      );
      this.lastLogTime = nowMs;
    }

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
