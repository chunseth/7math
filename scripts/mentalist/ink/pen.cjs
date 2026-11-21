// Centerline pen strokes on an 18 × 28 grid, in drawing order.
const glyphs = {
  '0': ['10,2 5,3 2,11 1,20 3,26 9,27 14,21 16,11 15,4 10,2'],
  '1': ['3,10 11,3 10,13 8,26', '3,26 15,26'],
  '2': ['2,8 5,4 11,2 16,5 15,11 9,17 2,24 1,26 16,25'],
  '3': ['2,6 7,3 13,3 16,6 14,10 8,14 13,14 16,17 15,22 11,26 5,27 1,24'],
  '4': ['11,2 1,18 17,18', '14,8 12,27'],
  '5': ['16,3 5,3 3,14 9,12 14,14 16,18 13,24 8,27 2,25'],
  '6': ['14,2 9,5 4,12 2,20 4,25 10,27 15,22 15,17 12,14 7,14 3,18'],
  '7': ['1,4 17,3 11,14 6,27', '6,14 15,13'],
  '8': ['9,14 4,11 3,7 6,3 12,2 15,6 13,10 8,14 3,18 2,23 6,27 12,26 16,22 15,18 9,14'],
  '9': ['14,13 9,16 4,15 2,11 4,5 9,2 14,3 16,7 14,15 8,27'],
  '×': ['2,9 15,22','15,8 2,23'], 'x': ['2,10 5,10 13,24 16,23','15,9 2,24'],
  '+': ['2,15 16,15','10,7 9,23'], '−': ['2,16 16,15'],
  '=': ['1,12 16,12','1,20 16,19'], '÷': ['8,7 9,7','1,15 17,15','8,23 9,23'],
  '(': ['12,1 7,7 4,15 5,23 9,29'], ')': ['6,1 11,8 12,15 10,23 5,29'],
  '/': ['16,2 2,28'], '°': ['6,1 3,2 2,6 5,8 8,7 9,4 8,2 6,1'],
  '$': ['15,6 11,4 6,5 3,9 4,12 12,15 15,18 14,22 10,25 4,24 1,22','11,0 7,29'],
};
function width(c) { return c === ' ' ? 9 : c === '°' ? 12 : 21; }
function lettering(value, x, y, scale = 1, maxWidth = Infinity) {
  const chars = [...value];
  const size = Math.min(scale, maxWidth / chars.reduce((n, c) => n + width(c), 0));
  const paths = [];
  for (const [index, c] of chars.entries()) {
    if (c !== ' ') {
      if (!glyphs[c]) throw Error('Missing pen glyph ' + c);
      for (const line of glyphs[c]) {
        const points = line.split(' ').map(pair => {
          const [px, py] = pair.split(',').map(Number);
          return [x + (px + (16 - py) * .045) * size, y + (py + Math.sin(index * 2.7) * .55) * size];
        });
        paths.push("0235689()$°".includes(c) ? smooth(points) : points);
      }
    }
    x += width(c) * size;
  }
  return paths;
}

// Round control-polygon corners while keeping each pen-down and pen-up position.
function smooth(points) {
  if (points.length < 3) return points;
  const mid = (a,b) => a.map((v,i) => (v+b[i])/2);
  const result = [points[0]];
  let start = points[0];
  for (let i=1; i<points.length-1; i++) {
    const control = points[i], end = mid(control,points[i+1]);
    for (let j=1; j<=5; j++) {
      const t=j/5, u=1-t;
      result.push(start.map((v,k)=>u*u*v+2*u*t*control[k]+t*t*end[k]));
    }
    start=end;
  }
  return [...result,points[points.length-1]];
}

// Cut the stroke at the nib. Previously written points stay fixed as the pen moves.
function ink(paths, progress, color, weight) {
  if (progress <= 0) return '';
  let budget = paths.reduce((sum, p) => sum + length(p), 0) * Math.min(1, progress);
  let d = '';
  for (const p of paths) {
    if (budget <= 0) break;
    d += 'M' + point(p[0]);
    for (let i = 1; i < p.length; i++) {
      const [x,y] = p[i-1], dx = p[i][0] - x, dy = p[i][1] - y;
      const distance = Math.hypot(dx,dy);
      if (!distance) continue;
      const fraction = Math.min(1, budget / distance);
      d += 'L' + point([x + dx*fraction, y + dy*fraction]);
      budget -= distance;
      if (budget <= 0) break;
    }
  }
  return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + weight +
    '" stroke-linecap="round" stroke-linejoin="round"/>';
}
const point = ([x,y]) => x.toFixed(1) + ',' + y.toFixed(1);
const length = p => p.slice(1).reduce((n, [x,y], i) => n + Math.hypot(x-p[i][0], y-p[i][1]), 0);
module.exports = { ink, lettering };
