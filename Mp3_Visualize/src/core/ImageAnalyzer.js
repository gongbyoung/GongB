/**
 * src/core/ImageAnalyzer.js
 * - 이미지를 분석하여 픽셀별 색상 및 윤곽선(Edge) 데이터를 추출하는 코어 모듈
 */
class ImageAnalyzer {
    /**
     * 이미지를 분석하여 특징점(Features) 배열을 반환합니다.
     * @param {Object} img - p5.js 이미지 객체
     * @param {Object} p - p5.js 인스턴스
     * @param {number} step - 샘플링 간격 (기본값 4)
     * @param {number} threshold - 윤곽선 민감도 임계값 (기본값 50)
     * @returns {Array} 픽셀 데이터 배열 [{x, y, r, g, b, edge}]
     */
    static extractFeatures(img, p, step = 4, threshold = 50) {
        img.loadPixels();
        
        // 윤곽선 추출을 위한 흑백 사본 생성
        let grayImg = p.createImage(img.width, img.height);
        grayImg.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
        grayImg.filter(p.GRAY);
        grayImg.loadPixels();

        let points = [];
        
        for (let y = 1; y < img.height - 1; y += step) {
            for (let x = 1; x < img.width - 1; x += step) {
                let idx = (y * img.width + x) * 4;
                
                // Sobel 알고리즘 기반 미분(밝기 차이) 계산
                let diffX = Math.abs(grayImg.pixels[idx] - grayImg.pixels[idx + 4]);
                let diffY = Math.abs(grayImg.pixels[idx] - grayImg.pixels[idx + img.width * 4]);
                let edgeStrength = diffX + diffY;
                
                points.push({
                    x: x, 
                    y: y,
                    r: img.pixels[idx], 
                    g: img.pixels[idx+1], 
                    b: img.pixels[idx+2],
                    edge: edgeStrength > threshold ? 1 : 0
                });
            }
        }
        
        return points;
    }
}

export default ImageAnalyzer;
export { ImageAnalyzer };
