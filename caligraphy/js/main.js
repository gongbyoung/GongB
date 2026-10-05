const BUILTIN_PRESETS = {
  p1: { layoutPattern: "block-headline", decay: 1.0, contrast: 1.4, pullDir: "down", pullTarget: "none", attractor: 0.0, shear: 7, bulge: 0.3, strokeExpand: 1.35, curvature: 0.2, slitCut: 0.45, spacing: -6, lineHeight: 1.05 },
  p2: { layoutPattern: "center", decay: 1.0, contrast: 1.25, pullDir: "down-right", pullTarget: "last-char", attractor: 0.8, shear: 2, bulge: 0.1, strokeExpand: 1.15, curvature: 0.3, slitCut: 0.3, spacing: -8, lineHeight: 1.05 },
  p3: { layoutPattern: "wedge-title", decay: 1.25, contrast: 2.6, pullDir: "down", pullTarget: "last-char", attractor: 1.6, shear: -4, bulge: 0.4, strokeExpand: 1.4, curvature: -0.4, slitCut: 0.5, spacing: -10, lineHeight: 0.95 },
  p4: { layoutPattern: "stair-diagonal", decay: 1.0, contrast: 1.4, pullDir: "down-right", pullTarget: "last-char", attractor: 2.4, shear: 9, bulge: 0.1, strokeExpand: 1.2, curvature: 0.6, slitCut: 0.4, spacing: -6, lineHeight: 1.15 },
  p5: { layoutPattern: "emblem-compact", decay: 1.0, contrast: 1.6, pullDir: "down", pullTarget: "last-char", attractor: 1.5, shear: 1, bulge: 1.3, strokeExpand: 1.65, curvature: 0.0, slitCut: 0.4, spacing: -14, lineHeight: 1.0 },
  p6: { layoutPattern: "center", decay: 1.0, contrast: 1.6, pullDir: "down", pullTarget: "last-char", attractor: 2.6, shear: 8, bulge: 0.2, strokeExpand: 1.25, curvature: 0.4, slitCut: 0.5, spacing: -8, lineHeight: 1.05 }
};

let srtData = [], loadedFont = null, isPlaying = false, lastTimestamp = 0, currentTime = 0, totalDuration = 5.0;
let debounceTimer = null; // 💡 디바운싱 타이머 변수 추가

const canvas = document.getElementById('calli-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const charOffscreen = document.createElement('canvas');
const charCtx = charOffscreen.getContext('2d', { willReadFrequently: true });

function parseSRTTime(h, m, s, ms) { return (parseInt(h)||0)*3600 + (parseInt(m)||0)*60 + (parseInt(s)||0) + (parseInt(ms)||0)/1000; }

function parseSRT(text) {
  if (!text) return [];
  const blocks = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\s*\n/);
  const result = [];
  blocks.forEach(b => {
    const lines = b.trim().split('\n');
    let tIdx = -1;
    for (let i = 0; i < lines.length; i++) if (lines[i].includes('-->')) { tIdx = i; break; }
    if (tIdx !== -1) {
      const m = lines[tIdx].match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
      if (m) result.push({ start: parseSRTTime(m[1], m[2], m[3], m[4]), end: parseSRTTime(m[5], m[6], m[7], m[8]), text: lines.slice(tIdx + 1).join('\n') });
    }
  });
  return result;
}

function updateSRTUI() {
  const container = document.getElementById('srt-list-container');
  container.innerHTML = '';
  
  if (srtData.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim); padding:6px; font-size:0.75rem;">자막이 없습니다.</div>';
    totalDuration = 5.0;
    document.getElementById('time-slider').max = totalDuration;
    return;
  }

  totalDuration = srtData[srtData.length - 1].end + 0.5;
  document.getElementById('time-slider').max = totalDuration;

  srtData.forEach((s, idx) => {
    const div = document.createElement('div');
    div.className = 'srt-item';
    div.innerHTML = `<span><b>#${idx + 1}</b> (${s.start.toFixed(1)}s)</span><span style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.text.replace(/\n/g, ' ')}</span>`;
    
    div.addEventListener('click', () => {
      jumpToFinalFrameOfSubtitle(s);
    });
    container.appendChild(div);
  });
}

function jumpToFinalFrameOfSubtitle(subtitleObj = null) {
  if (isPlaying) {
    isPlaying = false;
    document.getElementById('btn-play').textContent = '▶ 재생';
  }
  
  let targetEnd = 5.0;
  if (subtitleObj) {
    targetEnd = subtitleObj.end;
  } else {
    let activeSub = srtData.find(s => currentTime >= s.start && currentTime <= s.end);
    if (!activeSub && srtData.length > 0) activeSub = srtData[0];
    if (activeSub) targetEnd = activeSub.end;
  }

  currentTime = targetEnd;
  document.getElementById('time-slider').value = currentTime;
  document.getElementById('time-text').textContent = `${currentTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s`;
  renderScene(currentTime);
}

opentype.load("https://raw.githubusercontent.com/google/fonts/main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf", (err, font) => {
  if (!err) {
    loadedFont = font;
    document.getElementById('input-text').value = `1\n00:00:00,500 --> 00:00:03,000\n맛있게 먹으면\n0칼로리\n\n2\n00:00:03,500 --> 00:00:06,500\n첫눈처럼 너에게 가겠다`;
    srtData = parseSRT(document.getElementById('input-text').value);
    updateSRTUI(); 
    applyPreset(BUILTIN_PRESETS.p1);
  }
});

document.getElementById('input-font-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      loadedFont = opentype.parse(evt.target.result);
      jumpToFinalFrameOfSubtitle(); 
    } catch (err) { alert('폰트 파일을 읽을 수 없습니다.'); }
  };
  reader.readAsArrayBuffer(file);
});

function applyPreset(p) {
  document.getElementById('select-layout-pattern').value = p.layoutPattern;
  document.getElementById('param-decay').value = p.decay;
  document.getElementById('param-contrast').value = p.contrast;
  document.getElementById('select-pull-dir').value = p.pullDir;
  document.getElementById('select-pull-target').value = p.pullTarget;
  document.getElementById('param-attractor').value = p.attractor;
  document.getElementById('param-shear').value = p.shear;
  document.getElementById('param-bulge').value = p.bulge;
  document.getElementById('param-stroke-expand').value = p.strokeExpand;
  document.getElementById('param-curvature').value = p.curvature;
  document.getElementById('param-slit-cut').value = p.slitCut;
  document.getElementById('param-spacing').value = p.spacing;
  document.getElementById('param-line-height').value = p.lineHeight;

  const bleedParam = document.getElementById('param-bleed');
  const scaleParam = document.getElementById('param-global-scale');
  const offsetXParam = document.getElementById('param-offset-x');
  const offsetYParam = document.getElementById('param-offset-y');
  
  if (bleedParam) bleedParam.value = 0.3;
  if (scaleParam) scaleParam.value = 1.0;
  if (offsetXParam) offsetXParam.value = 0;
  if (offsetYParam) offsetYParam.value = 0;
  
  jumpToFinalFrameOfSubtitle();
}

['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].forEach(k => {
  document.getElementById(`btn-${k}`).addEventListener('click', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${k}`).classList.add('active');
    applyPreset(BUILTIN_PRESETS[k]);
  });
});

document.getElementById('input-srt-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    document.getElementById('input-text').value = evt.target.result;
    document.getElementById('btn-apply-srt').click();
  };
  reader.readAsText(file);
});

document.getElementById('btn-apply-srt').addEventListener('click', () => { 
  srtData = parseSRT(document.getElementById('input-text').value); 
  updateSRTUI();
  
  const ratio = document.getElementById('select-ratio').value;
  if (ratio === '1:1') { canvas.width = 1440; canvas.height = 1440; }
  else if (ratio === '16:9') { canvas.width = 1920; canvas.height = 1080; }
  else if (ratio === '9:16') { canvas.width = 1080; canvas.height = 1920; }
  
  if (srtData.length > 0) jumpToFinalFrameOfSubtitle(srtData[0]);
});

// 💡 [핵심 최적화] 디바운싱(Debouncing) 적용
document.querySelectorAll('input[type="range"], select, input[type="color"], input[type="text"]').forEach(el => {
  if(el.id === 'time-slider') return; 

  el.addEventListener('input', () => { 
    clearTimeout(debounceTimer); // 마우스가 움직이는 동안에는 계속 타이머를 초기화 (렌더링 안 함)
    
    // 조작을 멈추고 0.15초(150ms)가 지나면 비로소 렌더링 실행
    debounceTimer = setTimeout(() => {
      jumpToFinalFrameOfSubtitle(); 
    }, 150);
  });
});

function getUIParams() {
  const bleedParam = document.getElementById('param-bleed');
  const scaleParam = document.getElementById('param-global-scale');
  const offsetXParam = document.getElementById('param-offset-x');
  const offsetYParam = document.getElementById('param-offset-y');

  return {
    layoutPattern: document.getElementById('select-layout-pattern').value,
    decay: parseFloat(document.getElementById('param-decay').value),
    contrast: parseFloat(document.getElementById('param-contrast').value),
    pullDir: document.getElementById('select-pull-dir').value,
    pullTarget: document.getElementById('select-pull-target').value,
    attractor: parseFloat(document.getElementById('param-attractor').value),
    shear: parseInt(document.getElementById('param-shear').value),
    bulge: parseFloat(document.getElementById('param-bulge').value),
    strokeExpand: parseFloat(document.getElementById('param-stroke-expand').value),
    curvature: parseFloat(document.getElementById('param-curvature').value),
    slitCut: parseFloat(document.getElementById('param-slit-cut').value),
    bleed: bleedParam ? parseFloat(bleedParam.value) : 0.3,
    globalScale: scaleParam ? parseFloat(scaleParam.value) : 1.0,
    offsetX: offsetXParam ? parseInt(offsetXParam.value) : 0,
    offsetY: offsetYParam ? parseInt(offsetYParam.value) : 0,
    spacing: parseInt(document.getElementById('param-spacing').value),
    lineHeight: parseFloat(document.getElementById('param-line-height').value),
    inkColor: document.getElementById('input-ink-color').value,
    bgStyle: document.getElementById('select-bg').value,
    sealType: document.getElementById('select-seal').value,
    sealText: document.getElementById('input-seal-text').value,
    subText: document.getElementById('input-subtext').value
  };
}

function renderWritingGlyph(targetCtx, ch, renderX, renderY, fontSize, uiParams, isMajor, progressU) {
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

function renderScene(timeSec) {
  if (!loadedFont) return;
  const w = canvas.width, h = canvas.height;
  const uiParams = getUIParams();

  CalliFluidEngine.renderBackground(ctx, w, h, uiParams.bgStyle);

  let activeSub = srtData.find(s => timeSec >= s.start && timeSec <= s.end);
  if (!activeSub && srtData.length > 0) activeSub = timeSec < srtData[0].start ? srtData[0] : srtData[srtData.length - 1];
  
  const text = activeSub ? activeSub.text : "캘리그라피";
  const segStart = activeSub ? activeSub.start : 0;
  const segDuration = Math.max(0.8, (activeSub ? activeSub.end : 5.0) - segStart);
  const segElapsed = Math.max(0, Math.min(segDuration, timeSec - segStart));

  const bounds = { w, h };
  const { lineLayouts, baseSize, totalChars } = CalliLayoutEngine.compute(text, bounds, uiParams);

  const writeSpan = segDuration * 0.75;
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

      if (c.ch !== ' ') renderWritingGlyph(ctx, c.ch, c.x, c.y, c.fontSize, uiParams, isMajor, u);
    });
  });

  if (uiParams.sealType !== 'none' && segElapsed >= segDuration * 0.8) {
    const sealSize = Math.min(54, Math.max(34, baseSize * 0.45));
    const lastLine = lineLayouts[lineLayouts.length - 1];
    let sealX = Math.min(w * 0.95 - sealSize, lastLine.startX + (lastLine.chars.length * lastLine.charAdvance) + 15);
    CalliFluidEngine.drawSeal(ctx, sealX, lastLine.y - sealSize * 0.8, sealSize, uiParams.sealType, uiParams.sealText, 1.0, 1.0);
  }
}

function animateLoop(timestamp) {
  if (!isPlaying) return;
  if (!lastTimestamp) lastTimestamp = timestamp;
  currentTime += (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  
  if (currentTime > totalDuration) { currentTime = 0; isPlaying = false; document.getElementById('btn-play').textContent = '▶ 재생'; }
  
  document.getElementById('time-slider').value = currentTime;
  document.getElementById('time-text').textContent = `${currentTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s`;
  renderScene(currentTime);
  if (isPlaying) requestAnimationFrame(animateLoop);
}

document.getElementById('btn-play').addEventListener('click', () => {
  isPlaying = !isPlaying;
  document.getElementById('btn-play').textContent = isPlaying ? '⏸ 일시정지' : '▶ 재생';
  if (isPlaying) { lastTimestamp = 0; requestAnimationFrame(animateLoop); }
});

// 타임 슬라이더는 디바운싱을 걸면 끊겨 보이므로 즉각 렌더링 유지
document.getElementById('time-slider').addEventListener('input', (e) => {
  isPlaying = false; 
  document.getElementById('btn-play').textContent = '▶ 재생'; 
  currentTime = parseFloat(e.target.value); 
  renderScene(currentTime); 
});
