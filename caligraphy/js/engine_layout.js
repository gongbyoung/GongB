class CalliLayoutEngine {
  static compute(text, bounds, uiParams) {
    const { w, h, marginX, marginY, availW, availH } = bounds;
    const { layoutPattern, decay, contrast, spacing, lineHeight } = uiParams;

    let rawLines = text.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length === 0) rawLines = ["캘리그라피"];

    const maxCharsPerLine = Math.max(4, Math.floor(availW / 120));
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

    let baseSize = availW / (maxLineChars * 0.85);
    baseSize = Math.min(baseSize, availH / (lineCount * 1.2 * lineHeight));
    if (layoutPattern === 'emblem-compact') baseSize = Math.min(availW / (maxLineChars * 0.75), availH * 0.45);
    baseSize = Math.max(26, Math.min(220, baseSize));

    const lineLayouts = [];
    let currentY = marginY;
    const totalHeight = lineCount * baseSize * 1.15 * lineHeight;
    if (totalHeight < availH) currentY = marginY + (availH - totalHeight) / 2;

    let globalCharIndex = 0;
    processedLines.forEach((lineStr, lineIdx) => {
      const chars = Array.from(lineStr);
      let charScale = (lineIdx === 0) ? contrast : Math.max(0.5, 1.0 / Math.pow(decay, lineIdx));
      const fontSize = baseSize * charScale;
      const charAdvance = fontSize * 0.78 + spacing;
      const lineWidth = chars.length * charAdvance;

      let startX = (w - lineWidth) / 2;
      if (layoutPattern === 'stair-diagonal') {
        startX = marginX + ((availW - lineWidth) / Math.max(1, lineCount - 1)) * lineIdx;
      } else if (layoutPattern === 'block-headline') {
        startX = (w - lineWidth) / 2 + (lineIdx % 2 === 0 ? -25 : 25);
      }
      startX = Math.max(marginX, Math.min(w - marginX - lineWidth, startX));

      const charMeta = chars.map((ch, cIdx) => ({
        ch, cIdx,
        globalIdx: globalCharIndex++,
        x: startX + cIdx * charAdvance,
        y: currentY + fontSize * 0.85,
        fontSize, advance: charAdvance
      }));

      lineLayouts.push({ chars: charMeta, fontSize, charAdvance, startX, y: currentY + fontSize * 0.85, lineIdx, isLastLine: (lineIdx === lineCount - 1) });
      currentY += fontSize * 1.16 * lineHeight;
    });

    return { lineLayouts, baseSize, totalChars: globalCharIndex };
  }
}
