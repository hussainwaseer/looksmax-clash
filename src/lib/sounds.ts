/**
 * Web Audio API sound effects for Face-Off battles.
 * No external files needed — all synthesized.
 */

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return _ctx;
}

function beep(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.3, delay = 0) {
    try {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        g.gain.setValueAtTime(0, ctx.currentTime + delay);
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration + 0.05);
    } catch (_) { /* silently ignore if audio not available */ }
}

/** Single countdown tick (3, 2, 1) */
export function playCountdownBeep(num: number) {
    const freq = num === 1 ? 880 : 550;
    beep(freq, 0.18, "sine", 0.4);
}

/** GO! — rising chord burst */
export function playGoSound() {
    beep(440, 0.12, "sawtooth", 0.3, 0);
    beep(550, 0.12, "sawtooth", 0.3, 0.09);
    beep(660, 0.15, "sawtooth", 0.3, 0.18);
    beep(880, 0.35, "sine", 0.4, 0.28);
}

/** Victory fanfare — rising triumphant tones */
export function playVictorySound() {
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [1319, 0.52]].forEach(([f, d]) => {
        beep(f as number, 0.3, "sine", 0.35, d as number);
    });
    // final chord
    beep(523, 0.6, "sine", 0.2, 0.85);
    beep(659, 0.6, "sine", 0.2, 0.85);
    beep(784, 0.6, "sine", 0.2, 0.85);
}

/** Defeat — descending wail */
export function playDefeatSound() {
    beep(440, 0.2, "sawtooth", 0.3, 0);
    beep(370, 0.2, "sawtooth", 0.3, 0.2);
    beep(294, 0.3, "sawtooth", 0.3, 0.4);
    beep(220, 0.5, "sawtooth", 0.2, 0.68);
}

/** Tie — neutral two-tone */
export function playTieSound() {
    beep(523, 0.25, "sine", 0.3, 0);
    beep(523, 0.25, "sine", 0.3, 0.3);
}

/** Mobile haptic feedback */
export function vibrate(pattern: number | number[]) {
    try {
        if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) { /* not supported */ }
}
