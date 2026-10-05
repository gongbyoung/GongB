class CalliBrushEngine {
  static deformGlyph(commands, bbox, uiParams, isMajorChar = false, maxPullBudget = 220) {
    const w = Math.max(1, bbox.x2 - bbox.x1);
    const h = Math.max(1, bbox.y2 - bbox.y1);
    const cx = (bbox.x1 + bbox.x2) / 2;
    const cy = (bbox.y1 + bbox.y2) / 2;

    // 💡 wobble 파라미터 가져오기
    const { attractor, curvature, shear, bulge, strokeExpand, pullDir, wobble = 0 } = uiParams;
    const shearRad = (-shear * Math.PI) / 180;
    const tanShear = Math.tan(shearRad);

    const transformPoint = (x, y) => {
      let u = (x - cx) / (w * 0.5);
      let v = (y - cy) / (h * 0.5);

      // 💡 [신규] 지렁이 굴곡 연산 (Wobble)
      // 곡선을 구불구불하게 일그러뜨려 실제 붓이 미세하게 떨리는 수전증 효과를 냄
      if (wobble > 0) {
        const freq = 12; // 구불거림의 밀도
        const amp = wobble * 0.05; // 구불거림의 진폭
        const waveU = Math.sin(v * freq) * amp;
        const waveV = Math.cos(u * freq) * amp;
        u += waveU;
        v += waveV;
      }

      if (bulge !== 0) {
        const factor = 1.0 + bulge * 0.45 * Math.exp(-(u*u + v*v) * 0.85);
        u *= factor; v *= factor;
      }
      if (curvature !== 0) v += curvature * 0.35 * (1.0 - u * u);
      u += v * tanShear;

      let px = cx + u * (w * 0.5) * strokeExpand;
      let py = cy + v * (h * 0.5) * strokeExpand;

      if (isMajorChar && attractor > 0.05) {
        if (pullDir === 'down' && v > 0.35) {
          const pullWeight = Math.pow((v - 0.35) / 0.65, 2.0);
          py += pullWeight * Math.min(maxPullBudget, h * 1.5 * attractor);
          px += Math.sin(pullWeight * Math.PI) * (w * 0.16);
        } else if (pullDir === 'down-right' && (v > 0.25 || u > 0.25)) {
          const pullWeight = Math.pow(Math.max(0, (v + u) * 0.5), 1.8);
          px += pullWeight * Math.min(maxPullBudget * 0.6, w * 1.2 * attractor);
          py += pullWeight * Math.min(maxPullBudget, h * 1.5 * attractor);
        } else if (pullDir === 'right' && u > 0.3) {
          const pullWeight = Math.pow((u - 0.3) / 0.7, 1.8);
          px += pullWeight * Math.min(maxPullBudget * 0.8, w * 1.4 * attractor);
          py -= pullWeight * (h * 0.2 * attractor);
        }
      }
      return { x: px, y: py };
    };

    return commands.map(cmd => {
      const c = Object.assign({}, cmd);
      if (c.x !== undefined) { const p = transformPoint(c.x, c.y); c.x = p.x; c.y = p.y; }
      if (c.x1 !== undefined) { const p = transformPoint(c.x1, c.y1); c.x1 = p.x; c.y1 = p.y; }
      if (c.x2 !== undefined) { const p = transformPoint(c.x2, c.y2); c.x2 = p.x; c.y2 = p.y; }
      return c;
    });
  }

  static renderCommands(ctx, commands) {
    ctx.beginPath();
    for (let cmd of commands) {
      if (cmd.type === 'M') ctx.moveTo(cmd.x, cmd.y);
      else if (cmd.type === 'L') ctx.lineTo(cmd.x, cmd.y);
      else if (cmd.type === 'C') ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
      else if (cmd.type === 'Q') ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
      else if (cmd.type === 'Z') ctx.closePath();
    }
  }

  static generateBristleTexture(w, h, color, intensity) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    if(intensity < 0.1) { ctx.fillRect(0, 0, w, h); return c; }

    const bristles = [];
    const numBristles = 100; 
    for(let i=0; i<numBristles; i++) bristles.push({ y: (i / numBristles) * h, size: Math.random() * 3 + 1.5, wobble: Math.random() * 20 });

    for(let x = -50; x < w + 50; x += 3) {
      bristles.forEach(b => {
        if(Math.random() > intensity * 0.85) {
          const wave = Math.sin(x * 0.05 + b.wobble) * (intensity * 15);
          ctx.beginPath(); ctx.arc(x, b.y + wave, b.size, 0, Math.PI*2); ctx.fill();
        }
      });
    }
    return c;
  }
}
