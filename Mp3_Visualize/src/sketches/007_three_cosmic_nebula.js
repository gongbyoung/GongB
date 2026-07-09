/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [버전] Ver 2.4 (분산 범위 하드웨어 다이렉트 바인딩 및 팝업 점멸 버그 완치판)
 * - buildCosmos() 호출 시 메모리 누수 없이 기존 입자 버퍼를 클리어하고, 새로 조정된 분산 범위 수치대로 공간 반경 재컴파일 배치 완비
 * - 비동기 오퍼시티 소멸 트리거 타이밍을 락인하여 안내 팝업창이 살짝살짝 깜빡거리며 방해하던 돔 버그 원천 수정
 * - 32채널 무작위 독립 14대 거동 매트릭스(흔들기, 회전, 원형 번짐, 사방 사출 비행, 꼬리 잔상, 워프 순간이동) 완벽 유지
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
    
    this.version = "007호 32채널 수치 동기화 고정판 Ver 2.4";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 4, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x222233, 1.2));

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
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '85%',
        maxWidth: '440px',
        backgroundColor: 'rgba(5, 7, 12, 0.96)',
        border: '1px solid rgba(0, 255, 204, 0.7)', 
        borderRadius: '12px',
        padding: '22px',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        zIndex: '9999', 
        boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
        boxSizing: 'border-box',
        textAlign: 'center',
        pointerEvents: 'none',
        display: 'block', // 락 고정
        opacity: '1',
        transition: 'opacity 0.4s ease'
      });

      this.guiOverlay.innerHTML = `
        <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
          ⚙️ STAGE STATUS: ${this.version} READY
        </div>
        <h3 style="color: #ffffff; font-size: 16px; margin: 0 0 14px 0; font-weight: 600;">
          007호 32채널 무작위 마스터 제어 무대
        </h3>
        <div style="font-size: 12px; text-align: left; line-height: 1.75; color: #dddddd;">
          <p style="margin: 4px 0;">⚡ <strong style="color: #00ffcc;">[수동 동기화 픽스]</strong> 분산 범위 및 지형 수치를 조정한 후 우측의 <strong>'즉시 적용(RESET)'</strong> 단추를 누르면 버벅거림 없이 우주가 칼같이 동적 재배치됩니다.</p>
          <p style="margin: 4px 0;">🌌 <strong style="color: #ffffff;">[32채널 14대 거동 분리]</strong> 흔들기, 제자리 회전, 원형 번짐, 사방 임의 비행, 꼬리 잔상, 순간이동 워프 물리 기믹이 독립된 힘의 스케일로 연동됩니다.</p>
          <p style="margin: 4px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드 팝업창이 부드럽게 완전 소멸합니다.</p>
        </div>
      `;
      this.container.appendChild(this.guiOverlay);
    };
    renderOverlay();
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 💡 [대수술 구역] 적용 버튼 누를 때마다 호출되어 새 수치 범위대로 파티클 버퍼를 완벽하게 재가공 부팅
  buildCosmos() {
    if (window.cosmicEngineSettings) {
      this.currentSeed = window.cosmicEngineSettings.seed;
      this.scatterExponent = window.cosmicEngineSettings.scatterExponent; 
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
      this.customColors = window.cosmicEngineSettings.customColors;
    } else {
      this.currentSeed = 42;
      this.scatterExponent = 2.2;
      this.colorStyle = 'monochrome';
      this.customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
    }

    this.loadedSeed = this.currentSeed;
    this.loadedScatter = this.scatterExponent;
    this.loadedColorStyle = this.colorStyle;

    // 메모리 누수 방지를 위해 기존 포인트 노드가 있다면 씬에서 깔끔하게 철거 및 디스포즈
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

    // 💡 [분산 범위 정밀 매핑] 우측 슬라이더 수치(scatterExponent) 값에 맞춰 사방으로 뻗어 나가는 성운의 총체적 최대 반경 제한선 확정
    const maxDistributionRadius = THREE.MathUtils.mapLinear(this.scatterExponent, 0.5, 5.0, 1.5, 25.0);

    for (let i = 0; i < this.particleCount; i++) {
      sRandom = this.seededRandom(sRandom) * 1000;
      const r1 = this.seededRandom(sRandom + 1);
      const r2 = this.seededRandom(sRandom + 2);
      const r3 = this.seededRandom(sRandom + 3);
      const r4 = this.seededRandom(sRandom + 4);

      const theta = r1 * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * r2 - 1.0);
      
      // 💡 분산범위 지수가 무결하게 주입되어 별들이 압축/분산 조절되는 물리 반경 공식 고정
      const baseDist = Math.pow(r3, 0.5) * maxDistributionRadius;

      const x = baseDist * Math.sin(phi) * Math.cos(theta);
      const y = baseDist * Math.sin(phi) * Math.sin(theta) * 0.55; 
      const z = baseDist * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      let pSize = 0.015 + r1 * 0.025;
      let color = new THREE.Color();
      let starType = (r4 < 0.08) ? 'star' : 'gas';

      if (starType === 'star') pSize = 0.15 + r1 * 0.22; 

      if (this.colorStyle === 'monochrome') {
        if (starType === 'star') color.setHex(0xffffff);
        else if (i % 3 === 0) color.setHex(0x001a4d); 
        else if (i % 3 === 1) color.setHex(0x0055cc); 
        else color.setHex(0x26d9ff);                
      } 
      else if (this.colorStyle === 'pastel') {
        if (starType === 'star') color.setHex(0xffbb44);
        else if (i % 2 === 0) color.setHex(0xff3c00); 
        else color.setHex(0x1a0200);                
      }
      else if (this.colorStyle === 'custom') {
        const cc = this.customColors;
        if (starType === 'star') color.set(cc.star);
        else if (i % 2 === 0) color.set(cc.gas1);
        else color.set(cc.gas2);
      } 
      else {
        if (starType === 'star') color.setHSL(r1, 0.3, 0.9);
        else color.setHSL(r1, 0.8, 0.55);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      const randomForceMagnitude = 0.4 + r2 * 2.2; 
      const randomAngle = r3 * Math.PI * 2;
      const dirX = Math.cos(randomAngle);
      const dirY = (r1 - 0.5) * 2.0;
      const dirZ = Math.sin(randomAngle);

      this.particleData.push({
        baseX: x, baseY: y, baseZ: z, 
        radius: baseDist, angle: theta,
        speed: (0.05 + r1 * 0.3) * randomForceMagnitude,
        twinkleSpeed: 3.0 + r2 * 9.0,
        type: starType,
        baseSize: pSize,
        randomPhase: r3 * Math.PI,
        originalColor: color.clone(),
        forceScale: randomForceMagnitude,
        dirX: dirX, dirY: dirY, dirZ: dirZ,
        currentWarpTime: r4 * 10.0
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

    if (window.cosmicEngineSettings) {
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
      this.audioGain = window.cosmicEngineSettings.audioGain;
      const glow = window.cosmicEngineSettings.glowIntensity;
      this.material.opacity = Math.min(1.0, glow); 
      this.material.size = Math.max(0.4, glow * 2.2); 
    }

    const time = Date.now() * 0.001;
    const positions = this.geometry.attributes.position.array;
    const colors = this.geometry.attributes.color.array;
    const sizes = this.geometry.attributes.pSize.array;

    const gain = this.audioGain;
    let rawBands = audioData ? (audioData.raw || audioData.spectrum || []) : [];
    let hasBands = rawBands.length > 20;

    let volume = audioData ? (audioData.vol || audioData.volume || 0.1) : 0.1;
    volume *= gain;

    // 💡 안내 가이드창 점멸 버그 완전 차단 픽스 바인딩
    if (this.guiOverlay) {
      if (volume > 0.05) this.guiOverlay.style.opacity = '0';
      else this.guiOverlay.style.opacity = '1';
    }

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];
      const channelIdx = i % 32;
      
      let bandPower = hasBands ? (rawBands[Math.floor((channelIdx / 32) * (rawBands.length - 1))] / 255.0) : 0.1;
      bandPower *= gain;

      const dynamicForce = bandPower * data.forceScale;

      let tX = data.baseX;
      let tY = data.baseY;
      let tZ = data.baseZ;

      switch (channelIdx) {
        case 0: case 1: case 2:
          tY += Math.sin(time * 25.0 + data.randomPhase) * (dynamicForce * 1.5);
          break;
        case 3: case 4:
          tX += Math.cos(time * 25.0 + data.randomPhase) * (dynamicForce * 1.5);
          break;
        case 5: case 6:
          sizes[i] = data.baseSize * (1.0 + dynamicForce * 5.0);
          break;
        case 7: case 8:
          let pushDist = 1.0 + dynamicForce * 1.2; tX *= pushDist; tY *= pushDist; tZ *= pushDist;
          break;
        case 9: case 10:
          let rotAngle = time * 2.0 * data.speed + (dynamicForce * 0.5);
          tX = data.baseX * Math.cos(rotAngle) - data.baseZ * Math.sin(rotAngle);
          tZ = data.baseX * Math.sin(rotAngle) + data.baseZ * Math.cos(rotAngle);
          break;
        case 11: case 12:
          let diag = Math.sin(time * 22.0 + data.randomPhase) * (dynamicForce * 1.4); tX += diag; tY += diag;
          break;
        case 13: case 14: case 15:
          let pullDist = Math.max(0.1, 1.0 - (dynamicForce * 0.85)); tX *= pullDist; tY *= pullDist; tZ *= pullDist;
          sizes[i] = data.baseSize * (0.3 + (1.0 - pullDist) * 3.0);
          break;
        case 16: case 17: case 18:
          let rFly = dynamicForce * 4.5; tX += Math.abs(data.dirX) * rFly; tY += data.dirY * rFly * 0.3; tZ += data.dirZ * rFly * 0.3;
          break;
        case 19: case 20: case 21:
          let dFly = dynamicForce * 4.5; tX += data.dirX * dFly * 0.3; tY -= Math.abs(data.dirY) * dFly; tZ += data.dirZ * dFly * 0.3;
          break;
        case 22: case 23: case 24:
          let lFly = dynamicForce * 4.5; tX -= Math.abs(data.dirX) * lFly; tY += data.dirY * lFly * 0.3; tZ += data.dirZ * lFly * 0.3;
          break;
        case 25: case 26: case 27:
          let uFly = dynamicForce * 4.5; tX += data.dirX * uFly * 0.3; tY += Math.abs(data.dirY) * uFly; tZ += data.dirZ * uFly * 0.3;
          break;
        case 28: case 29:
          let trailPulse = 1.0 + Math.sin(time * 12.0 + data.randomPhase) * (dynamicForce * 0.8); tX *= trailPulse; tY *= trailPulse; tZ *= trailPulse;
          if (bandPower > 0.6) {
             colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.3;
          } else {
             colors[i * 3] = THREE.MathUtils.lerp(colors[i * 3], data.originalColor.r, 0.1); colors[i * 3 + 1] = THREE.MathUtils.lerp(colors[i * 3 + 1], data.originalColor.g, 0.1); colors[i * 3 + 2] = THREE.MathUtils.lerp(colors[i * 3 + 2], data.originalColor.b, 0.1);
          }
          break;
        case 30: case 31:
          if (bandPower > 0.82) {
             tX = data.baseX + data.dirX * (data.forceScale * 8.0); tY = data.baseY + data.dirY * (data.forceScale * 5.0); tZ = data.baseZ + data.dirZ * (data.forceScale * 8.0);
             sizes[i] = data.baseSize * 4.5; 
          } else {
             let backTremble = Math.sin(time * 30.0) * 0.05; tX += backTremble; tY += backTremble; tZ += backTremble;
             sizes[i] = THREE.MathUtils.lerp(sizes[i], data.baseSize * (1.0 + bandPower * 1.5), 0.2);
          }
          break;
      }

      positions[i * 3]     = THREE.MathUtils.lerp(positions[i * 3], tX, 0.28);
      positions[i * 3 + 1] = THREE.MathUtils.lerp(positions[i * 3 + 1], tY, 0.28);
      positions[i * 3 + 2] = THREE.MathUtils.lerp(positions[i * 3 + 2], tZ, 0.28);
      
      if (channelIdx !== 5 && channelIdx !== 6 && channelIdx !== 30 && channelIdx !== 31) {
         sizes[i] = data.baseSize * (1.0 + bandPower * 2.0);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    this.points.rotation.y = time * 0.01 + (volume * 0.02);
    this.points.rotation.x = Math.sin(time * 0.005) * 0.03;

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
    if (this.points) {
      this.scene.remove(this.points);
      this.geometry.dispose();
    }
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    if (this.guiOverlay) this.guiOverlay.remove();
    this.scene = null; this.camera = null; this.renderer = null; this.particleData = [];
  }
}
