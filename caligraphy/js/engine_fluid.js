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
}
