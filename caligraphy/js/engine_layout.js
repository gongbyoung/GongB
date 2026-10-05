class CalliLayoutEngine {
  static compute(text, bounds, uiParams) {
    const { w, h } = bounds;
    const { layoutPattern, decay, contrast, spacing, lineHeight } = uiParams;

    // 💡 [수정] 기울기와 삐침을 고려해 여백(Safe Zone)을 캔버스의 75%로 보수적으로 세팅
    const availW = w * 0.75; 
    const availH = h * 0.75;

    let rawLines = text.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) rawLines = ["캘리그라피"];

    const maxCharsPerLine = Math.max(3, Math.floor(availW / 120));
    let processedLines = [];
    rawLines.forEach(l => {
      const chars = Array.from(l);
      if (chars.length > maxCharsPerLine && layoutPattern !== 'emblem-compact') {
        for (let i = 0; i < chars.length; i += maxCharsPerLine) processedLines.push(chars.slice(i, i + maxCharsPerLine).join(''));
      } else {
        processedLines.push(l);
      }
    });

    const lineCount = processedLines.length;
    let maxLineChars = Math.max(...processedLines.map(l => Array.from(l).length), 1);

    // 💡 [핵심 알고리즘] 가로폭(availW)과 세로폭(availH)을 넘어가지 않는 최대 폰트 사이즈 역산
    let safeBaseSizeW = (availW - (maxLineChars * spacing)) / (maxLineChars * 0.9);
    let safeBaseSizeH = availH / (lineCount * 1.3 * lineHeight);
    let baseSize = Math.min(safeBaseSizeW, safeBaseSizeH);
    
    // 비정상적으로 커지는 것 방지
    baseSize = Math.min(250, Math.max(20, baseSize));

    const lineLayouts = [];
    let totalHeight = 0;
    
    // 1차 패스: 개별 줄마다 폭을 검사해서 삐져나가면 그 줄만 강제로 사이즈를 더 줄임 (오버플로우 원천 차단)
    const linesMeta = processedLines.map((lineStr, lineIdx) => {
      const chars = Array.from(lineStr);
      let charScale = (lineIdx === 0) ? contrast : Math.max(0.5, 1.0 / Math.pow(decay, lineIdx));
      let fontSize = baseSize * charScale;
      
      let charAdvance = fontSize * 0.85 + spacing;
      let expectedWidth = chars.length * charAdvance;
      
      // 만약 주제어(대비가 큰 첫 줄)가 가로폭을 넘어가면 강제 축소
      if (expectedWidth > availW) {
        const scaleDown = availW / expectedWidth;
        fontSize *= scaleDown;
        charAdvance = fontSize * 0.85 + spacing;
        expectedWidth = chars.length * charAdvance;
      }

      const hStep = fontSize * 1.16 * lineHeight;
      totalHeight += hStep;

      return { chars, fontSize, charAdvance, lineWidth: expectedWidth, hStep };
    });

    // 화면 중앙 정렬을 위한 Y 시작점
    let currentY = (h - totalHeight) / 2 + (linesMeta[0].fontSize * 0.5);
    let globalCharIndex = 0;

    // 2차 패스: 최종 확정된 사이즈로 좌표 배치
    linesMeta.forEach((meta, lineIdx) => {
      let startX = (w - meta.lineWidth) / 2;
      
      if (layoutPattern === 'stair-diagonal') {
        startX = w * 0.12 + ((availW - meta.lineWidth) / Math.max(1, lineCount - 1)) * lineIdx;
      } else if (layoutPattern === 'block-headline') {
        startX = (w - meta.lineWidth) / 2 + (lineIdx % 2 === 0 ? -30 : 30);
      }
      
      // 마지막 안전 장치: 절대 화면 5% 밖으로 넘어가지 못하게 방어선 구축
      startX = Math.max(w * 0.05, Math.min(w * 0.95 - meta.lineWidth, startX));

      const charMeta = meta.chars.map((ch, cIdx) => ({
        ch, cIdx, globalIdx: globalCharIndex++,
        x: startX + cIdx * meta.charAdvance, y: currentY,
        fontSize: meta.fontSize, advance: meta.charAdvance
      }));

      lineLayouts.push({ chars: charMeta, fontSize: meta.fontSize, charAdvance: meta.charAdvance, startX, y: currentY, lineIdx, isLastLine: (lineIdx === lineCount - 1) });
      currentY += meta.hStep;
    });

    return { lineLayouts, baseSize, totalChars: globalCharIndex };
  }
}
