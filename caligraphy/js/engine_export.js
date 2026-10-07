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

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 10 * 1024 * 1024
        });
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream);
      }

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

      // 💡 [초고속 렌더링 펌프] 지연 없는 초고속 프레임 푸시
      for (let frame = 0; frame < totalFrames; frame++) {
        let timeSec = frame / fps;
        
        CalliExportRenderer.renderFrame(exportCtx, exportCanvas, offscreenChar, offscreenCharCtx, srtData, uiParams, loadedFont, timeSec);

        const track = stream.getVideoTracks()[0];
        if (track && typeof track.requestFrame === 'function') {
          track.requestFrame();
        }

        if (onProgress) {
          let pct = Math.min(100, Math.round((frame / totalFrames) * 100));
          onProgress(pct);
        }

        // 브라우저가 버벅이지 않도록 15프레임마다 가볍게 양보
        if (frame % 15 === 0) {
          await new Promise(r => setTimeout(r, 1));
        }
      }

      mediaRecorder.stop();

    } catch (err) {
      console.error("영상 내보내기 오류:", err);
      alert('영상 내보내기 오류: ' + err.message);
    }
  }
}

class CalliExportRenderer {
  // 💡 [핵심 최적화] 글자별 렌더링 결과를 캐싱하는 맵
  static glyphCache = new Map();

  static renderFrame(ctx, canvas, charOffscreen, charCtx, srtData, uiParams, loadedFont, timeSec) {
    const w = canvas.width, h = canvas.height;
    CalliFluidEngine.renderBackground(ctx, w, h, uiParams.bgStyle);

    let activeSub = srtData.find(s => timeSec >= s.start && timeSec <= s.end);
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
        
        if (segElapsed >= writeSpan || segElapsed >= tStart + charSpan * 1.15) {
          u = 1.0;
        } else if (segElapsed > tStart) {
          u = (segElapsed - tStart) / (charSpan * 1.15);
        }

        if (c.ch !== ' ' && u > 0) {
          CalliExportRenderer.renderCachedGlyph(ctx, c.ch, c.x, c.y, c.fontSize, uiParams, isMajor, u, loadedFont, charOffscreen, charCtx);
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

  // 💡 폰트 파싱 및 왜곡 연산을 단 한 번만 수행하여 캐시에 저장하는 고속 렌더러
  static renderCachedGlyph(targetCtx, ch, renderX, renderY, fontSize, uiParams, isMajor, progressU, loadedFont, charOffscreen, charCtx) {
    if (progressU <= 0.001) return;

    // 소수점 단위 진행도를 반올림하여 캐시 히트율 극대화
    const progressKey = Math.round(progressU * 20) / 20; 
    const cacheKey = `${ch}_${fontSize}_${uiParams.inkColor}_${uiParams.wobble}_${uiParams.shear}_${uiParams.bulge}_${uiParams.strokeExpand}_${uiParams.curvature}_${uiParams.slitCut}_${uiParams.bleed}_${isMajor}_${progressKey}`;

    if (this.glyphCache.has(cacheKey)) {
      const cachedImg = this.glyphCache.get(cacheKey);
      targetCtx.drawImage(cachedImg, renderX - cachedImg.width / 2, renderY - cachedImg.height * 0.45);
      return;
    }

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

    // 생성된 결과를 이미지 객체로 캐시에 백업
    const imgCopy = document.createElement('canvas');
    imgCopy.width = gw; imgCopy.height = gh;
    imgCopy.getContext('2d').drawImage(charOffscreen, 0, 0);
    
    if (this.glyphCache.size > 500) {
      const firstKey = this.glyphCache.keys().next().value;
      this.glyphCache.delete(firstKey);
    }
    this.glyphCache.set(cacheKey, imgCopy);

    targetCtx.drawImage(charOffscreen, renderX - localCX, renderY - localCY);
  }
}
