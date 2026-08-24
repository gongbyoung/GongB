console.log('colorStyles.js loaded');
//로딩 확인용


// js/colorStyles.js
// 색상 스타일 정의 및 반환

function getColorForCue(index, styleName) {
    // 스타일별 색상 팔레트 정의
    const monoColors = [
        '#ffffff', '#dddddd', '#bbbbbb', '#999999', '#777777'
    ];

    const pastelColors = [
        '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff',
        '#d4baff', '#ffb3e6', '#b3ffd9', '#ffccb3', '#cce0ff'
    ];

    const neonColors = [
        '#ff00ff', '#00ffff', '#ff3300', '#00ff00', '#ff6600',
        '#cc00ff', '#00ffcc', '#ff0099', '#99ff00', '#0066ff'
    ];

    const primaryColors = [
        '#ff0000', '#0000ff', '#ffff00', '#00ff00', '#ff00ff',
        '#ff8000', '#8000ff', '#00ff80', '#ff0080', '#80ff00'
    ];

    switch (styleName) {
        case 'monochrome':
            return monoColors[index % monoColors.length];
        case 'pastel':
            return pastelColors[index % pastelColors.length];
        case 'neon':
            return neonColors[index % neonColors.length];
        case 'primary':
            return primaryColors[index % primaryColors.length];
        case 'harmony':
        default:
            // 골든 앵글 기반 HSL (추천)
            const hue = (index * 137.508) % 360;
            return `hsl(${hue}, 70%, 70%)`;
    }
}
