/**
 * 015_three_p5_aurora.js
 * Three.js의 GLSL 노이즈 셰이더(비선형 유체 배경)와 
 * p5.js의 Canvas 2D(오디오 반응형 빛 번짐 곡선)를 완벽하게 중첩(Overlay)한 하이브리드 미디어 아트
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeP5AuroraStage {
  constructor(container) {
    this.container = container;
    
    // Three.js 자원
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.uniforms = null;
    this.material = null;
    this.plane = null;

    // p5.js 자원
    this.p5Instance = null;
    
    this.numBands = 16;
    this.smoothedFreq = new Float32Array(this.numBands);
    this.currentAudioData = null;
  }

  async init() {
    this.container.style.position = 'relative'; // 자식 캔버스들의 겹침(Overlay)을 위한 설정

    // =========================================================
    // 1. Three.js 초기화 (배경: GLSL 노이즈 오로라 유체)
    // =========================================================
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 2D 셰이더 렌더링에 최적화된 Orthographic 카메라 사용
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '0'; // 배경
    this.container.appendChild(this.renderer.domElement);

    // 💡 [핵심] 오로라 유체를 렌더링하는 GPU GLSL 셰이더 코드
    this.uniforms = {
        uTime: { value: 0.0 },
        uAudio: { value: 0.0 },
        uColor1: { value: new THREE.Color() },
        uColor2: { value: new THREE.Color() },
        uScatter: { value: 2.2 }
    };

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float uTime;
        uniform float uAudio;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uScatter;
        varying vec2 vUv;

        // 2D Simplex Noise Function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ; m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        void main() {
            vec2 uv = vUv;
            float t = uTime * 0.15;
            
            // 다중 노이즈 레이어링으로 오로라의 비선형적 일렁임 생성
            float noise1 = snoise(uv * (1.5 + uScatter * 0.5) + vec2(t, -t));
            float noise2 = snoise(uv * (3.0 + uScatter) - vec2(-t * 1.5, t * 1.2) + noise1 * 0.5);
            
            // 오로라 곡선 궤적
            float wave = sin(uv.x * 3.0 + noise2 * 4.0 + t * 2.0);
            float dist = abs(uv.y - 0.5 - wave * 0.3);
            
            // 글로우(빛 번짐) 감쇠 공식
            float glow = 0.04 / (dist + 0.02);
            glow += smoothstep(0.5, 0.0, dist) * 0.6;
            
            // 배경 유체와 코어 색상 블렌딩
            vec3 baseColor = mix(uColor1, uColor2, uv.x + noise1 * 0.5);
            
            // 오디오 볼륨(uAudio)이 터질 때 오로라 전체가 번쩍임
            vec3 finalColor = baseColor * glow * (0.6 + uAudio * 2.5);
            finalColor += baseColor * (noise2 * 0.2) * (1.0 + uAudio);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    this.material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: this.uniforms
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.plane = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.plane);

    // =========================================================
    // 2. p5.js 초기화 (전경: 2D 오디오 리액티브 네온 파동)
    // =========================================================
    if (!window.p5) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('top', '0');
        canvas.style('left', '0');
        canvas.style('z-index', '1'); // Three.js 위에 겹침
        canvas.style('pointer-events', 'none'); // 클릭 이벤트 통과
        p.noLoop(); 
      };

      p.draw = () => {
        // 💡 [핵심] p5.js 캔버스는 매 프레임 투명하게 지워져서, 아래 깔린 Three.js 오로라가 보이게 함
        p.clear(); 
        
        if (!this.currentAudioData) return;

        let scatter = 2.2, gain = 1.0, glow = 0.85;
        let colorStyle = 'neon';
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = Number.isFinite(window.cosmicEngineSettings.scatterExponent) ? window.cosmicEngineSettings.scatterExponent : 2.2;
          gain = Number.isFinite(window.cosmicEngineSettings.audioGain) ? window.cosmicEngineSettings.audioGain : 1.0;
          glow = Number.isFinite(window.cosmicEngineSettings.glowIntensity) ? window.cosmicEngineSettings.glowIntensity : 0.85;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          customColors = window.cosmicEngineSettings.customColors || customColors;
        }

        // 주파수 데이터 정제
        let frameAverage = 0;
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            let sum = 0, count = 0;
            let maxLen = Math.min(150, this.currentAudioData.raw.length);
            for(let i = 0; i < maxLen; i++) {
                sum += this.currentAudioData.raw[i] || 0;
                count++;
            }
            if (count > 0) frameAverage = (sum / count) / 255.0;
        }

        for (let i = 0; i < this.numBands; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const binIndex = Math.floor(2 + Math.pow(i / (this.numBands-1), 1.5) * 120);
            if (binIndex < this.currentAudioData.raw.length) {
              rawVal = this.currentAudioData.raw[binIndex] || 0;
            }
          }

          let normalized = rawVal / 255.0;
          let isolated = Math.max(0, normalized - (frameAverage * 0.6));
          let targetFreq = Math.pow(isolated, 1.8) * gain * 300.0; 
          
          if (!Number.isFinite(targetFreq)) targetFreq = 0;

          // 부드러운 유체 움직임을 위한 스무딩
          if (targetFreq > this.smoothedFreq[i]) {
              this.smoothedFreq[i] += (targetFreq - this.smoothedFreq[i]) * 0.3;
          } else {
              this.smoothedFreq[i] += (targetFreq - this.smoothedFreq[i]) * 0.1;
          }
        }

        const ctx = p.drawingContext;
        const width = p.width;
        const height = p.height;
        const time = Date.now() * 0.001;

        // 💡 4가닥의 2D 빛 번짐(Glow) 파동 라인 그리기
        const numLines = 4;
        p.noFill();

        for (let l = 0; l < numLines; l++) {
            let yOffset = p.sin(time + l) * 50; 
            
            // 색상 매핑
            let ratio = l / (numLines - 1);
            let lineColor;
            if (colorStyle === 'neon') {
                lineColor = p.lerpColor(p.color('#ff00aa'), p.color('#00ffcc'), ratio);
            } else if (colorStyle === 'pastel') {
                lineColor = p.lerpColor(p.color('#ffb3ba'), p.color('#bae1ff'), ratio);
            } else if (colorStyle === 'custom') {
                lineColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), ratio);
            } else {
                lineColor = p.color(255);
            }

            // p5.js 특유의 부드러운 shadowBlur 네온 효과 적용
            ctx.shadowBlur = 20 * glow;
            ctx.shadowColor = lineColor.toString();
            p.strokeWeight(2 + glow * 2);
            
            let strokeC = p.color(lineColor);
            strokeC.setAlpha(150 + frameAverage * 100);
            p.stroke(strokeC);

            p.beginShape();
            p.curveVertex(-100, height/2);
            p.curveVertex(-100, height/2);

            for (let i = 0; i < this.numBands; i++) {
                let x = p.map(i, 0, this.numBands - 1, 0, width);
                // 주파수 파동 + Perlin 노이즈 일렁임 결합
                let noiseVal = p.noise(i * 0.1, time * 0.5 + l);
                let amp = this.smoothedFreq[i] * (0.5 + noiseVal);
                
                // 줄마다 파동이 위아래로 번갈아 치도록 연출
                let direction = (l % 2 === 0) ? -1 : 1;
                let y = (height / 2) + yOffset + (amp * direction * (scatter / 2.2));
                
                p.curveVertex(x, y);
            }

            p.curveVertex(width + 100, height/2);
            p.curveVertex(width + 100, height/2);
            p.endShape();
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.scene || !this.p5Instance) return;
    this.currentAudioData = audioData;

    // 💡 [Three.js 배경 업데이트]
    let scatter = 2.2, gain = 1.0;
    let colorStyle = 'neon';
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

    if (window.cosmicEngineSettings) {
      scatter = Number.isFinite(window.cosmicEngineSettings.scatterExponent) ? window.cosmicEngineSettings.scatterExponent : 2.2;
      gain = Number.isFinite(window.cosmicEngineSettings.audioGain) ? window.cosmicEngineSettings.audioGain : 1.0;
      colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
      customColors = window.cosmicEngineSettings.customColors || customColors;
    }

    // Three.js 셰이더 컬러 주입
    let c1 = new THREE.Color();
    let c2 = new THREE.Color();
    
    if (colorStyle === 'neon') {
        c1.setHex(0x1a0033); // 다크 퍼플
        c2.setHex(0x00ffcc); // 시안
    } else if (colorStyle === 'pastel') {
        c1.setHex(0xffb3ba); 
        c2.setHex(0xbae1ff);
    } else if (colorStyle === 'custom') {
        c1.set(customColors.gas1);
        c2.set(customColors.gas2);
    } else {
        c1.setHex(0x112233);
        c2.setHex(0x334455);
    }

    // 평균 볼륨 연산하여 셰이더로 전송
    let frameAverage = 0;
    if (audioData.raw && audioData.raw.length > 0) {
        let sum = 0;
        let maxLen = Math.min(150, audioData.raw.length);
        for(let i = 0; i < maxLen; i++) sum += audioData.raw[i] || 0;
        if (maxLen > 0) frameAverage = (sum / maxLen) / 255.0;
    }

    this.uniforms.uTime.value += 0.01;
    this.uniforms.uAudio.value = frameAverage * gain;
    this.uniforms.uScatter.value = scatter;
    this.uniforms.uColor1.value.copy(c1);
    this.uniforms.uColor2.value.copy(c2);

    this.renderer.render(this.scene, this.camera);

    // 💡 [p5.js 전경 업데이트]
    this.p5Instance.redraw(); 
  }

  resize(w, h) {
    if (this.renderer) {
      this.renderer.setSize(w, h);
    }
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
      this.renderer = null;
    }
    if (this.material) {
      this.material.dispose();
      this.plane.geometry.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.currentAudioData = null;
  }
}
