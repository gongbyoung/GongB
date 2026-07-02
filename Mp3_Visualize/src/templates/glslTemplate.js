/**
 * glslTemplate.js
 * GPU 기반 Fragment Shader 미디어 아트를 만들 때 복사해서 쓸 거푸집
 */
export default class GlslTemplate {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.material = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    // 2D 평면을 꽉 채워 촬영할 정형 카메라 세팅
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    // 1. 버텍스 셰이더 (화면 전체 좌표 정의 - 고정)
    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    // 2. 프래그먼트 셰이더 (여기가 핵심 비주얼 연출 공간)
    const fragmentShader = `
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_volume;
      uniform float u_bass;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        
        // 베이스와 전체 볼륨에 반응하는 간단한 그라데이션 사이키델릭 효과
        vec3 color = vec3(uv.x * u_bass, uv.y * u_volume, sin(u_time) * 0.5 + 0.5);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // 3. 자바스크립트 데이터를 GPU 셰이더 변수로 연결하는 Uniforms 설정
    this.uniforms = {
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_time: { value: 0 },
      u_volume: { value: 0 },
      u_bass: { value: 0 }
    };

    // 4. 메쉬 생성 및 장면에 추가
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms
    });

    const mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(mesh);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // GPU 셰이더 내부 변수들에 실시간 오디오 데이터 주입
    this.uniforms.u_time.value += 0.01;
    if (audioData) {
      this.uniforms.u_volume.value = audioData.volume;
      this.uniforms.u_bass.value = audioData.bass;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.renderer) this.renderer.setSize(w, h);
    if (this.uniforms) this.uniforms.u_resolution.value.set(w, h);
  }

  destroy() {
    if (!this.scene) return;
    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      object.material.dispose();
    });
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}