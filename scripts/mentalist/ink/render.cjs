// Regenerate the curriculum MP4s and posters with Node, sharp, and an H.264-enabled ffmpeg.
// FFMPEG=/path/to/ffmpeg node scripts/mentalist/ink/render.cjs [level-or-skill-id]
const {spawn} = require('node:child_process');
const {join} = require('node:path');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {mkdir} = require('node:fs/promises');
const sharp = require('sharp');
const course = process.argv.includes('--grade6') ? '6math' : process.argv.includes('--grade8') ? '8math' : 'mentalist';
const clips = require('../../../content/' + course + '/previews.json');
const {board} = require('./boards.cjs');
const output = join(__dirname,'../../../public',course,'previews');
const fps = 32;
const speed = 4; // A 300% increase over the original drawing speed.
const seconds = 21 / speed;
async function render(clip) {
  const base = join(output,clip.media ?? (clip.model === 'worked' ? clip.level : clip.skill));
  await sharp(board(clip,clip.model === "worked" ? 5.8 : 4.9)).webp({quality:88}).toFile(base+'.webp');
  async function* frames() {
    for (let frame=0; frame<fps*seconds; frame++)
      yield await sharp(board(clip,frame * speed / fps)).removeAlpha().raw().toBuffer();
  }
  const encoder = spawn(process.env.FFMPEG || 'ffmpeg', ['-hide_banner','-loglevel','error','-y',
    '-f','rawvideo','-pix_fmt','rgb24','-s','432x768','-r',String(fps),'-i','pipe:0',
    '-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','21','-movflags','+faststart',base+'.mp4'],
    {stdio:['pipe','ignore','inherit']});
  const done = new Promise((resolve,reject)=>{
    encoder.once('error',reject);
    encoder.once('close',code=>code===0?resolve():reject(Error('Encoder exited with '+code)));
  });
  await Promise.all([pipeline(Readable.from(frames()),encoder.stdin),done]);
  console.log('Rendered',clip.level);
}
async function main() {
  await mkdir(output,{recursive:true});
  const id = process.argv.slice(2).find(arg=>!arg.startsWith('--'));
  const selected = clips.filter(c=>!c.mediaCourse && (!id || c.skill===id || c.level===id));
  if (!selected.length) throw Error('Unknown skill');
  // Bound encoder concurrency so a full rebuild also works on a laptop.
  const pending = process.argv.includes('--missing') ? selected.filter(c =>
    ['mp4', 'webp'].some(ext => !require('node:fs').existsSync(join(output, (c.media ?? c.level) + '.' + ext)))) : selected;
  for (let i=0; i<pending.length; i+=3) await Promise.all(pending.slice(i,i+3).map(render));
}
main().catch(e=>{console.error(e);process.exitCode=1});
