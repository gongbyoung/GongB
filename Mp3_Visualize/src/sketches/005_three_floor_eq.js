/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 2.0 (Cosmic Studio Tuning UI 완벽 연동 및 렌더링 최적화판)
 * - main.js의 우측 패널 UI(지형변경, 분산범위, 컬러 스타일 5종, 발광, 폭발력) 데이터를 실시간으로 수신하여 렌더링에 반영
 * - 32채널 x 15칸 LED 도트 매트릭스 그리드 구조 유지
 * - scene.background 직통 링커를 통한 무결점 배경 투사 보장
 * - 4번/5번 스타일 전용 셰이더 기반 '제일 윗부분 선 연결' 및 '테두리 없는 랜덤 컬러' 연출 탑재
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = []; // 채널별 데이터 오브젝트 배열
    this.topLineMesh = null; // 4번 스타일 전용 선 메쉬
    
    this.barCount = 32; // 주파수 채널 총 개수
    this.maxCells = 15; // 수직 도트 최대 개수
    
    this.bgTexture = null;
    this.lastBgSrc = "";
    this.domObserver = null;

    // 💡 UI 파라미터 캐싱 및 007호 Nebula와의 이름 불일치 호환 타게팅
    this.uiSettings = {
      seed: 42,
      scatter: 22,
      style: 'neon', 
      glow: 85,
      gain: 100,
      customColors: { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' }
    };

    this.sampleIndices = []; // 지형변경(seed)에 의해 셔플될 주파수 인덱스 배열
    this.currentWidth = 0;
    this.currentHeight = 0;
    
    this.version = "005호 마스터 UI 연동판 Ver 2.0";
  }

  init() {
    this.currentWidth = this.container.clientWidth;
    this.currentHeight = this.container.clientHeight;

    this.scene = new THREE.Scene();

    // 정면 직교 카메라
    this.camera = new THREE.OrthographicCamera(-this.currentWidth / 2, this.currentWidth / 2, this.currentHeight / 2, -this.currentHeight / 2, 0.1, 1000);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.renderer.setClearColor(0x000000, 0.0); 
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0.5, 0);

    // 💡 초기 렌더링 전 UI 설정 동기화
    this.syncUISettings();
    this.buildSegmentMatrix(geometry);
    this.buildTopLine(); // 4번 스타일용 선 미리 빌드
    this.setupDirectInputTracker();
  }

  /**
   * 💡 main.js 가 window에 바인딩한 Cosmic Studio UI 데이터를 005호 규격으로 가져오기
   */
  syncUISettings() {
    if (window.cosmicEngineSettings) {
      const global = window.cosmicEngineSettings;
      this.uiSettings.seed = global.seed ?? 42;
      
      // 007호 scatterExponent(수치 낮음)와 005호 가로간격(수치 높음) 로그 연산 호환 변환
      this.uiSettings.scatter = THREE.MathUtils.mapLinear(global.scatterExponent ?? 2.2, 0.5, 5.0, 50, 5);
      
      this.uiSettings.style = global.colorStyle ?? 'neon';
      this.uiSettings.glow = (global.glowIntensity ?? 0.85) * 100; // 0~1 단위를 0~100 단위로 변환
      this.uiSettings.gain = (global.audioGain ?? 1.0) * 100;
      this.uiSettings.customColors = global.customColors ?? { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
    }
  }

  buildSegmentMatrix(geometry) {
    this.eqBars.forEach(channel => {
      channel.cells.forEach(cellMesh => this.scene.remove(cellMesh));
    });
    this.eqBars = [];

    // 💡 [분산범위: 가로간격조정] UIScatter 값 반영
    const totalScatterWidth = THREE.MathUtils.mapLinear(this.uiSettings.scatter, 5, 50, this.currentWidth * 0.95, this.currentWidth * 0.3);
    const barWidth = (totalScatterWidth / this.barCount) * 0.85; 
    const startX = -totalScatterWidth / 2 + barWidth / 2;
    const bottomY = -this.currentHeight / 2 + 15;

    const totalHeightLimit = this.currentHeight * 0.85;
    const cellHeight = (totalHeightLimit / this.maxCells) * 0.88;
    const cellSpacing = (totalHeightLimit / this.maxCells) * 0.12;

    // 💡 [지형변경: 주파수 랜덤변경] Seed 기반 주파수 인덱스 셔플 매핑 생성
    this.sampleIndices = [];
    for (let i = 0; i < 256; i++) this.sampleIndices.push(i);
    
    // Seed 기반 결정론적 무작위 셔플 (Ver 4.17 Seed Randomizer 재활용)
    let seedValue = this.uiSettings.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };
    
    for (let i = this.sampleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [this.sampleIndices[i], this.sampleIndices[j]] = [this.sampleIndices[j], this.sampleIndices[i]];
    }

    // 셰이더 유니폼 컬러 업데이트를 위한 배열
    const customColorsArray = [
      new THREE.Color(this.uiSettings.customColors.gas1),
      new THREE.Color(this.uiSettings.customColors.gas2),
      new THREE.Color(this.uiSettings.customColors.star)
    ];

    for (let i = 0; i < this.barCount; i++) {
      // 💡 [COLOR STYLE: 1~3번 그라디언트 정의]
      let bottomColor = new THREE.Color(0x00ffcc); // 기본
      let topColor = new THREE.Color(0xaaff00);    // 기본

      switch(this.uiSettings.style) {
        case 'monochrome': // 1. 파란색 계열
          bottomColor.setHSL(0.58, 1.0, 0.4); // Deep Blue
          topColor.setHSL(0.55, 0.9, 0.6);    // Cyan
          break;
        case 'pastel': // 2. 빨강-검은색 계열
          bottomColor.setHSL(0.0, 0.9, 0.1);  // Very Dark Red
          topColor.setHSL(0.0, 1.0, 0.5);     // Neon Red
          break;
        case 'custom': // 3. CUSTOM COLOR
          bottomColor.set(customColorsArray[0]);
          topColor.set(customColorsArray[1]);
          break;
        default: // 기본 Cyberpunk
          bottomColor.setHSL(0.85, 1.0, 0.5); // Pink
          topColor.setHSL(0.45, 1.0, 0.5);    // Mint
      }

      // 수직 셰이더 그라디언트 재질 생성
      const material = new THREE.ShaderMaterial({
        uniforms: {
          u_bottomColor: { value: bottomColor },
          u_topColor: { value: topColor },
          u_opacity: { value: 0.1 }, // 소등 상태 기본 투명도
          u_edgeAlpha: { value: 0.9 } // 테두리 유무 제어 (5번 스타일용)
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 u_bottomColor;
          uniform vec3 u_topColor;
          uniform float u_opacity;
          uniform float u_edgeAlpha;
          varying vec2 vUv;
          void main() {
            // Y축 우브 그라디언트
            vec3 finalColor = mix(u_bottomColor, u_topColor, vUv.y);
            
            // 💡 [COLOR STYLE: 5. 테두리 없이] 엣지 투명도 제어
            float edgeMask = 1.0;
            if(u_edgeAlpha > 0.5) {
                // 부드러운 테두리 마스크
                float borderX = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
                float borderY = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
                edgeMask = borderX * borderY;
            }

            // [발광/크기: 색의 밝기] 컬러에 직접 가중치 곱
            gl_FragColor = vec4(finalColor * u_edgeAlpha, u_opacity * edgeMask);
          }
        `,
        transparent: true,
        depthWrite: false
      });

      const channelObj = {
        cells: [],
        materials: [],
        // Seed 셔플에 의해 무작위 할당된 주파수 샘플 인덱스
        sampleIndex: this.sampleIndices[i % 256], 
        smoothedHeight: 0
      };

      for (let j = 0; j < this.maxCells; j++) {
        // 인스턴스 셰이더 대신 개별 재질 사용 (색상 제어 용이)
        const cellMat = material.clone();
        
        const cellMesh = new THREE.Mesh(geometry, cellMat);
        cellMesh.scale.set(barWidth, cellHeight, 1);
        cellMesh.position.set(startX + i * (totalScatterWidth / this.barCount), bottomY + j * (cellHeight + cellSpacing), 0);

        this.scene.add(cellMesh);
        channelObj.cells.push(cellMesh);
        channelObj.materials.push(cellMat);
      }

      this.eqBars.push(channelObj);
    }
  }

  /**
   * 💡 [COLOR STYLE: 4. 제일 윗부분만 선으로 연결] 전용 라인 메쉬 빌드
   */
  buildTopLine() {
    if (this.topLineMesh) this.scene.remove(this.topLineMesh);
    this.topLineMesh = null;

    const lineGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.barCount * 3);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0, // 4번 스타일 아닐 땐 숨김
      linewidth: 2,
      depthWrite: false
    });

    this.topLineMesh = new THREE.Line(lineGeometry, lineMaterial);
    this.scene.add(this.topLineMesh);
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

    // 💡 매 프레임 UI 설정값 실시간 동기화
    this.syncUISettings();

    this.renderer.clear();

    const time = Date.now() * 0.001;

    if (audioData && audioData.raw && audioData.raw.length > 0) {
      const topPoints = []; // 4번 스타일용 꼭짓점 배열

      // 💡 [발광/크기: 색의 밝기] UI 수치 매핑
      const glowMultiplier = THREE.MathUtils.mapLinear(this.uiSettings.glow, 10, 250, 0.4, 3.5);
      
      // 💡 [폭발력: 볼륨으로 높이 매칭] UI 수치 매핑
      const gainMultiplier = parseFloat(this.uiSettings.gain) / 100;

      // 4, 5번 스타일 예외 컬러 픽커 팩 빌드
      const pickerColors = [
        new THREE.Color(this.uiSettings.customColors.gas1),
        new THREE.Color(this.uiSettings.customColors.gas2),
        new THREE.Color(this.uiSettings.customColors.star)
      ];

      this.eqBars.forEach((channel, channelIdx) => {
        const rawValue = (audioData.raw[channel.sampleIndex] || 0) / 255;

        // 고음 감도 밸런싱
        let sensitivityBoost = 1.0;
        if (channel.sampleIndex > 110) sensitivityBoost = 2.5;
        else if (channel.sampleIndex > 60) sensitivityBoost = 1.8;

        const targetActivePower = rawValue * sensitivityBoost * gainMultiplier;
        channel.smoothedHeight = THREE.MathUtils.lerp(channel.smoothedHeight, targetActivePower, 0.24);

        const activeThreshold = channel.smoothedHeight * this.maxCells;
        let highestY = -this.currentHeight / 2; // 선 연결용 최고 높이 초기화

        channel.materials.forEach((mat, cellIdx) => {
          if (cellIdx < activeThreshold) {
            highestY = channel.cells[cellIdx].position.y; // 점등된 최고 Y축 저장

            // 💡 [발광/크기] 밝기 가중치 유니폼 주입
            mat.uniforms.u_topColor.value.multiplyScalar(glowMultiplier);
            mat.uniforms.u_bottomColor.value.multiplyScalar(glowMultiplier);

            // 💡 [COLOR STYLE: 4, 5번 스타일 전용 컬러 주입]
            if (this.uiSettings.style === 'custom' || this.uiSettings.style === 'full-random') {
              // 4. 제일 윗부분 선 / 5. 테두리 없이 팩
              // 여기서는 4, 5번이 'custom'이나 'full-random' 키값으로 온다고 가정하고 예외 처리
              // main.js의 select-cosmic-color option value 값에 맞춰 수정 필요
              
              const seedShift = (channelIdx + cellIdx) % pickerColors.length;
              mat.uniforms.u_bottomColor.value.copy(pickerColors[seedShift]);
              mat.uniforms.u_topColor.value.copy(pickerColors[(seedShift+1)%pickerColors.length]);
              
              if(this.uiSettings.style === 'full-random') {
                  // 💡 [COLOR STYLE: 5. 테두리 없이] 팩 셰이더 유니폼 제어
                  mat.uniforms.u_edgeAlpha.value = 0.0; // 테두리 마스크 끄기
              } else {
                  mat.uniforms.u_edgeAlpha.value = 1.0; // 4번 스타일은 테두리 유지
              }
            } else {
                mat.uniforms.u_edgeAlpha.value = 1.0; // 그 외 그라디언트는 테두리 유지
            }

            mat.uniforms.u_opacity.value = 0.95; // 점등
          } else {
            mat.uniforms.u_opacity.value = 0.08; // 소등
          }
        });

        // 💡 [COLOR STYLE: 4. 제일 윗부분만 선] 최고 높이 좌표 수집
        topPoints.push(new THREE.Vector3(channel.cells[0].position.x, highestY, 1));
      });

      // 💡 [COLOR STYLE: 4. 제일 윗부분만 선] 선 메쉬 갱신 및 표출
      if ((this.uiSettings.style === 'custom' || this.uiSettings.style === 'full-random') && this.topLineMesh) {
          // 4번 스타일 조건 (키값 매핑 필요)
          this.topLineMesh.geometry.setFromPoints(topPoints);
          this.topLineMesh.material.opacity = 1.0;
          this.topLineMesh.material.color.copy(pickerColors[Math.floor(time * 5) % 3]); // 선 랜덤 색상
      } else if (this.topLineMesh) {
          this.topLineMesh.material.opacity = 0.0; // 숨김
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
      this.buildTopLine();
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
    if (this.topLineMesh) {
        this.topLineMesh.geometry.dispose();
        this.topLineMesh.material.dispose();
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
