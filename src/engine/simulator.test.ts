import { describe, expect, it } from 'vitest';
import {
  createEmptyVerified,
  createInitialState,
  raiseDeviceIrq,
  stepMicroOp,
  toggleDeviceMask,
  triggerIrqStorm,
} from './simulator';
import type { ConceptKey, CpuPhase, DeviceId, PresetId, SimState } from './types';

function runSteps(initial: SimState, count: number): SimState[] {
  const history: SimState[] = [];
  let s = initial;
  for (let i = 0; i < count; i++) {
    s = stepMicroOp(s);
    history.push(s);
  }
  return history;
}

describe('IRQ-Trace deterministic simulation engine', () => {
  it('Preset 1: walks full interrupt lifecycle and restores exact pre-interrupt PC', () => {
    const start = createInitialState('single-kbd');
    const history = runSteps(start, 25);

    const phasesSeen = new Set<CpuPhase>(history.map((s) => s.cpu.phase));
    expect(phasesSeen.has('INT_ACK')).toBe(true);
    expect(phasesSeen.has('CTX_SAVE')).toBe(true);
    expect(phasesSeen.has('IVT_LOOKUP')).toBe(true);
    expect(phasesSeen.has('ISR_EXEC_1')).toBe(true);
    expect(phasesSeen.has('ISR_EXEC_2')).toBe(true);
    expect(phasesSeen.has('ISR_IRET')).toBe(true);

    const savedFrameState = history.find((s) => s.stack.length === 1);
    expect(savedFrameState).toBeDefined();
    const savedPC = savedFrameState!.stack[0].savedPC;

    const afterIretIndex = history.findIndex((s) => s.cpu.phase === 'ISR_IRET');
    expect(afterIretIndex).toBeGreaterThan(-1);
    const resumed = history[afterIretIndex + 1];
    expect(resumed.stack.length).toBe(0);
    expect(resumed.cpu.PC).toBe(savedPC);
    expect(resumed.cpu.FLAGS.MODE).toBe('USER');
  });

  it('Preset 2: resolves simultaneous IRQs strictly in PIC priority order (KBD -> MSE -> PRN)', () => {
    const start = createInitialState('interrupt-storm');
    const history = runSteps(start, 45);

    const serviceOrder: DeviceId[] = [];
    for (const s of history) {
      if (s.cpu.phase === 'ISR_EXEC_1' && s.cpu.activeIsrDevice) {
        const last = serviceOrder[serviceOrder.length - 1];
        if (last !== s.cpu.activeIsrDevice) {
          serviceOrder.push(s.cpu.activeIsrDevice);
        }
      }
    }

    expect(serviceOrder).toEqual(['keyboard', 'mouse', 'printer']);
  });

  it('Preset 3: supports 2-level nested preemption (Timer preempts Printer) and unwinds cleanly', () => {
    const start = createInitialState('nested-preemption');
    const history = runSteps(start, 40);

    const maxDepth = Math.max(...history.map((s) => s.stack.length));
    expect(maxDepth).toBe(2);

    const depthTwoState = history.find((s) => s.stack.length === 2);
    expect(depthTwoState).toBeDefined();
    expect(depthTwoState!.stack[0].interruptedBy).toBe('printer');
    expect(depthTwoState!.stack[1].interruptedBy).toBe('timer');
    expect(depthTwoState!.stack[1].returnToDevice).toBe('printer');

    // Verify clean unwind back to outer Printer ISR then back to User mode
    const depthTwoIdx = history.indexOf(depthTwoState!);
    const afterTimerIret = history
      .slice(depthTwoIdx)
      .find((s) => s.stack.length === 1 && s.cpu.activeIsrDevice === 'printer');
    expect(afterTimerIret).toBeDefined();

    const finalState = history[history.length - 1];
    expect(finalState.stack.length).toBe(0);
    expect(finalState.cpu.FLAGS.MODE).toBe('USER');
    expect(finalState.cpu.activeIsrDevice).toBeNull();
  });

  it('Preset 4: blocks PID 102 on Printer I/O, switches to System Idle, and wakes up on IRQ7', () => {
    const start = createInitialState('os-io-wakeup');
    const history = runSteps(start, 35);

    const blockedState = history.find((s) =>
      s.processes.some((p) => p.pid === 102 && p.state === 'BLOCKED')
    );
    expect(blockedState).toBeDefined();
    expect(blockedState!.processes.find((p) => p.pid === 0)?.state).toBe('RUNNING');

    const wokenState = history
      .slice(history.indexOf(blockedState!))
      .find((s) => s.processes.some((p) => p.pid === 102 && p.state === 'RUNNING'));
    expect(wokenState).toBeDefined();
  });

  it('Masking a device holds its IRQ pending without acknowledging until unmasked', () => {
    let state = createInitialState('single-kbd');
    state = { ...state, scheduledEvents: [] };
    state = toggleDeviceMask(state, 'keyboard');
    state = raiseDeviceIrq(state, 'keyboard', "SCAN 0x30 'B'");

    const maskedHistory = runSteps(state, 10);
    expect(maskedHistory.every((s) => s.cpu.activeIsrDevice === null)).toBe(true);
    expect(maskedHistory[maskedHistory.length - 1].devices.keyboard.pending).toBe(true);

    const unmasked = toggleDeviceMask(maskedHistory[maskedHistory.length - 1], 'keyboard');
    const unmaskedHistory = runSteps(unmasked, 12);
    expect(unmaskedHistory.some((s) => s.cpu.activeIsrDevice === 'keyboard')).toBe(true);
  });

  it('triggerIrqStorm latches printer, mouse, and keyboard simultaneously with 3 IRQ signals', () => {
    const start = createInitialState('single-kbd');
    const stormed = triggerIrqStorm(start);

    expect(stormed.devices.printer.pending).toBe(true);
    expect(stormed.devices.mouse.pending).toBe(true);
    expect(stormed.devices.keyboard.pending).toBe(true);
    expect(stormed.activeSignals.filter((s) => s.bus === 'irq')).toHaveLength(3);
  });

  it('emits pin-level BusSignal endpoints across the full interrupt lifecycle', () => {
    const start = createInitialState('single-kbd');
    const history = runSteps(start, 20);
    const allSignals = history.flatMap((s) => s.activeSignals);

    expect(allSignals.some((s) => s.from === 'keyboard' && s.to === 'pic')).toBe(true);
    expect(allSignals.some((s) => s.from === 'pic' && s.to === 'cpu')).toBe(true);
    expect(allSignals.some((s) => s.from === 'cpu' && s.to === 'stack')).toBe(true);
    expect(allSignals.some((s) => s.from === 'cpu' && s.to === 'ivt')).toBe(true);
    expect(allSignals.some((s) => s.from === 'ivt' && s.to === 'cpu')).toBe(true);
    expect(allSignals.some((s) => s.from === 'keyboard' && s.to === 'cpu')).toBe(true);
    expect(allSignals.some((s) => s.from === 'stack' && s.to === 'cpu')).toBe(true);
  });

  it('verifies all 10 OS + COA concepts and all 4 devices across the 4 presets', () => {
    const presets: PresetId[] = ['single-kbd', 'interrupt-storm', 'nested-preemption', 'os-io-wakeup'];
    const merged = createEmptyVerified();

    for (const p of presets) {
      let s = createInitialState(p);
      for (let i = 0; i < 40; i++) {
        s = stepMicroOp(s);
      }
      for (const k of Object.keys(merged.concepts) as ConceptKey[]) {
        if (merged.concepts[k] === null && s.verified.concepts[k] !== null) {
          merged.concepts[k] = s.verified.concepts[k];
        }
      }
      for (const d of ['keyboard', 'mouse', 'printer', 'timer'] as DeviceId[]) {
        if (s.verified.triggeredDevices[d]) {
          merged.triggeredDevices[d] = true;
        }
      }
    }

    for (const k of Object.keys(merged.concepts) as ConceptKey[]) {
      expect(merged.concepts[k]).not.toBeNull();
    }
    expect(merged.triggeredDevices).toEqual({
      keyboard: true,
      mouse: true,
      printer: true,
      timer: true,
    });
  });
});
