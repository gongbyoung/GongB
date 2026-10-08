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
  static glyphCache = new Map();
  static lastSubIdx = -1;
  static randomizedParams = null;

  static renderFrame(ctx, canvas, charOffscreen, charCtx, srtData, uiParams, loadedFont, timeSec) {
    const w = canvas.width, h = canvas.height;
    CalliFluidEngine.renderBackground(ctx, w, h, uiParams.bgStyle);

    // 💡 현재 시간에 해당하는 자막 인덱스(SubIndex) 탐색
    let activeSubIdx = srtData.findIndex(s => timeSec >= s.start && timeSec <= s.end);
    let activeSub = activeSubIdx !== -1 ? srtData[activeSubIdx] : null;

    if (!activeSub) {
      if (srtData.length > 0) {
        if (timeSec < srtData[0].start) { activeSubIdx = 0; activeSub = srtData[0]; }
        else { activeSubIdx = srtData.length - 1; activeSub = srtData[activeSubIdx]; }
      } else {
        return;
      }
    }
    
    // 💡 자막 블록이 바뀔 때마다 해당 자막만의 고유한 캘리그라피 변형 파라미터(시드) 생성
    if (this.lastSubIdx !== activeSubIdx || !this.randomizedParams) {
      this.lastSubIdx = activeSubIdx;
      // 인덱스 기반 의사 난수(Pseudorandom) 생성으로 자막마다 고유한 개성 부여
      const seed = (activeSubIdx + 1) * 13.37;
      const r1 = Math.sin(seed);
      const r2 = Math.cos(seed * 2.5);
      const r3 = Math.sin(seed * 3.1);

      this.randomizedParams = {
        ...uiParams,
        // 기본 UI 설정값에 자막별 고유 변동 폭을 가미함
        wobble: Math.max(0, uiParams.wobble + r1 * 0.25),
        curvature: uiParams.curvature + r2 * 0.15,
        shear: uiParams.shear + Math.round(r3 * 3),
        bulge: uiParams.bulge + r1 * 0.1
      };
    }

    const currentUiParams = this.randomizedParams;
    const text = activeSub.text;
    const segStart = activeSub.start;
    const segDuration = Math.max(0.8, activeSub.end - segStart);
    const segElapsed = Math.max(0, Math.min(segDuration, timeSec - segStart));

    const bounds = { w, h };
    const { lineLayouts, baseSize, totalChars } = CalliLayoutEngine.compute(text, bounds, currentUiParams);

    let writeSpan = segDuration - currentUiParams.holdTime;
    if (writeSpan < 0.4) writeSpan = Math.max(0.4, segDuration * 0.3);
    const charSpan = writeSpan / Math.max(1, totalChars);
    
    lineLayouts.forEach(line => {
      line.chars.forEach(c => {
        let isMajor = false;
        if (currentUiParams.pullTarget === 'last-char') isMajor = line.isLastLine && (c.cIdx === line.chars.length - 1);
        else if (currentUiParams.pullTarget === 'first-char') isMajor = (line.lineIdx === 0 && c.cIdx === 0);

        const tStart = c.globalIdx * charSpan;
        let u = 0;
        
        if (segElapsed >= writeSpan || segElapsed >= tStart + charSpan * 1.15) {
          u = 1.0;
        } else if (segElapsed > tStart) {
          u = (segElapsed - tStart) / (charSpan * 1.15);
        }

        if (c.ch !== ' ' && u > 0) {
          CalliExportRenderer.renderCachedGlyph(ctx, c.ch, c.x, c.y, c.fontSize, currentUiParams, isMajor, u, loadedFont, charOffscreen, charCtx, activeSubIdx);
        }
      });
    });

    if (currentUiParams.sealType !== 'none' && segElapsed >= writeSpan * 0.9) {
      const sealSize = Math.min(54, Math.max(34, baseSize * 0.45));
      const lastLine = lineLayouts[lineLayouts.length - 1];
      let sealX = Math.min(w * 0.95 - sealSize, lastLine.startX + (lastLine.chars.length * lastLine.charAdvance) + 15);
      CalliFluidEngine.drawSeal(ctx, sealX, lastLine.y - sealSize * 0.8, sealSize, currentUiParams.sealType, currentUiParams.sealText, 1.0, 1.0);
    }
  }

  static renderCachedGlyph(targetCtx, ch, renderX, renderY, fontSize, uiParams, isMajor, progressU, loadedFont, charOffscreen, charCtx, subIdx) {
    if (progressU <= 0.001) return;

    const progressKey = Math.round(progressU * 20) / 20; 
    const cacheKey = `sub_${subIdx}_${ch}_${fontSize}_${uiParams.inkColor}_${uiParams.wobble.toFixed(2)}_${uiParams.shear}_${uiParams.curvature.toFixed(2)}_${isMajor}_${progressKey}`;

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

    const imgCopy = document.createElement('canvas');
    imgCopy.width = gw; imgCopy.height = gh;
    imgCopy.getContext('2d').drawImage(charOffscreen, 0, 0);
    
    if (this.glyphCache.size > 600) {
      const firstKey = this.glyphCache.keys().next().value;
      this.glyphCache.delete(firstKey);
    }
    this.glyphCache.set(cacheKey, imgCopy);

    targetCtx.drawImage(charOffscreen, renderX - localCX, renderY - localCY);
  }
}
