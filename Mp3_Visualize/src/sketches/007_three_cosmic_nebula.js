/**
 * 007_three_cosmic_nebula.js
 * 극단적으로 시각적 피드백이 강력해진 하드코어 성운 렌더러 (컬러/씨드/Gain 완벽 동기화)
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
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
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

    // 💥 Seed가 바뀌면 나선팔(Spiral Arms) 개수와 비틀림 방향이 완전히 다르게 변하도록 지형 파괴 연산
    const spiralArms = (this.currentSeed % 4) + 2; 
    const swirlDirection = (this.currentSeed % 2 === 0) ? 1 : -1;

    for (let i = 0; i < this.particleCount; i++) {
      sRandom = this.seededRandom(sRandom) * 1000;
      const rand1 = this.seededRandom(sRandom + 1);
      const rand2 = this.seededRandom(sRandom + 2);
      const rand3 = this.seededRandom(sRandom + 3);
      const rand4 = this.seededRandom(sRandom + 4);

      // 나선 팔 지형 수학적 배치
      const armOffset = Math.floor(rand1 * spiralArms) * ((Math.PI * 2) / spiralArms);
      const radius = Math.pow(rand2, this.scatterExponent) * 11.0 + 0.1;
      
      // 거리에 따라 나선이 감기는 형태 (Seed 연동)
      const angle = armOffset + (radius * 0.4 * swirlDirection) + (rand3 * 0.8);

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
        pSize = 0.16 + rand1 * 0.25; 
        starType = 'star';
      } else if (rand4 < 0.30) {
        pSize = 0.04 + rand1 * 0.04;
      } else {
        pSize = 0.015 + rand1 * 0.015;
      }

      // 🎨 [버그 해결] 드롭다운 메뉴별 명확한 분기 처리 복구 완료!
      if (this.colorStyle === 'neon') {
        if (starType === 'star') color.setHSL(0.55 + rand2 * 0.05, 1.0, 0.9);
        else if (i % 2 === 0) color.setHSL(0.93 + rand2 * 0.03, 0.9, 0.55); // Pink
        else color.setHSL(0.48 + rand2 * 0.04, 1.0, 0.45); // Mint
      } 
      else if (this.colorStyle === 'pastel') {
        if (starType === 'star') color.setHSL(0.10 + rand2 * 0.04, 0.9, 0.85); // Gold
        else if (i % 2 === 0) color.setHSL(0.74 + rand2 * 0.06, 0.4, 0.65); // Violet
        else color.setHSL(0.06 + rand2 * 0.04, 0.5, 0.7);  // Peach
      }
      else if (this.colorStyle === 'full-random') {
        // 완전 무작위 스펙트럼
        if (starType === 'star') color.setHSL(rand1, 0.4, 0.9);
        else color.setHSL(rand1, 0.8, 0.5);
      } 
      else if (this.colorStyle === 'custom') {
        // 픽커를 조작한 수동 컬러
        const cc = this.customColors;
        if (starType === 'star') color.set(cc.star);
        else if (i % 2 === 0) color.set(cc.gas1);
        else color.set(cc.gas2);
      } 
      else {
        // 기본 Monochrome Cyan
        if (starType === 'star') color.setHex(0xffffff);
        else color.setHSL(0.52 + rand2 * 0.06, 0.9, 0.45);
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
      
      // 💥 Glow 슬라이더 하나로 불투명도(Opacity)와 입자 크기(Size)를 동시에 뻥튀기하여 빛 번짐 극대화
      const glow = window.cosmicEngineSettings.glowIntensity;
      this.material.opacity = Math.min(1.0, glow); 
      this.material.size = Math.max(0.5, glow * 1.8); 
    }

    const time = Date.now() * 0.001;
    const positions = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.pSize.array;

    // 💥 오디오 게인(폭발력)을 곱해주는 배율을 엄청나게 높였습니다. 슬라이더를 올리면 폭주합니다.
    const gain = this.audioGain;
    const subBass = audioData ? audioData.subBass * gain * 2.0 : 0;
    const bass    = audioData ? audioData.bass * gain * 1.5 : 0;
    const mid     = audioData ? audioData.mid * gain * 1.2 : 0;
    const treble  = audioData ? audioData.treble * gain * 1.5 : 0;
    const volume  = audioData ? audioData.volume * gain * 2.0 : 0;

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];

      let currentAngle = data.angle + time * 0.008 * data.speed;
      
      // 중간 줄기의 소용돌이 움직임 폭발적 증가
      const noise2 = Math.sin(data.radius * 1.3 - time * 2.0) * (bass * 1.5 + mid * 0.8);
      currentAngle += noise2 / data.radius;

      const noise3 = Math.cos(time * data.twinkleSpeed) * (treble * 0.5);
      const finalRadius = data.radius + noise3 + (subBass * 0.8); 

      positions[i * 3] = Math.cos(currentAngle) * finalRadius;
      // y축 높낮이도 비트에 맞춰 크게 울렁이도록 폭폭 증가
      positions[i * 3 + 1] = data.baseY + Math.sin(time * data.speed + data.radius) * (mid * 0.8);
      positions[i * 3 + 2] = Math.sin(currentAngle) * finalRadius;

      if (data.type === 'star') {
        sizes[i] = data.baseSize * (1.0 + subBass * 4.0 + Math.sin(time * data.twinkleSpeed) * 0.5);
      } else {
        sizes[i] = data.baseSize * (1.0 + treble * 3.0);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    // 전체 카메라 앵글 회전 속도도 볼륨에 맞춰 드라마틱하게 가속
    this.points.rotation.y = time * 0.006 + (volume * 0.15);
    this.points.rotation.x = Math.sin(time * 0.005) * 0.1;

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
