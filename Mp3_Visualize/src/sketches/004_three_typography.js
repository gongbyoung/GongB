/**
 * 004_three_typography.js
 * SRT 자막, 커스텀 이미지, 오디오 반응성이 융합된 3D 타이포 무대
 */
export default class ThreeTypography {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.textCanvas = document.createElement('canvas');
    this.textCtx = this.textCanvas.getContext('2d');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 256;
    
    this.textTexture = null;
    this.textMesh = null;
    this.bgMesh = null;
    this.lastText = "";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    const bgGeo = new THREE.PlaneGeometry(16, 9);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x05050a, side: THREE.DoubleSide });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.z = -5;
    this.scene.add(this.bgMesh);

    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    const textGeo = new THREE.PlaneGeometry(6, 1.5);
    const textMat = new THREE.MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.textMesh = new THREE.Mesh(textGeo, textMat);
    this.scene.add(this.textMesh);

    this.drawText(window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "MUSIC VISUAL STAGE");
  }

  drawText(text) {
    const ctx = this.textCtx;
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, this.textCanvas.width, this.textCanvas.height);

    const userFont = window.cosmicEngineSettings?.fontFamily || 'sans-serif';
    ctx.font = `bold 50px ${userFont}, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ffcc';
    ctx.fillStyle = '#ffffff';
    
    ctx.fillText(text, this.textCanvas.width / 2, this.textCanvas.height / 2);
    if (this.textTexture) this.textTexture.needsUpdate = true;
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    const currentText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (currentText !== this.lastText) {
      this.drawText(currentText);
      this.lastText = currentText;
      this.camera.position.z = 4.3;
    }

    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 5, 0.08);

    if (audioData) {
      const bass = audioData.bass || 0;
      const vol = audioData.vol || 0;
      const textScale = 1 + bass * 0.4;
      this.textMesh.scale.set(textScale, textScale, 1);
      this.textMesh.rotation.y = Math.sin(Date.now() * 0.002) * 0.2;
    }

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
    if (this.textTexture) this.textTexture.dispose();
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
  }
}