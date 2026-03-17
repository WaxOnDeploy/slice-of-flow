/**
 * Slice of Flow — Sound Effects
 * 
 * Uses Web Audio API to synthesize all sounds — no external files needed.
 * Each sound is designed to be short, distinctive, and thematically appropriate.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function toggleSound(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

// ─── ORDER FLIP — "ding" bell sound ───────────────
// Short, bright bell when a new order appears
export function playOrderFlip() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.05);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
  
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

// ─── CARD MOVE — soft "whoosh" ────────────────────
// Quick whoosh when dragging a card to a new column
export function playCardMove() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.15);
  filter.Q.value = 1;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
}

// ─── PREP DONE — cheerful "ding-ding" ─────────────
// Two-note chime when prep timer finishes
export function playPrepDone() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  [0, 0.12].forEach((delay, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(i === 0 ? 660 : 880, ctx.currentTime + delay);
    
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.25);
    
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.25);
  });
}

// ─── INTO OVEN — sizzle sound ─────────────────────
// Short sizzle when pizza enters the oven
export function playOvenSizzle() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    const t = i / ctx.sampleRate;
    // Crackly noise with envelope
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.4;
    // Add some periodic crackling
    if (Math.random() < 0.03) {
      data[i] *= 3;
    }
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  filter.Q.value = 0.5;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
}

// ─── OVEN WARNING — urgent beep-beep ──────────────
// Repeating urgent beep when pizza is about to burn
export function playOvenWarning() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  [0, 0.15, 0.3].forEach((delay) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'square';
    osc.frequency.value = 600;
    
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + delay + 0.01);
    gain.gain.setValueAtTime(0.12, ctx.currentTime + delay + 0.08);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.1);
    
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.1);
  });
}

// ─── BURN — harsh buzzer ──────────────────────────
// Harsh descending buzz when a pizza burns
export function playBurn() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
  
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(150, ctx.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
  
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  
  osc.start(ctx.currentTime);
  osc2.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
  osc2.stop(ctx.currentTime + 0.5);
}

// ─── SERVED — cash register "ka-ching" ────────────
// Satisfying ka-ching when pizza is served
export function playServed() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  // Metallic ring
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.05);
  
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1800, ctx.currentTime + 0.05);
  
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.setValueAtTime(0.25, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  
  osc.start(ctx.currentTime);
  osc2.start(ctx.currentTime + 0.05);
  osc.stop(ctx.currentTime + 0.4);
  osc2.stop(ctx.currentTime + 0.4);
}

// ─── ANGRY CUSTOMER — low grumble ─────────────────
// Short low grumble when a customer gets angry
export function playAngry() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
  
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

// ─── ROUND END — dramatic horn ────────────────────
// Air horn / buzzer for round end
export function playRoundEnd() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.setValueAtTime(440, ctx.currentTime + 0.5);
  osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 1.0);
  
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(443, ctx.currentTime);
  osc2.frequency.setValueAtTime(443, ctx.currentTime + 0.5);
  osc2.frequency.exponentialRampToValueAtTime(222, ctx.currentTime + 1.0);
  
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
  
  osc.start(ctx.currentTime);
  osc2.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.0);
  osc2.stop(ctx.currentTime + 1.0);
}

// ─── TIMER WARNING — tick-tock at 30s ─────────────
// Ticking clock sound for last 30 seconds
export function playTimerTick() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sine';
  osc.frequency.value = 1000;
  
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

// ─── WIP BLOCKED — error thud ─────────────────────
// Dull thud when trying to exceed WIP limit
export function playWipBlocked() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
  
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

// ─── PULL ORDER — satisfying "pop" ────────────────
// Popping sound when pulling an order in Round 2
export function playPullOrder() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
  
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

// ─── GAME START — upbeat jingle ───────────────────
// Short upbeat jingle when starting the game
export function playGameStart() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  
  notes.forEach((freq, i) => {
    const delay = i * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.3);
    
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.3);
  });
}
