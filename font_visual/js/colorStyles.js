function getColorForCue(index, styleName) {
    switch(styleName) {
        case 'monochrome': return [...][index % 5];
        case 'pastel': return [...][index % 10];
        case 'neon': return [...][index % 10];
        case 'primary': return [...][index % 10];
        case 'harmony': default:
            return `hsl(${(index * 137.508) % 360}, 70%, 70%)`;
    }
}
