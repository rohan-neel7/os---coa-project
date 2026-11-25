export type DeviceId = 'timer' | 'keyboard' | 'mouse' | 'printer';

export type CpuPhase =
  | 'FETCH'
  | 'DECODE'
  | 'EXECUTE'
  | 'INT_CHECK'
  | 'INT_ACK'
  | 'CTX_SAVE'
  | 'IVT_LOOKUP'
  | 'ISR_EXEC_1'
  | 'ISR_EXEC_2'
  | 'ISR_IRET';

export type PresetId =
  | 'single-kbd'
  | 'interrupt-storm'
  | 'nested-preemption'
  | 'os-io-wakeup';

export interface DeviceState {
  id: DeviceId;
  name: string;
  shortLabel: string;
  irqNumber: number;
  vectorId: number;
  isrAddress: number;
  priority: number; // 1 = highest, 4 = lowest
  masked: boolean;
  pending: boolean;
  inService: boolean;
  pendingPayload: string | null;
  totalTriggered: number;
}

export interface CpuFlags {
  Z: boolean;
  C: boolean;
  IE: boolean;
  MODE: 'USER' | 'KERNEL';
}

export interface CpuState {
  PC: number;
  IR: string;
  SP: number;
  FLAGS: CpuFlags;
  R0: number;
  R1: number;
  R2: number;
  R3: number;
  phase: CpuPhase;
  activeIsrDevice: DeviceId | null;
  pendingAckDevice: DeviceId | null;
  resumePhase: CpuPhase | null;
  changedRegisters: string[];
  currentInstructionLabel: string;
  programIndex: number;
}

export interface StackFrame {
  id: string;
  nestingLevel: number;
  spTop: number;
  savedPC: number;
  savedFLAGS: CpuFlags;
  savedR0: number;
  savedR1: number;
  savedR2: number;
  savedR3: number;
  interruptedBy: DeviceId;
  returnToDevice: DeviceId | null;
  returnPhase: CpuPhase;
}

export interface OsProcess {
  pid: number;
  name: string;
  state: 'RUNNING' | 'READY' | 'BLOCKED';
  blockedOn?: DeviceId;
  progress: number;
}

export interface IoBufferEntry {
  id: string;
  tick: number;
  device: DeviceId;
  payload: string;
  status: 'QUEUED' | 'CONSUMED';
}

export type BusKind = 'irq' | 'control' | 'address' | 'data' | 'os';
export type HardwareNodeId =
  | 'keyboard'
  | 'mouse'
  | 'printer'
  | 'timer'
  | 'pic'
  | 'cpu'
  | 'ivt'
  | 'stack'
  | 'os';

export type ConceptKey =
  | 'hardwareInterrupts'
  | 'interruptController'
  | 'instructionCycle'
  | 'cpuRegistersContext'
  | 'ivtLookup'
  | 'priorityAndNesting'
  | 'deviceManagement'
  | 'ioManagement'
  | 'interruptHandling'
  | 'processSynchronization';

export interface VerifiedConcepts {
  concepts: Record<ConceptKey, number | null>;
  triggeredDevices: Record<DeviceId, boolean>;
}

export interface BusSignal {
  id: string;
  bus: BusKind;
  from: HardwareNodeId;
  to: HardwareNodeId;
  label: string;
}

export type WaveformCpuState =
  | 'MAIN'
  | 'IDLE'
  | 'CTX'
  | 'ISR_TIMER'
  | 'ISR_KEYBOARD'
  | 'ISR_MOUSE'
  | 'ISR_PRINTER';

export type WaveformBusActivity = 'NONE' | 'IRQ' | 'CTRL' | 'ADDR' | 'DATA' | 'OS';

export interface WaveformSample {
  tick: number;
  cpuState: WaveformCpuState;
  nestingDepth: number;
  irqPending: Record<DeviceId, boolean>;
  irqInService: Record<DeviceId, boolean>;
  busActivity: WaveformBusActivity;
  phase: CpuPhase;
  summary: string;
}

export type LogCategory = 'CPU' | 'IRQ' | 'CTX' | 'IVT' | 'ISR' | 'OS';

export interface TraceLogEntry {
  id: string;
  tick: number;
  category: LogCategory;
  message: string;
}

export type ScheduledEventAction =
  | { type: 'RAISE_IRQ'; deviceId: DeviceId; payload?: string }
  | { type: 'BLOCK_IO'; pid: number; deviceId: DeviceId };

export interface ScheduledEvent {
  id: string;
  fired: boolean;
  atTick?: number;
  onPhase?: {
    phase: CpuPhase;
    activeIrq?: DeviceId;
  };
  action: ScheduledEventAction;
}

export interface SimState {
  tick: number;
  cpu: CpuState;
  devices: Record<DeviceId, DeviceState>;
  nestedInterrupts: boolean;
  periodicTimer: boolean;
  timerPeriod: number;
  autoTraffic: boolean;
  stack: StackFrame[];
  activeIvtDevice: DeviceId | null;
  processes: OsProcess[];
  ioBuffer: IoBufferEntry[];
  activeSignals: BusSignal[];
  waveforms: WaveformSample[];
  logs: TraceLogEntry[];
  scheduledEvents: ScheduledEvent[];
  activePresetId: PresetId;
  verified: VerifiedConcepts;
  nextSeq: number;
}

export interface PresetDefinition {
  id: PresetId;
  name: string;
  shortTag: string;
  description: string;
}
