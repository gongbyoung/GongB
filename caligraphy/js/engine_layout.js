class CalliLayoutEngine {
  static compute(text, bounds, uiParams) {
    const { w, h } = bounds;
    // 💡 [수정됨] 사용자 지정 전체 스케일 및 X, Y 이동 변수 가져오기
    const { layoutPattern, decay, contrast, spacing, lineHeight, strokeExpand, globalScale = 1.0, offsetX = 0, offsetY = 0 } = uiParams;

    let rawLines = text.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) rawLines = ["캘리그라피"];

    let processedLines = [];
    rawLines.forEach(l => {
      const chars = Array.from(l);
      if (chars.length > 14 && layoutPattern !== 'emblem-compact') {
        const mid = Math.ceil(chars.length / 2);
        processedLines.push(chars.slice(0, mid).join(''));
        processedLines.push(chars.slice(mid).join(''));
      } else {
        processedLines.push(l);
      }
    });

    const lineCount = processedLines.length;
    const DUMMY_SIZE = 100;
    let maxLineWidth = 0;
    let totalHeight = 0;
    
    const linesMeta = processedLines.map((lineStr, lineIdx) => {
      const chars = Array.from(lineStr);
      let charScale = (lineIdx === 0) ? contrast : Math.max(0.5, 1.0 / Math.pow(decay, lineIdx));
      let fSize = DUMMY_SIZE * charScale;
      let cAdvance = fSize * 0.85 + spacing;
      
      let lWidth = 0;
      if (chars.length > 0) lWidth = (chars.length - 1) * cAdvance + (fSize * strokeExpand * 1.5);
      if (lWidth > maxLineWidth) maxLineWidth = lWidth;
      
      let hStep = fSize * 1.16 * lineHeight;
      totalHeight += hStep;
      
      return { chars, fSize, cAdvance, lWidth, hStep };
    });

    const safeW = w * 0.85; 
    const safeH = h * 0.80; 
    
    // 자동 방어 스케일 연산
    let autoScale = Math.min(safeW / Math.max(1, maxLineWidth), safeH / Math.max(1, totalHeight));
    autoScale = Math.min(autoScale, 2.5);

    // 💡 [핵심] 자동 스케일에 사용자가 지정한 '전체 크기 배율'을 추가로 곱해줌
    let finalGlobalScale = autoScale * globalScale;

    const lineLayouts = [];
    let finalTotalHeight = totalHeight * finalGlobalScale;
    
    // 💡 중앙 정렬 Y값에 사용자가 지정한 세로 위치(offsetY)를 추가
    let currentY = (h - finalTotalHeight) / 2 + (linesMeta[0].fSize * finalGlobalScale * 0.5) + offsetY;
    let globalCharIndex = 0;

    linesMeta.forEach((meta, lineIdx) => {
      let finalFontSize = meta.fSize * finalGlobalScale;
      let finalAdvance = meta.cAdvance * finalGlobalScale;
      let finalLineWidth = meta.lWidth * finalGlobalScale;
      
      let startX = (w - finalLineWidth) / 2;
      
      if (layoutPattern === 'stair-diagonal') {
        startX = (w - safeW)/2 + ((safeW - finalLineWidth) / Math.max(1, lineCount - 1)) * lineIdx;
      } else if (layoutPattern === 'block-headline') {
        startX = (w - finalLineWidth) / 2 + (lineIdx % 2 === 0 ? -w*0.02 : w*0.02);
      }

      // 안전 방어선 적용 (기본적으로 화면 밖으로 못 나가게 막음)
      startX = Math.max(w * 0.05, Math.min(w * 0.95 - finalLineWidth, startX));
      
      // 💡 [핵심] 방어선 적용 이후 맨 마지막에 사용자 가로 이동(offsetX)을 더함.
      // 이렇게 하면 사용자가 의도적으로 밀어낼 때는 화면 밖으로 나갈 수 있음.
      startX += offsetX;

      const charMeta = meta.chars.map((ch, cIdx) => ({
        ch, cIdx, globalIdx: globalCharIndex++,
        x: startX + cIdx * finalAdvance, y: currentY,
        fontSize: finalFontSize, advance: finalAdvance
      }));

      lineLayouts.push({ chars: charMeta, fontSize: finalFontSize, charAdvance: finalAdvance, startX, y: currentY, lineIdx, isLastLine: (lineIdx === lineCount - 1) });
      currentY += meta.hStep * finalGlobalScale;
    });

    return { lineLayouts, baseSize: DUMMY_SIZE * finalGlobalScale, totalChars: globalCharIndex };
  }
}
