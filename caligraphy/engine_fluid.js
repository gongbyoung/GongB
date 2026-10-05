class FluidBleedingSolver {
  constructor(width, height, config = {}) {
    this.width = width;
    this.height = height;
    this.bleedRate = config.bleedRate || 0.1; // 번지는 속도
    this.activeZones = []; // 현재 먹물이 젖어 번지고 있는 활성화 영역
  }

  addInkZone(box) {
    // 붓이 닿은 영역을 배열에 추가. 연산 범위를 좁혀 프레임 드랍을 막음
    const padding = 10;
    this.activeZones.push({
      x: Math.max(0, box.x - padding),
      y: Math.max(0, box.y - padding),
      w: Math.min(this.width - box.x, box.w + padding * 2),
      h: Math.min(this.height - box.y, box.h + padding * 2),
      life: 60 // 60프레임(약 1초) 동안만 번지다가 마름
    });
  }

  clear(ctx) {
    this.activeZones = [];
  }

  updateBleeding(ctx, paperMap) {
    if (this.activeZones.length === 0) return;

    // 살아있는 젖은 영역만 필터링
    this.activeZones = this.activeZones.filter(z => z.life > 0);

    this.activeZones.forEach(zone => {
      if (zone.w <= 0 || zone.h <= 0) return;
      
      // 캔버스에서 해당 영역의 픽셀 데이터 긁어오기
      const imgData = ctx.getImageData(zone.x, zone.y, zone.w, zone.h);
      const data = imgData.data;
      const nextData = new Uint8ClampedArray(data);

      const w = zone.w;
      
      // 셀룰러 오토마타 (상하좌우 픽셀로 먹물 확산)
      for (let y = 1; y < zone.h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          
          // 현재 픽셀이 어두운 색(먹물)일 때만 주변으로 번짐
          if (data[idx] < 150) { 
            // 화선지 맵에서 해당 좌표의 요철(섬유질) 값 가져오기
            const globalX = zone.x + x;
            const globalY = zone.y + y;
            const paperRoughness = paperMap[globalY * this.width + globalX];

            // 번짐 확률 (기본 번짐 속도 * 종이의 요철) -> 종이 결을 따라 거칠게 번짐
            if (Math.random() < this.bleedRate * paperRoughness) {
              const neighbors = [
                idx - 4,       // 좌
                idx + 4,       // 우
                idx - w * 4,   // 상
                idx + w * 4    // 하
              ];

              // 랜덤한 인접 픽셀 하나를 선택해 먹물 색으로 오염시킴 (번짐)
              const spreadTarget = neighbors[Math.floor(Math.random() * neighbors.length)];
              nextData[spreadTarget] *= 0.8;     // R 어둡게
              nextData[spreadTarget + 1] *= 0.8; // G 어둡게
              nextData[spreadTarget + 2] *= 0.8; // B 어둡게
            }
          }
        }
      }

      ctx.putImageData(new ImageData(nextData, zone.w, zone.h), zone.x, zone.y);
      zone.life--; // 건조 진행
    });
  }
}
