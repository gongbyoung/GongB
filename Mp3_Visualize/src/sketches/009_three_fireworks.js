/**
 * 009_three_fireworks.js
 * 12종 테마, 상승 조짐(Build-up) 발사 및 타격(Spike)/정점 폭발형 리얼 물리 엔진
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
        vx: 0, vy: 0, vz: 0, 
        age: 0, 
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

  // 💡 [조짐 발사] 볼륨이 올라가는 시점에 볼륨 크기(volumeForce)에 비례한 속도로 발사!
  triggerLaunch(index, volumeForce, scatter, seed) {
    const fw = this.fireworks[index];
    fw.state = 'launch';
    fw.age = 0;
    
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 20 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    // 화면을 벗어나지 않게 안전 여백 8 부여
    const usableWidth = (viewWidth - 8) * (scatter / 2.2); 
    const normalizedPos = index / (this.numBands - 1); 
    
    fw.x = - (usableWidth / 2) + normalizedPos * usableWidth;
    fw.y = - (viewHeight / 2) + 2; // 바닥 출발
    fw.z = (this.seededRandom(seed + index) - 0.5) * 6; 
    
    // 부채꼴 발사 각도
    const fanAngle = (normalizedPos - 0.5) * 0.15; 
    fw.vx = fanAngle + (Math.random() - 0.5) * 0.05; 
    fw.vz = (Math.random() - 0.5) * 0.05; 

    // 💡 핵심: 볼륨(volumeForce)이 클수록 상승 속도(vy)가 커져서 더 높이 올라감!
    const power = Math.min(1.0, volumeForce);
    fw.vy = 0.25 + power * 0.25; // 최소 0.25, 최대 0.5의 강력한 상승 속도

    const pos = fw.geo.attributes.position.array;
    const col = fw.geo.attributes.color.array;
    const siz = fw.geo.attributes.pSize.array;

    for (let j = 0; j < this.particlesPerFirework; j++) {
      pos[j*3] = fw.x; pos[j*3+1] = fw.y; pos[j*3+2] = fw.z;
      col[j*3] = 1.0; col[j*3+1] = 0.9; col[j*3+2] = 0.6; 
      siz[j] = j === 0 ? 2.5 : 0.0; // 날아가는 심지 표현
      fw.vel[j*3] = 0; fw.vel[j*3+1] = 0; fw.vel[j*3+2] = 0;
    }

    fw.mesh.material.opacity = 0.9;
    fw.geo.attributes.position.needsUpdate = true;
    fw.geo.attributes.color.needsUpdate = true;
    fw.geo.attributes.pSize.needsUpdate = true;
  }

  // 💡 [비트 폭발] 현재 상공에 있는 높이 그대로, 볼륨(volumeForce)에 비례한 크기로 터짐
  triggerExplode(index, volumeForce, customColors, seed) {
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
      
      // 파티클 크기도 작게 최적화
      siz[j] = Math.random() * 0.7 + 0.3;

      // 💡 핵심: 볼륨(volumeForce)이 클수록 폭발 반경(speed)이 거대해짐
      const power = Math.min(1.0, volumeForce * 1.5); 
      const speed = (Math.random() * 0.08 + 0.05) * (1.0 + power * 3.5); 
      
      let vx = 0, vy = 0, vz = 0;
      const t = Math.random() * Math.PI * 2;

      // 12가지 고유 폭발 모양
      switch(fw.type) {
        case 0: 
          const phi0 = Math.acos(-1 + (2 * j) / this.particlesPerFirework);
          const theta0 = Math.sqrt(this.particlesPerFirework * Math.PI) * phi0;
          vx = Math.cos(theta0) * Math.sin(phi0); vy = Math.sin(theta0) * Math.sin(phi0); vz = Math.cos(phi0); break;
        case 1: 
          vx = Math.pow(Math.sin(t), 3); vy = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16; vz = (Math.random() - 0.5) * 0.2; break;
        case 2: 
          const phi2 = Math.acos(-1 + (2 * j) / this.particlesPerFirework); const theta2 = Math.sqrt(this.particlesPerFirework * Math.PI) * phi2;
          vx = Math.cos(theta2) * Math.sin(phi2) * 0.8; vy = Math.sin(theta2) * Math.sin(phi2) * 0.5 + 0.5; vz = Math.cos(phi2) * 0.8; break;
        case 3: 
          const r3 = j % 2 === 0 ? 1 : 0.4; vx = r3 * Math.cos(t); vy = r3 * Math.sin(t); vz = (Math.random()-0.5)*0.1; break;
        case 4: 
          const r4 = 1 - Math.abs(Math.sin(t * 2.5)) * 0.6; vx = r4 * Math.cos(t); vy = r4 * Math.sin(t); vz = (Math.random()-0.5)*0.1; break;
        case 5: 
          const cluster = j % 4; const cx = [1, -1, 0, 0][cluster]; const cy = [0, 0, 1, -1][cluster];
          vx = (Math.random() - 0.5) + cx * 2; vy = (Math.random() - 0.5) + cy * 2; vz = (Math.random() - 0.5); break;
        case 6: 
          vx = (Math.random() - 0.5) * 0.4; vy = Math.random() * 1.5; vz = (Math.random() - 0.5) * 0.4; break;
        case 7: 
          const axis = j % 3;
          if (axis === 0) { vx = (Math.random()-0.5)*2; vy=0; vz=0; } else if (axis === 1) { vx = 0; vy = (Math.random()-0.5)*2; vz=0; } else { vx = 0; vy = 0; vz = (Math.random()-0.5)*2; } break;
        case 8: 
          if (j < 200) { vx = Math.cos(t)*1.5; vy = (Math.random()-0.5)*0.1; vz = Math.sin(t)*1.5; } else {
            const phi8 = Math.acos(-1 + (2 * j) / 400); const theta8 = Math.sqrt(400 * Math.PI) * phi8;
            vx = Math.cos(theta8)*Math.sin(phi8); vy = Math.sin(theta8)*Math.sin(phi8); vz = Math.cos(phi8); } break;
        case 9: 
          const r9 = j / this.particlesPerFirework; vx = r9 * Math.cos(j * 0.1); vy = r9 * Math.sin(j * 0.1); vz = (Math.random()-0.5)*0.2; break;
        case 10: 
          vx = Math.cos(t); vy = Math.sin(t); vz = 0; break;
        case 11: 
          vx = (Math.random() - 0.5) * 2; vy = (Math.random() - 0.5) * 2; vz = (Math.random() - 0.5) * 2; break;
      }

      const len = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1;
      
      // 💡 [관성 물리] 상승하던 방향 에너지를 이어받아 현실적으로 찌그러지며 폭발
      fw.vel[j*3] = (vx / len) * speed + (fw.vx * 0.8);
      fw.vel[j*3+1] = (vy / len) * speed + (fw.vy * 0.3); 
      fw.vel[j*3+2] = (vz / len) * speed + (fw.vz * 0.8);
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
      this.prevFreqBins[i] += (currentFreq - this.prevFreqBins[i]) * 0.3; // 스무딩

      // 💡 [발사 감지] 볼륨이 일정 이상(0.1)이고, 상승 조짐(delta > 0.015)이 보이면 즉시 쏘아 올림
      if (fw.state === 'idle' && currentFreq > 0.1 && delta > 0.015) {
        if (this.colorStyle === 'full-random') {
           fw.baseHue = this.seededRandom(seed + i * 99 + Date.now() % 100);
        }
        this.triggerLaunch(i, currentFreq, scatter, seed);
      }

      const pos = fw.geo.attributes.position.array;
      const siz = fw.geo.attributes.pSize.array;

      if (fw.state === 'launch') {
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.z += fw.vz;
        fw.vy -= 0.008; // 로켓 중력
        fw.age++;

        for (let j = 0; j < this.particlesPerFirework; j++) {
          pos[j*3] = fw.x; pos[j*3+1] = fw.y; pos[j*3+2] = fw.z;
        }
        fw.geo.attributes.position.needsUpdate = true;

        // 💡 [폭발 감지] 비트가 강하게 튀거나(Spike), 중력에 의해 정점(vy <= 0)에 도달하면 무조건 터짐
        if ((delta > 0.05 && fw.age > 8) || fw.vy <= 0) {
          this.triggerExplode(i, currentFreq, customColors, seed);
        }
      } 
      else if (fw.state === 'explode') {
        let g = fw.type === 2 ? 0.010 : 0.005; 
        let drag = fw.type === 6 ? 0.92 : 0.96; 
        let fadeOut = fw.type === 2 ? 0.006 : 0.015; 

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
         fw.mesh.material.size = Math.max(0.2, glow * 0.8);
      }
    }

    const time = Date.now() * 0.001;
    this.scene.rotation.y = Math.sin(time * 0.1) * 0.05;

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
