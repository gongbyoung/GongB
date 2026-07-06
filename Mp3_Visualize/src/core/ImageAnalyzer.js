/**
 * src/core/ImageAnalyzer.js
 * - 이미지를 분석하여 픽셀별 색상 및 윤곽선(Edge) 데이터를 추출하는 초고속 코어 모듈
 */
class ImageAnalyzer {
    static extractFeatures(img, p, step = 4, threshold = 30) {
        img.loadPixels();
        let points = [];
        let w = img.width;
        let h = img.height;
        let px = img.pixels;
        
        for (let y = 1; y < h - 1; y += step) {
            for (let x = 1; x < w - 1; x += step) {
                let idx = (y * w + x) * 4;
                let r = px[idx], g = px[idx+1], b = px[idx+2];
                
                // 수학적 밝기(Luminance) 계산
                let lum = r*0.3 + g*0.59 + b*0.11;
                
                // 우측 및 하단 픽셀과의 밝기 차이로 윤곽선(Edge) 검출 (Sobel 방식 응용)
                let idxR = (y * w + (x + 1)) * 4;
                let lumR = px[idxR]*0.3 + px[idxR+1]*0.59 + px[idxR+2]*0.11;
                
                let idxD = ((y + 1) * w + x) * 4;
                let lumD = px[idxD]*0.3 + px[idxD+1]*0.59 + px[idxD+2]*0.11;
                
                let edgeStrength = Math.abs(lum - lumR) + Math.abs(lum - lumD);
                
                points.push({
                    x: x, 
                    y: y,
                    r: r, 
                    g: g, 
                    b: b,
                    edge: edgeStrength > threshold ? 1 : 0
                });
            }
        }
        return points;
    }
}

export default ImageAnalyzer;
export { ImageAnalyzer };
