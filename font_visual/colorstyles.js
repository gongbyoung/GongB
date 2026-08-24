const ColorStyles = {
    harmony: (index) => `hsl(${(index * 137.508) % 360}, 70%, 70%)`,
    monochrome: (index) => ['#ffffff', '#dddddd', '#bbbbbb', '#999999', '#777777'][index % 5],
    pastel: (index) => [...][index % 10],
    neon: (index) => [...][index % 10],
    primary: (index) => [...][index % 10],
};
function getColorForCue(index, styleName) { ... }
