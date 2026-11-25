import type { CpuPhase } from '../engine/types';

class HardwareSoundSynth {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          this.ctx = new Ctx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    gainPeak: number,
    type: OscillatorType = 'triangle',
    delaySec = 0
  ) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.01);
    } catch {
      // Ignore audio errors when browser autoplay blocks AudioContext
    }
  }

  playStep(phase: CpuPhase) {
    const base =
      phase === 'FETCH'
        ? 520
        : phase === 'DECODE'
          ? 600
          : phase === 'EXECUTE'
            ? 680
            : 460;
    this.playTone(base, base * 0.65, 0.024, 0.02, 'sine');
  }

  playIrq(irqNumber: number) {
    const start = 460 + irqNumber * 35;
    this.playTone(start, start + 340, 0.07, 0.045, 'triangle');
  }

  playPreempt() {
    this.playTone(660, 720, 0.045, 0.05, 'triangle', 0);
    this.playTone(990, 1040, 0.045, 0.05, 'triangle', 0.04);
    this.playTone(1320, 1400, 0.065, 0.055, 'triangle', 0.08);
  }

  playPush() {
    this.playTone(420, 210, 0.065, 0.04, 'square');
  }

  playIret() {
    this.playTone(340, 680, 0.075, 0.04, 'triangle');
  }

  playWakeup() {
    this.playTone(523.25, 523.25, 0.05, 0.04, 'sine', 0);
    this.playTone(783.99, 783.99, 0.085, 0.045, 'sine', 0.05);
  }
}

export const hwSound = new HardwareSoundSynth();
