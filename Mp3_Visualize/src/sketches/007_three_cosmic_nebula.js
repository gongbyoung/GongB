/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [버전] Ver 3.1 (관제탑 기능 정의 일치 및 하얗게 타는 현상 완전 치유판)
 * - Shuffle(모양 랜덤), Range(입자 크기 편차), Scale(전체 스케일), Volume(Glow수), Gauge(입자 수) 완벽 매립
 * - Gauge 0 수치 시 입자 수를 최소화하고, 가산 혼합 임계점을 낮춰 화이트 포화 현상 완치
 * - Color Style Palette (No1 ~ No5) 아날로그 파스텔 테마 직결 연동 완수
 */

export default class ThreeRealNebula {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null; 
    
    // 💡 최대 입자 가용 풀 설정
    this.maxParticles = 30000;
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.particleData = [];

    this.loadedSeed = -1;
    this.loadedScatter = -1;
    this.loadedColorStyle = '';
    this.loadedGauge = -1;
    
    this.smoothChannels = new Float32Array(32);
    this.cameraTime = 0;
    this.version = "007호 Resonant Nebula Ver 3.1";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060914, 0.012);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 2, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x060914);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x222535, 1.5));

    this.buildOnScreenGuideUI();
    this.buildCosmos();
  }

  buildOnScreenGuideUI() {
    if (!this.container) return;
    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    
    Object.assign(this.guiOverlay.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '88%', maxWidth: '450px', backgroundColor: 'rgba(6, 9, 20, 0.95)',
      border: '1px solid rgba(0, 255, 204, 0.5)', borderRadius: '14px', padding: '24px',
      color: '#ffffff', fontFamily: 'sans-serif', zIndex: '9999', 
      boxShadow: '0 8px 30px rgba(0,0,0,0.75)', boxSizing: 'border-box', textAlign: 'center',
      display: 'block', opacity: '1', transition: 'opacity 0.5s ease-in-out'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
        🌌 STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 17px; margin: 0 0 16px 0; font-weight: 600;">
        007호 명상 스튜디오: 오로라 성운 사용설명서
      </h3>
      <div style="font-size: 13px; text-align: left; line-height: 1.8; color: #dddddd;">
        <p style="margin: 8px 0;">✨ <strong>[콘셉트]</strong> 은하수 가스와 부드러운 안개 입자들이 한 줄기 액체처럼 물결치며 수축·팽창하는 3D 유체 오로라 성운 무대입니다.</p>
        <p style="margin: 8px 0; border-top: 1px solid #222; padding-top: 8px; color: #00ffcc; font-weight: bold;">🛠️ 7대 관제탑 운영 방법:</p>
        <ul style="margin: 4px 0; padding-left: 18px; color: #bbb; font-size: 12.5px;">
          <li><strong>Shuffle :</strong> 성운 가스의 전체 배치 모양을 랜덤하게 새로 뿌림</li>
          <li><strong>Range :</strong> 입자의 크기(크고 작고) 다양성 편차 범위 지배</li>
          <li><strong>Scale :</strong> 성운 구조의 전체 입체 스케일 크기 조정</li>
          <li><strong>Volume :</strong> 입자들의 자체 발광 글로우(Glow) 수 및 민감도 증폭</li>
          <li><strong>Gauge :</strong> 화면에 투사되는 성운 가스 입자의 총 개수 조절 (0=초미세)</li>
          <li><strong>3D Offset :</strong> 가상 시네마 카메라 공간 시점 이동 (0,0,0=정면)</li>
          <li><strong>Color Style :</strong> No1~No5 명상 테마 아날로그 자연 오로라색 스위칭</li>
        </ul>
        <p style="margin: 12px 0 0 0; color: #ffcc00; text-align: center; font-weight: bold; font-size: 12px;">▶️ [하단 음악 파일] 재생 버튼을 누르면 이 설명서가 아련하게 소멸합니다.</p>
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  getUIParams() {
    const seedInput = document.getElementById('num-cosmic-seed');
    const scatterInput = document.getElementById('num-cosmic-scatter'); 
    const glowInput = document.getElementById('num-cosmic-glow');       
    const colorSelect = document.getElementById('select-cosmic-color');
    const gainInput = document.getElementById('num-cosmic-gain');
    const gaugeInput = document.getElementById('num-cosmic-gauge');

    const p1 = document.getElementById('picker-gas1');
    const p2 = document.getElementById('picker-gas2');
    const p3 = document.getElementById('picker-star');

    return {
      seed: seedInput ? parseInt(seedInput.value) : 1,
      scatter: scatterInput ? parseFloat(scatterInput.value) : 15, // Range (크고작은 범위)
      glow: glowInput ? parseFloat(glowInput.value) : 10,         // Scale (전체 크기)
      gain: gainInput ? parseFloat(gainInput.value) : 500,        // Volume (Glow 수)
      gauge: gaugeInput ? parseFloat(gaugeInput.value) : 0,       // Gauge (입자의 수)
      colorStyle: colorSelect ? colorSelect.value.toLowerCase() : 'neon',
      gas1Hex: (p1 && p1.value) ? p1.value : '#ff0055',
      gas2Hex: (p2 && p2.value) ? p2.value : '#00ffcc',
      starHex: (p3 && p3.value) ? p3.value : '#ffffff'
    };
  }

  // 💡 [대수술 구역] Shuffle(시드) 변경 및 Gauge(입자 수) 조작 시 가변 버퍼 재컴파일 격발
  buildCosmos() {
    const ui = this.getUIParams();

    this.loadedSeed = ui.seed;
    this.loadedScatter = ui.scatter;
    this.loadedColorStyle = ui.colorStyle;
    this.loadedGauge = ui.gauge;

    if (this.points) {
      this.scene.remove(this.points);
      this.geometry.dispose();
      this.points = null;
    }

    this.geometry = new THREE.BufferGeometry();
    
    // 💡 [Gauge 연동 - 입자의 수 조절]: 게이지가 0일 때는 최소 3,000개만 뿌려 완전히 하얗게 타는 현상을 분쇄!
    // 게이지가 100 최대치로 갈수록 최대 30,000개까지 입자가 풍성하게 충전 배치됩니다.
    this.activeParticleCount = THREE.MathUtils.mapLinear(ui.gauge, 0, 100, 3000, this.maxParticles);
    this.activeParticleCount = Math.floor(this.activeParticleCount);

    const positions = new Float32Array(this.activeParticleCount * 3);
    const colors = new Float32Array(this.activeParticleCount * 3);
    const sizes = new Float32Array(this.activeParticleCount);

    this.particleData = [];
    let sRandom = ui.seed; // 💡 [Shuffle 연동]: 시드 숫자에 따라 무작위 난수 형태학 시드 무대 격발

    let baseC1 = new THREE.Color(), baseC2 = new THREE.Color(), baseC3 = new THREE.Color();
    if (ui.colorStyle === 'monochrome') {
      baseC1.set('#234c38'); baseC2.set('#59bfa1'); baseC3.set('#ffffff');
    } else if (ui.colorStyle === 'neon') {
      baseC1.set('#ab8d6c'); baseC2.set('#fcf6e8'); baseC3.set('#ffffff');
    } else if (ui.colorStyle === 'pastel') {
      baseC1.set('#1e2a38'); baseC2.set('#f0bfa3'); baseC3.set('#ffffff');
    } else if (ui.colorStyle === 'custom') {
      baseC1.set(ui.gas1Hex); baseC2.set(ui.gas2Hex); baseC3.set(ui.starHex);
    } else {
      baseC1.setHSL(this.seededRandom(ui.seed + 15), 0.7, 0.55);
      baseC2.setHSL(this.seededRandom(ui.seed + 30), 0.6, 0.65);
      baseC3.setHex(0xffffff);
    }

    for (let i = 0; i < this.activeParticleCount; i++) {
      sRandom = this.seededRandom(sRandom) * 1000;
      const r1 = this.seededRandom(sRandom + 1);
      const r2 = this.seededRandom(sRandom + 2);
      const r3 = this.seededRandom(sRandom + 3);
      const r4 = this.seededRandom(sRandom + 4);

      const theta = r1 * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * r2 - 1.0);
      
      // 기저 베이스 성운 고리 구조 형성
      const baseDist = Math.pow(r3, 0.5) * 6.5;

      const x = baseDist * Math.sin(phi) * Math.cos(theta);
      const y = baseDist * Math.sin(phi) * Math.sin(theta) * 0.45;
      const z = baseDist * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 💡 [Range 연동 - 크고 작은 입자 범위 편차 세팅]
      // scatter(Range 수치)가 높을수록 큰 입자와 소립자의 격차 스케일 한계선이 극대화 확장됩니다.
      let sizeSpread = THREE.MathUtils.mapLinear(ui.scatter, 5, 50, 0.05, 0.55);
      let pSize = 0.06 + r1 * sizeSpread;
      
      let color = new THREE.Color();
      let starType = (r4 < 0.07) ? 'star' : 'gas';

      if (starType === 'star') {
        pSize = (0.2 + r1 * 0.4) * (ui.scatter / 15.0);
        color.copy(baseC3);
      } else {
        let lerpFactor = THREE.MathUtils.clamp(baseDist / 6.5, 0, 1);
        color.copy(baseC1).lerp(baseC2, lerpFactor);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      const randomForceMagnitude = 0.5 + r2 * 1.5;
      const randomAngle = r3 * Math.PI * 2;

      this.particleData.push({
        baseX: x, baseY: y, baseZ: z, 
        radius: baseDist, angle: theta,
        speed: (0.02 + r1 * 0.08) * randomForceMagnitude,
        type: starType,
        baseSize: pSize,
        randomPhase: r3 * Math.PI,
        originalColor: color.clone(),
        forceScale: randomForceMagnitude,
        dirX: Math.cos(randomAngle), dirY: (r1 - 0.5) * 2.0, dirZ: Math.sin(randomAngle)
      });
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('pSize', new THREE.BufferAttribute(sizes, 1));

    if (!this.material) {
      this.material = new THREE.PointsMaterial({
        size: 1.0,
        map: this.createGlowTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.4, 
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      this.material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          'void main() {',
          `attribute float pSize;
           void main() {`
        );
        shader.vertexShader = shader.vertexShader.replace(
          'gl_PointSize = size;',
          'gl_PointSize = size * pSize;'
        );
      };
    }

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera || !this.points) return;

    const ui = this.getUIParams();

    // 💡 [실시간 수치 적용 감지 인터페이스 엔진]
    // 사용자가 우측 관제탑에서 Shuffle(시드)이나 Gauge(입자수)를 바꾸는 순간 칼같이 구조 재조립 격발
    if (this.loadedSeed !== ui.seed || this.loadedGauge !== ui.gauge || this.loadedScatter !== ui.scatter || this.loadedColorStyle !== ui.colorStyle) {
      this.buildCosmos();
    }

    let offX = 0, offY = 0, offZ = 0;
    if (window.cosmicEngineSettings) {
      offX = window.cosmicEngineSettings.positionOffset?.x || 0;
      offY = window.cosmicEngineSettings.positionOffset?.y || 0;
      offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
    }

    const time = Date.now() * 0.0005;
    const positions = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.pSize.array;

    let rawBands = audioData ? (audioData.raw || audioData.spectrum || []) : [];
    let hasBands = rawBands.length > 20;

    // 💡 [Volume 연동 - GLOW 수 제어 파이프라인]
    // gain(Volume 수치) 기수가 높을수록 입자들의 자체 발광 빔 오퍼시티가 극대화 중첩 충전됩니다.
    // 게이지 수가 작아 충돌 화이트 아웃 현상이 제어되므로 가산 혼합 한계점을 부드럽게 연동
    let calculatedOpacity = THREE.MathUtils.mapLinear(ui.gain, 10, 500, 0.12, 0.85);
    this.material.opacity = THREE.MathUtils.lerp(this.material.opacity, calculatedOpacity, 0.12);

    // 💡 [Scale 연동 - 전체 스케일 정밀 결합]
    // glow(Scale 단락) 수치 범위(10~250)에 직결 매핑되어 성운 전체 구 지름 배율이 조절됩니다.
    let globalScale = THREE.MathUtils.mapLinear(ui.glow, 10, 250, 0.5, 3.8);
    this.points.scale.set(globalScale, globalScale, globalScale);

    let volume = audioData ? (audioData.vol || 0.1) : 0.1;
    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    if (this.guiOverlay) {
      if (isPlaying || volume > 0.06) {
        this.guiOverlay.style.opacity = '0';
        this.guiOverlay.style.pointerEvents = 'none';
      } else {
        this.guiOverlay.style.opacity = '1';
      }
    }

    for (let c = 0; c < 32; c++) {
      let bandPower = hasBands ? (rawBands[Math.floor((c / 32) * (rawBands.length - 1))] / 255.0) : 0.0;
      this.smoothChannels[c] += (bandPower - this.smoothChannels[c]) * 0.04;
    }

    for (let i = 0; i < this.activeParticleCount; i++) {
      const data = this.particleData[i];
      const channelIdx = i % 32;
      
      const dynamicForce = this.smoothChannels[channelIdx] * (ui.gain / 250.0);

      let waveWarpX = Math.sin(time * 2.0 + data.randomPhase + data.angle) * (dynamicForce * 1.5);
      let waveWarpY = Math.cos(time * 1.5 + data.randomPhase - data.radius) * (dynamicForce * 1.0);
      let waveWarpZ = Math.sin(time * 1.8 - data.randomPhase) * (dynamicForce * 1.3);

      let tX = data.baseX + waveWarpX;
      let tY = data.baseY + waveWarpY;
      let tZ = data.baseZ + waveWarpZ;

      sizes[i] = data.baseSize * (1.0 + this.smoothChannels[channelIdx] * 1.5);

      let i3 = i * 3;
      positions[i3]     = THREE.MathUtils.lerp(positions[i3], tX, 0.22);
      positions[i3 + 1] = THREE.MathUtils.lerp(positions[i3 + 1], tY, 0.22);
      positions[i3 + 2] = THREE.MathUtils.lerp(positions[i3 + 2], tZ, 0.22);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    this.cameraTime += 0.003;
    let subtleCameraZ = 15.0 + Math.sin(this.cameraTime) * 0.8 + (offZ * 2.0);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, (offX * 0.3) + Math.sin(this.cameraTime * 0.5) * 0.4, 0.05);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 3.0 + (offY * -0.3) + Math.cos(this.cameraTime * 0.4) * 0.3, 0.05);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, subtleCameraZ, 0.05);
    this.camera.lookAt(0, 0, 0);

    this.points.rotation.y = time * 0.015 + (volume * 0.01);
    this.points.rotation.x = Math.sin(time * 0.004) * 0.02;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    if (this.points) { this.scene.remove(this.points); this.geometry.dispose(); }
    if (this.renderer) { this.container.removeChild(this.renderer.domElement); this.renderer.dispose(); }
    if (this.guiOverlay) this.guiOverlay.remove();
    this.scene = null; this.camera = null; this.renderer = null; this.particleData = [];
  }
}
