/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 3.1 (개별 LED 셀 내부 단색 유지 및 수직 칸별 계단식 그라디언트 전환 완결판)
 * - 스타일 1: 바다색 계단 (개별 칸은 완벽한 단색 / 1층 어두운 블루에서 위층 밝은 시안 블루로 칸마다 색상 변형)
 * - 스타일 2: 불색 계단 (개별 칸은 완벽한 단색 / 1층 밝은 오렌지 레드에서 위층 어두운 잿빛 크림슨으로 칸마다 색상 변형)
 * - 스타일 3: 가상 픽커 커스텀 지정 배색 (1층 Color 1 단색 -> 위층 Color 2 단색으로 칸별 선형 전환)
 * - 스타일 4: 아래칸 채움 없이 최고 피크 정점들만 스무스하게 이어 흐르는 네온 파도(Wave)선 연출 유지
 * - 스타일 5: 면 채움 없이 순수 사각형 외곽 테두리선(Wireframe) 구조의 개별 도트 올랜덤 컬러 셔플 유지
 * - 분산범위(가로간격), 지형변경(주파수 셔플), 발광(밝기), 폭발력(볼륨 높이) 및 무결점 배경 주입 완벽 연동
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = []; 
    this.waveLineMesh = null; // 4번 스타일 전용 스무스 파도선
    
    this.barCount = 32; 
    this.maxCells = 15; 
    
    this.bgTexture = null;
    this.lastBgSrc = "";
    this.domObserver = null;

    this.uiSettings = {
      seed: 42,
      scatter: 22,
      style: 'neon', 
      glow: 85,
      gain: 100,
      customColors: { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' }
    };

    this.sampleIndices = []; 
    this.currentWidth = 0;
    this.currentHeight = 0;
    
    this.version = "005호 칸별 단색 변형 스펙트럼 Ver 3.1";
  }

  init() {
    this.currentWidth = this.container.clientWidth;
    this.currentHeight = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-this.currentWidth / 2, this.currentWidth / 2, this.currentHeight / 2, -this.currentHeight / 2, 0.1, 1000);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.renderer.setClearColor(0x000000, 0.0); 
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0.5, 0);

    this.syncUISettings();
    this.buildSegmentMatrix(geometry);
    this.buildWaveLineContainer(); 
    this.setupDirectInputTracker();
  }

  syncUISettings() {
    if (window.cosmicEngineSettings) {
      const global = window.cosmicEngineSettings;
      this.uiSettings.seed = global.seed ?? 42;
      this.uiSettings.scatter = THREE.MathUtils.mapLinear(global.scatterExponent ?? 2.2, 0.5, 5.0, 45, 8);
      this.uiSettings.style = global.colorStyle ?? 'neon';
      this.uiSettings.glow = (global.glowIntensity ?? 0.85) * 100; 
      this.uiSettings.gain = (global.audioGain ?? 1.0) * 100;
      this.uiSettings.customColors = global.customColors ?? { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
    }
  }

  buildSegmentMatrix(geometry) {
    this.eqBars.forEach(channel => {
      channel.cells.forEach(cellMesh => this.scene.remove(cellMesh));
    });
    this.eqBars = [];

    const totalScatterWidth = THREE.MathUtils.mapLinear(this.uiSettings.scatter, 5, 50, this.currentWidth * 0.98, this.currentWidth * 0.4);
    const barWidth = (totalScatterWidth / this.barCount) * 0.85; 
    const startX = -totalScatterWidth / 2 + barWidth / 2;
    const bottomY = -this.currentHeight / 2 + 15;

    const totalHeightLimit = this.currentHeight * 0.82;
    const cellHeight = (totalHeightLimit / this.maxCells) * 0.86;
    const cellSpacing = (totalHeightLimit / this.maxCells) * 0.14;

    this.sampleIndices = [];
    for (let i = 0; i < 256; i++) this.sampleIndices.push(i);
    
    let seedValue = this.uiSettings.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };
    
    for (let i = this.sampleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [this.sampleIndices[i], this.sampleIndices[j]] = [this.sampleIndices[j], this.sampleIndices[i]];
    }

    for (let i = 0; i < this.barCount; i++) {
      // 💡 각 대역폭 스타일별 기준 기저 컬러 원천 마킹
      let baseBottomColor = new THREE.Color();
      let baseTopColor = new THREE.Color();

      if (this.uiSettings.style === 'monochrome') {
        baseBottomColor.setHex(0x001a33); // 1. 바다색 그라디언트 기저 (어두운 심해 청색)
        baseTopColor.setHex(0x33d6ff);    // 위로 갈수록 맑은 아쿠아 블루
      } else if (this.uiSettings.style === 'pastel') {
        baseBottomColor.setHex(0xff4500); // 2. 불색 그라디언트 기저 (밝고 강렬한 오렌지 마그마)
        baseTopColor.setHex(0x1a0000);    // 위로 갈수록 어둡게 타버린 크림슨 블랙
      } else if (this.uiSettings.style === 'custom') {
        baseBottomColor.set(this.uiSettings.customColors.gas1); // 3. 커스텀 지정 배색
        baseTopColor.set(this.uiSettings.customColors.gas2);
      } else {
        baseBottomColor.setHex(0xff0055); // 4, 5번 네이티브 배색 (네온 핑크)
        baseTopColor.setHex(0x00ffcc);    // 네온 민트
      }

      // 💡 [핵심 알고리즘 수정 패치] 
      // 개별 큐브 내부에 그라디언트가 생기지 않도록 Fragment Shader 내부의 mix 보간식을 폐기하고,
      // 셰이더에는 단일 단색 유니폼(u_cellColor)만 주입하여 완벽한 면 정갈함을 유지합니다.
      const material = new THREE.ShaderMaterial({
        uniforms: {
          u_cellColor: { value: new THREE.Color(0xffffff) },
          u_opacity: { value: 0.1 },
          u_wireOnly: { value: 0.0 } 
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 u_cellColor;
          uniform float u_opacity;
          uniform float u_wireOnly;
          varying vec2 vUv;
          void main() {
            // 한 칸 격자 테두리 마스크 보간 공식
            float borderX = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
            float borderY = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
            float mask = borderX * borderY;

            // 스타일 5번 제어: u_wireOnly 켜지면 내부를 비우고 정사방 테두리선만 표출
            if (u_wireOnly > 0.5) {
               mask = (mask < 0.95) ? 1.0 : 0.0;
               if(mask < 0.1) discard; 
            }

            gl_FragColor = vec4(u_cellColor, u_opacity * mask);
          }
        `,
        transparent: true,
        depthWrite: false
      });

      const channelObj = {
        cells: [],
        materials: [],
        sampleIndex: this.sampleIndices[i % 256], 
        smoothedHeight: 0,
        posX: startX + i * (totalScatterWidth / this.barCount)
      };

      for (let j = 0; j < this.maxCells; j++) {
        const cellMat = material.clone();
        
        // 💡 [수학적 계단식 컬러 분할]
        // 1층부터 15층까지 각 칸의 높이 비율(ratio)을 계산하여 칸막이별로 완벽한 '고정 단색'을 개별 주입합니다.
        let cellRatio = j / (this.maxCells - 1);
        let finalCellColor = new THREE.Color();
        finalCellColor.copy(baseBottomColor).lerp(baseTopColor, cellRatio);
        
        // 스타일 5번 우회 예외: 테두리만 남기고 올 랜덤 컬러 처리 시
        if (this.uiSettings.style !== 'monochrome' && this.uiSettings.style !== 'pastel' && this.uiSettings.style !== 'custom' && this.uiSettings.style !== 'full-random') {
            cellMat.uniforms.u_wireOnly.value = 1.0; // 5번 기능 활성화
            finalCellColor.setHSL(seededRandom(), 1.0, 0.6); // 완전히 독립된 도트 무작위 랜덤화
        }

        cellMat.uniforms.u_cellColor.value.copy(finalCellColor);

        const cellMesh = new THREE.Mesh(geometry, cellMat);
        cellMesh.scale.set(barWidth, cellHeight, 1);
        cellMesh.position.set(channelObj.posX, bottomY + j * (cellHeight + cellSpacing), 0);

        this.scene.add(cellMesh);
        channelObj.cells.push(cellMesh);
        channelObj.materials.push(cellMat);
      }

      this.eqBars.push(channelObj);
    }
  }

  buildWaveLineContainer() {
    if (this.waveLineMesh) this.scene.remove(this.waveLineMesh);
    
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.barCount * 4 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      linewidth: 4, 
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.waveLineMesh = new THREE.Line(lineGeo, lineMat);
    this.scene.add(this.waveLineMesh);
  }

  setupDirectInputTracker() {
    const forceSyncTexture = () => {
      let targetSrc = "";
      let sourceElement = null;

      if (window.currentUploadedImageElement && window.currentUploadedImageElement.src) {
        targetSrc = window.currentUploadedImageElement.src;
        sourceElement = window.currentUploadedImageElement;
      } else {
        const allImgs = document.querySelectorAll('.media-resources img') || document.querySelectorAll('img');
        for (let img of allImgs) {
          if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.id.includes('preview') || img.src.includes('data:image'))) {
            targetSrc = img.src;
            sourceElement = img;
            break;
          }
        }
      }

      if (targetSrc && targetSrc !== this.lastBgSrc && sourceElement) {
        this.lastBgSrc = targetSrc;
        try {
          const tex = new THREE.Texture(sourceElement);
          tex.needsUpdate = true;
          this.bgTexture = tex;
          this.scene.background = this.bgTexture;
        } catch (e) {
          const loader = new THREE.TextureLoader();
          loader.load(targetSrc, (t) => {
            this.bgTexture = t;
            this.scene.background = this.bgTexture;
          });
        }
      }
    };

    this.domObserver = new MutationObserver(() => { forceSyncTexture(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setInterval(forceSyncTexture, 1000);
    setTimeout(forceSyncTexture, 500);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.syncUISettings();
    this.renderer.clear();

    const time = Date.now() * 0.001;

    if (audioData && audioData.raw && audioData.raw.length > 0) {
      const peakPoints = []; 

      const glowMultiplier = THREE.MathUtils.mapLinear(this.uiSettings.glow, 10, 250, 0.5, 4.0);
      const gainMultiplier = parseFloat(this.uiSettings.gain) / 100;

      this.eqBars.forEach((channel) => {
        const rawValue = (audioData.raw[channel.sampleIndex] || 0) / 255;

        let sensitivityBoost = 1.0;
        if (channel.sampleIndex > 110) sensitivityBoost = 2.4;
        else if (channel.sampleIndex > 60) sensitivityBoost = 1.7;

        const targetHeight = rawValue * sensitivityBoost * gainMultiplier;
        channel.smoothedHeight = THREE.MathUtils.lerp(channel.smoothedHeight, targetHeight, 0.24);

        const activeThreshold = channel.smoothedHeight * this.maxCells;
        let channelHighestY = -this.currentHeight / 2 + 15;

        channel.materials.forEach((mat, cellIdx) => {
          // 💡 [발광 멀티플라이어] 개별 셀의 고유 단색 밝기를 실시간 상향 링크
          mat.uniforms.u_cellColor.value.multiplyScalar(glowMultiplier);

          // 💡 스타일 4번 조건 판정 시: 아래칸 다 지우고 채움 없이 파도 스플라인 점만 획득
          if (this.uiSettings.style === 'full-random') {
             mat.uniforms.u_opacity.value = 0.0; 
             if (cellIdx < activeThreshold) {
                 channelHighestY = channel.cells[cellIdx].position.y + (channel.cells[cellIdx].scale.y);
             }
          } 
          // 그 외 일반 1, 2, 3, 5번 스타일 격자 점등 연산
          else {
             if (cellIdx < activeThreshold) {
               mat.uniforms.u_opacity.value = 0.95; 
             } else {
               mat.uniforms.u_opacity.value = 0.08; 
             }
          }
        });

        peakPoints.push(new THREE.Vector3(channel.posX, channelHighestY, 2));
      });

      // 스타일 4번 파도 연출 스플라인 제어 루프
      if (this.uiSettings.style === 'full-random' && this.waveLineMesh) {
          this.waveLineMesh.material.opacity = 1.0;
          
          const curve = new THREE.CatmullRomCurve3(peakPoints);
          curve.curveType = 'centripetal'; 
          
          const splinePoints = curve.getPoints(this.barCount * 4);
          this.waveLineMesh.geometry.setFromPoints(splinePoints);
          this.waveLineMesh.material.color.setHSL(0.4 + Math.sin(time * 2.0) * 0.15, 1.0, 0.55 * glowMultiplier);
      } else if (this.waveLineMesh) {
          this.waveLineMesh.material.opacity = 0.0; 
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.currentWidth = w;
      this.currentHeight = h;
      this.camera.left = -w / 2;
      this.camera.right = w / 2;
      this.camera.top = h / 2;
      this.camera.bottom = -h / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.translate(0, 0.5, 0);
      this.syncUISettings();
      this.buildSegmentMatrix(geometry);
      this.buildWaveLineContainer();
    }
  }

  destroy() {
    if (!this.scene) return;
    this.eqBars.forEach(channel => {
      channel.cells.forEach(cellMesh => {
        cellMesh.geometry.dispose();
        cellMesh.material.dispose();
      });
    });
    if (this.waveLineMesh) {
        this.waveLineMesh.geometry.dispose();
        this.waveLineMesh.material.dispose();
    }
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    if (this.domObserver) this.domObserver.disconnect();
    if (this.bgTexture) this.bgTexture.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = [];
  }
}
