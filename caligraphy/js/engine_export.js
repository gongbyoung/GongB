class CalliVideoExporter {
  static async exportMP4(srtData, uiParams, loadedFont, canvas, onProgress) {
    if (!window.Mp4Muxer) {
      alert('MP4 Muxer 라이브러리가 로드되지 않았습니다.');
      return;
    }

    const fps = 30;
    const totalDuration = srtData.length > 0 ? srtData[srtData.length - 1].end + parseFloat(uiParams.holdTime || 1.0) : 5.0;
    const totalFrames = Math.floor(totalDuration * fps);

    // 1. MP4 muxer 세팅 (H.264 비디오 트랙 생성)
    let muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc1.640028', // H.264 High Profile
        width: canvas.width,
        height: canvas.height
      },
      fastStart: 'in-memory'
    });

    let videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error(e)
    });

    videoEncoder.configure({
      codec: 'avc1.640028',
      width: canvas.width,
      height: canvas.height,
      bitrate: 5 * 1024 * 1024 // 5 Mbps 고화질
    });

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
    
    const offscreenChar = document.createElement('canvas');
    const offscreenCharCtx = offscreenChar.getContext('2d', { willReadFrequently: true });

    // 2. 프레임별 렌더링 및 인코딩 루프
    for (let frame = 0; frame < totalFrames; frame++) {
      let timeSec = frame / fps;
      
      // 화면 렌더링 수행 (기존 렌더링 로직 연동)
      CalliExportRenderer.renderFrame(exportCtx, exportCanvas, offscreenChar, offscreenCharCtx, srtData, uiParams, loadedFont, timeSec);

      // VideoFrame 생성 및 인코딩
      let videoFrame = new VideoFrame(exportCanvas, { timestamp: (frame / fps) * 1e6 });
      videoEncoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
      videoFrame.close();

      // 진행률 UI 콜백 호출
      if (onProgress) {
        let pct = Math.round((frame / totalFrames) * 100);
        onProgress(pct);
      }

      // 브라우저 멈춤(렉) 방지를 위한 비동기 양보
      if (frame % 5 === 0) await new Promise(r => setTimeout(r, 1));
    }

    await videoEncoder.flush();
    muxer.finalize();

    let buffer = muxer.target.buffer;
    let blob = new Blob([buffer], { type: 'video/mp4' });
    let url = URL.createObjectURL(blob);

    // 자동 다운로드 링크 트리거
    let a = document.createElement('a');
    a.href = url;
    a.download = 'calligraphy_animation.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// 렌더링 독립 실행용 헬퍼 클래스
class CalliExportRenderer {
  static renderFrame(ctx, canvas, charOffscreen, charCtx, srtData, uiParams, loadedFont, timeSec) {
    const w = canvas.width, h = canvas.height;
    CalliFluidEngine.renderBackground(ctx, w, h, uiParams.bgStyle);

    let activeSub = srtData.find(s => timeSec >= s.start && timeSec <= s.end);
    if (!activeSub && srtData.length > 0) activeSub = timeSec < srtData[0].start ? srtData[0] : srtData[srtData.length - 1];
    
    const text = activeSub ? activeSub.text : "캘리그라피";
    const segStart = activeSub ? activeSub.start : 0;
    const segDuration = Math.max(0.8, (activeSub ? activeSub.end : 5.0) - segStart);
    const segElapsed = Math.max(0, Math.min(segDuration, timeSec - segStart));

    const bounds = { w, h };
    const { lineLayouts, baseSize, totalChars } = CalliLayoutEngine.compute(text, bounds, uiParams);

    let writeSpan = segDuration - uiParams.holdTime;
    if (writeSpan < 0.4) writeSpan = Math.max(0.4, segDuration * 0.3);
    const charSpan = writeSpan / Math.max(1, totalChars);
    
    lineLayouts.forEach(line => {
      line.chars.forEach(c => {
        let isMajor = false;
        if (uiParams.pullTarget === 'last-char') isMajor = line.isLastLine && (c.cIdx === line.chars.length - 1);
        else if (uiParams.pullTarget === 'first-char') isMajor = (line.lineIdx === 0 && c.cIdx === 0);

        const tStart = c.globalIdx * charSpan;
        let u = 0;
        if (segElapsed >= tStart + charSpan * 1.15) u = 1.0;
        else if (segElapsed > tStart) u = (segElapsed - tStart) / (charSpan * 1.15);

        if (c.ch !== ' ') {
          CalliExportRenderer.renderGlyph(ctx, ch, c.x, c.y, c.fontSize, uiParams, isMajor, u, loadedFont, charOffscreen, charCtx);
        }
      });
    });

    if (uiParams.sealType !== 'none' && segElapsed >= writeSpan * 0.9) {
      const sealSize = Math.min(54, Math.max(34, baseSize * 0.45));
      const lastLine = lineLayouts[lineLayouts.length - 1];
      let sealX = Math.min(w * 0.95 - sealSize, lastLine.startX + (lastLine.chars.length * lastLine.charAdvance) + 15);
      CalliFluidEngine.drawSeal(ctx, sealX, lastLine.y - sealSize * 0.8, sealSize, uiParams.sealType, uiParams.sealText, 1.0, 1.0);
    }
  }

  static renderGlyph(targetCtx, ch, renderX, renderY, fontSize, uiParams, isMajor, progressU, loadedFont, charOffscreen, charCtx) {
    if (progressU <= 0.001) return;
    const path = loadedFont.getPath(ch, 0, 0, fontSize);
    let bbox = { x1: 0, y1: -fontSize * 0.7, x2: fontSize * 0.7, y2: 0 };
    try { bbox = path.getBoundingBox(); } catch(e) {}

    const deformed = CalliBrushEngine.deformGlyph(path.commands, bbox, uiParams, isMajor, 250);
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
}
