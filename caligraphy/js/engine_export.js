class CalliVideoExporter {
  static async exportMP4(srtData, uiParams, loadedFont, canvas, onProgress) {
    try {
      if (!window.MediaRecorder) {
        alert('현재 브라우저가 비디오 녹화 기능을 지원하지 않습니다.');
        return;
      }

      if (!srtData || srtData.length === 0) {
        alert('내보낼 SRT 자막 데이터가 없습니다.');
        return;
      }

      const fps = 30;
      
      // 전체 자막의 마지막 끝 시간 + 사용자가 지정한 정지 시간을 총 영상 길기로 설정
      const totalDuration = srtData[srtData.length - 1].end + parseFloat(uiParams.holdTime || 1.0);
      const totalFrames = Math.floor(totalDuration * fps);

      const stream = canvas.captureStream(fps);
      
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      let mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 10 * 1024 * 1024
      });

      let chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        let blob = new Blob(chunks, { type: 'video/webm' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = 'calligraphy_animation.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();

      const exportCanvas = canvas;
      const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
      const offscreenChar = document.createElement('canvas');
      const offscreenCharCtx = offscreenChar.getContext('2d', { willReadFrequently: true });

      // 프레임별 정확한 시간축(timeSec) 계산 및 렌더링 드라이브
      for (let frame = 0; frame < totalFrames; frame++) {
        let timeSec = frame / fps;
        
        CalliExportRenderer.renderFrame(exportCtx, exportCanvas, offscreenChar, offscreenCharCtx, srtData, uiParams, loadedFont, timeSec);

        if (onProgress) {
          let pct = Math.round((frame / totalFrames) * 100);
          onProgress(pct);
        }

        await new Promise(r => setTimeout(r, 1000 / fps));
      }

      mediaRecorder.stop();

    } catch (err) {
      console.error("영상 내보내기 오류:", err);
      alert('영상 내보내기 오류: ' + err.message);
    }
  }
}

class CalliExportRenderer {
  static renderFrame(ctx, canvas, charOffscreen, charCtx, srtData, uiParams, loadedFont, timeSec) {
    const w = canvas.width, h = canvas.height;
    CalliFluidEngine.renderBackground(ctx, w, h, uiParams.bgStyle);

    // 💡 1. 현재 타임라인(timeSec)에 정확히 매칭되는 자막 세션 찾기
    let activeSub = srtData.find(s => timeSec >= s.start && timeSec <= s.end);
    
    // 만약 자막 구간 사이의 빈 시간이거나 범위를 벗어났을 때 처리
    if (!activeSub) {
      if (srtData.length > 0) {
        if (timeSec < srtData[0].start) activeSub = srtData[0];
        else activeSub = srtData[srtData.length - 1];
      } else {
        return;
      }
    }
    
    const text = activeSub.text;
    const segStart = activeSub.start;
    const segDuration = Math.max(0.8, activeSub.end - segStart);
    const segElapsed = Math.max(0, Math.min(segDuration, timeSec - segStart));

    const bounds = { w, h };
    const { lineLayouts, baseSize, totalChars } = CalliLayoutEngine.compute(text, bounds, uiParams);

    // 💡 2. 설정된 정지 시간(holdTime)을 반영하여 글씨가 써지는 속도(writeSpan) 계산
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
        
        // 💡 3. 자막 시간 내에서 글씨가 다 써진 이후(segElapsed >= writeSpan)에는 u = 1.0(완성본)으로 고정되어 멈춰있음
        if (segElapsed >= writeSpan || segElapsed >= tStart + charSpan * 1.15) {
          u = 1.0;
        } else if (segElapsed > tStart) {
          u = (segElapsed - tStart) / (charSpan * 1.15);
        }

        if (c.ch !== ' ' && u > 0) {
          CalliExportRenderer.renderGlyph(ctx, c.ch, c.x, c.y, c.fontSize, uiParams, isMajor, u, loadedFont, charOffscreen, charCtx);
        }
      });
    });

    // 💡 4. 글씨가 완전히 써진 타이밍(writeSpan * 0.9) 이후부터 낙관(도장)이 찍힌 채로 정지 유지
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
