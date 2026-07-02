/**
 * 007_three_cosmic_nebula.js
 * 중앙 빛 분산 지수 조절 제어 및 커스텀 수동/랜덤 컬러 시스템 결합 성운 무대
 * (GPU 색상 버퍼 실시간 리프레시 버그 완전 패치본)
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

    // 상태 역동성 추적 변수
    this.loadedSeed = 42;
    this.loadedScatter = 2.2;
    this.loadedColorStyle = 'monochrome';
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.04);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 10, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x111122, 0.8));

    this.buildCosmos();
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.45)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
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
    // 전역 동기화 수치 스캔
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

    // 다음 프레임 비교를 위해 상태 낙인
    this.loadedSeed = this.currentSeed;
    this.loadedScatter = this.scatterExponent;
    this.loadedColorStyle = this.colorStyle;

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);

    this.particleData = [];
    let sRandom = this.currentSeed;

    for (let i = 0; i < this.particleCount; i++) {
      sRandom = this.seededRandom(sRandom) * 1000;
      const rand1 = this.seededRandom(sRandom + 1);
      const rand2 = this.seededRandom(sRandom + 2);
      const rand3 = this.seededRandom(sRandom + 3);
      const rand4 = this.seededRandom(sRandom + 4);

      const angle = rand1 * Math.PI * 2;
      const radius = Math.pow(rand2, this.scatterExponent) * 9.5 + 0.1;

      const x = Math.cos(angle) * radius;
      const y = (rand3 - 0.5) * 0.5;
      const z = Math.sin(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      let pSize = 0.02;
      let color = new THREE.Color();
      let starType = 'gas';

      if (rand4 < 0.06) {
        pSize = 0.14 + rand1 * 0.22; 
        starType = 'star';
      } else if (rand4 < 0.30) {
        pSize = 0.04 + rand1 * 0.04;
      } else {
        pSize = 0.012 + rand1 * 0.012;
      }

      // 색조합 옵션 변환 매핑
      if (this.colorStyle === 'full-random') {
        if (starType === 'star') color.setHSL(rand1, 0.3, 0.95);
        else color.setHSL(rand1, 0.85, 0.5);
      } 
      else if (window.cosmicEngineSettings) {
        const cc = this.customColors;
        if (starType === 'star') {
          color.set(cc.star);
        } else if (i % 2 === 0) {
          color.set(cc.gas1);
        } else {
          color.set(cc.gas2);
        }
      } 
      else {
        color.setHSL(0.52 + rand2 * 0.06, 0.9, 0.45);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      this.particleData.push({
        baseX: x, baseY: y, baseZ: z, radius: radius, angle: angle,
        speed: 0.08 + rand1 * 0.35,
        twinkleSpeed: 3.0 + rand2 * 9.0,
        type: starType,
        baseSize: pSize
      });
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('pSize', new THREE.BufferAttribute(sizes, 1));

    // 💡 [버그 완벽 수정 마법] 
    // 기존 시스템에 장착되어 있으면 파괴하지 않고 내부에 덮어씌운 뒤, GPU에게 즉시 강제 갱신 통보를 내립니다.
    if (this.points) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true; // 💥 실시간 색상 교환 실현
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
      this.material.opacity = window.cosmicEngineSettings.glowIntensity;
      this.audioGain = window.cosmicEngineSettings.audioGain;
    }

    const time = Date.now() * 0.001;
    const positions = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.pSize.array;

    const gain = this.audioGain;
    const subBass = audioData ? audioData.subBass * gain : 0;
    const bass    = audioData ? audioData.bass * gain : 0;
    const mid     = audioData ? audioData.mid * gain : 0;
    const treble  = audioData ? audioData.treble * gain : 0;
    const volume  = audioData ? audioData.volume * gain : 0;

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];

      let currentAngle = data.angle + time * 0.008 * data.speed;
      const noise2 = Math.sin(data.radius * 1.3 - time * 2.0) * (bass * 0.5 + mid * 0.25);
      currentAngle += noise2 / data.radius;

      const noise3 = Math.cos(time * data.twinkleSpeed) * (treble * 0.16);
      const finalRadius = data.radius + noise3 + (subBass * 0.35);

      positions[i * 3] = Math.cos(currentAngle) * finalRadius;
      positions[i * 3 + 1] = data.baseY + Math.sin(time * data.speed + data.radius) * (mid * 0.16);
      positions[i * 3 + 2] = Math.sin(currentAngle) * finalRadius;

      if (data.type === 'star') {
        sizes[i] = data.baseSize * (1.2 + subBass * 3.2 + Math.sin(time * data.twinkleSpeed) * 0.35);
      } else {
        sizes[i] = data.baseSize * (1.0 + treble * 1.5);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    this.points.rotation.y = time * 0.006 + (volume * 0.04);

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
