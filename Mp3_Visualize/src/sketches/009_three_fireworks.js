/**
 * 009_three_fireworks.js
 * 12개의 주파수 대역과 1:1 매핑된 12종 개별 불꽃놀이 발사 렌더러
 */
export default class ThreeFireworksStage {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numBands = 12; // 12종 주파수 대역
    this.particlesPerFirework = 600; // 불꽃 하나당 파티클 수
    
    this.fireworks = []; // 12개의 불꽃 시스템을 담을 배열
    this.prevFreqBins = new Float32Array(this.numBands); // 주파수 상승 감지용 버퍼

    this.loadedSeed = -1;
    this.colorStyle = '';
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.02);

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 20); // 불꽃놀이를 올려다보는 뷰
    this.camera.lookAt(0, 5, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    this.buildFireworks();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildFireworks() {
    const tex = this.createGlowTexture();

    for (let i = 0; i < this.numBands; i++) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(this.particlesPerFirework * 3);
      const col = new Float32Array(this.particlesPerFirework * 3);
      const siz = new Float32Array(this.particlesPerFirework);
      
      // 파티클별 개별 물리 속도 배열
      const vel = new Float32Array(this.particlesPerFirework * 3);

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('pSize', new THREE.BufferAttribute(siz, 1));

      const mat = new THREE.PointsMaterial({
        size: 1.0,
        map: tex,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      // 런타임 가변 크기 셰이더 삽입
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          'void main() {',
          `attribute float pSize;\nvoid main() {`
        );
        shader.vertexShader = shader.vertexShader.replace(
          'gl_PointSize = size;',
          'gl_PointSize = size * pSize;'
        );
      };

      const mesh = new THREE.Points(geo, mat);
      this.scene.add(mesh);

      // 개별 불꽃 객체 상태 정의
      this.fireworks.push({
        mesh: mesh,
        geo: geo,
        vel: vel,
        state: 'idle', // 'idle' (대기), 'launch' (상승), 'explode' (폭발)
        x: 0, y: -5, z: 0,
        targetY: 0,
        vy: 0,
        age: 0,
        baseHue: (i / this.numBands) // 무지개 스펙트럼 기본값
      });
    }
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  // 불꽃 발사 함수 (모든 파티클을 뭉쳐서 위로 쏘아올림)
  triggerLaunch(index, force, scatter, seed, customColors) {
    const fw = this.fireworks[index];
    fw.state = 'launch';
    fw.age = 0;
    
    // 발사 위치 X축 배분 (Scatter 슬라이더 적용)
    const span = 20 * (scatter / 2.2);
    fw.x = - (span / 2) + (index / (this.numBands - 1)) * span;
    fw.y = -5; // 바닥 고정
    fw.z = (this.seededRandom(seed + index) - 0.5) * 4; // 약간의 앞뒤 깊이감
    
    // 타격 강도(force)에 따라 목표 상공 고도 결정
    fw.targetY = 2 + force * 15 + this.seededRandom(seed + index + 10) * 5;
    fw.vy = 0.3 + force * 0.2; // 상승 속도

    // 색상 테마 결정
    const c = new THREE.Color();
    if (this.colorStyle === 'full-random') {
      fw.baseHue = this.seededRandom(seed + index * 99);
      c.setHSL(fw.baseHue, 0.9, 0.6);
    } else if (this.colorStyle === 'neon') {
      c.setHSL(index % 2 === 0 ? 0.93 : 0.48, 1.0, 0.6);
    } else if (this.colorStyle === 'pastel') {
      c.setHSL(index % 2 === 0 ? 0.74 : 0.10, 0.6, 0.7);
    } else if (this.colorStyle === 'custom') {
      c.set(index % 2 === 0 ? customColors.gas1 : customColors.gas2);
    } else {
      c.setHSL(index / this.numBands, 0.9, 0.5); // 디폴트 무지개
    }

    const pos = fw.geo.attributes.position.array;
    const col = fw.geo.attributes.color.array;
    const siz = fw.geo.attributes.pSize.array;

    for (let j = 0; j < this.particlesPerFirework; j++) {
      // 상승 중에는 파티클 600개를 (fw.x, fw.y, fw.z) 한 점에 완전히 뭉쳐서 하나의 로켓처럼 보이게 함
      pos[j*3] = fw.x; pos[j*3+1] = fw.y; pos[j*3+2] = fw.z;
      
      // 상승 중에는 밝은 흰색/노란색 섬광으로 처리
      col[j*3] = 1.0; col[j*3+1] = 0.9; col[j*3+2] = 0.6;
      
      // 로켓 머리 파티클 1개만 크게 만들고 나머지는 숨김
      siz[j] = j === 0 ? 2.5 : 0.0;
      
      // 속도 버퍼 초기화 (아직 안 터짐)
      fw.vel[j*3] = 0; fw.vel[j*3+1] = 0; fw.vel[j*3+2] = 0;
    }

    // 오브젝트 발광 및 갱신
    fw.mesh.material.opacity = 1.0;
    fw.geo.attributes.position.needsUpdate = true;
    fw.geo.attributes.color.needsUpdate = true;
    fw.geo.attributes.pSize.needsUpdate = true;
  }

  // 상공에서 목표 지점 도달 시 파티클 산개 폭발 함수
  triggerExplode(index, force, customColors) {
    const fw = this.fireworks[index];
    fw.state = 'explode';
    
    const pos = fw.geo.attributes.position.array;
    const col = fw.geo.attributes.color.array;
    const siz = fw.geo.attributes.pSize.array;
    
    const c = new THREE.Color();

    for (let j = 0; j < this.particlesPerFirework; j++) {
      // 색상 복원 및 스파크 노이즈 섞기
      if (this.colorStyle === 'full-random') {
        c.setHSL((fw.baseHue + Math.random() * 0.1) % 1.0, 0.9, 0.6);
      } else if (this.colorStyle === 'neon') {
        c.setHSL(index % 2 === 0 ? 0.93 : 0.48, 1.0, 0.6);
      } else if (this.colorStyle === 'pastel') {
        c.setHSL(index % 2 === 0 ? 0.74 : 0.10, 0.8, 0.7);
      } else if (this.colorStyle === 'custom') {
        c.set(index % 2 === 0 ? customColors.gas1 : customColors.gas2);
      } else {
        c.setHSL(index / this.numBands, 0.9, 0.5);
      }

      // 아주 약간의 흰색 스파크 섞기 (10% 확률)
      if (Math.random() < 0.1) c.setHex(0xffffff);

      col[j*3] = c.r; col[j*3+1] = c.g; col[j*3+2] = c.b;
      
      // 폭발 시 모든 파티클 크기 팽창
      siz[j] = Math.random() * 1.5 + 0.5;

      // 💡 핵심 구형 폭발 물리 벡터 연산 (구좌표계 무작위 방향)
      const phi = Math.acos(-1 + (2 * j) / this.particlesPerFirework);
      const theta = Math.sqrt(this.particlesPerFirework * Math.PI) * phi;
      
      // 폭발력에 비례한 산개 속도
      const speed = (Math.random() * 0.2 + 0.05) * (1.0 + force * 2.0); 
      
      fw.vel[j*3] = Math.cos(theta) * Math.sin(phi) * speed;
      fw.vel[j*3+1] = Math.sin(theta) * Math.sin(phi) * speed;
      fw.vel[j*3+2] = Math.cos(phi) * speed;
    }

    fw.geo.attributes.color.needsUpdate = true;
    fw.geo.attributes.pSize.needsUpdate = true;
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // UI 컨트롤 데이터 수집
    let seed = 42, scatter = 2.2, glow = 0.85, gain = 1.0;
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

    if (window.cosmicEngineSettings) {
      seed = window.cosmicEngineSettings.seed;
      scatter = window.cosmicEngineSettings.scatterExponent; 
      glow = window.cosmicEngineSettings.glowIntensity;      
      gain = window.cosmicEngineSettings.audioGain;          
      customColors = window.cosmicEngineSettings.customColors;
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
    }

    // 12채널 주파수 쪼개기
    const currentFreqBins = new Float32Array(this.numBands);
    if (audioData) {
      for (let i = 0; i < this.numBands; i++) {
        let factor = i / (this.numBands - 1);
        if (factor < 0.25) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, factor * 4.0);
        else if (factor < 0.75) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (factor - 0.25) * 2.0);
        else currentFreqBins[i] = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (factor - 0.75) * 4.0);
        
        currentFreqBins[i] *= gain;
      }
    }

    const gravity = 0.008; // 폭발 후 파티클이 떨어지는 중력

    // 12개 불꽃 시스템 업데이트
    for (let i = 0; i < this.numBands; i++) {
      const fw = this.fireworks[i];
      const currentFreq = currentFreqBins[i];
      const delta = currentFreq - this.prevFreqBins[i];
      this.prevFreqBins[i] = currentFreq;

      // 💡 [발사 트리거] 주파수가 특정 임계치 이상 강하게 튀어 오르고, 현재 대기(idle) 상태일 때 발사
      if (delta > 0.08 && fw.state === 'idle') {
        this.triggerLaunch(i, delta, scatter, seed, customColors);
      }

      const pos = fw.geo.attributes.position.array;
      const siz = fw.geo.attributes.pSize.array;

      if (fw.state === 'launch') {
        // [상승 로직] 로켓이 위로 솟구침
        fw.y += fw.vy;
        for (let j = 0; j < this.particlesPerFirework; j++) {
          pos[j*3+1] = fw.y; // 뭉친 파티클 전체 고도 상승
        }

        // 목표 고도 도달 시 폭발 상태로 전이
        if (fw.y >= fw.targetY) {
          this.triggerExplode(i, currentFreq, customColors);
        }
        fw.geo.attributes.position.needsUpdate = true;
      } 
      else if (fw.state === 'explode') {
        // [폭발 로직] 파티클 산개 및 중력 낙하
        fw.age++;
        
        for (let j = 0; j < this.particlesPerFirework; j++) {
          // 속도에 중력 적용 및 감쇠 (공기 저항)
          fw.vel[j*3] *= 0.96;
          fw.vel[j*3+1] -= gravity; 
          fw.vel[j*3+1] *= 0.96;
          fw.vel[j*3+2] *= 0.96;

          // 위치 이동
          pos[j*3] += fw.vel[j*3];
          pos[j*3+1] += fw.vel[j*3+1];
          pos[j*3+2] += fw.vel[j*3+2];
          
          // 파티클 점점 작아짐
          siz[j] *= 0.96;
        }

        // 전체 메쉬 투명도를 서서히 깎음 (Fade out)
        fw.mesh.material.opacity -= 0.015;
        
        // 완전히 투명해지면 재장전(idle) 대기 상태로 전환
        if (fw.mesh.material.opacity <= 0) {
          fw.state = 'idle';
          // 대기 중 렌더링 부하 최소화를 위해 0으로 수렴
          for(let j=0; j<this.particlesPerFirework; j++) siz[j] = 0;
        }

        fw.geo.attributes.position.needsUpdate = true;
        fw.geo.attributes.pSize.needsUpdate = true;
      }
      
      // UI Glow 강도 연동 (폭발 중일 때만)
      if (fw.state === 'explode') {
         fw.mesh.material.size = Math.max(0.5, glow * 1.5);
      }
    }

    // 전체 카메라 회전 (잔잔한 우주 유영 연출)
    const time = Date.now() * 0.001;
    this.scene.rotation.y = Math.sin(time * 0.2) * 0.15;

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
    this.fireworks.forEach(fw => {
      fw.geo.dispose();
      fw.mesh.material.dispose();
      this.scene.remove(fw.mesh);
    });
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.fireworks = [];
  }
}
