import {
  DEVICE_ORDER,
  DEVICE_PAYLOADS,
  DEVICE_TEMPLATES,
  IDLE_PC,
  INITIAL_SP,
  IO_WAIT_PROGRAM,
  ISR_STEP_LABELS,
  MAIN_BASE_PC,
  MAIN_PROGRAM,
  MAX_IO_BUFFER,
  MAX_LOG_ENTRIES,
  MAX_WAVEFORM_SAMPLES,
  STACK_FRAME_SIZE,
  payloadToRegisterWord,
  toHex,
} from './constants';
import type {
  BusSignal,
  ConceptKey,
  DeviceId,
  DeviceState,
  IoBufferEntry,
  LogCategory,
  OsProcess,
  PresetId,
  ScheduledEvent,
  SimState,
  StackFrame,
  TraceLogEntry,
  VerifiedConcepts,
  WaveformBusActivity,
  WaveformCpuState,
  WaveformSample,
} from './types';

function cloneDevices(): Record<DeviceId, DeviceState> {
  return {
    timer: { ...DEVICE_TEMPLATES.timer, totalTriggered: 0 },
    keyboard: { ...DEVICE_TEMPLATES.keyboard, totalTriggered: 0 },
    mouse: { ...DEVICE_TEMPLATES.mouse, totalTriggered: 0 },
    printer: { ...DEVICE_TEMPLATES.printer, totalTriggered: 0 },
  };
}

export function createEmptyVerified(): VerifiedConcepts {
  return {
    concepts: {
      hardwareInterrupts: null,
      interruptController: null,
      instructionCycle: null,
      cpuRegistersContext: null,
      ivtLookup: null,
      priorityAndNesting: null,
      deviceManagement: null,
      ioManagement: null,
      interruptHandling: null,
      processSynchronization: null,
    },
    triggeredDevices: {
      keyboard: false,
      mouse: false,
      printer: false,
      timer: false,
    },
  };
}

function markConcept(
  verified: VerifiedConcepts,
  key: ConceptKey,
  tick: number
): VerifiedConcepts {
  if (verified.concepts[key] !== null) return verified;
  return {
    ...verified,
    concepts: {
      ...verified.concepts,
      [key]: tick,
    },
  };
}

function markConcepts(
  verified: VerifiedConcepts,
  keys: ConceptKey[],
  tick: number
): VerifiedConcepts {
  let next = verified;
  for (const k of keys) {
    next = markConcept(next, k, tick);
  }
  return next;
}

function getNextPayload(deviceId: DeviceId, count: number): string {
  if (deviceId === 'timer') {
    return `PIT_TICK #${count + 1}`;
  }
  const pool = DEVICE_PAYLOADS[deviceId];
  return pool[count % pool.length];
}

function appendLog(
  logs: TraceLogEntry[],
  nextSeq: number,
  tick: number,
  category: LogCategory,
  message: string
): { logs: TraceLogEntry[]; nextSeq: number } {
  const entry: TraceLogEntry = {
    id: `log-${tick}-${nextSeq}`,
    tick,
    category,
    message,
  };
  const updated = [...logs, entry];
  if (updated.length > MAX_LOG_ENTRIES) {
    updated.shift();
  }
  return { logs: updated, nextSeq: nextSeq + 1 };
}

function createSignal(
  nextSeq: number,
  tick: number,
  bus: BusSignal['bus'],
  from: BusSignal['from'],
  to: BusSignal['to'],
  label: string
): { signal: BusSignal; nextSeq: number } {
  return {
    signal: {
      id: `sig-${tick}-${nextSeq}`,
      bus,
      from,
      to,
      label,
    },
    nextSeq: nextSeq + 1,
  };
}

function getActiveProcess(processes: OsProcess[]): OsProcess | undefined {
  return processes.find((p) => p.state === 'RUNNING');
}

function selectHighestPendingIrq(
  devices: Record<DeviceId, DeviceState>,
  minPriorityExclusive?: number
): DeviceState | null {
  let best: DeviceState | null = null;
  for (const id of DEVICE_ORDER) {
    const dev = devices[id];
    if (!dev.pending || dev.masked || dev.inService) continue;
    if (minPriorityExclusive !== undefined && dev.priority >= minPriorityExclusive) {
      continue;
    }
    if (!best || dev.priority < best.priority || (dev.priority === best.priority && dev.irqNumber < best.irqNumber)) {
      best = dev;
    }
  }
  return best;
}

function getProgramForPreset(presetId: PresetId) {
  return presetId === 'os-io-wakeup' ? IO_WAIT_PROGRAM : MAIN_PROGRAM;
}

function buildInitialProcesses(presetId: PresetId): OsProcess[] {
  if (presetId === 'os-io-wakeup') {
    return [
      { pid: 102, name: 'ReportSpool', state: 'RUNNING', progress: 20 },
      { pid: 101, name: 'TelemetryUI', state: 'BLOCKED', blockedOn: 'keyboard', progress: 45 },
      { pid: 0, name: 'System Idle', state: 'READY', progress: 0 },
    ];
  }
  return [
    { pid: 101, name: 'TelemetryUI', state: 'RUNNING', progress: 35 },
    { pid: 102, name: 'ReportSpool', state: 'READY', progress: 15 },
    { pid: 0, name: 'System Idle', state: 'READY', progress: 0 },
  ];
}

function buildPresetSchedule(presetId: PresetId): ScheduledEvent[] {
  switch (presetId) {
    case 'single-kbd':
      return [
        {
          id: 'evt-kbd-1',
          fired: false,
          atTick: 3,
          action: { type: 'RAISE_IRQ', deviceId: 'keyboard', payload: "SCAN 0x1E 'A'" },
        },
      ];
    case 'interrupt-storm':
      return [
        {
          id: 'evt-storm-prn',
          fired: false,
          atTick: 2,
          action: { type: 'RAISE_IRQ', deviceId: 'printer', payload: 'BUF_RDY 2KB' },
        },
        {
          id: 'evt-storm-mse',
          fired: false,
          atTick: 2,
          action: { type: 'RAISE_IRQ', deviceId: 'mouse', payload: 'ΔX:+14 ΔY:-6 [LMB]' },
        },
        {
          id: 'evt-storm-kbd',
          fired: false,
          atTick: 2,
          action: { type: 'RAISE_IRQ', deviceId: 'keyboard', payload: "SCAN 0x1E 'A'" },
        },
      ];
    case 'nested-preemption':
      return [
        {
          id: 'evt-nest-prn',
          fired: false,
          atTick: 2,
          action: { type: 'RAISE_IRQ', deviceId: 'printer', payload: 'DMA_DONE 4KB' },
        },
        {
          id: 'evt-nest-tmr',
          fired: false,
          onPhase: { phase: 'ISR_EXEC_1', activeIrq: 'printer' },
          action: { type: 'RAISE_IRQ', deviceId: 'timer', payload: 'PIT_TICK #1' },
        },
      ];
    case 'os-io-wakeup':
      return [
        {
          id: 'evt-io-dma-done',
          fired: false,
          atTick: 10,
          action: { type: 'RAISE_IRQ', deviceId: 'printer', payload: 'DMA_DONE 4KB' },
        },
      ];
  }
}

export function createInitialState(presetId: PresetId = 'single-kbd'): SimState {
  const program = getProgramForPreset(presetId);
  const firstInstr = program[0];
  const nestedInterrupts = presetId === 'nested-preemption';

  const initLogMsg =
    presetId === 'single-kbd'
      ? 'Loaded Preset 1: Single Keyboard Interrupt (IRQ1 armed for tick 3).'
      : presetId === 'interrupt-storm'
        ? 'Loaded Preset 2: Interrupt Storm (PRN+MSE+KBD simultaneous at tick 2).'
        : presetId === 'nested-preemption'
          ? 'Loaded Preset 3: Nested Preemption (Nested mode ON · Timer IRQ0 preempts Printer IRQ7).'
          : 'Loaded Preset 4: OS I/O Wait & Wakeup (PID 102 ready to issue SYSCALL WRITE_PRINTER).';

  return {
    tick: 0,
    cpu: {
      PC: MAIN_BASE_PC,
      IR: firstInstr.mnemonic,
      SP: INITIAL_SP,
      FLAGS: { Z: false, C: false, IE: true, MODE: 'USER' },
      R0: 0x0010,
      R1: 0x0004,
      R2: 0x0001,
      R3: 0x0000,
      phase: 'FETCH',
      activeIsrDevice: null,
      pendingAckDevice: null,
      resumePhase: null,
      changedRegisters: [],
      currentInstructionLabel: firstInstr.mnemonic,
      programIndex: 0,
    },
    devices: cloneDevices(),
    nestedInterrupts,
    periodicTimer: false,
    timerPeriod: 14,
    autoTraffic: false,
    stack: [],
    activeIvtDevice: null,
    processes: buildInitialProcesses(presetId),
    ioBuffer: [],
    activeSignals: [],
    waveforms: [],
    logs: [
      {
        id: 'log-0-0',
        tick: 0,
        category: 'CPU',
        message: initLogMsg,
      },
    ],
    scheduledEvents: buildPresetSchedule(presetId),
    activePresetId: presetId,
    verified: createEmptyVerified(),
    nextSeq: 1,
  };
}

export function raiseDeviceIrq(
  state: SimState,
  deviceId: DeviceId,
  customPayload?: string
): SimState {
  const dev = state.devices[deviceId];
  const payload = customPayload ?? getNextPayload(deviceId, dev.totalTriggered);
  const updatedDevice: DeviceState = {
    ...dev,
    pending: true,
    pendingPayload: payload,
    totalTriggered: dev.totalTriggered + 1,
  };

  let nextSeq = state.nextSeq;
  const sigRes = createSignal(
    nextSeq,
    state.tick,
    'irq',
    deviceId,
    'pic',
    `IRQ${dev.irqNumber} ${dev.shortLabel}`
  );
  nextSeq = sigRes.nextSeq;

  const maskNote = dev.masked ? ' [MASKED at PIC]' : ` (P${dev.priority})`;
  const logRes = appendLog(
    state.logs,
    nextSeq,
    state.tick,
    'IRQ',
    `${dev.name} raised IRQ${dev.irqNumber}${maskNote} · payload=${payload}`
  );
  nextSeq = logRes.nextSeq;

  let verified = markConcepts(
    state.verified,
    ['hardwareInterrupts', 'deviceManagement'],
    state.tick
  );
  if (!verified.triggeredDevices[deviceId]) {
    verified = {
      ...verified,
      triggeredDevices: {
        ...verified.triggeredDevices,
        [deviceId]: true,
      },
    };
  }

  return {
    ...state,
    devices: {
      ...state.devices,
      [deviceId]: updatedDevice,
    },
    activeSignals: [...state.activeSignals, sigRes.signal],
    logs: logRes.logs,
    verified,
    nextSeq,
  };
}

export function triggerIrqStorm(state: SimState): SimState {
  let next = raiseDeviceIrq(state, 'printer');
  next = raiseDeviceIrq(next, 'mouse');
  next = raiseDeviceIrq(next, 'keyboard');
  const logRes = appendLog(
    next.logs,
    next.nextSeq,
    next.tick,
    'IRQ',
    'IRQ STORM injected: Printer (IRQ7), Mouse (IRQ3), and Keyboard (IRQ1) raised simultaneously!'
  );
  return {
    ...next,
    logs: logRes.logs,
    verified: markConcept(next.verified, 'priorityAndNesting', next.tick),
    nextSeq: logRes.nextSeq,
  };
}

export function toggleDeviceMask(state: SimState, deviceId: DeviceId): SimState {
  const dev = state.devices[deviceId];
  const masked = !dev.masked;
  const logRes = appendLog(
    state.logs,
    state.nextSeq,
    state.tick,
    'IRQ',
    `PIC IRQ${dev.irqNumber} (${dev.shortLabel}) ${masked ? 'MASKED (disabled)' : 'UNMASKED (enabled)'}`
  );
  return {
    ...state,
    devices: {
      ...state.devices,
      [deviceId]: { ...dev, masked },
    },
    logs: logRes.logs,
    verified: markConcept(state.verified, 'interruptController', state.tick),
    nextSeq: logRes.nextSeq,
  };
}

export function setDevicePriority(
  state: SimState,
  deviceId: DeviceId,
  priority: number
): SimState {
  const clamped = Math.max(1, Math.min(4, Math.round(priority)));
  const dev = state.devices[deviceId];
  if (dev.priority === clamped) return state;

  const logRes = appendLog(
    state.logs,
    state.nextSeq,
    state.tick,
    'IRQ',
    `PIC priority for ${dev.shortLabel} (IRQ${dev.irqNumber}) set to P${clamped}`
  );
  return {
    ...state,
    devices: {
      ...state.devices,
      [deviceId]: { ...dev, priority: clamped },
    },
    logs: logRes.logs,
    verified: markConcepts(state.verified, ['interruptController', 'priorityAndNesting'], state.tick),
    nextSeq: logRes.nextSeq,
  };
}

export function toggleNestedInterrupts(state: SimState): SimState {
  const enabled = !state.nestedInterrupts;
  const logRes = appendLog(
    state.logs,
    state.nextSeq,
    state.tick,
    'CTX',
    `PIC Nested Preemption ${enabled ? 'ENABLED (higher-priority IRQs preempt active ISRs)' : 'DISABLED (non-preemptive ISRs)'}`
  );
  return {
    ...state,
    nestedInterrupts: enabled,
    logs: logRes.logs,
    verified: markConcepts(state.verified, ['interruptController', 'priorityAndNesting'], state.tick),
    nextSeq: logRes.nextSeq,
  };
}

export function togglePeriodicTimer(state: SimState): SimState {
  const periodicTimer = !state.periodicTimer;
  const logRes = appendLog(
    state.logs,
    state.nextSeq,
    state.tick,
    'IRQ',
    `PIT Periodic Timer ${periodicTimer ? `ENABLED (every ${state.timerPeriod} ticks)` : 'DISABLED'}`
  );
  return {
    ...state,
    periodicTimer,
    logs: logRes.logs,
    nextSeq: logRes.nextSeq,
  };
}

export function toggleAutoTraffic(state: SimState): SimState {
  const autoTraffic = !state.autoTraffic;
  const logRes = appendLog(
    state.logs,
    state.nextSeq,
    state.tick,
    'IRQ',
    `Auto-Traffic / I/O Burst ${autoTraffic ? 'ENABLED' : 'DISABLED'}`
  );
  return {
    ...state,
    autoTraffic,
    logs: logRes.logs,
    nextSeq: logRes.nextSeq,
  };
}

function blockProcessOnPrinterIo(
  state: SimState,
  targetPid?: number
): { state: SimState; blockedPid: number | null; switchedToPid: number | null } {
  const running = targetPid
    ? state.processes.find((p) => p.pid === targetPid && p.pid !== 0 && p.state !== 'BLOCKED')
    : state.processes.find((p) => p.pid !== 0 && p.state === 'RUNNING') ??
      state.processes.find((p) => p.pid !== 0 && p.state === 'READY');

  if (!running) {
    return { state, blockedPid: null, switchedToPid: null };
  }

  const nextReadyUser = state.processes.find(
    (p) => p.pid !== 0 && p.pid !== running.pid && p.state === 'READY'
  );
  const fallbackIdle = state.processes.find((p) => p.pid === 0);
  const nextRunner = nextReadyUser ?? fallbackIdle;

  const updatedProcesses: OsProcess[] = state.processes.map((p) => {
    if (p.pid === running.pid) {
      return { ...p, state: 'BLOCKED', blockedOn: 'printer' };
    }
    if (nextRunner && p.pid === nextRunner.pid) {
      return { ...p, state: 'RUNNING' };
    }
    if (p.state === 'RUNNING') {
      return { ...p, state: 'READY' };
    }
    return p;
  });

  let nextSeq = state.nextSeq;
  const sigRes = createSignal(
    nextSeq,
    state.tick,
    'os',
    'cpu',
    'os',
    `WAIT PRN · P${running.pid}`
  );
  nextSeq = sigRes.nextSeq;

  const switchMsg =
    nextRunner?.pid === 0
      ? `PID ${running.pid} (${running.name}) BLOCKED on Printer I/O → CPU yields to PID 000 (System Idle, no busy-wait)`
      : `PID ${running.pid} (${running.name}) BLOCKED on Printer I/O → Context switch to PID ${nextRunner?.pid}`;

  const logRes = appendLog(state.logs, nextSeq, state.tick, 'OS', switchMsg);
  nextSeq = logRes.nextSeq;

  const newPC = nextRunner?.pid === 0 ? IDLE_PC : state.cpu.PC;
  const newLabel = nextRunner?.pid === 0 ? 'HLT / WAIT_INT' : state.cpu.IR;

  return {
    state: {
      ...state,
      processes: updatedProcesses,
      cpu: {
        ...state.cpu,
        PC: state.cpu.activeIsrDevice ? state.cpu.PC : newPC,
        IR: state.cpu.activeIsrDevice ? state.cpu.IR : newLabel,
        currentInstructionLabel: state.cpu.activeIsrDevice ? state.cpu.currentInstructionLabel : newLabel,
        changedRegisters: state.cpu.activeIsrDevice ? state.cpu.changedRegisters : ['PC', 'IR'],
      },
      activeSignals: [...state.activeSignals, sigRes.signal],
      logs: logRes.logs,
      verified: markConcept(state.verified, 'ioManagement', state.tick),
      nextSeq,
    },
    blockedPid: running.pid,
    switchedToPid: nextRunner?.pid ?? null,
  };
}

export function triggerProcessIoBlock(state: SimState): SimState {
  const { state: nextState, blockedPid } = blockProcessOnPrinterIo(state);
  if (blockedPid !== null) return nextState;

  const logRes = appendLog(
    state.logs,
    state.nextSeq,
    state.tick,
    'OS',
    'All user processes are already BLOCKED on I/O — waiting for Printer IRQ7 completion.'
  );
  return {
    ...state,
    logs: logRes.logs,
    nextSeq: logRes.nextSeq,
  };
}

function classifyCpuState(state: SimState): WaveformCpuState {
  const { phase, activeIsrDevice } = state.cpu;
  if (phase === 'INT_ACK' || phase === 'CTX_SAVE' || phase === 'IVT_LOOKUP' || phase === 'ISR_IRET') {
    return 'CTX';
  }
  if (activeIsrDevice === 'timer') return 'ISR_TIMER';
  if (activeIsrDevice === 'keyboard') return 'ISR_KEYBOARD';
  if (activeIsrDevice === 'mouse') return 'ISR_MOUSE';
  if (activeIsrDevice === 'printer') return 'ISR_PRINTER';
  const activeProc = getActiveProcess(state.processes);
  if (activeProc?.pid === 0) return 'IDLE';
  return 'MAIN';
}

function classifyBusActivity(signals: BusSignal[]): WaveformBusActivity {
  if (signals.some((s) => s.bus === 'irq')) return 'IRQ';
  if (signals.some((s) => s.bus === 'os')) return 'OS';
  if (signals.some((s) => s.bus === 'control')) return 'CTRL';
  if (signals.some((s) => s.bus === 'data')) return 'DATA';
  if (signals.some((s) => s.bus === 'address')) return 'ADDR';
  return 'NONE';
}

export function stepMicroOp(prevState: SimState): SimState {
  const tick = prevState.tick + 1;
  let state: SimState = {
    ...prevState,
    tick,
    activeSignals: [],
    cpu: {
      ...prevState.cpu,
      changedRegisters: [],
    },
  };

  if (state.periodicTimer && tick % state.timerPeriod === 0) {
    state = raiseDeviceIrq(state, 'timer');
  }

  if (state.autoTraffic && tick % 5 === 0) {
    const burstPool: DeviceId[] = ['keyboard', 'mouse', 'printer'];
    const picked = burstPool[((tick * 7 + state.nextSeq) >>> 0) % burstPool.length];
    state = raiseDeviceIrq(state, picked);
  }

  const updatedSchedule: ScheduledEvent[] = [];
  for (const evt of state.scheduledEvents) {
    if (evt.fired) {
      updatedSchedule.push(evt);
      continue;
    }
    const tickMatch = evt.atTick !== undefined && evt.atTick === tick;
    const phaseMatch =
      evt.onPhase !== undefined &&
      evt.onPhase.phase === state.cpu.phase &&
      (evt.onPhase.activeIrq === undefined || evt.onPhase.activeIrq === state.cpu.activeIsrDevice);

    if (tickMatch || phaseMatch) {
      updatedSchedule.push({ ...evt, fired: true });
      if (evt.action.type === 'RAISE_IRQ') {
        state = raiseDeviceIrq(state, evt.action.deviceId, evt.action.payload);
      } else if (evt.action.type === 'BLOCK_IO') {
        state = blockProcessOnPrinterIo(state, evt.action.pid).state;
      }
    } else {
      updatedSchedule.push(evt);
    }
  }
  state = { ...state, scheduledEvents: updatedSchedule };

  const cpu = { ...state.cpu };
  let devices = { ...state.devices };
  let stack = [...state.stack];
  let processes = [...state.processes];
  let ioBuffer = [...state.ioBuffer];
  let activeIvtDevice = state.activeIvtDevice;
  let signals = [...state.activeSignals];
  let logs = state.logs;
  let verified = state.verified;
  let nextSeq = state.nextSeq;
  let summary = '';

  const emitSig = (
    bus: BusSignal['bus'],
    from: BusSignal['from'],
    to: BusSignal['to'],
    label: string
  ) => {
    const res = createSignal(nextSeq, tick, bus, from, to, label);
    signals.push(res.signal);
    nextSeq = res.nextSeq;
  };

  const log = (category: LogCategory, message: string) => {
    const res = appendLog(logs, nextSeq, tick, category, message);
    logs = res.logs;
    nextSeq = res.nextSeq;
  };

  const activeProc = getActiveProcess(processes);
  const isIdleRunning = activeProc?.pid === 0;
  const program = getProgramForPreset(state.activePresetId);
  const instr = program[cpu.programIndex % program.length];

  switch (cpu.phase) {
    case 'FETCH': {
      const fetchPc = isIdleRunning ? IDLE_PC : instr.pc;
      const fetchLabel = isIdleRunning ? 'HLT / WAIT_INT' : instr.mnemonic;
      cpu.PC = fetchPc;
      cpu.currentInstructionLabel = fetchLabel;
      cpu.phase = 'DECODE';
      emitSig('address', 'cpu', 'os', `ADDR ${toHex(fetchPc)}`);
      emitSig('data', 'os', 'cpu', isIdleRunning ? 'IDLE OP' : 'OP FETCH');
      summary = `FETCH @ ${toHex(fetchPc)}`;
      break;
    }

    case 'DECODE': {
      const decodeLabel = isIdleRunning ? 'HLT / WAIT_INT' : instr.mnemonic;
      cpu.IR = decodeLabel;
      cpu.changedRegisters = ['IR'];
      cpu.phase = 'EXECUTE';
      summary = `DECODE ${decodeLabel}`;
      break;
    }

    case 'EXECUTE': {
      if (isIdleRunning) {
        cpu.currentInstructionLabel = 'HLT / WAIT_INT (Low-Power)';
        cpu.phase = 'INT_CHECK';
        summary = 'IDLE WAIT_INT';
      } else {
        const changed: string[] = ['PC'];
        switch (instr.op) {
          case 'LOAD':
            cpu.R1 = (cpu.R1 + 0x04) & 0xffff;
            changed.push('R1');
            break;
          case 'ADD':
            cpu.R0 = (cpu.R0 + cpu.R1 + 0x08) & 0xffff;
            cpu.R3 = (cpu.R2 + cpu.R1) & 0xffff;
            cpu.FLAGS = { ...cpu.FLAGS, Z: cpu.R0 === 0, C: false };
            changed.push('R0', 'R3', 'FLAGS');
            break;
          case 'CMP':
            cpu.FLAGS = { ...cpu.FLAGS, Z: (cpu.R0 & 0xff) === 0x40 };
            changed.push('FLAGS');
            break;
          case 'STORE':
            emitSig('data', 'cpu', 'os', `WR ${toHex(cpu.R0)}`);
            break;
          case 'INC':
            cpu.R2 = (cpu.R2 + 1) & 0xffff;
            changed.push('R2');
            break;
          case 'SYSCALL_PRN': {
            cpu.programIndex = (cpu.programIndex + 1) % program.length;
            cpu.PC = program[cpu.programIndex].pc;
            cpu.changedRegisters = ['PC'];
            cpu.phase = 'INT_CHECK';
            const preBlockState: SimState = {
              ...state,
              cpu,
              devices,
              stack,
              processes,
              ioBuffer,
              activeIvtDevice,
              activeSignals: signals,
              logs,
              verified,
              nextSeq,
            };
            const blocked = blockProcessOnPrinterIo(preBlockState, activeProc?.pid);
            processes = blocked.state.processes;
            signals = blocked.state.activeSignals;
            logs = blocked.state.logs;
            verified = blocked.state.verified;
            nextSeq = blocked.state.nextSeq;
            cpu.PC = blocked.state.cpu.PC;
            cpu.IR = blocked.state.cpu.IR;
            cpu.currentInstructionLabel = blocked.state.cpu.currentInstructionLabel;
            cpu.changedRegisters = blocked.state.cpu.changedRegisters;
            summary = 'SYSCALL WRITE_PRINTER → BLOCKED';
            break;
          }
        }

        if (instr.op !== 'SYSCALL_PRN') {
          cpu.programIndex = (cpu.programIndex + 1) % program.length;
          cpu.PC = program[cpu.programIndex].pc;
          cpu.changedRegisters = changed;
          cpu.phase = 'INT_CHECK';

          processes = processes.map((p) =>
            p.state === 'RUNNING' ? { ...p, progress: (p.progress + 8) % 100 || 100 } : p
          );
          summary = `EXEC ${instr.mnemonic}`;
        }
      }
      break;
    }

    case 'INT_CHECK': {
      verified = markConcept(verified, 'instructionCycle', tick);
      const pendingCount = DEVICE_ORDER.filter(
        (id) => devices[id].pending && !devices[id].masked && !devices[id].inService
      ).length;
      if (pendingCount > 1) {
        verified = markConcept(verified, 'priorityAndNesting', tick);
      }

      const candidate = cpu.FLAGS.IE ? selectHighestPendingIrq(devices) : null;
      if (candidate) {
        cpu.pendingAckDevice = candidate.id;
        cpu.resumePhase = 'FETCH';
        cpu.phase = 'INT_ACK';
        emitSig('irq', 'pic', 'cpu', `INTR IRQ${candidate.irqNumber}`);
        log(
          'IRQ',
          `INT_CHECK latched highest-priority pending IRQ${candidate.irqNumber} (${candidate.shortLabel}, P${candidate.priority}).`
        );
        summary = `INTR IRQ${candidate.irqNumber} DETECTED`;
      } else {
        cpu.phase = 'FETCH';
        summary = 'INT_CHECK CLEAR → FETCH';
      }
      break;
    }

    case 'INT_ACK': {
      const targetId = cpu.pendingAckDevice;
      if (!targetId) {
        cpu.phase = 'FETCH';
        summary = 'INT_ACK NO TARGET';
        break;
      }
      const pendingCount = DEVICE_ORDER.filter(
        (id) => devices[id].pending && !devices[id].masked && !devices[id].inService
      ).length;
      if (pendingCount > 1) {
        verified = markConcept(verified, 'priorityAndNesting', tick);
      }
      verified = markConcept(verified, 'interruptController', tick);

      const dev = devices[targetId];
      devices = {
        ...devices,
        [targetId]: {
          ...dev,
          pending: false,
          inService: true,
        },
      };
      cpu.phase = 'CTX_SAVE';
      emitSig('control', 'cpu', 'pic', 'INTA');
      emitSig('data', 'pic', 'cpu', `VEC ${toHex(dev.vectorId, 2)}`);
      log(
        'IRQ',
        `INT_ACK: CPU sent INTA → PIC returned Vector ${toHex(dev.vectorId, 2)} for ${dev.shortLabel} (IRQ${dev.irqNumber}).`
      );
      summary = `INT_ACK VEC ${toHex(dev.vectorId, 2)}`;
      break;
    }

    case 'CTX_SAVE': {
      const targetId = cpu.pendingAckDevice;
      if (!targetId) {
        cpu.phase = 'FETCH';
        break;
      }
      const prevFlags = { ...cpu.FLAGS };
      const newSp = cpu.SP - STACK_FRAME_SIZE;
      const frame: StackFrame = {
        id: `frame-${tick}-${nextSeq}`,
        nestingLevel: stack.length + 1,
        spTop: newSp,
        savedPC: cpu.PC,
        savedFLAGS: prevFlags,
        savedR0: cpu.R0,
        savedR1: cpu.R1,
        savedR2: cpu.R2,
        savedR3: cpu.R3,
        interruptedBy: targetId,
        returnToDevice: cpu.activeIsrDevice,
        returnPhase: cpu.activeIsrDevice ? (cpu.resumePhase ?? 'ISR_EXEC_2') : 'FETCH',
      };
      nextSeq += 1;
      stack = [...stack, frame];
      cpu.SP = newSp;
      cpu.FLAGS = {
        ...cpu.FLAGS,
        MODE: 'KERNEL',
        IE: state.nestedInterrupts,
      };
      cpu.changedRegisters = ['SP', 'FLAGS'];
      cpu.phase = 'IVT_LOOKUP';

      if (stack.length >= 2) {
        verified = markConcept(verified, 'priorityAndNesting', tick);
      }
      verified = markConcept(verified, 'cpuRegistersContext', tick);

      emitSig('control', 'cpu', 'stack', 'PUSH CTX');
      emitSig('data', 'cpu', 'stack', `SP=${toHex(newSp)}`);
      log(
        'CTX',
        `CTX_SAVE: Pushed Frame #${frame.nestingLevel} (PC=${toHex(frame.savedPC)}, R0-R3, FLAGS) to Stack @ ${toHex(newSp)}.`
      );
      summary = `PUSH STACK FRAME #${frame.nestingLevel}`;
      break;
    }

    case 'IVT_LOOKUP': {
      const targetId = cpu.pendingAckDevice;
      if (!targetId) {
        cpu.phase = 'FETCH';
        break;
      }
      const dev = devices[targetId];
      activeIvtDevice = targetId;
      cpu.activeIsrDevice = targetId;
      cpu.pendingAckDevice = null;
      cpu.resumePhase = null;
      cpu.PC = dev.isrAddress;
      cpu.IR = `JMP ${toHex(dev.isrAddress)}`;
      cpu.currentInstructionLabel = ISR_STEP_LABELS[targetId].step1;
      cpu.changedRegisters = ['PC', 'IR'];
      cpu.phase = 'ISR_EXEC_1';

      verified = markConcept(verified, 'ivtLookup', tick);

      emitSig('address', 'cpu', 'ivt', `IVT[${toHex(dev.vectorId, 2)}]`);
      emitSig('data', 'ivt', 'cpu', `ISR ${toHex(dev.isrAddress)}`);
      log(
        'IVT',
        `IVT_LOOKUP: Vector ${toHex(dev.vectorId, 2)} → Jumping PC to ISR ${toHex(dev.isrAddress)} (${dev.name}).`
      );
      summary = `IVT → ${toHex(dev.isrAddress)}`;
      break;
    }

    case 'ISR_EXEC_1': {
      const isrDevId = cpu.activeIsrDevice;
      if (!isrDevId) {
        cpu.phase = 'FETCH';
        break;
      }
      const dev = devices[isrDevId];
      const payload = dev.pendingPayload ?? getNextPayload(isrDevId, dev.totalTriggered);
      const word = payloadToRegisterWord(payload);

      cpu.R0 = word;
      cpu.PC = (cpu.PC + 4) & 0xffff;
      cpu.IR = ISR_STEP_LABELS[isrDevId].step1;
      cpu.currentInstructionLabel = ISR_STEP_LABELS[isrDevId].step2;
      cpu.changedRegisters = ['PC', 'IR', 'R0'];

      const bufEntry: IoBufferEntry = {
        id: `buf-${tick}-${nextSeq}`,
        tick,
        device: isrDevId,
        payload,
        status: 'QUEUED',
      };
      nextSeq += 1;
      ioBuffer = [bufEntry, ...ioBuffer].slice(0, MAX_IO_BUFFER);

      verified = markConcept(verified, 'ioManagement', tick);

      emitSig('data', isrDevId, 'cpu', payload);
      emitSig('os', 'cpu', 'os', `BUF ${dev.shortLabel}`);
      log(
        'ISR',
        `ISR_${dev.shortLabel} [1/2]: Read device data "${payload}" → R0=${toHex(word)}, queued in I/O buffer.`
      );

      const preemptor =
        state.nestedInterrupts && cpu.FLAGS.IE
          ? selectHighestPendingIrq(devices, dev.priority)
          : null;

      if (preemptor) {
        cpu.pendingAckDevice = preemptor.id;
        cpu.resumePhase = 'ISR_EXEC_2';
        cpu.phase = 'INT_ACK';
        verified = markConcept(verified, 'priorityAndNesting', tick);
        emitSig('irq', 'pic', 'cpu', `PREEMPT IRQ${preemptor.irqNumber}`);
        log(
          'IRQ',
          `NESTED PREEMPTION: ${preemptor.shortLabel} IRQ${preemptor.irqNumber} (P${preemptor.priority}) preempts active ${dev.shortLabel} ISR (P${dev.priority})!`
        );
        summary = `PREEMPT BY IRQ${preemptor.irqNumber}`;
      } else {
        cpu.phase = 'ISR_EXEC_2';
        summary = `ISR ${dev.shortLabel} READ PORT`;
      }
      break;
    }

    case 'ISR_EXEC_2': {
      const isrDevId = cpu.activeIsrDevice;
      if (!isrDevId) {
        cpu.phase = 'FETCH';
        break;
      }
      const dev = devices[isrDevId];
      cpu.PC = (cpu.PC + 4) & 0xffff;
      cpu.IR = ISR_STEP_LABELS[isrDevId].step2;
      cpu.currentInstructionLabel = ISR_STEP_LABELS[isrDevId].iret;
      cpu.changedRegisters = ['PC', 'IR'];

      ioBuffer = ioBuffer.map((entry) =>
        entry.device === isrDevId && entry.status === 'QUEUED'
          ? { ...entry, status: 'CONSUMED' }
          : entry
      );

      const wokenPids: number[] = [];
      processes = processes.map((p) => {
        if (p.state === 'BLOCKED' && p.blockedOn === isrDevId) {
          wokenPids.push(p.pid);
          return { ...p, state: 'READY', blockedOn: undefined };
        }
        return p;
      });

      emitSig('control', 'cpu', 'pic', `EOI IRQ${dev.irqNumber}`);
      if (wokenPids.length > 0) {
        verified = markConcept(verified, 'processSynchronization', tick);
        emitSig('os', 'cpu', 'os', `WAKE P${wokenPids[0]}`);
        log(
          'OS',
          `ISR_${dev.shortLabel} [2/2]: I/O complete → Woke PID ${wokenPids.join(', ')} from BLOCKED to READY, sent EOI.`
        );
      } else {
        emitSig('os', 'cpu', 'os', `DRV ${dev.shortLabel}`);
        log(
          'ISR',
          `ISR_${dev.shortLabel} [2/2]: Driver processed buffer & sent EOI (End of Interrupt) to PIC.`
        );
      }

      const preemptor =
        state.nestedInterrupts && cpu.FLAGS.IE
          ? selectHighestPendingIrq(devices, dev.priority)
          : null;

      if (preemptor) {
        cpu.pendingAckDevice = preemptor.id;
        cpu.resumePhase = 'ISR_IRET';
        cpu.phase = 'INT_ACK';
        verified = markConcept(verified, 'priorityAndNesting', tick);
        emitSig('irq', 'pic', 'cpu', `PREEMPT IRQ${preemptor.irqNumber}`);
        log(
          'IRQ',
          `NESTED PREEMPTION: ${preemptor.shortLabel} IRQ${preemptor.irqNumber} (P${preemptor.priority}) preempts ${dev.shortLabel} before IRET!`
        );
        summary = `PREEMPT BY IRQ${preemptor.irqNumber}`;
      } else {
        cpu.phase = 'ISR_IRET';
        summary = `ISR ${dev.shortLabel} EOI`;
      }
      break;
    }

    case 'ISR_IRET': {
      const finishingDevId = cpu.activeIsrDevice;
      if (finishingDevId) {
        devices = {
          ...devices,
          [finishingDevId]: {
            ...devices[finishingDevId],
            inService: false,
            pendingPayload: null,
          },
        };
      }

      const topFrame = stack[stack.length - 1];
      if (!topFrame) {
        cpu.activeIsrDevice = null;
        activeIvtDevice = null;
        cpu.FLAGS = { ...cpu.FLAGS, MODE: 'USER', IE: true };
        cpu.phase = 'FETCH';
        summary = 'IRET → FETCH';
        break;
      }

      stack = stack.slice(0, -1);
      cpu.SP = cpu.SP + STACK_FRAME_SIZE;
      cpu.PC = topFrame.savedPC;
      cpu.FLAGS = { ...topFrame.savedFLAGS };
      cpu.R0 = topFrame.savedR0;
      cpu.R1 = topFrame.savedR1;
      cpu.R2 = topFrame.savedR2;
      cpu.R3 = topFrame.savedR3;
      cpu.IR = 'IRET';
      cpu.changedRegisters = ['PC', 'SP', 'FLAGS', 'R0', 'R1', 'R2', 'R3'];

      verified = markConcepts(verified, ['cpuRegistersContext', 'interruptHandling'], tick);
      emitSig('control', 'stack', 'cpu', `POP FRAME #${topFrame.nestingLevel}`);

      if (topFrame.returnToDevice) {
        const outerDev = devices[topFrame.returnToDevice];
        cpu.activeIsrDevice = topFrame.returnToDevice;
        activeIvtDevice = topFrame.returnToDevice;
        cpu.phase = topFrame.returnPhase;
        cpu.currentInstructionLabel =
          topFrame.returnPhase === 'ISR_EXEC_2'
            ? ISR_STEP_LABELS[outerDev.id].step2
            : ISR_STEP_LABELS[outerDev.id].iret;

        log(
          'CTX',
          `IRET: Popped Frame #${topFrame.nestingLevel} → Resuming outer ${outerDev.shortLabel} ISR @ ${toHex(cpu.PC)}.`
        );
        summary = `IRET → RESUME ${outerDev.shortLabel}`;
      } else {
        cpu.activeIsrDevice = null;
        activeIvtDevice = null;
        cpu.FLAGS = { ...cpu.FLAGS, MODE: 'USER', IE: true };

        const currentlyRunning = getActiveProcess(processes);
        const readyUser = processes.find((p) => p.pid !== 0 && p.state === 'READY');
        if (currentlyRunning?.pid === 0 && readyUser) {
          processes = processes.map((p) => {
            if (p.pid === readyUser.pid) return { ...p, state: 'RUNNING' };
            if (p.pid === 0) return { ...p, state: 'READY' };
            return p;
          });
          cpu.PC = program[cpu.programIndex % program.length].pc;
          cpu.currentInstructionLabel = program[cpu.programIndex % program.length].mnemonic;
          verified = markConcept(verified, 'processSynchronization', tick);
          emitSig('os', 'os', 'cpu', `SCHED P${readyUser.pid}`);
          log(
            'OS',
            `OS Scheduler dispatched newly READY PID ${readyUser.pid} (${readyUser.name}) onto CPU.`
          );
        }

        cpu.phase = 'FETCH';
        log(
          'CTX',
          `IRET: Popped Frame #${topFrame.nestingLevel} (SP=${toHex(cpu.SP)}) → Restored USER mode @ PC=${toHex(cpu.PC)}.`
        );
        summary = `IRET → USER ${toHex(cpu.PC)}`;
      }
      break;
    }
  }

  const nextPartial: SimState = {
    ...state,
    cpu,
    devices,
    stack,
    processes,
    ioBuffer,
    activeIvtDevice,
    activeSignals: signals,
    logs,
    verified,
    nextSeq,
  };

  const sample: WaveformSample = {
    tick,
    cpuState: classifyCpuState(nextPartial),
    nestingDepth: stack.length,
    irqPending: {
      timer: devices.timer.pending,
      keyboard: devices.keyboard.pending,
      mouse: devices.mouse.pending,
      printer: devices.printer.pending,
    },
    irqInService: {
      timer: devices.timer.inService,
      keyboard: devices.keyboard.inService,
      mouse: devices.mouse.inService,
      printer: devices.printer.inService,
    },
    busActivity: classifyBusActivity(signals),
    phase: cpu.phase,
    summary,
  };

  const waveforms = [...state.waveforms, sample].slice(-MAX_WAVEFORM_SAMPLES);

  return {
    ...nextPartial,
    waveforms,
  };
}
