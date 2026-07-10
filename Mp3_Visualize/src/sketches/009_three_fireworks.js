/**
 * src/sketches/009_three_fireworks.js
 * - [버전] Ver 6.3 (SRT 초 단위 싱크 일치 및 v0.010 순수 셰이더 완전 고정판)
 * - main.js 자막 파서의 초(Seconds) 단위와 100% 동일하게 시간 축을 일치시켜 자막 추적 먹통 현상 완치
 * - Shuffle(0~360도 진행 각도), Range(파도 가로 Spacing), Scale(자막 크기), Volume(파도 노이즈 디테일), Gauge(수동 수위) 완벽 바인딩
 * - 파도가 물러간 자리에 불규칙하게 물이 남고 마르는 물웅덩이(puddleN) 및 심해 발광 효과 완벽 가동
 */

export default class ThreeMediaArtWall {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.wavePlane = null;
    this.waveMaterial = null;
    this.textCanvas = null;
    this.textTexture = null;
    this.sandTex = null;

    this.currentImageEl = null;
    this.globalRandomSeed = Math.random() * 100.0;
    this.time = 0;
    this.baseSurge = 0.75;
    this.splashTimer = 0.0;
    this.currentSubtitle = "";

    this.lastLogTime = 0;
    this.version = "Nature Fluid Studio v0.010 (Seconds 싱크 고정판)";
  }

  init() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020205);

    // 💡 오리지널 v0.010 원본 카메라 매트릭스 고수
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 8000);
    this.camera.position.set(0, 1500, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    // 오리지널 1920x1920 고해상도 자막 캔버스 맵 바인딩
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1920;
    this.textCanvas.height = 1920;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.generateMipmaps = false;
    this.textTexture.minFilter = THREE.LinearFilter;

    this.sandCanvas = document.createElement('canvas');
    this.sandCanvas.width = 2; this.sandCanvas.height = 2;
    this.sandTex = new THREE.CanvasTexture(this.sandCanvas);
    this.sandTex.minFilter = THREE.LinearFilter;

    this.buildFluidWaveSystem();
    this.syncUploadedImage();
  }

  getUIParams() {
    let ui = { seed: 180, scatter: 0.2, color: 'neon', glow: 90, gain: 1.5, gas1: '#16a0b5', gas2: '#063b4c', offX: 0, offY: 0, offZ: 0, gauge: 0.5 };
    if (window.cosmicEngineSettings) {
      const g = window.cosmicEngineSettings;
      ui.seed = g.seed ?? 180; // Shuffle ➡️ uAngle
      ui.scatter = THREE.MathUtils.mapLinear(g.scatterExponent ?? 2.2, 0.5, 5.0, 0.0, 1.0); // Range ➡️ uWaveSpacing (0.0~1.0)
      ui.color = g.colorStyle ?? 'neon';
      ui.glow = THREE.MathUtils.mapLinear(g.glowIntensity ?? 0.85, 0.1, 2.5, 40, 250); // Scale ➡️ 자막 크기
      ui.gain = THREE.MathUtils.mapLinear(g.audioGain ?? 1.0, 0.1, 5.0, 0.5, 4.0); // Volume ➡️ uWaveDetail (0.5~4.0)
      ui.gas1 = g.customColors?.gas1 ?? '#16a0b5'; 
      ui.gas2 = g.customColors?.gas2 ?? '#063b4c';
      ui.offX = g.positionOffset?.x ?? 0;
      ui.offY = g.positionOffset?.y ?? 0;
      ui.offZ = g.positionOffset?.z ?? 0;
      ui.gauge = g.gaugeValue ?? 0.5; // Gauge ➡️ uSurge (0.0~1.0)
    }
    return ui;
  }

  syncUploadedImage() {
    this.currentImageEl = window.currentUploadedImageElement || null;
    if (this.currentImageEl) {
      this.sandTex.image = this.currentImageEl;
      this.sandTex.needsUpdate = true;
      this.waveMaterial.uniforms.uUseSandMap.value = 1.0;
    } else {
      const ctx = this.sandCanvas.getContext('2d');
      ctx.fillStyle = '#d2b48c'; ctx.fillRect(0, 0, 2, 2);
      this.sandTex.needsUpdate = true;
      this.waveMaterial.uniforms.uUseSandMap.value = 0.0;
    }
  }

  buildFluidWaveSystem() {
    const waveGeo = new THREE.PlaneGeometry(6000, 6000, 1, 1);
    
    this.waveMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 }, uBass: { value: 0.0 }, uTreble: { value: 0.0 },
        uAngle: { value: 180.0 }, uSeed: { value: 0.0 }, uWaveDetail: { value: 1.5 },
        uSurge: { value: 0.25 }, uSurgeVelocity: { value: 0.0 }, uWaveSpacing: { value: 0.2 },
        uFoamSize: { value: 0.15 }, uAudioDirMode: { value: 1.0 }, 
        uTextMap: { value: this.textTexture }, uTextScale: { value: new THREE.Vector2(1.0, 1.0) },
        uSandMap: { value: this.sandTex }, uUseSandMap: { value: 0.0 }, 
        cSand: { value: new THREE.Color('#d2b48c') }, cShallow: { value: new THREE.Color('#16a0b5') }, cDeep: { value: new THREE.Color('#063b4c') }, cFoam: { value: new THREE.Color('#ffffff') } 
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
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
            vec2 screenUv = (vUv - 0.5) * uTextScale + 0.5; 
            float ang = radians(uAngle); float c = cos(ang); float s = sin(ang); mat2 matRot = mat2(c, -s, s, c);
            
            vec2 rUv = matRot * (screenUv - 0.5) + 0.5; vec2 noiseUv = rUv + vec2(uSeed * 0.1); 
            
            float freq = mix(4.0, 40.0, uWaveSpacing);
            float waveSine = sin(uTime * 1.5);
            
            float audioLevelOffset = (uAudioDirMode > 0.5) ? ((uBass * 0.15) - (uTreble * 0.15)) : (-(uBass * 0.05) - (uTreble * 0.05));
            float audioRipple = sin(rUv.x * freq + uTime) * uBass * 0.1;
            
            float wavePos = uSurge + audioLevelOffset + (waveSine * 0.06) + audioRipple; 
            
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
    ctx.font = `bold ${fontSizeStyle}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 80;
    ctx.fillStyle = '#00e5ff';

    for (let loop = 0; loop < 2; loop++) {
        ctx.fillText(text, 960, 1024);
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 960, 1024);

    ctx.restore();
    this.textTexture.needsUpdate = true;
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera || !this.waveMaterial) return;

    this.syncUploadedImage();

    const ui = this.getUIParams();
    this.time += 0.015;

    this.camera.position.set(ui.offX, 1500 + ui.offY, ui.offZ);
    this.camera.lookAt(ui.offX, ui.offY, ui.offZ);

    let fovRad = 45 * Math.PI / 180;
    let visibleHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.y; 
    let visibleWidth = visibleHeight * this.camera.aspect;
    this.waveMaterial.uniforms.uTextScale.value.set(6000.0 / visibleWidth, 6000.0 / visibleHeight);

    this.waveMaterial.uniforms.uTime.value = this.time;
    this.waveMaterial.uniforms.uAngle.value = ui.seed;          
    this.waveMaterial.uniforms.uWaveSpacing.value = ui.scatter;  
    this.waveMaterial.uniforms.uWaveDetail.value = ui.gain;      
    this.waveMaterial.uniforms.uSeed.value = this.globalRandomSeed;

    // 💡 [초정밀 초(Seconds) 단위 변환 복구 완료]
    let targetSurge = 0.05;
    let activeText = "";
    let modeLabel = "";

    const audioEl = document.querySelector('audio');
    
    // 💥 오디오 가동 시 초(Seconds) 단위로 완벽 계산
    if (audioEl && !audioEl.paused && window.parsedSubtitles && window.parsedSubtitles.length > 0) {
      const curTime = audioEl.currentTime; // milliseconds 환산 삭제 ➡️ Seconds로 단일 정렬
      
      const nextSub = window.parsedSubtitles.find(sub => sub.start > curTime && sub.start - curTime <= 0.8); // 800ms ➡️ 0.8초
      const currentSub = window.parsedSubtitles.find(sub => curTime >= sub.start && curTime <= sub.end);

      if (nextSub) {
        let progress = 1.0 - ((nextSub.start - curTime) / 0.8);
        targetSurge = THREE.MathUtils.lerp(0.85, 0.05, Math.pow(progress, 2.0)); // 0.85에서 0.05(덮기)로 급전진
        modeLabel = "⏳ SRT 자동 추적: 자막 출현 전 파도 덮침 돌격";
      } else if (currentSub) {
        activeText = currentSub.text;
        let activeProgress = (curTime - currentSub.start) / (currentSub.end - currentSub.start);
        targetSurge = THREE.MathUtils.lerp(0.05, 0.85, Math.min(1.0, activeProgress * 3.5)); // 0.05에서 0.85(철수)로 복귀
        modeLabel = "▶️ SRT 자동 추적: 자막 노출 파도 철수";
      } else {
        targetSurge = 0.05; // 평소에는 모래를 덮는 기본 대기 상태
        modeLabel = "🎵 오디오 재생 중 (공백 대기 구간)";
      }
    } 
    else {
      targetSurge = ui.gauge;
      activeText = window.currentSubtitleText || "자연 유체 스튜디오 v0.010\n(빛나는 네온 효과 완성)";
      modeLabel = "⏸️ 정지 모드 (오른쪽 Gauge 수치 수동 테스트)";
    }

    let currentSurge = this.waveMaterial.uniforms.uSurge.value;
    currentSurge += (targetSurge - currentSurge) * 0.05;
    this.waveMaterial.uniforms.uSurge.value = currentSurge;
    this.waveMaterial.uniforms.uSurgeVelocity.value = Math.abs(targetSurge - currentSurge);

    const nowMs = Date.now();
    if (nowMs - this.lastLogTime > 500) {
      console.log(
        `%c[🌊 v0.010 완결] %c수위(Surge): ${currentSurge.toFixed(2)} | 각도(Shuffle): ${ui.seed}° | 모드: ${modeLabel}`,
        "color: #00ffcc; font-weight: bold;", "color: #ffffff;"
      );
      this.lastLogTime = nowMs;
    }

    this.drawSubtitleToCanvas(activeText, ui.glow);

    let audioVol = audioData ? (audioData.vol || audioData.volume || 0.0) : 0.0;
    this.waveMaterial.uniforms.uBass.value = audioVol * 2.0;
    this.waveMaterial.uniforms.uTreble.value = audioVol * 2.5;

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
    if (this.wavePlane) { this.wavePlane.geometry.dispose(); this.waveMaterial.dispose(); this.scene.remove(this.wavePlane); }
    if (this.textTexture) this.textTexture.dispose();
    if (this.sandTex) this.sandTex.dispose();
    if (this.renderer) { this.container.removeChild(this.renderer.domElement); this.renderer.dispose(); }
    this.scene = null; this.camera = null; this.renderer = null;
  }
}
