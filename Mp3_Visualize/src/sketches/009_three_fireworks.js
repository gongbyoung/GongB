/**
 * 009_three_fireworks.js
 * 자동 발사 후 주파수 타격(Spike) 시 상공 폭발형 12채널 불꽃놀이
 */
export default class ThreeFireworksStage {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numBands = 12; 
    this.particlesPerFirework = 600; 
    
    this.fireworks = []; 
    this.prevFreqBins = new Float32Array(this.numBands); 

    this.loadedSeed = -1;
    this.colorStyle = '';
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.02);

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 20); 
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
      const vel = new Float32Array(this.particlesPerFirework * 3);

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('pSize', new THREE.BufferAttribute(siz, 1));

      const mat = new THREE.PointsMaterial({
        size: 1.0,
        map: tex,
        vertexColors: true,
        transparent: true,
        opacity: 0.0, // 처음엔 투명(idle)
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

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

      this.fireworks.push({
        mesh: mesh,
        geo: geo,
        vel: vel,
        state: 'idle', // 'idle', 'launch' (자동 비행), 'explode' (주파수 타격)
        x: 0, y: -5, z: 0,
        vy: 0,
        age: 0,
        maxAge: 0,
        baseHue: (i / this.numBands)
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

  // 💡 [수정 1: 자동 발사] 음악과 상관없이 불꽃이 무작위 타이밍에 밑에서 솟아올라 상공 대기
  autoLaunch(index, scatter, seed) {
    const fw = this.fireworks[index];
    fw.state = 'launch';
    fw.age = 0;
    fw.maxAge = 40 + Math.random() * 40; // 상공에 머무는 대기 한계 시간 (프레임)
    
    const span = 22 * (scatter / 2.2);
    fw.x = - (span / 2) + (index / (this.numBands - 1)) * span;
    fw.y = -5; 
    fw.z = (this.seededRandom(seed + index) - 0.5) * 5; 
    
    fw.vy = 0.3 + Math.random() * 0.2; // 일정한 속도로 발사

    const pos = fw.geo.attributes.position.array;
    const col = fw.geo.attributes.color.array;
    const siz = fw.geo.attributes.pSize.array;

    for (let j = 0; j < this.particlesPerFirework; j++) {
      pos[j*3] = fw.x; pos[j*3+1] = fw.y; pos[j*3+2] = fw.z;
      col[j*3] = 1.0; col[j*3+1] = 0.9; col[j*3+2] = 0.6; // 불씨 색상
      siz[j] = j === 0 ? 2.5 : 0.0;
      fw.vel[j*3] = 0; fw.vel[j*3+1] = 0; fw.vel[j*3+2] = 0;
    }

    fw.mesh.material.opacity = 0.8;
    fw.geo.attributes.position.needsUpdate = true;
    fw.geo.attributes.color.needsUpdate = true;
    fw.geo.attributes.pSize.needsUpdate = true;
  }

  // 💡 [수정 2: 주파수 폭발] 상공에 떠 있을 때 음악이 치고 올라오면 터짐
  triggerExplode(index, force, customColors, seed) {
    const fw = this.fireworks[index];
    fw.state = 'explode';
    fw.age = 0;
    
    const pos = fw.geo.attributes.position.array;
    const col = fw.geo.attributes.color.array;
    const siz = fw.geo.attributes.pSize.array;
    
    const c = new THREE.Color();

    for (let j = 0; j < this.particlesPerFirework; j++) {
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

      if (Math.random() < 0.1) c.setHex(0xffffff);

      col[j*3] = c.r; col[j*3+1] = c.g; col[j*3+2] = c.b;
      
      siz[j] = Math.random() * 1.5 + 0.5;

      const phi = Math.acos(-1 + (2 * j) / this.particlesPerFirework);
      const theta = Math.sqrt(this.particlesPerFirework * Math.PI) * phi;
      
      // 폭발력(Audio Gain)에 비례한 엄청난 산개 속도 (force 기반)
      const speed = (Math.random() * 0.2 + 0.05) * (1.0 + force * 15.0); 
      
      fw.vel[j*3] = Math.cos(theta) * Math.sin(phi) * speed;
      fw.vel[j*3+1] = Math.sin(theta) * Math.sin(phi) * speed;
      fw.vel[j*3+2] = Math.cos(phi) * speed;
    }

    fw.mesh.material.opacity = 1.0;
    fw.geo.attributes.color.needsUpdate = true;
    fw.geo.attributes.pSize.needsUpdate = true;
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

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

    const gravity = 0.006; 

    for (let i = 0; i < this.numBands; i++) {
      const fw = this.fireworks[i];
      const currentFreq = currentFreqBins[i];
      
      // 스무딩 처리된 미분값 계산 (튀는 소리만 정확히 캐치)
      const delta = currentFreq - this.prevFreqBins[i];
      this.prevFreqBins[i] += (currentFreq - this.prevFreqBins[i]) * 0.3;

      // 💡 1. [자동 발사 관리] 쉬고 있는 불꽃은 무작위 타이밍에 계속 위로 자동 쏘아올림
      if (fw.state === 'idle' && Math.random() < 0.03) {
        if (this.colorStyle === 'full-random') {
          fw.baseHue = this.seededRandom(seed + i * 99 + Date.now() % 100);
        }
        this.autoLaunch(i, scatter, seed);
      }

      const pos = fw.geo.attributes.position.array;
      const siz = fw.geo.attributes.pSize.array;

      if (fw.state === 'launch') {
        // 불꽃 상승
        fw.y += fw.vy;
        fw.vy *= 0.98; // 점점 속도 줄어듦
        fw.age++;

        for (let j = 0; j < this.particlesPerFirework; j++) {
          pos[j*3+1] = fw.y;
        }
        fw.geo.attributes.position.needsUpdate = true;

        // 💡 2. [주파수 폭발] 상공에 떠있을 때 비트가 치고 올라오면(delta > 0.05) 그 에너지를 받아 쾅 터짐
        if (delta > 0.05 && fw.vy < 0.15) {
          this.triggerExplode(i, delta, customColors, seed);
        } 
        // 💡 3. [소멸] 수명이 다 될 때까지 음악이 안 터지면 불발탄처럼 사라짐
        else if (fw.age > fw.maxAge) {
          fw.mesh.material.opacity -= 0.05;
          if (fw.mesh.material.opacity <= 0) fw.state = 'idle';
        }
      } 
      else if (fw.state === 'explode') {
        // 폭발 파티클 중력 낙하 연산
        for (let j = 0; j < this.particlesPerFirework; j++) {
          fw.vel[j*3] *= 0.95;
          fw.vel[j*3+1] -= gravity; 
          fw.vel[j*3+1] *= 0.95;
          fw.vel[j*3+2] *= 0.95;

          pos[j*3] += fw.vel[j*3];
          pos[j*3+1] += fw.vel[j*3+1];
          pos[j*3+2] += fw.vel[j*3+2];
          
          siz[j] *= 0.96;
        }

        // 빛 잔상 서서히 소멸
        fw.mesh.material.opacity -= 0.015;
        if (fw.mesh.material.opacity <= 0) fw.state = 'idle';

        fw.geo.attributes.position.needsUpdate = true;
        fw.geo.attributes.pSize.needsUpdate = true;
      }
      
      if (fw.state === 'explode') {
         fw.mesh.material.size = Math.max(0.5, glow * 1.5);
      }
    }

    const time = Date.now() * 0.001;
    this.scene.rotation.y = Math.sin(time * 0.2) * 0.1;

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
