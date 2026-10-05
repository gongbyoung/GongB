class CalliLayoutEngine {
  static compute(text, bounds, uiParams) {
    const { w, h } = bounds;
    const { layoutPattern, decay, contrast, spacing, lineHeight, strokeExpand, globalScale = 1.0, offsetX = 0, offsetY = 0 } = uiParams;

    const safeW = w * 0.85; 
    const safeH = h * 0.80; 

    let rawLines = text.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) rawLines = ["캘리그라피"];

    let baseFontSize = (Math.min(w, h) * 0.10) * globalScale;

    let processedLines = [];
    rawLines.forEach(lineStr => {
      let words = lineStr.split(' ');
      let currentLine = [];
      let currentWidth = 0;

      for(let i = 0; i < words.length; i++) {
        let word = words[i];
        let lineIdx = processedLines.length;
        let charScale = (lineIdx === 0) ? contrast : Math.max(0.5, 1.0 / Math.pow(decay, lineIdx));
        let fSize = baseFontSize * charScale;
        let cAdvance = fSize * 0.85 + spacing;
        
        let wordWidth = Array.from(word).length * cAdvance;
        let spaceWidth = (currentLine.length > 0) ? cAdvance * 0.5 : 0;
        let totalExpectedWidth = currentWidth + spaceWidth + wordWidth + (fSize * strokeExpand);

        if (totalExpectedWidth > safeW && currentLine.length > 0) {
          processedLines.push(currentLine.join(' '));
          currentLine = [word];
          currentWidth = wordWidth;
        } else {
          currentLine.push(word);
          currentWidth += spaceWidth + wordWidth;
        }
      }
      if (currentLine.length > 0) processedLines.push(currentLine.join(' '));
    });

    const lineCount = processedLines.length;
    let totalHeight = 0;
    let maxLineWidth = 0;

    const linesMeta = processedLines.map((lineStr, lineIdx) => {
      const chars = Array.from(lineStr);
      let charScale = (lineIdx === 0) ? contrast : Math.max(0.5, 1.0 / Math.pow(decay, lineIdx));
      let fSize = baseFontSize * charScale;
      let cAdvance = fSize * 0.85 + spacing;
      
      let lWidth = 0;
      if (chars.length > 0) lWidth = (chars.length - 1) * cAdvance + (fSize * strokeExpand * 1.5);
      if (lWidth > maxLineWidth) maxLineWidth = lWidth;
      
      let hStep = fSize * 1.16 * lineHeight;
      totalHeight += hStep;
      
      return { chars, fSize, cAdvance, lWidth, hStep };
    });

    let fitScale = 1.0;
    if (totalHeight > safeH) fitScale = Math.min(fitScale, safeH / totalHeight);
    if (maxLineWidth > safeW) fitScale = Math.min(fitScale, safeW / maxLineWidth);

    const lineLayouts = [];
    let finalTotalHeight = totalHeight * fitScale;
    let currentY = (h - finalTotalHeight) / 2 + (linesMeta[0].fSize * fitScale * 0.5) + offsetY;
    let globalCharIndex = 0;

    linesMeta.forEach((meta, lineIdx) => {
      let finalFontSize = meta.fSize * fitScale;
      let finalAdvance = meta.cAdvance * fitScale;
      let finalLineWidth = meta.lWidth * fitScale;
      
      let startX = (w - finalLineWidth) / 2;
      
      if (layoutPattern === 'stair-diagonal') {
        startX = (w - safeW)/2 + ((safeW - finalLineWidth) / Math.max(1, lineCount - 1)) * lineIdx;
      } else if (layoutPattern === 'block-headline') {
        startX = (w - finalLineWidth) / 2 + (lineIdx % 2 === 0 ? -w*0.02 : w*0.02);
      } 
      // 💡 [신규] 갈지자 (지그재그) - 폭을 극단적으로 좌우로 찢어놓음
      else if (layoutPattern === 'zigzag') {
        startX = (w - finalLineWidth) / 2 + (lineIdx % 2 === 0 ? -w*0.08 : w*0.08);
      }

      startX = Math.max(w * 0.05, Math.min(w * 0.95 - finalLineWidth, startX)) + offsetX;

      const charMeta = meta.chars.map((ch, cIdx) => {
        let cY = currentY;
        // 💡 [신규] 물결 춤사위 - 글자가 사인파를 그리며 오르락내리락 함
        if (layoutPattern === 'wave-dance') {
          cY += Math.sin(cIdx * 1.2) * (finalFontSize * 0.15);
        }
        
        return {
          ch, cIdx, globalIdx: globalCharIndex++,
          x: startX + cIdx * finalAdvance, y: cY,
          fontSize: finalFontSize, advance: finalAdvance
        };
      });

      lineLayouts.push({ chars: charMeta, fontSize: finalFontSize, charAdvance: finalAdvance, startX, y: currentY, lineIdx, isLastLine: (lineIdx === lineCount - 1) });
      currentY += meta.hStep * fitScale;
    });

    return { lineLayouts, baseSize: baseFontSize * fitScale, totalChars: globalCharIndex };
  }
}
