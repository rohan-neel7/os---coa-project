import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Layers, Table2 } from 'lucide-react';
import { DEVICE_ORDER, toHex } from '../../engine/constants';
import type { SimState } from '../../engine/types';

interface MemoryIvtStackPanelProps {
  state: SimState;
  ivtRef: (el: HTMLDivElement | null) => void;
  stackRef: (el: HTMLDivElement | null) => void;
}

export const MemoryIvtStackPanel: React.FC<MemoryIvtStackPanelProps> = ({
  state,
  ivtRef,
  stackRef,
}) => {
  const { cpu, stack } = state;
  const highlightedIvtId =
    cpu.phase === 'IVT_LOOKUP'
      ? (cpu.pendingAckDevice ?? state.activeIvtDevice)
      : state.activeIvtDevice;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Left: Interrupt Vector Table (IVT) */}
      <div
        ref={ivtRef}
        className={`memory-module flex flex-col rounded-md border p-2.5 transition-colors ${
          cpu.phase === 'IVT_LOOKUP'
            ? 'border-sky-400/75 glow-addr'
            : 'border-sky-500/30'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <Table2 className="h-3.5 w-3.5 text-sky-400" />
            <h3 className="font-[var(--font-display)] text-[11px] font-bold uppercase tracking-wider text-sky-100">
              Interrupt Vector Table
            </h3>
          </div>
          <span className="font-mono text-[9px] text-sky-400/70">IVT</span>
        </div>

        <div className="overflow-hidden rounded border border-sky-500/25 bg-[#05080E] font-mono text-[10px]">
          <div className="grid grid-cols-[68px_48px_1fr] border-b border-[#1E293B] bg-[#0B1220] px-2.5 py-1.5 font-semibold text-slate-400">
            <span>IRQ</span>
            <span>VEC</span>
            <span>ISR ADDR</span>
          </div>

          <div className="flex flex-col">
            {DEVICE_ORDER.map((id) => {
              const dev = state.devices[id];
              const isLookup = highlightedIvtId === id;
              const isLookupPhase = cpu.phase === 'IVT_LOOKUP' && isLookup;
              return (
                <div
                  key={id}
                  className={`relative grid grid-cols-[68px_48px_1fr] items-center border-b border-[#1E293B]/60 px-2.5 py-2 last:border-b-0 transition-colors ${
                    isLookupPhase
                      ? 'bg-sky-500/25 text-sky-100'
                      : isLookup
                        ? 'bg-rose-500/18 text-rose-100'
                        : 'text-slate-300'
                  }`}
                >
                  {isLookup && (
                    <motion.span
                      layoutId="ivt-active-beam"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-sky-400 shadow-[0_0_8px_#38BDF8]"
                    />
                  )}
                  <span className="pl-1 font-bold text-rose-300">
                    {isLookup ? '▶ ' : ''}IRQ{dev.irqNumber}
                  </span>
                  <span className="text-amber-300">{toHex(dev.vectorId, 2)}</span>
                  <span className="text-sky-300">{toHex(dev.isrAddress)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Kernel Stack */}
      <div
        ref={stackRef}
        className={`memory-module flex flex-col rounded-md border p-2.5 transition-colors ${
          cpu.phase === 'CTX_SAVE' || cpu.phase === 'ISR_IRET'
            ? 'border-violet-400/80 glow-os'
            : 'border-violet-500/30'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-violet-400" />
            <h3 className="font-[var(--font-display)] text-[11px] font-bold uppercase tracking-wider text-violet-100">
              Kernel Stack
            </h3>
          </div>
          <span className="font-mono text-[9px] font-bold text-violet-300">
            SP {toHex(cpu.SP)}
          </span>
        </div>

        <div className="telemetry-scroll flex min-h-[164px] max-h-[220px] flex-col gap-1.5 overflow-y-auto rounded border border-violet-500/25 bg-[#05080E] p-2">
          <AnimatePresence initial={false} mode="popLayout">
            {stack.length === 0 ? (
              <motion.div
                key="stack-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full items-center justify-center text-center font-mono text-[10px] text-slate-600"
              >
                STACK EMPTY
                <br />
                READY FOR IRQ PUSH
              </motion.div>
            ) : (
              [...stack].reverse().map((frame, idx) => {
                const isTop = idx === 0;
                const dev = state.devices[frame.interruptedBy];
                const isNested = frame.nestingLevel >= 2;
                return (
                  <motion.div
                    key={frame.id}
                    layout
                    initial={{ opacity: 0, y: -12, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className={`rounded border p-1.5 font-mono text-[9px] ${
                      isNested && isTop
                        ? 'border-rose-400/80 bg-rose-500/15 glow-irq'
                        : isTop
                          ? 'border-amber-400/75 bg-amber-500/14 glow-ctrl'
                          : 'border-slate-700 bg-[#101624]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex items-center gap-1 font-bold ${
                          isNested ? 'text-rose-200' : 'text-amber-200'
                        }`}
                      >
                        {isTop && <ArrowRight className="h-2.5 w-2.5 text-amber-400" />}
                        FRAME #{frame.nestingLevel} · {dev.shortLabel}
                        {isNested ? ' (NEST)' : ''}
                      </span>
                      <span className="text-slate-400">{toHex(frame.spTop)}</span>
                    </div>

                    <div className="mt-1 grid grid-cols-2 gap-x-2 text-[9px] text-slate-300">
                      <span>RET: {toHex(frame.savedPC)}</span>
                      <span>MODE: {frame.savedFLAGS.MODE}</span>
                      <span>R0: {toHex(frame.savedR0)}</span>
                      <span>R1: {toHex(frame.savedR1)}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
