import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HardDriveDownload, ServerCog } from 'lucide-react';
import type { SimState } from '../../engine/types';

interface OsProcessBlockCardProps {
  state: SimState;
  onRequestPrinterIo: () => void;
  nodeRef: (el: HTMLDivElement | null) => void;
}

export const OsProcessBlockCard: React.FC<OsProcessBlockCardProps> = ({
  state,
  onRequestPrinterIo,
  nodeRef,
}) => {
  return (
    <div
      ref={nodeRef}
      className="hw-card flex flex-col rounded-md border border-violet-500/35 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] px-3 py-2">
        <div className="flex items-center gap-2">
          <ServerCog className="h-3.5 w-3.5 text-violet-400" />
          <div>
            <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-slate-100">
              OS I/O &amp; Process Block
            </h2>
            <p className="font-mono text-[9px] text-slate-400">
              PROCESS SYNCHRONIZATION · NON-BUSY WAIT
            </p>
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={onRequestPrinterIo}
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-violet-400/55 bg-violet-500/18 px-2 py-1 font-mono text-[9px] font-bold text-violet-200 transition hover:bg-violet-500/30"
        >
          <HardDriveDownload className="h-3 w-3" />
          BLOCK ON PRN I/O
        </motion.button>
      </div>

      <div className="flex flex-col gap-3 p-3 pb-3.5">
        {/* Process Scheduler Cards */}
        <div className="flex flex-col gap-1.5">
          {state.processes.map((proc) => (
            <motion.div
              key={proc.pid}
              layout
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className={`flex flex-col gap-1 rounded border px-2.5 py-1.5 transition-colors ${
                proc.state === 'RUNNING'
                  ? 'border-emerald-500/60 bg-emerald-500/12 glow-data'
                  : proc.state === 'BLOCKED'
                    ? 'border-amber-500/65 bg-amber-500/14 glow-ctrl'
                    : 'border-[#1E293B] bg-[#070A0F]/90'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-slate-400">P{String(proc.pid).padStart(3, '0')}</span>
                    <span className="truncate font-sans font-semibold text-slate-100">
                      {proc.name}
                    </span>
                  </div>
                  {proc.blockedOn && (
                    <div className="animate-pulse font-mono text-[9px] font-bold text-amber-300">
                      BLOCKED ON {proc.blockedOn.toUpperCase()} I/O
                    </div>
                  )}
                </div>

                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                    proc.state === 'RUNNING'
                      ? 'bg-emerald-500/25 text-emerald-200'
                      : proc.state === 'BLOCKED'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  {proc.state}
                </span>
              </div>

              {proc.pid !== 0 && (
                <div className="h-1 w-full overflow-hidden rounded bg-slate-800/80">
                  <motion.div
                    className={`h-full ${
                      proc.state === 'BLOCKED' ? 'bg-amber-400/75' : 'bg-emerald-400'
                    }`}
                    animate={{ width: `${Math.max(6, proc.progress)}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Device I/O Buffer Queue */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
            <span>Device I/O Buffer / Queue</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
              {state.ioBuffer.length}
            </span>
          </div>

          <div className="telemetry-scroll flex min-h-[84px] max-h-[112px] flex-col gap-1 overflow-y-auto rounded border border-[#1E293B] bg-[#06090F] p-1.5">
            <AnimatePresence initial={false}>
              {state.ioBuffer.length === 0 ? (
                <div className="flex h-full items-center justify-center font-mono text-[10px] text-slate-600">
                  NO I/O PACKETS QUEUED
                </div>
              ) : (
                state.ioBuffer.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center justify-between gap-2 rounded border border-[#1E293B]/80 bg-[#0F1523] px-2 py-1 font-mono text-[10px]"
                  >
                    <div className="min-w-0 truncate">
                      <span className="mr-1.5 font-bold text-sky-400">
                        {state.devices[entry.device].shortLabel}
                      </span>
                      <span className="text-slate-200">{entry.payload}</span>
                    </div>
                    <span
                      className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-bold ${
                        entry.status === 'CONSUMED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
