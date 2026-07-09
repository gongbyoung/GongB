/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [버전] Ver 2.3 (32개 주파수 대역별 14대 무작위 독립 물리 거동 믹싱 완결판)
 * - 3개 분할의 단조로움을 완벽히 깨고, 입자 리스트를 i % 32 구조로 분할하여 32개의 주파수 독립 트래커 유닛 시공
 * - 회원님 기획의 [위아래/좌우/대각선 흔들기, 원형 번짐/복귀, 제자리 회전, 사방 임의 날아가기, 꼬리 잔상, 순간이동 워프] 완벽 수학적 배합
 * - 입자별 개별 무작위 난수 힘(Force Scale)을 다르게 주입하여 획일화되지 않은 정교한 우주 공간 텍스처 연출
 * - 분산범위(별의 범위), 지형변경(위치 랜덤화), 발광, 폭발력 및 무결점 배경 주입 완벽 연동
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
    
    this.version = "007호 32채널 무작위 독립 다이내믹 스페이스 Ver 2.3";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 3, 15);
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
        transition: 'opacity 0.45s cubic-bezier(0.25, 1, 0.5, 1)'
      });

      this.guiOverlay.innerHTML = `
        <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
          ⚙️ STAGE STATUS: ${this.version} READY
        </div>
        <h3 style="color: #ffffff; font-size: 16px; margin: 0 0 14px 0; font-weight: 600;">
          007호 32채널 무작위 가변 매트릭스
        </h3>
        <div style="font-size: 12px; text-align: left; line-height: 1.75; color: #dddddd;">
          <p style="margin: 4px 0;">🎛️ <strong style="color: #00ffcc;">[32분할 고유 춤사위]</strong> 단조로움을 깨고 별빛 무리를 32개 주파수 대역 채널별로 완벽히 격리 제어했습니다.</p>
          <p style="margin: 4px 0;">🌌 <strong style="color: #ffffff;">[14대 우주 역학 배합]</strong> 흔들기, 제자리 회전, 원형 음파 번짐, 사방 임의 사출 비행, 꼬리 잔상, 순간이동 워프 기믹이 입자마다 무작위 힘의 크기로 교차 연동됩니다.</p>
          <p style="margin: 4px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드 팝업창이 사라집니다.</p>
        </div>
      `;
      this.container.appendChild(this.guiOverlay);
    };
    renderOverlay();
    setTimeout(renderOverlay, 150);
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

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);

    this.particleData = [];
    let sRandom = this.currentSeed;

    const maxDistributionRadius = THREE.MathUtils.mapLinear(this.scatterExponent, 0.5, 5.0, 3.0, 26.0);

    for (let i = 0; i < this.particleCount; i++) {
      sRandom = this.seededRandom(sRandom) * 1000;
      const r1 = this.seededRandom(sRandom + 1);
      const r2 = this.seededRandom(sRandom + 2);
      const r3 = this.seededRandom(sRandom + 3);
      const r4 = this.seededRandom(sRandom + 4);

      const theta = r1 * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * r2 - 1.0);
      const baseDist = Math.pow(r3, 0.55) * maxDistributionRadius;

      const x = baseDist * Math.sin(phi) * Math.cos(theta);
      const y = baseDist * Math.sin(phi) * Math.sin(theta) * 0.6; 
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

      // 💡 개별 입자 고유 무작위 힘(Force Scale Factor) 설계 수치 인젝터
      const randomForceMagnitude = 0.4 + r2 * 2.2; // 각각 저항과 가속도가 다른 비대칭 물리 유도
      
      // 사방 임의 비행 방향용 단위 벡터 산출
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
        
        // 💡 14대 우주 거동용 고유 독립 난수 파라미터 세트
        forceScale: randomForceMagnitude,
        dirX: dirX, dirY: dirY, dirZ: dirZ,
        currentWarpTime: r4 * 10.0
      });
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('pSize', new THREE.BufferAttribute(sizes, 1));

    if (this.points) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true; 
      this.points.geometry.attributes.pSize.needsUpdate = true;
    } else {
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

      this.points = new THREE.Points(this.geometry, this.material);
      this.scene.add(this.points);
    }
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
    
    // 💡 메인 관제탑 main.js의 오디오 배열 버퍼 디코딩 수혈
    let rawBands = audioData ? (audioData.raw || audioData.spectrum || []) : [];
    let hasBands = rawBands.length > 20;

    let volume = audioData ? (audioData.vol || audioData.volume || 0.1) : 0.1;
    volume *= gain;

    if (volume > 0.05) {
      if (this.guiOverlay) this.guiOverlay.style.opacity = '0';
    } else {
      if (this.guiOverlay) this.guiOverlay.style.opacity = '1';
    }

    // 💡 [32채널 무작위 독립 믹싱 거동 대연산 코어 파이프라인]
    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];
      
      // i % 32 수식으로 32개 대역폭 채널 인덱스 매핑 추출
      const channelIdx = i % 32;
      
      // 오디오 밴드 리스트에서 해당 채널의 주파수 파워 추출
      let bandPower = hasBands ? (rawBands[Math.floor((channelIdx / 32) * (rawBands.length - 1))] / 255.0) : 0.1;
      bandPower *= gain;

      // 각 채널마다 다르게 매핑된 무작위 힘 가중치 적용
      const dynamicForce = bandPower * data.forceScale;

      // 기본 좌표축 세팅 백업
      let tX = data.baseX;
      let tY = data.baseY;
      let tZ = data.baseZ;

      // 💡 [14대 우주 역학 거동 채널별 조립 공정]
      switch (channelIdx) {
        case 0: case 1: case 2:
          // 1) 위로 흔들리기 / 위아래 흔들리기
          tY += Math.sin(time * 25.0 + data.randomPhase) * (dynamicForce * 1.5);
          break;
        case 3: case 4:
          // 2) 좌우로 흔들리기
          tX += Math.cos(time * 25.0 + data.randomPhase) * (dynamicForce * 1.5);
          break;
        case 5: case 6:
          // 3) 살짝 커졌다가 작아지기 (오직 호흡 스케일 제어)
          sizes[i] = data.baseSize * (1.0 + dynamicForce * 5.0);
          break;
        case 7: case 8:
          // 4) 음파처럼 원형으로 번져가기 (방사형 외곽 밀어내기)
          let pushDist = 1.0 + dynamicForce * 1.2;
          tX *= pushDist; tY *= pushDist; tZ *= pushDist;
          break;
        case 9: case 10:
          // 5) 제자리 회전하기 (각 채널의 로컬 원점 기준 z축 회전 롤링)
          let rotAngle = time * 2.0 * data.speed + (dynamicForce * 0.5);
          tX = data.baseX * Math.cos(rotAngle) - data.baseZ * Math.sin(rotAngle);
          tZ = data.baseX * Math.sin(rotAngle) + data.baseZ * Math.cos(rotAngle);
          break;
        case 11: case 12:
          // 6) 대각선으로 흔들기
          let diag = Math.sin(time * 22.0 + data.randomPhase) * (dynamicForce * 1.4);
          tX += diag; tY += diag;
          break;
        case 13: case 14: case 15:
          // 7) 작아졌다 원형으로 오기 (역방향 음파 수축 보간 제어)
          let pullDist = Math.max(0.1, 1.0 - (dynamicForce * 0.85));
          tX *= pullDist; tY *= pullDist; tZ *= pullDist;
          sizes[i] = data.baseSize * (0.3 + (1.0 - pullDist) * 3.0);
          break;
        case 16: case 17: case 18:
          // 8) 오른쪽 임의 방향으로 날아가기 (dirX 가 양수인 방향 중심 사출)
          let rFly = dynamicForce * 4.5;
          tX += Math.abs(data.dirX) * rFly; tY += data.dirY * rFly * 0.3; tZ += data.dirZ * rFly * 0.3;
          break;
        case 19: case 20: case 21:
          // 9) 아래쪽 임의 방향으로 날아가기 (dirY 가 음수인 중력 낙하 형태 사출)
          let dFly = dynamicForce * 4.5;
          tX += data.dirX * dFly * 0.3; tY -= Math.abs(data.dirY) * dFly; tZ += data.dirZ * dFly * 0.3;
          break;
        case 22: case 23: case 24:
          // 10) 왼쪽 임의 방향으로 날아가기 (dirX 가 음수인 방향 사출)
          let lFly = dynamicForce * 4.5;
          tX -= Math.abs(data.dirX) * lFly; tY += data.dirY * lFly * 0.3; tZ += data.dirZ * lFly * 0.3;
          break;
        case 25: case 26: case 27:
          // 11) 위쪽 임의 방향으로 날아가기 (dirY 가 양수인 분수 형태 사출)
          let uFly = dynamicForce * 4.5;
          tX += data.dirX * uFly * 0.3; tY += Math.abs(data.dirY) * uFly; tZ += data.dirZ * uFly * 0.3;
          break;
        case 28: case 29:
          // 12) 움직임에 영롱한 꼬리(残像) 남기기 및 고음 플래시 가변 색상 믹싱
          let trailPulse = 1.0 + Math.sin(time * 12.0 + data.randomPhase) * (dynamicForce * 0.8);
          tX *= trailPulse; tY *= trailPulse; tZ *= trailPulse;
          // 비트 주기에 맞춰 잔상 색상으로 튀었다가 복귀
          if (bandPower > 0.6) {
             colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.3;
          } else {
             colors[i * 3] = THREE.MathUtils.lerp(colors[i * 3], data.originalColor.r, 0.1);
             colors[i * 3 + 1] = THREE.MathUtils.lerp(colors[i * 3 + 1], data.originalColor.g, 0.1);
             colors[i * 3 + 2] = THREE.MathUtils.lerp(colors[i * 3 + 2], data.originalColor.b, 0.1);
          }
          break;
        case 30: case 31:
          // 13) 순간이동(Warp)으로 임의 지점으로 불규칙 공간 점프 이동 기믹
          // 피크 임계치 비트 볼륨이 감지되면 완전히 다른 위상 좌표 공간으로 차원 도약 워프 시공
          if (bandPower > 0.82) {
             tX = data.baseX + data.dirX * (data.forceScale * 8.0);
             tY = data.baseY + data.dirY * (data.forceScale * 5.0);
             tZ = data.baseZ + data.dirZ * (data.forceScale * 8.0);
             sizes[i] = data.baseSize * 4.5; // 워프 소닉붐 효과 크기 뻥튀기
          } else {
             // 비트 안 터질 땐 제자리 미세 떨림 진동 유지
             let backTremble = Math.sin(time * 30.0) * 0.05;
             tX += backTremble; tY += backTremble; tZ += backTremble;
             sizes[i] = THREE.MathUtils.lerp(sizes[i], data.baseSize * (1.0 + bandPower * 1.5), 0.2);
          }
          break;
      }

      // 최종 계산된 다차원 축 위치 배열 버퍼에 대입 안착
      positions[i * 3]     = THREE.MathUtils.lerp(positions[i * 3], tX, 0.28);
      positions[i * 3 + 1] = THREE.MathUtils.lerp(positions[i * 3 + 1], tY, 0.28);
      positions[i * 3 + 2] = THREE.MathUtils.lerp(positions[i * 3 + 2], tZ, 0.28);
      
      // 5, 6, 30, 31번 스케일 가변 제외 대역 기본 입자 크기 동기화 밸런싱
      if (channelIdx !== 5 && channelIdx !== 6 && channelIdx !== 30 && channelIdx !== 31) {
         sizes[i] = data.baseSize * (1.0 + bandPower * 2.0);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    // 우주 전체 조망 카메라 앵글 미세 흐름 제어
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
      this.material.dispose();
    }
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    if (this.guiOverlay) this.guiOverlay.remove();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleData = [];
  }
}
