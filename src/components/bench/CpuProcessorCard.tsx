import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Cpu } from 'lucide-react';
import { toHex } from '../../engine/constants';
import type { CpuPhase, SimState } from '../../engine/types';
import { IcPinRail } from '../hardware/HardwareArt';

interface CpuProcessorCardProps {
  state: SimState;
  nodeRef: (el: HTMLDivElement | null) => void;
}

const MAIN_CYCLE: { phase: CpuPhase; label: string }[] = [
  { phase: 'FETCH', label: 'FETCH' },
  { phase: 'DECODE', label: 'DECODE' },
  { phase: 'EXECUTE', label: 'EXECUTE' },
  { phase: 'INT_CHECK', label: 'INT CHECK' },
];

const ISR_CYCLE: { phase: CpuPhase; label: string }[] = [
  { phase: 'INT_ACK', label: 'INT ACK' },
  { phase: 'CTX_SAVE', label: 'SAVE CTX' },
  { phase: 'IVT_LOOKUP', label: 'IVT' },
  { phase: 'ISR_EXEC_1', label: 'ISR 1' },
  { phase: 'ISR_EXEC_2', label: 'ISR 2' },
  { phase: 'ISR_IRET', label: 'IRET' },
];

export const CpuProcessorCard: React.FC<CpuProcessorCardProps> = ({ state, nodeRef }) => {
  const { cpu, stack } = state;
  const activeDev = cpu.activeIsrDevice ? state.devices[cpu.activeIsrDevice] : null;
  const isInterruptPipeline = ISR_CYCLE.some((s) => s.phase === cpu.phase);
  const isNestedOverdrive = stack.length >= 2;

  const registers: { name: string; value: string }[] = [
    { name: 'PC', value: toHex(cpu.PC) },
    { name: 'SP', value: toHex(cpu.SP) },
    { name: 'R0', value: toHex(cpu.R0) },
    { name: 'R1', value: toHex(cpu.R1) },
    { name: 'R2', value: toHex(cpu.R2) },
    { name: 'R3', value: toHex(cpu.R3) },
  ];

  const flagsChanged = cpu.changedRegisters.includes('FLAGS');
  const irChanged = cpu.changedRegisters.includes('IR');

  return (
    <div ref={nodeRef} className="relative flex flex-col">
      {/* Top Gold QFP Pins */}
      <IcPinRail side="top" count={12} gold />

      <div className="flex items-stretch">
        {/* Left QFP Pins */}
        <IcPinRail
          side="left"
          count={8}
          gold
          activeIndices={isInterruptPipeline ? [1, 2, 4, 5] : [0, 3]}
          accentColor={isInterruptPipeline ? '#F43F5E' : '#38BDF8'}
        />

        {/* CPU Silicon Package */}
        <div
          className={`ic-package relative flex flex-1 flex-col rounded-md border transition-shadow ${
            isNestedOverdrive
              ? 'border-amber-400/80 glow-ctrl'
              : isInterruptPipeline
                ? 'border-rose-500/60 glow-irq'
                : 'border-sky-500/40'
          }`}
        >
          {/* Die Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] px-3.5 py-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-sky-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-slate-100">
                    CPU Processor
                  </h2>
                  {isNestedOverdrive && (
                    <span className="animate-pulse rounded border border-amber-400/70 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-200">
                      NESTED L{stack.length}
                    </span>
                  )}
                </div>
                <p className="font-mono text-[9px] text-slate-400">
                  16-BIT CORE · {activeDev ? `SERVICING ${activeDev.name}` : 'USER / OS PIPELINE'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                PC {toHex(cpu.PC)}
              </span>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                  cpu.FLAGS.MODE === 'KERNEL'
                    ? 'border-rose-500/60 bg-rose-500/18 text-rose-200'
                    : 'border-emerald-500/45 bg-emerald-500/12 text-emerald-300'
                }`}
              >
                {cpu.FLAGS.MODE === 'KERNEL' ? 'ISR · KERNEL' : 'MAIN · USER'}
              </span>
            </div>
          </div>

          {/* Spacious 3-Bay Vertical Silicon Die */}
          <div className="flex flex-col gap-2.5 p-3">
            {/* Bay 1: CPU Registers + IR & FLAGS */}
            <div className="flex flex-col gap-1.5 rounded border border-[#1E293B] bg-[#070A10]/90 p-2 font-mono">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                <span>CPU Registers</span>
                <span className="text-slate-500">16-BIT BANK</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:grid-cols-6">
                {registers.map((reg) => {
                  const changed = cpu.changedRegisters.includes(reg.name);
                  return (
                    <motion.div
                      key={reg.name}
                      animate={changed ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`flex flex-col items-start justify-between rounded border px-1.5 py-1 transition-colors ${
                        changed
                          ? 'border-emerald-400/85 bg-emerald-500/20 text-emerald-100'
                          : 'border-[#1E293B] bg-[#0B101A] text-slate-200'
                      }`}
                    >
                      <span className="text-[8px] font-semibold text-slate-400">{reg.name}</span>
                      <span className="font-bold">{reg.value}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* IR + FLAGS footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[10px]">
                <div
                  className={`flex min-w-0 flex-1 items-center gap-1.5 rounded border px-2 py-1 transition-colors ${
                    irChanged
                      ? 'border-emerald-400/80 bg-emerald-500/15 text-emerald-200'
                      : 'border-[#1E293B] bg-[#0B101A] text-emerald-300'
                  }`}
                >
                  <span className="shrink-0 text-[9px] text-slate-500">IR</span>
                  <span className="truncate font-semibold">{cpu.IR}</span>
                </div>

                <div
                  className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[9px] ${
                    flagsChanged
                      ? 'border-amber-400/80 bg-amber-500/15'
                      : 'border-[#1E293B] bg-[#0B101A]'
                  }`}
                >
                  <span className="text-slate-400">FLAGS</span>
                  <span
                    className={`rounded px-1 font-bold ${
                      cpu.FLAGS.IE ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    IE:{cpu.FLAGS.IE ? '1' : '0'}
                  </span>
                  <span
                    className={`rounded px-1 font-bold ${
                      cpu.FLAGS.Z ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Z:{cpu.FLAGS.Z ? '1' : '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bay 2: Full-Width Instruction Execution Cycle */}
            <div className="rounded border border-[#1E293B] bg-[#070A10]/90 p-2.5">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
                <span>Instruction Execution Cycle</span>
                <span className={!isInterruptPipeline ? 'font-bold text-sky-400' : 'text-slate-600'}>
                  {!isInterruptPipeline ? 'RUNNING' : 'PAUSED FOR ISR'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {MAIN_CYCLE.map((step, i) => {
                  const active = cpu.phase === step.phase;
                  return (
                    <div
                      key={step.phase}
                      className="relative flex items-center justify-between rounded border border-[#1E293B] bg-[#0C121D] px-2 py-1.5 font-mono text-[10px] font-bold"
                    >
                      {active && (
                        <motion.div
                          layoutId="cpu-phase-beam"
                          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                          className="absolute inset-0 rounded border border-sky-400 bg-sky-500/25 glow-addr"
                        />
                      )}
                      <span className={`relative z-10 ${active ? 'text-sky-100' : 'text-slate-400'}`}>
                        {i + 1}. {step.label}
                      </span>
                      <ArrowRight
                        className={`relative z-10 h-3 w-3 shrink-0 ${
                          active ? 'text-sky-300' : 'text-slate-700'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bay 3: Full-Width Interrupt Handling Pipeline */}
            <div className="rounded border border-[#1E293B] bg-[#070A10]/90 p-2.5">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
                <span>Interrupt Handling Pipeline</span>
                <span className={isInterruptPipeline ? 'font-bold text-rose-400' : 'text-slate-600'}>
                  {isInterruptPipeline ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {ISR_CYCLE.map((step) => {
                  const active = cpu.phase === step.phase;
                  return (
                    <div
                      key={step.phase}
                      className="relative flex items-center justify-center rounded border border-[#1E293B] bg-[#0C121D] px-1 py-1.5 font-mono text-[9px] font-bold"
                    >
                      {active && (
                        <motion.div
                          layoutId="cpu-phase-beam"
                          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                          className="absolute inset-0 rounded border border-rose-400 bg-rose-500/28 glow-irq"
                        />
                      )}
                      <span className={`relative z-10 whitespace-nowrap ${active ? 'text-rose-100' : 'text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right QFP Pins */}
        <IcPinRail side="right" count={8} gold />
      </div>

      {/* Bottom QFP Pins (To Memory IVT & Kernel Stack) */}
      <IcPinRail
        side="bottom"
        count={12}
        gold
        activeIndices={
          cpu.phase === 'IVT_LOOKUP'
            ? [2, 3]
            : cpu.phase === 'CTX_SAVE' || cpu.phase === 'ISR_IRET'
              ? [8, 9]
              : []
        }
        accentColor={cpu.phase === 'IVT_LOOKUP' ? '#38BDF8' : '#A78BFA'}
      />
    </div>
  );
};
