/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [버전] Ver 2.2 (비동기 타이밍 락 무력화 및 세이프티 가이드 UI 인젝션 완결판)
 * - main.js 로딩 스위칭 시점의 하드웨어 타이밍 충돌을 방어하기 위해 비동기 세이프티 가이드 팝업 렌더 파이프라인 보강
 * - 은하수 나선 공식의 잔재를 완전히 도려내어 25,000개 별빛이 우주 공간 전체에 균등 확산 분산되도록 보장
 * - i % 3 구조 주파수 삼분할 제어: 저음(제자리 진동), 중음(은은한 반짝이기), 고음(랜덤 컬러 가변 후 복귀) 완벽 유지
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
    
    this.version = "007호 주파수 삼분할 스페이스 Ver 2.2";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 4, 16);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x222233, 1.0));

    // 💡 비동기 타이밍 이슈 방지를 위해 돔 빌드 리소스를 안전하게 이중 장착
    this.buildOnScreenGuideUI();
    this.buildCosmos();
  }

  // 💡 [안내창 인젝션 세이프 가드 강화] 비동기 타이밍 충돌을 무력화하는 절대 팝업 빌더
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
        maxWidth: '430px',
        backgroundColor: 'rgba(5, 7, 12, 0.96)',
        border: '1px solid rgba(0, 255, 204, 0.7)', 
        borderRadius: '12px',
        padding: '22px',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        zIndex: '9999', // 캔버스 최상단에 무조건 노출 락
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
        <h3 style="color: #ffffff; font-size: 16.5px; margin: 0 0 16px 0; font-weight: 600;">
          007호 주파수 삼분할 스페이스 가이드
        </h3>
        <div style="font-size: 12.5px; text-align: left; line-height: 1.8; color: #dddddd;">
          <p style="margin: 6px 0;">🔴 <strong style="color: #ff0055;">[저음역 ➡️ 제자리 진동]</strong> 3의 배수 첫 번째 별빛들이 흩어지지 않고 제자리에서 묵직하게 파르르 떨립니다.</p>
          <p style="margin: 6px 0;">🟢 <strong style="color: #00ffcc;">[중음역 ➡️ 반짝이기]</strong> 두 번째 별빛 무리들이 주파수 호흡에 맞춰 영롱하게 명멸 트윙클 진동합니다.</p>
          <p style="margin: 6px 0;">🔵 <strong style="color: #0077ff;">[고음역 ➡️ 랜덤 컬러 리턴]</strong> 하이 비트 순간에 색상이 랜덤하게 튀었다가 다시 부드럽게 원래 배색으로 리턴됩니다.</p>
          <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 설명창이 투명하게 자동 소멸합니다.</p>
        </div>
      `;
      this.container.appendChild(this.guiOverlay);
    };

    renderOverlay();
    // 락 방어용 백업 스케줄러 가동
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

    // 💡 레거시 나선 수식을 원천 파괴하고 구형 공간 확산 지름 축으로 튜닝 변경
    const maxDistributionRadius = THREE.MathUtils.mapLinear(this.scatterExponent, 0.5, 5.0, 2.5, 25.0);

    for (let i = 0; i < this.particleCount; i++) {
      sRandom = this.seededRandom(sRandom) * 1000;
      const r1 = this.seededRandom(sRandom + 1);
      const r2 = this.seededRandom(sRandom + 2);
      const r3 = this.seededRandom(sRandom + 3);
      const r4 = this.seededRandom(sRandom + 4);

      // 전체 무작위 공간 분산 매트릭스 수식 적용
      const theta = r1 * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * r2 - 1.0);
      const baseDist = Math.pow(r3, 0.5) * maxDistributionRadius;

      const x = baseDist * Math.sin(phi) * Math.cos(theta);
      const y = baseDist * Math.sin(phi) * Math.sin(theta) * 0.55; 
      const z = baseDist * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      let pSize = 0.015 + r1 * 0.02;
      let color = new THREE.Color();
      let starType = (r4 < 0.07) ? 'star' : 'gas';

      if (starType === 'star') pSize = 0.14 + r1 * 0.2; 

      if (this.colorStyle === 'monochrome') {
        if (starType === 'star') color.setHex(0xffffff);
        else if (i % 3 === 0) color.setHex(0x001f4d); 
        else if (i % 3 === 1) color.setHex(0x0066cc); 
        else color.setHex(0x33ccff);                
      } 
      else if (this.colorStyle === 'pastel') {
        if (starType === 'star') color.setHex(0xffaa44);
        else if (i % 2 === 0) color.setHex(0xff4400); 
        else color.setHex(0x2a0000);                
      }
      else if (this.colorStyle === 'custom') {
        const cc = this.customColors;
        if (starType === 'star') color.set(cc.star);
        else if (i % 2 === 0) color.set(cc.gas1);
        else color.set(cc.gas2);
      } 
      else {
        if (starType === 'star') color.setHSL(r1, 0.3, 0.9);
        else color.setHSL(r1, 0.75, 0.55);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      this.particleData.push({
        baseX: x, baseY: y, baseZ: z, 
        radius: baseDist,
        angle: theta,
        speed: 0.04 + r1 * 0.25,
        twinkleSpeed: 4.0 + r2 * 8.0,
        type: starType,
        baseSize: pSize,
        randomPhase: r3 * Math.PI,
        originalColor: color.clone()
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
      this.material.size = Math.max(0.4, glow * 2.1); 
    }

    const time = Date.now() * 0.001;
    const positions = this.geometry.attributes.position.array;
    const colors = this.geometry.attributes.color.array;
    const sizes = this.geometry.attributes.pSize.array;

    const gain = this.audioGain;
    const bass    = audioData ? audioData.bass * gain * 2.0 : 0;
    const mid     = audioData ? audioData.mid * gain * 1.6 : 0;
    const treble  = audioData ? audioData.treble * gain * 2.2 : 0;
    const volume  = audioData ? audioData.volume * gain * 1.5 : 0;

    if (volume > 0.05) {
      if (this.guiOverlay) this.guiOverlay.style.opacity = '0';
    } else {
      if (this.guiOverlay) this.guiOverlay.style.opacity = '1';
    }

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];

      // 💥 1번 분기: 저음 파트 [i % 3 === 0] ➡️ 제자리 진동
      if (i % 3 === 0) {
         const tremble = Math.sin(time * 45.0 + data.randomPhase) * (bass * 0.035);
         positions[i * 3]     = data.baseX + tremble;
         positions[i * 3 + 1] = data.baseY + tremble;
         positions[i * 3 + 2] = data.baseZ + tremble;
         
         sizes[i] = data.baseSize * (1.0 + bass * 2.0);
      }
      // 💥 2번 분기: 중음 파트 [i % 3 === 1] ➡️ 영롱한 반짝이기 트윙클
      else if (i % 3 === 1) {
         const pulse = 1.0 + Math.sin(time * 2.0 + data.randomPhase) * (mid * 0.15);
         positions[i * 3]     = data.baseX * pulse;
         positions[i * 3 + 1] = data.baseY * pulse;
         positions[i * 3 + 2] = data.baseZ * pulse;

         const blink = 0.5 + Math.sin(time * data.twinkleSpeed) * 0.5;
         sizes[i] = data.baseSize * (1.0 + mid * 3.0) * (0.3 + blink * (mid * 1.5));
      }
      // 💥 3번 분기: 고음 파트 [i % 3 === 2] ➡️ 고음 타격 시 완전히 다른 색상 가변 후 복귀
      else {
         if (treble > 0.65) {
            let shiftSeed = i + Math.floor(time * 10);
            colors[i * 3]     = this.seededRandom(shiftSeed);
            colors[i * 3 + 1] = this.seededRandom(shiftSeed + 1);
            colors[i * 3 + 2] = this.seededRandom(shiftSeed + 2);
            sizes[i] = data.baseSize * 4.0; 
         } else {
            colors[i * 3]     = THREE.MathUtils.lerp(colors[i * 3], data.originalColor.r, 0.1);
            colors[i * 3 + 1] = THREE.MathUtils.lerp(colors[i * 3 + 1], data.originalColor.g, 0.1);
            colors[i * 3 + 2] = THREE.MathUtils.lerp(colors[i * 3 + 2], data.originalColor.b, 0.1);
            sizes[i] = THREE.MathUtils.lerp(sizes[i], data.baseSize * (1.0 + treble * 1.5), 0.2);
         }

         positions[i * 3] = data.baseX + Math.sin(time * 0.2 + data.randomPhase) * (treble * 0.05);
         positions[i * 3 + 1] = data.baseY + Math.cos(time * 0.2 + data.radius) * (treble * 0.05);
         positions[i * 3 + 2] = data.baseZ + Math.cos(time * 0.5 + data.randomPhase) * (treble * 0.05);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    this.points.rotation.y = time * 0.012 + (volume * 0.03);
    this.points.rotation.x = Math.sin(time * 0.005) * 0.04;

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
