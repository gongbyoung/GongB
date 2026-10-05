class CalliFluidEngine {
  static renderBackground(ctx, w, h, bgType) {
    if (bgType === 'white-hanji') {
      ctx.fillStyle = '#faf7f2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(60, 50, 40, 0.015)';
      for (let i = 0; i < 300; i++) {
        ctx.beginPath(); ctx.arc((Math.sin(i * 1.5)*0.5+0.5)*w, (Math.cos(i*2.7)*0.5+0.5)*h, 1.8, 0, Math.PI*2); ctx.fill();
      }
    } else if (bgType === 'warm-hanji') {
      ctx.fillStyle = '#ede2cd'; ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'dark-paper') {
      ctx.fillStyle = '#141418'; ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  }

  static drawSeal(ctx, x, y, size, type, text, scalePop = 1.0, alpha = 1.0) {
    if (!type || type === 'none' || alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = x + size / 2, cy = y + size / 2;
    ctx.translate(cx, cy); ctx.scale(scalePop, scalePop); ctx.translate(-cx, -cy);

    const isRed = (type === 'seal-red');
    ctx.fillStyle = isRed ? '#bb1b27' : '#1f1e24';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = isRed ? '#e2303c' : '#33323d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const str = text.trim() || '낙관';
    if (str.length <= 2) {
      ctx.font = `bold ${Math.round(size * 0.4)}px 'Batang', serif`;
      ctx.fillText(str[0], x + size / 2, y + size * 0.33);
      if (str[1]) ctx.fillText(str[1], x + size / 2, y + size * 0.72);
    } else {
      ctx.font = `bold ${Math.round(size * 0.3)}px 'Batang', serif`;
      ctx.fillText(str[0], x + size * 0.3, y + size * 0.32); ctx.fillText(str[1], x + size * 0.7, y + size * 0.32);
      ctx.fillText(str[2], x + size * 0.3, y + size * 0.72); ctx.fillText(str[3] || '', x + size * 0.7, y + size * 0.72);
    }
    ctx.restore();
  }

  // 💡 [화룡점정] 화선지 먹물 번짐(Bleeding) 셀룰러 오토마타 알고리즘
  static applyBleeding(ctx, w, h, bleedAmount) {
    if (bleedAmount <= 0.01) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const nextData = new Uint8ClampedArray(data);

    // bleedAmount(0.0~1.0)에 따라 번짐 반경(패스 횟수)을 결정
    const passes = Math.floor(bleedAmount * 8); 
    
    for (let p = 0; p < passes; p++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;

          // 알파값(불투명도)이 존재하는 먹물 픽셀일 때
          if (data[idx + 3] > 10) {
            // 상하좌우 및 대각선 무작위 확산 (종이 섬유질의 불규칙성 시뮬레이션)
            if (Math.random() < 0.5) {
              const xOffset = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
              const yOffset = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
              const targetIdx = ((y + yOffset) * w + (x + xOffset)) * 4;

              // 원본 먹물 색상을 주변으로 번지게 함
              nextData[targetIdx] = data[idx];
              nextData[targetIdx+1] = data[idx+1];
              nextData[targetIdx+2] = data[idx+2];
              // 물이 퍼져나가며 투명해지는 효과 누적
              nextData[targetIdx+3] = Math.min(255, nextData[targetIdx+3] + data[idx+3] * 0.4);
            }
          }
        }
      }
      data.set(nextData); // 다음 패스에 갱신된 데이터 사용
    }
    ctx.putImageData(new ImageData(nextData, w, h), 0, 0);
  }
}
