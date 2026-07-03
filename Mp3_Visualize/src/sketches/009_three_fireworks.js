/**
 * 009_three_fireworks.js
 * 실시간 주파수 피크(Peak) 추적 폭발 및 화면 경계가 제한된 12종 리얼 불꽃놀이
 */
export default class ThreeFireworksStage {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numBands = 12; // 12개 주파수 채널
    this.particlesPerFirework = 600; 
    
    this.fireworks = []; 
    // 💡 주파수의 꺾임(Peak)을 감지하기 위한 이전 프레임 버퍼
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
        peakFreq: 0, 
        baseHue: (i / this.numBands),
        type: i 
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

  triggerLaunch(index, currentFreq, scatter, seed) {
    const fw = this.fireworks[index];
    fw.state = 'launch';
    fw.peakFreq = currentFreq;
    
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 20 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    const maxUsableWidth = viewWidth - 6;
    const scatterScale = Math.min(1.0, scatter / 4.0);
    const span = maxUsableWidth * scatterScale;
    const normalizedPos = index / (this.numBands - 1); 
    
    fw.x = - (span / 2) + normalizedPos * span;
    fw.z = (this.seededRandom(seed + index) - 0.5) * 3; 
    fw.y = -5;

    const pos = fw.geo.attributes.position.array;
    const col = fw.geo.attributes.color.array;
    const siz = fw.geo.attributes.pSize.array;

    for (let j = 0; j < this.particlesPerFirework; j++) {
      pos[j*3] = fw.x; pos[j*3+1] = fw.y; pos[j*3+2] = fw.z;
      col[j*3] = 1.0; col[j*3+1] = 0.9; col[j*3+2] = 0.6; 
      siz[j] = j === 0 ? 3.0 : 0.0; 
      fw.vel[j*3] = 0; fw.vel[j*3+1] = 0; fw.vel[j*3+2] = 0;
    }

    fw.mesh.material.opacity = 1.0;
    fw.geo.attributes.position.needsUpdate = true;
    fw.geo.attributes.color.needsUpdate = true;
    fw.geo.attributes.pSize.needsUpdate = true;
  }

  triggerExplode(index, burstForce, customColors, seed) {
    const fw = this.fireworks[index];
    fw.state = 'explode';
    
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
      siz[j] = Math.random() * 0.7 + 0.3; 

      const power = Math.min(1.0, burstForce * 1.5); 
      const speed = (Math.random() * 0.1 + 0.05) * (1.0 + power * 4.0); 
      
      let vx = 0, vy = 0, vz = 0;
      const t = Math.random() * Math.PI * 2;

      switch(fw.type) {
        case 0: // 구형
          const phi0 = Math.acos(-1 + (2 * j) / this.particlesPerFirework);
          const theta0 = Math.sqrt(this.particlesPerFirework * Math.PI) * phi0;
          vx = Math.cos(theta0) * Math.sin(phi0); vy = Math.sin(theta0) * Math.sin(phi0); vz = Math.cos(phi0); break;
        
        case 1: // 흩뿌려진 하트
          vx = Math.pow(Math.sin(t), 3); vy = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16; vz = (Math.random() - 0.5) * 0.2; break;
        
        case 2: // 버들가지 (무겁게 흘러내림)
          const phi2 = Math.acos(-1 + (2 * j) / this.particlesPerFirework); const theta2 = Math.sqrt(this.particlesPerFirework * Math.PI) * phi2;
          vx = Math.cos(theta2) * Math.sin(phi2) * 0.8; vy = Math.sin(theta2) * Math.sin(phi2) * 0.5 + 0.5; vz = Math.cos(phi2) * 0.8; break;
        
        case 3: // 이중 고리
          const r3 = j % 2 === 0 ? 1 : 0.4; vx = r3 * Math.cos(t); vy = r3 * Math.sin(t); vz = (Math.random()-0.5)*0.1; break;
        
        case 4: // 별모양
          const r4 = 1 - 0.5 * Math.abs(Math.sin(t * 2.5)); vx = r4 * Math.cos(t); vy = r4 * Math.sin(t); vz = (Math.random()-0.5)*0.1; break;
        
        case 5: // 💡 [수정] 십자가 폭발 제거 -> 데이지 꽃모양(Flower)으로 변경
          const petals = 6;
          const radius = 1.0 + 0.5 * Math.sin(petals * t);
          vx = radius * Math.cos(t) * 1.2; vy = radius * Math.sin(t) * 1.2; vz = (Math.random() - 0.5) * 0.1; break;
        
        case 6: // 분수
          vx = (Math.random() - 0.5) * 0.4; vy = Math.random() * 1.5; vz = (Math.random() - 0.5) * 0.4; break;
        
        case 7: // 💡 [수정] 속이 빈 거대 하트 (Hollow Heart - 외곽선만 뚜렷하게 발광)
          const t7 = (j / this.particlesPerFirework) * Math.PI * 2; // 선을 이어 그리기 위한 균등 분배
          const hx = Math.pow(Math.sin(t7), 3);
          const hy = (13 * Math.cos(t7) - 5 * Math.cos(2*t7) - 2 * Math.cos(3*t7) - Math.cos(4*t7)) / 16;
          // 선명한 외곽선에 미세한 두께(0.05)만 추가, 크기는 1.5배로 크게
          vx = hx * 1.5 + (Math.random() - 0.5) * 0.05; 
          vy = hy * 1.5 + (Math.random() - 0.5) * 0.05; 
          vz = (Math.random() - 0.5) * 0.05; 
          break;
        
        case 8: // 토성
          if (j < 200) { vx = Math.cos(t)*1.5; vy = (Math.random()-0.5)*0.1; vz = Math.sin(t)*1.5; } 
          else { const phi8 = Math.acos(-1 + (2 * j) / 400); const theta8 = Math.sqrt(400 * Math.PI) * phi8;
            vx = Math.cos(theta8)*Math.sin(phi8); vy = Math.sin(theta8)*Math.sin(phi8); vz = Math.cos(phi8); } break;
        
        case 9: // 나선형
          const r9 = j / this.particlesPerFirework; vx = r9 * Math.cos(j * 0.1); vy = r9 * Math.sin(j * 0.1); vz = (Math.random()-0.5)*0.2; break;
        
        case 10: // 원반
          vx = Math.cos(t) * Math.random(); vy = Math.sin(t) * Math.random(); vz = 0; break;
        
        case 11: // 브로케이드 (거대 팽창)
          const phi11 = Math.acos(-1 + (2 * j) / this.particlesPerFirework);
          const theta11 = Math.sqrt(this.particlesPerFirework * Math.PI) * phi11;
          vx = Math.cos(theta11)*Math.sin(phi11)*1.5; vy = Math.sin(theta11)*Math.sin(phi11)*1.5; vz = Math.cos(phi11)*1.5; break;
      }

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
      this.prevFreqBins[i] = currentFreq; 

      if (fw.state === 'idle') {
        if (currentFreq > 0.1 && delta > 0.02) {
          if (this.colorStyle === 'full-random') fw.baseHue = this.seededRandom(seed + i * 99 + Date.now() % 100);
          this.triggerLaunch(i, currentFreq, scatter, seed);
        }
      } 
      else if (fw.state === 'launch') {
        if (currentFreq > fw.peakFreq) {
          fw.peakFreq = currentFreq;
          fw.y = -5 + (currentFreq * 16); 
        } 
        else if (delta < -0.01 || currentFreq < 0.05) {
          this.triggerExplode(i, fw.peakFreq, customColors, seed);
        }

        const pos = fw.geo.attributes.position.array;
        for (let j = 0; j < this.particlesPerFirework; j++) pos[j*3+1] = fw.y;
        fw.geo.attributes.position.needsUpdate = true;
      } 
      else if (fw.state === 'explode') {
        let g = (fw.type === 2 || fw.type === 11) ? 0.012 : 0.005; 
        let drag = (fw.type === 6) ? 0.90 : 0.96; 
        let fadeOut = (fw.type === 2 || fw.type === 11) ? 0.006 : 0.015; 

        const pos = fw.geo.attributes.position.array;
        const siz = fw.geo.attributes.pSize.array;

        for (let j = 0; j < this.particlesPerFirework; j++) {
          fw.vel[j*3] *= drag;
          fw.vel[j*3+1] -= g; 
          fw.vel[j*3+1] *= drag;
          fw.vel[j*3+2] *= drag;

          pos[j*3] += fw.vel[j*3];
          pos[j*3+1] += fw.vel[j*3+1];
          pos[j*3+2] += fw.vel[j*3+2];
          
          siz[j] *= 0.97;
        }

        fw.mesh.material.opacity -= fadeOut;
        if (fw.mesh.material.opacity <= 0) fw.state = 'idle'; 

        fw.geo.attributes.position.needsUpdate = true;
        fw.geo.attributes.pSize.needsUpdate = true;
      }
      
      if (fw.state === 'explode') {
         fw.mesh.material.size = Math.max(0.2, glow * 0.8);
      }
    }

    const time = Date.now() * 0.001;
    this.scene.rotation.y = Math.sin(time * 0.1) * 0.02;

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
