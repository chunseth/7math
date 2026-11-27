type Sound = "hit" | "break" | "gem" | "stairs" | "explosion" | "descend";
let audio: AudioContext | undefined;

export function unlockMiningSound() {
  if (typeof AudioContext === "undefined") return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch { /* Mining works without audio. */ }
}

export function miningSound(sound: Sound) {
  const context = audio;
  if (!context || context.state === "closed") return;
  const now = context.currentTime;
  function tone(hz: number, endHz: number, length: number, volume: number, delay = 0) {
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + delay;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(hz, start);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + length);
  }
  function grit(length: number, volume: number, lowPass: number) {
    if (!context) return;
    const frames = Math.floor(context.sampleRate * length);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < frames; index++) samples[index] = (Math.random() * 2 - 1) * (1 - index / frames) ** 2;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.frequency.value = lowPass;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
  }
  if (sound === "hit") {
    tone(560, 240, 0.075, 0.12);
    grit(0.075, 0.17, 1900);
  } else if (sound === "break") {
    tone(180, 110, 0.13, 0.13);
    grit(0.18, 0.26, 1150);
  } else if (sound === "explosion") {
    tone(102, 34, 0.47, 0.25);
    grit(0.44, 0.38, 530);
  } else if (sound === "stairs" || sound === "gem") {
    const notes = sound === "gem" ? [523, 659, 784, 1047] : [294, 440, 587];
    notes.forEach((hz, index) => tone(hz, hz, 0.22, 0.095, index * 0.075));
  } else {
    tone(273, 120, 0.3, 0.1);
  }
}
