class CalliLayoutEngine {
  static compute(text, bounds, uiParams) {
    const { w, h } = bounds;
    const { layoutPattern, decay, contrast, spacing, lineHeight, strokeExpand, globalScale = 1.0, offsetX = 0, offsetY = 0 } = uiParams;

    // 캔버스 대비 안전 영역(Safe Zone) 설정 (좌우 15%, 상하 20% 여백)
    const safeW = w * 0.85; 
    const safeH = h * 0.80; 

    let rawLines = text.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) rawLines = ["캘리그라피"];

    // 💡 1. 사용자가 지정한 크기 배율(globalScale)을 반영한 '기준 폰트 사이즈' 
    // 캔버스 크기의 10%를 기본(1.0)으로 잡고 스케일 곱연산
    let baseFontSize = (Math.min(w, h) * 0.10) * globalScale;

    // 💡 2. 동적 자동 줄바꿈 알고리즘 (글자가 커져서 안전 영역을 넘으면 띄어쓰기 기준으로 줄바꿈)
    let processedLines = [];
    rawLines.forEach(lineStr => {
      let words = lineStr.split(' '); // 단어(어절) 단위로 분리
      let currentLine = [];
      let currentWidth = 0;

      for(let i = 0; i < words.length; i++) {
        let word = words[i];
        
        // 현재 줄의 스케일 및 예상 폰트 사이즈 계산
        let lineIdx = processedLines.length;
        let charScale = (lineIdx === 0) ? contrast : Math.max(0.5, 1.0 / Math.pow(decay, lineIdx));
        let fSize = baseFontSize * charScale;
        let cAdvance = fSize * 0.85 + spacing;
        
        // 단어의 가로 길이 예상치
        let wordWidth = Array.from(word).length * cAdvance;
        let spaceWidth = (currentLine.length > 0) ? cAdvance * 0.5 : 0; // 띄어쓰기 간격
        let totalExpectedWidth = currentWidth + spaceWidth + wordWidth + (fSize * strokeExpand);

        // 예상 가로 길이가 안전 영역(safeW)을 넘어가면 다음 줄로 강제 넘김
        if (totalExpectedWidth > safeW && currentLine.length > 0) {
          processedLines.push(currentLine.join(' '));
          currentLine = [word];
          currentWidth = wordWidth;
        } else {
          currentLine.push(word);
          currentWidth += spaceWidth + wordWidth;
        }
      }
      if (currentLine.length > 0) {
        processedLines.push(currentLine.join(' '));
      }
    });

    const lineCount = processedLines.length;

    // 3. 줄바꿈이 완료된 문장들의 최종 가로/세로 크기 측정
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

    // 💡 4. 수직/수평 절대 방어 시스템 (한 단어가 너무 길거나, 줄이 너무 많아져서 화면 밖으로 나가는 경우 강제 축소)
    let fitScale = 1.0;
    if (totalHeight > safeH) fitScale = Math.min(fitScale, safeH / totalHeight);
    if (maxLineWidth > safeW) fitScale = Math.min(fitScale, safeW / maxLineWidth);

    const lineLayouts = [];
    let finalTotalHeight = totalHeight * fitScale;
    
    // 중앙 정렬 Y 시작점 + 사용자 커스텀 오프셋(offsetY)
    let currentY = (h - finalTotalHeight) / 2 + (linesMeta[0].fSize * fitScale * 0.5) + offsetY;
    let globalCharIndex = 0;

    // 5. 확정된 데이터로 최종 좌표 계산
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

      // 화면 밖으로 나가지 않도록 1차 중앙 방어
      startX = Math.max(w * 0.05, Math.min(w * 0.95 - finalLineWidth, startX));
      
      // 사용자 커스텀 오프셋(offsetX) 최종 적용 (의도적으로 밀어내는 것 허용)
      startX += offsetX;

      const charMeta = meta.chars.map((ch, cIdx) => ({
        ch, cIdx, globalIdx: globalCharIndex++,
        x: startX + cIdx * finalAdvance, y: currentY,
        fontSize: finalFontSize, advance: finalAdvance
      }));

      lineLayouts.push({ chars: charMeta, fontSize: finalFontSize, charAdvance: finalAdvance, startX, y: currentY, lineIdx, isLastLine: (lineIdx === lineCount - 1) });
      currentY += meta.hStep * fitScale;
    });

    return { lineLayouts, baseSize: baseFontSize * fitScale, totalChars: globalCharIndex };
  }
}
