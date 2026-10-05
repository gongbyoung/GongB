class CalliLayoutEngine {
  static compute(text, bounds, uiParams) {
    const { w, h } = bounds;
    const { layoutPattern, decay, contrast, spacing, lineHeight, strokeExpand } = uiParams;

    let rawLines = text.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) rawLines = ["캘리그라피"];

    // 1. 지나치게 긴 줄 강제 줄바꿈 (14글자 기준)
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

    // 2. 가상(Dummy) 사이즈 100을 기준으로 전체 글씨의 '진짜 폭과 높이'를 정확히 사전 측정
    const DUMMY_SIZE = 100;
    let maxLineWidth = 0;
    let totalHeight = 0;
    
    const linesMeta = processedLines.map((lineStr, lineIdx) => {
      const chars = Array.from(lineStr);
      let charScale = (lineIdx === 0) ? contrast : Math.max(0.5, 1.0 / Math.pow(decay, lineIdx));
      let fSize = DUMMY_SIZE * charScale;
      let cAdvance = fSize * 0.85 + spacing;
      
      // 획 굵기(strokeExpand)와 기울기 변수를 모두 포함한 실제 렌더링 한계폭 측정
      let lWidth = 0;
      if (chars.length > 0) {
          lWidth = (chars.length - 1) * cAdvance + (fSize * strokeExpand * 1.5);
      }
      if (lWidth > maxLineWidth) maxLineWidth = lWidth;
      
      let hStep = fSize * 1.16 * lineHeight;
      totalHeight += hStep;
      
      return { chars, fSize, cAdvance, lWidth, hStep };
    });

    // 3. 캔버스를 절대 벗어나지 않는 '안전 영역(Safe Zone)' 비율 계산
    const safeW = w * 0.85; // 가로 15% 여백
    const safeH = h * 0.80; // 세로 20% 여백
    
    // 측정된 크기가 안전 영역에 쏙 들어가도록 글로벌 스케일(비율) 역산
    let scaleW = safeW / Math.max(1, maxLineWidth);
    let scaleH = safeH / Math.max(1, totalHeight);
    let globalScale = Math.min(scaleW, scaleH);
    
    // 너무 작을 때는 적당히 키우고, 너무 클 때는 제한
    globalScale = Math.min(globalScale, 2.5);

    // 4. 역산된 완벽한 비율(globalScale)을 적용하여 최종 좌표 배치
    const lineLayouts = [];
    let finalTotalHeight = totalHeight * globalScale;
    let currentY = (h - finalTotalHeight) / 2 + (linesMeta[0].fSize * globalScale * 0.5);
    let globalCharIndex = 0;

    linesMeta.forEach((meta, lineIdx) => {
      let finalFontSize = meta.fSize * globalScale;
      let finalAdvance = meta.cAdvance * globalScale;
      let finalLineWidth = meta.lWidth * globalScale;
      
      let startX = (w - finalLineWidth) / 2; // 중앙 정렬
      
      if (layoutPattern === 'stair-diagonal') {
        startX = (w - safeW)/2 + ((safeW - finalLineWidth) / Math.max(1, lineCount - 1)) * lineIdx;
      } else if (layoutPattern === 'block-headline') {
        startX = (w - finalLineWidth) / 2 + (lineIdx % 2 === 0 ? -w*0.02 : w*0.02);
      }

      const charMeta = meta.chars.map((ch, cIdx) => ({
        ch, cIdx, globalIdx: globalCharIndex++,
        x: startX + cIdx * finalAdvance, 
        y: currentY,
        fontSize: finalFontSize, 
        advance: finalAdvance
      }));

      lineLayouts.push({ 
        chars: charMeta, fontSize: finalFontSize, charAdvance: finalAdvance, 
        startX, y: currentY, lineIdx, isLastLine: (lineIdx === lineCount - 1) 
      });
      
      currentY += meta.hStep * globalScale;
    });

    return { lineLayouts, baseSize: DUMMY_SIZE * globalScale, totalChars: globalCharIndex };
  }
}
