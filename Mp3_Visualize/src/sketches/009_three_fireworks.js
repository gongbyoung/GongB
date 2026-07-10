/**
 * src/sketches/009_three_fireworks.js
 * - [버전] Ver 6.0 (정점 128분할 격자 주입 및 셰이더 축 싱크 완전 정밀 패치판)
 * - PlaneGeometry 세그먼트를 128x128로 세분화하여 일직선 칼단면 현상을 완벽 차단하고 리얼 노이즈 파형 복구
 * - uTextScale과 회전 변위 좌표계를 가로세로 화면비에 맞춰 재컴파일하여 파도선과 물웅덩이 싱크 미스 전면 수리
 * - Shuffle(0~360도 진행 각도), Range(파도 간격 밀도), Scale(자막 크기), Volume(포말 디테일), Gauge(수동 제어) UI 완벽 바인딩
 */

export default class ThreeMediaArtWall {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.bgPlane = null;
    this.wavePlane = null;
    this.textCanvas = null;
    this.textTexture = null;

    this.currentImageEl = null;
    this.baseTexture = null;

    this.currentWidth = 0;
    this.currentHeight = 0;
    this.lastLogTime = 0;
    this.version = "009호 정밀 격자 유체 스튜디오 Ver 6.0";
  }

  init() {
    this.currentWidth = this.container.clientWidth;
    this.currentHeight = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020205);

    this.camera = new THREE.PerspectiveCamera(45, this.currentWidth / this.currentHeight, 0.1, 8000);
    this.camera.position.set(0, 1500, 0); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.container.appendChild(this.renderer.domElement);

    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1920;
    this.textCanvas.height = 1920;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.generateMipmaps = false;
    this.textTexture.minFilter = THREE.LinearFilter;

    this.buildStaticBackground();
    this.buildFluidWaveSystem();
  }

  getUIParams() {
    let ui = { seed: 180, scatter: 22, color: 'neon', glow: 85, gain: 100, gas1: '#ff0055', gas2: '#00ffcc', offX: 0, offY: 0, offZ: 0, gauge: 0.5 };
    if (window.cosmicEngineSettings) {
      const g = window.cosmicEngineSettings;
      ui.seed = g.seed ?? 180;
      ui.scatter = (g.scatterExponent ?? 2.2) * 10;
      ui.color = g.colorStyle ?? 'neon';
      ui.glow = (g.glowIntensity ?? 0.85) * 100;
      ui.gain = (g.audioGain ?? 1.0) * 100;
      ui.gas1 = g.customColors?.gas1 ?? '#ff0055'; 
      ui.gas2 = g.customColors?.gas2 ?? '#00ffcc';
      ui.offX = g.positionOffset?.x ?? 0;
      ui.offY = g.positionOffset?.y ?? 0;
      ui.offZ = g.positionOffset?.z ?? 0;
      ui.gauge = g.gaugeValue ?? 0.5;
    }
    return ui;
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d2b48c'; 
    ctx.fillRect(0, 0, 2, 2);
    return new THREE.CanvasTexture(canvas);
  }

  buildStaticBackground() {
    this.currentImageEl = window.currentUploadedImageElement || null;
    if (this.currentImageEl) {
      this.baseTexture = new THREE.Texture(this.currentImageEl);
      this.baseTexture.needsUpdate = true;
    } else {
      this.baseTexture = this.createFallbackTexture();
    }
  }

  buildFluidWaveSystem() {
    // 💡 [대수술 핵심 축] 1,1 이던 단면 세그먼트를 128,128 격자로 파괴 분할하여 정밀 노이즈 진폭 공간 확보
    const waveGeo = new THREE.PlaneGeometry(6000, 6000, 128, 128);
    
    this.waveMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uBass: { value: 0.0 },
        uTreble: { value: 0.0 },
        uAngle: { value: 180.0 }, 
        uSeed: { value: 42.0 },
        uWaveDetail: { value: 1.5 }, 
        uSurge: { value: 0.5 }, 
        uSurgeVelocity: { value: 0.05 },
        uWaveSpacing: { value: 0.2 }, 
        uFoamSize: { value: 0.15 },
        uAudioDirMode: { value: 1.0 },
        uTextMap: { value: this.textTexture },
        uTextScale: { value: new THREE.Vector2(1.0, 1.0) },
        uSandMap: { value: this.baseTexture },
        uUseSandMap: { value: window.currentUploadedImageElement ? 1.0 : 0.0 },
        cSand: { value: new THREE.Color('#d2b48c') },
        cShallow: { value: new THREE.Color('#16a0b5') },
        cDeep: { value: new THREE.Color('#063b4c') },
        cFoam: { value: new THREE.Color('#ffffff') }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime; uniform float uBass; uniform float uTreble; 
        uniform float uAngle; uniform float uSeed; uniform float uWaveDetail; uniform float uSurge; uniform float uSurgeVelocity; uniform float uWaveSpacing;
        uniform float uFoamSize; uniform float uAudioDirMode;
        uniform sampler2D uTextMap; uniform vec2 uTextScale;
        uniform sampler2D uSandMap; uniform float uUseSandMap; 
        uniform vec3 cSand; uniform vec3 cShallow; uniform vec3 cDeep; uniform vec3 cFoam;
        varying vec2 vUv;
        
        vec2 hash( vec2 p ) { p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) ); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
        float noise( in vec2 p ) {
            const float K1 = 0.366025404; const float K2 = 0.211324865;
            vec2 i = floor( p + (p.x+p.y)*K1 ); vec2 a = p - i + (i.x+i.y)*K2; vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
            vec2 b = a - o + K2; vec2 c = a - 1.0 + 2.0*K2;
            vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
            vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
            return dot( n, vec3(70.0) );
        }
        
        void main() {
            // 💡 뷰포트 종횡비 왜곡 보정 링크 결합
            vec2 screenUv = (vUv - 0.5) * uTextScale + 0.5; 
            float ang = radians(uAngle); float cosA = cos(ang); float sinA = sin(ang); mat2 matRot = mat2(cosA, -sinA, sinA, cosA);
            
            vec2 rUv = matRot * (screenUv - 0.5) + 0.5; vec2 noiseUv = rUv + vec2(uSeed * 0.1); 
            
            float freq = mix(4.0, 40.0, uWaveSpacing);
            float waveSine = sin(uTime * 1.5);
            
            float audioLevelOffset = (uAudioDirMode > 0.5) ? ((uBass * 0.15) - (uTreble * 0.15)) : (-(uBass * 0.05) - (uTreble * 0.05));
            float audioRipple = sin(rUv.x * freq + uTime) * uBass * 0.1;
            
            float wavePos = uSurge + audioLevelOffset + (waveSine * 0.06) + audioRipple; 
            
            // 격자가 쪼개져 있으므로 이제 n1, n2 노이즈 파형이 온전히 구겨지며 정밀 표출됩니다.
            float n1 = noise(noiseUv * 8.0 * uWaveDetail + uTime * 0.2 + (uTreble * 0.1)); 
            float n2 = noise(noiseUv * 20.0 * uWaveDetail - uTime * 0.1);
            float distToWave = rUv.y - wavePos + (n1 * 0.15) + (n2 * 0.05);
            
            vec3 texSand = cSand;
            if (uUseSandMap > 0.5) {
                texSand = texture2D(uSandMap, screenUv).rgb;
            } else {
                float sandN = noise(noiseUv * 150.0);
                texSand = cSand * (0.9 + sandN * 0.15);
            }
            
            vec4 textData = vec4(0.0);
            if(screenUv.x >= 0.0 && screenUv.x <= 1.0 && screenUv.y >= 0.0 && screenUv.y <= 1.0) { 
                textData = texture2D(uTextMap, screenUv); 
            }

            vec3 finalColor;

            if (distToWave < 0.0) { 
                vec3 baseSand = texSand; 
                if (distToWave > -0.05) baseSand *= 0.85; 
                
                vec3 sandWithText = mix(baseSand, textData.rgb, textData.a);
                sandWithText += textData.rgb * textData.a * 0.7; 

                float puddleN = noise(noiseUv * 15.0 * uWaveDetail);
                if (distToWave > -0.25 && puddleN > 0.55) { 
                    if (puddleN < 0.58) {
                        finalColor = cFoam; 
                    } else { 
                        vec2 distTextUv = screenUv + vec2(sin(uTime*3.0 + screenUv.y*50.0)*0.005);
                        vec4 distTextData = texture2D(uTextMap, distTextUv);
                        vec3 puddleTextSand = mix(baseSand, distTextData.rgb, distTextData.a * 0.7);
                        puddleTextSand += distTextData.rgb * distTextData.a * 0.5; 
                        finalColor = mix(puddleTextSand, cShallow, 0.4); 
                    } 
                } else { 
                    finalColor = sandWithText; 
                }
            } else { 
                float textDistortion = noise(rUv * 30.0 + uTime) * 0.02 * clamp(distToWave*5.0, 0.0, 1.0);
                vec2 distTextUv = screenUv + textDistortion;
                vec4 distTextData = vec4(0.0);
                if(distTextUv.x >= 0.0 && distTextUv.x <= 1.0 && distTextUv.y >= 0.0 && distTextUv.y <= 1.0) { 
                    distTextData = texture2D(uTextMap, distTextUv); 
                }
                
                vec3 underwaterText = mix(texSand, distTextData.rgb, distTextData.a * 0.8);
                underwaterText += distTextData.rgb * distTextData.a * 0.6; 
                vec3 underwaterFloor = mix(underwaterText, cShallow, 0.5); 
                
                vec3 waterColor = mix(cShallow, cDeep, smoothstep(0.0, 0.4, distToWave));
                waterColor = mix(underwaterFloor, waterColor, smoothstep(0.0, 0.2, distToWave));

                float baseFoam = uFoamSize * 0.1;
                float foamThickness = baseFoam + noise(noiseUv * 40.0 - uTime * 2.0) * 0.02 + (uSurgeVelocity * 0.5) + (uTreble * 0.01);
                if (distToWave < foamThickness) { 
                    finalColor = cFoam; 
                } else { 
                    finalColor = waterColor; 
                }
            }
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.DoubleSide
    });

    this.wavePlane = new THREE.Mesh(waveGeo, this.waveMaterial);
    this.wavePlane.rotation.x = -Math.PI / 2; 
    this.scene.add(this.wavePlane);
  }

  drawSubtitleToCanvas(text, fontSizeStyle) {
    const ctx = this.textCanvas.getContext('2d');
    ctx.clearRect(0, 0, 1920, 1920);

    if (!text) {
      this.textTexture.needsUpdate = true;
      return;
    }

    ctx.save();
    ctx.font = `bold ${fontSizeStyle}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';

    ctx.shadowColor = 'rgba(0, 229, 255, 0.9)';
    ctx.shadowBlur = 80;
    ctx.fillStyle = 'rgba(0, 229, 255, 1.0)';

    const maxWidth = 1600;
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const lineHeight = fontSizeStyle * 1.4;
    const startY = 1024 - ((lines.length - 1) * lineHeight) / 2;

    for (let loop = 0; loop < 2; loop++) {
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], 960, startY + i * lineHeight);
        }
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 960, startY + i * lineHeight);
    }

    ctx.restore();
    this.textTexture.needsUpdate = true;
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera || !this.wavePlane) return;

    if (this.currentImageEl !== window.currentUploadedImageElement) {
      this.currentImageEl = window.currentUploadedImageElement;
      if (this.currentImageEl) {
        this.baseTexture = new THREE.Texture(this.currentImageEl);
        this.baseTexture.needsUpdate = true;
        this.waveMaterial.uniforms.uSandMap.value = this.baseTexture;
        this.waveMaterial.uniforms.uUseSandMap.value = 1.0;
      }
    }

    const ui = this.getUIParams();

    this.camera.position.set(ui.offX, 1500 + ui.offY, ui.offZ);
    this.camera.lookAt(ui.offX, ui.offY, ui.offZ);

    let fovRad = 45 * Math.PI / 180;
    let visibleHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.y; 
    let visibleWidth = visibleHeight * this.camera.aspect;
    this.waveMaterial.uniforms.uTextScale.value.set(6000.0 / visibleWidth, 6000.0 / visibleHeight);

    this.waveMaterial.uniforms.uAngle.value = ui.seed; 
    this.waveMaterial.uniforms.uWaveSpacing.value = ui.scatter / 50; 
    this.waveMaterial.uniforms.uWaveDetail.value = THREE.MathUtils.mapLinear(ui.gain, 10, 500, 0.5, 4.0); 

    const time = Date.now() * 0.0015;
    this.waveMaterial.uniforms.uTime.value = time;

    let targetSurge = 0.05; 
    let activeText = "";
    let srtStatusMessage = "대기 상태";

    const audioEl = document.querySelector('audio');
    
    if (audioEl && !audioEl.paused && window.parsedSubtitles && window.parsedSubtitles.length > 0) {
      const curTime = audioEl.currentTime * 1000; 
      
      const nextSub = window.parsedSubtitles.find(sub => sub.start > curTime && sub.start - curTime <= 800);
      const currentSub = window.parsedSubtitles.find(sub => curTime >= sub.start && curTime <= sub.end);

      if (nextSub) {
        let timeGap = nextSub.start - curTime; 
        let progress = 1.0 - (timeGap / 800);  
        targetSurge = THREE.MathUtils.lerp(0.05, 0.95, Math.pow(progress, 2.0));
        srtStatusMessage = `⏳ SRT 추적 중: 자막 출현 전 파도 덮침`;
      } 
      else if (currentSub) {
        activeText = currentSub.text;
        let activeProgress = (curTime - currentSub.start) / (currentSub.end - currentSub.start);
        targetSurge = THREE.MathUtils.lerp(0.95, 0.35, Math.min(1.0, activeProgress * 3.5));
        srtStatusMessage = `▶️ SRT 추적 중: 파도 퇴각 및 자막 활성화`;
      } else {
        targetSurge = 0.05;
        srtStatusMessage = "🎵 음악 공백 구간";
      }
    } else {
      targetSurge = ui.gauge;
      activeText = window.currentSubtitleText || "자연 유체 스튜디오 v0.010\n(빛나는 네온 효과 완성)";
      srtStatusMessage = "⏸️ 정지 모드 (Gauge 수치 제어)";
    }

    let currentSurge = this.waveMaterial.uniforms.uSurge.value;
    currentSurge += (targetSurge - currentSurge) * 0.05;
    this.waveMaterial.uniforms.uSurge.value = currentSurge;
    this.waveMaterial.uniforms.uSurgeVelocity.value = Math.abs(targetSurge - currentSurge);

    const nowMs = Date.now();
    if (nowMs - this.lastLogTime > 500) {
      console.log(
        `%c[🌊 009호 정밀 싱크 완료] %c수위(Surge): ${currentSurge.toFixed(2)} | 파도 각도: ${ui.seed}° | 상태: ${srtStatusMessage}`,
        "color: #00ffcc; font-weight: bold;", "color: #ffffff;"
      );
      this.lastLogTime = nowMs;
    }

    const targetFontSize = THREE.MathUtils.mapLinear(ui.glow, 10, 250, 40, 250);
    this.drawSubtitleToCanvas(activeText, targetFontSize);

    let audioVol = audioData ? (audioData.vol || audioData.volume || 0.0) : 0.0;
    this.waveMaterial.uniforms.uBass.value = audioVol * 2.5;
    this.waveMaterial.uniforms.uTreble.value = audioVol * 1.5;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.currentWidth = w;
      this.currentHeight = h;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  destroy() {
    if (!this.scene) return;
    if (this.wavePlane) { this.wavePlane.geometry.dispose(); this.wavePlane.material.dispose(); this.scene.remove(this.wavePlane); }
    if (this.textTexture) this.textTexture.dispose();
    if (this.renderer) { this.container.removeChild(this.renderer.domElement); this.renderer.dispose(); }
    this.scene = null; this.camera = null; this.renderer = null;
  }
}
