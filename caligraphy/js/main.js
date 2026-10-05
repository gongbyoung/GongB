function renderWritingGlyph(targetCtx, ch, renderX, renderY, fontSize, uiParams, isMajor, progressU) {
  if (progressU <= 0.001) return;
  const path = loadedFont.getPath(ch, 0, 0, fontSize);
  let bbox = { x1: 0, y1: -fontSize * 0.7, x2: fontSize * 0.7, y2: 0 };
  try { bbox = path.getBoundingBox(); } catch(e) {}

  const deformed = CalliBrushEngine.deformGlyph(path.commands, bbox, uiParams, isMajor, 250);
  
  // 💡 [수정] 붓털이 잘리지 않도록 폰트 크기에 비례하는 넉넉한 도화지(Offscreen) 패딩 생성
  const pad = fontSize * 1.5; 
  const gw = Math.max(100, (bbox.x2 - bbox.x1) * 2.5 + pad);
  const gh = Math.max(100, (bbox.y2 - bbox.y1) * 2.5 + pad);
  
  charOffscreen.width = gw; charOffscreen.height = gh;
  const localCX = gw / 2, localCY = gh * 0.45;
  
  charCtx.clearRect(0, 0, gw, gh);
  charCtx.save();
  charCtx.translate(localCX, localCY);
  CalliBrushEngine.renderCommands(charCtx, deformed);
  charCtx.fill();
  
  charCtx.globalCompositeOperation = 'source-in';
  const bristleTexture = CalliBrushEngine.generateBristleTexture(gw, gh, uiParams.inkColor, uiParams.slitCut);
  charCtx.drawImage(bristleTexture, -localCX, -localCY);
  charCtx.restore();

  if (progressU < 0.999) {
    charCtx.save();
    charCtx.globalCompositeOperation = 'destination-in';
    charCtx.translate(localCX, localCY);
    charCtx.rotate(-(50 * Math.PI) / 180);
    const diag = Math.hypot(gw, gh);
    const sweepX = -diag * 0.48 + progressU * (diag * 0.96);
    charCtx.beginPath(); charCtx.moveTo(-diag, -diag); charCtx.lineTo(sweepX, -diag);
    for (let s = 0; s <= 12; s++) charCtx.lineTo(sweepX + Math.sin(s * 1.5 + progressU * 8) * 8, -diag + (s / 12) * (diag * 2));
    charCtx.lineTo(-diag, diag); charCtx.fill(); charCtx.restore();
  }

  CalliFluidEngine.applyBleeding(charCtx, gw, gh, uiParams.bleed);
  targetCtx.drawImage(charOffscreen, renderX - localCX, renderY - localCY);
}
