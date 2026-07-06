/**
 * 015_three_p5_aurora.js
 * 3D 파티클(Points) 시스템을 활용하여 완벽한 Z-Depth(깊이감)를 가진 3겹의 오로라 렌더링.
 * 2D 평면 느낌을 완벽히 탈피하고, 파티클들이 모여 유체를 이루며 가장자리로 흩어지는 물리적 미디어 아트.
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeAuroraFluidStage {
  constructor(container) {
    this.container = container;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.layers = []; // 3겹의 오로라 레이어 관리

    this.smoothLow = 0;
    this.smoothMid = 0;
    this.smoothHigh = 0;
    
    this.currentAudioData = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 💡 평면 느낌(Orthographic)을 버리고, 입체감을 살리는 원근(Perspective) 카메라 사용
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.z = 4;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    // 블렌딩 최적화를 위한 설정
    this.renderer.setClearColor(0x020308, 1.0); 
    this.container.appendChild(this.renderer.domElement);

    // 💡 [핵심] 3겹의 레이어 생성 (저음, 중음, 고음)
    // 0: 뒤쪽(마젠타), 1: 중간(시안), 2: 앞쪽(옐로우)
    this.layers.push(this.createAuroraLayer(0xff0055, -0.6, 0.3));  
    this.layers.push(this.createAuroraLayer(0x00ffcc, 0.0, 0.0));   
    this.layers.push(this.createAuroraLayer(0xffcc00, 0.6, -0.3));  
  }

  // 💡 파티클 기반 오로라 레이어 생성기
  createAuroraLayer(colorHex, zIndex, yOffset) {
    const uniforms = {
        uTime: { value: 0.0 },
        uAudio: { value: 0.0 },
        uColor: { value: new THREE.Color(colorHex) },
        uScatter: { value: 2.2 }, // 오로라 크기/분산
        uSeed: { value: 42.0 },   // 오로라 지형
        uShapeMode: { value: 0 }  // 입자 쉐이프
    };

    const vertexShader = `
        uniform float uTime;
        uniform float uAudio;
        uniform float uScatter;
        uniform float uSeed;
        
        varying float vAlpha;
        varying vec3 vColor;

        // 3D Simplex Noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i); 
            vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m; return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            vec3 pos = position;
            float t = uTime * 0.3 + uSeed;
            
            // 💡 3D 노이즈를 이용해 유체의 굴곡(Z, Y) 생성
            // uScatter(분산 범위)가 클수록 오로라가 위아래로 더 넓게 흩뿌려짐
            float noiseX = pos.x * 0.8;
            float noiseY = pos.y * (1.0 + uScatter * 0.5);
            
            float n1 = snoise(vec3(noiseX, noiseY, t));
            float n2 = snoise(vec3(noiseX * 2.0 + t, noiseY * 2.0, -t));
            
            // 오디오 볼륨이 클수록 입자들이 Z축(앞뒤)과 Y축(상하)으로 격렬하게 요동침
            pos.z += n1 * 0.5 * (1.0 + uAudio * 2.0);
            pos.y += n2 * 0.3 * (1.0 + uAudio * 1.5);

            // 💡 [핵심] 가장자리 소멸 렌더링 (경계선 흐리기)
            // Y축 가장자리로 갈수록 vAlpha값이 0에 가까워짐
            float edgeFade = 1.0 - smoothstep(0.3, 1.0, abs(position.y));
            // 노이즈를 섞어 입자들이 불규칙하게 소멸되도록 유도
            vAlpha = edgeFade * smoothstep(-0.3, 0.8, snoise(vec3(pos.x*3.0, pos.y*3.0, t)));
            
            // 오디오가 튈 때 번쩍임 효과
            vAlpha *= (0.3 + uAudio * 2.5);

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // 카메라와 가까울수록 입자가 커지고, 오디오가 클수록 커짐
            float baseSize = 30.0 + (uAudio * 100.0);
            gl_PointSize = baseSize * (1.0 / -mvPosition.z);
        }
    `;

    const fragmentShader = `
        uniform vec3 uColor;
        uniform int uShapeMode;
        
        varying float vAlpha;

        void main() {
            // 입자의 중심(0.5, 0.5)으로부터의 거리
            vec2 pt = gl_PointCoord - vec2(0.5);
            float d = length(pt);
            
            float alpha = vAlpha;
            vec3 color = uColor;

            // 💡 UI 스타일에 따른 입자 쉐이프(모양) 결정
            if (uShapeMode == 0) {
                // 모드 0: 희미한 깃털 (입자들이 뭉쳐 부드러운 유체를 만듦)
                alpha *= smoothstep(0.5, 0.0, d);
            } else if (uShapeMode == 1) {
                // 모드 1: 선명한 점 (Dots)
                if (d > 0.45) discard; // 원형 밖은 잘라냄
            } else if (uShapeMode == 2) {
                // 모드 2: 사각형 (Squares)
                // gl_PointCoord 전체 영역을 칠함 (자르지 않음)
            } else if (uShapeMode == 3) {
                // 모드 3: 입체 스피어 (Spheres)
                if (d > 0.45) discard;
                float z = sqrt(0.25 - d * d) / 0.5; // 구면의 높이 계산
                color *= (0.3 + z * 1.5); // 입체 명암 부여
            }

            // 완전 투명한 찌꺼기 제거
            if (alpha < 0.01) discard;

            // Additive Blending을 위한 Premultiplied Alpha
            gl_FragColor = vec4(color * alpha, alpha);
        }
    `;

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending, // 겹칠수록 빛이 강해지는 블렌딩
        depthWrite: false // 파티클 겹침 에러 방지
    });

    // 💡 평면이 아니라 한 겹당 16,000개(200x80)의 점(Points)으로 구성
    const geometry = new THREE.PlaneGeometry(6, 2, 200, 80);
    const points = new THREE.Points(geometry, material);
    
    // 레이어별 위치 조정 (Z-Depth 적용)
    points.position.z = zIndex;
    points.position.y = yOffset;
    
    this.scene.add(points);
    return { points, uniforms };
  }

  update(audioData) {
    if (!this.scene) return;
    this.currentAudioData = audioData;

    let scatter = 2.2, gain = 1.0, seed = 42;
    let colorStyle = 'neon';

    if (window.cosmicEngineSettings) {
      scatter = Number.isFinite(window.cosmicEngineSettings.scatterExponent) ? window.cosmicEngineSettings.scatterExponent : 2.2;
      gain = Number.isFinite(window.cosmicEngineSettings.audioGain) ? window.cosmicEngineSettings.audioGain : 1.0;
      seed = Number.isFinite(window.cosmicEngineSettings.seed) ? window.cosmicEngineSettings.seed : 42;
      colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
    }

    // 주파수 3분할 추출 (Bass, Mid, Treble)
    let lowSum = 0, midSum = 0, highSum = 0;
    let lowCount = 0, midCount = 0, highCount = 0;

    if (audioData.raw && audioData.raw.length > 0) {
        for(let i = 2; i < 12; i++) { lowSum += audioData.raw[i] || 0; lowCount++; }
        for(let i = 12; i < 35; i++) { midSum += audioData.raw[i] || 0; midCount++; }
        for(let i = 35; i < 90; i++) { highSum += audioData.raw[i] || 0; highCount++; }
    }

    let targetLow = lowCount > 0 ? Math.pow((lowSum / lowCount) / 255.0, 1.8) : 0;
    let targetMid = midCount > 0 ? Math.pow((midSum / midCount) / 255.0, 1.8) : 0;
    let targetHigh = highCount > 0 ? Math.pow((highSum / highCount) / 255.0, 1.8) : 0;

    this.smoothLow += (targetLow * gain - this.smoothLow) * 0.15;
    this.smoothMid += (targetMid * gain - this.smoothMid) * 0.15;
    this.smoothHigh += (targetHigh * gain - this.smoothHigh) * 0.15;

    // UI 스타일 -> 파티클 쉐이프 매핑
    let shapeMode = 0; 
    if (colorStyle === 'pastel') shapeMode = 1; // 점
    else if (colorStyle === 'custom') shapeMode = 2; // 사각형
    else if (colorStyle === 'monochrome') shapeMode = 3; // 스피어

    // 시간 및 카메라 회전 (입체감 부여)
    const time = Date.now() * 0.001;
    this.scene.rotation.y = Math.sin(time * 0.5) * 0.15; // 좌우로 부드럽게 흔들림
    this.scene.rotation.x = Math.cos(time * 0.3) * 0.05; // 상하로 부드럽게 흔들림

    // 각 레이어(3겹)에 독립적인 주파수와 옵션 주입
    const audios = [this.smoothLow, this.smoothMid, this.smoothHigh];
    
    for (let i = 0; i < 3; i++) {
        const uni = this.layers[i].uniforms;
        uni.uTime.value = time;
        uni.uAudio.value = audios[i];
        uni.uScatter.value = scatter;
        uni.uSeed.value = seed;
        uni.uShapeMode.value = shapeMode;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.renderer && this.camera) {
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
      this.renderer = null;
    }
    this.layers.forEach(layer => {
        layer.points.geometry.dispose();
        layer.points.material.dispose();
    });
    this.layers = [];
    this.scene = null;
    this.camera = null;
    this.currentAudioData = null;
  }
}
