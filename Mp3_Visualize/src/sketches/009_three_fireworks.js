/**
 * src/sketches/009_three_fireworks.js
 * - [버전] Ver 5.6 (상시 호흡 파도 및 젖은 모래 불규칙 건조 레이어 완결판)
 * - 셰이더 내부의 오타를 완벽히 수리하여 화면 블랙아웃(암전) 현상 100% 해결
 * - Shuffle(0~360도 방향 각도), Range(가로 진폭 범위), Scale(폰트 크기), Volume(포말 쪼개짐), Gauge(수동 제어) 유기적 연동 고정
 * - 파도가 물러간 자리에 노이즈 밀도별로 물이 불규칙하게 남고 다르게 건조되는 Wet Sand 이펙트 탑재
 * - 아무런 오디오 피드백이 없어도 해안선이 상시 숨쉬듯 밀려왔다 밀려가는 물리 애니메이션 구현
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
    this.version = "009호 상시 호흡 유체 스튜디오 Ver 5.6";
  }

  init() {
    this.currentWidth = this.container.clientWidth;
    this.currentHeight = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-this.currentWidth / 2, this.currentWidth / 2, this.currentHeight / 2, -this.currentHeight / 2, 0.1, 1000);
    this.camera.position.z = 15;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.renderer.setClearColor(0x000000);
    this.container.appendChild(this.renderer.domElement);

    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 1024;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.minFilter = THREE.LinearFilter;

    const initialUI = this.getUIParams();
    console.log(`%c[🚀 009호 리얼 유체 부팅] 시스템 초기화 및 기본 파라미터 매핑 브리핑`, "color: #00ffcc; font-weight: bold; font-size: 11px;");
    console.table({
      "Shuffle Angle (파도 방향 각도)": `${initialUI.seed}°`,
      "Range (파도 가로폭 밀도)": initialUI.scatter,
      "Scale (자막 폰트 기본 크기)": initialUI.glow,
      "Volume (포말 쪼개짐 디테일)": initialUI.gain,
      "3D Position Offset X": initialUI.offX,
      "3D Position Offset Y": initialUI.offY,
      "3D Position Offset Z": initialUI.offZ,
      "Manual Gauge 제어값": initialUI.gauge,
      "Color Style 팔레트 모드": initialUI.color
    });

    this.buildStaticBackground();
    this.buildFluidWaveSystem();
    this.buildTextLayer();
  }

  getUIParams() {
    let ui = { seed: 180, scatter: 22, color: 'neon', glow: 85, gain: 100, gas1: '#00ffcc', gas2: '#ffffff', offX: 0, offY: 0, offZ: 0, gauge: 0.5 };
    if (window.cosmicEngineSettings) {
      const g = window.cosmicEngineSettings;
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
        u_shuffleAngle: { value: 180.0 }, 
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
          // 💡 Shuffle 수치를 라디안 각도로 맵핑 회전
          float rad = radians(u_shuffleAngle);
          float cosA = cos(rad); float sinA = sin(rad);
          mat2 rotationMatrix = mat2(cosA, -sinA, sinA, cosA);

          vec2 rotatedUv = rotationMatrix * (vUv - 0.5) + 0.5;

          // Range 연동 가로 폭 스케일 제어
          vec2 noiseUv = rotatedUv * vec2(u_range * 1.6, 4.5);
          
          // 💡 [상시 호흡 애니메이션] 가만히 있어도 상시 파도가 전진/후퇴하도록 물결 수식 중첩
          float constantBreathing = sin(u_time * 1.4) * 0.04 + cos(u_time * 0.6) * 0.015;

          // Volume 연동 포말 쪼개짐 디테일 노이즈
          float n = noise(noiseUv * 3.5 + vec2(u_time * 0.3, 0.0)) * 0.08 * u_volume;
          n += noise(noiseUv * 9.0 - vec2(u_time * 0.1, u_time * 0.2)) * 0.03 * (u_volume * 0.5);

          float safetyGauge = clamp(u_gauge, 0.02, 0.98);
          
          // 실시간 파도 선 위치 (상시 호흡 스케일 탑재)
          float waveLine = (safetyGauge * 1.04 - 0.02) + constantBreathing + n;
          
          // 💡 [하이퍼 리얼리즘: 젖은 모래 자국 및 불규칙 건조 흔적 레이어]
          // 파도가 빠질 때 물이 지연되어 남고 다르게 마르는 임계 가변 마진 역산
          float wetNoise = noise(noiseUv * 1.5 - vec2(0.0, u_time * 0.05));
          float wetLine = waveLine + (0.07 * clamp(sin(u_time * 0.7), 0.0, 1.0) * wetNoise);

          float f = smoothstep(waveLine - 0.03, waveLine, rotatedUv.y);
          float foam = smoothstep(waveLine - 0.006, waveLine, rotatedUv.y) * (1.0 - smoothstep(waveLine, waveLine + 0.015, rotatedUv.y));

          // 기본 유체 베이스 배색
          vec3 waveColor = mix(u_colorGas1, u_colorGas2, rotatedUv.y);
          waveColor = mix(waveColor, vec3(1.0), foam * 0.85); 

          // 💡 [건조 자국 알파 투영 감쇄] 젖은 흔적이 서서히 도려내지며 불규칙 소멸하는 마스크 연산
          float alpha = 1.0 - f;
          
          // 젖은 모래 구역 색상 어둡게 컴파일 버퍼 주입
          if (rotatedUv.y > waveLine && rotatedUv.y <= wetLine) {
             alpha = vec4(0.0, 0.0, 0.0, 0.35).a * (1.0 - smoothstep(waveLine, wetLine, rotatedUv.y)) * wetNoise;
             // 젖은 모래는 어두운 감쇠 효과 연출
             gl_FragColor = vec4(u_colorGas1 * 0.38, alpha);
             return;
          }

          if (rotatedUv.y > wetLine) {
             alpha = 0.0;
          }
          
          gl_FragColor = vec4(waveColor, alpha * 0.93);
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
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    ctx.shadowColor = 'rgba(0, 255, 204, 0.95)';
    ctx.shadowBlur = 28;
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

    const lineHeight = fontSizeStyle * 1.38;
    const startY = 700 - ((lines.length - 1) * lineHeight) / 2;

    for (let k = 0; k < lines.length; k++) {
        ctx.shadowColor = 'rgba(0, 255, 204, 0.9)';
        ctx.shadowBlur = 22;
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
        srtStatusMessage = "🎵 음악 공백 구간 (상시 잔잔한 호흡 모드)";
      }
    } else {
      calculatedGauge = ui.gauge;
      activeText = window.currentSubtitleText || "자연 유체 스튜디오 v0.010\n(빛나는 네온 효과 완성)";
      srtStatusMessage = "⏸️ 정지 모드 (오른쪽 Gauge 수치 수동 테스트)";
    }

    const nowMs = Date.now();
    if (nowMs - this.lastLogTime > 500) {
      console.log(
        `%c[🌊 009호 스트리밍 모니터] %c수위(Gauge): ${(calculatedGauge * 100).toFixed(1)}% | 파도 각도: ${ui.seed}° | 상태: ${srtStatusMessage}`,
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
