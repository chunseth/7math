const {ink, lettering} = require('./pen.cjs');
const navy = '#183831';
const faint = '#779289';
const clamp = n => Math.max(0, Math.min(1,n));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text = (x,y,s,size,color=navy,bold=500) =>
  `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="${bold}" fill="${color}">${escape(s)}</text>`;
const rect = (x,y,w,h,r,fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle = (x,y,r,color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const box = (x,y,w,h) => [[x,y],[x+w,y+1],[x+w-1,y+h],[x,y+h-1],[x,y]];
const range = n => Array.from({length:n},(_,i)=>i);

function diagram(model,t,color) {
  const phase = (from,to) => clamp((t-from)/(to-from));
  const draw = (paths,from=0.6,to=4,weight=3,shade=color) => ink(paths,phase(from,to),shade,weight);
  const number = (value,x,y,scale=0.85,from=1,to=4) => draw(lettering(value,x,y,scale),from,to,2.5);
  switch(model) {
    case 'groups': {
      let dots = '';
      for(const col of range(10)) for(const row of range(7)) {
        const x = 68+33*col, y = 192+16*row;
        dots += circle(x,y,4*phase(.3+col*.16,.7+col*.16), col===9 ? '#af6146' : color);
      }
      return dots + draw([[[346,179],[382,303]]],3,4.5,4,'#a94832');
    }
    case 'numberline': {
      const x = n=>65+(n+4)*41;
      const axis = [[[45,263],[379,263]],...range(8).map(i=>[[x(i-4),258],[x(i-4),269]])];
      const jump = (a,b,height) => range(31).map(i=>{
        const f=i/30;
        return [x(a)+(x(b)-x(a))*f,252-height*4*f*(1-f)];
      });
      return draw(axis,.25,1.6,2,faint) + [-4,0,3].map(v=>number(String(v).replace('-','−'),x(v)-9,278,.68,.8,2)).join('') +
        draw([jump(3,0,56),[[x(0)-1,242],[x(0),253],[x(0)+11,248]]],1.7,3.2) +
        draw([jump(0,-4,44),[[x(-4)-1,242],[x(-4),253],[x(-4)+11,248]]],3.2,5);
    }
    case 'strips': {
      const x=69, w=294, cell=w/6;
      return [0,1].map(row=>{
        const y=201+row*62, n=row ? 2 : 3;
        return rect(x,y,cell*n*phase(.6,2),36,0,row?'#9fb5d1':'#d6aa86') +
          draw([box(x,y,w,36)],.4,1.6,2.5) +
          draw(range(5).map(i=>[[x+cell*(i+1),y],[x+cell*(i+1),y+36]]),1.8,4,2.2);
      }).join('');
    }
    case 'notebooks':
      return range(3).map(i=>{
        const x=55+i*116, y=196;
        return rect(x,y,87,96,5,'#e1e9f3')+draw([box(x,y,87,96),[[x+15,y],[x+15,y+95]],
          [[x+29,y+22],[x+68,y+22]],[[x+29,y+29],[x+57,y+29]]],.4+i*.4,2.3+i*.4,2.3)+
          number('$4',x+25,y+48,.99,7+i*.4,8+i*.4);
      }).join('');
    case 'balance':
      return range(3).map(i=>rect(56+i*36,213,31,52,5,'#e3d9e9')+
        number('x',63+i*36,224,.9,.4,2)).join('') +
        [0,1].map(i=>circle(179+i*14,240,5*phase(.5,1.3),color)).join('')+
        number('14',245,224,1.18,.4,2) +
        draw([[[49,273],[355,273]],[[202,275],[186,306],[218,306],[202,275]]],.8,2.8,3) +
        draw([[[173,251],[199,226]]],3,4,3,'#a54b37')+number('−2',305,224,1.18,3,4.7);
    case 'triangle': {
      // Base angles are 48° and 67°. Intersect those rays to locate the apex.
      const a=Math.tan(48*Math.PI/180), b=Math.tan(67*Math.PI/180), x=106+202*b/(a+b);
      const y=316-(x-106)*a;
      return draw([[[106,316],[308,316],[x,y],[106,316]]],.35,2.4,3.2)+
        number('48°',137,287,.7,2.1,3.5)+number('67°',255,287,.7,2.1,3.5)+number('x',x-12,y+24,.92,3.1,4.2);
    }
    default: throw Error('Unknown diagram ' + model);
  }
}
// Wrap by a conservative Helvetica width estimate. The longest prompts keep their own space above the pen work.
function wrapLines(value, size, maxWidth = 365) {
  const lines = [''];
  const measure = word => [...word].reduce((n,c) => n + (/[il.,:;'! ]/.test(c) ? .29 : /[MW@%]/.test(c) ? .92 : /[A-Z]/.test(c) ? .72 : .58) * size, 0);
  for (const word of value.split(' ')) {
    const i = lines.length - 1, next = lines[i] ? lines[i] + ' ' + word : word;
    if (lines[i] && measure(next) > maxWidth) lines.push(word);
    else lines[i] = next;
  }
  return lines;
}
function wrapped(lines, x, y, size, color, weight) {
  return lines.map((line, i) => text(x, y + i * size * 1.2, line, size, color, weight)).join('');
}
function worked(clip,t) {
  const color = clip.color;
  const promptSize = clip.prompt.length > 95 ? 22 : 26;
  const prompt = wrapLines(clip.prompt, promptSize);
  let nextY = Math.max(265, 130 + (prompt.length - 1) * promptSize * 1.2 + 32);
  const rows = clip.steps.map((step,i) => {
    const start = .5 + i * 6.1, y = nextY;
    const alpha = clamp((t-start)/.6);
    const label = wrapLines(step.label, 18);
    const mathY = y + Math.max(39, (label.length - 1) * 21.6 + 17);
    nextY = Math.max(y + 123, mathY + 84);
    return `<g opacity="${alpha}">${wrapped(label,31,y,18,navy,550)}
      ${ink(lettering(step.math,32,mathY,1.47,364),clamp((t-start-.6)/4.5),color,3.2)}</g>`;
  });
  const answerY = nextY;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="432" height="768">
    ${rect(0,0,432,768,0,'#fbf9f0')}${rect(31,86,30,4,2,color)}
    ${wrapped(prompt,30,130,promptSize,navy,700)}
    ${rows.join('')}
    <g opacity="${clamp((t-13)/.6)}">${rect(20,answerY,392,110,12,'#e8eee2')}${text(40,answerY+29,'Answer',17,color,650)}</g>
    ${ink(lettering(clip.result,40,answerY+45,1.61,349),clamp((t-13.7)/3.7),color,3.6)}</svg>`);
}
function board(clip,t) {
  if (clip.model === "worked") return worked(clip,t);
  const color=clip.color;
  const opacity = (at) => clamp((t-at)/.4);
  const group = (alpha,body) => alpha ? `<g opacity="${alpha}">${body}</g>` : '';
  const pad=31;
  const math=(value,x,y,size,start,duration,max) => ink(lettering(value,x,y,size,max),clamp((t-start)/duration),color,3.8);
  const rows = clip.steps.map((step,i)=>{
    const y=335+i*89, start=5+i*5;
    return group(opacity(start),text(pad,y,step.label,18,navy,500)) +
      math(step.math,pad+3,y+16,1.61,start+.45,3.1,365);
  });
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="432" height="768">
    <defs><pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.85" fill="#cbd5ca"/></pattern></defs>
    ${rect(0,0,432,768,0,'#fbf9f0')}${rect(0,145,432,165,0,'url(#grid)')}
    ${text(29,112,clip.prompt,clip.prompt.length>23?27:32,navy,700)}
    ${clip.subprompt?text(31,140,clip.subprompt,19):''}
    <g transform="translate(0,-24)">${diagram(clip.model,t,color)}</g>${rows.join('')}
    ${group(opacity(15),rect(22,500,388,110,13,'#e8eee2')+text(42,532,'Answer',17,color,650))}
    ${math(clip.result,43,546,1.72,15.4,2.6,342)}
    ${clip.unit?group(opacity(17),text(121,591,clip.unit,23,navy)):''}
    </svg>`);
}
module.exports = {board};
