/**
 * 009_three_fireworks.js
 * 12가지 고유한 모양(하트, 버들가지, 별 등)과 화면 경계 제한이 적용된 불꽃놀이 렌더러
 */
export default class ThreeFireworksStage {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numBands = 12; // 12종 불꽃
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
        opacity: 0.0, 
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
        state: 'idle',
        x: 0, y: -5, z: 0,
        vy: 0, targetY: 0,
        age: 0, maxAge: 0,
        baseHue: (i / this.numBands),
        type: i // 💡 0~11번까지 12가지 고유 모양 인덱스
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

  autoLaunch(index, scatter, seed) {
    const fw = this.fireworks[index];
    fw.state = 'launch';
    fw.age = 0;
    fw.maxAge = 40 + Math.random() * 40; 
    
    // 💡 [화면 비율(Bounds) 역계산] 카메라 밖으로 절대 안 나가게 가두리 양식
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 20 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    // X축 가두리 (화면 끝에서 2씩 여백)
    const usableWidth = (viewWidth - 4) * (scatter / 2.2); 
    fw.x = - (usableWidth / 2) + (index / (this.numBands - 1)) * usableWidth;
    
    // Y축 가두리 (화면 상단 절반 안에서만 터지도록)
    fw.y = - (viewHeight / 2) + 2; // 바닥에서 출발
    fw.targetY = 2 + (Math.random() * (viewHeight / 2 - 4)); // 상공 목표점
    fw.z = (this.seededRandom(seed + index) - 0.5) * 4; 
    
    fw.vy = 0.35 + Math.random() * 0.15; 

    const pos = fw.geo.attributes.position.array;
    const col = fw.geo.attributes.color.array;
    const siz = fw.geo.attributes.pSize.array;

    for (let j = 0; j < this.particlesPerFirework; j++) {
      pos[j*3] = fw.x; pos[j*3+1] = fw.y; pos[j*3+2] = fw.z;
      col[j*3] = 1.0; col[j*3+1] = 0.9; col[j*3+2] = 0.6; 
      siz[j] = j === 0 ? 3.0 : 0.0;
      fw.vel[j*3] = 0; fw.vel[j*3+1] = 0; fw.vel[j*3+2] = 0;
    }

    fw.mesh.material.opacity = 0.9;
    fw.geo.attributes.position.needsUpdate = true;
    fw.geo.attributes.color.needsUpdate = true;
    fw.geo.attributes.pSize.needsUpdate = true;
  }

  // 💡 12가지 모양을 수학적으로 그리는 핵심 엔진
  triggerExplode(index, force, customColors, seed) {
    const fw = this.fireworks[index];
    fw.state = 'explode';
    fw.age = 0;
    
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

      const speed = (Math.random() * 0.2 + 0.05) * (1.0 + force * 15.0); 
      let vx = 0, vy = 0, vz = 0;
      const t = Math.random() * Math.PI * 2;

      // 💡 [12가지 불꽃놀이 모양 수학적 스위칭]
      switch(fw.type) {
        case 0: // 0: 기본 구형 (Peony)
          const phi0 = Math.acos(-1 + (2 * j) / this.particlesPerFirework);
          const theta0 = Math.sqrt(this.particlesPerFirework * Math.PI) * phi0;
          vx = Math.cos(theta0) * Math.sin(phi0);
          vy = Math.sin(theta0) * Math.sin(phi0);
          vz = Math.cos(phi0);
          break;
        case 1: // 1: 하트 (Heart)
          vx = Math.pow(Math.sin(t), 3);
          vy = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16;
          vz = (Math.random() - 0.5) * 0.2;
          break;
        case 2: // 2: 버들가지 (Willow - 무겁게 아래로 처짐)
          const phi2 = Math.acos(-1 + (2 * j) / this.particlesPerFirework);
          const theta2 = Math.sqrt(this.particlesPerFirework * Math.PI) * phi2;
          vx = Math.cos(theta2) * Math.sin(phi2) * 0.8;
          vy = Math.sin(theta2) * Math.sin(phi2) * 0.5 + 0.5; // 위로 솟았다가
          vz = Math.cos(phi2) * 0.8;
          break;
        case 3: // 3: 이중 고리 (Double Ring)
          const r3 = j % 2 === 0 ? 1 : 0.4;
          vx = r3 * Math.cos(t); vy = r3 * Math.sin(t); vz = (Math.random()-0.5)*0.1;
          break;
        case 4: // 4: 별 모양 (Star)
          const r4 = 1 - Math.abs(Math.sin(t * 2.5)) * 0.6;
          vx = r4 * Math.cos(t); vy = r4 * Math.sin(t); vz = (Math.random()-0.5)*0.1;
          break;
        case 5: // 5: 다중 폭발 (Multi-burst)
          const cluster = j % 4;
          const cx = [1, -1, 0, 0][cluster];
          const cy = [0, 0, 1, -1][cluster];
          vx = (Math.random() - 0.5) + cx * 2;
          vy = (Math.random() - 0.5) + cy * 2;
          vz = (Math.random() - 0.5);
          break;
        case 6: // 6: 위로 솟는 분수 (Fountain)
          vx = (Math.random() - 0.5) * 0.4;
          vy = Math.random() * 1.5;
          vz = (Math.random() - 0.5) * 0.4;
          break;
        case 7: // 7: 십자형 (Cross)
          const axis = j % 3;
          if (axis === 0) { vx = (Math.random()-0.5)*2; vy=0; vz=0; }
          else if (axis === 1) { vx = 0; vy = (Math.random()-0.5)*2; vz=0; }
          else { vx = 0; vy = 0; vz = (Math.random()-0.5)*2; }
          break;
        case 8: // 8: 토성 (Saturn - 구형 + 링)
          if (j < 200) {
            vx = Math.cos(t)*1.5; vy = (Math.random()-0.5)*0.1; vz = Math.sin(t)*1.5;
          } else {
            const phi8 = Math.acos(-1 + (2 * j) / 400);
            const theta8 = Math.sqrt(400 * Math.PI) * phi8;
            vx = Math.cos(theta8)*Math.sin(phi8); vy = Math.sin(theta8)*Math.sin(phi8); vz = Math.cos(phi8);
          }
          break;
        case 9: // 9: 나선형 (Spiral)
          const r9 = j / this.particlesPerFirework;
          vx = r9 * Math.cos(j * 0.1); vy = r9 * Math.sin(j * 0.1); vz = (Math.random()-0.5)*0.2;
          break;
        case 10: // 10: 납작한 디스크 (Flat Disc)
          vx = Math.cos(t); vy = Math.sin(t); vz = 0;
          break;
        case 11: // 11: 혼돈 (Random Chaos)
          vx = (Math.random() - 0.5) * 2;
          vy = (Math.random() - 0.5) * 2;
          vz = (Math.random() - 0.5) * 2;
          break;
      }

      // 벡터 정규화 및 속도 적용
      const len = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1;
      fw.vel[j*3] = (vx / len) * speed;
      fw.vel[j*3+1] = (vy / len) * speed;
      fw.vel[j*3+2] = (vz / len) * speed;
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

    for (let i = 0; i < this.numBands; i++) {
      const fw = this.fireworks[i];
      const currentFreq = currentFreqBins[i];
      
      const delta = currentFreq - this.prevFreqBins[i];
      this.prevFreqBins[i] += (currentFreq - this.prevFreqBins[i]) * 0.3;

      if (fw.state === 'idle' && Math.random() < 0.04) {
        this.autoLaunch(i, scatter, seed);
      }

      const pos = fw.geo.attributes.position.array;
      const siz = fw.geo.attributes.pSize.array;

      if (fw.state === 'launch') {
        fw.y += fw.vy;
        fw.vy *= 0.98;
        fw.age++;

        for (let j = 0; j < this.particlesPerFirework; j++) pos[j*3+1] = fw.y;
        fw.geo.attributes.position.needsUpdate = true;

        if (delta > 0.06 && fw.vy < 0.15) {
          this.triggerExplode(i, delta, customColors, seed);
        } else if (fw.age > fw.maxAge) {
          fw.mesh.material.opacity -= 0.05;
          if (fw.mesh.material.opacity <= 0) fw.state = 'idle';
        }
      } 
      else if (fw.state === 'explode') {
        // 💡 12가지 테마별 물리 특성 적용 (버들가지(2번)는 중력이 세고 오래 남음)
        let g = fw.type === 2 ? 0.012 : 0.006; 
        let drag = fw.type === 6 ? 0.92 : 0.95; // 분수는 금방 느려짐
        let fadeOut = fw.type === 2 ? 0.005 : 0.015; // 버들가지는 잔상이 길게

        for (let j = 0; j < this.particlesPerFirework; j++) {
          fw.vel[j*3] *= drag;
          fw.vel[j*3+1] -= g; 
          fw.vel[j*3+1] *= drag;
          fw.vel[j*3+2] *= drag;

          pos[j*3] += fw.vel[j*3];
          pos[j*3+1] += fw.vel[j*3+1];
          pos[j*3+2] += fw.vel[j*3+2];
          
          siz[j] *= 0.96;
        }

        fw.mesh.material.opacity -= fadeOut;
        if (fw.mesh.material.opacity <= 0) fw.state = 'idle';

        fw.geo.attributes.position.needsUpdate = true;
        fw.geo.attributes.pSize.needsUpdate = true;
      }
      
      if (fw.state === 'explode') {
         fw.mesh.material.size = Math.max(0.5, glow * 1.5);
      }
    }

    const time = Date.now() * 0.001;
    this.scene.rotation.y = Math.sin(time * 0.1) * 0.05; // 잔잔한 회전

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
