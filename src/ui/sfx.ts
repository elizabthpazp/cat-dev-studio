/** Efectos de sonido sintetizados (sin archivos): clics, aciertos, errores. */
let ctx: AudioContext | undefined;
let muted = false;
try { muted = localStorage.getItem('cat-dev-muted') === '1'; } catch { /* nada */ }

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = .06, delay = 0, slide = 0) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + delay; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .02);
  } catch { /* audio no disponible */ }
}

export const sfx = {
  hover: () => tone(880, .05, 'sine', .015),
  click: () => tone(520, .08, 'triangle', .05),
  open: () => { tone(220, .25, 'sawtooth', .02, 0, 1.6); tone(330, .3, 'triangle', .03, .05); },
  success: () => { tone(523, .14, 'triangle', .06); tone(659, .14, 'triangle', .06, .1); tone(784, .3, 'triangle', .06, .2); },
  error: () => { tone(196, .25, 'square', .035); tone(147, .35, 'square', .035, .12); },
  coin: () => { tone(988, .08, 'square', .03); tone(1319, .2, 'square', .03, .07); },
  victory: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .35, 'triangle', .07, i * .14)),
  defeat: () => [392, 330, 262, 196].forEach((f, i) => tone(f, .4, 'triangle', .06, i * .18)),
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('cat-dev-muted', muted ? '1' : '0'); } catch { /* nada */ } return muted; }
};
