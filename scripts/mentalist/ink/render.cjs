// Regenerate the six checked-in MP4s and posters with Node, sharp, and an H.264-enabled ffmpeg.
// FFMPEG=/path/to/ffmpeg node scripts/mentalist/ink/render.cjs [skill-id]
const {spawn} = require('node:child_process');
const {join} = require('node:path');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {mkdir} = require('node:fs/promises');
const sharp = require('sharp');
const clips = require('../../../content/mentalist/previews.json');
const {board} = require('./boards.cjs');
const output = join(__dirname,'../../../public/mentalist/previews');
const fps = 20;
const seconds = 21;
async function render(clip) {
  const base = join(output,clip.skill);
  await sharp(board(clip,4.9)).webp({quality:88}).toFile(base+'.webp');
  async function* frames() {
    for (let frame=0; frame<fps*seconds; frame++)
      yield await sharp(board(clip,frame/fps)).removeAlpha().raw().toBuffer();
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
  console.log('Rendered',clip.skill);
}
async function main() {
  await mkdir(output,{recursive:true});
  const selected = clips.filter(c=>!process.argv[2] || c.skill===process.argv[2]);
  if (!selected.length) throw Error('Unknown skill');
  for(const clip of selected) await render(clip);
}
main().catch(e=>{console.error(e);process.exitCode=1});
