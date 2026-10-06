class CalliVideoExporter {
  static async exportMP4(srtData, uiParams, loadedFont, canvas, onProgress) {
    try {
      if (!window.Mp4Muxer) {
        alert('MP4 Muxer 라이브러리가 로드되지 않았습니다.');
        return;
      }

      if (typeof VideoEncoder === 'undefined') {
        alert('현재 브라우저 환경에서 VideoEncoder API를 지원하지 않습니다.');
        return;
      }

      const fps = 30;
      const totalDuration = srtData.length > 0 ? srtData[srtData.length - 1].end + parseFloat(uiParams.holdTime || 1.0) : 5.0;
      const totalFrames = Math.floor(totalDuration * fps);

      // 💡 캔버스 해상도가 홀수일 경우 인코딩 에러가 나므로 짝수로 보정
      const targetWidth = canvas.width % 2 !== 0 ? canvas.width - 1 : canvas.width;
      const targetHeight = canvas.height % 2 !== 0 ? canvas.height - 1 : canvas.height;

      // 💡 가장 범용적인 avc1.4d002a (H.264 Main Profile) 코덱 사용
      const codecString = 'avc1.4d002a';

      let muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: codecString,
          width: targetWidth,
          height: targetHeight
        },
        fastStart: 'in-memory'
      });

      let videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          console.error("VideoEncoder 런타임 에러:", e);
          throw new Error(e.message || "인코딩 중 하드웨어 가속 에러가 발생했습니다.");
        }
      });

      // 브라우저 지원 여부 사전 검사
      const support = await VideoEncoder.isConfigSupported({
        codec: codecString,
        width: targetWidth,
        height: targetHeight,
        bitrate: 5 * 1024 * 1024,
        framerate: fps
      });

      if (!support.supported) {
        throw new Error(`지원되지 않는 인코딩 설정입니다 (${codecString}, ${targetWidth}x${targetHeight})`);
      }

      videoEncoder.configure({
        codec: codecString,
        width: targetWidth,
        height: targetHeight,
        bitrate: 5 * 1024 * 1024,
        framerate: fps
      });

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = targetWidth;
      exportCanvas.height = targetHeight;
      const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
      
      const offscreenChar = document.createElement('canvas');
      const offscreenCharCtx = offscreenChar.getContext('2d', { willReadFrequently: true });

      for (let frame = 0; frame < totalFrames; frame++) {
        let timeSec = frame / fps;
        
        CalliExportRenderer.renderFrame(exportCtx, exportCanvas, offscreenChar, offscreenCharCtx, srtData, uiParams, loadedFont, timeSec);

        let videoFrame = new VideoFrame(exportCanvas, { timestamp: (frame / fps) * 1e6 });
        videoEncoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
        videoFrame.close();

        if (onProgress) {
          let pct = Math.round((frame / totalFrames) * 100);
          onProgress(pct);
        }

        if (frame % 5 === 0) await new Promise(r => setTimeout(r, 1));
      }

      await videoEncoder.flush();
      muxer.finalize();

      let buffer = muxer.target.buffer;
      let blob = new Blob([buffer], { type: 'video/mp4' });
      let url = URL.createObjectURL(blob);

      let a = document.createElement('a');
      a.href = url;
      a.download = 'calligraphy_animation.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("MP4 내보내기 오류:", err);
      alert('MP4 내보내기 오류: ' + err.message);
    }
  }
}

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
          CalliExportRenderer.renderGlyph(ctx, c.ch, c.x, c.y, c.fontSize, uiParams, isMajor, u, loadedFont, charOffscreen, charCtx);
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
