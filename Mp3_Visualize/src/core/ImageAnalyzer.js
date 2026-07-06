/**
 * src/core/ImageAnalyzer.js
 * - 윤곽선의 강도뿐만 아니라, 사물의 기울기(Angle)와 그리는 순서(SortKey)를 계산
 */
class ImageAnalyzer {
    static extractFeatures(img, p, step = 4, threshold = 30) {
        img.loadPixels();
        let points = [];
        let w = img.width, h = img.height, px = img.pixels;
        
        for (let y = 1; y < h - 1; y += step) {
            for (let x = 1; x < w - 1; x += step) {
                let idx = (y * w + x) * 4;
                let r = px[idx], g = px[idx+1], b = px[idx+2];
                
                let lum = r*0.3 + g*0.59 + b*0.11;
                
                let idxR = (y * w + (x + 1)) * 4;
                let lumR = px[idxR]*0.3 + px[idxR+1]*0.59 + px[idxR+2]*0.11;
                
                let idxD = ((y + 1) * w + x) * 4;
                let lumD = px[idxD]*0.3 + px[idxD+1]*0.59 + px[idxD+2]*0.11;
                
                let diffX = lumR - lum;
                let diffY = lumD - lum;
                let edgeStrength = Math.abs(diffX) + Math.abs(diffY);
                
                // 💡 [추가] 형태의 굴곡을 감싸는 각도 계산 (기울기의 수직 방향)
                let angle = Math.atan2(diffY, diffX) + Math.PI / 2;
                
                // 💡 [추가] 사람이 그리는 동선 (좌상단 -> 우하단) + 약간의 붓터치 엇나감(Random)
                let sortKey = (x + y * 1.5) + (Math.random() * 200);
                
                points.push({
                    x: x, 
                    y: y,
                    r: r, 
                    g: g, 
                    b: b,
                    edge: edgeStrength > threshold ? 1 : 0,
                    angle: angle,
                    sortKey: sortKey
                });
            }
        }
        return points;
    }
}

export default ImageAnalyzer;
export { ImageAnalyzer };
