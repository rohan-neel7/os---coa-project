import type { PresetDefinition, PresetId } from './types';

export const PRESETS: PresetDefinition[] = [
  {
    id: 'single-kbd',
    name: '1. Single Keyboard Interrupt',
    shortTag: 'IRQ1 · SAVE → IVT → ISR → IRET',
    description:
      'Raises IRQ1 (Keyboard scan code) at tick 3 and walks through context save, IVT vector lookup, ISR execution, and IRET restoration.',
  },
  {
    id: 'interrupt-storm',
    name: '2. Interrupt Storm (Priority Queueing)',
    shortTag: 'PIC ARBITRATION · P2 → P3 → P4',
    description:
      'Simultaneously triggers Printer (P4), Mouse (P3), and Keyboard (P2) at tick 2. Watch the PIC serialize service strictly by priority.',
  },
  {
    id: 'nested-preemption',
    name: '3. Nested Preemption',
    shortTag: '2-LEVEL STACK · TIMER PREEMPTS PRINTER',
    description:
      'Enables nested interrupts. Printer IRQ7 (P4) begins servicing, then high-priority Timer IRQ0 (P1) preempts it mid-ISR, pushing a 2nd stack frame.',
  },
  {
    id: 'os-io-wakeup',
    name: '4. OS I/O Wait & Wakeup',
    shortTag: 'BLOCKED → IDLE → IRQ7 WAKEUP',
    description:
      'PID 102 issues SYSCALL WRITE_PRINTER and blocks on I/O so CPU yields to System Idle. Printer DMA IRQ7 at tick 10 wakes PID 102 to Ready/Running.',
  },
];

export function getPresetDefinition(id: PresetId): PresetDefinition {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
