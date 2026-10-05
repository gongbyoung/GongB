class CalliLayoutEngine {
  static compute(text, bounds, uiParams) {
    const { w, h } = bounds;
    const { 
      layoutPattern, decay, contrast, spacing, lineHeight, strokeExpand, 
      globalScale = 1.0, offsetX = 0, offsetY = 0, 
      writingMode = 'horizontal', columnDir = 'rtl' 
    } = uiParams;

    const safeW = w * 0.85; 
    const safeH = h * 0.80; 

    let rawLines = text.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) rawLines = ["캘리그라피"];

    let baseFontSize = (Math.min(w, h) * 0.10) * globalScale;

    // ==========================================
    // 1. 가로쓰기 모드 (Horizontal Writing)
    // ==========================================
    if (writingMode === 'horizontal') {
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
        } else if (layoutPattern === 'zigzag') {
          startX = (w - finalLineWidth) / 2 + (lineIdx % 2 === 0 ? -w*0.08 : w*0.08);
        }

        startX = Math.max(w * 0.05, Math.min(w * 0.95 - finalLineWidth, startX)) + offsetX;

        const charMeta = meta.chars.map((ch, cIdx) => {
          let cY = currentY;
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
    // ==========================================
    // 2. 세로쓰기 모드 (Vertical Writing)
    // ==========================================
    else {
      let columns = [];
      rawLines.forEach(lineStr => {
        // 세로 공간을 넘어갈 경우 자동으로 열(Column)을 나눔
        let chars = Array.from(lineStr);
        let maxCharsPerCol = Math.max(3, Math.floor(safeH / (baseFontSize * 1.15 * lineHeight)));
        
        for (let i = 0; i < chars.length; i += maxCharsPerCol) {
          columns.push(chars.slice(i, i + maxCharsPerCol));
        }
      });

      const colCount = columns.length;
      let maxColChars = Math.max(...columns.map(c => c.length), 1);

      let fSize = baseFontSize;
      let colStepX = fSize * 1.25 * lineHeight; // 열과 열 사이의 가로 간격
      let charStepY = fSize * 0.95 + spacing;   // 글자와 글자 사이의 세로 간격

      let totalColWidth = colCount * colStepX;
      let maxColHeight = maxColChars * charStepY;

      let fitScale = 1.0;
      if (totalColWidth > safeW) fitScale = Math.min(fitScale, safeW / totalColWidth);
      if (maxColHeight > safeH) fitScale = Math.min(fitScale, safeH / maxColHeight);

      let finalFontSize = fSize * fitScale;
      let finalColStepX = colStepX * fitScale;
      let finalCharStepY = charStepY * fitScale;

      const lineLayouts = [];
      let globalCharIndex = 0;

      let actualTotalWidth = colCount * finalColStepX;
      
      // 줄바꿈 방향(columnDir)에 따른 시작 X축 기준점 설정
      // 'rtl': 오른쪽에서 왼쪽으로 열 진행 (전통 한옥/서예 방식)
      // 'ltr': 왼쪽에서 오른쪽으로 열 진행 (현대식 세로쓰기)
      let startXBase = w / 2 + actualTotalWidth / 2 - finalColStepX / 2;
      if (columnDir === 'ltr') {
        startXBase = w / 2 - actualTotalWidth / 2 + finalColStepX / 2;
      }

      columns.forEach((chars, colIdx) => {
        let colX = startXBase;
        if (columnDir === 'rtl') {
          colX = startXBase - (colIdx * finalColStepX);
        } else {
          colX = startXBase + (colIdx * finalColStepX);
        }
        colX += offsetX;

        let colHeight = chars.length * finalCharStepY;
        let startY = (h - colHeight) / 2 + (finalFontSize * 0.5) + offsetY;

        const charMeta = chars.map((ch, cIdx) => ({
          ch, cIdx, globalIdx: globalCharIndex++,
          x: colX, 
          y: startY + (cIdx * finalCharStepY),
          fontSize: finalFontSize, 
          advance: finalCharStepY
        }));

        lineLayouts.push({
          chars: charMeta,
          fontSize: finalFontSize,
          charAdvance: finalCharStepY,
          startX: colX,
          y: startY,
          lineIdx: colIdx,
          isLastLine: (colIdx === colCount - 1)
        });
      });

      return { lineLayouts, baseSize: finalFontSize, totalChars: globalCharIndex };
    }
  }
}
