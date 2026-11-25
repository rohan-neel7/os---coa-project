import type { DeviceId, DeviceState } from './types';

export const DEVICE_ORDER: DeviceId[] = ['timer', 'keyboard', 'mouse', 'printer'];
export const SPATIAL_DEVICE_ORDER: DeviceId[] = ['keyboard', 'mouse', 'printer', 'timer'];

export const DEVICE_ACCENTS: Record<
  DeviceId,
  { color: string; label: string; tailwind: string }
> = {
  keyboard: { color: '#F59E0B', label: 'KBD · IRQ1', tailwind: 'text-amber-300 border-amber-500/50' },
  mouse: { color: '#38BDF8', label: 'MSE · IRQ3', tailwind: 'text-sky-300 border-sky-500/50' },
  printer: { color: '#2DD4BF', label: 'PRN/DMA · IRQ7', tailwind: 'text-teal-300 border-teal-500/50' },
  timer: { color: '#10B981', label: 'PIT · IRQ0', tailwind: 'text-emerald-300 border-emerald-500/50' },
};

export const INITIAL_SP = 0x7ff0;
export const STACK_FRAME_SIZE = 0x18;
export const IDLE_PC = 0x0100;
export const MAIN_BASE_PC = 0x0400;
export const MAX_WAVEFORM_SAMPLES = 48;
export const MAX_LOG_ENTRIES = 120;
export const MAX_IO_BUFFER = 16;

export interface ProgramInstruction {
  pc: number;
  mnemonic: string;
  op: 'ADD' | 'LOAD' | 'CMP' | 'STORE' | 'INC' | 'SYSCALL_PRN';
}

export const MAIN_PROGRAM: ProgramInstruction[] = [
  { pc: 0x0400, mnemonic: 'LOAD R1, [0x2000]', op: 'LOAD' },
  { pc: 0x0404, mnemonic: 'ADD  R0, R1, #0x08', op: 'ADD' },
  { pc: 0x0408, mnemonic: 'CMP  R0, #0x40', op: 'CMP' },
  { pc: 0x040c, mnemonic: 'STORE [0x2004], R0', op: 'STORE' },
  { pc: 0x0410, mnemonic: 'INC  R2', op: 'INC' },
  { pc: 0x0414, mnemonic: 'ADD  R3, R2, R1', op: 'ADD' },
  { pc: 0x0418, mnemonic: 'JMP  0x0400', op: 'INC' },
];

export const IO_WAIT_PROGRAM: ProgramInstruction[] = [
  { pc: 0x0400, mnemonic: 'SYSCALL WRITE_PRINTER', op: 'SYSCALL_PRN' },
  { pc: 0x0404, mnemonic: 'LOAD R1, [PRN_STATUS]', op: 'LOAD' },
  { pc: 0x0408, mnemonic: 'ADD  R0, R1, #0x01', op: 'ADD' },
  { pc: 0x040c, mnemonic: 'STORE [0x2010], R0', op: 'STORE' },
  { pc: 0x0410, mnemonic: 'INC  R2', op: 'INC' },
  { pc: 0x0414, mnemonic: 'JMP  0x0400', op: 'INC' },
];

export const DEVICE_TEMPLATES: Record<DeviceId, Omit<DeviceState, 'totalTriggered'>> = {
  timer: {
    id: 'timer',
    name: 'System Timer (PIT)',
    shortLabel: 'TMR',
    irqNumber: 0,
    vectorId: 0x20,
    isrAddress: 0xf000,
    priority: 1,
    masked: false,
    pending: false,
    inService: false,
    pendingPayload: null,
  },
  keyboard: {
    id: 'keyboard',
    name: 'Keyboard (PS/2)',
    shortLabel: 'KBD',
    irqNumber: 1,
    vectorId: 0x21,
    isrAddress: 0xf100,
    priority: 2,
    masked: false,
    pending: false,
    inService: false,
    pendingPayload: null,
  },
  mouse: {
    id: 'mouse',
    name: 'Mouse (HID)',
    shortLabel: 'MSE',
    irqNumber: 3,
    vectorId: 0x23,
    isrAddress: 0xf200,
    priority: 3,
    masked: false,
    pending: false,
    inService: false,
    pendingPayload: null,
  },
  printer: {
    id: 'printer',
    name: 'Printer / DMA',
    shortLabel: 'PRN',
    irqNumber: 7,
    vectorId: 0x27,
    isrAddress: 0xf300,
    priority: 4,
    masked: false,
    pending: false,
    inService: false,
    pendingPayload: null,
  },
};

export const DEVICE_PAYLOADS: Record<DeviceId, string[]> = {
  keyboard: [
    "SCAN 0x1E 'A'",
    "SCAN 0x30 'B'",
    "SCAN 0x2E 'C'",
    "SCAN 0x1C 'RET'",
    "SCAN 0x20 'D'",
  ],
  mouse: [
    'ΔX:+14 ΔY:-6 [LMB]',
    'ΔX:-8 ΔY:+11 [MOV]',
    'ΔX:+2 ΔY:+4 [RMB]',
    'ΔX:-19 ΔY:-3 [MOV]',
  ],
  printer: [
    'DMA_DONE 4KB',
    'BUF_RDY 2KB',
    'SPOOL_ACK 8KB',
  ],
  timer: [
    'PIT_TICK #1',
    'PIT_TICK #2',
    'PIT_TICK #3',
    'PIT_TICK #4',
  ],
};

export const ISR_STEP_LABELS: Record<DeviceId, { step1: string; step2: string; iret: string }> = {
  timer: {
    step1: 'IN  R0, [PORT_PIT0]',
    step2: 'CALL OS_SCHED_TICK ; EOI',
    iret: 'IRET',
  },
  keyboard: {
    step1: 'IN  R0, [PORT_0x60]',
    step2: 'CALL KBD_ENQUEUE ; EOI',
    iret: 'IRET',
  },
  mouse: {
    step1: 'IN  R0, [PORT_0x64]',
    step2: 'CALL HID_DISPATCH ; EOI',
    iret: 'IRET',
  },
  printer: {
    step1: 'IN  R0, [DMA_STAT]',
    step2: 'CALL PRN_WAKEUP ; EOI',
    iret: 'IRET',
  },
};

export function toHex(value: number, width = 4): string {
  const normalized = value >>> 0;
  return '0x' + normalized.toString(16).toUpperCase().padStart(width, '0');
}

export function payloadToRegisterWord(payload: string): number {
  let hash = 0x1200;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash * 31) + payload.charCodeAt(i)) & 0xffff;
  }
  return hash;
}
