/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [버전] Ver 2.5 (오로라 성운의 호흡 Resonant Nebula - 앰비언트 3D 완결판)
 * - 입자들이 사방으로 강하게 튀거나 워프하던 자극적 카오스를 지우고 오가닉 유체 일렁임으로 대개조
 * - 즉각적인 기계적 급변을 필터링하고 0.04의 극도로 끈적한 롱 디케이(Long Decay) 이징 댐핑 구축
 * - 칠흑 같은 블랙을 해체하고 딥 인디고 블루 암부 리프팅 및 3D 입체 카메라 유영 무브먼트 구현
 * - 관제탑 Color Style Palette(No1~No5) 색상 테마 및 현재 수치 즉시 적용 (RESET) 파이프라인 완벽 동기화
 */

export default class ThreeRealNebula {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null; 
    
    this.particleCount = 25000;
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.particleData = [];

    this.loadedSeed = -1;
    this.loadedScatter = -1;
    this.loadedColorStyle = '';
    
    // 끈적한 호흡을 지탱하기 위한 독립 대역 스무딩 버퍼 수립
    this.smoothChannels = new Float32Array(32);
    this.cameraTime = 0;
    this.version = "007호 Ambient Nebula Stream Ver 2.5";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 💡 [배경과의 통합]: 완전 블랙을 지우고 짙은 인디고 새벽녘 빛무리를 안개 깊이로 융합
    this.scene.fog = new THREE.FogExp2(0x060914, 0.015);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 3, 16);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x060914); // 딥 인디고 암부 리프팅
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x222535, 1.5));

    this.buildOnScreenGuideUI();
    this.buildCosmos();
  }

  buildOnScreenGuideUI() {
    const renderOverlay = () => {
      if (!this.container) return;
      const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
      if (oldOverlay) oldOverlay.remove();

      this.guiOverlay = document.createElement('div');
      this.guiOverlay.className = 'cosmic-shader-guide';
      
      Object.assign(this.guiOverlay.style, {
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '85%', maxWidth: '440px', backgroundColor: 'rgba(6, 9, 20, 0.95)',
        border: '1px solid rgba(0, 255, 204, 0.5)', borderRadius: '14px', padding: '24px',
        color: '#ffffff', fontFamily: 'sans-serif', zIndex: '9999', 
        boxShadow: '0 8px 30px rgba(0,0,0,0.75)', boxSizing: 'border-box', textAlign: 'center',
        display: 'block', opacity: '1', transition: 'opacity 0.5s ease-in-out'
      });

      this.guiOverlay.innerHTML = `
        <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
          🌌 STAGE STATUS: ${this.version} READY
        </div>
        <h3 style="color: #ffffff; font-size: 16.5px; margin: 0 0 14px 0; font-weight: 600;">
          007호 명상 스튜디오: 오로라 성운의 호흡
        </h3>
        <div style="font-size: 12.5px; text-align: left; line-height: 1.8; color: #dddddd;">
          <p style="margin: 4px 0;">✨ <strong>[대개조]</strong> 입자들이 튀고 워프하던 자극적 기믹을 해체하고, 은하수 가스가 물결처럼 일렁이는 3D 유체 오로라 공간으로 리빌딩했습니다.</p>
          <p style="margin: 4px 0; color: #ffcc00;">▶️ 하단의 오디오 재생 버튼을 누르면 이 가이드 팝업창이 아련하게 소멸합니다.</p>
        </div>
      `;
      this.container.appendChild(this.guiOverlay);
    };
    renderOverlay();
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.55)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.12)');
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

  buildCosmos() {
    if (window.cosmicEngineSettings) {
      this.currentSeed = window.cosmicEngineSettings.seed;
      this.scatterExponent = window.cosmicEngineSettings.scatterExponent; 
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
      this.customColors = window.cosmicEngineSettings.customColors;
    } else {
      this.currentSeed = 42;
      this.scatterExponent = 22;
      this.colorStyle = 'neon';
      this.customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
    }

    this.loadedSeed = this.currentSeed;
    this.loadedScatter = this.scatterExponent;
    this.loadedColorStyle = this.colorStyle;

    if (this.points) {
      this.scene.remove(this.points);
      this.geometry.dispose();
      this.points = null;
    }

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);

    this.particleData = [];
    let sRandom = this.currentSeed;

    // 관제탑 scatter(Range) 지수를 성운의 정갈한 확산 반경으로 매핑
    const maxDistributionRadius = THREE.MathUtils.mapLinear(this.scatterExponent, 5, 50, 2.5, 12.0);

    // 💡 [Color Style Palette 5대 명상 컬러칩 수리 및 셰이더 이식 준비]
    let baseC1 = new THREE.Color(), baseC2 = new THREE.Color(), baseC3 = new THREE.Color();
    if (this.colorStyle === 'monochrome') {
      // No1: 차분한 모스 그린 그라데이션
      baseC1.set('#1e382b'); baseC2.set('#4da87a'); baseC3.set('#ffffff');
    } else if (this.colorStyle === 'neon') {
      // No2: 따뜻한 샌드 베이지 아날로그
      baseC1.set('#9e8467'); baseC2.set('#fcf7ed'); baseC3.set('#ffffff');
    } else if (this.colorStyle === 'pastel') {
      // No3: 은은한 대지 / 새벽녘 라벤더 핑크
      baseC1.set('#1a2333'); baseC2.set('#e6b0a1'); baseC3.set('#ffffff');
    } else if (this.colorStyle === 'custom') {
      // No4: 커스텀 컬러 바인딩
      baseC1.set(this.customColors.gas1); baseC2.set(this.customColors.gas2); baseC3.set(this.customColors.star);
    } else {
      // No5: 올 랜덤 시드 분산형
      baseC1.setHSL(this.seededRandom(this.currentSeed + 10), 0.7, 0.5);
      baseC2.setHSL(this.seededRandom(this.currentSeed + 20), 0.6, 0.6);
      baseC3.setHex(0xffffff);
    }

    for (let i = 0; i < this.particleCount; i++) {
      sRandom = this.seededRandom(sRandom) * 1000;
      const r1 = this.seededRandom(sRandom + 1);
      const r2 = this.seededRandom(sRandom + 2);
      const r3 = this.seededRandom(sRandom + 3);
      const r4 = this.seededRandom(sRandom + 4);

      const theta = r1 * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * r2 - 1.0);
      
      const baseDist = Math.pow(r3, 0.6) * maxDistributionRadius;

      // 둥근 타원형 우주 가스 수면 레이아웃 좌표 컴파일
      const x = baseDist * Math.sin(phi) * Math.cos(theta);
      const y = baseDist * Math.sin(phi) * Math.sin(theta) * 0.45; 
      const z = baseDist * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      let pSize = 0.04 + r1 * 0.05;
      let color = new THREE.Color();
      let starType = (r4 < 0.07) ? 'star' : 'gas';

      if (starType === 'star') {
        pSize = 0.25 + r1 * 0.3;
        color.copy(baseC3);
      } else {
        // 내외곽 거리에 따른 조화로운 아날로그 가스 색채 블렌딩
        let lerpFactor = THREE.MathUtils.clamp(baseDist / maxDistributionRadius, 0, 1);
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
        speed: (0.02 + r1 * 0.1) * randomForceMagnitude,
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
        opacity: 0.85,
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

    let offX = 0, offY = 0, offZ = 0;
    if (window.cosmicEngineSettings) {
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
      this.audioGain = window.cosmicEngineSettings.audioGain;
      const glow = window.cosmicEngineSettings.glowIntensity;
      
      // 관제탑 실시간 입자 스케일 및 오퍼시티 결합
      this.material.opacity = THREE.MathUtils.lerp(this.material.opacity, Math.min(1.0, (glow / 100.0) * 1.1), 0.1); 
      this.material.size = THREE.MathUtils.lerp(this.material.size, Math.max(0.4, (glow / 100.0) * 2.5), 0.1); 

      offX = window.cosmicEngineSettings.positionOffset?.x || 0;
      offY = window.cosmicEngineSettings.positionOffset?.y || 0;
      offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
    }

    const time = Date.now() * 0.0006;
    const positions = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.pSize.array;

    const gain = this.audioGain || 1.0;
    let rawBands = audioData ? (audioData.raw || audioData.spectrum || []) : [];
    let hasBands = rawBands.length > 20;

    let volume = audioData ? (audioData.vol || 0.1) : 0.1;
    volume *= gain;

    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    // 안내 팝업 가이드창 소멸 트래킹 락인 픽스
    if (this.guiOverlay) {
      if (isPlaying || volume > 0.06) {
        this.guiOverlay.style.opacity = '0';
        this.guiOverlay.style.pointerEvents = 'none';
      } else {
        this.guiOverlay.style.opacity = '1';
      }
    }

    // 💡 [개선안 1: 움직임의 호흡 조절] 32개 가상 채널 0.04 레이트의 초저속 댐핑 스무딩 필터링
    for (let c = 0; i < 32; c++) {
      let bandPower = hasBands ? (rawBands[Math.floor((c / 32) * (rawBands.length - 1))] / 255.0) : 0.0;
      bandPower *= gain;
      
      // 💥 끈적하고 웅장한 여운(Decay)을 주입하기 위한 서서히 변화하는 댐핑 공식 동기화
      this.smoothChannels[c] += (bandPower - this.smoothChannels[c]) * 0.04;
    }

    // 파티클 정렬 좌표 실시간 유체 일렁임 투사 루프
    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];
      const channelIdx = i % 32;
      
      const dynamicForce = this.smoothChannels[channelIdx] * data.forceScale;

      // 💡 [개선안 2: 유기적이고 곡선적인 움직임 유도]
      // 난기류 워프나 튀는 기믹을 철폐하고 액체처럼 유연하게 일렁이는 삼각 정현파 물결 변위 주입
      let waveWarpX = Math.sin(time * 2.0 + data.randomPhase + data.angle) * (dynamicForce * 1.8);
      let waveWarpY = Math.cos(time * 1.5 + data.randomPhase - data.radius) * (dynamicForce * 1.2);
      let waveWarpZ = Math.sin(time * 1.8 - data.randomPhase) * (dynamicForce * 1.6);

      let tX = data.baseX + waveWarpX;
      let tY = data.baseY + waveWarpY;
      let tZ = data.baseZ + waveWarpZ;

      // 성운 입자 브리딩 스케일링 유도
      sizes[i] = data.baseSize * (1.0 + this.smoothChannels[channelIdx] * 1.8);

      // 보간 속도를 활용해 픽셀이 튀지 않고 스며들듯 포지션 트래킹
      let i3 = i * 3;
      positions[i3]     = THREE.MathUtils.lerp(positions[i3], tX, 0.22);
      positions[i3 + 1] = THREE.MathUtils.lerp(positions[i3 + 1], tY, 0.22);
      positions[i3 + 2] = THREE.MathUtils.lerp(positions[i3 + 2], tZ, 0.22);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    // 💡 [개선안 4: 느릿한 공간 이동] 가상 카메라가 은하수의 숨결을 따라 입체 시네마틱 유영 무브먼트 진행
    this.cameraTime += 0.003;
    let subtleCameraZ = 15.0 + Math.sin(this.cameraTime) * 0.8 + (offZ * 2.0) - (volume * 0.5);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, (offX * 0.3) + Math.sin(this.cameraTime * 0.5) * 0.4, 0.05);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 3.0 + (offY * -0.3) + Math.cos(this.cameraTime * 0.4) * 0.3, 0.05);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, subtleCameraZ, 0.05);
    this.camera.lookAt(0, 0, 0);

    // 전체 은하 무대의 웅장하고 느릿한 자전 공전 회전 레이트 세팅
    this.points.rotation.y = time * 0.015 + (volume * 0.015);
    this.points.rotation.x = Math.sin(time * 0.004) * 0.02;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
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
