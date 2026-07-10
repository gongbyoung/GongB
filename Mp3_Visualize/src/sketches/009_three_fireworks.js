/**
 * src/sketches/009_three_fireworks.js
 * - [버전] Ver 6.4 (매 파도 가변형 랜덤 시드 및 v0.010 아키텍처 최종 완결판)
 * - 파도가 완전히 철수했다가 다시 밀려오는 시점을 정밀 추적하여 uSeed(지형 노이즈 형태)를 매번 무작위 변경
 * - 가만히 두거나 음악이 흐를 때 똑같은 파도 모양이 무한 반복되던 문제를 해결하여 하이퍼 리얼리즘 완성
 * - Shuffle(파도 방향 각도), Range(파도 간격 밀도), Scale(자막 크기), Volume(노이즈 디테일), Gauge(수동 수위) UI 완벽 바인딩
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
    
    // 💡 매번 새로운 파형 추적을 위한 가속도/방향 필터 변수
    this.prevSurge = 0.0;
    this.wasGoingDown = false;

    this.lastLogTime = 0;
    this.version = "Nature Fluid Studio v0.010 (매 파도 가변 랜덤판)";
  }

  init() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020205);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 8000);
    this.camera.position.set(0, 1500, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

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
      ui.seed = g.seed ?? 180; 
      ui.scatter = THREE.MathUtils.mapLinear(g.scatterExponent ?? 2.2, 0.5, 5.0, 0.0, 1.0); 
      ui.color = g.colorStyle ?? 'neon';
      ui.glow = THREE.MathUtils.mapLinear(g.glowIntensity ?? 0.85, 0.1, 2.5, 40, 250); 
      ui.gain = THREE.MathUtils.mapLinear(g.audioGain ?? 1.0, 0.1, 5.0, 0.5, 4.0); 
      ui.gas1 = g.customColors?.gas1 ?? '#16a0b5'; 
      ui.gas2 = g.customColors?.gas2 ?? '#063b4c';
      ui.offX = g.positionOffset?.x ?? 0;
      ui.offY = g.positionOffset?.y ?? 0;
      ui.offZ = g.positionOffset?.z ?? 0;
      ui.gauge = g.gaugeValue ?? 0.5; 
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

    let targetSurge = 0.05;
    let activeText = "";
    let modeLabel = "";

    const audioEl = document.querySelector('audio');
    
    if (audioEl && !audioEl.paused && window.parsedSubtitles && window.parsedSubtitles.length > 0) {
      const curTime = audioEl.currentTime;
      
      const nextSub = window.parsedSubtitles.find(sub => sub.start > curTime && sub.start - curTime <= 0.8);
      const currentSub = window.parsedSubtitles.find(sub => curTime >= sub.start && curTime <= sub.end);

      if (nextSub) {
        let progress = 1.0 - ((nextSub.start - curTime) / 0.8);
        targetSurge = THREE.MathUtils.lerp(0.85, 0.05, Math.pow(progress, 2.0));
        modeLabel = "⏳ SRT 자동 추적: 자막 발생 전 파도 밀려옴";
      } else if (currentSub) {
        activeText = currentSub.text;
        let activeProgress = (curTime - currentSub.start) / (currentSub.end - currentSub.start);
        targetSurge = THREE.MathUtils.lerp(0.05, 0.85, Math.min(1.0, activeProgress * 3.5));
        modeLabel = "▶️ SRT 자동 추적: 자막 노출 파도 철수";
      } else {
        targetSurge = 0.85; // 대기 공백 구간에는 물이 빠진 바다 상태 고정
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

    // 💡 [핵심 구현: 매 파도 진입 시 무작위 가변 뒤섞기 엔진]
    // 파도가 최고 수위로 올라왔다가(바다 뒤로 후퇴했다가) 다시 아래 모래사장(전진)으로 떨어지기 직전 터닝 시점 캐치
    if (currentSurge > this.prevSurge) {
      this.wasGoingDown = false; // 물이 빠지는 중(뒤로 후퇴 중)
    } else if (currentSurge < this.prevSurge) {
      // 💥 파도가 최하점을 찍고 다시 밀려 들어오기 시작하는 완벽한 반전 시점 포착!
      if (!this.wasGoingDown && currentSurge < 0.25) { 
        this.globalRandomSeed = Math.random() * 500.0; // 매 파도마다 완전히 새로운 좌우 노이즈 시드 무작위 배정
        console.log(`%c[🌊 파도 지형 전수 스위칭] 완전 새로운 물결 셔플 시드 자동 주입: ${this.globalRandomSeed.toFixed(2)}`, "color: #ffaa00; font-weight: bold;");
      }
      this.wasGoingDown = true;
    }
    this.prevSurge = currentSurge;

    const nowMs = Date.now();
    if (nowMs - this.lastLogTime > 500) {
      console.log(
        `%c[🌊 v0.010 가변 락인] %c수위(Surge): ${currentSurge.toFixed(2)} | 각도(Shuffle): ${ui.seed}° | 실시간 시드: ${this.globalRandomSeed.toFixed(1)} | 모드: ${modeLabel}`,
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
