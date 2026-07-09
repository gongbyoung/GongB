/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [버전] Ver 2.0 (획일 회전 공식 완벽 파괴 및 공간 확산형 성운 스페이스 완결판)
 * - 획일적인 은하 소용돌이 회전을 전면 삭제하고 화면 전체에 무수히 퍼져 상주하는 입체적 Starfield 아키텍처 도입
 * - 분산범위(Center Scatter): 별들이 퍼져나가는 구형 방사 한계 물리적 스펙트럼 범위 제어
 * - 지형변경(Random Seed): 변경 시 25,000개 모든 별빛의 3D 공간 좌표의 위치를 완전 무작위 랜덤 리셔플
 * - STYLE 1 (Monochrome): 청량하고 맑은 아쿠아 바다색 은하수 스펙트럼 배색
 * - STYLE 2 (Pastel): 이글거리는 가스 오렌지 및 블러드 파이어 불색 은하수 스펙트럼 배색
 * - 스타일 3(Custom), 스타일 4/5(Full-Random) 및 발광(크기), 폭발력(비트 파동) 연동 완벽 고정
 */

export default class ThreeRealNebula {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.particleCount = 25000;
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.particleData = [];

    this.loadedSeed = -1;
    this.loadedScatter = -1;
    this.loadedColorStyle = '';
    
    this.version = "007호 분산형 무작위 우주 스페이스 Ver 2.0";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    // 우주를 전체적으로 조망하기 위해 카메라 포지션을 살짝 뒤로 워프 배치
    this.camera.position.set(0, 5, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x222233, 1.0));

    this.buildCosmos();
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
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

    // 💡 [분산 범위 스케일 링킹 계수 가공]
    // UI에서 들어오는 scatterExponent 수치에 정비례하여 전체 별들이 흩어지는 사방 한계 반경 설정
    const maxDistributionRadius = THREE.MathUtils.mapLinear(this.scatterExponent, 0.5, 5.0, 3.0, 24.0);

    for (let i = 0; i < this.particleCount; i++) {
      // 💡 [지형 변경 ➡️ 별의 위치 랜덤화]
      // 결정론적 무작위 씨드 난수를 생성하여 매 씨드 변경 마다 3차원 공간 전체에 완전히 새로 셔플 뿌림
      sRandom = this.seededRandom(sRandom) * 1000;
      const r1 = this.seededRandom(sRandom + 1);
      const r2 = this.seededRandom(sRandom + 2);
      const r3 = this.seededRandom(sRandom + 3);
      const r4 = this.seededRandom(sRandom + 4);

      // 구형 무작위 구체 좌표 분산 수식 (화면 전체에 골고루 퍼지도록 난수 세팅)
      const u = r1;
      const v = r2;
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      
      // 분산범위(maxDistributionRadius) 내부에 균등하게 분포하도록 3차원 벡터 반경 전개
      const baseDist = Math.pow(r3, 0.6) * maxDistributionRadius;

      const x = baseDist * Math.sin(phi) * Math.cos(theta);
      const y = baseDist * Math.sin(phi) * Math.sin(theta) * 0.6; // 위아래는 살짝 납작하게 우주 원근감 부여
      const z = baseDist * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      let pSize = 0.02;
      let color = new THREE.Color();
      let starType = (r4 < 0.08) ? 'star' : 'gas'; // 고유 입자 분류

      if (starType === 'star') {
        pSize = 0.15 + r1 * 0.22; 
      } else {
        pSize = 0.015 + r1 * 0.03;
      }

      // 💡 [COLOR STYLE 1번, 2번 신형 규격 대입]
      if (this.colorStyle === 'monochrome') {
        // 스타일 1: 바다색 은하수 계열 (딥 블루 -> 맑은 네온 시안 아쿠아 마린)
        if (starType === 'star') color.setHex(0xffffff); // 항성은 순백색
        else if (i % 3 === 0) color.setHSL(0.58 + r2 * 0.03, 1.0, 0.4); // 바다 딥블루
        else if (i % 3 === 1) color.setHSL(0.52 + r2 * 0.04, 0.9, 0.5); // 아쿠아 마린
        else color.setHSL(0.48 + r2 * 0.02, 1.0, 0.6); // 라이트 시안 블루
      } 
      else if (this.colorStyle === 'pastel') {
        // 스타일 2: 불색 은하수 계열 (마그마 오렌지 골드 -> 잿빛 스모크 다크 파이어 레드)
        if (starType === 'star') color.setHex(0xffcc66); // 항성은 노란 골드빛
        else if (i % 2 === 0) color.setHSL(0.02 + r2 * 0.03, 1.0, 0.45); // 불꽃 오렌지 레드
        else color.setHSL(0.96 + r2 * 0.02, 0.9, 0.2); // 어두운 크림슨 파이어
      }
      else if (this.colorStyle === 'custom') {
        // 스타일 3: 픽커 커스텀 배색 링크 고정 유지
        const cc = this.customColors;
        if (starType === 'star') color.set(cc.star);
        else if (i % 2 === 0) color.set(cc.gas1);
        else color.set(cc.gas2);
      } 
      else {
        // 스타일 4/5번: 완전 무작위 스펙트럼 셔플
        if (starType === 'star') color.setHSL(r1, 0.4, 0.9);
        else color.setHSL(r1, 0.8, 0.5);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      this.particleData.push({
        baseX: x, baseY: y, baseZ: z, 
        radius: baseDist,
        angle: theta,
        speed: 0.05 + r1 * 0.2,
        twinkleSpeed: 2.0 + r2 * 6.0,
        type: starType,
        baseSize: pSize,
        randomPhase: r3 * Math.PI
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
      this.material.size = Math.max(0.4, glow * 2.0); 
    }

    const time = Date.now() * 0.001;
    const positions = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.pSize.array;

    const gain = this.audioGain;
    const subBass = audioData ? audioData.subBass * gain * 2.2 : 0;
    const bass    = audioData ? audioData.bass * gain * 1.8 : 0;
    const mid     = audioData ? audioData.mid * gain * 1.4 : 0;
    const treble  = audioData ? audioData.treble * gain * 1.8 : 0;
    const volume  = audioData ? audioData.volume * gain * 2.2 : 0;

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];

      // 💡 [획일 회전 폐기 보정 수식]
      // 모든 입자가 다 같이 도는 궤적을 지우고, 개별 입자가 고유 페이즈와 무작위 주파수 맥동 진동에 맞춰 은은하게 호흡하도록 변경
      const breatheNoise = Math.sin(time * data.speed + data.randomPhase) * (bass * 0.15 + mid * 0.1);
      
      // 오디오 트레블에 반응하는 개별 트윙클 반경 가변 주입
      const twinkleNoise = Math.cos(time * data.twinkleSpeed) * (treble * 0.12);
      const currentRadius = data.radius + twinkleNoise + (subBass * 0.4);

      // 구형 좌표계를 바탕으로 굳어있지 않고 비트에 맞춰 사방으로 미세 출렁이는 공간 분산 전개
      positions[i * 3] = data.baseX * (1.0 + breatheNoise) + Math.sin(time * 0.5 + data.randomPhase) * (mid * 0.05);
      positions[i * 3 + 1] = data.baseY + Math.cos(time * data.speed + data.radius) * (mid * 0.25);
      positions[i * 3 + 2] = data.baseZ * (1.0 + breatheNoise) + Math.cos(time * 0.5 + data.randomPhase) * (mid * 0.05);

      // 입자 크기도 볼륨 비트에 맞춰 영롱하게 호흡 진동
      if (data.type === 'star') {
        sizes[i] = data.baseSize * (1.0 + subBass * 3.5 + Math.sin(time * data.twinkleSpeed) * 0.4);
      } else {
        sizes[i] = data.baseSize * (1.0 + treble * 2.8);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    // 💡 전체 카메라 앵글 회전은 흐르듯이 고정하되, 음악 전체 볼륨 터질 때만 우주 전체 앵글이 웅장하게 출렁이도록 바인딩
    this.points.rotation.y = time * 0.015 + (volume * 0.04);
    this.points.rotation.z = Math.sin(time * 0.01) * 0.05;

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
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleData = [];
  }
}
